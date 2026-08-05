# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `artifacts/affiliate-dashboard` (`@workspace/affiliate-dashboard`)

React + Vite frontend for the **1OF1 Trader Pro Affiliate Back Office**.

- **Auth**: Token stored in `localStorage` (`auth_token` + `auth_user`). `setAuthTokenGetter(() => localStorage.getItem('auth_token'))` configured in `main.tsx` so all API client calls automatically include the Bearer token.
- **Auth context** (`src/lib/auth.tsx`): Stores user from login response directly; only calls `/api/auth/me` on page load when token exists but no cached user (token validation).
- **Login**: Uses hook-level `onSuccess` on `useLogin` mutation (not per-call) for React Query v5 compatibility.
- **Routing**: Wouter with `base=""`. Protected routes use `AppLayout` which redirects to `/login` if unauthenticated.
- **Admin credentials**: `admin@1of1traderpro.com` / `Admin1234!`
- **Pages**: Landing, Login, Admin (Overview/Applications/Affiliates/AffiliateDetail/Commissions/Payouts/Memberships/MembershipDetail/Finance/Analytics/Customers/AuditLogs), Affiliate (Dashboard/Links/Customers/Commissions/Payouts/Analytics/Resources/Support/Profile/Security)
- **CRM Pages**: Partners (list + detail), PartnerPlans, Leads, Clients (list + detail)
- **Affiliate sidebar**: 10 nav items — Dashboard, My Links, Customers, Commissions, Payouts, Analytics, Resources, Support, Profile, Security; animated left highlight, mobile-responsive with slide-in overlay
- **Affiliate Dashboard**: Onboarding checklist, quick actions bar, commission rate display, 4 stat cards, unpaid/paid commission cards, clicks-over-time chart, top countries with flag emojis
- **Affiliate Links**: Primary link with QR code modal (api.qrserver.com), campaign link creator with destination selector + UTM + notes, per-link click counts
- **Affiliate Commissions**: Summary cards (earned/pending/paid), customer name display, sale type (initial/recurring), rate type, proper USD amounts (NOT multiplied by 100), date + status filters
- **Affiliate Payouts**: Balance cards, payout rules with method minimums, request form with method dropdown + saved details autofill, pending payout notice, history table
- **Affiliate Customers**: Tabbed view (Active/Inactive/All), customer avatar initials, email copy, revenue & earnings per member, status badges with live dot
- **Affiliate Analytics**: Traffic/Geography/Sources tabs, 30/7/90 day selector, clicks over time chart, country bar chart with flag emojis, traffic source breakdown
- **Affiliate Resources**: Captions (5 platforms, link auto-inserted), scripts (4 types), brand colors + voice guide + asset request, compliance section with FTC disclosure rules
- **Affiliate Support**: 10-question expandable FAQ, ticket form with category selector, submits to admin email via Resend, email + Telegram contact cards
- **Affiliate Security**: Password change with strength meter (5 bars) + show/hide, active sessions list with per-session revoke + revoke all others, 2FA placeholder
- **Affiliate Profile**: Completion progress bar, payment method dropdown (crypto/zelle/wire/paypal), dirty-state Save button, security link, affiliate code display
- **Finance dashboard**: `/admin/finance` — gross revenue, MRR, AOV, commissions accrued/paid/liability, revenue by affiliate, revenue by payment type, 30-day daily sales chart
- **CSV exports**: `/api/admin/export/customers`, `/api/admin/export/affiliates`, `/api/admin/export/commissions`, `/api/admin/export/payments`
- **Membership revenue**: `totalRevenue` field added to membership list (batch query via `inArray` on `whop_membership_id`)
- **Customer detail**: `/admin/memberships/:id/detail` — payment history, commission records, affiliate source, membership info
- **Analytics fix**: Conversion rate now uses only attributed signups (`affiliate_id IS NOT NULL`) / referral clicks
- **CRITICAL**: Payments table has NO `whop_plan_id` column — only `whop_membership_id`, `whop_payment_id`, `payment_type`, `affiliate_id`
- **CRITICAL**: Whop v2 API amounts are in DOLLARS (not cents). Do NOT divide by 100.

### `artifacts/ntw-crm` (`@workspace/ntw-crm`)

React + Vite frontend for the **NTW CPA CRM** (separate from the Affiliate Back Office). Routes under `/ntw-crm/` prefix.

