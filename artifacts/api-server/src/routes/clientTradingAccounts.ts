import { Router, type IRouter } from "express";
import { db, brokerTradingAccountsTable, brokerAccountTypesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getMt5Provider, Mt5AccountInfo } from "@workspace/mt5";
import { requireClient, getReqClient } from "../lib/clientAuth";

const router: IRouter = Router();

type AccountRow = {
  account: typeof brokerTradingAccountsTable.$inferSelect;
  accountTypeName: string | null;
};

function toView(row: AccountRow, live: Mt5AccountInfo | undefined) {
  return {
    id: row.account.id,
    mt5Login: row.account.mt5Login,
    accountTypeId: row.account.accountTypeId,
    accountTypeName: row.accountTypeName,
    leverage: row.account.leverage,
    currency: row.account.currency,
    status: row.account.status,
    balance: live?.balance ?? null,
    equity: live?.equity ?? null,
    marginFree: live?.marginFree ?? null,
    createdAt: row.account.createdAt,
  };
}

router.get("/trading-accounts", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    const rows: AccountRow[] = await db
      .select({ account: brokerTradingAccountsTable, accountTypeName: brokerAccountTypesTable.name })
      .from(brokerTradingAccountsTable)
      .leftJoin(brokerAccountTypesTable, eq(brokerAccountTypesTable.id, brokerTradingAccountsTable.accountTypeId))
      .where(eq(brokerTradingAccountsTable.clientId, client.id))
      .orderBy(desc(brokerTradingAccountsTable.createdAt));

    // Live balances are merged best-effort: an MT5 outage degrades the list
    // (null balances) rather than breaking it.
    let liveByLogin = new Map<string, Mt5AccountInfo>();
    try {
      const infos = await getMt5Provider().getAccountsInfo(rows.map((r) => r.account.mt5Login));
      liveByLogin = new Map(infos.map((i) => [i.login, i]));
    } catch (err) {
      req.log.error({ err }, "MT5 getAccountsInfo failed; returning accounts without live data");
    }
    res.json({ tradingAccounts: rows.map((r) => toView(r, liveByLogin.get(r.account.mt5Login))) });
  } catch (err) {
    req.log.error({ err }, "List trading accounts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/trading-accounts", requireClient, async (req, res) => {
  try {
    const client = getReqClient(req);
    // The KYC gate: no approved identity, no live trading account.
    if (client.kycStatus !== "approved") {
      res.status(403).json({
        error: "Forbidden",
        message: "Identity verification is required before opening a trading account",
      });
      return;
    }
    const { accountTypeId, leverage } = req.body;
    if (!accountTypeId || !leverage) {
      res.status(400).json({ error: "Bad Request", message: "accountTypeId and leverage are required" });
      return;
    }
    const types = await db
      .select()
      .from(brokerAccountTypesTable)
      .where(eq(brokerAccountTypesTable.id, Number(accountTypeId)))
      .limit(1);
    const accountType = types[0];
    if (!accountType || !accountType.isActive) {
      res.status(400).json({ error: "Bad Request", message: "Unknown account type" });
      return;
    }
    if (!accountType.leverages.includes(Number(leverage))) {
      res.status(400).json({
        error: "Bad Request",
        message: `Leverage must be one of: ${accountType.leverages.join(", ")}`,
      });
      return;
    }

    const created = await getMt5Provider().createAccount({
      name: client.fullName,
      group: accountType.mt5Group,
      leverage: Number(leverage),
      currency: accountType.currency,
    });
    const inserted = await db
      .insert(brokerTradingAccountsTable)
      .values({
        clientId: client.id,
        mt5Login: created.login,
        accountTypeId: accountType.id,
        leverage: Number(leverage),
        currency: accountType.currency,
      })
      .returning();

    res.status(201).json({
      success: true,
      tradingAccount: toView({ account: inserted[0], accountTypeName: accountType.name }, {
        login: created.login,
        name: client.fullName,
        group: accountType.mt5Group,
        currency: accountType.currency,
        leverage: Number(leverage),
        balance: "0.00",
        credit: "0.00",
        equity: "0.00",
        marginFree: "0.00",
      }),
      // Shown exactly once — not stored anywhere on our side.
      masterPassword: created.masterPassword,
      investorPassword: created.investorPassword,
    });
  } catch (err) {
    req.log.error({ err }, "Create trading account error");
    res.status(502).json({ error: "Bad Gateway", message: "Could not create the trading account. Try again." });
  }
});

export default router;
