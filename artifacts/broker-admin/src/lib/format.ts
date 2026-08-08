// Money values arrive as decimal strings from the API and stay strings —
// formatting only, never arithmetic (see GENERAL-keeping-it-clean.md, Money).
export function formatMoney(amount: string | null | undefined, currency = "USD"): string {
  if (amount == null) return "—";
  const [whole, frac = "00"] = amount.split(".");
  const withThousands = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${withThousands}.${frac.padEnd(2, "0").slice(0, 2)} ${currency}`;
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const TX_TYPE_LABELS: Record<string, string> = {
  deposit_wire: "Deposit · Wire",
  deposit_crypto: "Deposit · Crypto",
  withdrawal: "Withdrawal",
  transfer_to_mt5: "Transfer to account",
  transfer_from_mt5: "Transfer from account",
  adjustment: "Adjustment",
};
