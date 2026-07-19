/**
 * Named story anchors: person / date / place / instrument pinned to a research role.
 * Authority-host URLs are leads for research cases — never silent body facts.
 */

import { isAuthorityHost, normalizeAuthorityUrl } from '../discovery/authority-harvest.js';

export const ANCHOR_ROLES = [
  'conventional',
  'omitted',
  'winner_built',
  'authority_witness',
  'present_bridge',
  'named_case',
] as const;

export type AnchorRole = (typeof ANCHOR_ROLES)[number];

export type NamedAnchor = {
  readonly id: string;
  readonly role: AnchorRole;
  readonly who?: string;
  readonly whenLabel?: string;
  readonly whereLabel?: string;
  /** Primary instrument: constitution, treaty, contract, memoir, statute. */
  readonly instrument?: string;
  readonly note?: string;
  /**
   * Authority-host HTTPS URL harvested as a follow-up lead.
   * Never treated as a publishable citation by itself.
   */
  readonly authorityLeadUrl?: string;
  /** Optional published claim/fact/entity this anchor already resolves to. */
  readonly resolvedCiteKind?: 'claim' | 'fact' | 'entity';
  readonly resolvedCiteId?: string;
};

export type BuildNamedAnchorInput = {
  readonly id: string;
  readonly role: AnchorRole;
  readonly who?: string;
  readonly whenLabel?: string;
  readonly whereLabel?: string;
  readonly instrument?: string;
  readonly note?: string;
  readonly authorityLeadUrl?: string;
  readonly resolvedCiteKind?: 'claim' | 'fact' | 'entity';
  readonly resolvedCiteId?: string;
};

/**
 * Pure builder. Rejects non-authority URLs for `authorityLeadUrl` (fail closed).
 * Returns undefined when the optional lead URL is present but not on the allowlist.
 */
export function buildNamedAnchor(input: BuildNamedAnchorInput): NamedAnchor | undefined {
  let authorityLeadUrl: string | undefined;
  if (input.authorityLeadUrl !== undefined && input.authorityLeadUrl.trim()) {
    const normalized = normalizeAuthorityUrl(input.authorityLeadUrl);
    if (!normalized || !isAuthorityHost(normalized.host)) {
      return undefined;
    }
    authorityLeadUrl = normalized.url;
  }

  const hasResolved =
    input.resolvedCiteKind !== undefined &&
    input.resolvedCiteId !== undefined &&
    input.resolvedCiteId.trim().length > 0;

  return Object.freeze({
    id: input.id.trim(),
    role: input.role,
    ...(input.who !== undefined ? { who: input.who.trim() } : {}),
    ...(input.whenLabel !== undefined ? { whenLabel: input.whenLabel.trim() } : {}),
    ...(input.whereLabel !== undefined ? { whereLabel: input.whereLabel.trim() } : {}),
    ...(input.instrument !== undefined ? { instrument: input.instrument.trim() } : {}),
    ...(input.note !== undefined ? { note: input.note.trim() } : {}),
    ...(authorityLeadUrl !== undefined ? { authorityLeadUrl } : {}),
    ...(hasResolved
      ? {
          resolvedCiteKind: input.resolvedCiteKind!,
          resolvedCiteId: input.resolvedCiteId!.trim(),
        }
      : {}),
  });
}

/** Collect authority lead URLs from anchors (deduped, order-preserving). */
export function collectAuthorityLeadUrls(anchors: readonly NamedAnchor[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const anchor of anchors) {
    if (!anchor.authorityLeadUrl || seen.has(anchor.authorityLeadUrl)) continue;
    seen.add(anchor.authorityLeadUrl);
    out.push(anchor.authorityLeadUrl);
  }
  return Object.freeze(out);
}
