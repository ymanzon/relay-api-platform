# Relay — API Gateway Platform

<p align="center">
  <strong>Self-hosted API gateway, proxy engine, and mock server — all in one.</strong><br/>
  Built with NestJS · MongoDB · Vanilla JS · No external services required.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-usage-examples">Usage Examples</a> ·
  <a href="#-api-reference">API Reference</a>
</p>

---

## What is Relay?

Relay is a **self-hosted API gateway** that runs on your own infrastructure. It sits between your clients and your backend services, giving you:

- A **proxy engine** that forwards requests to any backend URL — with header injection, secret resolution, and timeout control
- A **mock server** for instant API responses without writing backend code
- A **security layer** with rate limiting, IP control, device fingerprinting, HMAC signing, and threat detection
- A **developer dashboard** for organizing, testing, and auditing every API endpoint

> **Who needs Relay?** Freelancers managing multiple client APIs, small teams needing internal API tooling, frontend developers who need mock servers, and anyone who wants API visibility and control without running Kong, NGINX Plus, or AWS API Gateway.

---

## Features

### Core Proxy Engine
| Feature | Description |
|---|---|
| **Dynamic Proxy** | Forward GET/POST/PUT/PATCH/DELETE to any backend URL |
| **Mock Server** | Return custom JSON, headers, status codes, and delays |
| **Pre/Post Events** | Run JavaScript scripts or webhooks before/after each call |
| **Parameter Validation** | Declare required query/body params — validated before proxying |
| **File Handling** | Forward multipart uploads; serve binary file downloads as mock |
| **Response Cache** | In-memory TTL cache with LRU eviction, configurable per endpoint |

### Security Module
| Feature | Description |
|---|---|
| **Rate Limiting** | Sliding-window counter per IP, API Key, device fingerprint, or global |
| **IP Allowlist / Blocklist** | CIDR notation, exact IP, and prefix-wildcard support |
| **Device Fingerprinting** | SHA-256 of IP + User-Agent + Accept headers — works with any HTTP client |
| **Threat Detection** | Blocks SQLi, XSS, Path Traversal, Command Injection, NoSQLi, SSTI |
| **HMAC Request Signing** | Verify signatures (SHA-256/512) with timing-safe comparison |
| **Per-Endpoint CORS** | Override global CORS settings for individual endpoints |
| **Body Size Limit** | Reject oversized requests before processing |
| **Security Audit Log** | Every blocked request logged with IP, fingerprint, pattern matched |

### Developer Tooling
| Feature | Description |
|---|---|
| **Environments** | Variable sets with `[[BASE_URL]]` syntax, switchable from nav bar |
| **Secrets Vault** | AES-256-GCM encrypted values, resolved as `{{SECRET_NAME}}` at proxy time |
| **Collections** | Folder-group endpoints; bulk export per collection |
| **OpenAPI Import** | Bulk-create endpoints from Swagger 2.x or OpenAPI 3.x specs |
| **Multi-format Export** | Postman v2.1, Insomnia v4, OpenAPI 3.0 YAML, k6 load test scripts |
| **Code Generation** | 7 languages: cURL, JS Fetch, Axios, jQuery, Python, k6, PHP |
| **Built-in Tester** | Send requests with 50-entry history, restore past calls |
| **Analytics Dashboard** | 8 KPIs, p95/p99 latency, error rate, request timeline, drill-down |

---

## Quick Start

### Prerequisites
- **Node.js** 18 or later
- **MongoDB** 6 or later (local install or MongoDB Atlas free tier)

### 1. Clone and install

```bash
git clone https://github.com/ymanzon/relay-api-platform.git
cd relay-api-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/relay

# Server port (default: 3000)
PORT=3000

# 64-character hex key for secrets vault encryption
# Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SECRET_ENCRYPTION_KEY=paste_your_64_char_hex_key_here
```

**Using MongoDB Atlas (free tier):**
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/relay?retryWrites=true&w=majority
```

### 3. Start

```bash
# Development mode (hot-reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

Open **http://localhost:3000** — the dashboard loads automatically.

---

## Usage Examples

