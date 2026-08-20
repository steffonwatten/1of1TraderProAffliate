# Working in this repo — 1of1 Trader Pro back office

> 📘 **The method for every project is in `playbook/PLAYBOOK.md`** — repo layout,
> bringing a project in safely, the document set, code standards, CI shape,
> credential handling, session-log conventions.
>
> The enforced rules are copied into this repo at **`.claude/rules/GENERAL-*.md`**
> so a cloud session, which clones only this repository, can still read them.
> **Edit them in the playbook, never here.**
>
> **This file covers only what is true of *this* application.** If the two
> disagree, one is wrong — resolve it rather than leaving both.

> **Before changing anything, read `docs/SESSION-LOG.md`** — every change made to
> this codebase, why, what it should do, and how it was verified. Newest first,
> with a handoff block at the top for picking this up cold. **Add an entry for
> anything you change.**

**Goal of this file: never read a large file to find out where something lives.**

Every path here must be verified against the tree. If anything else in the repo
disagrees with this file, this file is right — and if this file is wrong, fix it
here rather than working around it.

---

## 🔴 Two platforms in one repo — know which one you are in

Most work here is on the **affiliate back office**. It is the live product and
the larger surface. The broker platform was added later and is not deployed.
They share a database and an API server and nothing else — different auth,
different money tables, different rules.

| | **Affiliate back office** | Broker platform |
|---|---|---|
| App | `affiliate-dashboard` — path `/`, port 20463 | `client-portal` (`/portal`), `broker-admin` (`/broker-admin`) |
| Who logs in | affiliates and staff admins | trading clients |
| Auth | `users` + `user_sessions`, SHA-256 | `broker_clients` + `broker_client_sessions`, bcrypt |
| Money | `commissions`, `payouts`, `payments` | `broker_wallets`, `broker_transactions` |
| Revenue source | Whop webhooks + sync (`lib/whop.ts`) | manual deposits, MT5 transfers |
| Status | **live** | built, never deployed (see `docs/SESSION-LOG.md`) |

---

## 🔴 Hazards — read before touching anything

### Affiliate back office — A to E

**A. The Whop webhook fails open, in two separate ways.**
`POST /api/webhooks/whop` is unauthenticated by design and protected only by an
HMAC check in `src/routes/webhooks.ts`. `verifyWhopSignature` returns **`true`**
when `WHOP_WEBHOOK_SECRET` is unset, and **`true` again** when no signature
header is present — each logging a warning and continuing. Under either
condition anyone who can reach the URL can forge membership and payment events,
and those create `commissions` rows. Both branches are deliberate (they exist so
data is not silently dropped) — so do not delete the warnings, and do not flip it
to fail-closed without first confirming the secret is really set in production.
`.claude/rules/GENERAL-secrets.md` records an outage caused by exactly that
change made in the wrong order.

**B. Affiliate money is `numeric(10,2)`, arrives as a string, and 25 existing
lines `parseFloat` it anyway** (across `adminAffiliates`, `adminCommissions`,
`adminMemberships`, `adminMisc`, `adminPayouts`, `affiliateDashboard`).
Hazard 2 below is the rule for broker money; the affiliate side predates it and
was never converted. **The rule here is do not add a 26th.** Sums that must be
exact belong in SQL, not in a `reduce` over floats.

**C. Affiliate and admin passwords are static-salt SHA-256** — one hard-coded
salt, one round, no per-user salt (`hashPassword`, `src/lib/auth.ts`). Known
weak, left alone **deliberately**: every existing password is stored this way and
changing the function locks all of them out. It needs a migration with
re-hash-on-login, not an in-passing "fix".

**D. `src/routes/adminMisc.ts` is 820 lines and 18 unrelated endpoints** — Whop
sync, backfills, user creation, commission-rule edits and four CSV exports. Its
name tells you nothing, which is precisely why things get dumped in it. **New
admin endpoints go in a purpose-named file.** Never extend this one.

**E. Four endpoints export customer data as CSV** —
`/api/admin/export/{customers,affiliates,commissions,payments}`, all
`requireAdmin`, all in `adminMisc.ts`. The guard is correct; the *output* is the
thing the repo rules forbid ever committing. Never write their response into the
working tree.

### Broker platform — 1 to 8

