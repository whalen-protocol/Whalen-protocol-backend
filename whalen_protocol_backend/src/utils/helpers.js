import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const generateId = () => uuidv4();

export const generateApiKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const hashProof = (data) => {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
};

export const calculateReputationScore = (totalTransactions, successfulTransactions, averageRating) => {
  if (totalTransactions === 0) return 5.0;
  
  const successRate = (successfulTransactions / totalTransactions) * 100;
  const successRateScore = (successRate / 100) * 5;
  const ratingScore = Math.min(averageRating || 5, 5);
  
  return (successRateScore * 0.6 + ratingScore * 0.4).toFixed(2);
};

export const formatResponse = (data, message = 'Success', statusCode = 200) => {
  return {
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
};

export const formatError = (message, statusCode = 400, error = null) => {
  return {
    success: false,
    statusCode,
    message,
    error: error ? error.message : null,
    timestamp: new Date().toISOString(),
  };
};

export const calculateMatchScore = (request, capability) => {
  let score = 100;
  
  // GPU match
  if (capability.gpu_count >= request.gpu_count) {
    score += 20;
  } else {
    score -= 30;
  }
  
  // Price match
  if (capability.price_per_hour <= request.max_price_per_hour) {
    const priceRatio = capability.price_per_hour / request.max_price_per_hour;
    score += (1 - priceRatio) * 20;
  } else {
    score -= 40;
  }
  
  // Availability
  if (capability.available_hours >= request.duration_hours) {
    score += 15;
  } else {
    score -= 20;
  }
  
  // Reputation bonus
  score += (capability.reputation_score || 5) * 2;
  
  return Math.max(0, score);
};