- **Auth**: Session-based (cookie `ntw.sid` stored in `ntw_sessions` PostgreSQL table via `connect-pg-simple`).
- **API**: All calls to `/api/ntw/*` via `src/lib/api.ts` (`ApiError` typed class, `credentials: "include"`).
- **Routing**: React Router v7 with `basename="/ntw-crm"`. Auth guards redirect admins to `/login`, partners to `/partner-login`.
- **Admin login**: `/login` → POST `/api/ntw/auth/login` → requires 2FA (TOTP) for admin roles.
- **Partner login**: `/partner-login` → POST `/api/ntw/auth/ib/login` → IB/Affiliate accounts, no 2FA required.
- **2FA setup**: `/setup-2fa` — QR code + manual key via native Node.js TOTP (RFC 6238, no otplib).
- **2FA verify**: `/2fa/verify` — enter 6-digit TOTP code.
- **Forgot/Reset password**: `/forgot-password`, `/reset-password?token=...` with Resend email.
- **Admin shell**: `/admin/*` — protected by `ntw.sid` session + 2FA verification.
- **Partner shell**: `/partner/*` — protected by `ntw.sid` session, no 2FA required.
- **Seed**: `pnpm --filter @workspace/scripts run seed-ntw-admin` — creates `superadmin@ntw.com / ChangeMe123!`.

#### NTW CRM API Routes (within `artifacts/api-server`)

All NTW-specific routes are isolated under `/api/ntw/*` in the shared API server:

- `POST /api/ntw/auth/login` — admin/staff login (supports 2FA flow)
- `POST /api/ntw/auth/ib/login` — IB/Affiliate partner login (no 2FA)
- `POST /api/ntw/auth/logout` — destroys session
- `GET /api/ntw/auth/me` — returns current session user + permissions
- `POST /api/ntw/auth/2fa/setup/init` — generates TOTP secret + QR code URL
- `POST /api/ntw/auth/2fa/setup/confirm` — verifies and saves TOTP setup
- `POST /api/ntw/auth/2fa/verify` — verifies TOTP token for existing 2FA
- `POST /api/ntw/auth/forgot-password` — sends reset email via Resend
- `POST /api/ntw/auth/reset-password` — validates token + sets new password
- `GET /api/ntw/admin/users` — list users (requires `users:read` permission)
- `POST /api/ntw/admin/users` — create user (requires `users:write` permission)
- `PATCH /api/ntw/admin/users/:id` — update user (requires `users:write`)
- `DELETE /api/ntw/admin/users/:id` — delete user (requires `users:delete`)

#### NTW RBAC

- `requireNtwPermission(resource, action)` middleware — checks `session.ntwRolePermissions`
- Role permissions stored in `ntw_roles.permissions` (JSONB: `Record<string, string[]>`)
- Admin roles: Super Admin, Admin, Finance Admin, Compliance Reviewer, Affiliate Manager
- IB/Partner role: IB/Affiliate (separate login flow, no 2FA required)

#### NTW CRM API Routes — Data Ingestion & Sync (Task 3)

All webhook and sync routes are in `artifacts/ntw-api`:

**Webhooks** (`/ntw-api/webhooks/*` — auth via `X-Webhook-Secret` header or HMAC-SHA256 `X-Webhook-Signature`):
- `POST /ntw-api/webhooks/payment/deposit` — deposit ingestion (FTD detection + net deposit recalc)
- `POST /ntw-api/webhooks/payment/withdrawal` — withdrawal ingestion (net deposit recalc)
- `POST /ntw-api/webhooks/kyc/status` — KYC status update by client_id or external_client_id
- `POST /ntw-api/webhooks/mt5/account` — MT5 account upsert
- `POST /ntw-api/webhooks/tradelocker/account` — TradeLocker account upsert
- `POST /ntw-api/webhooks/trade/sync` — batch trade sync (upserts trades, queues lot recalc)

**Admin Sync & Data Routes** (`/ntw-api/admin/*` — requires admin session + 2FA):
- `GET /ntw-api/admin/clients` — paginated client list with search (FTD, net deposit, eligible lots)
- `GET /ntw-api/admin/clients/:id` — single client detail with accounts
- `GET /ntw-api/admin/clients/:id/transactions` — paginated transactions with USD amounts, FTD flags, net deposit summary
- `GET /ntw-api/admin/clients/:id/trades` — paginated trades with eligible flag, lot totals
- `GET /ntw-api/admin/accounts/:id/sync-status` — last-synced timestamps, sync health, recent sync logs
- `POST /ntw-api/admin/accounts/:id/resync` — trigger manual re-sync job
- `GET /ntw-api/admin/sync-logs` — paginated sync event log (filterable by accountId)