### Example 1 — Hide an API key behind a proxy

**Situation:** You want to expose a third-party API (e.g. OpenWeatherMap) to your frontend without exposing your API key in browser network requests.

**Step 1 — Store your key as a Secret**
```
Dashboard → Secrets → New Secret
Name: WEATHER_KEY
Value: your_openweathermap_api_key
```

**Step 2 — Create the endpoint**
```
Endpoints → New Endpoint
Name:         Get Weather
Method:       GET
Virtual Path: weather
Destination:  https://api.openweathermap.org/data/2.5/weather?appid={{WEATHER_KEY}}
```

**Step 3 — Call it from your frontend**
```bash
curl "http://localhost:3000/api/weather?q=London&units=metric"
```
The `{{WEATHER_KEY}}` placeholder is resolved server-side. Your actual key never reaches the client.

---

### Example 2 — Mock API for frontend development

**Situation:** Your frontend team needs to work before the backend is ready.

```
Endpoints → New Endpoint
Name:         Get User Profile
Method:       GET
Virtual Path: users/:id
Destination:  (leave empty — activates Mock mode)

Mock Response:
  Status: 200
  Delay:  150ms
  Body:
{
  "id": "usr_123",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "admin"
}
```

Call `GET http://localhost:3000/api/users/any-id` — returns your mock instantly with realistic latency.

When the real backend is ready, just add the Destination URL and remove the mock.

---

### Example 3 — Rate limit a public endpoint

**Situation:** You have an endpoint open to the public and want to prevent abuse. Allow 30 requests per minute per IP. Block offenders for 5 minutes.

```
Endpoints → Edit → Security tab
☑ Enable Security Module

Rate Limit:
  ☑ Enabled
  Max Requests:   30
  Window:         60 seconds
  Strategy:       Per IP address
  Block Duration: 300 seconds
```

Response when exceeded:
```http
HTTP 429 Too Many Requests
Retry-After: 300
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 0

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded: 30 requests per 60s"
}
```

All blocked attempts are logged in the Security Events audit trail.

---

### Example 4 — Multi-environment deployments

**Situation:** You have the same API structure in dev, staging, and production, each at a different base URL.

**Create three environments:**
```
Environments → New Environment
  Name: Development    Variables: BASE_URL = http://localhost:8080
  Name: Staging        Variables: BASE_URL = https://staging.api.mycompany.com
  Name: Production     Variables: BASE_URL = https://api.mycompany.com
```

**Set your endpoints to use the variable:**
```
Destination URL: [[BASE_URL]]/v2/orders
```

To switch environments, click the selector in the nav bar. Every endpoint using `[[BASE_URL]]` resolves to the new value at proxy time — no endpoint edits needed.

You can combine environments and secrets:
```
Destination URL: [[BASE_URL]]/v2/users?apiKey={{MY_SECRET}}
```

---

### Example 5 — Import an existing API from a Swagger file

**Situation:** You have an OpenAPI spec and want all 40 endpoints created in seconds.

```
Environments page → Import Spec button → Paste tab
```

Paste your spec (JSON or YAML), click **Preview** to review, then **Import**.

Or fetch directly from a URL:
```
From URL tab → https://petstore.swagger.io/v2/swagger.json → Fetch → Import
```

All endpoints are created with query params, body params, and a mock response auto-populated from the spec examples. Operations with tags are grouped into Collections automatically.

---

### Example 6 — Require signed requests (HMAC)

**Situation:** An internal microservice calls your endpoint and you want to verify it hasn't been tampered with.

```
Endpoints → Edit → Security tab → HMAC Signing
☑ Enable HMAC Request Signing
Signature Header: X-Signature
Algorithm:        HMAC-SHA256
Secret:           (click Generate, then Copy signing snippet)
```

The snippet button gives you ready-to-paste Node.js code:

```js
const crypto  = require('crypto');
const SECRET  = 'your_shared_secret';
const METHOD  = 'POST';
const PATH    = '/orders';
const query   = {};
const body    = { item: 'widget', qty: 2 };

const payload = [METHOD, PATH,
  JSON.stringify(Object.keys(query).sort().reduce((a,k)=>(a[k]=query[k],a),{})),
  JSON.stringify(Object.keys(body).sort().reduce((a,k) =>(a[k]=body[k], a),{})),
].join('\n');

const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
// Add header to your request:
headers['X-Signature'] = signature;
```

