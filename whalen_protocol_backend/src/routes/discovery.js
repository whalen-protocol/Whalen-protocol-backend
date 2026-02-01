import express from 'express';
import ProviderCapability from '../models/ProviderCapability.js';
import MatchingService from '../services/MatchingService.js';
import ComputeRequest from '../models/ComputeRequest.js';
import { formatResponse, formatError } from '../utils/helpers.js';

const router = express.Router();

/**
 * Search for providers
 * GET /api/v1/discovery/search
 */
router.get('/search', async (req, res) => {
  try {
    const { gpu_count, gpu_type, max_price, region } = req.query;

    if (!gpu_count || !gpu_type || !max_price) {
      return res.status(400).json(
        formatError('Missing required query parameters: gpu_count, gpu_type, max_price', 400)
      );
    }

    const providers = await ProviderCapability.search(
      parseInt(gpu_count),
      gpu_type,
      parseFloat(max_price),
      region || null
    );

    return res.status(200).json(
      formatResponse({
        query: {
          gpu_count: parseInt(gpu_count),
          gpu_type,
          max_price: parseFloat(max_price),
          region: region || 'any',
        },
        results: providers,
        count: providers.length,
      })
    );
  } catch (error) {
    console.error('Error searching providers:', error);
    return res.status(500).json(formatError('Failed to search providers', 500, error));
  }
});

/**
 * Get provider details
 * GET /api/v1/discovery/providers/:providerId
 */
router.get('/providers/:providerId', async (req, res) => {
  try {
    const capabilities = await ProviderCapability.findByProviderId(req.params.providerId);

    if (capabilities.length === 0) {
      return res.status(404).json(formatError('Provider not found', 404));
    }

    return res.status(200).json(
      formatResponse({
        provider_id: req.params.providerId,
        capabilities,
      })
    );
  } catch (error) {
    console.error('Error fetching provider details:', error);
    return res.status(500).json(formatError('Failed to fetch provider details', 500, error));
  }
});

/**
 * Find matches for a request
 * POST /api/v1/discovery/find-matches
 */
router.post('/find-matches', async (req, res) => {
  try {
    const { gpu_count, gpu_type, duration_hours, max_price_per_hour, region } = req.body;

    if (!gpu_count || !gpu_type || !duration_hours || !max_price_per_hour) {
      return res.status(400).json(
        formatError(
          'Missing required fields: gpu_count, gpu_type, duration_hours, max_price_per_hour',
          400
        )
      );
    }

    const request = {
      gpu_count: parseInt(gpu_count),
      gpu_type,
      duration_hours: parseInt(duration_hours),
      max_price_per_hour: parseFloat(max_price_per_hour),
      region: region || null,
    };

    const matches = await MatchingService.findMatches(request, 10);

    return res.status(200).json(
      formatResponse({
        request,
        matches: matches.map(m => ({
          provider_id: m.provider_id,
          capability_id: m.id,
          gpu_count: m.gpu_count,
          gpu_type: m.gpu_type,
          cpu_cores: m.cpu_cores,
          memory_gb: m.memory_gb,
          price_per_hour: m.price_per_hour,
          reputation_score: m.reputation_score,
          uptime_percentage: m.uptime_percentage,
          match_score: m.match_score,
        })),
        count: matches.length,
      })
    );
  } catch (error) {
    console.error('Error finding matches:', error);
    return res.status(500).json(formatError('Failed to find matches', 500, error));
  }
});

/**
 * Get marketplace stats
 * GET /api/v1/discovery/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const requestStats = await ComputeRequest.getStats();
    const matchStats = await MatchingService.getStats();

    return res.status(200).json(
      formatResponse({
        requests: requestStats,
        matches: matchStats,
      })
    );
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json(formatError('Failed to fetch stats', 500, error));
  }
});

export default router;
