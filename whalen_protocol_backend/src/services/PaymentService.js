import Stripe from 'stripe';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export class PaymentService {
  /**
   * Create a payment intent for a match
   * @param {string} matchId - Match ID
   * @param {number} amount - Amount in cents
   * @param {string} requesterId - Requester agent ID
   * @param {string} providerId - Provider agent ID
   * @returns {Object} Payment intent
   */
  static async createPaymentIntent(matchId, amount, requesterId, providerId) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          matchId,
          requesterId,
          providerId,
        },
        description: `Whalen Protocol - Compute Match ${matchId}`,
      });

      // Store transaction record in database
      const transactionId = uuidv4();
      await pool.query(
        `INSERT INTO transactions 
         (id, match_id, requester_id, provider_id, amount, currency, status, payment_method, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [transactionId, matchId, requesterId, providerId, amount, 'USD', 'pending', 'stripe']
      );

      return {
        transactionId,
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount,
        status: 'pending',
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new Error(`Payment intent creation failed: ${error.message}`);
    }
  }

  /**
   * Confirm payment and move to escrow
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Updated transaction
   */
  static async confirmPayment(paymentIntentId, transactionId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not succeeded. Status: ${paymentIntent.status}`);
      }

      // Update transaction to escrowed
      const result = await pool.query(
        `UPDATE transactions 
         SET status = $1, transaction_hash = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        ['escrowed', paymentIntent.id, transactionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error confirming payment:', error);
      throw new Error(`Payment confirmation failed: ${error.message}`);
    }
  }

  /**
   * Release payment to provider after verification
   * @param {string} transactionId - Transaction ID
   * @param {boolean} verified - Whether work was verified
   * @returns {Object} Updated transaction
   */
  static async releasePayment(transactionId, verified) {
    try {
      if (!verified) {
        // Refund to requester
        const transaction = await pool.query(
          'SELECT transaction_hash FROM transactions WHERE id = $1',
          [transactionId]
        );

        if (transaction.rows.length === 0) {
          throw new Error('Transaction not found');
        }

        const paymentIntentId = transaction.rows[0].transaction_hash;
        await stripe.refunds.create({
          payment_intent: paymentIntentId,
        });

        const result = await pool.query(
          `UPDATE transactions 
           SET status = $1, updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
          ['refunded', transactionId]
        );

        return result.rows[0];
      }

      // Mark as settled
      const result = await pool.query(
        `UPDATE transactions 
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        ['settled', transactionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error releasing payment:', error);
      throw new Error(`Payment release failed: ${error.message}`);
    }
  }

  /**
   * Get transaction details
   * @param {string} transactionId - Transaction ID
   * @returns {Object} Transaction details
   */
  static async getTransaction(transactionId) {
    try {
      const result = await pool.query(
        `SELECT t.*, 
                m.agreed_price_per_hour,
                cr.duration_hours,
                a1.name as requester_name,
                a2.name as provider_name
         FROM transactions t
         JOIN matches m ON t.match_id = m.id
         JOIN compute_requests cr ON m.request_id = cr.id
         JOIN agents a1 ON t.requester_id = a1.id
         JOIN agents a2 ON t.provider_id = a2.id
         WHERE t.id = $1`,
        [transactionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting transaction:', error);
      throw new Error(`Failed to retrieve transaction: ${error.message}`);
    }
  }

  /**
   * Get all transactions for an agent
   * @param {string} agentId - Agent ID
   * @param {string} role - 'requester' or 'provider'
   * @returns {Array} Transactions
   */
  static async getAgentTransactions(agentId, role = null) {
    try {
      let query = `
        SELECT t.*, 
               m.agreed_price_per_hour,
               cr.duration_hours,
               a1.name as requester_name,
               a2.name as provider_name
        FROM transactions t
        JOIN matches m ON t.match_id = m.id
        JOIN compute_requests cr ON m.request_id = cr.id
        JOIN agents a1 ON t.requester_id = a1.id
        JOIN agents a2 ON t.provider_id = a2.id
      `;

      const params = [];

      if (role === 'requester') {
        query += ' WHERE t.requester_id = $1';
        params.push(agentId);
      } else if (role === 'provider') {
        query += ' WHERE t.provider_id = $1';
        params.push(agentId);
      } else {
        query += ' WHERE t.requester_id = $1 OR t.provider_id = $1';
        params.push(agentId);
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting agent transactions:', error);
      throw new Error(`Failed to retrieve transactions: ${error.message}`);
    }
  }

  /**
   * Webhook handler for Stripe events
   * @param {Object} event - Stripe event
   * @returns {Object} Result
   */
  static async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          console.log('Payment succeeded:', event.data.object.id);
          break;

        case 'payment_intent.payment_failed':
          console.log('Payment failed:', event.data.object.id);
          break;

        case 'charge.refunded':
          console.log('Charge refunded:', event.data.object.id);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.error('Error handling webhook:', error);
      throw new Error(`Webhook handling failed: ${error.message}`);
    }
  }

  /**
   * Calculate total transaction volume
   * @returns {Object} Volume stats
   */
  static async getTransactionStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_transactions,
          SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as total_settled,
          AVG(CASE WHEN status = 'settled' THEN amount ELSE NULL END) as avg_transaction,
          COUNT(CASE WHEN status = 'settled' THEN 1 END) as completed_transactions,
          COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_transactions
        FROM transactions
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting transaction stats:', error);
      throw new Error(`Failed to retrieve stats: ${error.message}`);
    }
  }
}

export default PaymentService;
