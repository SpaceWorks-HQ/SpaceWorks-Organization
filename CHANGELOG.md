# Changelog

Releases are published from `main` and titled **`Space Works Organization <version>`**. The root `VERSION`
file selects the series; each build is tagged `v<series>-main.<run>.<sha>`, which is what a deployment pins
to. Pushes to `dev` publish staging images tagged `dev` without a release.

## 0.5.0 (2026-10-20)

The first release of the rebuilt platform.

- **Organisations as tenants.** Apply-and-review or platform-created organisations, several managers each,
  units (regions, districts, chapters) with unit-scoped managers, organisation-defined member roles, public
  listing and a customisable public page.
- **Memberships.** Plans with fixed, rolling, financial-year and lifetime terms; open, approval, invite-only
  and free joining; renewals with grace and reminders; CSV and Google Sheets import; member directory and export.
- **Payments.** Razorpay and Stripe on each organisation's own account, offline payments with maker-checker,
  members' "I've paid" UTR claims, refunds, and GST tax invoices, bills of supply, receipts and credit notes
  with gapless numbering; multiple currencies.
- **Member cards.** Designed per organisation or plan, issued on activation, PDF and PNG, with a live
  `/verify` page; bulk exports.
- **Member portal.** One wallet across organisations, pay, renew and leave, receipts, cards, profile,
  consent, data export and erasure requests.
- **Reports.** Membership, renewals, applications, money, tax (GSTR-1 tables and JSON, GSTR-3B), subscription
  income by financial year, platform reports, a daily rollup and a monthly summary email.
- **Sign-in.** Email and password, Google, GitHub and Apple; two-step verification for platform admins.
- **Patch**, the Space Works mascot, and a few easter eggs.


- **Deployment parity with SpaceWorks (P10).** One-line `curl … install.sh | bash` installer with `--repo`,
  `setup.sh`/`setup.ps1`, `scripts/update.sh` (pre-update `pg_dump`, `--version`, `--rollback`, automatic
  rollback of a failed update), `scripts/spaceworks-compose.sh bundled|cloud`, `docker-compose.prod.yml` with
  TLS-only PostgreSQL 16 (owner and least-privilege runtime roles), Redis 7 and Silo, a scheduler, scheduled
  backups and `scripts/restore.sh`, `docker-compose.cloud.yml`, `render.yaml`, and a Continuous Release
  workflow publishing `spaceworks-organization-backend` and `-frontend` to GHCR. The backend image runs every
  role (`--role backend|migrate|scheduler|ops`). New settings: `PAYMENT_SECRETS_KEY`, `SCHEDULER_MODE`,
  `ALLOW_PLAIN_HTTP`. CI is now `tests.yml` (with shellcheck, Compose validation and a bundled-stack smoke
  test) plus `security-audit.yml`.
- Rebuilt as a Next.js 16 membership-management platform for organisations. The legacy Express + Vite + Supabase
  app is kept in git history (commit `1194cb4`). The plan is in `docs/plans/2026-10-19-membership-rebuild.md`.
