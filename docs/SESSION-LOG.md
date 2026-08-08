# Session log — 1of1-trader-backoffice

**Every change made to this codebase: why, what it should do, and how it was
verified. Newest entry at the top.**

This is the client-facing record of the work. It is also what lets a session pick
this up cold without re-investigating things that have already been decided.

**Conventions** (from `playbook/PLAYBOOK.md` §9):

- Newest session at the top; **handoff block first**
- One entry per change, with the commit hash
- Always: **problem → change → expected result → how it was verified**
- Record what was **not** done and why — usually the more useful half
- Distinguish **MEASURED** from **INFERRED** in every claim
- **Corrections stay visible.** Never edit away a claim that was made and later
  withdrawn. On a prior engagement roughly a dozen findings had to be withdrawn
  or downgraded mid-audit — that is the normal rate, and a diagnosis is only as
  credible as the ideas it ruled out.

---

## 🔀 HANDOFF — read this first

**Status:** Building the forex-broker client platform (branch
`claude/forex-broker-crm-6pnzla`): signup site + client CRM portal + broker
admin, per the approved plan. Milestone commits land in order M1→M10; each
entry below says what was verified.
**Last verified:** per-entry, against a local Postgres 16 (cloud session cannot
reach the deployed DB over TCP — see `.claude/rules/GENERAL-querying-live-data.md`).
**Deployed?** No. Nothing in this branch is deployed.

### Resume order

1. Read the plan summary in Session 1 intro below, then continue with the next
   unfinished milestone (task list in the working session, M1→M10).

### Open

