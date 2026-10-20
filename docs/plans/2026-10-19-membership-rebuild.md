# SpaceWorks Organization rebuild plan (v5: membership-only, multi-tenant; independent review APPROVED after 3 rounds)

## Product
SpaceWorks Organization is a self-hostable (AGPL), multi-tenant platform for **managing organisations and their memberships**.

**Platform super-admin**
- Adds organisations directly, or reviews organisations that sign up.
- Suspends and archives organisations.
- Sees the platform reports.

**Organisation managers.** An organisation can have several, each with a role: OWNER, ADMIN, TREASURER or VIEWER. They run:
- plans and join forms
- approvals
- members and renewals
- payments, including offline ones
- GST receipts
- ID cards
- reports

**Members**
- Join and pay, then renew.
- Download their card and receipts.
- Manage their profile and consent.

**Scope limits**
- No events of any kind.
- From SpaceWorks-Events we take only the ID-card generation setup and the platform layer.
- Claude does all the work and all the reviews. Codex is not used.

## Owner decisions so far
- **Stack:** the same as Events. Next.js 16 App Router, React 19, TS strict, Prisma 6 with Postgres 16, Auth.js v5, Redis (ioredis), Silo (S3-compatible) storage, Nodemailer with a DB outbox, Tailwind 4, Radix, lucide, Vitest and Playwright.
- **Infra:** SpaceWorks style.
  - VPS: a one-line install of Postgres, Redis and Silo behind Caddy.
  - Cloud: managed services.
- **Brand:** SpaceWorks-Design is the source of truth.
  - Use `tokens/tokens.css`, Gilroy with one Unbounded phrase, and the `.dark` class.
  - No System theme.
- **UX:** Space Works UX (SpaceWorks-Design `docs/ux-spec.md`, inspired by Yuyu).
- **Data:** no data migration from the old Supabase app, because it has no users.
- **First step:** commit the uncommitted JS->TS migration on `feat/typescript-agpl-stack` as a checkpoint.

## Research basis
- **SpaceWorks (Django) membership and payments**
  - Plans: interval, renewal window, grace days and reminder days.
  - Terms: one row per period, linked through `renewed_from`.
  - Admission settings:
    - `JoinMode` (open, approval, invite_only, closed)
    - `PaymentTiming` (BEFORE_ACTIVATION; AFTER = "activate, then charge")
    - joining fee, with `RejoinRule` ONCE or EACH_JOIN
  - Charges are one-off per period; saved cards are never charged automatically.
  - Each tenant has its own Razorpay or Stripe keys.
  - Offline settlement methods, append-only refunds with a status, and numbered receipts and credit notes.
  - There is no tenant application flow.
- **Market and reports research**
  - Four duration types, separate new and renewal prices, a joining fee, and grace days per plan.
  - Status is derived from dates.
  - Offline payments are essential.
  - Online payments go to the organisation's own gateway account, so the platform is never merchant of record.
  - Receipt numbers are gapless per organisation per financial year (Apr–Mar), at most 16 characters (Rule 46(b)).
  - GST is configurable per organisation.
  - Every period is stored as its own row and every transition is logged, so reports are exact and support drill-down.
- **Events code map (origin/dev 03186e0)**
  - Member IDs depend on the event badge engine.
  - About 37 platform files import event code.
  - 61 of 62 pages load their data through `lib/views/*`.
  - All 24 server actions use `lib/frontend/revalidation`.
  - Tenancy is path-based and scoped in the application.

## Approach: fresh scaffold, then copy modules in
- Copy files from `git show origin/dev:<path>`.
- Add Events as the git remote `events-upstream`.
- Record the source SHA and the Events and Yuyu attribution in the existing `NOTICE`, which gets updated rather than replaced.
- Rename `swe`/`SWE_`/`swevents` to `swo`/`SWO_`/`sworg`.
- **No split-frontend layer.** Every ported page's loader is rewritten as a plain server-side data function in `lib/data/*`. `trackedRevalidation` becomes `revalidatePath`/`revalidateTag`.
- **Pin dependency versions explicitly** in `package.json` (latest stable Next 16.x and React 19.x). Do not rely on the Events `chore/update-deps` branch, which exists only locally.

## Domain model (fresh `schema.prisma`, one baseline migration)

### Structural isolation rules
- Every tenant parent has `@@unique([id, organisationId])`.
- Every tenant child carries `organisationId` with a **composite FK** to its parent. This applies to:
  - PlanField
  - Member
  - MembershipTerm
  - TermStatusEvent
  - MemberCard
  - ConsentRecord
  - Payment
  - PaymentLine
  - Refund
  - TaxDocument
  - DocumentCounter
- Cross-tenant access returns 404.

### Platform (ported and de-evented)
- `User`, `Account`, `Session`, `VerificationToken`, MFA
- `AuditEvent`, `OutboxMessage`, `OperationalHeartbeat`, `InstanceSetting`, `Asset`, `ApiClient*`
- **Super-admins:** a DB flag `User.isSuperAdmin`, plus `SUPER_ADMIN_EMAIL` to bootstrap the first one, so there can be several. The super-admin MFA step-up stays.

### Tenant
- **`Organisation`**
  - Profile: `slug`, name, type, contact, address and `stateCode`, logo, accent colour.
  - `status`: `PENDING_REVIEW | CHANGES_REQUESTED | ACTIVE | REJECTED | SUSPENDED | ARCHIVED`
  - `source`: `SELF_SIGNUP | SUPERADMIN`
  - `financialYearStartMonth` (default 4), `timezone` (default Asia/Kolkata), `currency` (INR).
  - `memberLimit` and `managerLimit`.
  - `offlineConfirmationRequired` (a maker-checker toggle).
- **`OrganisationReview`**
  - Append-only.
  - `action`: SUBMITTED, APPROVED, REJECTED, CHANGES_REQUESTED, RESUBMITTED, SUSPENDED, REACTIVATED, ARCHIVED
  - Also stores the actor, a reason, and an `applicationSnapshot Json` taken at every submit.
