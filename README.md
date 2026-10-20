<div align="center">

  <h1>Space Works Organization</h1>

<p>
  Self-hostable, multi-tenant <strong>membership platform for organisations</strong>: plans, join forms and
  approvals, members, renewals, online and offline payments, GST receipts, ID cards and reports, in one place.
</p>

<p>
  <a href="LICENSE"><img alt="License: AGPL-3.0-or-later" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg"></a>
  <a href="https://github.com/SpaceWorks-HQ/SpaceWorks-Organization/actions/workflows/release.yml"><img alt="Release" src="https://github.com/SpaceWorks-HQ/SpaceWorks-Organization/actions/workflows/release.yml/badge.svg?branch=main"></a>
  <img alt="Stack" src="https://img.shields.io/badge/stack-Next.js%2016%20%C2%B7%20React%2019%20%C2%B7%20PostgreSQL%2016-0b7285.svg">
</p>

</div>

---

Space Works Organization is for the secretaries, treasurers and committee members who run a club, association,
society or alumni body by hand today: spreadsheets of members, UPI screenshots and paper receipts. It gives them
a calm place to take members, collect fees, issue receipts and cards, and see who has lapsed. It is built for
Indian organisations first (GST-correct receipts, the April–March financial year, UPI-friendly offline payments)
and is part of the [Space Works](https://github.com/SpaceWorks-HQ/SpaceWorks) family.

One deployment hosts **many organisations** (tenants). Each owns its plans, members, money and pages, fully
isolated from the others. Organisations apply at `/start` and a platform admin reviews them, or the platform
admin sets one up directly and invites its owner.

> **Status:** being rebuilt phase by phase. See
> [`docs/plans/2026-10-19-membership-rebuild.md`](docs/plans/2026-10-19-membership-rebuild.md).

## Features

- **Plans and periods**: fixed or rolling membership plans, prices in integer paise, early and late renewals
  with grace periods, and an automatic membership sweep that moves members through their lifecycle.
- **Join forms and approvals**: public join pages per organisation, invitations, approvals and CSV or Google
  Sheets import.
- **Payments**: Razorpay, Stripe and offline payments with maker-checker confirmation. Gateway keys are
  encrypted at rest (`PAYMENT_SECRETS_KEY`).
- **GST receipts**: gapless receipt numbers per organisation per financial year; paid rows are never edited,
  only reversed with credit notes.
- **Member ID cards** with QR verification, and a member portal for receipts, cards and renewals.
- **Reports** for the platform, each organisation and each member.
- **Units**: districts, chapters or branches with their own managers.
- **Sign-in**: email and password with optional authenticator MFA, plus Google, GitHub and Apple. Each provider
  is switchable at install time or later in Super admin → Settings.
- **Operable in production**: TLS between every service, a least-privilege database role, a scheduler for the
  email outbox and membership sweep, scheduled backups, health and readiness endpoints, and an operator check.

## Quick start

### Install in one line

On a 64-bit Linux server (or macOS / Windows with Docker Desktop running), as a user with `sudo`:

```bash
curl -fsSL https://raw.githubusercontent.com/SpaceWorks-HQ/SpaceWorks-Organization/main/install.sh | bash
```

It asks every question first, shows a summary, and changes nothing until you confirm. Run the same command
again later to update, back up or roll back. Details, requirements and options follow below.

### Full install guide

Everything runs through Docker Compose: **PostgreSQL 16, Redis 7 and Silo object storage** (the maintained,
S3-compatible fork of the archived MinIO), each speaking TLS signed by the install's own private CA, plus the
**migrations, the app, the scheduler, scheduled backups and the Caddy web edge**. Every application process
runs from one published image, `ghcr.io/spaceworks-hq/spaceworks-organization-backend`, in a different role.

**Before you start, you need:**

- a 64-bit (x86_64 or arm64) Linux server (Debian/Ubuntu, Fedora/RHEL/Alma/Rocky, Arch or openSUSE), macOS, or
  Windows Git Bash/WSL with Docker Desktop;
- on Linux, root or a user with `sudo`: the installer installs Docker, Docker Compose and curl after
  confirmation; curl (or wget) and tar must already exist;
- internet access to `github.com` and `ghcr.io`, and at least 8 GiB free disk;
- for HTTPS, a domain whose DNS points at the server, with ports 80 and 443 open;
- an SMTP relay on a verified sending domain (Brevo, Amazon SES, Postmark…) and your super-admin email.

All deployment decisions come first, in this order:

1. **GitHub repository** to install and update from (`SpaceWorks-HQ/SpaceWorks-Organization`, or your fork).
2. **Website here?** Yes (default), or backend only with the website on Netlify
   ([docs/DEPLOYMENT_NETLIFY.md](docs/DEPLOYMENT_NETLIFY.md)).
3. **HTTPS:** plain HTTP for a LAN or trial (default), automatic HTTPS with Caddy and Let's Encrypt (domain and
   certificate email), or an existing reverse proxy forwarding to `127.0.0.1:8080`. A Netlify backend requires
   HTTPS.
4. **Storage:** bundled Silo (default), or an external S3-compatible bucket (endpoint, region, bucket, keys).
5. **Super-admin email**, then **email**: sender, SMTP host, port, login and password.
6. **Sign-in options** besides email and password: Google, Apple, GitHub as a comma list, or none. Google and
   GitHub ask for their client ID and secret (blank adds them later); Apple is set up in Super admin → Settings.
7. **Install a GitHub Actions runner on this server for automatic deploys? [y/N]** (Linux with systemd only).

