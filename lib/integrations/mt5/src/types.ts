// Contract every MT5 provider implements. All money values are decimal
// strings ("1234.56"), matching how Drizzle returns numeric columns — never
// floats (see .claude/rules/GENERAL-keeping-it-clean.md, Money).

export interface Mt5AccountInfo {
  login: string;
  name: string;
  group: string;
  currency: string;
  leverage: number;
  balance: string;
  credit: string;
  equity: string;
  marginFree: string;
}

export interface Mt5CreateAccountParams {
  name: string;
  group: string;
  leverage: number;
  currency: string;
}

export interface Mt5CreatedAccount {
  login: string;
  masterPassword: string;
  investorPassword: string;
}

export interface Mt5Provider {
  createAccount(params: Mt5CreateAccountParams): Promise<Mt5CreatedAccount>;
  /** Credit the trading account. Returns the MT5 deal ticket. */
  deposit(login: string, amount: string, comment: string): Promise<{ ticket: string }>;
  /** Debit the trading account. Throws Mt5InsufficientFundsError if it can't cover. */
  withdraw(login: string, amount: string, comment: string): Promise<{ ticket: string }>;
  getAccountInfo(login: string): Promise<Mt5AccountInfo>;
  getAccountsInfo(logins: string[]): Promise<Mt5AccountInfo[]>;
  changeLeverage(login: string, leverage: number): Promise<void>;
}

export class Mt5Error extends Error {}

export class Mt5AccountNotFoundError extends Mt5Error {
  constructor(login: string) {
    super(`MT5 account not found: ${login}`);
  }
}

export class Mt5InsufficientFundsError extends Mt5Error {
  constructor(login: string) {
    super(`Insufficient funds on MT5 account ${login}`);
  }
}

export class Mt5NotConfiguredError extends Mt5Error {
  constructor() {
    super(
      "MT5 Manager API provider is not configured. Set MT5_PROVIDER=mock, or supply Manager API credentials."
    );
  }
}
