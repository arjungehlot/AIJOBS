# JobPilot AI

AI-assisted job search: analyze a job from text or a screenshot, score it against your profile, draft an
application, approve it, send it through a guarded pipeline, and keep a full audit trail.

Stack: NestJS + Mongoose (MongoDB) API, Next.js 14 (App Router) web app, npm workspaces.

## What works today (and how well it is verified)

| Area | State | Verified |
| --- | --- | --- |
| Scoring engine (`apps/api/src/domain/scoring.ts`) | Complete, explainable, unknown fields excluded not guessed | 7 unit tests pass |
| Job dedupe keys | Complete | 4 unit tests pass |
| Application state machine | Complete; users cannot set system-only states | 5 unit tests pass |
| Token encryption (AES-256-GCM) | Complete, not yet used (needed for Gmail/Outlook tokens) | 3 unit tests pass |
| API: auth, career profiles, jobs, match, applications, audit, overview | Written | **Not compiled or run** |
| Web: login, overview, profiles, analyzer, tracker | Written | **Not compiled or run** |
| AI extraction | Mock provider (offline heuristics) and OpenAI-compatible provider | OpenAI path **never called** |
| Mail | Mock provider only (never sends real email) | Not run |

Run the verified tests with Node 22 (no install needed):

    cd apps/api && npm test

The remaining code was written in an environment that could not install npm packages, so expect to fix
a few type errors on first `npm run typecheck`. Treat the first build as part of the review.

## Not built yet

Gmail and Microsoft Graph providers and OAuth, inbox sync and reply classification, resume upload/parsing/tailoring
(S3), HR contact discovery, follow-ups and interviews, agent runs, workflow builder, BullMQ/Redis workers,
billing and plans (only a plan-based profile limit exists), organizations/teams, admin panel, notifications,
analytics beyond the overview, email verification, password reset, MFA, landing page, rate limiting, Swagger,
Docker and CI, and the integration/E2E tests. The design canvas shows the target screens for several of these.

## Known simplifications

- Jobs are stored per user, not as shared canonical records.
- The web app keeps the JWT in `localStorage`; production should use an httpOnly cookie session.
- Plain CSS with design tokens instead of Tailwind/shadcn; plain `fetch` instead of TanStack Query.
- The daily send limit counts from 00:00 UTC.
- `send_unknown` is handled by `reconcile`, which asks the mail provider; only the mock provider exists so far.

## Run locally

Prerequisites: Node 22, a MongoDB instance (local or Atlas).

    cp .env.example .env          # set MONGODB_URI, AUTH_SECRET, TOKEN_ENCRYPTION_KEY (openssl rand -hex 32)
    npm install
    npm run dev:api               # http://localhost:4000/api/v1/health
    cp apps/web/.env.example apps/web/.env.local
    npm run dev:web               # http://localhost:3000

Defaults are `AI_PROVIDER=mock` and `MAIL_PROVIDER=mock`, so nothing external is called and no email is sent.
`MAIL_MOCK_MODE=reject|unknown` simulates a failed or unconfirmed send so you can see the recovery paths.

## The send gate

`POST /applications/:id/send` refuses unless: the application is approved, the job is active, the recipient is
verified/listed or explicitly confirmed, and the profile's daily limit is not reached. It then atomically claims
`approved -> sending` so two concurrent calls cannot both send, uses a deterministic idempotency key with the
provider, and marks `applied` only after the provider confirms. A timeout becomes `send_unknown`, which can only be
resolved by `reconcile` (look up the message at the provider), never by a blind retry. Every outcome, including
blocked attempts, is written to the append-only audit log.

## API (all under `/api/v1`, Bearer token except auth and health)

    POST auth/register | auth/login      GET auth/me
    GET/POST career-profiles             GET/PATCH/DELETE career-profiles/:id
    POST jobs/analyze | jobs/analyze-screenshot     (extract only, nothing saved)
    GET/POST jobs   GET jobs/:id   POST jobs/:id/match | shortlist | unshortlist
    GET applications   POST applications/drafts   GET applications/:id
    POST applications/:id/approve | send | reconcile   PATCH applications/:id/status   GET applications/:id/activity
    GET overview