1. **Never run `drizzle-kit push` against the deployed database.** It carries
   17 `ntw_*` tables (a separate partner CRM sharing the DB) that are NOT in
   `lib/db/src/schema/` — push will propose dropping them all. New broker
   tables go through the idempotent `scripts/src/apply-broker-schema.ts`
   (create-only), run in **both** dev and prod databases. Push is fine against
   a local scratch Postgres only.
2. **Money is `numeric` and Drizzle returns it as a string. Keep it a string.**
   All arithmetic happens in SQL (`artifacts/api-server/src/lib/brokerLedger.ts`)
   or via the integer-cents helpers in `lib/integrations/mt5/src/money.ts`.
   Never `Number()` a balance.
3. **Wallet balances mutate only inside the same `db.transaction()` as a
   `broker_transactions` row** (insert or status transition). Decision UPDATEs
   guard `status='pending'` — that guard is the double-approval protection; do
   not "simplify" it away. Debits use a conditional UPDATE
   (`WHERE balance >= amount`) as the overdraft guard.
4. **Two separate auth systems, on purpose.** Affiliate/admin: `users` +
   `user_sessions`, legacy static-salt SHA-256 (`src/lib/auth.ts` — known-weak,
   left alone deliberately; fixing it mid-flight would lock out existing
   users). Trading clients: `broker_clients` + `broker_client_sessions`,
   bcrypt (`src/lib/clientAuth.ts`). Never mix middlewares or hash functions
   across them.
5. **MT5 goes only through `@workspace/mt5`** (`getMt5Provider()`, selected by
   `MT5_PROVIDER`, default mock). `broker_mt5_mock_accounts` is the mock's
   private state — the real Manager API never touches it. MT5 balances are
   never stored on `broker_trading_accounts`; always read through the adapter.
6. **KYC files never enter the repo.** They live in `KYC_UPLOAD_DIR`
   (default `.data/kyc-uploads`, gitignored, ephemeral on autoscale) and are
   served only through `requireAdmin` streaming endpoints.
7. **The Resend SDK does not throw on API errors** — check `result.error`.
   Broker emails (`src/lib/emailBroker.ts`) throw on failure by design;
   verification-code sends must never be silently swallowed.
8. **Generated code:** `lib/api-client-react/src/generated/` and
   `lib/api-zod/src/generated/` regenerate from `lib/api-spec/openapi.yaml`.
   Codegen loop: edit spec → `pnpm --filter @workspace/api-spec run codegen` →
   delete `lib/*/tsconfig.tsbuildinfo artifacts/*/tsconfig.tsbuildinfo` → root
   typecheck. Zod/type name collisions are resolved in `lib/api-zod/src/index.ts`'s
   explicit re-export list.

---

## Where things are

```
artifacts/api-server/          Express 5 API, everything mounted at /api (src/routes/index.ts)
  src/routes/                  ── AFFILIATE ──
                               public.ts        landing, apply, referral click tracking (NO guard)
                               auth.ts          login/logout/password reset (requireAuth on some)
                               webhooks.ts      Whop inbound (NO guard — HMAC only; Hazard A)
                               affiliateDashboard.ts   all 10 affiliate screens (requireAffiliate)
                               admin{Overview,Applications,Affiliates,Commissions,Payouts,
                                     Memberships,Finance,SupportTickets,Misc}.ts  (requireAdmin)
                               ── BROKER ──
                               client{Auth,Kyc,Funding,TradingAccounts}.ts
                               adminBroker{Kyc,Finance,Settings,TradingAccounts}.ts
  src/lib/                     auth.ts    affiliate/admin guards + hashPassword (Hazard C)
                               whop.ts    710 lines — Whop API, sync, commission creation
                               email.ts   affiliate email (Resend) + emailLogs
                               clientAuth.ts / brokerLedger.ts / brokerSettings.ts /
                               emailBroker.ts / fileStorage.ts   — broker side only
artifacts/affiliate-dashboard/ THE LIVE PRODUCT (path /, port 20463): 4 public pages,
                               10 affiliate pages, 14 admin pages
artifacts/client-portal/       trading-client SPA (path /portal, port 20464): signup funnel + portal
artifacts/broker-admin/        broker back-office SPA (path /broker-admin, port 20465)
artifacts/mockup-sandbox/      dev-only; pre-existing typecheck failures, not deployed with changes
lib/api-spec/openapi.yaml      THE API contract — source of truth for codegen (70 paths,
                               both platforms). ⚠️ NOT complete: adminMisc's exports, backfills,
                               whop/customers, whop/stats, sync/whop/full and the whole of
                               adminSupportTickets are absent. Add the path when you touch them.
lib/db/src/schema/             Drizzle schema. broker_* = trading platform; everything else
                               (affiliates, commissions, payouts, payments, whop*, referral*,
                               leadSignups, supportTickets, emailLogs, auditLogs) = affiliate
lib/integrations/mt5/          @workspace/mt5 adapter (mock + Manager API stub)
scripts/src/                   apply-broker-schema.ts, seed-broker.ts, seed-admin.ts
```