Requests without a valid signature return `401 HMAC_INVALID`.

---

### Example 7 — Pre-event to inject dynamic headers

**Situation:** A backend expects an `Authorization: Bearer <token>` header that changes per request (e.g. a short-lived JWT).

```
Events → New Event
Name:   Inject JWT
Type:   Script

Script:
  // ctx.secrets holds your vault values
  // ctx.request.headers can be mutated
  const token = ctx.secrets.JWT_SECRET;  // or generate dynamically
  ctx.request.headers['Authorization'] = `Bearer ${token}`;
  ctx.extras.injectedAt = new Date().toISOString();
```

Attach this event as **PRE** on any endpoint that needs it. The header is added before the request is forwarded to the backend.

---

### Example 8 — Export a collection for your team

**Situation:** You've built out an entire set of endpoints for a project and want to share them with your team as a Postman collection.

```
Endpoints page → hover over any Collection folder
→ click the Postman icon that appears
```

Or export the entire catalog:
```
Endpoints page → Export dropdown
→ Export as Postman / Insomnia / OpenAPI / k6
```

The Postman export includes all variables, headers, and example bodies. The OpenAPI export is a valid spec that can be published to API documentation tools. The k6 export is a ready-to-run load test script.

---

## API Reference

Base URL: `http://localhost:3000`

### Proxy Engine
| Method | Path | Description |
|---|---|---|
| `ANY` | `/api/:path` | Dynamic proxy — matches configured endpoint by method + path |

### Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/catalog/endpoints` | List all (filter: `?enabled=true&tags=foo&collection=bar`) |
| `POST` | `/catalog/endpoints` | Create |
| `GET` | `/catalog/endpoints/stats` | Aggregate stats |
| `GET` | `/catalog/endpoints/collections` | Unique collection names + counts |
| `GET` | `/catalog/endpoints/:id` | Get one |
| `PUT` | `/catalog/endpoints/:id` | Update |
| `DELETE` | `/catalog/endpoints/:id` | Delete |
| `POST` | `/catalog/endpoints/:id/generate-key` | Regenerate API key |
| `PUT` | `/catalog/endpoints/bulk/collection` | Move multiple to a collection |

### Executions
| Method | Path | Description |
|---|---|---|
| `GET` | `/catalog/executions` | Recent history |
| `GET` | `/catalog/executions/stats` | Global stats + timeline + p95/p99 |
| `GET` | `/catalog/executions/endpoint/:id` | History for one endpoint |
| `GET` | `/catalog/executions/endpoint/:id/stats` | Stats + percentiles + errors |
| `DELETE` | `/catalog/executions/bulk` | Bulk delete (body: `{ ids: [...] }`) |
| `DELETE` | `/catalog/executions/endpoint/:id` | Clear all for endpoint |

### Environments
| Method | Path | Description |
|---|---|---|
| `GET` | `/catalog/environments` | List all |
| `POST` | `/catalog/environments` | Create |
| `GET` | `/catalog/environments/active` | Get active environment |
| `PUT` | `/catalog/environments/:id` | Update |
| `DELETE` | `/catalog/environments/:id` | Delete |
| `POST` | `/catalog/environments/:id/activate` | Set as active |
| `POST` | `/catalog/environments/deactivate-all` | Disable all |
| `POST` | `/catalog/environments/preview` | Resolve `[[VAR]]` without changing state |

### Secrets
| Method | Path | Description |
|---|---|---|
| `GET` | `/catalog/secrets` | List names (values never returned) |
| `POST` | `/catalog/secrets` | Create |
| `PUT` | `/catalog/secrets/:id` | Update |
| `DELETE` | `/catalog/secrets/:id` | Delete |
| `POST` | `/catalog/secrets/validate-refs` | Check if `{{REFS}}` exist |

