# Changelog

Releases are published from `main` and titled **`Space Works Organization <version>`**. The root `VERSION`
file selects the series; each build is tagged `v<series>-main.<run>.<sha>`, which is what a deployment pins
to. Pushes to `dev` publish staging images tagged `dev` without a release.

## Unreleased

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
