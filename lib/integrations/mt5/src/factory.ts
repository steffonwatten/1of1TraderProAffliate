import { Mt5Provider } from "./types";
import { MockMt5Provider } from "./mockProvider";
import { ManagerMt5Provider } from "./managerProvider";

let instance: Mt5Provider | null = null;

// MT5_PROVIDER=mock (default) | manager. Defaulting to mock is deliberate:
// the platform must work end-to-end before the real Manager API exists.
export function getMt5Provider(): Mt5Provider {
  if (!instance) {
    const kind = process.env.MT5_PROVIDER ?? "mock";
    if (kind === "manager") {
      instance = new ManagerMt5Provider();
    } else if (kind === "mock") {
      instance = new MockMt5Provider();
    } else {
      throw new Error(`Unknown MT5_PROVIDER: "${kind}" (expected "mock" or "manager")`);
    }
  }
  return instance;
}
