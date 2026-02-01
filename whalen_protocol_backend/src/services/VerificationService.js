import crypto from 'crypto';
import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class VerificationService {
  /**
   * Generate a proof hash for work completion
   * @param {Object} proofData - Work completion data
   * @returns {string} Proof hash
   */
  static generateProofHash(proofData) {
    const dataString = JSON.stringify(proofData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Verify a proof hash
   * @param {string} proofHash - Original proof hash
   * @param {Object} proofData - Proof data to verify
   * @returns {boolean} Whether proof is valid
   */
  static verifyProofHash(proofHash, proofData) {
    const calculatedHash = this.generateProofHash(proofData);
    return proofHash === calculatedHash;
  }

  /**
   * Submit work completion proof
   * @param {string} transactionId - Transaction ID
   * @param {string} providerId - Provider agent ID
   * @param {Object} proofData - Work completion data
   * @returns {Object} Verification record
   */
  static async submitProof(transactionId, providerId, proofData) {
    try {
      const verificationId = uuidv4();
      const proofHash = this.generateProofHash(proofData);

      // Verify transaction exists and belongs to provider
      const transaction = await pool.query(
        'SELECT * FROM transactions WHERE id = $1 AND provider_id = $2',
        [transactionId, providerId]
      );

      if (transaction.rows.length === 0) {
        throw new Error('Transaction not found or unauthorized');
      }

      // Create verification record
      const result = await pool.query(
        `INSERT INTO verifications 
         (id, transaction_id, verifier_id, proof_hash, proof_data, verified, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [verificationId, transactionId, providerId, proofHash, JSON.stringify(proofData), false]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error submitting proof:', error);
      throw new Error(`Proof submission failed: ${error.message}`);
    }
  }

  /**
   * Verify work completion (by requester or third party)
   * @param {string} verificationId - Verification ID
   * @param {string} verifierId - Verifier agent ID
   * @param {boolean} approved - Whether work is approved
   * @param {string} notes - Verification notes
   * @returns {Object} Updated verification
   */
  static async verifyWork(verificationId, verifierId, approved, notes = '') {
    try {
      // Get verification record
      const verification = await pool.query(
        'SELECT * FROM verifications WHERE id = $1',
        [verificationId]
      );

      if (verification.rows.length === 0) {
        throw new Error('Verification not found');
      }

      const verif = verification.rows[0];

      // Update verification
      const result = await pool.query(
        `UPDATE verifications 
         SET verified = $1, verifier_id = $2, notes = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [approved, verifierId, notes, verificationId]
      );

      // If approved, update transaction status and release payment
      if (approved) {
        await pool.query(
          `UPDATE transactions 
           SET status = $1, updated_at = NOW()
           WHERE id = $2`,
          ['verified', verif.transaction_id]
        );

        // Update match status
        const transaction = await pool.query(
          'SELECT match_id FROM transactions WHERE id = $1',
          [verif.transaction_id]
        );

        if (transaction.rows.length > 0) {
          await pool.query(
            `UPDATE matches 
             SET status = $1, updated_at = NOW()
             WHERE id = $2`,
            ['completed', transaction.rows[0].match_id]
          );
        }
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error verifying work:', error);
      throw new Error(`Work verification failed: ${error.message}`);
    }
  }

  /**
   * Get verification record
   * @param {string} verificationId - Verification ID
   * @returns {Object} Verification details
   */
  static async getVerification(verificationId) {
    try {
      const result = await pool.query(
        `SELECT v.*, 
                t.amount, t.status as transaction_status,
                a1.name as provider_name,
                a2.name as verifier_name
         FROM verifications v
         JOIN transactions t ON v.transaction_id = t.id
         JOIN agents a1 ON t.provider_id = a1.id
         LEFT JOIN agents a2 ON v.verifier_id = a2.id
         WHERE v.id = $1`,
        [verificationId]
      );

      if (result.rows.length === 0) {
        throw new Error('Verification not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting verification:', error);
      throw new Error(`Failed to retrieve verification: ${error.message}`);
    }
  }

  /**
   * Get verifications for a transaction
   * @param {string} transactionId - Transaction ID
   * @returns {Array} Verifications
   */
  static async getTransactionVerifications(transactionId) {
    try {
      const result = await pool.query(
        `SELECT v.*, 
                a1.name as provider_name,
                a2.name as verifier_name
         FROM verifications v
         JOIN transactions t ON v.transaction_id = t.id
         JOIN agents a1 ON t.provider_id = a1.id
         LEFT JOIN agents a2 ON v.verifier_id = a2.id
         WHERE v.transaction_id = $1
         ORDER BY v.created_at DESC`,
        [transactionId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting verifications:', error);
      throw new Error(`Failed to retrieve verifications: ${error.message}`);
    }
  }

  /**
   * Get pending verifications for an agent
   * @param {string} agentId - Agent ID
   * @returns {Array} Pending verifications
   */
  static async getPendingVerifications(agentId) {
    try {
      const result = await pool.query(
        `SELECT v.*, 
                t.amount, t.status as transaction_status,
                a1.name as provider_name,
                cr.gpu_count, cr.gpu_type, cr.duration_hours
         FROM verifications v
         JOIN transactions t ON v.transaction_id = t.id
         JOIN compute_requests cr ON t.match_id = (SELECT request_id FROM matches WHERE id = (SELECT match_id FROM transactions WHERE id = v.transaction_id))
         JOIN agents a1 ON t.provider_id = a1.id
         WHERE v.verified = false AND t.requester_id = $1
         ORDER BY v.created_at ASC`,
        [agentId]
      );

      return result.rows;
    } catch (error) {
      console.error('Error getting pending verifications:', error);
      throw new Error(`Failed to retrieve pending verifications: ${error.message}`);
    }
  }

  /**
   * Get verification statistics
   * @returns {Object} Verification stats
   */
  static async getVerificationStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total_verifications,
          COUNT(CASE WHEN verified = true THEN 1 END) as approved_verifications,
          COUNT(CASE WHEN verified = false THEN 1 END) as pending_verifications,
          COUNT(DISTINCT transaction_id) as unique_transactions
        FROM verifications
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting verification stats:', error);
      throw new Error(`Failed to retrieve stats: ${error.message}`);
    }
  }

  /**
   * Create a dispute for a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} initiatorId - Agent initiating dispute
   * @param {string} reason - Dispute reason
   * @returns {Object} Dispute record
   */
  static async createDispute(transactionId, initiatorId, reason) {
    try {
      const disputeId = uuidv4();

      // Verify transaction exists
      const transaction = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transactionId]
      );

      if (transaction.rows.length === 0) {
        throw new Error('Transaction not found');
      }

      // Create dispute record (could be stored in a disputes table)
      // For now, we'll store it as a verification with special flag
      const result = await pool.query(
        `INSERT INTO verifications 
         (id, transaction_id, verifier_id, proof_data, verified, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING *`,
        [
          disputeId,
          transactionId,
          initiatorId,
          JSON.stringify({ type: 'dispute', reason }),
          false,
          `Dispute initiated by ${initiatorId}: ${reason}`,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error creating dispute:', error);
      throw new Error(`Dispute creation failed: ${error.message}`);
    }
  }

  /**
   * Resolve a dispute
   * @param {string} verificationId - Dispute verification ID
   * @param {string} resolution - 'approved' or 'rejected'
   * @param {string} notes - Resolution notes
   * @returns {Object} Updated dispute
   */
  static async resolveDispute(verificationId, resolution, notes) {
    try {
      const result = await pool.query(
        `UPDATE verifications 
         SET verified = $1, notes = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [resolution === 'approved', notes, verificationId]
      );

      if (result.rows.length === 0) {
        throw new Error('Dispute not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error resolving dispute:', error);
      throw new Error(`Dispute resolution failed: ${error.message}`);
    }
  }
}

export default VerificationService;
