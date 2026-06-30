# Lead Outreach API

Unified NestJS API for lead scraping, lead management, WhatsApp setup, outreach, conversations, messages, templates, and safe send pacing.

## What Changed

- One PostgreSQL database stores both Google Maps lead data and WhatsApp outreach data.
- `/scrape` uses Redis/BullMQ and Playwright to scrape Google Maps into the unified `Lead` table.
- WhatsApp sending still uses the existing database-backed cron queue for pacing and anti-blocking rules.
- Auth uses email and password. Signup requires an email OTP before creating an account.
- Seeding only removes legacy fixed login accounts; new accounts are created through signup.

## Local Start

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npx prisma db seed
npm run start:dev
```

Local dependencies:

- PostgreSQL
- Redis for scraper jobs
- WAHA if testing WhatsApp Web flows

## Main Routes

| Route | Purpose |
| --- | --- |
| `POST /auth/login` | Email/password login |
| `POST /auth/signup` | Request signup email OTP |
| `POST /auth/signup/verify` | Verify signup OTP and create account |
| `GET /auth/me` | Current account |
| `GET /leads` | Account-scoped unified leads, with scraper filters |
| `POST /leads` | Manual contact |
| `POST /leads/upload` | CSV contacts |
| `POST /scrape` | Start Google Maps scrape |
| `GET /scrape/:jobId` | Scrape job status |
| `DELETE /scrape/:jobId` | Stop scrape job |
| `GET /whatsapp/accounts` | Connected WhatsApp accounts |
| `POST /whatsapp/testing/waha/bootstrap` | Sync WAHA session |
| `POST /whatsapp/testing/waha/bulk-send` | Queue safe bulk outreach |
| `GET/POST /webhooks/whatsapp/:provider` | Provider webhooks |

All non-public routes are scoped to the authenticated `userId`, so each account sees separate data.