### Do not read these — machine-generated

```
lib/api-client-react/src/generated/   from lib/api-spec/openapi.yaml (Orval)
lib/api-zod/src/generated/            from lib/api-spec/openapi.yaml (Orval)
```

Editing them by hand is always wrong. If you find yourself reading them, stop.

---

## 🎯 Where to put new code

**This table is the point of the file.** Intent → directory.

**Affiliate back office** — the usual case:

| I want to add… | It goes in | Notes |
|---|---|---|
| an affiliate-facing API endpoint | `lib/api-spec/openapi.yaml` + `src/routes/affiliateDashboard.ts` | guard `requireAffiliate`; that file is 560 lines — if your addition is substantial, make a new `affiliate*.ts` router and mount it |
| an admin API endpoint | spec + a **purpose-named** `src/routes/admin<Thing>.ts` | guard `requireAdmin`; mount in `src/routes/index.ts`. **Never add to `adminMisc.ts`** — Hazard D |
| an affiliate or admin page | `affiliate-dashboard/src/pages/{affiliate,admin}/` + a `<ProtectedRoute>` line in `App.tsx` + a nav entry | shared bits → `src/components/` |
| a public / unauthenticated endpoint | spec + `src/routes/public.ts` | it is public — say why in the commit |
| commission logic | `src/lib/whop.ts` | commissions are created there, off Whop events — not in the route files |
| an affiliate email | `src/lib/email.ts` | writes `emailLogs`; broker emails stay in `emailBroker.ts` |
| an affiliate table | `lib/db/src/schema/<name>.ts` + export in `schema/index.ts` | ⚠️ no DDL script covers the affiliate tables — see Hazard 1 before you touch the deployed DB |

**Broker platform:**

| I want to add… | It goes in | Notes |
|---|---|---|
| a client-facing API endpoint | `lib/api-spec/openapi.yaml` + new/existing `artifacts/api-server/src/routes/client*.ts` | spec first, then codegen, then route; mount in `src/routes/index.ts` |
| a broker-admin API endpoint | spec + `src/routes/adminBroker*.ts` | guard with `requireAdmin` |
| a money movement | `src/lib/brokerLedger.ts` | never touch `broker_wallets.balance` anywhere else |
| a broker email | `src/lib/emailBroker.ts` | throws on failure; affiliate emails stay in `email.ts` |
| a client portal page | `artifacts/client-portal/src/pages/portal/` + a route line in `App.tsx` + a nav entry in `PortalLayout.tsx` | shared bits → `src/components/portal/` |
| a broker-admin page | `artifacts/broker-admin/src/pages/` + route + nav | settings panels → `src/components/settings/` |
| a table | `lib/db/src/schema/broker*.ts` + export in `schema/index.ts` + DDL in `scripts/src/apply-broker-schema.ts` | see Hazard 1 — never drizzle-kit push |
| MT5 behavior | `lib/integrations/mt5/` | keep the `Mt5Provider` interface stable |

**A page or screen file gets wiring only** — an import, a tab entry, a route
line. If your change to it is longer than four lines, it belongs in a new file.

**Never append to the end of a file because that is where the cursor already
is.** On a prior engagement that habit produced a single component of over five
thousand lines, and the metered agent was billed to read all of it on every
change.

---

## Finding the code for a screen

Rule of thumb: **screen name → same-named page file → route file → table.**

### Affiliate back office — `artifacts/affiliate-dashboard/src/pages/`

Every affiliate screen is served by ONE router, `routes/affiliateDashboard.ts`
(14 endpoints, `requireAffiliate`). Admin screens get one router each.

