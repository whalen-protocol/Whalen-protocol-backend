import pool from '../config/database.js';
import { generateId } from '../utils/helpers.js';

export class Transaction {
  static async create(matchId, requesterId, providerId, amount, currency = 'USD', paymentMethod = 'stripe') {
    const id = generateId();
    
    const result = await pool.query(
      `INSERT INTO transactions 
       (id, match_id, requester_id, provider_id, amount, currency, payment_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, matchId, requesterId, providerId, amount, currency, paymentMethod]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT t.*, 
              a_provider.name as provider_name,
              a_requester.name as requester_name
       FROM transactions t
       JOIN agents a_provider ON t.provider_id = a_provider.id
       JOIN agents a_requester ON t.requester_id = a_requester.id
       WHERE t.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByMatchId(matchId) {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE match_id = $1',
      [matchId]
    );
    
    return result.rows;
  }

  static async findByProviderId(providerId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE provider_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [providerId, limit, offset]
    );
    
    return result.rows;
  }

  static async findByRequesterId(requesterId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE requester_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [requesterId, limit, offset]
    );
    
    return result.rows;
  }

  static async findByStatus(status, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT t.*, 
              a_provider.name as provider_name,
              a_requester.name as requester_name
       FROM transactions t
       JOIN agents a_provider ON t.provider_id = a_provider.id
       JOIN agents a_requester ON t.requester_id = a_requester.id
       WHERE t.status = $1 
       ORDER BY t.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    
    return result.rows;
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return this.findById(id);
    
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE transactions SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async getStats() {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'settled' THEN 1 END) as settled,
        COUNT(CASE WHEN status = 'escrowed' THEN 1 END) as escrowed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END) as total_settled,
        AVG(amount) as avg_transaction_amount
       FROM transactions`
    );
    
    return result.rows[0];
  }
}

export default Transaction;
