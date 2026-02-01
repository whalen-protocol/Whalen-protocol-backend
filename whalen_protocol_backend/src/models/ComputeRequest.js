import pool from '../config/database.js';
import { generateId } from '../utils/helpers.js';

export class ComputeRequest {
  static async create(requesterId, gpuCount, gpuType, durationHours, maxPricePerHour, cpuCores = null, memoryGb = null, description = null) {
    const id = generateId();
    
    const result = await pool.query(
      `INSERT INTO compute_requests 
       (id, requester_id, gpu_count, gpu_type, cpu_cores, memory_gb, duration_hours, max_price_per_hour, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, requesterId, gpuCount, gpuType, cpuCores, memoryGb, durationHours, maxPricePerHour, description]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM compute_requests WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByRequesterId(requesterId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM compute_requests 
       WHERE requester_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [requesterId, limit, offset]
    );
    
    return result.rows;
  }

  static async findByStatus(status, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM compute_requests 
       WHERE status = $1 
       ORDER BY created_at DESC 
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
      `UPDATE compute_requests SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async getAll(limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM compute_requests 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  }

  static async getStats() {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        AVG(max_price_per_hour) as avg_max_price,
        SUM(CASE WHEN status = 'completed' THEN duration_hours ELSE 0 END) as total_hours_completed
       FROM compute_requests`
    );
    
    return result.rows[0];
  }
}

export default ComputeRequest;