| Screen | URL | Page | API route file | Main table(s) |
|---|---|---|---|---|
| Landing / Apply | `/`, `/apply` | `public/LandingPage.tsx` | `routes/public.ts` | affiliateApplications, leadSignups, referralClicks |
| Login / Reset | `/login`, `/reset-password` | `public/LoginPage.tsx`, `public/ResetPasswordPage.tsx` | `routes/auth.ts` | users, userSessions, passwordResetTokens |
| Affiliate: Dashboard | `/dashboard` | `affiliate/Dashboard.tsx` | `routes/affiliateDashboard.ts` | commissions, payments, referralClicks |
| Affiliate: Links | `/dashboard/links` | `affiliate/Links.tsx` | `routes/affiliateDashboard.ts` | campaignLinks, referralClicks |
| Affiliate: Customers | `/dashboard/customers` | `affiliate/Customers.tsx` | `routes/affiliateDashboard.ts` | whopCustomers, whopMemberships, leadSignups |
| Affiliate: Commissions | `/dashboard/commissions` | `affiliate/Commissions.tsx` | `routes/affiliateDashboard.ts` | commissions, payments |
| Affiliate: Payouts | `/dashboard/payouts` | `affiliate/Payouts.tsx` | `routes/affiliateDashboard.ts` | payouts, commissions |
| Affiliate: Analytics | `/dashboard/analytics` | `affiliate/Analytics.tsx` | `routes/affiliateDashboard.ts` | referralClicks, commissions |
| Affiliate: Support | `/dashboard/support` | `affiliate/Support.tsx` | `routes/affiliateDashboard.ts` | supportTickets, supportTicketMessages |
| Affiliate: Profile / Security | `/dashboard/profile`, `/dashboard/security` | `affiliate/Profile.tsx`, `affiliate/Security.tsx` | `routes/affiliateDashboard.ts` | users, affiliates |
| Admin: Overview | `/admin` | `admin/Overview.tsx` | `routes/adminOverview.ts` **+ `adminMisc.ts`** (the Whop sync / backfill buttons) | commissions, payments, affiliates, referralClicks |
| Admin: Applications | `/admin/applications` | `admin/Applications.tsx` | `routes/adminApplications.ts` | affiliateApplications, users, affiliates |
| Admin: Affiliates | `/admin/affiliates`, `/admin/affiliates/:id` | `admin/Affiliates.tsx`, `admin/AffiliateDetail.tsx` | `routes/adminAffiliates.ts` | affiliates, affiliateCommissionRules, commissions, payouts |
| Admin: Commissions | `/admin/commissions` | `admin/Commissions.tsx` | `routes/adminCommissions.ts` | commissions, payments, whopCustomers |
| Admin: Payouts | `/admin/payouts` | `admin/Payouts.tsx` | `routes/adminPayouts.ts` | payouts, commissions |
| Admin: Memberships | `/admin/memberships`, `/admin/memberships/:id/detail` | `admin/Memberships.tsx`, `admin/CustomerDetail.tsx` | `routes/adminMemberships.ts` | whopMemberships, whopCustomers, payments |
| Admin: Customers | `/admin/customers` | `admin/Customers.tsx` | `routes/adminMisc.ts` (`/whop/customers`) | whopCustomers, whopMemberships |
| Admin: Finance | `/admin/finance` | `admin/Finance.tsx` | `routes/adminFinance.ts` **+ `adminMisc.ts`** (the CSV export buttons — Hazard E) | payments, commissions, whopMemberships |
| Admin: Analytics | `/admin/analytics` | `admin/Analytics.tsx` | `routes/adminOverview.ts` | commissions, payments, referralClicks |
| Admin: Audit / Email logs | `/admin/audit-logs`, `/admin/email-logs` | `admin/AuditLogs.tsx`, `admin/EmailLogs.tsx` | `routes/adminMisc.ts` | adminAuditLogs, emailLogs |
| Admin: Support tickets | `/admin/support-tickets` | `admin/SupportTickets.tsx` | `routes/adminSupportTickets.ts` | supportTickets, supportTicketMessages |

**Finding a page's API call:** most pages call a **generated hook**, not `fetch`
— `useGetAffiliateDashboard`, `useGetAdminOverview`, `useCreateCampaignLink`.
The hook name maps straight to the spec `operationId`, so grep
`lib/api-spec/openapi.yaml` for it rather than opening the generated client.
Pages that hit endpoints missing from the spec (Hazard D's exports, syncs and
whop/customers) use raw `fetch("/api/admin/...")` instead — those are the ones
to search by URL.

**The one screen that breaks the pattern is Admin: Customers** — it is served by
`adminMisc.ts`, not an `adminCustomers.ts`. That is Hazard D showing through.
Fix it by moving the route, not by adding more to `adminMisc.ts`.

