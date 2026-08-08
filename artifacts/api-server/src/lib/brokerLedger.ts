import {
  db,
  brokerWalletsTable,
  brokerTransactionsTable,
  BrokerTransaction,
  BrokerWallet,
} from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import type { Mt5Provider } from "@workspace/mt5";

// The money engine. INVARIANT (see brokerWallets.ts): a wallet balance changes
// only inside the same db.transaction() as the ledger row it explains.
// Debits happen at request time (hold), credits at approval; rejecting a debit
// re-credits. All balance arithmetic happens IN SQL on the numeric column —
// amounts never round-trip through JS floats.

export class WalletNotFoundError extends Error {
  constructor() {
    super("Wallet not found");
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient wallet balance");
  }
}

export class AlreadyDecidedError extends Error {
  constructor() {
    super("Transaction is not pending");
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function getWallet(clientId: number): Promise<BrokerWallet> {
  const rows = await db
    .select()
    .from(brokerWalletsTable)
    .where(eq(brokerWalletsTable.clientId, clientId))
    .limit(1);
  if (!rows[0]) throw new WalletNotFoundError();
  return rows[0];
}

function credit(tx: Tx, walletId: number, amount: string) {
  return tx
    .update(brokerWalletsTable)
    .set({
      balance: sql`${brokerWalletsTable.balance} + ${amount}::numeric`,
      updatedAt: new Date(),
    })
    .where(eq(brokerWalletsTable.id, walletId))
    .returning({ balance: brokerWalletsTable.balance });
}

// Atomic conditional debit: the WHERE clause is the overdraft guard, so two
// concurrent withdrawals cannot both pass a read-then-write check.
async function debitIfSufficient(tx: Tx, walletId: number, amount: string): Promise<string> {
  const rows = await tx
    .update(brokerWalletsTable)
    .set({
      balance: sql`${brokerWalletsTable.balance} - ${amount}::numeric`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(brokerWalletsTable.id, walletId), gte(brokerWalletsTable.balance, amount))
    )
    .returning({ balance: brokerWalletsTable.balance });
  if (!rows[0]) throw new InsufficientBalanceError();
  return rows[0].balance;
}

export interface DepositInput {
  clientId: number;
  walletId: number;
  type: "deposit_wire" | "deposit_crypto";
  amount: string;
  currency: string;
  reference?: string | null;
  cryptoCoin?: string | null;
  cryptoTxid?: string | null;
  clientNote?: string | null;
}

// A deposit notice moves no money — the wallet is credited when (and only
// when) the broker approves it.
export async function submitDeposit(input: DepositInput): Promise<BrokerTransaction> {
  const inserted = await db
    .insert(brokerTransactionsTable)
    .values({
      clientId: input.clientId,
      walletId: input.walletId,
      type: input.type,
      status: "pending",
      amount: input.amount,
      currency: input.currency,
      reference: input.reference ?? null,
      cryptoCoin: input.cryptoCoin ?? null,
      cryptoTxid: input.cryptoTxid ?? null,
      clientNote: input.clientNote ?? null,
    })
    .returning();
  return inserted[0];
}

export interface WithdrawalInput {
  clientId: number;
  walletId: number;
  amount: string;
  currency: string;
  bankAccountId: number;
}

export async function requestWithdrawal(
  input: WithdrawalInput
): Promise<{ transaction: BrokerTransaction; walletBalance: string }> {
  return db.transaction(async (tx) => {
    const walletBalance = await debitIfSufficient(tx, input.walletId, input.amount);
    const inserted = await tx
      .insert(brokerTransactionsTable)
      .values({
        clientId: input.clientId,
        walletId: input.walletId,
        type: "withdrawal",
        status: "pending",
        amount: input.amount,
        currency: input.currency,
        bankAccountId: input.bankAccountId,
      })
      .returning();
    return { transaction: inserted[0], walletBalance };
  });
}

// Approve/reject a pending deposit or withdrawal. The status='pending' guard
// in the UPDATE is what makes double-approval impossible — the second decision
// matches zero rows and throws AlreadyDecidedError.
export async function decideTransaction(
  transactionId: number,
  adminId: number,
  decision: "approved" | "rejected",
  adminNotes: string | null
): Promise<BrokerTransaction> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(brokerTransactionsTable)
      .set({ status: decision, adminNotes, decidedBy: adminId, decidedAt: new Date() })
      .where(
        and(
          eq(brokerTransactionsTable.id, transactionId),
          eq(brokerTransactionsTable.status, "pending")
        )
      )
      .returning();
    const transaction = updated[0];
    if (!transaction) throw new AlreadyDecidedError();

    if (transaction.type === "deposit_wire" || transaction.type === "deposit_crypto") {
      if (decision === "approved") {
        await credit(tx, transaction.walletId, transaction.amount);
      }
    } else if (transaction.type === "withdrawal") {
      if (decision === "rejected") {
        // The hold was taken at request time; a rejection returns it.
        await credit(tx, transaction.walletId, transaction.amount);
      }
    } else {
      // Transfers settle instantly against MT5 and are never decidable.
      throw new AlreadyDecidedError();
    }
    return transaction;
  });
}

