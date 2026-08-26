import { pool } from "@workspace/db";

// Applies the indicator-customer portal schema with hand-written idempotent DDL.
//
// ⚠️ NEVER use `drizzle-kit push` on this database: the deployed DB carries 17
// ntw_* tables that are not in the TypeScript schema, and push would propose
// dropping them. This script CREATEs tables and performs exactly one widening
// ALTER (below), never drops. It is safe to run repeatedly. Run in BOTH the
// development and production databases BEFORE deploying customer-portal code —
// see .claude/rules/GENERAL-finishing-work.md for why creating a table in only
// one of them guarantees a destructive migration on the next publish.
//
// Scope note: this covers the four NEW customer tables and the support_tickets
// widening. It deliberately does not attempt DDL for the 19 pre-existing
// affiliate tables — those exist only in the deployed databases, and inventing
// DDL for them from the TypeScript schema risks disagreeing with production in
// ways nothing here could detect. That gap is tracked in docs/SESSION-LOG.md.

const enumDdl = `
DO $$ BEGIN
  CREATE TYPE customer_account_status AS ENUM ('pending_email', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tradingview_access_status AS ENUM ('pending', 'granted', 'rejected', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

const tableDdl = `
CREATE TABLE IF NOT EXISTS customer_accounts (
  id serial PRIMARY KEY,
  whop_user_id text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password_hash text,
  full_name text,
  status customer_account_status NOT NULL DEFAULT 'pending_email',
  email_verified_at timestamp,
  last_login_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_sessions (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  customer_account_id integer NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_email_codes (
  id serial PRIMARY KEY,
  customer_account_id integer NOT NULL,
  code text NOT NULL,
  purpose text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tradingview_access (
  id serial PRIMARY KEY,
  customer_account_id integer NOT NULL UNIQUE,
  tradingview_username text NOT NULL,
  status tradingview_access_status NOT NULL DEFAULT 'pending',
  requested_at timestamp NOT NULL DEFAULT now(),
  decided_at timestamp,
  decided_by_user_id integer,
  decision_note text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Session lookup happens on every authenticated customer request.
CREATE INDEX IF NOT EXISTS customer_sessions_token_idx ON customer_sessions (token);
CREATE INDEX IF NOT EXISTS customer_email_codes_account_idx ON customer_email_codes (customer_account_id);
-- The admin queue is "everything still pending", so it is worth an index.
CREATE INDEX IF NOT EXISTS tradingview_access_status_idx ON tradingview_access (status);
`;

// support_tickets predates customers: affiliate_id is NOT NULL and there is no
// requester discriminator. These three statements widen it to carry customer
// tickets too. All three are idempotent and none can lose data:
//   - ADD COLUMN IF NOT EXISTS is a no-op on a second run
//   - DROP NOT NULL on an already-nullable column is a no-op
//   - requester_type DEFAULTs to 'affiliate', so every pre-existing row is
//     correctly typed without an UPDATE sweeping the table
const alterDdl = `
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS requester_type text NOT NULL DEFAULT 'affiliate';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS customer_account_id integer;
ALTER TABLE support_tickets ALTER COLUMN affiliate_id DROP NOT NULL;
`;

const host = new URL(process.env.DATABASE_URL!).host;
console.log(`Applying customer-portal schema to: ${host}`);

await pool.query(enumDdl);
await pool.query(tableDdl);

// support_tickets is an affiliate table, so on a scratch database built only
// from apply-broker-schema it will not exist. Say so plainly instead of dying:
// the four customer tables above are still correctly created.
const { rows: existing } = await pool.query(
  `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'support_tickets'`
);
if (existing.length > 0) {
  await pool.query(alterDdl);
  console.log("support_tickets widened for customer tickets");
} else {
  console.log(
    "support_tickets not present — skipping the widening ALTER.\n" +
      "  Expected on a fresh scratch DB (no affiliate DDL exists in this repo).\n" +
      "  NOT expected against dev or production — if you see this there, stop."
  );
}

const { rows } = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
);
const names = rows.map((r: { tablename: string }) => r.tablename);
const customerTables = names.filter(
  (n: string) => n.startsWith("customer_") || n === "tradingview_access"
);
const ntwTables = names.filter((n: string) => n.startsWith("ntw_"));
console.log(`customer tables present (${customerTables.length}):`, customerTables.join(", "));
console.log(`ntw_* tables untouched (${ntwTables.length} present)`);

process.exit(0);
