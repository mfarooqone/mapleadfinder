# Lead Outreach Web

Unified Next.js dashboard for scraping Google Maps leads, managing contacts, connecting WhatsApp, and sending safe outreach.

## What Changed

- One frontend replaces the old separate WhatsApp and lead-generation UIs.
- `/dashboard/scraper` imports Google Maps leads into the same lead database used by outreach.
- `/dashboard/leads`, `/dashboard/contacts`, and `/dashboard/whatsapp` all read account-scoped data from the unified API.
- There is one login screen. Public signup/setup and user-management navigation are removed.
- Browser API calls go through `/api/backend`, which proxies to the NestJS API.

## Local Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Default backend proxy:

```env
BACKEND_API_BASE_URL=http://127.0.0.1:3001
NEXT_PUBLIC_API_BASE_URL=/api/backend
```

## Main Routes

| Route | Purpose |
| --- | --- |
| `/login` | Single login screen |
| `/dashboard` | Overview |
| `/dashboard/scraper` | Google Maps scraper |
| `/dashboard/leads` | Unified lead list |
| `/dashboard/contacts` | Manual/CSV contacts and wa.me warm-up links |
| `/dashboard/whatsapp/setup` | WAHA QR/session setup |
| `/dashboard/whatsapp` | Test send and bulk outreach |
| `/dashboard/conversations` | Inbox |
| `/dashboard/templates` | Message templates |

Each seeded account sees only its own leads, WhatsApp account, messages, templates, conversations, and scrape jobs.
