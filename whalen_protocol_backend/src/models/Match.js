import pool from '../config/database.js';
import { generateId } from '../utils/helpers.js';

export class Match {
  static async create(requestId, providerId, capabilityId, agreedPricePerHour) {
    const id = generateId();
    
    const result = await pool.query(
      `INSERT INTO matches 
       (id, request_id, provider_id, capability_id, agreed_price_per_hour)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, requestId, providerId, capabilityId, agreedPricePerHour]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT m.*, cr.gpu_count, cr.duration_hours, cr.gpu_type,
              a.name as provider_name, a.reputation_score
       FROM matches m
       JOIN compute_requests cr ON m.request_id = cr.id
       JOIN agents a ON m.provider_id = a.id
       WHERE m.id = $1`,
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByRequestId(requestId) {
    const result = await pool.query(
      `SELECT m.*, a.name as provider_name, a.reputation_score
       FROM matches m
       JOIN agents a ON m.provider_id = a.id
       WHERE m.request_id = $1
       ORDER BY m.created_at DESC`,
      [requestId]
    );
    
    return result.rows;
  }

  static async findByProviderId(providerId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT m.*, cr.gpu_count, cr.duration_hours,
              ag.name as requester_name
       FROM matches m
       JOIN compute_requests cr ON m.request_id = cr.id
       JOIN agents ag ON cr.requester_id = ag.id
       WHERE m.provider_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [providerId, limit, offset]
    );
    
    return result.rows;
  }

  static async findByStatus(status, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT m.*, cr.gpu_count, cr.duration_hours,
              a_provider.name as provider_name,
              a_requester.name as requester_name
       FROM matches m
       JOIN compute_requests cr ON m.request_id = cr.id
       JOIN agents a_provider ON m.provider_id = a_provider.id
       JOIN agents a_requester ON cr.requester_id = a_requester.id
       WHERE m.status = $1
       ORDER BY m.created_at DESC
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
      `UPDATE matches SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async getStats() {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_matches,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'proposed' THEN 1 END) as proposed,
        AVG(agreed_price_per_hour) as avg_price,
        SUM(CASE WHEN status = 'completed' THEN (end_time - start_time) ELSE INTERVAL '0' END) as total_compute_time
       FROM matches`
    );
    
    return result.rows[0];
  }
}

export default Match;
