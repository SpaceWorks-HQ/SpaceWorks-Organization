# CLAUDE.md

Guidance for Claude Code (and other agents, via `AGENTS.md`) in this repository.

## Project

**Space Works Organization** is a self-hostable (AGPL-3.0-or-later), multi-tenant platform for running an
organisation's **memberships**: plans, join forms and approvals, members, renewals, payments (Razorpay, Stripe
and offline), GST receipts, ID cards and reports. Organisations are tenants. The platform super-admin creates
them, or reviews the ones that sign up. There are **no events** in this product.

- **Rebuild in progress:** the phased plan is in `docs/plans/2026-10-19-membership-rebuild.md`. Follow it phase
  by phase. Commit each phase once its gates pass.
- **Legacy app:** the old Express + Vite + Supabase app ("Aarannu") lives only in git history, at commit
  `1194cb4` and earlier.

## Stack

- **App framework:** Next.js 16 (App Router, React Server Components, Server Actions), React 19, TypeScript
  strict, with `@/*` as the path alias for the repo root.
- **Data:** PostgreSQL 16 through Prisma 6 (`prisma/schema.prisma`). `DATABASE_URL` is the runtime/pooled
  connection; `DIRECT_URL` is for migrations. `scripts/prisma.mjs` defaults it to `DATABASE_URL`.
- **Services:**
  - Redis (ioredis) for rate limits and pub/sub
  - S3-compatible storage (Silo on a VPS, R2 or any S3 in the cloud)
  - Nodemailer with a database outbox
- **Origins:** platform and ID-card code is derived from SpaceWorks-Events `origin/dev` @ `03186e0`. Copy it from
  there with `git show`, then remove anything event-specific.
- **Design:**
  - **Brand:** SpaceWorks-Design is the only source of brand truth (tokens, logos, fonts).
  - **UX:** Space Works UX, from SpaceWorks-Design `docs/ux-spec.md`.
  - **Buttons and controls:** pill-shaped (`--radius-control: 9999px`).
  - **Fonts:** only the free Gilroy weights (Light 300 for text, ExtraBold 800 for headings), plus Unbounded for
    one accent phrase per layout.
- **Operations:** releases, Actions, installer and compose layout mirror the main SpaceWorks repo (see
  "Operations" below and `docs/DEPLOYMENT_VPS.md`).

## Commands

```bash
npm ci                 # install (runs prisma generate)
npm run dev            # dev server on :3000
npm run lint           # ESLint (next core-web-vitals + typescript)
npm run typecheck      # next typegen + tsc --noEmit
npm run test:unit      # Vitest unit tests (tests/unit)
npm run test:integration   # needs TEST_DATABASE_URL pointing at a disposable Postgres
npm run test:e2e       # Playwright
npm run build          # production build (standalone output)
npm run db:migrate     # create/apply a migration in development
npm run db:deploy      # apply migrations
```

Operations (bash; see `docs/DEPLOYMENT_VPS.md`, `docs/DEPLOYMENT_CLOUD.md`, `docs/CONFIGURATION.md`):

```bash
bash setup.sh [--build]                                  # guided install from a checkout (setup.ps1 on Windows)
scripts/spaceworks-compose.sh bundled up -d              # the only way to run docker-compose.prod.yml
scripts/spaceworks-compose.sh bundled run --rm ops       # operator checks
scripts/spaceworks-compose.sh cloud up -d                # docker-compose.cloud.yml with /etc/spaceworks-organization/cloud.env
bash scripts/update.sh --force [--version V | --rollback]
bash scripts/backup.sh && bash scripts/restore.sh backups/<dump>.sql.gz [--with-storage]
SWO_COMPOSE_BUILD_LAYER=1 bash scripts/compose-smoke.sh  # bundled stack end to end (disposable)
```

Run one unit test file:

```bash
npx vitest run tests/unit/health.test.ts
```

## Conventions

- **Tenant isolation is enforced in the application** (there is no RLS):
  - Every tenant row carries `organisationId`, with composite FKs to its parent.
  - Every query is scoped through the organisation resolved for the request.
  - Cross-tenant access returns 404.
- **Money:**
  - Amounts are integer paise.
  - Receipt numbers are gapless per organisation per financial year (April–March, in the organisation's timezone).
  - Paid rows are never edited or deleted; reverse them with credit notes.
- **File size:** no source file over 300 lines (owner rule). Split by responsibility; `tests/unit/file-length.test.ts` enforces it, skipping generated files.
- **Operations:**
  - Two images from one `Dockerfile`: `spaceworks-organization-backend` (`runner`; every backend role through
    `scripts/docker-entrypoint.sh --role backend|migrate|scheduler|ops`) and `spaceworks-organization-frontend`
    (`frontend`). Public origins are placeholders replaced at start; never bake an installation's key or origin.
  - Periodic work belongs in `runOutboxScheduler` (`lib/outboxWorker.ts`); Compose stacks run it from the
    `scheduler` role (`SCHEDULER_MODE=external`).
  - Every new environment variable goes into `.env.example`, `.env.production.example`, the compose
    `x-app-env` blocks and `docs/CONFIGURATION.md`.
  - Shell scripts are bash or POSIX sh, LF, and pass `shellcheck -S warning -x`. Host files an update must
    replace are listed in `scripts/install-host-bundle.sh`.
- **Copy:** sentence case, en-GB, buttons named after their action, and no "Oops" or exclamation marks on errors.
- **Line endings:** LF everywhere (see `.gitattributes`). Never commit `.env*` files except the `*.example` ones.
- **Commit trailers:**
  ```
  Co-Authored-By: Shaan-Shoukath <shaanshoukath4522@gmail.com>
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
