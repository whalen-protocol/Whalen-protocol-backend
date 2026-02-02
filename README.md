import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

let pool;

// Check if we're on Heroku (DATABASE_URL is set)
if (process.env.DATABASE_URL) {
  // Heroku PostgreSQL connection
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Required for Heroku
    },
  });
  console.log('✓ Using Heroku PostgreSQL (DATABASE_URL)');
} else {
  // Local development connection
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'whalen_protocol',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });
  console.log('✓ Using local PostgreSQL');
}

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
