# SkillSwap

**Trade what you know for what you want to learn.**

SkillSwap is a peer-to-peer skill exchange platform. Find someone who has the
skill you need, offer a skill you know in return, and learn together — no
money, no courses, no gatekeeping.

> I teach you Python. You teach me Photoshop. Everyone wins.

## Features

- **Secure auth** — signup / login / logout / forgot & reset password, bcrypt
  password hashing, HTTP-only JWT cookies
- **Guided onboarding** — a 7-step flow: introduce yourself, pick teaching
  skills & levels, pick learning goals, format, availability, and instantly
  see your first matches
- **Deterministic matching engine** — pure, explainable scoring (0–100):
  - `+50` they teach what you want
  - `+30` you teach what they want
  - `+10` same university
  - `+5` compatible availability
  - `+5` compatible format
  - Categories: Perfect (80+), Strong (60–79), Potential (40–59)
- **Match explanations** — every match shows exactly *why* you fit
- **Discovery UI** — cards view + connections view, skill chips, animations
- **Exchange requests** — auto-generated, editable messages; pending /
  accepted / rejected / cancelled states
- **Exchange workspace** — overview, real-time chat (Socket.IO), session
  scheduling, progress & mutual completion
- **Reviews & reputation** — 1–5 stars after completion, average rating,
  completed-exchange counts
- **Notifications** — in-app notification center with real-time updates
- **Safety** — report users, block users (blocked users disappear from
  matches, requests and messaging), community guidelines
- **Admin dashboard** — stats, user management, skill catalogue, reports,
  monetization analytics
- **Monetization (Free / Gold / Elite + Boosts)** — server-verified
  subscriptions and one-time visibility boosts via Google Play Billing:
  - **Free** — Start swapping. Full community access with monthly limits
    (5 outgoing requests, 10 expanded unlocks, 10 saved matches)
  - **Gold** — Get discovered. Unlimited requests/matches/saves, advanced
    discovery filters, profile analytics, gold badge & frame
  - **Elite** — Become a top skill partner. Highest visibility, demand
    insights ("people looking for your skills"), 2 spotlight credits/month,
    advanced analytics, elite badge & frame
  - **Fairness guarantee** — match % is always genuine compatibility;
    paid visibility only affects *ranking*, never scores
  - **Boosts** — 24h Match Boost, Spotlight, Weekly Spotlight
  - **Referrals** — invite a friend, both get a free Match Boost
- **Android app** — Capacitor packaging with native Google Play Billing for
  APK (GitHub releases) and Play Store (AAB) deployment — see
  `docs/ANDROID.md`

No LLMs or AI APIs are used anywhere — matching is fully deterministic.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express, TypeScript, Socket.IO |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT in HTTP-only cookies, bcrypt |
| Validation | Zod |
| Tests | Jest + ts-jest |

Business logic lives in backend services; React components never touch the
database. The matching engine is a pure module, fully unit-testable.

## Prerequisites

