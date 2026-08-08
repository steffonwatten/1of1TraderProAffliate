import { Router, type IRouter } from "express";
import {
  db,
  brokerClientsTable,
  brokerTransactionsTable,
  brokerBankAccountsTable,
  adminAuditLogsTable,
  BrokerTransaction,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { decideTransaction, AlreadyDecidedError } from "../lib/brokerLedger";
import { sendClientTransactionDecision } from "../lib/emailBroker";

const router: IRouter = Router();

type TxRow = {
  tx: BrokerTransaction;
  clientEmail: string;
  clientName: string;
  bankAccount: typeof brokerBankAccountsTable.$inferSelect | null;
};

function toAdminTransaction({ tx, clientEmail, clientName, bankAccount }: TxRow) {
  return {
    id: tx.id,
    clientId: tx.clientId,
    clientEmail,
    clientName,
    type: tx.type,
    status: tx.status,
    amount: tx.amount,
    currency: tx.currency,
    reference: tx.reference,
    cryptoCoin: tx.cryptoCoin,
    cryptoTxid: tx.cryptoTxid,
    bankAccount: bankAccount
      ? {
          id: bankAccount.id,
          beneficiaryName: bankAccount.beneficiaryName,
          bankName: bankAccount.bankName,
          iban: bankAccount.iban,
          accountNumber: bankAccount.accountNumber,
          swift: bankAccount.swift,
          currency: bankAccount.currency,
          createdAt: bankAccount.createdAt,
        }
      : null,
    tradingAccountId: tx.tradingAccountId,
    mt5Ticket: tx.mt5Ticket,
    clientNote: tx.clientNote,
    adminNotes: tx.adminNotes,
    decidedAt: tx.decidedAt,
    createdAt: tx.createdAt,
  };
}

async function loadTransactionRow(id: number): Promise<TxRow | null> {
  const rows = await db
    .select({
      tx: brokerTransactionsTable,
      clientEmail: brokerClientsTable.email,
      clientName: brokerClientsTable.fullName,
      bankAccount: brokerBankAccountsTable,
    })
    .from(brokerTransactionsTable)
    .innerJoin(brokerClientsTable, eq(brokerClientsTable.id, brokerTransactionsTable.clientId))
    .leftJoin(brokerBankAccountsTable, eq(brokerBankAccountsTable.id, brokerTransactionsTable.bankAccountId))
    .where(eq(brokerTransactionsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

router.get("/transactions", requireAdmin, async (req, res) => {
  try {
    const { type, status } = req.query as { type?: string; status?: string };
    const txTypes = ["deposit_wire", "deposit_crypto", "withdrawal", "transfer_to_mt5", "transfer_from_mt5", "adjustment"];
    const txStatuses = ["pending", "approved", "rejected", "failed"];
    const conditions = [];
    if (type && txTypes.includes(type)) {
      conditions.push(eq(brokerTransactionsTable.type, type as BrokerTransaction["type"]));
    }
    if (status && txStatuses.includes(status)) {
      conditions.push(eq(brokerTransactionsTable.status, status as BrokerTransaction["status"]));
    }
    const rows = await db
      .select({
        tx: brokerTransactionsTable,
        clientEmail: brokerClientsTable.email,
        clientName: brokerClientsTable.fullName,
        bankAccount: brokerBankAccountsTable,
      })
      .from(brokerTransactionsTable)
      .innerJoin(brokerClientsTable, eq(brokerClientsTable.id, brokerTransactionsTable.clientId))
      .leftJoin(brokerBankAccountsTable, eq(brokerBankAccountsTable.id, brokerTransactionsTable.bankAccountId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(brokerTransactionsTable.createdAt))
      .limit(200);
    res.json({ transactions: rows.map(toAdminTransaction) });
  } catch (err) {
    req.log.error({ err }, "List broker transactions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/transactions/:id/decision", requireAdmin, async (req, res) => {
  try {
    const admin = (req as any).user;
    const id = parseInt(req.params.id as string);
    const { decision, adminNotes } = req.body;
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ error: "Bad Request", message: "decision must be approved or rejected" });
      return;
    }
    const decided = await decideTransaction(id, admin.id, decision, adminNotes ?? null);
    await db.insert(adminAuditLogsTable).values({
      adminUserId: admin.id,
      action: `broker_tx_${decision}`,
      targetType: "broker_transaction",
      targetId: String(id),
      newValue: JSON.stringify({ type: decided.type, amount: decided.amount, adminNotes: adminNotes ?? null }),
    });

    const row = await loadTransactionRow(id);
    if (row) {
      const kind =
        decided.type === "withdrawal" ? "withdrawal" : decided.type.startsWith("deposit") ? "deposit" : null;
      if (kind) {
        sendClientTransactionDecision(
          row.clientEmail,
          row.clientName,
          kind,
          decided.amount,
          decided.currency,
          decision === "approved"
        );
      }
      res.json({ success: true, transaction: toAdminTransaction(row) });
    } else {
      res.json({ success: true, transaction: null });
    }
  } catch (err) {
    if (err instanceof AlreadyDecidedError) {
      res.status(409).json({ error: "Conflict", message: "Transaction is not pending" });
      return;
    }
    req.log.error({ err }, "Broker transaction decision error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
