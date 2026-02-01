import express from 'express';
import jwt from 'jsonwebtoken';
import Agent from '../models/Agent.js';
import { authenticateAgent, authenticateApiKey } from '../middleware/auth.js';
import { formatResponse, formatError } from '../utils/helpers.js';

const router = express.Router();

/**
 * Register a new agent
 * POST /api/v1/agents/register
 */
router.post('/register', async (req, res) => {
  try {
    const { name, type, walletAddress } = req.body;

    if (!name || !type) {
      return res.status(400).json(formatError('Name and type are required', 400));
    }

    if (!['requester', 'provider', 'both'].includes(type)) {
      return res.status(400).json(formatError('Invalid agent type', 400));
    }

    const agent = await Agent.create(name, type, walletAddress);

    // Generate JWT token
    const token = jwt.sign(
      { agentId: agent.id, name: agent.name },
      process.env.JWT_SECRET || 'your_jwt_secret_key_here',
      { expiresIn: '30d' }
    );

    return res.status(201).json(
      formatResponse(
        {
          agent: {
            id: agent.id,
            name: agent.name,
            type: agent.type,
            api_key: agent.api_key,
            reputation_score: agent.reputation_score,
          },
          token,
        },
        'Agent registered successfully',
        201
      )
    );
  } catch (error) {
    console.error('Error registering agent:', error);
    return res.status(500).json(formatError('Failed to register agent', 500, error));
  }
});

/**
 * Get agent profile
 * GET /api/v1/agents/profile
 */
router.get('/profile', authenticateAgent, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agentId);

    if (!agent) {
      return res.status(404).json(formatError('Agent not found', 404));
    }

    const stats = await Agent.getStats(req.agentId);

    return res.status(200).json(
      formatResponse({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        wallet_address: agent.wallet_address,
        reputation_score: agent.reputation_score,
        total_transactions: agent.total_transactions,
        total_earnings: agent.total_earnings,
        total_spent: agent.total_spent,
        uptime_percentage: agent.uptime_percentage,
        stats,
      })
    );
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json(formatError('Failed to fetch profile', 500, error));
  }
});

/**
 * Get agent by ID
 * GET /api/v1/agents/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      return res.status(404).json(formatError('Agent not found', 404));
    }

    return res.status(200).json(
      formatResponse({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        reputation_score: agent.reputation_score,
        total_transactions: agent.total_transactions,
        uptime_percentage: agent.uptime_percentage,
      })
    );
  } catch (error) {
    console.error('Error fetching agent:', error);
    return res.status(500).json(formatError('Failed to fetch agent', 500, error));
  }
});

/**
 * Get all agents
 * GET /api/v1/agents
 */
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const agents = await Agent.getAll(limit, offset);

    return res.status(200).json(
      formatResponse({
        agents: agents.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          reputation_score: a.reputation_score,
          total_transactions: a.total_transactions,
        })),
        limit,
        offset,
      })
    );
  } catch (error) {
    console.error('Error fetching agents:', error);
    return res.status(500).json(formatError('Failed to fetch agents', 500, error));
  }
});

/**
 * Update agent profile
 * PATCH /api/v1/agents/profile
 */
router.patch('/profile', authenticateAgent, async (req, res) => {
  try {
    const { name, wallet_address } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (wallet_address) updates.wallet_address = wallet_address;

    const agent = await Agent.update(req.agentId, updates);

    return res.status(200).json(
      formatResponse(
        {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          wallet_address: agent.wallet_address,
        },
        'Profile updated successfully'
      )
    );
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json(formatError('Failed to update profile', 500, error));
  }
});

/**
 * Get agent stats
 * GET /api/v1/agents/:id/stats
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const stats = await Agent.getStats(req.params.id);

    return res.status(200).json(formatResponse(stats));
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    return res.status(500).json(formatError('Failed to fetch agent stats', 500, error));
  }
});

export default router;
