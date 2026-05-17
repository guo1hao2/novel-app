export const MAX_TOKENS_LOWER_BOUND = 1;
export const MAX_TOKENS_UPPER_BOUND = 393216;

export function normalizeMaxTokens(value: number): number {
  if (!Number.isFinite(value)) return MAX_TOKENS_UPPER_BOUND;
  return Math.max(MAX_TOKENS_LOWER_BOUND, Math.min(Math.trunc(value), MAX_TOKENS_UPPER_BOUND));
}