export interface TransferInput {
  clientId: number;
  walletId: number;
  tradingAccountId: number;
  mt5Login: string;
  amount: string;
  currency: string;
}

// Wallet → MT5. Debit-and-record first so a crash between the two systems
// leaves a visible pending row, never silently duplicated money. On adapter
// failure the row flips to failed and the hold is returned in one transaction.
export async function transferToMt5(
  provider: Mt5Provider,
  input: TransferInput
): Promise<{ transaction: BrokerTransaction; walletBalance: string }> {
  const { transaction } = await db.transaction(async (tx) => {
    await debitIfSufficient(tx, input.walletId, input.amount);
    const inserted = await tx
      .insert(brokerTransactionsTable)
      .values({
        clientId: input.clientId,
        walletId: input.walletId,
        type: "transfer_to_mt5",
        status: "pending",
        amount: input.amount,
        currency: input.currency,
        tradingAccountId: input.tradingAccountId,
      })
      .returning();
    return { transaction: inserted[0] };
  });

  try {
    const { ticket } = await provider.deposit(
      input.mt5Login,
      input.amount,
      `wallet transfer #${transaction.id}`
    );
    const updated = await db
      .update(brokerTransactionsTable)
      .set({ status: "approved", mt5Ticket: ticket, decidedAt: new Date() })
      .where(eq(brokerTransactionsTable.id, transaction.id))
      .returning();
    const wallet = await getWallet(input.clientId);
    return { transaction: updated[0], walletBalance: wallet.balance };
  } catch (err) {
    await db.transaction(async (tx) => {
      await tx
        .update(brokerTransactionsTable)
        .set({ status: "failed", adminNotes: "MT5 deposit failed", decidedAt: new Date() })
        .where(eq(brokerTransactionsTable.id, transaction.id));
      await credit(tx, input.walletId, input.amount);
    });
    throw err;
  }
}

// MT5 → wallet. MT5 owns those funds, so it debits first (throwing on
// insufficient equity); only a successful MT5 withdrawal credits the wallet,
// atomically with its ledger row.
export async function transferFromMt5(
  provider: Mt5Provider,
  input: TransferInput
): Promise<{ transaction: BrokerTransaction; walletBalance: string }> {
  const { ticket } = await provider.withdraw(
    input.mt5Login,
    input.amount,
    `wallet transfer for client ${input.clientId}`
  );
  return db.transaction(async (tx) => {
    const [{ balance }] = await credit(tx, input.walletId, input.amount);
    const inserted = await tx
      .insert(brokerTransactionsTable)
      .values({
        clientId: input.clientId,
        walletId: input.walletId,
        type: "transfer_from_mt5",
        status: "approved",
        amount: input.amount,
        currency: input.currency,
        tradingAccountId: input.tradingAccountId,
        mt5Ticket: ticket,
        decidedAt: new Date(),
      })
      .returning();
    return { transaction: inserted[0], walletBalance: balance };
  });
}
