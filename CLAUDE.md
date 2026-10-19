# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SpaceWorks-Organization** — Self-hosted platform for generating, managing, and distributing digital identity cards within communities and organizations. Monorepo with a React 19 + TypeScript frontend and Express 5 + TypeScript backend, both using Supabase as the database/auth/storage layer. Licensed under AGPL-3.0-or-later. (Formerly Aarannu.)

## Commands

### Development

```bash
# Run both frontend and backend concurrently (from root)
npm run dev

# Run individually
npm run dev:backend     # Express via tsx watch on :5000
npm run dev:frontend    # Vite 8 dev server on :5173

# Install all dependencies
npm run install:all

# Typecheck / build / test both packages
npm run typecheck
npm run build
npm run test
```

### Backend

```bash
cd backend
npm run dev         # tsx watch src/server.ts
npm run build       # tsc → dist/
npm start           # builds then runs node dist/server.js
npm run typecheck   # tsc --noEmit
npm test            # Jest + ts-jest --verbose --forceExit
```

### Frontend

```bash
cd frontend
npm run dev         # Vite 8 dev server
npm run build       # tsc --noEmit && vite build → dist/
npm run typecheck   # tsc --noEmit
npm run preview     # Preview production build
npm run lint        # ESLint (typescript-eslint)
npm test            # Vitest run
```

### Running a Single Backend Test

```bash
cd backend
npx jest --verbose --forceExit src/__tests__/<filename>.test.ts
```

### Running a Single Frontend Test

```bash
cd frontend
npx vitest run src/path/to/file.test.ts
```

## Environment Setup

Copy `.env.example` files in both `backend/` and `frontend/` before starting:

**Backend** (`backend/.env`): Supabase URL + anon key + service role key, PORT (5000), CORS_ORIGIN, FRONTEND_URL (for Puppeteer), BREVO email config, ADMIN_USER_IDS (comma-separated UUIDs).

**Frontend** (`frontend/.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (backend URL), bulk generation limits (`VITE_BULK_DAILY_LIMIT=200`, `VITE_BULK_MAX_QUEUE=500`).

Database schema and Supabase setup: follow `SUPABASE_SETUP.md`.

## Architecture

### Backend (`backend/src/`)

Follows a **Routes → Controllers → Services** layered pattern. Sources are TypeScript (CommonJS runtime via `tsx` / `tsc`).

**Middleware pipeline** (applied in order):
```
helmet → cors → JSON (10MB) → rateLimiter → verifyToken →
checkApproval → checkOrgRole → checkPlanLimits → checkTokens → Controller
```

- `middleware/verifyToken.ts` — JWT verification via Supabase
- `middleware/checkTokens.ts` — Token balance check; returns 402 if insufficient (1 token = 1 card)
- `middleware/checkApproval.ts` — Blocks unapproved members
- `middleware/checkOrgRole.ts` — Org-level RBAC
- `middleware/errorHandler.ts` — Centralized error handling

**Key services**:
- `services/supabaseService.ts` — All DB operations
- `services/tokenService.ts` — Token wallet CRUD and analytics
- `services/cardRenderer.ts` — Puppeteer-based server-side card rendering (navigates to `FRONTEND_URL/render-card`)
- `services/storageService.ts` — Signed URL generation (1-hour TTL) for private Supabase Storage

**Automated cleanup**: Runs every 6 hours, deletes expired card records and their storage files.

### Frontend (`frontend/src/`)

React 19 SPA using React Router v7, TypeScript, and TanStack Query (`QueryClientProvider` in `main.tsx`).

**Route structure**:
- Public: `/login`, `/signup`, `/register/:projectId`, `/verify/:cardId`, `/render-card`
- Protected (legacy): `/dashboard`, `/templates`, `/generate`, `/tokens`, `/tokens/purchase`
- Protected (SaaS): `/org/new`, `/org/:slug/dashboard`, `/org/:slug/project/new`, `/org/:slug/project/:projectId`, `/org/:slug/bulk/:projectId`

**Card templates** (in `components/`): `IDCard.tsx` (geometric custom), `CorporateCard.tsx` (red+blue gradient), `EventCard.tsx` (dark royal), `StudentCard.tsx` (modern academic)

**QR scanning**: `QRScanner.tsx` uses native `BarcodeDetector` when available, with `zxing-wasm` fallback (replaces `html5-qrcode`).

**Card generation flow**:
1. User fills `MemberForm.tsx` or imports from Google Sheets via CSV/API
2. Card rendered client-side using html2canvas (2x scale) for preview
3. Downloads: PDF (jsPDF, 2-page front+back), JPEG, or PNG
4. Bulk: generates PNGs → uploads to Supabase Storage → sends ZIP to user

**Key utilities**:
- `utils/pdfCardRenderer.ts` — Client-side PDF generation
- `utils/downloadHelpers.ts` — `canvasesToPdfBlob()`, `downloadBlob()`, blob-to-format converters
- `lib/proxyImage.ts` — Rewrites Google Drive URLs through backend proxy to bypass CORS
- `lib/supabaseClient.ts` — Singleton Supabase client

**Styling**: Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin, no `tailwind.config.js`).

**Node polyfills**: `vite-plugin-node-polyfills` is used because `pdfkit` and similar Node-only libraries are imported client-side. (Peer warning vs Vite 8 is currently tolerated.)

### Supabase Integration

Both frontend (anon key, RLS-enforced) and backend (service role key, bypasses RLS) connect to the same Supabase project. The backend uses the service role key exclusively for admin operations — it is never exposed to the frontend.

Key tables: `members`, `generated_ids`, `organizations`, `projects`, `project_members`, `token_wallets`, `token_transactions`.

## Developer Documentation

Extensive markdown docs live in:
- `backend/docs/` — Architecture, DB schema, auth, RLS, storage, token system, custom forms, Google Sheets integration
- `SUPABASE_SETUP.md` — Full one-time setup guide for Supabase (tables, RLS, storage buckets, auth)
- `MIGRATION_NOTES.md` — TypeScript / stack migration notes and follow-ups

## Configurable Limits

| Limit | Default | Config |
|---|---|---|
| Daily uploads | 200 | `VITE_BULK_DAILY_LIMIT` |
| Queue size | 500 | `VITE_BULK_MAX_QUEUE` |
| API batch size | 50 | `BULK_BATCH_LIMIT` |
| General rate limit | 100/15m | `rateLimiter.ts` |
| Auth rate limit | 20/15m | `rateLimiter.ts` |
| Image proxy cap | 10 MB | `proxyRoutes.ts` |
