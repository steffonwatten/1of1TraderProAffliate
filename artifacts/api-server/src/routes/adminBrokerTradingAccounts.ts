import { Router, type IRouter } from "express";
import {
  db,
  brokerTradingAccountsTable,
  brokerAccountTypesTable,
  brokerClientsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getMt5Provider, Mt5AccountInfo } from "@workspace/mt5";
import { requireAdmin } from "../lib/auth";

const router: IRouter = Router();

router.get("/trading-accounts", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        account: brokerTradingAccountsTable,
        accountTypeName: brokerAccountTypesTable.name,
        clientEmail: brokerClientsTable.email,
        clientName: brokerClientsTable.fullName,
      })
      .from(brokerTradingAccountsTable)
      .leftJoin(brokerAccountTypesTable, eq(brokerAccountTypesTable.id, brokerTradingAccountsTable.accountTypeId))
      .innerJoin(brokerClientsTable, eq(brokerClientsTable.id, brokerTradingAccountsTable.clientId))
      .orderBy(desc(brokerTradingAccountsTable.createdAt))
      .limit(500);

    let liveByLogin = new Map<string, Mt5AccountInfo>();
    try {
      const infos = await getMt5Provider().getAccountsInfo(rows.map((r) => r.account.mt5Login));
      liveByLogin = new Map(infos.map((i) => [i.login, i]));
    } catch (err) {
      req.log.error({ err }, "MT5 getAccountsInfo failed; returning accounts without live data");
    }
    res.json({
      tradingAccounts: rows.map((r) => {
        const live = liveByLogin.get(r.account.mt5Login);
        return {
          id: r.account.id,
          clientId: r.account.clientId,
          clientEmail: r.clientEmail,
          clientName: r.clientName,
          mt5Login: r.account.mt5Login,
          accountTypeName: r.accountTypeName,
          leverage: r.account.leverage,
          currency: r.account.currency,
          status: r.account.status,
          balance: live?.balance ?? null,
          equity: live?.equity ?? null,
          createdAt: r.account.createdAt,
        };
      }),
    });
  } catch (err) {
    req.log.error({ err }, "List broker trading accounts error");
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
