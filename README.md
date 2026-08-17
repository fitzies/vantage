# Vantage

Vantage is a self-hosted, multi-project product analytics workspace. It gives an operator one place to ingest events from web and mobile apps, inspect recent activity, and share project-level dashboard access without sending analytics data to a third-party analytics service.

## Notable features

- Write-key-based JSON event ingestion, including batches of up to 100 events
- Idempotent retries when clients provide an `event_id`
- Per-project 24-hour summaries, event and session charts, top events, page or screen aggregates, and a recent event feed
- Email/password dashboard authentication with owner/viewer project memberships and invitations
- Browser/Next.js, Expo/React Native, and Swift tracking clients
- Optional Telegram summaries

## Architecture and stack

Vantage is a pnpm workspace built with TypeScript, Next.js 16 App Router, React 19, Tailwind CSS 4, Base UI/shadcn components, Better Auth, PostgreSQL, Drizzle ORM, and the Neon serverless PostgreSQL driver. The Next.js app owns the authenticated dashboard and `/api/events` ingestion endpoint. Events are stored in an append-only PostgreSQL table and dashboard views are computed with SQL at read time.

## Repository map

- `src/app/` — Next.js pages, dashboard, server actions, and API routes
- `src/lib/` — environment validation, database access, auth, ingestion, projects, and Telegram summaries
- `drizzle/` — committed PostgreSQL migrations
- `packages/vantage-tracker/` — browser and Next.js tracker
- `packages/vantage-expo/` — Expo/React Native tracker
- `sdks/vantage-swift/` — Swift package
- `scripts/` — operator utilities

## Prerequisites

- Node.js 20.9 or newer
- pnpm
- A PostgreSQL database reachable through `DATABASE_URL` or `POSTGRES_URL`

## Local setup

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# Edit .env.local with local credentials.
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. `BETTER_AUTH_SECRET` must contain at least 32 characters. On a new, empty database the first account can sign up; `BOOTSTRAP_OWNER_EMAIL` is available for an existing project database that has no memberships yet. Telegram variables are optional unless the Telegram routes are used.

## Database migrations

Committed migrations are applied with:

```bash
pnpm db:migrate
```

After an intentional schema change, generate and review a new migration before applying it:

```bash
pnpm exec drizzle-kit generate
pnpm db:migrate
```

Drizzle CLI commands load `.env.local` and require `DATABASE_URL` or `POSTGRES_URL`.

## SDKs and integrations

- [Integration and HTTP API guide](./INTEGRATION.md)
- [Browser and Next.js tracker](./packages/vantage-tracker/README.md)
- [Expo/React Native tracker](./packages/vantage-expo/README.md)
- [Swift tracker](./sdks/vantage-swift/README.md)

## Privacy and security

The self-hosting operator controls the database and is responsible for access, retention, backups, and compliance. Collect only data that is necessary, and avoid unnecessary personally identifiable information in event names, identifiers, URLs, and properties.

Project write keys are public identifiers intended to be embedded in client applications; they are not secrets and do not authorize dashboard access. Anyone who obtains a write key can submit events for that project and pollute its analytics data. Operators should account for that abuse risk when exposing an ingestion endpoint.

## Project status

This is a pre-1.0 portfolio project. Its interfaces and schema may change, and the repository does not imply a supported hosted service or production deployment.

## Source availability and rights

The source is visible for portfolio presentation and code review only. No open-source or reuse license is granted. No permission is given to copy, modify, distribute, or reuse this code; all rights are reserved.