- Node.js 18+
- A PostgreSQL database (local, Docker, or [Neon](https://neon.tech))

## PostgreSQL setup (local option)

```bash
createdb skillswap
# or with Docker:
docker run --name skillswap-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=skillswap -p 5432:5432 -d postgres:16
```

## Environment variables

Copy `.env.example` to `.env` (root and/or `server/.env`):

```
DATABASE_URL=postgresql://user:password@host:5432/skillswap
JWT_SECRET=change-me
CLIENT_URL=http://localhost:5173
SERVER_URL=http://localhost:4000
NODE_ENV=development
PORT=4000
```

## Installation

```bash
npm install          # installs root tooling (concurrently)
npm run setup        # installs server + client dependencies
```

## Prisma migration & seed

## Tests

```bash
npm run test         # matching engine + entitlements + billing security tests
```

Tests cover: perfect reciprocal matches, one-way matches, university /
availability / format bonuses, recommendation thresholds, category
boundaries; Free/Gold/Elite tier limits and visibility bonuses, fair ranking
(a paid 25% match can never outrank a genuine 85% match), and Play Billing
dev-token tamper rejection.

## Monetization configuration

Prices live in the database (`SubscriptionProduct`, `BoostProduct`), seeded
from `server/prisma/seed.ts` and editable via
`POST /api/admin/products/plans|boosts`. Feature flags gate gradual rollout:

```
GOLD_ENABLED=true        # set false to hide Gold
ELITE_ENABLED=true       # set false to hide Elite
BOOSTS_ENABLED=true      # boosts catalogue + purchases
ADS_ENABLED=false        # reserved; no ads in MVP
REFERRALS_ENABLED=true   # referral program
```

Server-side Google Play verification (production requires these):

```
GOOGLE_SERVICE_ACCOUNT_JSON={"client_email":"...","private_key":"..."}
ANDROID_PACKAGE_NAME=app.skillswap.mobile
```

Without credentials in development, billing runs in signature-checked dev
mode so the full purchase → verify → grant flow is testable end-to-end.

## Android app (APK + Play Store)

The web client ships as an Android app via Capacitor with native Google Play
Billing. Full build & release instructions — debug APK for GitHub releases,
signed AAB for Play Store, product setup, and the server verification
checklist — are in `docs/ANDROID.md`.

## Production build

```bash
npm run build        # builds server (tsc) and client (vite)
cd server && npm start
# serve client/dist with any static host; proxy /api and /socket.io to :4000
```

## Deployment

1. Provision PostgreSQL (e.g. Neon) and set `DATABASE_URL` / `JWT_SECRET`.
2. Run `npx prisma migrate deploy` and the seed once.
3. Build both packages (`npm run build`).
4. Run the server (`node server/dist/index.js`) with `NODE_ENV=production`,
   `CLIENT_URL` set to your frontend origin (enables CORS + secure cookies).
5. Serve `client/dist` statically and proxy `/api` + `/socket.io` to the
   server, or point the client at the API origin.

## API overview

```
Auth        POST /api/auth/signup | login | logout | forgot-password | reset-password
            GET  /api/auth/me | /api/auth/token
Profile     GET|PUT /api/profile        GET /api/users/:id        GET /api/users/search
Skills      GET /api/skills             POST /api/skills/:id/add  DELETE /api/skills/:id/remove
Matching    GET /api/matches            GET /api/matches/:userId
Requests    POST|GET /api/exchange-requests   POST .../:id/accept|reject|cancel
Exchanges   GET /api/exchanges          GET /api/exchanges/:id
            POST /api/exchanges/:id/complete | cancel
Messages    GET|POST /api/exchanges/:id/messages   (Socket.IO live delivery)
Sessions    GET|POST /api/exchanges/:id/sessions   PUT|DELETE /api/sessions/:id
            POST /api/sessions/:id/complete
Reviews     POST /api/exchanges/:id/review   GET /api/users/:id/reviews
Notifs      GET /api/notifications   POST .../:id/read   POST /api/notifications/read-all
Safety      POST /api/reports   POST|DELETE /api/users/:id/block
Admin       GET /api/admin/stats|users|skills|reports|monetization|products
            POST /api/admin/users/:id/deactivate|reactivate
            POST /api/admin/skills   DELETE /api/admin/skills/:id
            POST /api/admin/reports/:id/resolve|dismiss
            POST /api/admin/products/plans|boosts
Billing     GET  /api/billing/catalog | /api/billing/status
            POST /api/billing/subscriptions | /api/billing/boosts
            POST /api/billing/spotlight    POST /api/billing/dev-token (dev only)
Saved       GET|POST /api/saved-matches  DELETE /api/saved-matches/:targetId
Analytics   GET  /api/analytics/profile (Gold/Elite)   POST /api/analytics/profile-view
Referrals   GET /api/referrals   POST /api/referrals/redeem
```

All authenticated endpoints use HTTP-only cookie sessions; ownership and
participant checks are enforced server-side. Subscription tier is **always**
resolved server-side from verified state — the frontend is never trusted.
Free-tier limits return HTTP 402 with a `code` the client turns into a
contextual upgrade screen; existing exchanges and conversations are never
blocked.


```bash
cd server
npx prisma migrate dev --name init     # create schema
npm run db:seed                        # seed 50+ skills, 20 users, demo data
```

## Development

```bash
npm run dev          # runs server (:4000) and client (:5173) together
```

Open http://localhost:5173. Demo logins (after seeding):

- `david@example.com` / `password123`
- `sarah@example.com` / `password123`
- `admin@skillswap.app` / `password123` (admin dashboard at `/admin`)
