# @workspace/mt5 — MT5 integration adapter

Everything in the platform that touches MetaTrader 5 goes through the
`Mt5Provider` interface from this package (`getMt5Provider()`), selected by the
`MT5_PROVIDER` environment variable:

| `MT5_PROVIDER` | Implementation | Use |
|---|---|---|
| `mock` (default) | `MockMt5Provider` — simulates an MT5 server in the `broker_mt5_mock_accounts` table (DB-backed so state survives restarts) | Development, and production until the real API is supplied |
| `manager` | `ManagerMt5Provider` — **stub**; every call throws `Mt5NotConfiguredError` until implemented | Reserved for the real MT5 Manager API |

## Wiring the real MT5 Manager API later

1. Implement the methods in `src/managerProvider.ts` against the broker's
   Manager API (WebAPI/gRPC gateway, whatever the server exposes). Credentials
   go in the platform's **secrets store** (e.g. `MT5_MANAGER_URL`,
   `MT5_MANAGER_LOGIN`, `MT5_MANAGER_PASSWORD`) — never in committed config;
   see `.claude/rules/GENERAL-secrets.md`.
2. Set `MT5_PROVIDER=manager`.
3. Nothing else changes — api-server routes only know the interface.

All money values crossing this interface are **decimal strings** ("1234.56"),
never floats. Helpers in `src/money.ts` do integer-cents arithmetic.
