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
| Reply classifier, business days, ATS coverage, agent policy, stats, interview prep (`domain/*`) | Pure rule-based logic, no AI calls | 33 more unit tests pass (52 total) |
| Token encryption (AES-256-GCM) | Complete, not yet used (needed for Gmail/Outlook tokens) | 3 unit tests pass |
| API: auth, career profiles, jobs, match, applications, audit, overview | Written | **Not compiled or run** |
| API: inbox, contacts + companies, resumes (analyze/tailor), follow-ups, agent (config/dry-run/drafts), analytics, prep | Written. Syntax-checked with the TypeScript parser only | **Not compiled or run against MongoDB** |
| Web: inbox, contacts, resume studio, follow-ups, AI agent, analytics, interview prep, Kanban board, Ctrl+K palette | Every sidebar item is now a real page. Rendered in headless Chromium with mocked API data, no page errors | Visual check only |
| Web: landing, login, overview (charts), profiles, analyzer, tracker | Light theme, compact. Landing, login and dashboard rendered in headless Chromium with mocked data (no page errors); not built with Next | Visual check only |
| AI extraction | Mock provider (offline heuristics) and OpenAI-compatible provider | OpenAI path **never called** |
| Mail | Mock provider only (never sends real email) | Not run |

Run the verified tests with Node 22 (no install needed):

    cd apps/api && npm test

The remaining code was written in an environment that could not install npm packages, so expect to fix
a few type errors on first `npm run typecheck`. Treat the first build as part of the review.

## Not built yet

Microsoft Graph / Outlook provider, resume file upload/PDF parsing (resumes are pasted
text), automatic HR contact discovery (contacts are entered by you), auto-send by the agent (the agent only creates drafts),
scheduled agent runs and BullMQ/Redis workers, workflow builder, billing and plans (only plan-based limits exist),
organizations/teams, billing admin, notifications, email verification, password reset, MFA, rate limiting, Swagger,
Docker and CI, and the integration/E2E tests.

## Gmail (Email setup)

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GMAIL_REDIRECT_URI` (must equal the redirect URI in Google Cloud), then open
**Email Setup** in the app and connect. Set `MAIL_PROVIDER=gmail` to send real email; the default `mock` never does.
Scopes: `gmail.send` and `gmail.readonly` (replies are read only from threads of applications you sent). Refresh tokens are stored
encrypted (AES-256-GCM). **Not tested against real Google yet.** Google treats `gmail.readonly` as a restricted scope, so a public
launch needs Google's app verification; in Testing mode, add your address as a test user.

## Super admin

`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in `.env` create (or sync) the super admin in MongoDB at API startup; only a bcrypt hash is stored.
Log in with it and you land on **/admin**: platform overview with charts, user management (plan, role, suspend), global audit log and
a system-health page. Role and suspension are read from the database on every request, so a suspension takes effect within seconds.
A single `.env` in the repo root is read by the API. Not run against a real database yet.

**Mailbox** (`/mail`): lists your Inbox / Sent / All mail from Gmail, opens whole conversations as plain text, composes and replies
(real sending needs `MAIL_PROVIDER=gmail`, max 50 a day), and marks sent conversations as *Replied* or *Awaiting reply*.
There is deliberately **no open tracking**: it would need hidden tracking pixels, which are unreliable and invasive.

## Behaviour worth knowing

- A reminder is created 5 business days after a confirmed send, and cancelled when you apply a reply to that application.
- Applying an inbox suggestion walks the status machine one legal step at a time (e.g. applied, hr_replied, interview).
- Tailoring a resume only reorders the existing `Skills:` line into a new copy. It never adds skills.
- The agent starts paused, in manual mode. A live run creates drafts for jobs that pass its rules. Sending still needs your approval.
- Analytics flags any group with fewer than 20 applications as low-sample.

## Known simplifications

- Jobs are stored per user, not as shared canonical records.
- The web app keeps the JWT in `localStorage`; production should use an httpOnly cookie session.
- Charts are small dependency-free SVG components (`apps/web/components/charts.tsx`), not Recharts.
- The dashboard has a clearly labelled "Preview with sample data" toggle; real mode only shows stored records.
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

Defaults: with no `GEMINI_API_KEY` the AI is an offline demo, and `MAIL_PROVIDER=mock` means no email is really sent.

### Gemini AI, job finder and auto-apply
1. Put `GEMINI_API_KEY=...` in `.env` and restart the API. Pick a model under **AI Settings** (the list comes from Google for your key); **Test connection** confirms it works.
2. **Resume Studio -> Upload resume (PDF)**: the AI reads the text; the original PDF is attached to every application email.
3. **Job Finder** searches live openings (Remotive, Arbeitnow, Remote OK, Jobicy: public, key-less APIs), scores them against your profile and writes the email with AI. Postings that list an email can be applied to from the app; others open the company's site (the app cannot fill in third-party web forms).
4. **AI Agent**: Copilot mode prepares AI-written drafts for approval. Autonomous mode + "send emails by itself" + `MAIL_PROVIDER=gmail` sends by itself, but only for jobs that pass every rule (score threshold, verified recipient, daily and per-company caps, run window, send gate). "Hands-off mode" repeats this on a timer while the API runs (`AGENT_AUTORUN=false` disables it).

Status: the Gemini, job-board and auto-send code is covered by unit tests for its pure parts only. It has not been run against the live Google or job-board APIs by the author, so do a first run with Copilot mode and a test recipient.
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
    GET/POST inbox   POST inbox/:id/link | apply   DELETE inbox/:id
    GET/POST contacts   PATCH/DELETE contacts/:id   POST contacts/:id/suppress   GET companies
    GET/POST resumes   GET/DELETE resumes/:id   POST resumes/:id/analyze | tailor
    GET/POST followups   POST followups/:id/done | cancel
    GET/PUT agent   POST agent/pause | resume | stop | run   GET agent/runs
    GET analytics   GET prep/:jobId