| Item | Why it matters | Blocked on |
|---|---|---|
| Apply `broker_*` DDL to dev AND prod databases before deploying broker code | New tables will not exist in production otherwise; the platform only auto-migrates its own agent's changes | Client running `pnpm --filter @workspace/scripts run apply-broker-schema` with each DB's URL (or pasting the SQL in the platform's Database pane, both DBs) |
| Real wire details + crypto deposit addresses | Deposit page shows placeholders until set in broker-admin Settings | Client input |
| MT5 Manager API credentials + real group names | Platform runs on the mock adapter until then (`MT5_PROVIDER=mock`) | Client input |
| Resend domain/sender for client-portal emails | Verification codes must actually deliver | Client input |
| Production KYC file storage | Local-disk storage is ephemeral on autoscale deployments; needs a persistent volume or object store | Client decision |

### Closed / declined — do not re-investigate

| Item | Why it was closed |
|---|---|
| Reusing the deployed `ntw_*` CRM for the trading-client portal | The NTW system (separate Replit app, not in this repo) is a *partner/IB* CRM; the client explicitly deferred IB/referrals and wants the trading-client surfaces, which exist nowhere. Schema snapshot kept as reference only. |
| `drizzle-kit push` for the new tables | Deployed DB has 17 `ntw_*` tables absent from this repo's TS schema; push would propose dropping them. Hand-written idempotent DDL script instead. |
| Fixing the affiliate auth's static-salt SHA-256 hashing in this branch | Pre-existing, separate surface; touching it mid-feature risks locking out existing users. Client auth uses bcrypt from the start. Flagged for its own change. |

### 🔴 Manual steps the client must do by hand

| Step | Why | Done? |
|---|---|---|
| Run the broker DDL in **both** Development and Production databases before publishing | See Open above; publish diffs prod against dev and would otherwise propose destructive drops | ☐ |
| Enter wire details + crypto addresses in broker-admin → Settings | Deposits show these to clients | ☐ |
| Verify Resend sending domain | Verification-code emails | ☐ |

---

## Session 1 — 2026-08-08

**Present:** Claude (cloud session), building from the approved plan in
`/root/.claude/plans/` (forex-broker client platform v1: public signup with
email-code verification, client CRM portal with KYC/deposit/withdraw/transfer/
MT5 trading accounts, broker admin with approval queues; MT5 through a mock
adapter until the real Manager API is supplied; wire + crypto-deposit-only
rails; Resend email).

### 1.6 — M7: trading accounts backend (KYC-gated MT5 provisioning)

**Problem.** Clients need to open MT5 accounts choosing an account type and
leverage — but only after the broker approves their identity.

**Change.** `routes/clientTradingAccounts.ts`: POST enforces
`kycStatus === "approved"` (403 otherwise), validates leverage against the
account type's catalog, provisions via `getMt5Provider().createAccount`, and
returns master/investor passwords exactly once (never stored). GET merges
live MT5 balance/equity best-effort — an adapter failure degrades to null
balances rather than a broken page. `routes/adminBrokerTradingAccounts.ts`:
all accounts joined with client + type + live balances.

**Expected result.** Account opening is impossible pre-KYC and self-service
post-KYC; balances shown are MT5's, never a stale copy.

**Verified by.** MEASURED via curl: pre-KYC create → 403; leverage 500 →
400 listing allowed values; create → login 200002 with both passwords;
client list shows live balances (200001 at 60.00 from the M6 transfers) and
a deliberately-broken login (999999) as null instead of an error; admin
list mirrors with client identity.

---

### 1.5 — M6: ledger + funding backend (deposit / withdraw / transfer)

**Problem.** The money core: clients submit wire/crypto deposit notices and
withdrawal requests that the broker approves; transfers between wallet and
MT5 settle instantly through the adapter. Balances must be impossible to
corrupt by concurrency or double-approval.

**Change.** `lib/brokerLedger.ts` — every wallet mutation happens in SQL on
the numeric column inside the same `db.transaction()` as its ledger row.
Debits use an atomic conditional UPDATE (`WHERE balance >= amount`) as the
overdraft guard; decisions guard `status='pending'` in the UPDATE so a second
decision matches zero rows (409). Deposit approve credits; withdrawal
request debits (hold), reject re-credits; wallet→MT5 debits + records
pending before calling the adapter, flipping to approved+ticket or (on
adapter failure) failed + compensating re-credit; MT5→wallet calls the
adapter first, then credits atomically. `lib/brokerSettings.ts` — Zod-typed
wire-details/crypto-addresses in broker_settings (validated on read AND
write). Routes: `clientFunding.ts` (dashboard, wallet, transactions,
deposit methods, deposits, bank accounts CRUD w/ soft delete, withdrawals,
transfers, account types), `adminBrokerFinance.ts` (joined transaction list,
decision + audit log + best-effort email), `adminBrokerSettings.ts`
(wire/crypto settings, account-types CRUD). `scripts/src/seed-broker.ts`
seeds Standard/Pro account types + placeholder deposit settings.

**Expected result.** Full funding lifecycle with a clean audit trail; no
code path can move money without a ledger row.

**Verified by.** MEASURED via curl against local Postgres + mock MT5: wire
deposit 500 pending (balance 0) → approve → 500.00; double-approve 409;
crypto deposit rejected leaves balance; withdrawal 200 holds (300.00),
reject re-credits (500.00), second withdrawal approved leaves 350.00;
overdraft withdrawal 400; transfer 100→MT5 (wallet 250, MT5 100.00, ticket
recorded), 40 back (290.00/60.00); MT5 overdraw and wallet overdraw both
400; transfer against a nonexistent MT5 login → 502, wallet unchanged
(290.00), ledger row `transfer_to_mt5/failed`. Amount validation rejects
3-dp values.

---

### 1.4 — M5: KYC backend (upload + admin review)

**Problem.** Clients must upload identity documents and be blocked from
opening MT5 accounts until the broker approves them; the broker needs a
review queue with the documents viewable. Identity files must never enter the
repo or be publicly reachable.

**Change.** `lib/fileStorage.ts` — local-disk store behind a 3-function
interface, dir from `KYC_UPLOAD_DIR` (default `.data/kyc-uploads`, now
gitignored), UUID filenames, mode 600, path-traversal-safe reads.
`routes/clientKyc.ts` — GET /client/kyc, POST /client/kyc/documents (multer
memory storage, 10 MB, JPEG/PNG/WebP/PDF only); an upload flips overall
kycStatus none/rejected → pending (approved is not reset). 
`routes/adminBrokerKyc.ts` — client list w/ kycStatus+search filters, client
detail w/ docs + wallet balance + account count, kyc-decision
(approve/reject + notes → mirrors onto pending docs, writes
admin_audit_logs, best-effort decision email), authenticated file streaming.
Spec + codegen (one more zod ambiguity re-export; api-zod tsconfig gains
`lib: ["dom", ...]` matching api-client-react, needed for the generated
multipart Blob type).

**Expected result.** Upload → pending → admin review → approve/reject loop
works; files live outside the repo, served only through requireAdmin.

**Verified by.** MEASURED via curl: PNG upload 201 and lands in
KYC_UPLOAD_DIR as UUID.png; .exe rejected 400; kycStatus flips to pending;
admin pending-filter lists the client; document streams 200 image/png with
auth and 401 without; approve → client sees approved + notes;
admin_audit_logs row `kyc_approved/broker_client/1`. Local scratch DB was
recreated with the full schema (drizzle push against the LOCAL dev DB only —
the deployed-DB prohibition stands) and `apply-broker-schema` re-verified
idempotent against it.

---

### 1.3 — M3: trading-client auth backend

**Problem.** Trading clients need signup with email-code verification and
login, fully separate from affiliate auth (whose static-salt SHA-256 hashing
must not be inherited).

**Change.** `openapi.yaml` gains tags `client-auth`/`client`/`broker-admin`
and the 7 client-auth endpoints; Orval codegen re-run (two zod name
ambiguities resolved via the existing explicit re-export list in
`lib/api-zod/src/index.ts`). New `lib/clientAuth.ts` (bcrypt cost 12, opaque
64-hex session tokens in `broker_client_sessions`, `requireClient`
middleware), `lib/emailBroker.ts` (broker emails that THROW on failure —
Resend `result.error` inspected; decision emails best-effort), and
`routes/clientAuth.ts` (register → hashed 6-digit code, 10-min expiry, 5
attempts, 60s resend throttle → verify returns one-time set-password token,
30-min TTL, cleared on use → set-password activates + auto-login; login;
logout; /client/me). Wallet row created at verification
(`onConflictDoNothing`). `email.ts` credentials became env-first
(`RESEND_API_KEY`/`RESEND_FROM_EMAIL`) with the Replit connector as fallback,
so the app runs outside Replit; in development a failed send logs the code so
signup is testable.

**Expected result.** Full signup → verify → password → login flow works; auth
is bcrypt-based and isolated from affiliate auth.

**Verified by.** MEASURED via curl against the built server + local Postgres:
register 201; wrong code 400 (attempts increment); right code returns token;
set-password returns session + activates; /client/me 200; login 200; wrong
password 401; set-password token replay 400; `broker_wallets` row created
with balance "0.00". Typecheck + build clean.

---

### 1.2 — M2: MT5 adapter package (`@workspace/mt5`)

**Problem.** Trading-account provisioning and balance operations must work now,
but the real MT5 Manager API credentials don't exist yet. Callers must not
change when they arrive.

**Change.** New workspace package `lib/integrations/mt5` (the
`lib/integrations/*` glob already existed): `Mt5Provider` interface
(createAccount / deposit / withdraw / getAccountInfo / getAccountsInfo /
changeLeverage, money as decimal strings), a DB-backed `MockMt5Provider`
persisting simulated accounts in `broker_mt5_mock_accounts` (state survives
restarts; equity == balance, no positions simulated), a `ManagerMt5Provider`
stub that throws `Mt5NotConfiguredError`, and `getMt5Provider()` selecting via
`MT5_PROVIDER` env (default `mock`). Integer-cents string math in
`src/money.ts`. Registered in root + api-server tsconfig references and
api-server deps.

**Expected result.** All MT5 calls flow through one interface; swapping in the
real Manager API later = implement `managerProvider.ts` + set
`MT5_PROVIDER=manager`, no caller changes.

**Verified by.** MEASURED: tsx smoke test against local Postgres — created
account got sequential login 100001, deposit 150.25 → balance "150.25",
withdraw 50.25 → "100.00", overdraft of 1000.00 threw
`Mt5InsufficientFundsError`, second account got login 100002. `typecheck:libs`
and api-server typecheck clean.

---

### 1.1 — M1: broker schema + safe DDL script

**Problem.** The trading-client platform needs its own data model. The deployed
DB additionally carries 17 `ntw_*` tables that are not in this repo's Drizzle
schema, so the normal `drizzle-kit push` route is forbidden (it would propose
dropping them) — MEASURED by reading `lib/db/drizzle/meta/0000_snapshot.json`.

**Change.** 11 new Drizzle schema files in `lib/db/src/schema/` (all tables
prefixed `broker_`: clients, client_sessions, email_codes, kyc_documents,
wallets, bank_accounts, transactions ledger, trading_accounts, account_types,
settings, mt5_mock_accounts) exported from `schema/index.ts`, plus a
hand-written idempotent DDL script `scripts/src/apply-broker-schema.ts`
(guarded `CREATE TYPE`, `CREATE TABLE/INDEX IF NOT EXISTS`; creates only,
never drops or alters).

**Expected result.** ORM types available to api-server; running the script
against any of the databases creates the 11 tables without touching anything
else, and is safe to run twice.

**Verified by.** MEASURED: script run twice against a local Postgres 16 —
first run created all 11 tables, second run changed nothing and errored
nothing; `pnpm run typecheck:libs`, scripts, api-server and
affiliate-dashboard typechecks all clean. (`mockup-sandbox` typecheck fails on
the untouched base tree too — pre-existing, not from this change.)

---

### Considered and NOT done

| Considered | Why not |
|---|---|
| Balances derived by summing the ledger on every read | Stored balance + append-only ledger with atomic transitions is simpler to query and equally safe given the invariant: balance mutates only in the same DB transaction as a ledger insert/transition. |
| Per-flow tables (deposits, withdrawals, transfers) | One `broker_transactions` ledger with `type`+`status` gives one admin queue, one history query, one state-machine helper. |
| Storing MT5 balance/equity on `broker_trading_accounts` | Would rot instantly; always read through the adapter. |

---

### Corrections to earlier entries

| Entry | What it claimed | What is actually true |
|---|---|---|
| — | | |
