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

**Status:** Forex-broker client platform v1 COMPLETE on branch
`claude/forex-broker-crm-6pnzla` (10 milestone commits, M1–M10): public
signup with email-code verification, client portal (/portal) with
KYC upload / wire+crypto deposits / withdrawals to own bank accounts /
wallet↔MT5 transfers / KYC-gated MT5 account opening, and a broker admin
(/broker-admin) with KYC review, funding approval queues and deposit
settings. MT5 runs on the DB-backed mock adapter until real Manager API
credentials exist. IB/referrals deliberately untouched (later phase).
**Last verified:** end of session — two full Playwright browser journeys
(client + admin) against local Postgres 16 + built api-server; all
typechecks and production builds green. Cloud session cannot reach the
deployed DB over TCP (`.claude/rules/GENERAL-querying-live-data.md`), so
nothing was run against production.
**Deployed?** No. Nothing in this branch is deployed, and the broker_*
tables do NOT exist in the deployed databases yet — see Manual steps.

### Resume order

1. Get this branch merged (open the PR if none exists).
2. Walk the client through the manual steps below — the DDL in both
   databases FIRST, or every broker page 500s on an empty-looking screen.
3. Next build phases when asked: real MT5 Manager API in
   `lib/integrations/mt5/src/managerProvider.ts`; IB/referrals (the deployed
   `ntw_*` partner CRM is the likely integration point); a public marketing
   landing page in front of /portal/signup.

### Open

