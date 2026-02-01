# Whalen Protocol Backend - Version 1.0.0

A neutral coordination layer for machine commerce in the AI agent economy. This backend provides a complete API for agents to discover, match, and transact for compute resources.

## Quick Start

### Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

### Installation

1. Clone the repository and install dependencies:

```bash
cd whalen_protocol_backend
npm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Update `.env` with your database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whalen_protocol
DB_USER=postgres
DB_PASSWORD=your_password
PORT=3000
JWT_SECRET=your_secret_key_here
```

4. Initialize the database schema:

```bash
npm run init-db
```

5. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Or an API key in the `X-API-Key` header:

```
X-API-Key: <api_key>
```

### Agent Management

**Register a new agent**
```
POST /api/v1/agents/register
Content-Type: application/json

{
  "name": "Agent Name",
  "type": "requester|provider|both",
  "walletAddress": "0x..."
}

Response:
{
  "agent": {
    "id": "uuid",
    "name": "Agent Name",
    "type": "requester",
    "api_key": "...",
    "reputation_score": 5.0
  },
  "token": "jwt_token"
}
```

**Get agent profile**
```
GET /api/v1/agents/profile
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "name": "Agent Name",
  "type": "requester",
  "reputation_score": 5.0,
  "total_transactions": 0,
  "total_earnings": 0,
  "total_spent": 0,
  "uptime_percentage": 100.0
}
```

**Get agent by ID**
```
GET /api/v1/agents/:id

Response:
{
  "id": "uuid",
  "name": "Agent Name",
  "type": "requester",
  "reputation_score": 5.0,
  "total_transactions": 0,
  "uptime_percentage": 100.0
}
```

### Provider Management

**Register provider capability**
```
POST /api/v1/providers/capabilities
Authorization: Bearer <token>
Content-Type: application/json

{
  "gpu_count": 8,
  "gpu_type": "H100",
  "cpu_cores": 64,
  "memory_gb": 256,
  "price_per_hour": 45.50,
  "region": "us-east-1"
}

Response:
{
  "id": "uuid",
  "provider_id": "uuid",
  "gpu_count": 8,
  "gpu_type": "H100",
  "cpu_cores": 64,
  "memory_gb": 256,
  "price_per_hour": 45.50,
  "region": "us-east-1",
  "availability_status": "available"
}
```

**Get provider capabilities**
```
GET /api/v1/providers/capabilities/:providerId

Response:
{
  "provider_id": "uuid",
  "capabilities": [...]
}
```

**Update provider capability**
```
PATCH /api/v1/providers/capabilities/:capabilityId
Authorization: Bearer <token>
Content-Type: application/json

{
  "price_per_hour": 40.00,
  "available_hours": 100,
  "availability_status": "available"
}
```

### Discovery

**Search for providers**
```
GET /api/v1/discovery/search?gpu_count=8&gpu_type=H100&max_price=50&region=us-east-1

Response:
{
  "query": {
    "gpu_count": 8,
    "gpu_type": "H100",
    "max_price": 50,
    "region": "us-east-1"
  },
  "results": [
    {
      "id": "uuid",
      "provider_id": "uuid",
      "gpu_count": 8,
      "gpu_type": "H100",
      "price_per_hour": 45.50,
      "reputation_score": 4.8,
      "uptime_percentage": 99.2
    }
  ],
  "count": 1
}
```

**Find matches for a request**
```
POST /api/v1/discovery/find-matches
Content-Type: application/json

{
  "gpu_count": 8,
  "gpu_type": "H100",
  "duration_hours": 2,
  "max_price_per_hour": 50,
  "region": "us-east-1"
}

Response:
{
  "request": {...},
  "matches": [
    {
      "provider_id": "uuid",
      "capability_id": "uuid",
      "gpu_count": 8,
      "price_per_hour": 45.50,
      "reputation_score": 4.8,
      "match_score": 92.5
    }
  ],
  "count": 1
}
```

**Get marketplace stats**
```
GET /api/v1/discovery/stats

Response:
{
  "requests": {
    "total_requests": 10,
    "completed": 5,
    "in_progress": 2,
    "pending": 3,
    "avg_max_price": 45.50,
    "total_hours_completed": 100
  },
  "matches": {
    "total_matches": 8,
    "completed": 5,
    "in_progress": 2,
    "proposed": 1,
    "avg_price": 43.00
  }
}
```

### Compute Requests

