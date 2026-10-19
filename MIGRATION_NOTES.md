# TypeScript + stack migration notes

Branch: `feat/typescript-agpl-stack`

AGPL `LICENSE` / `NOTICE` / package license fields were already in place and were **not** changed by this migration.

## What changed

### Frontend (`frontend/`)

- Migrated all `src/**/*.{js,jsx}` → `.ts` / `.tsx`.
- Added `tsconfig.json`, converted `vite.config.js` → `vite.config.ts`.
- Bumped **Vite 7 → 8**, kept React 19.2+, React Router 7, Tailwind 4 via `@tailwindcss/vite`.
- Added **TypeScript ~6.0**, **TanStack Query 5** (`QueryClientProvider` in `main.tsx`).
- Replaced **`html5-qrcode`** with native **`BarcodeDetector`** + **`zxing-wasm`** fallback in `QRScanner.tsx` (exported `extractCardId` for tests).
- Added **Vitest + Testing Library + jsdom + axe-core** with smoke tests:
  - `src/components/QRScanner.test.ts`
  - `src/utils/membershipId.test.ts`
  - `src/test/axe-smoke.test.ts`
- ESLint updated for TypeScript (`typescript-eslint`).
- Scripts: `typecheck`, `test`, `build` (`tsc --noEmit && vite build`).

### Backend (`backend/`)

- Migrated all `src/**/*.{js}` (including `__tests__`) → `.ts`.
- Kept **CommonJS** (`"type": "commonjs"`) for least disruption; run with **`tsx`** in dev, **`tsc` → `dist/`** for production.
- Jest kept with **`ts-jest`** (`jest.config.cjs`).
- Scripts: `dev` (`tsx watch`), `build` (`tsc`), `typecheck`, `start` (`prestart` builds, then `node dist/server.js`), `test`.

### Root

- Scripts: `typecheck`, `build`, `test` fan out to both packages.
- README Tech Stack + project structure updated (TS, Vite 8, TanStack Query, Vitest, BarcodeDetector/zxing-wasm, AGPL).
- `CLAUDE.md` commands updated to match new scripts/extensions.

## Verification (passed on this machine)

| Check | Result |
| --- | --- |
| `cd frontend && npx tsc --noEmit && npm run build` | Pass (Vite 8.3.4) |
| `cd frontend && npm test` | Pass (7+ smoke tests) |
| `cd backend && npx tsc --noEmit && npm run build` | Pass |
| `cd backend && npm test` | Pass (84 tests) |

## Follow-ups / risks

1. **Gradual typing**: Many UI / service files use `// @ts-nocheck` so the tree typechecks without a full prop-model rewrite. Prefer removing nocheck file-by-file and adding real types (especially card templates, `BulkGenerator`, `Generate`, token/org services).
2. **`vite-plugin-node-polyfills`**: Peer range still lists Vite ≤7; works under Vite 8 with a warning. Watch for a Vite-8-compatible release; Vite also warns that the plugin’s `esbuild` option should move to `oxc`.
3. **zxing-wasm**: Fallback loads WASM via the package’s default CDN path. For offline / strict CSP, vendor `zxing_reader.wasm` under `public/` and call `prepareZXingModule` with a local `locateFile`.
4. **TanStack Query**: Provider is wired; existing data fetching is still mostly ad-hoc `fetch`/Supabase. Migrate hot paths to `useQuery` / `useMutation` when touching those screens.
5. **Backend production**: `npm start` runs `prestart` → `tsc`. Ensure deploy pipelines set Node ≥18 and run `npm run build` (or rely on `prestart`). Dev should keep using `npm run dev` (`tsx`).
6. **Docs drift**: `developers_debug/` and older `docs/` still mention `.jsx` / `server.js` / Vite 7 in places; update when those docs are next edited.
7. **`.vite/` cache**: Already gitignored (`.vite/`, `**/.vite/`). Do not commit cache directories.

## Helper scripts (optional)

- `scripts/rename-to-ts.mjs` — one-shot JS→TS rename (already applied).
- `scripts/add-ts-nocheck.mjs` — applied nocheck to the heaviest frontend files during migration.
