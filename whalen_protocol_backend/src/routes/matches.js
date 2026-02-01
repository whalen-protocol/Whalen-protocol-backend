import express from 'express';
import Match from '../models/Match.js';
import MatchingService from '../services/MatchingService.js';
import { authenticateAgent } from '../middleware/auth.js';
import { formatResponse, formatError } from '../utils/helpers.js';

const router = express.Router();

/**
 * Get match by ID
 * GET /api/v1/matches/:matchId
 */
router.get('/:matchId', async (req, res) => {
  try {
    const match = await Match.findById(req.params.matchId);

    if (!match) {
      return res.status(404).json(formatError('Match not found', 404));
    }

    return res.status(200).json(formatResponse(match));
  } catch (error) {
    console.error('Error fetching match:', error);
    return res.status(500).json(formatError('Failed to fetch match', 500, error));
  }
});

/**
 * Get matches for a request
 * GET /api/v1/matches/request/:requestId
 */
router.get('/request/:requestId', async (req, res) => {
  try {
    const matches = await Match.findByRequestId(req.params.requestId);

    return res.status(200).json(
      formatResponse({
        request_id: req.params.requestId,
        matches,
        count: matches.length,
      })
    );
  } catch (error) {
    console.error('Error fetching matches:', error);
    return res.status(500).json(formatError('Failed to fetch matches', 500, error));
  }
});

/**
 * Get my matches (as provider)
 * GET /api/v1/matches/my-matches
 */
router.get('/my-matches', authenticateAgent, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const matches = await Match.findByProviderId(req.agentId, limit, offset);

    return res.status(200).json(
      formatResponse({
        matches,
        limit,
        offset,
      })
    );
  } catch (error) {
    console.error('Error fetching my matches:', error);
    return res.status(500).json(formatError('Failed to fetch matches', 500, error));
  }
});

/**
 * Accept a match
 * POST /api/v1/matches/:matchId/accept
 */
router.post('/:matchId/accept', authenticateAgent, async (req, res) => {
  try {
    const match = await MatchingService.acceptMatch(req.params.matchId, req.agentId);

    return res.status(200).json(
      formatResponse(match, 'Match accepted successfully')
    );
  } catch (error) {
    console.error('Error accepting match:', error);
    const statusCode = error.message.includes('Unauthorized') ? 403 : 500;
    return res.status(statusCode).json(formatError(error.message, statusCode, error));
  }
});

/**
 * Complete a match
 * POST /api/v1/matches/:matchId/complete
 */
router.post('/:matchId/complete', authenticateAgent, async (req, res) => {
  try {
    const match = await MatchingService.completeMatch(req.params.matchId, req.agentId);

    return res.status(200).json(
      formatResponse(match, 'Match completed successfully')
    );
  } catch (error) {
    console.error('Error completing match:', error);
    const statusCode = error.message.includes('Unauthorized') ? 403 : 500;
    return res.status(statusCode).json(formatError(error.message, statusCode, error));
  }
});

/**
 * Cancel a match
 * POST /api/v1/matches/:matchId/cancel
 */
router.post('/:matchId/cancel', authenticateAgent, async (req, res) => {
  try {
    const match = await MatchingService.cancelMatch(req.params.matchId, req.agentId);

    return res.status(200).json(
      formatResponse(match, 'Match cancelled successfully')
    );
  } catch (error) {
    console.error('Error cancelling match:', error);
    return res.status(500).json(formatError('Failed to cancel match', 500, error));
  }
});

/**
 * Get all matches
 * GET /api/v1/matches
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;

    let matches;
    if (status) {
      matches = await Match.findByStatus(status, limit, offset);
    } else {
      matches = await Match.findByStatus('proposed', limit, offset);
    }

    return res.status(200).json(
      formatResponse({
        matches,
        limit,
        offset,
        status: status || 'proposed',
      })
    );
  } catch (error) {
    console.error('Error fetching matches:', error);
    return res.status(500).json(formatError('Failed to fetch matches', 500, error));
  }
});

export default router;
