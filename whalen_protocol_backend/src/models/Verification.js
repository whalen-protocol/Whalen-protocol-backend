import pool from '../config/database.js';
import { generateId } from '../utils/helpers.js';

export class Verification {
  static async create(transactionId, verifierId, proofHash, proofData = null) {
    const id = generateId();
    
    const result = await pool.query(
      `INSERT INTO verifications 
       (id, transaction_id, verifier_id, proof_hash, proof_data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, transactionId, verifierId, proofHash, proofData ? JSON.stringify(proofData) : null]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT v.*, 
              a.name as verifier_name,
              t.provider_id, t.requester_id
       FROM verifications v
       LEFT JOIN agents a ON v.verifier_id = a.id
       JOIN transactions t ON v.transaction_id = t.id
       WHERE v.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByTransactionId(transactionId) {
    const result = await pool.query(
      `SELECT v.*, a.name as verifier_name
       FROM verifications v
       LEFT JOIN agents a ON v.verifier_id = a.id
       WHERE v.transaction_id = $1
       ORDER BY v.created_at DESC`,
      [transactionId]
    );
    
    return result.rows;
  }

  static async findByVerifierId(verifierId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT v.*, t.provider_id, t.requester_id, t.amount
       FROM verifications v
       JOIN transactions t ON v.transaction_id = t.id
       WHERE v.verifier_id = $1
       ORDER BY v.created_at DESC
       LIMIT $2 OFFSET $3`,
      [verifierId, limit, offset]
    );
    
    return result.rows;
  }

  static async findPending(limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT v.*, t.provider_id, t.requester_id, t.amount,
              a_provider.name as provider_name,
              a_requester.name as requester_name
       FROM verifications v
       JOIN transactions t ON v.transaction_id = t.id
       JOIN agents a_provider ON t.provider_id = a_provider.id
       JOIN agents a_requester ON t.requester_id = a_requester.id
       WHERE v.verified = FALSE
       ORDER BY v.created_at ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return this.findById(id);
    
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE verifications SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async getStats() {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_verifications,
        COUNT(CASE WHEN verified = TRUE THEN 1 END) as verified,
        COUNT(CASE WHEN verified = FALSE THEN 1 END) as pending,
        AVG(CASE WHEN verified = TRUE THEN EXTRACT(EPOCH FROM (updated_at - created_at)) ELSE NULL END) as avg_verification_time_seconds
       FROM verifications`
    );
    
    return result.rows[0];
  }
}

export default Verification;