**Submit a compute request**
```
POST /api/v1/requests
Authorization: Bearer <token>
Content-Type: application/json

{
  "gpu_count": 8,
  "gpu_type": "H100",
  "duration_hours": 2,
  "max_price_per_hour": 50,
  "cpu_cores": 64,
  "memory_gb": 256,
  "description": "Training job for model X"
}

Response:
{
  "id": "uuid",
  "requester_id": "uuid",
  "gpu_count": 8,
  "gpu_type": "H100",
  "duration_hours": 2,
  "max_price_per_hour": 50,
  "status": "pending",
  "created_at": "2026-01-31T..."
}
```

**Get compute request**
```
GET /api/v1/requests/:requestId

Response:
{
  "id": "uuid",
  "requester_id": "uuid",
  "gpu_count": 8,
  "gpu_type": "H100",
  "duration_hours": 2,
  "max_price_per_hour": 50,
  "status": "pending",
  "created_at": "2026-01-31T..."
}
```

**Get my requests**
```
GET /api/v1/requests/my-requests?limit=50&offset=0
Authorization: Bearer <token>

Response:
{
  "requests": [...],
  "limit": 50,
  "offset": 0
}
```

**Find matches for a request**
```
POST /api/v1/requests/:requestId/find-matches
Authorization: Bearer <token>

Response:
{
  "request_id": "uuid",
  "matches": [
    {
      "provider_id": "uuid",
      "capability_id": "uuid",
      "gpu_count": 8,
      "price_per_hour": 45.50,
      "reputation_score": 4.8,
      "match_score": 92.5
    }
  ],
  "count": 1
}
```

**Auto-match a request**
```
POST /api/v1/requests/:requestId/auto-match
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "request_id": "uuid",
  "provider_id": "uuid",
  "agreed_price_per_hour": 45.50,
  "status": "proposed",
  "created_at": "2026-01-31T..."
}
```

### Matches

**Get match by ID**
```
GET /api/v1/matches/:matchId

Response:
{
  "id": "uuid",
  "request_id": "uuid",
  "provider_id": "uuid",
  "agreed_price_per_hour": 45.50,
  "status": "proposed",
  "provider_name": "Provider Name",
  "reputation_score": 4.8
}
```

**Accept a match**
```
POST /api/v1/matches/:matchId/accept
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "status": "accepted",
  "start_time": "2026-01-31T..."
}
```

**Complete a match**
```
POST /api/v1/matches/:matchId/complete
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "status": "completed",
  "end_time": "2026-01-31T..."
}
```

**Cancel a match**
```
POST /api/v1/matches/:matchId/cancel
Authorization: Bearer <token>

Response:
{
  "id": "uuid",
  "status": "cancelled"
}
```

## Database Schema

The backend uses PostgreSQL with the following main tables:

- **agents**: Stores agent information (requesters, providers)
- **provider_capabilities**: Stores provider compute capabilities
- **compute_requests**: Stores compute requests from requesters
- **matches**: Stores matches between requests and providers
- **transactions**: Stores payment transactions
- **verifications**: Stores verification records for completed work

See `src/config/schema.sql` for the complete schema.

## Project Structure

```
whalen_protocol_backend/
├── src/
│   ├── config/
│   │   ├── database.js        # Database connection
│   │   ├── schema.sql         # Database schema
│   │   └── init-db.js         # Database initialization
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── models/
│   │   ├── Agent.js           # Agent model
│   │   ├── ProviderCapability.js
│   │   ├── ComputeRequest.js
│   │   ├── Match.js
│   │   ├── Transaction.js
│   │   └── Verification.js
│   ├── routes/
│   │   ├── agents.js          # Agent endpoints
│   │   ├── providers.js       # Provider endpoints
│   │   ├── discovery.js       # Discovery endpoints
│   │   ├── requests.js        # Request endpoints
│   │   └── matches.js         # Match endpoints
│   ├── services/
│   │   └── MatchingService.js # Matching logic
│   ├── utils/
│   │   └── helpers.js         # Utility functions
│   └── index.js               # Express app entry point
├── .env.example               # Environment variables template
├── package.json               # Dependencies
└── README.md                  # This file
```

## Development

### Running Tests

```bash
npm test
```

### Code Style

The project uses standard JavaScript conventions. Format code with:

```bash
npm run format
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t whalen-protocol-backend .
docker run -p 3000:3000 --env-file .env whalen-protocol-backend
```

### AWS ECS

See deployment guide for AWS ECS setup instructions.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | whalen_protocol |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `JWT_SECRET` | JWT secret key | your_jwt_secret_key_here |
| `API_URL` | API base URL | http://localhost:3000 |

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.
