-- Whalen Protocol Database Schema

-- Agents (both requesters and providers)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('requester', 'provider', 'both')),
  wallet_address VARCHAR(255),
  reputation_score FLOAT DEFAULT 5.0,
  total_transactions INT DEFAULT 0,
  total_earnings DECIMAL(18, 8) DEFAULT 0,
  total_spent DECIMAL(18, 8) DEFAULT 0,
  uptime_percentage FLOAT DEFAULT 100.0,
  api_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider Capabilities
CREATE TABLE IF NOT EXISTS provider_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  gpu_count INT NOT NULL,
  gpu_type VARCHAR(50) NOT NULL,
  cpu_cores INT NOT NULL,
  memory_gb INT NOT NULL,
  price_per_hour DECIMAL(18, 8) NOT NULL,
  available_hours INT DEFAULT 0,
  region VARCHAR(100),
  availability_status VARCHAR(50) DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'offline')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compute Requests
CREATE TABLE IF NOT EXISTS compute_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  gpu_count INT NOT NULL,
  gpu_type VARCHAR(50) NOT NULL,
  cpu_cores INT,
  memory_gb INT,
  duration_hours INT NOT NULL,
  max_price_per_hour DECIMAL(18, 8) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'in_progress', 'completed', 'failed', 'cancelled')),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Matches (request → provider)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES compute_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  capability_id UUID REFERENCES provider_capabilities(id),
  agreed_price_per_hour DECIMAL(18, 8) NOT NULL,
  status VARCHAR(50) DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'in_progress', 'completed', 'failed', 'cancelled')),
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (payments)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'escrowed', 'verified', 'settled', 'failed', 'refunded')),
  payment_method VARCHAR(50),
  transaction_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verification Records
CREATE TABLE IF NOT EXISTS verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  verifier_id UUID REFERENCES agents(id),
  proof_hash VARCHAR(255),
  proof_data JSONB,
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_api_key ON agents(api_key);
CREATE INDEX IF NOT EXISTS idx_provider_capabilities_provider_id ON provider_capabilities(provider_id);
CREATE INDEX IF NOT EXISTS idx_compute_requests_requester_id ON compute_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_compute_requests_status ON compute_requests(status);
CREATE INDEX IF NOT EXISTS idx_matches_request_id ON matches(request_id);
CREATE INDEX IF NOT EXISTS idx_matches_provider_id ON matches(provider_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_transactions_match_id ON transactions(match_id);
CREATE INDEX IF NOT EXISTS idx_transactions_requester_id ON transactions(requester_id);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_verifications_transaction_id ON verifications(transaction_id);
