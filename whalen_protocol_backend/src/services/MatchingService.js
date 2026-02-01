import ProviderCapability from '../models/ProviderCapability.js';
import Match from '../models/Match.js';
import ComputeRequest from '../models/ComputeRequest.js';
import { calculateMatchScore } from '../utils/helpers.js';

export class MatchingService {
  /**
   * Find matching providers for a compute request
   */
  static async findMatches(request, limit = 10) {
    try {
      // Search for providers with matching capabilities
      const providers = await ProviderCapability.search(
        request.gpu_count,
        request.gpu_type,
        request.max_price_per_hour,
        request.region || null
      );

      if (providers.length === 0) {
        return [];
      }

      // Score and sort providers
      const scoredProviders = providers.map(provider => ({
        ...provider,
        match_score: calculateMatchScore(request, provider),
      }));

      // Sort by score (highest first)
      scoredProviders.sort((a, b) => b.match_score - a.match_score);

      // Return top matches
      return scoredProviders.slice(0, limit);
    } catch (error) {
      console.error('Error finding matches:', error);
      throw error;
    }
  }

  /**
   * Automatically match a request to the best provider
   */
  static async autoMatch(requestId) {
    try {
      const request = await ComputeRequest.findById(requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      // Find matching providers
      const matches = await this.findMatches(request, 1);
      if (matches.length === 0) {
        return null;
      }

      const bestProvider = matches[0];

      // Create match
      const match = await Match.create(
        requestId,
        bestProvider.provider_id,
        bestProvider.id,
        bestProvider.price_per_hour
      );

      // Update request status
      await ComputeRequest.update(requestId, { status: 'matched' });

      return match;
    } catch (error) {
      console.error('Error auto-matching request:', error);
      throw error;
    }
  }

  /**
   * Get all matches for a request
   */
  static async getMatchesForRequest(requestId) {
    try {
      return await Match.findByRequestId(requestId);
    } catch (error) {
      console.error('Error getting matches for request:', error);
      throw error;
    }
  }

  /**
   * Accept a match (provider accepts the request)
   */
  static async acceptMatch(matchId, providerId) {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.provider_id !== providerId) {
        throw new Error('Unauthorized: Only the provider can accept this match');
      }

      // Update match status
      const updatedMatch = await Match.update(matchId, {
        status: 'accepted',
        start_time: new Date(),
      });

      // Update request status
      await ComputeRequest.update(match.request_id, { status: 'in_progress' });

      return updatedMatch;
    } catch (error) {
      console.error('Error accepting match:', error);
      throw error;
    }
  }

  /**
   * Complete a match
   */
  static async completeMatch(matchId, providerId) {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.provider_id !== providerId) {
        throw new Error('Unauthorized: Only the provider can complete this match');
      }

      // Update match status
      const updatedMatch = await Match.update(matchId, {
        status: 'completed',
        end_time: new Date(),
      });

      // Update request status
      await ComputeRequest.update(match.request_id, { status: 'completed' });

      return updatedMatch;
    } catch (error) {
      console.error('Error completing match:', error);
      throw error;
    }
  }

  /**
   * Cancel a match
   */
  static async cancelMatch(matchId, agentId) {
    try {
      const match = await Match.findById(matchId);
      if (!match) {
        throw new Error('Match not found');
      }

      // Update match status
      const updatedMatch = await Match.update(matchId, { status: 'cancelled' });

      return updatedMatch;
    } catch (error) {
      console.error('Error cancelling match:', error);
      throw error;
    }
  }

  /**
   * Get matching statistics
   */
  static async getStats() {
    try {
      return await Match.getStats();
    } catch (error) {
      console.error('Error getting matching stats:', error);
      throw error;
    }
  }
}

export default MatchingService;