- **`TeamMember`** (userId, organisationId, `role TeamRole {OWNER, ADMIN, TREASURER, VIEWER}`) and **`TeamInvite`**.

### Membership
Named `MembershipTerm` because Events' `Membership` is the team table.

- **`MembershipPlan`**
  - Duration: `durationType {ROLLING, ORG_YEAR, FIXED_END, LIFETIME}`, with `durationMonths`, `rolloverMonthDay` or `fixedEndDate`.
  - Prices: `priceNewPaise`, `priceRenewalPaise`, `joiningFeePaise`.
  - `rejoinFeeRule {NEVER, ONCE, EACH_JOIN, AFTER_LAPSE}` plus `rejoinAfterDays Int?` (used by AFTER_LAPSE)
  - Renewal: `graceDays`, `renewalWindowDays`, `reminderDaysBefore Int[]` (default [30,7,0]), `reminderDaysAfter Int[]` (default [7]), and `lateRenewalBackdate`.
  - `joinMode {OPEN, APPROVAL, INVITE_ONLY, CLOSED}`
  - `paymentTiming`:
    - `PAY_THEN_ACTIVATE`: the term activates when it is paid.
    - `ACTIVATE_THEN_CHARGE`: the term activates on approval, and an unpaid charge stays outstanding.
  - Card settings: `cardDesign Json`, `cardPrefix`, `watermarkUrl`.
  - Archived, never deleted, once it has members.
- **`PlanField`**
  - `type`: TEXT, SELECT, DATE, EMAIL, PHONE, CHECKBOX, FILE
  - Also `required`, `options`, `cardPlacement`, `adminOnly` and `sortOrder`.
- **`Member`**
  - One per person per organisation, unique on `(organisationId, email)`.
  - `userId?`, name, phone, `photoAssetKey`, `stateCode?`, `gstin?`, `fieldValues`.
  - `memberNumber`, from a per-organisation counter.
  - `source`, and `isMinor` plus guardian details.
- **`MembershipTerm`** (one row per period)
  - `status`: `PENDING_APPROVAL, PENDING_PAYMENT, UPCOMING, ACTIVE, GRACE, ENDED, LAPSED, EXPIRED, CANCELLED, REJECTED, REVOKED`
    - `UPCOMING`: paid early renewal, with `startsAt` still in the future.
    - `ENDED`: the term reached `endsAt` **and a paid successor exists**. It is terminal, so it never goes through GRACE or LAPSED, and it never counts towards Lapsed(P) or churn. When a late renewal is paid during GRACE, the predecessor moves from GRACE to ENDED at that moment.
    - `EXPIRED`: an abandoned `PENDING_PAYMENT`.
  - **No overlapping live terms.** A raw-SQL exclusion constraint (`btree_gist`) blocks it: `EXCLUDE USING gist ("memberId" WITH =, "planId" WITH =, tstzrange("startsAt","endsAt") WITH &&) WHERE (status IN ('UPCOMING','ACTIVE','GRACE'))`. When a late renewal is backdated, the successor starts at the predecessor's `endsAt`, and the predecessor is moved to ENDED in the same transaction.
  - Dates: `startsAt?`, `endsAt?`, `graceUntil?`, `paymentDueBy?`.
  - `kind {NEW, RENEWAL, REINSTATEMENT}`
  - `renewedFromId?`, with a partial unique WHERE status NOT IN (CANCELLED, EXPIRED, REJECTED).
  - A partial unique allowing **at most one open PENDING_* term per (member, plan)**.
  - The decision: `decidedById`, `decidedAt` and `reason`.
  - **No `statusOverride`.** A manager action is an explicit transition (cancel, revoke, reinstate, extend `endsAt` with a reason), never a free-form override.
- **`TermStatusEvent`**
  - `termId`, `from`, `to`.
  - **`effectiveAt`**, the domain time (e.g. `endsAt`), and **`recordedAt`**.
  - `actorId?` and `cause`.
- **`deriveStatus(chain, now)`** takes the member's term chain for one plan, not a single term. It is the single source of truth for display.
  - **Current term** = the latest live (UPCOMING excluded) term whose `[startsAt, graceUntil)` covers now. Otherwise it is the most recent term, which shows lapsed, expired or revoked.
  - The `/verify` page, the wallet and permissions always use it.
  - The stored status is a cache that the hourly sweep keeps aligned.
- **`MemberCard`**
  - Belongs to a **(member, plan)** pair: `memberId`, `planId`, `organisationId`, `cardNumber`, and `verifyToken` (unique, in the QR).
  - `issuedAt`, `revokedAt` and `revokedReason`.
  - A partial unique allows one live card per (member, plan).
  - **Renewal does not change the QR.** `/verify` resolves the current term live, showing valid, in grace, expired or revoked.
  - It is reissued only when printed details change.
- **`ConsentRecord`**: memberId, purpose, notice version, `grantedAt`, `withdrawnAt` and `byGuardian`.

### Money
- **`OrgPaymentSettings`**
  - `provider {NONE, RAZORPAY, STRIPE}`. **Both are in the MVP** (owner decision, 2026-10-19).
  - Encrypted key id, secret and webhook secret, using AES-GCM with `PAYMENT_SECRETS_KEY`.
  - Also `webhookPublicCode`, `testMode`, and `upiVpa?` with UPI QR offline instructions.
- **`OrgTaxSettings`**
  - Registration: `gstRegistered`, `scheme {REGULAR, COMPOSITION}`, `gstin`, `legalName`, `address`, `stateCode`.
  - Rate: `sacCode` (default 999599), `rateBps`, `inclusive`, `exempt`.
  - Numbering: `receiptPrefix`, validated so the full number stays within 16 characters.
- **`Payment`**
  - Links: `organisationId`, `memberId`, `termId?`.
  - `status {PENDING, AWAITING_CONFIRMATION, PAID, WAIVED, FAILED, CANCELLED}`. Cancel is only allowed from a non-paid state.
  - `provider {RAZORPAY, STRIPE, OFFLINE}`, `method`, and the gateway order and payment IDs.
  - Settlement ID and UTR, which can arrive later.
  - `reference`, `paidAt`, `recordedById`, `confirmedById`.
  - **`taxSnapshot Json`**, frozen when the order is created.
