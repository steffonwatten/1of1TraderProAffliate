// String-safe decimal math for 2-dp money values. Converts to integer cents,
// operates there, and formats back — floats never touch the value.

export function toCents(amount: string): number {
  if (!/^-?\d+(\.\d{1,2})?$/.test(amount.trim())) {
    throw new Error(`Invalid money amount: "${amount}"`);
  }
  const [whole, frac = ""] = amount.trim().split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const wholeAbs = whole.replace("-", "");
  return sign * (Number(wholeAbs) * 100 + Number(frac.padEnd(2, "0")));
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function addMoney(a: string, b: string): string {
  return fromCents(toCents(a) + toCents(b));
}

export function subtractMoney(a: string, b: string): string {
  return fromCents(toCents(a) - toCents(b));
}

export function isPositiveMoney(amount: string): boolean {
  return toCents(amount) > 0;
}

export function moneyGte(a: string, b: string): boolean {
  return toCents(a) >= toCents(b);
}
