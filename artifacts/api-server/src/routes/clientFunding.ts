import { Router, type IRouter } from "express";
import {
  db,
  brokerBankAccountsTable,
  brokerTransactionsTable,
  brokerTradingAccountsTable,
  brokerAccountTypesTable,
  BrokerTransaction,
} from "@workspace/db";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import { getMt5Provider, isPositiveMoney, Mt5InsufficientFundsError } from "@workspace/mt5";
import { requireClient, getReqClient } from "../lib/clientAuth";
import {
  getWallet,
  submitDeposit,
  requestWithdrawal,
  transferToMt5,
  transferFromMt5,
  InsufficientBalanceError,
} from "../lib/brokerLedger";
import { getWireDetails, getCryptoAddresses } from "../lib/brokerSettings";

const router: IRouter = Router();

function toClientTransaction(t: BrokerTransaction) {
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    amount: t.amount,
    currency: t.currency,
    reference: t.reference,
    cryptoCoin: t.cryptoCoin,
    cryptoTxid: t.cryptoTxid,
    bankAccountId: t.bankAccountId,
    tradingAccountId: t.tradingAccountId,
    clientNote: t.clientNote,
    adminNotes: t.adminNotes,
    createdAt: t.createdAt,
    decidedAt: t.decidedAt,
  };
}

function validAmount(amount: unknown): amount is string {
  return typeof amount === "string" && /^\d+(\.\d{1,2})?$/.test(amount.trim()) && isPositiveMoney(amount.trim());
}

