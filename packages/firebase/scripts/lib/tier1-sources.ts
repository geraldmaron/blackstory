/**
 * Tier-1 (federal/state government, courts, official archives) host classification,
 * shared by the auto-promotion gate and the source-corroboration search step so both
 * agree on exactly what counts — one list, not two that can drift apart.
 */
export const TIER1_HOST_PATTERNS: readonly RegExp[] = [
  /\.gov$/iu,
  /\.mil$/iu,
  /(^|\.)nps\.gov$/iu,
  /(^|\.)loc\.gov$/iu,
  /(^|\.)archives\.gov$/iu,
  /(^|\.)si\.edu$/iu,
  /(^|\.)census\.gov$/iu,
];

export function isTier1Host(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return TIER1_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
}