### Security
| Method | Path | Description |
|---|---|---|
| `GET` | `/catalog/security/events` | Recent events (last 100) |
| `GET` | `/catalog/security/events/endpoint/:id` | Events for one endpoint |
| `GET` | `/catalog/security/stats` | 24h summary by type + top IPs |
| `GET` | `/catalog/security/rate-limits/:endpointId` | Active rate-limit counters |
| `POST` | `/catalog/security/unblock` | Unblock identifier |
| `DELETE` | `/catalog/security/rate-limits/:endpointId` | Clear RL counters |

### Import
| Method | Path | Description |
|---|---|---|
| `POST` | `/catalog/import/openapi` | Import from OpenAPI 3.x or Swagger 2.x |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client / Browser                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    Relay Gateway     │  :3000
                    │    (NestJS + SPA)    │
                    └──────────┬───────────┘
                               │
              ┌────────────────▼────────────────┐
              │           Proxy Pipeline         │
              │  1. Endpoint lookup              │
              │  2. API Key validation           │
              │  2.5 Security pipeline           │
              │     · CORS · IP · Fingerprint    │
              │     · Threats · HMAC · Rate Limit│
              │  3.  Cache check (read)          │
              │  3.5 Environment [[VAR]] resolve │
              │  4.  Secrets {{NAME}} resolve    │
              │  5.  Param validation            │
              │  6.  PRE events                  │
              │  7.  Proxy / Mock                │
              │  8.  POST events                 │
              │  9.  Cache write + Execution log │
              └────────────────┬────────────────┘
                               │
               ┌───────────────┼───────────────┐
               ▼               ▼               ▼
        Destination        Mock Response    In-Memory
          Backend             Server          Cache
                               │
                         MongoDB Atlas
                    (endpoints, events,
                    executions, secrets,
                    environments, security)
```

### Tech Stack
| Layer | Technology |
|---|---|
| Backend framework | NestJS 10 |
| Database | MongoDB 6 + Mongoose 8 |
| HTTP proxy | Axios |
| File handling | Multer |
| Frontend | Vanilla JS + MaterializeCSS |
| Charts | Chart.js |
| Crypto | Node.js built-in (`crypto`) |

---

## Project Structure

```
src/
├── main.ts                      Entry point — loads .env, starts server
├── app.module.ts                Root module wiring
└── modules/
    ├── proxy/                   ← Core: 10-step proxy pipeline
    ├── endpoints/               ← CRUD + schema + DTOs
    ├── events/                  ← Pre/Post scripts + webhooks
    ├── executions/              ← History + stats + percentiles
    ├── cache/                   ← In-memory TTL + LRU cache
    ├── secrets/                 ← AES-256-GCM vault
    ├── security/                ← Rate limit + IP + fingerprint + HMAC
    ├── environments/            ← Variable sets per environment
    ├── import/                  ← OpenAPI/Swagger bulk import
    └── settings/                ← Theme + app preferences

src/public/
├── index.html                   Single-page app (dashboard)
└── js/app.js                    All frontend logic

docs/
└── index.html                   GitHub Pages documentation site
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGODB_URI` | ✅ | `mongodb://localhost:27017/relay` | MongoDB connection string |
| `PORT` | No | `3000` | HTTP server port |
| `SECRET_ENCRYPTION_KEY` | ✅* | — | 64-char hex for AES-256-GCM |

*Required only if using the Secrets Vault feature.

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Security Notes

- Secrets are stored **AES-256-GCM encrypted**. The plain value is never returned after creation.
- `SECRET_ENCRYPTION_KEY` is the sole decryption key — back it up. Losing it means secrets are unrecoverable.
- HMAC verification uses Node's `timingSafeEqual` — immune to timing attacks.
- Security event logs store only the **last 6 characters** of API keys, never the full value.
- Rate-limit counters are **in-memory** and reset on restart. For clustered deployments, extend `SecurityService` to use Redis.
- The `.env` file is in `.gitignore` — never commit it.

---

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```bash
docker build -t relay-api .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/relay" \
  -e SECRET_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" \
  relay-api
```

---

## License

MIT — free to use, modify, and distribute.
