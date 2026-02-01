import pool from '../config/database.js';
import { generateId } from '../utils/helpers.js';

export class ProviderCapability {
  static async create(providerId, gpuCount, gpuType, cpuCores, memoryGb, pricePerHour, region = 'us-east-1') {
    const id = generateId();
    
    const result = await pool.query(
      `INSERT INTO provider_capabilities 
       (id, provider_id, gpu_count, gpu_type, cpu_cores, memory_gb, price_per_hour, region)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, providerId, gpuCount, gpuType, cpuCores, memoryGb, pricePerHour, region]
    );
    
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM provider_capabilities WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  }

  static async findByProviderId(providerId) {
    const result = await pool.query(
      'SELECT * FROM provider_capabilities WHERE provider_id = $1',
      [providerId]
    );
    
    return result.rows;
  }

  static async search(gpuCount, gpuType, maxPrice, region = null) {
    let query = `
      SELECT pc.*, a.reputation_score, a.uptime_percentage
      FROM provider_capabilities pc
      JOIN agents a ON pc.provider_id = a.id
      WHERE pc.gpu_count >= $1 
        AND pc.gpu_type = $2 
        AND pc.price_per_hour <= $3
        AND pc.availability_status = 'available'
    `;
    
    const params = [gpuCount, gpuType, maxPrice];
    
    if (region) {
      query += ` AND pc.region = $4`;
      params.push(region);
    }
    
    query += ` ORDER BY pc.price_per_hour ASC, a.reputation_score DESC`;
    
    const result = await pool.query(query, params);
    
    return result.rows;
  }

  static async update(id, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) return this.findById(id);
    
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    
    const result = await pool.query(
      `UPDATE provider_capabilities SET ${setClause}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, id]
    );
    
    return result.rows[0] || null;
  }

  static async updateAvailability(id, availableHours, status) {
    const result = await pool.query(
      `UPDATE provider_capabilities 
       SET available_hours = $1, availability_status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [availableHours, status, id]
    );
    
    return result.rows[0] || null;
  }

  static async delete(id) {
    await pool.query('DELETE FROM provider_capabilities WHERE id = $1', [id]);
  }
}

export default ProviderCapability;
