import express from 'express';
import ProviderCapability from '../models/ProviderCapability.js';
import Agent from '../models/Agent.js';
import { authenticateAgent } from '../middleware/auth.js';
import { formatResponse, formatError } from '../utils/helpers.js';

const router = express.Router();

/**
 * Register provider capability
 * POST /api/v1/providers/capabilities
 */
router.post('/capabilities', authenticateAgent, async (req, res) => {
  try {
    const { gpu_count, gpu_type, cpu_cores, memory_gb, price_per_hour, region } = req.body;

    if (!gpu_count || !gpu_type || !cpu_cores || !memory_gb || !price_per_hour) {
      return res.status(400).json(
        formatError('Missing required fields: gpu_count, gpu_type, cpu_cores, memory_gb, price_per_hour', 400)
      );
    }

    // Verify agent is a provider
    const agent = await Agent.findById(req.agentId);
    if (!['provider', 'both'].includes(agent.type)) {
      return res.status(403).json(formatError('Agent is not a provider', 403));
    }

    const capability = await ProviderCapability.create(
      req.agentId,
      gpu_count,
      gpu_type,
      cpu_cores,
      memory_gb,
      price_per_hour,
      region || 'us-east-1'
    );

    return res.status(201).json(
      formatResponse(capability, 'Provider capability registered successfully', 201)
    );
  } catch (error) {
    console.error('Error registering capability:', error);
    return res.status(500).json(formatError('Failed to register capability', 500, error));
  }
});

/**
 * Get provider capabilities
 * GET /api/v1/providers/capabilities/:providerId
 */
router.get('/capabilities/:providerId', async (req, res) => {
  try {
    const capabilities = await ProviderCapability.findByProviderId(req.params.providerId);

    return res.status(200).json(
      formatResponse({
        provider_id: req.params.providerId,
        capabilities,
      })
    );
  } catch (error) {
    console.error('Error fetching capabilities:', error);
    return res.status(500).json(formatError('Failed to fetch capabilities', 500, error));
  }
});

/**
 * Update provider capability
 * PATCH /api/v1/providers/capabilities/:capabilityId
 */
router.patch('/capabilities/:capabilityId', authenticateAgent, async (req, res) => {
  try {
    const capability = await ProviderCapability.findById(req.params.capabilityId);

    if (!capability) {
      return res.status(404).json(formatError('Capability not found', 404));
    }

    if (capability.provider_id !== req.agentId) {
      return res.status(403).json(formatError('Unauthorized', 403));
    }

    const { price_per_hour, available_hours, availability_status } = req.body;
    const updates = {};

    if (price_per_hour) updates.price_per_hour = price_per_hour;
    if (available_hours !== undefined) updates.available_hours = available_hours;
    if (availability_status) updates.availability_status = availability_status;

    const updatedCapability = await ProviderCapability.update(req.params.capabilityId, updates);

    return res.status(200).json(
      formatResponse(updatedCapability, 'Capability updated successfully')
    );
  } catch (error) {
    console.error('Error updating capability:', error);
    return res.status(500).json(formatError('Failed to update capability', 500, error));
  }
});

/**
 * Delete provider capability
 * DELETE /api/v1/providers/capabilities/:capabilityId
 */
router.delete('/capabilities/:capabilityId', authenticateAgent, async (req, res) => {
  try {
    const capability = await ProviderCapability.findById(req.params.capabilityId);

    if (!capability) {
      return res.status(404).json(formatError('Capability not found', 404));
    }

    if (capability.provider_id !== req.agentId) {
      return res.status(403).json(formatError('Unauthorized', 403));
    }

    await ProviderCapability.delete(req.params.capabilityId);

    return res.status(200).json(formatResponse(null, 'Capability deleted successfully'));
  } catch (error) {
    console.error('Error deleting capability:', error);
    return res.status(500).json(formatError('Failed to delete capability', 500, error));
  }
});

/**
 * Get my capabilities
 * GET /api/v1/providers/my-capabilities
 */
router.get('/my-capabilities', authenticateAgent, async (req, res) => {
  try {
    const capabilities = await ProviderCapability.findByProviderId(req.agentId);

    return res.status(200).json(
      formatResponse({
        capabilities,
      })
    );
  } catch (error) {
    console.error('Error fetching my capabilities:', error);
    return res.status(500).json(formatError('Failed to fetch capabilities', 500, error));
  }
});

export default router;