- **`PaymentLine`**: `kind {TERM_FEE, JOINING_FEE, REJOIN_FEE}`, `amountPaise`, `taxableValuePaise`, `cgstPaise`, `sgstPaise`, `igstPaise`.
- **`ProcessedWebhookEvent`**: provides idempotency.
- **`Refund`**
  - `status {PENDING, PROCESSED, FAILED}`, because gateway refunds are asynchronous.
  - Append-only. It links to a credit note.
- **`TaxDocument`**
  - `kind {RECEIPT, TAX_INVOICE, BILL_OF_SUPPLY, CREDIT_NOTE}`:
    - `RECEIPT`: the organisation is not registered.
    - `TAX_INVOICE`: issued at receipt time (s.31(2)).
    - `BILL_OF_SUPPLY`: for registered but exempt, or composition, organisations (Rule 49).
  - `number`, `series`, `financialYear`, `paymentId`, `cancelledAt`.
  - **A full snapshot**:
    - issuer: legal name, GSTIN, address, state
    - recipient: name, state, GSTIN
    - place of supply, SAC, rate, lines, tax split
  - The PDF is rendered lazily from the snapshot, so a render failure never burns a number. The snapshot stores a `templateVersion`, so a re-render years later looks identical.
- **`DocumentCounter`** `(organisationId, series, financialYear)`. It is allocated with `INSERT … ON CONFLICT ("organisationId","series","financialYear") DO UPDATE SET next = "DocumentCounter".next + 1 RETURNING next`, so the first document of a financial year also works. This happens **in the same transaction** that:
  - marks the payment PAID, or confirms an offline one
  - writes `ProcessedWebhookEvent`
  - inserts the `TaxDocument`

  Lock order is always payment, then counter. The financial year is computed in the organisation's timezone.
- **Tax maths** (written down in `docs/GST.md` and unit-tested)
  - Compute total tax on the taxable value.
  - For CGST+SGST, split it into two equal halves; any odd paisa goes into the taxable value.
  - With inclusive pricing, back-calculate the taxable value.
  - Place of supply is the member's state, falling back to **the supplier's state** (IGST s.12(2)(b)).
  - Partial refunds apportion tax pro rata on the credit note.
- **Immutability triggers** use column allowlists, not whole-row freezes.
  - A paid Payment may still take its settlement ID or UTR later, and may be anonymised.
  - A `TaxDocument` may only gain `cancelledAt`.
  - A paid row is never deleted. It is reversed with a credit note.
- **Late capture.** A gateway capture that arrives after `PENDING_PAYMENT` has expired revives the term if the plan allows. Otherwise it is flagged in the refunds queue. Money received is always receipted.
- **Webhook failure policy.** Razorpay disables an endpoint after repeated failures, so:
  - **Business-rule outcomes** commit as PAID, issue the document, flag the payment for review and **return 200**. These include late capture with no revive, a suspended organisation and an archived plan.
  - **Amount mismatch** is handled differently. The captured amount is recorded, the payment is set to PAID and flagged, and the endpoint returns 200, but **the tax document is held**. After review, the manager either issues the document on the captured amount with adjusted lines, or refunds.
  - **Only infrastructure errors return 5xx**, such as the database being unavailable.
  - An unknown event type is acknowledged with 200.
- **Offline maker-checker** (when `offlineConfirmationRequired` is on)
  - Whoever confirms must not be whoever recorded it.
  - Confirming needs OWNER, ADMIN or TREASURER.
  - The receipt number is allocated at confirmation.
  - When the setting is off, OWNER, ADMIN or TREASURER entries are PAID straight away.
- **Member "I've paid".** A member can submit a UPI or bank UTR, which creates an `AWAITING_CONFIRMATION` payment. This is in the MVP. A partial unique on `(organisationId, utr)` WHERE `provider = 'OFFLINE' AND utr IS NOT NULL AND status NOT IN ('CANCELLED','FAILED')` rejects duplicate claims, but still allows a resubmission after a rejected claim and never collides with gateway UTRs, and submissions are rate limited per member.

### Reporting support
- A daily per-organisation rollup table, `OrgDailyStats`, written by the sweep, feeds trends and the platform reports A2 and A3. Each day is **recomputable**: backdated offline payments, late captures and refunds mark the affected days dirty, and the next sweep rebuilds them from source rows.
- Indexes on `(organisationId, status, endsAt)`, `(organisationId, paidAt)` and `(organisationId, createdAt)`.
- CSV exports are streamed.
- Bulk card ZIPs and receipt ZIPs are **background jobs** that write into storage, with a download link when they finish.

## Phases (each ends green on lint, tsc and unit tests; database phases also run integration tests against Docker postgres:16 and redis:7; owner QA before each commit)

### P0. Checkpoint
- Commit the TS-migration working tree on `feat/typescript-agpl-stack`.

### P1. Scaffold
- Delete the old app: `backend/`, `frontend/`, `scripts/`, `SUPABASE_SETUP.md`, `MIGRATION_NOTES.md`, and the root package files.
- Add `.gitattributes` (`* text=auto eol=lf`, plus binaries) **first**.
- Copy and rename the config: `next.config.ts`, tsconfig, eslint, postcss, vitest and playwright configs, `.npmrc`, `Dockerfile`, `docker-entrypoint.sh`, `scripts/prisma.mjs`, `instrumentation.ts`.
- In `package.json`, pin the versions, drop event-only dependencies, and add `razorpay` and `stripe`.
- **Update** the existing `LICENSE`/`NOTICE`, and add `CHANGELOG.md` and `VERSION` (0.1.0).
- Add a minimal schema, `/api/health`, and CI (`ci.yml` and `quality.yml`, adapted).

