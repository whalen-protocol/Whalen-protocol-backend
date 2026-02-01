import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import { formatError } from '../utils/helpers.js';

export const authenticateAgent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(formatError('Missing or invalid authorization header', 401));
    }
    
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here');
      req.agentId = decoded.agentId;
      next();
    } catch (err) {
      return res.status(401).json(formatError('Invalid or expired token', 401));
    }
  } catch (error) {
    return res.status(500).json(formatError('Authentication error', 500, error));
  }
};

export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json(formatError('Missing API key', 401));
    }
    
    const result = await pool.query(
      'SELECT id FROM agents WHERE api_key = $1',
      [apiKey]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json(formatError('Invalid API key', 401));
    }
    
    req.agentId = result.rows[0].id;
    next();
  } catch (error) {
    return res.status(500).json(formatError('API key authentication error', 500, error));
  }
};

export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  return res.status(500).json(formatError('Internal server error', 500, err));
};
