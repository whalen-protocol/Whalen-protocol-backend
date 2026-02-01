import express from 'express';
import ComputeRequest from '../models/ComputeRequest.js';
import MatchingService from '../services/MatchingService.js';
import Agent from '../models/Agent.js';
import { authenticateAgent } from '../middleware/auth.js';
import { formatResponse, formatError } from '../utils/helpers.js';

const router = express.Router();

/**
 * Submit a compute request
 * POST /api/v1/requests
 */
router.post('/', authenticateAgent, async (req, res) => {
  try {
    const { gpu_count, gpu_type, duration_hours, max_price_per_hour, cpu_cores, memory_gb, description } = req.body;

    if (!gpu_count || !gpu_type || !duration_hours || !max_price_per_hour) {
      return res.status(400).json(
        formatError(
          'Missing required fields: gpu_count, gpu_type, duration_hours, max_price_per_hour',
          400
        )
      );
    }

    // Verify agent is a requester
    const agent = await Agent.findById(req.agentId);
    if (!['requester', 'both'].includes(agent.type)) {
      return res.status(403).json(formatError('Agent is not a requester', 403));
    }

    const request = await ComputeRequest.create(
      req.agentId,
      gpu_count,
      gpu_type,
      duration_hours,
      max_price_per_hour,
      cpu_cores || null,
      memory_gb || null,
      description || null
    );

    return res.status(201).json(
      formatResponse(request, 'Compute request submitted successfully', 201)
    );
  } catch (error) {
    console.error('Error submitting request:', error);
    return res.status(500).json(formatError('Failed to submit request', 500, error));
  }
});

/**
 * Get compute request by ID
 * GET /api/v1/requests/:requestId
 */
router.get('/:requestId', async (req, res) => {
  try {
    const request = await ComputeRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json(formatError('Request not found', 404));
    }

    return res.status(200).json(formatResponse(request));
  } catch (error) {
    console.error('Error fetching request:', error);
    return res.status(500).json(formatError('Failed to fetch request', 500, error));
  }
});

/**
 * Get my requests
 * GET /api/v1/requests/my-requests
 */
router.get('/my-requests', authenticateAgent, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const requests = await ComputeRequest.findByRequesterId(req.agentId, limit, offset);

    return res.status(200).json(
      formatResponse({
        requests,
        limit,
        offset,
      })
    );
  } catch (error) {
    console.error('Error fetching my requests:', error);
    return res.status(500).json(formatError('Failed to fetch requests', 500, error));
  }
});

/**
 * Get all requests
 * GET /api/v1/requests
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const status = req.query.status || null;

    let requests;
    if (status) {
      requests = await ComputeRequest.findByStatus(status, limit, offset);
    } else {
      requests = await ComputeRequest.getAll(limit, offset);
    }

    return res.status(200).json(
      formatResponse({
        requests,
        limit,
        offset,
        status: status || 'all',
      })
    );
  } catch (error) {
    console.error('Error fetching requests:', error);
    return res.status(500).json(formatError('Failed to fetch requests', 500, error));
  }
});

/**
 * Update request status
 * PATCH /api/v1/requests/:requestId
 */
router.patch('/:requestId', authenticateAgent, async (req, res) => {
  try {
    const request = await ComputeRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json(formatError('Request not found', 404));
    }

    if (request.requester_id !== req.agentId) {
      return res.status(403).json(formatError('Unauthorized', 403));
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json(formatError('Status is required', 400));
    }

    const updatedRequest = await ComputeRequest.update(req.params.requestId, { status });

    return res.status(200).json(
      formatResponse(updatedRequest, 'Request updated successfully')
    );
  } catch (error) {
    console.error('Error updating request:', error);
    return res.status(500).json(formatError('Failed to update request', 500, error));
  }
});

/**
 * Find matches for a request
 * POST /api/v1/requests/:requestId/find-matches
 */
router.post('/:requestId/find-matches', authenticateAgent, async (req, res) => {
  try {
    const request = await ComputeRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json(formatError('Request not found', 404));
    }

    if (request.requester_id !== req.agentId) {
      return res.status(403).json(formatError('Unauthorized', 403));
    }

    const matches = await MatchingService.findMatches(request, 10);

    return res.status(200).json(
      formatResponse({
        request_id: req.params.requestId,
        matches: matches.map(m => ({
          provider_id: m.provider_id,
          capability_id: m.id,
          gpu_count: m.gpu_count,
          price_per_hour: m.price_per_hour,
          reputation_score: m.reputation_score,
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
 * Auto-match a request
 * POST /api/v1/requests/:requestId/auto-match
 */
router.post('/:requestId/auto-match', authenticateAgent, async (req, res) => {
  try {
    const request = await ComputeRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json(formatError('Request not found', 404));
    }

    if (request.requester_id !== req.agentId) {
      return res.status(403).json(formatError('Unauthorized', 403));
    }

    const match = await MatchingService.autoMatch(req.params.requestId);

    if (!match) {
      return res.status(404).json(formatError('No matching providers found', 404));
    }

    return res.status(201).json(
      formatResponse(match, 'Request auto-matched successfully', 201)
    );
  } catch (error) {
    console.error('Error auto-matching request:', error);
    return res.status(500).json(formatError('Failed to auto-match request', 500, error));
  }
});

export default router;