### Broker platform

| Screen | Page | API route file | Main table(s) |
|---|---|---|---|
| Signup / Verify / Login | `client-portal/src/pages/public/*` | `routes/clientAuth.ts` | broker_clients, broker_email_codes, broker_client_sessions |
| Dashboard | `portal/DashboardPage.tsx` | `routes/clientFunding.ts` | broker_wallets, broker_transactions |
| Deposit | `portal/DepositPage.tsx` | `routes/clientFunding.ts` | broker_transactions, broker_settings |
| Withdraw | `portal/WithdrawPage.tsx` | `routes/clientFunding.ts` | broker_bank_accounts, broker_transactions |
| Transfer | `portal/TransferPage.tsx` | `routes/clientFunding.ts` | broker_transactions (+ MT5 adapter) |
| Trading Accounts | `portal/TradingAccountsPage.tsx` | `routes/clientTradingAccounts.ts` | broker_trading_accounts, broker_account_types |
| Verification (KYC) | `portal/VerificationPage.tsx` | `routes/clientKyc.ts` | broker_kyc_documents |
| Admin: Clients / KYC | `broker-admin/src/pages/Clients*.tsx` | `routes/adminBrokerKyc.ts` | broker_clients, broker_kyc_documents |
| Admin: Transactions | `broker-admin/src/pages/TransactionsPage.tsx` | `routes/adminBrokerFinance.ts` | broker_transactions |
| Admin: Settings | `broker-admin/src/pages/SettingsPage.tsx` | `routes/adminBrokerSettings.ts` | broker_settings, broker_account_types |

---

## Request path / auth boundary

```
artifacts/api-server/src/routes/index.ts — every router mounts here.
There is NO blanket auth middleware: each route carries its own guard.
  requireAuth / requireAdmin / requireAffiliate  (src/lib/auth.ts, affiliate side)
  requireClient                                  (src/lib/clientAuth.ts, trading clients)
Public by design: /healthz, /auth/*, /client/auth/*, webhooks, tracking.
```

**A new route without a guard is public.** Check which population it serves and
attach the matching middleware before anything else.

**Guard audit, measured — every endpoint as it stands today:**

| Router | Mount | Endpoints | Guard |
|---|---|---|---|
| `public.ts` | `/` | 4 | **none — public by design** |
| `webhooks.ts` | `/webhooks` | 1 | **none — HMAC only, and it fails open (Hazard A)** |
| `auth.ts` | `/auth` | 9 | `requireAuth` on the session-bearing ones |
| `affiliateDashboard.ts` | `/affiliate` | 14 | `requireAffiliate` |
| all 9 `admin*.ts` (affiliate) | `/admin*` | 47 | `requireAdmin` |
| all 4 broker `client*.ts` | `/client` | — | `requireClient` (except `/client/auth/*`) |
| all 4 `adminBroker*.ts` | `/admin/broker` | 14 | `requireAdmin` |

⚠️ **Four routers mount on the bare `/admin` prefix** — `adminOverview`,
`adminFinance`, `adminMisc`, `adminSupportTickets`. Express matches them in mount
order, so a path added to an earlier one **shadows** the same path in a later
one. If a new `/admin/...` endpoint returns someone else's handler, this is why.

---

## Background jobs

**The broker platform adds none.** Deposits/withdrawals are approved by a
human; transfers settle synchronously through the MT5 adapter; emails send
inline on the triggering request. If a poller/reconciler is ever added, gate
it behind `WORKERS_ENABLED` (see `.env.example` top block) and list it here.

| File | Cadence | What it does | Gated by |
|---|---|---|---|
| — none — | | | |

🔴 **Find the gate that stops these running, and put it in `.env.example` above
everything else.** On a prior engagement a documented safety property was false
at runtime: a worker on a development machine tried to write to live production
records within seconds of first boot, and only the read-only database role
stopped it.

**Assume they start. Prove otherwise before believing anything.**

---

## Commands