router.get("/dashboard", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const wallet = await getWallet(client.id);
    const [{ count: tradingAccountCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(brokerTradingAccountsTable)
      .where(eq(brokerTradingAccountsTable.clientId, client.id));
    const recent = await db
      .select()
      .from(brokerTransactionsTable)
      .where(eq(brokerTransactionsTable.clientId, client.id))
      .orderBy(desc(brokerTransactionsTable.createdAt))
      .limit(10);
    res.json({
      walletBalance: wallet.balance,
      currency: wallet.currency,
      kycStatus: client.kycStatus,
      tradingAccountCount,
      recentTransactions: recent.map(toClientTransaction),
    });
  } catch (err) {
    req.log.error({ err }, "Client dashboard error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/wallet", requireClient, async (req, res) => {
  try {
    const wallet = await getWallet(getReqClient(req).id);
    res.json({ id: wallet.id, currency: wallet.currency, balance: wallet.balance });
  } catch (err) {
    req.log.error({ err }, "Client wallet error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/transactions", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const { type, status } = req.query as { type?: string; status?: string };
    const conditions = [eq(brokerTransactionsTable.clientId, client.id)];
    const txTypes = ["deposit_wire", "deposit_crypto", "withdrawal", "transfer_to_mt5", "transfer_from_mt5", "adjustment"];
    const txStatuses = ["pending", "approved", "rejected", "failed"];
    if (type && txTypes.includes(type)) {
      conditions.push(eq(brokerTransactionsTable.type, type as BrokerTransaction["type"]));
    }
    if (status && txStatuses.includes(status)) {
      conditions.push(eq(brokerTransactionsTable.status, status as BrokerTransaction["status"]));
    }
    const rows = await db
      .select()
      .from(brokerTransactionsTable)
      .where(and(...conditions))
      .orderBy(desc(brokerTransactionsTable.createdAt))
      .limit(200);
    res.json({ transactions: rows.map(toClientTransaction) });
  } catch (err) {
    req.log.error({ err }, "Client transactions error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.get("/deposit/methods", requireClient, async (req, res) => {
  try {
    const [wire, cryptoAddresses] = await Promise.all([getWireDetails(), getCryptoAddresses()]);
    res.json({ wire, cryptoAddresses });
  } catch (err) {
    req.log.error({ err }, "Deposit methods error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/deposits", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const { method, amount, reference, cryptoCoin, cryptoTxid, note } = req.body;
    if (method !== "wire" && method !== "crypto") {
      res.status(400).json({ error: "Bad Request", message: "method must be wire or crypto" });
      return;
    }
    if (!validAmount(amount)) {
      res.status(400).json({ error: "Bad Request", message: "amount must be a positive decimal like 100.00" });
      return;
    }
    if (method === "crypto" && !cryptoCoin) {
      res.status(400).json({ error: "Bad Request", message: "cryptoCoin is required for crypto deposits" });
      return;
    }
    const wallet = await getWallet(client.id);
    const transaction = await submitDeposit({
      clientId: client.id,
      walletId: wallet.id,
      type: method === "wire" ? "deposit_wire" : "deposit_crypto",
      amount: amount.trim(),
      currency: wallet.currency,
      reference: reference ?? null,
      cryptoCoin: cryptoCoin ?? null,
      cryptoTxid: cryptoTxid ?? null,
      clientNote: note ?? null,
    });
    res.status(201).json({ success: true, transaction: toClientTransaction(transaction) });
  } catch (err) {
    req.log.error({ err }, "Create deposit error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

function toBankAccountView(b: typeof brokerBankAccountsTable.$inferSelect) {
  return {
    id: b.id,
    beneficiaryName: b.beneficiaryName,
    bankName: b.bankName,
    iban: b.iban,
    accountNumber: b.accountNumber,
    swift: b.swift,
    currency: b.currency,
    createdAt: b.createdAt,
  };
}

router.get("/bank-accounts", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const rows = await db
      .select()
      .from(brokerBankAccountsTable)
      .where(and(eq(brokerBankAccountsTable.clientId, client.id), isNull(brokerBankAccountsTable.deletedAt)))
      .orderBy(desc(brokerBankAccountsTable.createdAt));
    res.json({ bankAccounts: rows.map(toBankAccountView) });
  } catch (err) {
    req.log.error({ err }, "List bank accounts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/bank-accounts", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const { beneficiaryName, bankName, iban, accountNumber, swift, currency } = req.body;
    if (!beneficiaryName || !bankName) {
      res.status(400).json({ error: "Bad Request", message: "beneficiaryName and bankName are required" });
      return;
    }
    if (!iban && !accountNumber) {
      res.status(400).json({ error: "Bad Request", message: "Provide an IBAN or an account number" });
      return;
    }
    const inserted = await db
      .insert(brokerBankAccountsTable)
      .values({
        clientId: client.id,
        beneficiaryName,
        bankName,
        iban: iban ?? null,
        accountNumber: accountNumber ?? null,
        swift: swift ?? null,
        currency: currency ?? "USD",
      })
      .returning();
    res.status(201).json({ success: true, bankAccount: toBankAccountView(inserted[0]) });
  } catch (err) {
    req.log.error({ err }, "Create bank account error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.delete("/bank-accounts/:id", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const id = parseInt(req.params.id as string);
    const updated = await db
      .update(brokerBankAccountsTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(brokerBankAccountsTable.id, id),
          eq(brokerBankAccountsTable.clientId, client.id),
          isNull(brokerBankAccountsTable.deletedAt)
        )
      )
      .returning({ id: brokerBankAccountsTable.id });
    if (!updated[0]) {
      res.status(404).json({ error: "Not Found", message: "Bank account not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Delete bank account error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/withdrawals", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const { bankAccountId, amount } = req.body;
    if (!bankAccountId || !validAmount(amount)) {
      res.status(400).json({ error: "Bad Request", message: "bankAccountId and a positive amount are required" });
      return;
    }
    const accounts = await db
      .select()
      .from(brokerBankAccountsTable)
      .where(
        and(
          eq(brokerBankAccountsTable.id, Number(bankAccountId)),
          eq(brokerBankAccountsTable.clientId, client.id),
          isNull(brokerBankAccountsTable.deletedAt)
        )
      )
      .limit(1);
    if (!accounts[0]) {
      res.status(400).json({ error: "Bad Request", message: "Bank account not found" });
      return;
    }
    const wallet = await getWallet(client.id);
    const { transaction, walletBalance } = await requestWithdrawal({
      clientId: client.id,
      walletId: wallet.id,
      amount: amount.trim(),
      currency: wallet.currency,
      bankAccountId: accounts[0].id,
    });
    res.status(201).json({ success: true, transaction: toClientTransaction(transaction), walletBalance });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: "Bad Request", message: "Insufficient wallet balance" });
      return;
    }
    req.log.error({ err }, "Create withdrawal error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/transfers", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const { direction, tradingAccountId, amount } = req.body;
    if (direction !== "to_mt5" && direction !== "from_mt5") {
      res.status(400).json({ error: "Bad Request", message: "direction must be to_mt5 or from_mt5" });
      return;
    }
    if (!tradingAccountId || !validAmount(amount)) {
      res.status(400).json({ error: "Bad Request", message: "tradingAccountId and a positive amount are required" });
      return;
    }
    const accounts = await db
      .select()
      .from(brokerTradingAccountsTable)
      .where(
        and(
          eq(brokerTradingAccountsTable.id, Number(tradingAccountId)),
          eq(brokerTradingAccountsTable.clientId, client.id),
          eq(brokerTradingAccountsTable.status, "active")
        )
      )
      .limit(1);
    if (!accounts[0]) {
      res.status(400).json({ error: "Bad Request", message: "Trading account not found" });
      return;
    }
    const wallet = await getWallet(client.id);
    const input = {
      clientId: client.id,
      walletId: wallet.id,
      tradingAccountId: accounts[0].id,
      mt5Login: accounts[0].mt5Login,
      amount: amount.trim(),
      currency: wallet.currency,
    };
    const provider = getMt5Provider();
    const result =
      direction === "to_mt5"
        ? await transferToMt5(provider, input)
        : await transferFromMt5(provider, input);
    res.status(201).json({
      success: true,
      transaction: toClientTransaction(result.transaction),
      walletBalance: result.walletBalance,
    });
  } catch (err) {
    if (err instanceof InsufficientBalanceError) {
      res.status(400).json({ error: "Bad Request", message: "Insufficient wallet balance" });
      return;
    }
    if (err instanceof Mt5InsufficientFundsError) {
      res.status(400).json({ error: "Bad Request", message: "Insufficient trading account balance" });
      return;
    }
    req.log.error({ err }, "Create transfer error");
    res.status(502).json({ error: "Bad Gateway", message: "Trading server operation failed. No funds were lost." });
  }
});

router.get("/account-types", requireClient, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(brokerAccountTypesTable)
      .where(eq(brokerAccountTypesTable.isActive, true))
      .orderBy(brokerAccountTypesTable.sortOrder);
    res.json({
      accountTypes: rows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        mt5Group: t.mt5Group,
        currency: t.currency,
        minDeposit: t.minDeposit,
        leverages: t.leverages,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "List account types error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
