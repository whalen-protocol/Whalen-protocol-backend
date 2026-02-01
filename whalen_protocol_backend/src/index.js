import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database.js';
import { errorHandler } from './middleware/auth.js';
import agentsRouter from './routes/agents.js';
import providersRouter from './routes/providers.js';
import discoveryRouter from './routes/discovery.js';
import requestsRouter from './routes/requests.js';
import matchesRouter from './routes/matches.js';
import paymentsRouter from './routes/payments.js';
import verificationsRouter from './routes/verifications.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API version endpoint
app.get('/api/v1/info', (req, res) => {
  res.status(200).json({
    name: 'Whalen Protocol',
    version: '1.0.0',
    description: 'Neutral coordination layer for machine commerce',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/agents', agentsRouter);
app.use('/api/v1/providers', providersRouter);
app.use('/api/v1/discovery', discoveryRouter);
app.use('/api/v1/requests', requestsRouter);
app.use('/api/v1/matches', matchesRouter);
app.use('/api/v1/payments', paymentsRouter);
app.use('/api/v1/verifications', verificationsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    statusCode: 404,
    message: 'Endpoint not found',
    path: req.path,
  });
});

// Error handler
app.use(errorHandler);

// Database connection test
const testDatabaseConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connected:', result.rows[0]);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await testDatabaseConnection();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║         Whalen Protocol Backend - Version 1.0.0            ║
╚════════════════════════════════════════════════════════════╝

✓ Server running on port ${PORT}
✓ Environment: ${process.env.NODE_ENV || 'development'}
✓ Database: ${process.env.DB_NAME || 'whalen_protocol'}

API Endpoints:
  POST   /api/v1/agents/register
  GET    /api/v1/agents/profile
  GET    /api/v1/agents/:id
  
  POST   /api/v1/providers/capabilities
  GET    /api/v1/providers/capabilities/:providerId
  PATCH  /api/v1/providers/capabilities/:capabilityId
  
  GET    /api/v1/discovery/search
  POST   /api/v1/discovery/find-matches
  GET    /api/v1/discovery/stats
  
  POST   /api/v1/requests
  GET    /api/v1/requests/:requestId
  POST   /api/v1/requests/:requestId/find-matches
  POST   /api/v1/requests/:requestId/auto-match
  
  GET    /api/v1/matches/:matchId
  POST   /api/v1/matches/:matchId/accept
  POST   /api/v1/matches/:matchId/complete
  POST   /api/v1/matches/:matchId/cancel

Health Check:
  GET    /health
  GET    /api/v1/info

Ready to accept connections!
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  pool.end(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  pool.end(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
});

export default app;
