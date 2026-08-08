import {
  Mt5AccountInfo,
  Mt5CreateAccountParams,
  Mt5CreatedAccount,
  Mt5NotConfiguredError,
  Mt5Provider,
} from "./types";

// Placeholder for the real MT5 Manager API integration. When the client
// supplies the Manager API endpoint + credentials, implement each method here
// (reading config from env, e.g. MT5_MANAGER_URL / MT5_MANAGER_LOGIN /
// MT5_MANAGER_PASSWORD via the platform's secrets store) — callers already go
// through the Mt5Provider interface and will not change.

export class ManagerMt5Provider implements Mt5Provider {
  async createAccount(_params: Mt5CreateAccountParams): Promise<Mt5CreatedAccount> {
    throw new Mt5NotConfiguredError();
  }
  async deposit(_login: string, _amount: string, _comment: string): Promise<{ ticket: string }> {
    throw new Mt5NotConfiguredError();
  }
  async withdraw(_login: string, _amount: string, _comment: string): Promise<{ ticket: string }> {
    throw new Mt5NotConfiguredError();
  }
  async getAccountInfo(_login: string): Promise<Mt5AccountInfo> {
    throw new Mt5NotConfiguredError();
  }
  async getAccountsInfo(_logins: string[]): Promise<Mt5AccountInfo[]> {
    throw new Mt5NotConfiguredError();
  }
  async changeLeverage(_login: string, _leverage: number): Promise<void> {
    throw new Mt5NotConfiguredError();
  }
}
