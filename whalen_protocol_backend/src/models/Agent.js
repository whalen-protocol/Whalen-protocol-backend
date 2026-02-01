import pool from '../config/database.js';
import { generateId, generateApiKey } from '../utils/helpers.js';

export class Agent {
  static async create(name, type, walletAddress = null) {
    const id = generateId();
    const apiKey = generateApiKey();
    
    const result = await pool.query(
      `INSERT INTO agents (id, name, type, wallet_address, api_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, type, walletAddress, apiKey]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM agents WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByApiKey(apiKey) {
    const result = await pool.query(
      'SELECT * FROM agents WHERE api_key = $1',
      [apiKey]
    );
    
    return result.rows[0] || null;
  }

  static async findByType(type) {
    const result = await pool.query(
      'SELECT * FROM agents WHERE type = $1 OR type = $2',
      [type, 'both']
    );
    
    return result.rows;
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return this.findById(id);
    
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE agents SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async getAll(limit = 100, offset = 0) {
    const result = await pool.query(
      'SELECT * FROM agents ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    
    return result.rows;
  }

  static async getStats(id) {
    const result = await pool.query(
      `SELECT 
        COUNT(DISTINCT t.id) as total_transactions,
        SUM(CASE WHEN t.status = 'settled' THEN t.amount ELSE 0 END) as total_settled,
        AVG(CASE WHEN a.id = $1 THEN a.reputation_score ELSE NULL END) as avg_reputation
       FROM transactions t
       JOIN agents a ON (t.provider_id = a.id OR t.requester_id = a.id)
       WHERE t.provider_id = $1 OR t.requester_id = $1`,
      [id]
    );
    
    return result.rows[0] || { total_transactions: 0, total_settled: 0, avg_reputation: 5.0 };
  }
}

export default Agent;