### P2. Design system and shell (moved ahead of every page, so nothing needs a second styling pass)
- **Brand assets.**
  - `scripts/sync-design.mjs` vendors SpaceWorks-Design into `brand/`: tokens, fonts, logos, icons, and the recorded source SHA.
  - Fonts stay under `public/brand/fonts`, which `lib/badge/fonts.ts` reads in the standalone build.
- **Tailwind 4 mapping.**
  - `sync-design` re-emits the tokens with a `--sw-*` prefix, e.g. `--sw-color-ink: 20 44 42`.
  - `@theme inline { --color-*: initial; --color-ink: rgb(var(--sw-color-ink)); … }` makes utilities and `/opacity` modifiers work through Tailwind 4's `color-mix`. `initial` stops the default Tailwind palette leaking in.
  - `--font-sans`, `--font-accent` and `--shadow-color` are mapped the same way.
  - The raw `tokens.css` is **not** imported as well.
  - `@custom-variant dark (&:where(.dark, .dark *))`.
- **Theme.** Server-rendered from the `swo.theme` cookie. Light is the default. There is only a Light/Dark toggle: no System option and no `prefers-color-scheme` fallback.
- **UI components.**
  - Port `components/ui/*`, `components/brand/*`, the toasts and the confirmation dialog.
  - **Remap every `--yy-*` and `data-color-mode` usage** to the new tokens and the `.dark` class. Events' token level is not reused as-is.
  - Restyle to `ui-brand-spec.md`.
