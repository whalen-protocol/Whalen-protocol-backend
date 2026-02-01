import express from 'express';
import { authenticate } from '../middleware/auth.js';
import VerificationService from '../services/VerificationService.js';

const router = express.Router();

/**
 * POST /api/v1/verifications/submit-proof
 * Submit work completion proof
 */
router.post('/submit-proof', authenticate, async (req, res) => {
  try {
    const { transactionId, proofData } = req.body;
    const providerId = req.user.id;

    if (!transactionId || !proofData) {
      return res.status(400).json({
        error: 'Missing required fields: transactionId, proofData',
      });
    }

    const verification = await VerificationService.submitProof(
      transactionId,
      providerId,
      proofData
    );

    res.status(201).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error('Error submitting proof:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/verifications/:verificationId/verify
 * Verify work completion
 */
router.post('/:verificationId/verify', authenticate, async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { approved, notes } = req.body;
    const verifierId = req.user.id;

    if (approved === undefined) {
      return res.status(400).json({
        error: 'Missing required field: approved',
      });
    }

    const verification = await VerificationService.verifyWork(
      verificationId,
      verifierId,
      approved,
      notes || ''
    );

    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error('Error verifying work:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/verifications/:verificationId
 * Get verification details
 */
router.get('/:verificationId', authenticate, async (req, res) => {
  try {
    const { verificationId } = req.params;

    const verification = await VerificationService.getVerification(verificationId);

    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    console.error('Error getting verification:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/verifications/transaction/:transactionId
 * Get verifications for a transaction
 */
router.get('/transaction/:transactionId', authenticate, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const verifications = await VerificationService.getTransactionVerifications(
      transactionId
    );

    res.status(200).json({
      success: true,
      data: {
        verifications,
        count: verifications.length,
      },
    });
  } catch (error) {
    console.error('Error getting verifications:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/verifications/pending
 * Get pending verifications for authenticated agent
 */
router.get('/pending', authenticate, async (req, res) => {
  try {
    const agentId = req.user.id;

    const verifications = await VerificationService.getPendingVerifications(agentId);

    res.status(200).json({
      success: true,
      data: {
        verifications,
        count: verifications.length,
      },
    });
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/verifications/stats
 * Get verification statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await VerificationService.getVerificationStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/verifications/dispute
 * Create a dispute for a transaction
 */
router.post('/dispute', authenticate, async (req, res) => {
  try {
    const { transactionId, reason } = req.body;
    const initiatorId = req.user.id;

    if (!transactionId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: transactionId, reason',
      });
    }

    const dispute = await VerificationService.createDispute(
      transactionId,
      initiatorId,
      reason
    );

    res.status(201).json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/verifications/:verificationId/resolve-dispute
 * Resolve a dispute
 */
router.post('/:verificationId/resolve-dispute', authenticate, async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { resolution, notes } = req.body;

    if (!resolution || !['approved', 'rejected'].includes(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution. Must be "approved" or "rejected"',
      });
    }

    const dispute = await VerificationService.resolveDispute(
      verificationId,
      resolution,
      notes || ''
    );

    res.status(200).json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

export default router;
