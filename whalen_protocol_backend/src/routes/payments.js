import express from 'express';
import { authenticate } from '../middleware/auth.js';
import PaymentService from '../services/PaymentService.js';
import VerificationService from '../services/VerificationService.js';
import Stripe from 'stripe';
import crypto from 'crypto';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * POST /api/v1/payments/create-intent
 * Create a payment intent for a match
 */
router.post('/create-intent', authenticate, async (req, res) => {
  try {
    const { matchId, amount } = req.body;
    const agentId = req.user.id;

    if (!matchId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: matchId, amount',
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        error: 'Amount must be greater than 0',
      });
    }

    // Get match details to verify requester
    const matchResult = await req.app.locals.pool.query(
      `SELECT m.*, cr.requester_id, cr.duration_hours, pc.price_per_hour
       FROM matches m
       JOIN compute_requests cr ON m.request_id = cr.id
       JOIN provider_capabilities pc ON m.capability_id = pc.id
       WHERE m.id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }

    const match = matchResult.rows[0];

    // Verify requester is the one creating payment
    if (match.requester_id !== agentId) {
      return res.status(403).json({
        error: 'Only the requester can create payment for this match',
      });
    }

    // Create payment intent
    const paymentData = await PaymentService.createPaymentIntent(
      matchId,
      amount,
      match.requester_id,
      match.provider_id
    );

    res.status(201).json({
      success: true,
      data: paymentData,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/v1/payments/confirm
 * Confirm a payment and move to escrow
 */
router.post('/confirm', authenticate, async (req, res) => {
  try {
    const { paymentIntentId, transactionId } = req.body;

    if (!paymentIntentId || !transactionId) {
      return res.status(400).json({
        error: 'Missing required fields: paymentIntentId, transactionId',
      });
    }

    const transaction = await PaymentService.confirmPayment(
      paymentIntentId,
      transactionId
    );

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/payments/transaction/:transactionId
 * Get transaction details
 */
router.get('/transaction/:transactionId', authenticate, async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await PaymentService.getTransaction(transactionId);

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error('Error getting transaction:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/payments/my-transactions
 * Get all transactions for authenticated agent
 */
router.get('/my-transactions', authenticate, async (req, res) => {
  try {
    const agentId = req.user.id;
    const transactions = await PaymentService.getAgentTransactions(agentId);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        count: transactions.length,
      },
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/v1/payments/stats
 * Get transaction statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await PaymentService.getTransactionStats();

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
 * POST /api/v1/payments/webhook
 * Stripe webhook handler
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    await PaymentService.handleStripeWebhook(event);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