- **Shell dimensions** (one value per dimension, recorded in `docs/DESIGN.md`):
  - Sidebar 256px. Nav items 44px tall (brand D9 and accessibility; this wins over the ux-spec's 40).
  - Content max width 1120. Gutters 16/24/36. Breakpoints 375/768/**1024**/1280, where 1024 is the shell collapse point.
  - **No icon rail.** The nav is text-only (D9). Below 1024 the shell becomes a top bar plus a sheet.
  - At most two sidebar count badges (ux-spec:967): pending approvals and payments awaiting confirmation.
- **Super-admin shell.** A restrained top bar with section tabs.
- **Fonts on cards and receipts.**
  - Gilroy falls back to ASCII. Add **OFL Noto Sans plus Noto Sans Malayalam/Devanagari** as fallbacks, so Indic names and the ₹ sign render.
  - **Shape the text properly.** Replace `glyphsForString` (a cmap lookup with no shaping) in `lib/badge/fonts.ts` and the PNG glyph path with fontkit `layout()` for complex scripts. This applies to measuring and drawing, in both PDF and PNG.
  - Test with conjunct-heavy Malayalam and Devanagari names against reference renders. Checking that a glyph exists is not enough.

### P3. Platform port (de-evented)
- **Auth.**
  - Credentials with bcrypt, Google, email verification, password reset, TOTP MFA, recovery codes and re-authentication.
  - Super-admin step-up, using the DB flag.
  - An Auth.js **Email magic-link provider** for members.
  - Session cookie `swo.session-token.v1`.
- **Team.** Port `lib/permissions.ts` (rewritten around `TeamRole` and a capability map), `lib/permissionRoles` (renamed capabilities), team invites, and `app/actions/team.ts`. The `eventCollaborator` fallback is removed.
- **Platform services.**
  - `lib/audit`, `lib/outbox` (rewritten as a kind registry) and `lib/outboxWorker`.
  - **`lib/retention`**, rewritten without the event tables.
  - `lib/storage`, `lib/uploadUrl`, `lib/imageValidation`, `/api/uploads/[...key]`.
  - `lib/rateLimit` (buckets: auth, join, payment, webhook, export, api) and `lib/actionRateLimit`.
  - `lib/email/{brand,transporter}`, `lib/slug`, `lib/timeZone`, `lib/redactSensitiveText`, `lib/bearerSecret`, `lib/superAdminMfa`, `lib/instanceSettings`, `lib/operationalHeartbeat`.
  - `lib/env.ts` without `DEPLOYMENT_MODE`, `FRONTEND_GATEWAY_SECRET` and the embed origins.
- **`proxy.ts` and `lib/pageSecurity.ts`.**
  - Drop `lib/frontend/peer` and the rsvp, discover, ticket and embed branches.
  - **Exempt `/api/webhooks/*` from the global per-IP limiter**, and give it its own bucket.
  - On checkout routes only:
    - Load Checkout.js with the **per-request nonce**, because host entries are ignored under `'strict-dynamic'`.
    - Allow `checkout.razorpay.com` and `api.razorpay.com` in `frame-src` and `connect-src`.
    - Add the Razorpay origin to `form-action`, for the redirect and UPI-intent flows.
    - Add `https://checkout.stripe.com` to `form-action`. Stripe uses a redirect from a server action, so no Stripe script, frame or connect entries are needed.
    - Relax `Permissions-Policy: payment` there.
- **`lib/validators.ts`.** Keep the org, team and auth schemas. Drop `broadcastDesigns` and the reserved-event-slug logic.
- **Pages.** Account (Profile, Security, Organisations) and the super-admin base: users, audit, monitoring, settings and storage. The loaders are rewritten in `lib/data/*`.
- **Tests.**
  - Port the matching unit and integration tests.
  - `tests/integration/tenant-isolation.db.test.ts` is **generated from a manifest of every server action and route**. CI fails when an action or route has no isolation case.

### P4. Tenant onboarding
- **Self sign-up at `/start`.**
  - The applicant creates an account, then fills a stepped application.
  - It is rate limited.
  - It creates the org as `PENDING_REVIEW`, with the applicant as OWNER and a review entry holding the snapshot.
  - Emails go to the applicant and to every super-admin.
- **The gate.** A single `requireActiveOrg` check runs in the dashboard pages and the server actions. Applicants can reach only `/dashboard/[slug]/application`, which shows:
  - the status timeline
  - editing and resubmitting when the status is CHANGES_REQUESTED
  - the reason when the status is REJECTED
- **After a rejection.**
  - The applicant may re-apply with a new application. The old one stays REJECTED.
  - The slug is released 30 days after rejection.
- **Super-admin queue.**
  - Filters, plus a "waiting more than 7 days" chip.
  - The detail view shows the snapshot.
  - Actions: Approve, Request changes (a note is required), Reject (a reason is required). All are audited and emailed.
- **Direct create.** The super-admin creates the org as ACTIVE and sends an OWNER invite.
- **Suspended or archived organisations.**

  | Area | Behaviour |
  | --- | --- |
  | Manager writes | Blocked, **except the finance allowlist** (OWNER, ADMIN, TREASURER): confirm offline and UTR payments, record and process refunds and credit notes, download receipts, run finance exports, and **approve or refuse member erasure requests** (OWNER, ADMIN) |
  | Public join form, new checkouts | Blocked |
  | Checkout for an order created before suspension | Honoured: payment is accepted and receipted, and the term activates per its plan |
  | Member data rights | Open: DPDP export, erasure request, consent withdrawal and the receipt downloads |
  | `/api/uploads` | Blocked, except member photos on `/verify` and the receipts already listed |
  | Webhooks and reconcile | **Always processed** (money received is always receipted) |
  | Sweep | Keeps running |
  | Reminders | Paused, with queued reminder mail dropped |
  | Transactional mail | Still sent |
  | `/verify` | Shows "organisation suspended" |

- **Organisation settings.** Profile, team, payments, tax, a danger zone, and a first-run checklist:
  1. Logo.
  2. First plan.
  3. Payments, or offline only.
  4. Publish the join link.

### P5. Membership core
- **Plans.**
  - A stepped create dialog, then an inline editor with a sticky unsaved-changes bar.
  - All four duration types, the fee rules, the reminders, the join mode and the payment timing.
- **Join form at `/o/[slug]/join/[plan]`.**
  - The member must be signed in or verify their email by magic link before submitting.
  - It covers custom fields, a photo, consent and minors (guardian consent).
  - **Until P7 a payment stub is used:** "Pay offline" instructions, plus the member's UTR submission.
- **The lifecycle engine** (`lib/membership/{periods,lifecycle}.ts`).
  - Pure period maths and `deriveStatus`.
  - Transitions: apply, approve, reject, markPaid, activate, renew (early creates UPCOMING), cancel, revoke, reinstate, extend.
  - Every transition writes a `TermStatusEvent` with `effectiveAt` and an `AuditEvent`.
- **The hourly `membership-sweep`** is idempotent. It:
  - moves terms through UPCOMING→ACTIVE at their effective times, then at `endsAt` either to ENDED (a paid successor exists) or to GRACE→LAPSED
  - moves PENDING_PAYMENT terms to EXPIRED after `paymentDueBy`
  - sends reminders and records each one, so none is sent twice
  - writes the daily rollup
- **Members.**
  - Directory: filter chips with counts, filters for plan, "expiring in N days" and custom fields, and search.
  - A bulk bar to approve, record a payment, renew, email the card, reject… or revoke….
  - Member detail: profile, current term, timeline, payments, cards, consent and audit.
  - Manual add, CSV import with field mapping, and streamed CSV/XLSX export (audited).
- **Approvals queue,** with inline approve and decline.

### P6. ID cards (extracted from the Events badge engine)
- **Copy into `lib/cards/*`:**
  - `lib/badge/{types,palette,layout,fonts,renderPng,renderPdf,assets,sheet,imageUrl,renderSlot}`
  - `lib/idCardPrint.ts`
  - `components/checkin/id-card/{BadgeCanvas,IdCardDesigner,printCards}`
- **Drop:** `lib/badge/{access,data,presentation,filters}`, `QuickPrintSheet`, `app/actions/badge.ts`, and every import of `app/actions/member-ids`/`member-id-join` inside the copied components.
- **Rename the types and data.**
  - `IdCardAttendee` becomes `CardHolder` (memberId, verifyToken).
  - Remove `rsvpId`, `checkInQrToken`, `eventAccent`, `eventLogoUrl`, `sponsorLogoUrls`, the `eventLogo`/`sponsors` elements, and `eventTitle`.
  - Split the generic helpers out of `lib/badge/http.ts`.
- **Port onto the new models:**
  - `lib/memberIds/{core,data,design,render,presentation,verify,verifyLookup,zip,email,uploads,issue}`
  - the member-ID UI (designer, PresetPicker, HolographicCard, WalletCard, ScaledBadge)
- **Card issuing.**
  - A card is issued on first activation.
  - `/verify/[token]` shows name, organisation, plan, the live status from `deriveStatus`, and valid-until. Contact details are never shown.
  - Cards download as PDF or PNG. Bulk sheets and ZIPs run as background jobs.
  - "Email card" goes through the outbox.
  - One delight moment when the card is issued (with reduced motion respected).

### P7. Payments and GST documents (Razorpay, Stripe and offline)
- **One gateway interface.** `lib/payments/gateway.ts` defines `createCheckout`, `verifyWebhook`, `parseEvent`, `fetchPayment`, `refund` and `testConnection`.
  - It has two adapters: `razorpay.ts` and `stripe.ts`.
  - Each organisation picks **one** provider, so pricing, tax and receipts are identical whichever one is used.
- **Setting up a provider.**
  - Organisation settings take the keys (encrypted), with a test-connection button and a test-mode badge.
  - Every checkout creates the `Payment` with its `taxSnapshot` and `PaymentLine` rows first.
- **Razorpay.**
  - Orders API, and Checkout.js on the checkout route, loaded with the nonce.
  - Supports UPI, cards and netbanking.
  - Webhooks: `payment.captured`, `payment.failed`, `refund.processed` and `refund.failed`.
- **Stripe.**
  - Checkout Sessions with `mode: payment`, sent as a redirect, so no Stripe JS is loaded on our pages.
  - `client_reference_id` holds the payment id, and `metadata` holds org, term and payment.
  - Webhooks: `checkout.session.completed` with `payment_status=paid`, `checkout.session.async_payment_succeeded/failed` and `charge.refunded`.
  - Organisations use their own Stripe account keys. Stripe Connect is Later.
  - Note: new Stripe India accounts may be invite-only. This is documented.
- **Webhooks** at `/api/webhooks/{razorpay|stripe}/[publicCode]`.
  - The signature is verified with the organisation's webhook secret.
  - In one transaction it: writes `ProcessedWebhookEvent` (keyed by provider and event id), marks the payment PAID, transitions the term, allocates the counter, and inserts the `TaxDocument`.
  - The failure policy is the same for both providers.
- **A reconcile job** polls pending orders and sessions through `fetchPayment`, to recover missed webhooks.
  - Late capture is handled as described under Money.
- **Offline payments.** Record, confirm (maker-checker), waive and cancel (non-paid only). The member's UTR submission feeds this confirmation queue.
- **Refunds.** Gateway refunds go through the API and are tracked through to PROCESSED. Offline refunds are recorded. Each gets a credit note with pro-rata tax.
- **Documents.** The tax document PDF is built with pdf-lib from the snapshot, with the brand look and the Noto fallback fonts.
- **Docs.** `docs/PAYMENTS.md` and `docs/GST.md`, covering the rounding rule, place of supply, the document kinds, and a "consult your CA" note.

### P8. Member portal
- **Sign-in:** magic link or password, at `/account`.
- **"My memberships" wallet** across organisations.
  - Each entry shows the status (`deriveStatus`), plan, valid-until, days to renewal and a Renew action.
  - Renewing creates a PENDING_PAYMENT term (UPCOMING once it is paid early).
- **Payments:** checkout, or offline instructions with a UPI QR, plus "I've paid".
- **Card wallet:** view and download.
- **Payments and receipts:** downloadable.
- **Profile edit,** within the fields the plan allows.
- **Data protection.**
  - Consent: view and withdraw.
  - Data export.
  - An erasure request, approved by a manager. Money rows are kept for 8 years and anonymised.
- **Leave,** or cancel renewal.

### P9. Reports
Exact definitions go in `docs/REPORTS.md`:
- **Active(t):** distinct members with a term in ACTIVE at t. GRACE is reported separately and is not counted as active.
- **New(P), Due(P), Renewed(P), renewal rate, churn, Lapsed(P), Reactivated(P):** computed from `TermStatusEvent.effectiveAt`.
- **Collected:** payments by `paidAt`, net of refunds by **refund date**.
- **Outstanding:** unpaid payments, plus AWAITING_CONFIRMATION, plus **PENDING_PAYMENT terms that have no Payment row**.
- **Median time-to-approve.**
- **Financial-year labels** like "FY 2026-27".

**Platform (super-admin)**

| Report | MVP coverage | Notes |
| --- | --- | --- |
| A1 Tenant pipeline | Yes | |
| A2 Tenant base | Yes | Uses the daily rollup |
| A3 Members across tenants | Yes | Uses the daily rollup |
| A4 Payment volume | Totals | |
| A5 Usage vs limits | Yes | |
| A6 Outbox health | Yes | |
| A7 System health | **Basic** | Health checks, job heartbeats, webhook backlog, DB and storage size. No APM. |
| A8 Platform audit | Yes | Super-admins opening an organisation's data is audited |

**Organisation**

| Report | MVP coverage | Notes |
| --- | --- | --- |
| B1 Overview | Yes | PDF snapshot |
| B2 Member register | Yes | PII masked for VIEWER |
| B3 Renewal worklist | Yes | Bulk reminder |
| B4 Renewal rate and churn | Yes | Cohorts later |
| B5 Revenue | Yes | |
| B6 Receipts register | Yes | Bulk PDF ZIP as a background job |
| B7 GST summary | If registered | In GSTR-1 table layout |
| B8 Reconciliation | **Offline confirmation queue only** | Razorpay settlement matching later |
| B9 Outstanding | Yes | Ageing |
| B10 Approvals queue | Yes | |
| B11 Card issuance | Yes | |
| B12 Manager activity | Yes | |

**Members**

| Report | MVP coverage |
| --- | --- |
| C1 Membership | Yes |
| C2 History | Yes |
| C3 Payments and receipts | Yes |
| C4 Card | Yes |

**For every report:** each tile drills down to the members behind it, every export is audited (who, filters, row count), and charts follow the `dataviz` skill.

### P10. Deployment parity with SpaceWorks
- **Port and rename the Events dev VPS stack:**
  - `compose.production.yml`:
    - Postgres 16 with TLS, an owner role and a least-privilege runtime role
    - Redis 7 with TLS
    - Silo with TLS, plus `storage-init` for a private bucket
    - migrator, app and Caddy
    - a scheduler for the outbox, membership sweep, Razorpay reconcile, retention and background jobs
    - `ops`
  - `docker/vps/*`, `install.sh`, `setup-vps.sh` and `update-vps.sh` (with `pg_dump`).
  - Adapt `publish-images.yml` into a SpaceWorks-style `release.yml` (`VERSION`-main.N.sha, GHCR app and migrator images, a GitHub release, promote to latest, optional self-hosted runner deploy).
- **Close the gaps against SpaceWorks:**
  - Installer questions:
    - HTTPS mode: plain, automatic ACME, or behind an existing reverse proxy on 127.0.0.1
    - bundled Silo or external S3
    - Google sign-in
    - generating `PAYMENT_SECRETS_KEY`
  - `scripts/spaceworks-compose.sh bundled|cloud`.
  - `compose.cloud.yml`: app and scheduler on managed Postgres, Redis, S3/R2 and SMTP.
  - Production pulls GHCR images, with a build-from-source flag.
- **Docs:**
  - README in the SpaceWorks structure.
  - `docs/DEPLOYMENT_VPS.md`, `DEPLOYMENT_CLOUD.md`, `CONFIGURATION.md`, `ARCHITECTURE.md`, `SECURITY.md`, `DESIGN.md`.
  - Repo `CLAUDE.md` and `AGENTS.md`.
- **Checks:** shellcheck through Docker, `docker build`, and a local compose smoke test.

### P11. Tests, review, QA
- **Unit tests:**
  - period maths
  - `deriveStatus` and every transition
  - counter allocation under parallel transactions, including concurrent first-of-financial-year allocation
  - GST split, rounding, inclusive pricing and place of supply
  - credit-note apportionment
  - reminders
  - permission matrix
  - card rendering, including Indic names and ₹
- **Integration tests:**
  - the generated tenant-isolation suite
  - onboarding
  - join → approve → pay → activate → card
  - early renewal (UPCOMING→ACTIVE while the predecessor goes to ENDED), late renewal paid during GRACE, then grace→lapse with no successor, and the overlap exclusion rejecting a double renewal
  - offline maker-checker
  - refunds and credit notes
  - webhook idempotency, plus late capture after expiry
  - suspension behaviour
  - report metrics against seeded fixtures
- **End to end** (Playwright + axe):
  - org sign-up, review and approval
  - member join, pay (Razorpay and Stripe test-mode stubs) and card download
  - renewals
  - the super-admin dashboard
  - screenshots at 375, 768 and 1280, in light and dark
- **Stage 4 review** by independent Claude agents: `code-review` at high effort, `security-review`, and an `/impeccable audit`. Fixes are applied until clean.
- **Stage 5:** owner QA, then commit.

## Later (explicitly out of the MVP)
- **Payment gateways and billing:**
  - Stripe Connect (OAuth onboarding)
  - auto-renew (Razorpay Subscriptions, UPI Autopay)
  - Razorpay partner OAuth
  - Razorpay settlement reconciliation (the full B8)
  - platform billing of tenants
- **Membership features:**
  - family and corporate plans
  - discount codes
  - proration and upgrades
  - broadcasts
- **Reports and tax output:**
  - cohort heatmaps
  - funnel tracking
  - GSTR-1 JSON
  - e-invoicing (IRN)
- **Platform and integrations:**
  - subdomains and custom domains
  - API v1 membership scopes
  - Google Sheets import
  - the ⌘K command palette
  - `render.yaml`
  - automatic rollback in the installer
  - Wallet passes
  - Tally and Zoho integrations

## Open questions for the owner
1. **Button shape:** 10px corners (the brand default), or pill-shaped (the UX reference style)?
2. **Sidebar:** Citron, as in the brand guidelines?
3. **Single container:** drop Events' split-frontend hosting and ship one container? (Recommended.)
4. ~~Payments in the MVP~~ **Decided:** Razorpay, Stripe and offline payments are all in the MVP.
5. **Gilroy licence:** SpaceWorks-Design's Gilroy 400–700 were converted from the owner's own TTFs. The free EULA does not cover redistribution, and the public AGPL repos ship them. Options:
   - confirm a licence that allows redistribution
   - switch the app's UI font to an OFL face
   - keep Gilroy out of the public repo and load it at deploy time

## Risks
- **Size:** multi-week. Phased, with QA and a commit for each phase.
- **Licences:** Gilroy (Q5), and Yuyu (no licence; we use only patterns and AGPL Events code, with attribution).
- **GST:** legally unsettled for clubs, so it is configurable and documented.
- **Payments:** the platform is never merchant of record.
- **Payment secrets:** stored in the DB, AES-GCM encrypted with a rotation doc.
- **Tenant isolation:** done in the application, without RLS. Mitigated by composite FKs, one scoping helper, and the manifest-generated isolation suite.
- **Gapless numbering:** a single transaction with a fixed lock order, and lazy PDF rendering.
- **Windows host:** `.gitattributes` LF, and Docker for the integration, e2e and smoke tests. A real VPS install is owner QA.

## Owner decisions at approval (2026-10-19)
- **Plan approved.** Start with P0, then P1.
- **Buttons are pill-shaped.** Set `--radius-control: 9999px` (brand J1). Per the ui-brand-spec token, this applies to buttons, nav items and inputs.
- **Keep split hosting.** This supersedes "no split-frontend layer" above.
  - Keep Events' `lib/views/*` view models, the `frontend/` workspace and the `lib/frontend/*` transport.
  - Keep the generated catalog, and add `npm run frontend:catalog -- --check` to the gate.
  - Keep `app/api/frontend/[kind]/[endpoint]`, `DEPLOYMENT_MODE`/`FRONTEND_GATEWAY_SECRET` and `docs/DEPLOYMENT_SPLIT.md`.
  - Ported loaders stay as `lib/views/*` and are de-evented. `trackedRevalidation` is kept.
- **Font: only the free Gilroy weights.** The app uses **Gilroy Light (300)** for body and UI and **Gilroy ExtraBold (800)** for headings and emphasis. Unbounded stays for accent phrases.
  - These come from SpaceWorks-Design `fonts/Gilroy-{Light,ExtraBold}.woff2`, under the Radomir Tinkov Free Font EULA. Its clauses (d), (h) and (i) allow web-font and software embedding; clause (f) restricts redistribution. Note this in NOTICE.
  - The converted 400–700 weights are **not** used.
  - Static files for pdf-lib/fontkit: Light and ExtraBold. Noto stays as the Indic/₹ fallback.
  - Readability check: body text set in Light must keep a 16px minimum for body copy, with 14px only for labels, and AA contrast in both themes. The impeccable audit verifies this.
- **Payments: Razorpay, Stripe and offline**, all in the MVP.

## Owner additions during the build (2026-10-19)

### Organisation units (areas, branches, chapters)
Many organisations run through sub-parts: a state body with district units, an alumni network with city
chapters, a club with branches. Units are optional; an organisation without any works exactly as before.

- **Model.** `OrgUnit { id, organisationId, parentId?, name, slug, level, path, sortOrder, archivedAt? }`.
  - `path` is the materialised ancestor chain (`rootId/childId/…`), so a subtree is one `startsWith` query.
  - `Organisation.unitLevels String[]` names the levels the organisation uses, e.g. `["Region", "District", "Chapter"]`, at most 4.
  - Composite FK `(organisationId, parentId)` keeps a unit inside its organisation. Slugs are unique per organisation. Units are archived, never deleted, once they have members.
- **Members** have one home unit (`Member.unitId?`). The join form asks for it when the organisation has units; `/o/[slug]/u/[unit]/join/[plan]` preselects it.
- **Plans** are open to the whole organisation or limited to chosen units (`PlanUnit`). Unit-specific pricing is Later.
- **Unit-scoped team access.** `TeamMember.unitId?`: a manager scoped to a unit sees and acts only within that unit's subtree. Every member and payment query adds the subtree filter, in one helper, next to the organisation scope. Organisation-wide roles keep `unitId` null. Only organisation-wide OWNER and ADMIN manage units and settings.
- **Reports** (P9) filter by unit, and the daily rollup carries `unitId`, so a district sees its own numbers and the head office sees the roll-up.
- **Phases.** Models, the unit tree editor (Settings → Units), member and plan scoping and unit-scoped team roles land in **P5**. Unit filters in reports land in **P9**.

### Customisable public organisation page (`/o/[slug]`)
- **Content.** `OrganisationPage { organisationId, tagline, coverAssetKey?, accentColor, sections Json, publishedAt?, draft Json? }`.
- **Section types:** about (sanitised Markdown), membership plans (live from the plans), units directory, contact, FAQ, image gallery, links and socials, and a free text block. Each can be shown, hidden and reordered.
- **Editor** at Settings → Public page, with a live preview, draft and publish, accent colour with a contrast check, and cover and gallery uploads through the existing storage pipeline.
- **Phases.** A plain `/o/[slug]` (logo, about, plans, join buttons) lands in **P5** so joining works. The editor, sections and draft/publish land in **P8**.

### Landing page revamp (done before P5)
The marketing home `/` is rebuilt as a proper product page: an animated member-card hero, feature cards with
motion, how-it-works (apply, approval, run), payments and GST, units and reports, self-hosting, FAQ and a final
call to action. All motion is CSS, runs on transform and opacity only, and stops under `prefers-reduced-motion`.

### Multiple currencies (owner, 2026-10-19)
Organisations outside India, or Indian ones with members abroad, price in their own currency.

- **Money columns are integer minor units plus an ISO 4217 code.** `amountMinor` + `currency` everywhere a price or payment appears: plans, terms, payments, payment lines, refunds and tax documents. "Paise" in the sections above reads as "minor units".
- **Supported currencies** live in `lib/money/currencies.ts` with their minor-unit exponent: INR, USD, EUR, GBP, AED, SGD, AUD, CAD, NZD, LKR, BDT, NPR, QAR, SAR, OMR, KWD, BHD, MYR, ZAR, JPY. The three-decimal Gulf currencies and zero-decimal JPY are handled by the exponent, never by assuming two decimals.
- **The organisation sets a default currency.** Each plan carries its own currency, defaulting to the organisation's, so one organisation can offer, say, an INR plan and a USD overseas plan. A member's term, payment and documents carry the plan's currency at the time.
- **Tax mode** per organisation (`OrgTaxSettings.mode`):
  - `GST`: Indian GST exactly as in the Money section. Allowed only for INR plans; plans in other currencies are treated as exports of services (zero-rated, LUT) or carry no GST, chosen per organisation.
  - `SIMPLE`: one named tax (for example "VAT"), a rate and inclusive or exclusive pricing, for any currency.
  - `NONE`: receipts without tax.
- **Gateways.** Stripe takes any supported currency. Razorpay takes INR, plus the international currencies the organisation's Razorpay account has enabled; the plan editor refuses a currency the chosen provider cannot take. Offline payments take any currency.
- **Formatting** uses `Intl.NumberFormat`, with `en-IN` grouping for INR and `en-GB` otherwise; the organisation can override the locale.
- **Reports never add different currencies together.** Every money figure is grouped by currency, with the organisation's default currency first. The platform reports show counts across currencies and money per currency.
- **Document numbering** stays one gapless series per organisation per financial year, whatever the currency.

### Further owner requirements (2026-10-19)
- **Sign-in with Google, Apple and GitHub**, alongside email and password. Each provider is switched on by a platform admin in instance settings (client id and encrypted secret), like Google today. Accounts link by verified email. Lands in **P5**.
- **Organisations are many and varied.** One instance hosts many organisations of any kind (club, company, community, society, makerspace…), and one person can hold memberships and team roles in several. Already true; the member portal (P8) shows them together.
- **Member roles an organisation defines** (`MemberRole`: name, optional description, colour, sort order, optionally limited to a unit). Managers assign one or more roles to a member (for example "Systems Engineer", "Secretary", "Cloud Specialist"); the primary role prints on the member card and shows in the directory, filters and exports. These are distinct from team access roles. Lands in **P5**, card printing in **P6**.
- **Team access roles** stay Owner, Manager (stored as `ADMIN`), Treasurer and Viewer. An organisation has one or more managers who run memberships; owners add more from the Team page.
- **Public organisations.** `Organisation.visibility {UNLISTED, PUBLIC}`, set by a platform admin (and requestable by the owner). Public organisations appear in a directory at `/organisations` with search by name, kind and city, and their join page takes applications from anyone. Unlisted ones are reachable only by link. Lands in **P5** (directory and join), with the page editor in **P8**.
- **Google Sheets import.** Alongside CSV upload, members can be imported from a Google Sheet: paste a share link of a sheet shared as "anyone with the link can view", the server fetches its CSV export (only from `docs.google.com`, size-capped, with SSRF guards), and the same column-mapping and preview flow as CSV runs. Re-importing the same sheet updates matching members by email. Lands in **P5**.
- **Deployment parity (P10).** No hosting before P10. Then the setup mirrors SpaceWorks exactly: images on GHCR (packages), versioned releases, a README with the one-line `curl … install.sh | bash`, the installer, the update and rollback scripts, and the VPS and cloud modes. The Netlify split stays documented in `docs/DEPLOYMENT_NETLIFY.md`.