```bash
pnpm install                       # pnpm is enforced by a preinstall guard
pnpm run typecheck:libs            # libs — must be 0
pnpm --filter @workspace/api-server run typecheck        # must be 0
pnpm --filter @workspace/client-portal run typecheck     # must be 0
pnpm --filter @workspace/broker-admin run typecheck      # must be 0
pnpm --filter @workspace/affiliate-dashboard run typecheck
# NOTE: root `pnpm run typecheck` also runs mockup-sandbox, which fails on the
# base tree (pre-existing, dev-only). Use the per-package commands above.

pnpm --filter @workspace/api-server run build
PORT=20463 BASE_PATH=/              pnpm --filter @workspace/affiliate-dashboard run build   # THE LIVE APP
PORT=20464 BASE_PATH=/portal        pnpm --filter @workspace/client-portal run build
PORT=20465 BASE_PATH=/broker-admin  pnpm --filter @workspace/broker-admin run build
# Vite THROWS without PORT+BASE_PATH — that is deliberate, not a break.
# Check the CSS bundle size on frontend changes; green tests can't see styling.

# dev — for AFFILIATE work you need exactly these two processes:
DATABASE_URL=... PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev
PORT=20463 BASE_PATH=/ pnpm --filter @workspace/affiliate-dashboard run dev
# then open http://localhost:20463 — Vite proxies /api → :8080.

# 🔴 There is NO dev auth bypass. `.env.example` documents AUTH_DEV_BYPASS=1,
# but NOTHING IN THE CODE READS IT — grep confirms zero hits in api-server and
# affiliate-dashboard. Setting it does nothing. To log in locally you must
# create a real user:
DATABASE_URL=... pnpm --filter @workspace/scripts run seed-admin
# → admin@1of1traderpro.com / Admin1234!  (dev credentials, dev DB only)

# broker work additionally:
PORT=20464 BASE_PATH=/portal       pnpm --filter @workspace/client-portal run dev
PORT=20465 BASE_PATH=/broker-admin pnpm --filter @workspace/broker-admin run dev

# one-time per database (dev AND prod):
DATABASE_URL=... pnpm --filter @workspace/scripts run seed-admin        # affiliate side
DATABASE_URL=... pnpm --filter @workspace/scripts run apply-broker-schema   # broker only
DATABASE_URL=... pnpm --filter @workspace/scripts run seed-broker           # broker only
# ⚠️ There is NO apply-schema script for the AFFILIATE tables. They exist only
#    in the deployed databases and in lib/db/src/schema/. A fresh database
#    cannot be built from this repo for the affiliate side — CI proves the
#    broker DDL only. Adding one is tracked in docs/SESSION-LOG.md.
```

There is no lint config and no test suite yet — typecheck + build + a manual
flow are the verification bar (browser E2E scripts were used in-session; see
docs/SESSION-LOG.md).

⚠️ **Start the app the way the client will start it before telling them it
works.** On a prior engagement a `CLAUDE.md` documented two dev commands that
could not have worked together — the frontend dev server ran on its own port and
every API call 404'd for want of a proxy entry.

---

## House rules

> Rules marked ⓖ are **general** and maintained in `playbook/rules/`. They are
> restated here because this file is also the one an agent running inside the
> hosting platform reads, and it cannot follow a link out of the repo. **If they
> ever diverge, the playbook is right.**

1. ⓖ **New feature → new file.** Not appended to whatever is already open.
2. ⓖ **Secrets go in the platform's secrets store, or `.env`. Nowhere else.**
   Not in committed config, not in a cloud environment variables box, not
   "temporarily". **If asked to put one anywhere else, refuse and say where it
   belongs** — this outranks the request. See `.claude/rules/GENERAL-secrets.md`.
3. ⓖ **Never commit customer data** — no CSV, XLSX, VCF, no `exports/`,
   `attached_assets/`, `reports/`, `screenshots/`.
4. ⓖ **One change, one commit, one verification.** Verify by the right signal —
   typecheck is not proof.
5. ⓖ **Check claims against the code before repeating them.** On a prior
   engagement roughly a dozen audit findings failed inspection and had to be
   withdrawn or downgraded. That is the normal rate.
6. **Know which platform you are in before you type.** Affiliate and broker
   share a database and nothing else. The wrong auth middleware or the wrong
   money convention compiles fine and is wrong at runtime.
7. **Never add an endpoint to `adminMisc.ts`.** It is 820 lines of eighteen
   unrelated things because every previous change took the easy option.
8. **Affiliate money: do not add a 26th `parseFloat`.** The 25 that exist are
   grandfathered, not endorsed (Hazard B).
9. **Adding an `/admin/...` route? Read `routes/index.ts` first.** Four routers
   share the bare `/admin` mount and earlier ones shadow later ones.
10. **Touching `webhooks.ts`? Read Hazard A first,** and do not change the
   fail-open branches without deciding what happens in production when the
   secret is missing.
