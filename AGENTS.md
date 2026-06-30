# Lead Outreach Platform — Project Context

> **Purpose:** Handoff doc for AI assistants and developers. Read this first when opening this repo in a new chat.
>
> **Last updated:** 2026-06-12
> **Repo path:** `/Users/muhammadfarooqiqbal/flutterprojects/freelancer/lead-outreach-platform`

---

## What This Repo Is

A unified lead outreach platform with:

- One PostgreSQL database
- One NestJS API
- One Next.js frontend
- Email/password login and signup screens
- Email-verified self-serve signup
- Account-scoped data for every lead, scrape job, WhatsApp account, conversation, message, template, and outreach stat

The previous separate WhatsApp and lead-generation apps were merged and removed from the working tree. Use `apps/api`, `apps/web`, and `deploy` for all current development.

---

## Folder Structure

```text
lead-outreach-platform/
├── AGENTS.md
├── apps/
│   ├── api/        Unified NestJS API, Prisma, PostgreSQL, Redis/BullMQ scraper, WAHA outreach
│   └── web/        Unified Next.js dashboard
└── deploy/         Single Docker Compose stack
```

---

## Unified API (`apps/api`)

### Stack

- NestJS 11
- Prisma 7
- PostgreSQL 16
- Redis + BullMQ for Google Maps scrape jobs
- Playwright for scraping
- WAHA primary WhatsApp provider
- Existing WhatsApp adapters: Baileys, Meta Cloud, Twilio, 360dialog, MessageBird stub
- DB-backed cron job queue for WhatsApp sends and outreach pacing

### Key Modules

| Module | Purpose |
| --- | --- |
| `auth` | Email/password login, signup email OTP, JWT validation |
| `leads` | Unified lead CRUD, CSV upload, wa.me links, scraper filters |
| `scraper` | Google Maps scraping with Playwright |
| `scrape-jobs` | Redis/BullMQ scrape queue and status endpoints |
| `whatsapp` | WAHA setup, QR/session sync, test send, bulk send, voice |
| `outreach` | Anti-blocking guards, warm-up, caps, pacing |
| `webhook` | WAHA/provider incoming messages and status events |
| `conversations` / `messages` | Inbox and chat history |
| `templates` | Message templates |
| `jobs` | DB-backed WhatsApp send queue |

### Auth / Accounts

- Public signup is available at `/signup`; it requires an email OTP before creating a normal user account.
- Signup blocks common temporary email domains and domains without MX mail records.
- Dashboard user-management routes are removed.
- Login uses email and password only.
- `apps/api/prisma/seed.js` removes legacy fixed login accounts and does not create users.
- Self-serve signup accounts are created with role `USER`.
- Configure `SIGNUP_SMTP_*` or platform `SMTP_*` env vars before enabling public signup in production.

### Unified Lead Model

The unified `Lead` table stores both scraped business data and WhatsApp outreach state:

- Business fields: `category`, `address`, `rating`, `reviewsCount`, `source`, `sourceKeyword`
- Contact fields: `name`, `phone`, `email`, `website`
- Outreach fields: `optIn`, `warmUpStatus`, `firstIncomingAt`, `lastOutgoingAt`, `status`, `tags`

Scraped leads may have no phone number. WhatsApp send flows only queue contactable leads with phone numbers.

---

## Unified Web (`apps/web`)

### Stack

- Next.js 16
- React 19
- Tailwind CSS 4
- Lucide icons

### Main Routes

| Route | Purpose |
| --- | --- |
| `/login` | Single login screen |
| `/dashboard` | Overview |
| `/dashboard/scraper` | Google Maps scraper |
| `/dashboard/leads` | Unified lead list |
| `/dashboard/contacts` | Manual/CSV contacts and wa.me warm-up links |
| `/dashboard/whatsapp/setup` | WAHA QR/session setup |
| `/dashboard/whatsapp` | Test send and bulk outreach |
| `/dashboard/whatsapp/voice` | Voice messages |
| `/dashboard/conversations` | Inbox |
| `/dashboard/templates` | Templates |

The frontend calls the API through `/api/backend`, which proxies to `BACKEND_API_BASE_URL`.

---

## Deploy

Single compose file: `deploy/docker-compose.yml`

Services:

- `postgres`
- `redis`
- `api`
- `web`
- `waha`

The stack joins Traefik through the external `n8n_default` network. Do not touch the existing n8n/Traefik stack except by adding routes for this app.

Copy `deploy/.env.example` to `deploy/.env` before deployment and replace all passwords/secrets.

---

## VPS State

**Host:** `root@72.62.135.152` (`srv1256393.hstgr.cloud`)

Still running and must not be touched:

| Service | Container | Notes |
| --- | --- | --- |
| n8n | `n8n-n8n-1` | Workflows intact |
| Traefik | `n8n-traefik-1` | SSL/routing |

External Traefik network: `n8n_default`

---

## Local Commands

```bash
# API
cd apps/api
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npx prisma db seed
npm run start:dev

# Web
cd apps/web
npm install
cp .env.example .env.local
npm run dev

# Verify builds/tests
cd apps/api && npm run build && npm test -- --runInBand
cd apps/web && npm run build

# Validate compose
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example config
```

---

## Product Notes

- Emphasis on WhatsApp anti-blocking: warm-up, pacing, engaged-only bulk, human-like typing delays.
- One login equals one WhatsApp number: `WhatsAppAccount.userId` remains unique.
- Each account sees only its own data.
- WAHA sessions were previously removed from VPS cleanup; a fresh deployment needs a new QR scan.