**Background Job System** (`artifacts/ntw-api/src/lib/jobQueue.ts`):
- In-process queue with 5s scheduler tick
- Job types: `process_transaction`, `process_trade`, `recalc_client_financials`, `recalc_client_lots`, `sync_account`, `resync_account_transactions`, `resync_account_trades`
- Exponential backoff retry (max 3 retries, doubles every attempt)
- All jobs create/update `ntw_sync_logs` records

**Services**:
- `transactionProcessor.ts` — USD normalization (10+ currencies), type/subtype classification, FTD detection, net deposit recalculation
- `tradeProcessor.ts` — lot normalization, eligibility window calc (from FTD date to FTD+qualificationPeriodDays), eligible lot aggregation per client

#### NTW CPA Engine (Task 4)

CPA qualification engine lives in `artifacts/ntw-api/src/lib/`:

- **`cpaEngine.ts`** — Full state machine (lead→registered→kyc_pending→kyc_approved→funded→volume_in_progress→qualified→pending_review→approved→paid). Tier logic: $250→$100, $500→$200, $1000→$400, $2000+→$800 CPA. Lot requirement: 1 lot per $500 FTD. 30-day qualification window. Auto-routes qualified cases to pending_review.
- **`fraudDetection.ts`** — Multi-signal fraud detection: duplicate IP (score +40), self-referral (+60), duplicate payment method (+50), low-trade abuse (+30), KYC mismatch (+25). Auto-hold if score ≥70.

API routes added to `artifacts/ntw-api/src/routes/`:
- `ntwCpa.ts` — `/ntw-api/cpa/*`: review queue, case detail, approve/deny/hold actions
- `ntwFraud.ts` — `/ntw-api/fraud/*`: fraud queue, flag detail, clear/escalate/hold actions
- `ntwOverrides.ts` — `/ntw-api/overrides/*`: manual overrides CRUD (reassign, override tier/FTD, force-approve)
- `ntwClients.ts` — `/ntw-api/clients/*`: client list with CPA status, client detail with CPA conditions

Admin UI pages in `artifacts/ntw-crm/src/pages/admin/`:
- `CpaReviewQueue.tsx` — Filter by status, action buttons (Approve/Deny/Hold) with note modal + audit log
- `FraudReviewQueue.tsx` — Filter by flag type/severity, Clear/Escalate/Hold with note modal
- `ClientsPage.tsx` — Search + filter clients with CPA status overview
- `ClientDetailPage.tsx` — CPA status section with lot progress bar, 30-day window countdown, fraud flags
- `OverridesPage.tsx` — Manual override log + Reassign/Override Tier/FTD/Force Approve actions
- `AdminShell.tsx` — Sidebar with wouter routing; includes Sync Logs route from Task 3

#### NTW DB Schema

Key tables: `ntw_users`, `ntw_roles`, `ntw_partners`, `ntw_clients`, `ntw_client_accounts`, `ntw_trades`, `ntw_transactions`, `ntw_cpa_qualifications`, `ntw_cpa_payouts`, `ntw_leads`, `ntw_login_history`, `ntw_password_reset_tokens`, `ntw_audit_logs`, `ntw_sessions`, `ntw_sync_logs`.

**New fields added in Task 3**:
- `ntw_clients`: `has_ftd`, `ftd_at`, `ftd_amount`, `net_deposit`, `total_deposits`, `total_withdrawals`, `eligible_lots`, `total_trades`, `eligible_for_cpa`
- `ntw_client_accounts`: `last_transaction_sync_at`, `last_trade_sync_at`, `last_account_sync_at`, `sync_error`
- `ntw_transactions`: `subtype`, `amount_usd`, `exchange_rate`, `is_ftd`, `settled_at`
- `ntw_trades`: `is_eligible`
- New table: `ntw_sync_logs` (tracks all sync events, status, errors, retries)

CPA Engine tables (added Task 4): `ntw_cpa_cases` (full status enum), `ntw_fraud_cases`, `ntw_manual_overrides`.

Migration: `lib/db/drizzle/0000_ntw_crm_foundation.sql`

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
