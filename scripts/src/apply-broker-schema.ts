import { pool } from "@workspace/db";

// Applies the broker_* schema with hand-written idempotent DDL.
//
// ⚠️ NEVER use `drizzle-kit push` on this database: the deployed DB carries 17
// ntw_* tables that are not in the TypeScript schema, and push would propose
// dropping them. This script only CREATEs, never drops or alters, and is safe
// to run repeatedly. Run in BOTH development and production databases before
// deploying broker code (see .claude/rules/GENERAL-finishing-work.md).

const enumDdl = `
DO $$ BEGIN
  CREATE TYPE broker_client_status AS ENUM ('pending_email', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_kyc_doc_type AS ENUM ('id_front', 'id_back', 'proof_of_address');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_kyc_doc_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_tx_type AS ENUM ('deposit_wire', 'deposit_crypto', 'withdrawal', 'transfer_to_mt5', 'transfer_from_mt5', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_tx_status AS ENUM ('pending', 'approved', 'rejected', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE broker_trading_account_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
`;

const tableDdl = `
CREATE TABLE IF NOT EXISTS broker_clients (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text,
  full_name text NOT NULL,
  phone text,
  country text,
  status broker_client_status NOT NULL DEFAULT 'pending_email',
  email_verified_at timestamp,
  kyc_status broker_kyc_status NOT NULL DEFAULT 'none',
  kyc_notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  last_login_at timestamp
);

CREATE TABLE IF NOT EXISTS broker_client_sessions (
  id serial PRIMARY KEY,
  token text NOT NULL UNIQUE,
  client_id integer NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broker_email_codes (
  id serial PRIMARY KEY,
  email text NOT NULL,
  client_id integer,
  code_hash text NOT NULL,
  purpose text NOT NULL DEFAULT 'verify_email',
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamp NOT NULL,
  consumed_at timestamp,
  set_password_token text UNIQUE,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broker_email_codes_email_idx ON broker_email_codes (email);

CREATE TABLE IF NOT EXISTS broker_kyc_documents (
  id serial PRIMARY KEY,
  client_id integer NOT NULL,
  doc_type broker_kyc_doc_type NOT NULL,
  original_name text NOT NULL,
  stored_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  status broker_kyc_doc_status NOT NULL DEFAULT 'pending',
  review_notes text,
  reviewed_by integer,
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broker_kyc_documents_client_idx ON broker_kyc_documents (client_id);

CREATE TABLE IF NOT EXISTS broker_wallets (
  id serial PRIMARY KEY,
  client_id integer NOT NULL UNIQUE,
  currency text NOT NULL DEFAULT 'USD',
  balance numeric(14,2) NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broker_bank_accounts (
  id serial PRIMARY KEY,
  client_id integer NOT NULL,
  beneficiary_name text NOT NULL,
  bank_name text NOT NULL,
  iban text,
  account_number text,
  swift text,
  currency text NOT NULL DEFAULT 'USD',
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broker_bank_accounts_client_idx ON broker_bank_accounts (client_id);

CREATE TABLE IF NOT EXISTS broker_transactions (
  id serial PRIMARY KEY,
  client_id integer NOT NULL,
  wallet_id integer NOT NULL,
  type broker_tx_type NOT NULL,
  status broker_tx_status NOT NULL DEFAULT 'pending',
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  reference text,
  crypto_coin text,
  crypto_txid text,
  bank_account_id integer,
  trading_account_id integer,
  mt5_ticket text,
  client_note text,
  admin_notes text,
  decided_by integer,
  decided_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broker_transactions_client_created_idx ON broker_transactions (client_id, created_at);
CREATE INDEX IF NOT EXISTS broker_transactions_status_type_idx ON broker_transactions (status, type);

CREATE TABLE IF NOT EXISTS broker_trading_accounts (
  id serial PRIMARY KEY,
  client_id integer NOT NULL,
  mt5_login text NOT NULL UNIQUE,
  account_type_id integer NOT NULL,
  leverage integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status broker_trading_account_status NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broker_trading_accounts_client_idx ON broker_trading_accounts (client_id);

CREATE TABLE IF NOT EXISTS broker_account_types (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  mt5_group text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  min_deposit numeric(14,2) NOT NULL DEFAULT '0',
  leverages jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broker_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by integer,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broker_mt5_mock_accounts (
  login text PRIMARY KEY,
  name text NOT NULL,
  group_name text NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  leverage integer NOT NULL,
  balance numeric(14,2) NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT now()
);
`;

const host = new URL(process.env.DATABASE_URL!).host;
console.log(`Applying broker schema to: ${host}`);

await pool.query(enumDdl);
await pool.query(tableDdl);

const { rows } = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
);
const names = rows.map((r: { tablename: string }) => r.tablename);
const brokerTables = names.filter((n: string) => n.startsWith("broker_"));
const ntwTables = names.filter((n: string) => n.startsWith("ntw_"));
console.log(`broker_* tables present (${brokerTables.length}):`, brokerTables.join(", "));
console.log(`ntw_* tables untouched (${ntwTables.length} present)`);

process.exit(0);
