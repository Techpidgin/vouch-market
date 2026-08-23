export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;
export const ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
export const MARKET_SUGGESTION_LABEL = "Market guidance only — not a platform-set price";

export function toUsdcMicro(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("USDC amount must be a positive number");
  }

  return Math.round(amount * 10 ** USDC_DECIMALS);
}

export function decimalToUsdcMicro(amount: string): number {
  const [whole, fraction = ""] = amount.split(".");
  return Number(whole) * 1_000_000 + Number(fraction.padEnd(6, "0").slice(0, 6));
}

export function microToDecimal(amount: number): string {
  const whole = Math.floor(amount / 1_000_000);
  const fraction = Math.round(amount % 1_000_000).toString().padStart(6, "0");
  return `${whole}.${fraction}`;
}