Enter accepts each displayed default; invalid answers are asked again. One summary shows every choice, the
services and host actions before **Proceed? [Y/n]**. Answering no leaves the install directory absent. Secrets
(database, Redis, storage and application keys, including `PAYMENT_SECRETS_KEY`) are generated, saved in the
install's owner-only `.env`, and never printed. Production contains no demo or example data.

**One command for everyone, forks included.** Pass a fork up front to skip the repository question:

```bash
curl -fsSL https://raw.githubusercontent.com/SpaceWorks-HQ/SpaceWorks-Organization/main/install.sh | bash -s -- --repo YourName/SpaceWorks-Organization
```

A fork must have published a release first (run its **Continuous Release** workflow on `main` once) and its
`spaceworks-organization-backend` package must be public. Run the installer as your normal user (it asks for
`sudo` when needed and adds you to the `docker` group), or with `curl … | sudo bash` to keep the install owned
by root. It installs to `/opt/spaceworks-organization`; set `SWO_DIR` on the `bash` side of the pipe to change
that. `bash install.sh --help` prints the checklist without changing anything.

Run the same curl command later and an existing install shows a menu:

1. **Update to the latest release**: backs up the database, moves to the newest main release, runs
   migrations and restarts.
2. **Back up now**: the database, the uploaded files and the settings, into `backups/`.
3. **Roll back to the previous release**: the release that ran before the last update.
4. **Cancel** (the default).
5. **Install or re-register the GitHub Actions runner.**

**Desktop or local install.** From a checkout: `bash setup.sh` (Linux, macOS, Git Bash) or
`powershell -ExecutionPolicy Bypass -File setup.ps1` (Windows with Docker Desktop). Add `--build` to build the
image from source instead of pulling it.

### Updating

Every merge to `main` builds a release: `.github/workflows/release.yml` runs the tests, publishes the images
and a GitHub release titled `Space Works Organization <VERSION>` and tagged `v<VERSION>-main.<run>.<sha>`,
then promotes the images to `latest`. Pushes to `dev` publish images tagged `dev` for staging, never `latest`.

#### Automatic deploys with GitHub Actions

A runner on your server receives a `deploy` job after each release and runs the updater locally; nothing is
pushed into the server and no port is opened. Answer yes during setup, or run `bash scripts/install-runner.sh`
as the install owner (it asks for a short-lived registration token from the repository's
**Settings → Actions → Runners**). Then add the repository variable `SWO_DEPLOY=true`, require approval for
fork workflows, and protect `main`. The deploy job runs:

```bash
bash "$SWO_DIR/scripts/update.sh" --force --version <that release>
```

#### Manual updates

```bash
bash scripts/update.sh --force
# Or deploy an exact published main release:
bash scripts/update.sh --force --version 0.1.0-main.42.a1b2c3d4e5f6
# Return to the release that ran before the last update:
bash scripts/update.sh --rollback
```

The updater locks, dumps PostgreSQL to `backups/pre-update-*.sql.gz`, downloads the target release, installs
its host files (keeping the replaced ones in `backups/host-config-*`), pulls the pinned images, runs
migrations, waits for every service to be healthy, runs the operator checks and records `.spaceworks-version`.
A failed update restores the previous host files and images automatically. Forward migrations stay applied; to
return the data as well, restore the pre-update dump with `bash scripts/restore.sh backups/<dump>.sql.gz`.

### SECURITY

This repository is public. A self-hosted runner controls Docker, effectively root on the server: require
approval for **all external contributors'** workflow runs, restrict the runner to this repository, never add
its label to a `pull_request` workflow, and keep runner auto-updates on. See [docs/SECURITY.md](docs/SECURITY.md).

## Cloud mode

Run the app and scheduler on any Docker host with managed PostgreSQL, Redis (TLS), S3/R2 and SMTP:

```bash
sudo install -D -m 600 .env.production.example /etc/spaceworks-organization/cloud.env   # then fill it in
scripts/spaceworks-compose.sh cloud up -d
```

Or use the Render Blueprint in [`render.yaml`](render.yaml). See [docs/DEPLOYMENT_CLOUD.md](docs/DEPLOYMENT_CLOUD.md).

## Website on Netlify

The website can render on Netlify while every database, payment and email operation stays on your server.
Choose "backend only" in the installer, then follow [docs/DEPLOYMENT_NETLIFY.md](docs/DEPLOYMENT_NETLIFY.md).
The same website also ships as a container, `ghcr.io/spaceworks-hq/spaceworks-organization-frontend`.

## Documentation

- [Deploying on a server (VPS)](docs/DEPLOYMENT_VPS.md): installer, layout, backups, restore, update and rollback
- [Deploying with managed services (cloud)](docs/DEPLOYMENT_CLOUD.md)
- [Website on Netlify (split hosting)](docs/DEPLOYMENT_NETLIFY.md)
- [Configuration reference](docs/CONFIGURATION.md): every environment variable
- [Architecture](docs/ARCHITECTURE.md) and [security](docs/SECURITY.md)
- [Design](docs/DESIGN.md)

## Development

Node 22 and Docker:

```bash
cp .env.example .env
docker compose up -d        # PostgreSQL and Redis for development
npm ci
npm run db:migrate
npm run dev                 # http://localhost:3000
```

`npm run lint`, `npm run typecheck`, `npm run test:unit` and `bash scripts/compose-smoke.sh` (the bundled stack
end to end) are what CI runs. See [CLAUDE.md](CLAUDE.md) for conventions.

## License

[GNU Affero General Public License v3.0 or later](LICENSE). See [NOTICE](NOTICE) for attribution.