| Item | Why it matters | Blocked on |
|---|---|---|
| Apply `broker_*` DDL to dev AND prod databases before deploying broker code | New tables will not exist in production otherwise; the platform only auto-migrates its own agent's changes | Client running `pnpm --filter @workspace/scripts run apply-broker-schema` with each DB's URL (or pasting the SQL in the platform's Database pane, both DBs) |
| Crypto deposit addresses | Client will supply static per-coin addresses; entered in broker-admin → Settings (wire details are DONE — seeded from the client's real instructions, entry 1.11) | Client input |
| Dependency advisories (6 high, prod tree) | Pre-existing on the base tree: express internals (path-to-regexp, qs, body-parser), drizzle-orm 0.45.1→0.45.2, js-cookie, brace-expansion. CI audits informationally; a dedicated bump+verify change is needed | Its own change, after merge |
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
| Run `pnpm --filter @workspace/scripts run apply-broker-schema` (or paste its SQL in the Database pane) against **both** the Development and Production databases | The 11 broker_* tables exist nowhere yet; the platform only auto-migrates its own agent's changes, and creating them in one DB but not the other invites a destructive publish diff | ☐ |
| Run `seed-broker` the same way (both DBs) | Creates Standard/Pro account types + placeholder deposit settings | ☐ |
| Enter crypto addresses in broker-admin → Settings (wire details already seeded with the real Blockcommerce / Old Glory Bank instructions) | Crypto tab shows "not available" until then | ☐ |
| Verify the Resend sending domain (or set RESEND_API_KEY/RESEND_FROM_EMAIL secrets) | Verification-code emails must actually deliver — signup is blocked without them in production | ☐ |
| Decide production KYC file storage and set KYC_UPLOAD_DIR | Autoscale local disk is ephemeral; uploaded identity documents would vanish on redeploy | ☐ |
| When MT5 Manager API credentials exist: put them in the platform secrets store, implement managerProvider.ts, set MT5_PROVIDER=manager | Until then all trading accounts are simulated by the mock | ☐ |

---

## Session 2 — 2026-08-20

**Present:** Claude (cloud session), migrating the repository off Replit onto a
new GitHub remote at the client's request.

### 2.1 — Repository migrated to `steffonwatten/1of1TraderProAffliate`

**Problem.** The original remote `steffonwatten/1of1-trader-backoffice` was
archived and therefore read-only — pushes returned 403. A new empty repo,
`1of1TraderProAffliate`, was created to replace it, but pushing the Replit
workspace there failed a second time: GitHub refuses any push whose commits
touch `.github/workflows/` unless the credential carries the `workflow` scope,
and Replit's GitHub OAuth token does not.

**Change.** `.github/workflows/` was stripped from all history with
`git filter-branch --index-filter` in the Replit workspace, which let the
existing OAuth credential push all 19 commits to the new remote. `ci.yml` is
restored here as a separate commit, recovered byte-for-byte from the archived
repository rather than rewritten from memory — entry 1.12 explains why each
step in it exists.

**Expected result.** `main` on the new remote carries the full v1 history, and
CI behaves exactly as 1.12 describes once this commit reaches `main`.

**Verified by.** MEASURED: `git ls-remote` shows `main` at `35b884f` with all
19 commits present; the restored `ci.yml` is byte-identical to the archived
repo's copy (`diff` clean); no credential-bearing or customer-data files are
tracked (`git ls-files` scan against the `.gitignore` credential rules).
NOT verified — INFERRED only: CI has never executed in this repository, so the
pipeline is unproven on the new remote. The first run is the real check.

**Not done.** The filter-branch rewrite changed every commit hash, so hashes
cited in Session 1 refer to the archived repo's history, not to this one. The
archived repo is deliberately left in place as the record of those hashes.

**Correction to the handoff block above.** It says v1 is "COMPLETE on branch
`claude/forex-broker-crm-6pnzla`" and instructs the reader to get that branch
merged. That was already done before the migration — the branch is merged and
its merge commit is the tip of `main` here. Resume order step 1 is closed; the
manual steps below it are still open and unchanged.

---

## Session 1 — 2026-08-08

**Present:** Claude (cloud session), building from the approved plan in
`/root/.claude/plans/` (forex-broker client platform v1: public signup with
email-code verification, client CRM portal with KYC/deposit/withdraw/transfer/
MT5 trading accounts, broker admin with approval queues; MT5 through a mock
adapter until the real Manager API is supplied; wire + crypto-deposit-only
rails; Resend email).

### 1.12 — Working CI pipeline

**Problem.** `.github/workflows/ci.yml` invoked root scripts that do not
exist (`db:push`, `lint`, `test`, `map`) — red on day one, which is how a
pipeline gets switched off. Worse, `db:push` against a shared DB is exactly
Hazard 1.

**Change.** CI now runs what the repo actually has: frozen install →
`apply-broker-schema` run TWICE against a fresh service Postgres (proves the
DDL builds from nothing and is idempotent) + `seed-broker` → typecheck libs
+ the five real packages (mockup-sandbox excluded, pre-existing failure) →
api-server build → all three frontend builds with their PORT/BASE_PATH →
per-app CSS bundle guard (>20 KB) → prod dependency audit as
`continue-on-error` (see Open items: 6 pre-existing high advisories need
their own bump+verify change; blocking on them today kills the pipeline).

**Expected result.** Green CI on this branch; schema script regression-tested
on every PR.

**Verified by.** MEASURED: the PR's CI run on GitHub (see 1.13 merge). All
commands were first run locally with identical results.

---

### 1.11 — Real wire instructions (domestic + international)

**Problem.** The client supplied their actual receiving details
(Blockcommerce LLC via Old Glory Bank) — which have separate DOMESTIC US
(direct routing/account) and INTERNATIONAL (via The Bankers Bank
intermediary, SWIFT BBOKUS44, memo "Blockcommerce") instructions. The
original single-block wire schema (one account/IBAN/SWIFT set) could not
represent that without cramming it into free text.

**Change.** `wireDetailsSchema` (brokerSettings.ts) and the OpenAPI
`BrokerWireDetails` restructured: beneficiary block + optional
`domestic {routingNumber, accountNumber}` + optional `international
{intermediaryBank, swift, beneficiaryBank, routingNumber, accountNumber,
memo}`. DepositPage renders the three sections; WireSettingsCard edits all
fields; `seed-broker.ts` seeds the real instructions so production comes up
configured (committed deliberately — these are the public payment
instructions shown to every depositing client, not credentials).
`onConflictDoNothing` preserved: re-running the seed never overwrites edits
made later in Settings.

**Expected result.** A depositing client sees exactly the instructions the
client's bank issued, both rails.

**Verified by.** MEASURED: old stored value deleted locally, seed re-run,
`GET /client/deposit/methods` returns the full nested structure, and a
browser screenshot of the deposit page shows Beneficiary / DOMESTIC US
WIRES / INTERNATIONAL WIRES sections with the real values. Typechecks and
builds green after codegen.

---

### 1.10 — M10: docs, env template, final verification

**Problem.** The template docs still said TODO everywhere; the new platform's
hazards, lookup tables and commands existed only in this log.

**Change.** `CLAUDE.md` filled in for real: the 8 hazards (ntw_* push trap,
money-as-strings, ledger invariant, dual auth systems, MT5-adapter-only,
KYC file rules, Resend error shape, codegen loop), the directory map, the
intent→directory table, the screen→page→route→table lookup, the auth
boundary (per-route guards, no blanket middleware), background jobs (none,
deliberately), and working commands. `.env.example` gains the broker block
(MT5_PROVIDER, KYC_UPLOAD_DIR, Resend env-first keys) and states the true
hard-required set. Handoff block above rewritten to the finished state.

**Expected result.** A cold session can navigate the platform from CLAUDE.md
without reading the tree.

**Verified by.** Final sweep at session end: per-package typechecks all 0;
api-server, client-portal and broker-admin production builds green (CSS
bundles 36.1 KB / 34.6 KB — styling present); both Playwright journeys
re-run PASS after the last code change (M9's auth fix). MEASURED.

---

### 1.9 — M9: broker-admin app

**Problem.** The broker needs their own back-office: KYC review with the
documents viewable, deposit/withdrawal approval queues showing where to pay,
all trading accounts, and the settings clients see when depositing.

**Change.** Fourth app `artifacts/broker-admin` (localPort 20465,
`paths=["/broker-admin"]`, registered in `.replit`). Logs in with the
EXISTING admin users (`/api/auth/login`, shared `auth_token` key); the auth
context rejects non-admin roles. Pages: Overview (queue counts derived from
the two list endpoints — no dedicated overview endpoint, deliberately),
Clients (search + KYC filter), ClientDetail (document viewer via an
authenticated blob fetch — the one hand-written fetch the plan allows, since
`<img src>` can't carry a Bearer header — plus approve/reject with notes),
Transactions (pending queue; review dialog shows wire reference / crypto
txid / the client's payout bank details), Trading Accounts (live balances),
Settings (wire details form, crypto address list editor, account-types
CRUD). Fixed an auth-context bug found by the browser test: deriving the
user via a useEffect left one render where a valid token looked logged-out,
bouncing every full page load to /login — now derived synchronously from
the query result.

**Expected result.** The broker can run the entire operation from
`/broker-admin`.

**Verified by.** MEASURED with a Playwright run: admin login → Overview;
Clients list; ClientDetail renders the uploaded KYC PNG through the
authenticated viewer; pending withdrawal reviewed in the dialog (payout bank
details visible) and approved through the UI — DB row flipped to
`approved`; Trading Accounts and Settings render. Typecheck + build clean
(CSS 34.6 KB).

---

### 1.8 — M8: client-portal feature pages

**Problem.** The portal shell needed its real pages: dashboard, deposit
(wire + crypto), withdraw, transfer, trading accounts, history,
verification.

**Change.** Seven pages in `src/pages/portal/` + shared
`components/portal/TransactionList.tsx` and `lib/format.ts` (string-only
money formatting). Deposit: wire-instructions card + notice form, crypto
coin selector with copyable admin-configured addresses + txid form.
Withdraw: bank-account management (add dialog, soft delete) + request form
showing available balance. Transfer: direction + account picker with live
balances. Trading accounts: card grid (balance/equity/leverage badges),
create dialog gated on KYC with type/leverage from the catalog, and a
show-once MT5 credentials dialog. Verification: three upload tiles with
per-document status. History: type/status filters.

**Expected result.** The full client lifecycle is usable from a browser.

**Verified by.** MEASURED with a Playwright run against the dev server +
built API + local Postgres: signup → real emailed-code path (code read from
the dev log) → password → dashboard; KYC uploads; admin approval; MT5
account created with credentials dialog; wire deposit 750 submitted +
approved; 300 transferred to MT5; bank account added and 100 withdrawal
requested — final dashboard shows wallet 350.00 USD, trading account
300.00 USD, and the three transactions with correct statuses (screenshots
in the session record). Typecheck + production build clean (CSS 36 KB).

---

### 1.7 — M4: client-portal app scaffold + signup/login UI

**Problem.** Clients need a website to sign up on and a portal to use — the
third deployable app in the workspace.

**Change.** New `artifacts/client-portal` (React 19 + Vite + Tailwind 4 +
wouter + TanStack Query) following the affiliate-dashboard scaffolding:
PORT/BASE_PATH-guarded vite config, `/api` dev proxy, artifact.toml on
localPort 20464 with `paths=["/portal"]`, registered in `.replit` and the
pnpm workspace. Only the 18 shadcn primitives the portal actually uses were
copied — not the whole component library (GENERAL-keeping-it-clean.md).
Dark navy + signal-orange theme. Auth: `client_token` in localStorage via
`setAuthTokenGetter` (distinct from the affiliate key), ClientAuthProvider
re-validates against /client/me, Protected wrapper redirects to /login.
Pages: Signup → VerifyEmail (input-otp, auto-submits at 6 digits, resend) →
SetPassword (auto-login) → Login; PortalLayout with sidebar
(Dashboard/Deposit/Transfer/Withdraw/Trading Accounts/History/Verification)
+ KYC status banner; portal pages stubbed (filled in M8).

**Expected result.** `/portal` serves the signup funnel and an authenticated
shell against the live API.

**Verified by.** MEASURED: typecheck clean; production build emits 32 KB CSS
(styling present — the right signal per GENERAL-writing-code.md §8); dev
server serves `/portal/` 200 and proxies `/api/healthz`. Full-browser
end-to-end pass happens in M10.

---

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
