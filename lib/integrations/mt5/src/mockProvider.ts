import crypto from "crypto";
import { db, brokerMt5MockAccountsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import {
  Mt5AccountInfo,
  Mt5AccountNotFoundError,
  Mt5CreateAccountParams,
  Mt5CreatedAccount,
  Mt5InsufficientFundsError,
  Mt5Provider,
} from "./types";
import { addMoney, isPositiveMoney, moneyGte, subtractMoney } from "./money";

// Simulates an MT5 server against the broker_mt5_mock_accounts table so the
// whole platform works end-to-end before the real Manager API is configured.
// State survives restarts because it is DB-backed. No open positions are
// simulated, so equity == balance and marginFree == balance.

const FIRST_LOGIN = 100001;

function randomPassword(): string {
  // MT5 requires mixed-case + digit; hex satisfies digits, add fixed casing.
  return "Aa1" + crypto.randomBytes(6).toString("hex");
}

function toInfo(row: typeof brokerMt5MockAccountsTable.$inferSelect): Mt5AccountInfo {
  return {
    login: row.login,
    name: row.name,
    group: row.groupName,
    currency: row.currency,
    leverage: row.leverage,
    balance: row.balance,
    credit: "0.00",
    equity: row.balance,
    marginFree: row.balance,
  };
}

export class MockMt5Provider implements Mt5Provider {
  async createAccount(params: Mt5CreateAccountParams): Promise<Mt5CreatedAccount> {
    const [{ max }] = await db
      .select({ max: sql<string | null>`max(login::bigint)` })
      .from(brokerMt5MockAccountsTable);
    const login = String(max ? Number(max) + 1 : FIRST_LOGIN);
    await db.insert(brokerMt5MockAccountsTable).values({
      login,
      name: params.name,
      groupName: params.group,
      currency: params.currency,
      leverage: params.leverage,
      balance: "0.00",
    });
    return { login, masterPassword: randomPassword(), investorPassword: randomPassword() };
  }

  async deposit(login: string, amount: string, _comment: string): Promise<{ ticket: string }> {
    if (!isPositiveMoney(amount)) throw new Error(`Deposit amount must be positive: ${amount}`);
    const account = await this.getRow(login);
    await db
      .update(brokerMt5MockAccountsTable)
      .set({ balance: addMoney(account.balance, amount) })
      .where(eq(brokerMt5MockAccountsTable.login, login));
    return { ticket: this.nextTicket() };
  }

  async withdraw(login: string, amount: string, _comment: string): Promise<{ ticket: string }> {
    if (!isPositiveMoney(amount)) throw new Error(`Withdraw amount must be positive: ${amount}`);
    const account = await this.getRow(login);
    if (!moneyGte(account.balance, amount)) throw new Mt5InsufficientFundsError(login);
    await db
      .update(brokerMt5MockAccountsTable)
      .set({ balance: subtractMoney(account.balance, amount) })
      .where(eq(brokerMt5MockAccountsTable.login, login));
    return { ticket: this.nextTicket() };
  }

  async getAccountInfo(login: string): Promise<Mt5AccountInfo> {
    return toInfo(await this.getRow(login));
  }

  async getAccountsInfo(logins: string[]): Promise<Mt5AccountInfo[]> {
    if (logins.length === 0) return [];
    const rows = await db
      .select()
      .from(brokerMt5MockAccountsTable)
      .where(inArray(brokerMt5MockAccountsTable.login, logins));
    return rows.map(toInfo);
  }

  async changeLeverage(login: string, leverage: number): Promise<void> {
    await this.getRow(login);
    await db
      .update(brokerMt5MockAccountsTable)
      .set({ leverage })
      .where(eq(brokerMt5MockAccountsTable.login, login));
  }

  private async getRow(login: string) {
    const rows = await db
      .select()
      .from(brokerMt5MockAccountsTable)
      .where(eq(brokerMt5MockAccountsTable.login, login))
      .limit(1);
    if (!rows[0]) throw new Mt5AccountNotFoundError(login);
    return rows[0];
  }

  private nextTicket(): string {
    return String(Date.now()) + String(crypto.randomInt(100, 999));
  }
}
