/**
 * Public fact resolution helpers for web routes.
 *
 * Encodes the read-path rules from the domain publish/resolution gates: draft/under_review facts
 * are not public (404); deprecated/superseded/corrected facts stay resolvable with a banner, never
 * 404. Public human URLs are slug-only (`/facts/{slug}`); bare fact ids and legacy
 * `/facts/{id}/{slug}` paths redirect to the current slug URL.
 */
import {
  buildFactPath,
  isFactId,
  isPubliclyResolvableFactStatus,
  type FactRecord,
  type FactRevision,
} from '@repo/domain';
import { getSeedFact, listSeedFacts } from '../../data/facts-seed';

export type PublicFactLookup =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_public'; readonly fact: FactRecord }
  | { readonly kind: 'ok'; readonly fact: FactRecord };

export type PublicFactResolution =
  | PublicFactLookup
  | { readonly kind: 'redirect'; readonly destination: string };

function getSeedFactBySlug(slug: string): FactRecord | undefined {
  return listSeedFacts().find((fact) => fact.slug === slug);
}

/** Look up a public fact by immutable id or slug without applying URL redirects. */
export function lookupPublicFact(idOrSlug: string): PublicFactLookup {
  const byId = isFactId(idOrSlug) ? getSeedFact(idOrSlug) : undefined;
  const fact = byId ?? getSeedFactBySlug(idOrSlug);
  if (!fact) return { kind: 'not_found' };
  if (!isPubliclyResolvableFactStatus(fact.status)) return { kind: 'not_public', fact };
  return { kind: 'ok', fact };
}

/**
 * Resolve a public fact from a URL segment (fact id or slug) and optional legacy slug segment.
 * Bare ids and legacy `/facts/{id}/{slug}` paths redirect to the current `/facts/{slug}` path.
 */
export function resolvePublicFact(idOrSlug: string, requestedSlug?: string): PublicFactResolution {
  const lookedUp = lookupPublicFact(idOrSlug);
  if (lookedUp.kind !== 'ok') return lookedUp;

  const { fact } = lookedUp;
  const destination = buildFactPath(fact.id, fact.slug);

  // Legacy `/facts/{id}/{slug}` always redirects to the slug-only permalink.
  if (requestedSlug !== undefined) {
    return { kind: 'redirect', destination };
  }

  // Bare fact-id URL → slug permalink.
  if (isFactId(idOrSlug)) {
    return { kind: 'redirect', destination };
  }

  // Stale or wrong-case slug as the single segment.
  if (idOrSlug !== fact.slug) {
    return { kind: 'redirect', destination };
  }

  return { kind: 'ok', fact };
}

export function listPublicFacts(): readonly FactRecord[] {
  return listSeedFacts().filter((fact) => isPubliclyResolvableFactStatus(fact.status));
}

export function listPublicFactStaticParams(): readonly { readonly id: string }[] {
  // `id` route param is the public slug (folder name kept for nesting with rev/json routes).
  return listPublicFacts().map((fact) => ({ id: fact.slug }));
}

export function listPublicFactRevisionParams(): readonly {
  readonly id: string;
  readonly n: string;
}[] {
  const params: { readonly id: string; readonly n: string }[] = [];
  for (const fact of listPublicFacts()) {
    for (const revision of fact.revisions) {
      params.push({ id: fact.id, n: String(revision.revisionNumber) });
    }
  }
  return params;
}

export function listLegacyFactPathParams(): readonly {
  readonly id: string;
  readonly slug: string;
}[] {
  return listPublicFacts().map((fact) => ({ id: fact.id, slug: fact.slug }));
}

export function resolveFactRevision(
  id: string,
  revisionNumber: number,
):
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_public'; readonly fact: FactRecord }
  | { readonly kind: 'ok'; readonly fact: FactRecord; readonly revision: FactRevision } {
  if (!isFactId(id)) return { kind: 'not_found' };
  const fact = getSeedFact(id);
  if (!fact) return { kind: 'not_found' };
  if (!isPubliclyResolvableFactStatus(fact.status)) return { kind: 'not_public', fact };
  const revision = fact.revisions.find((entry) => entry.revisionNumber === revisionNumber);
  if (!revision) return { kind: 'not_found' };
  return { kind: 'ok', fact, revision };
}

/** Parses `/facts/{id}.json` segment values and bare ids for the JSON route handler. */
export function parseFactIdParam(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.endsWith('.json')) {
    const id = trimmed.slice(0, -'.json'.length);
    return isFactId(id) ? id : undefined;
  }
  return isFactId(trimmed) ? trimmed : undefined;
}

export function canonicalFactJsonUrl(fact: FactRecord, baseUrl?: string): string {
  const path = `/facts/${fact.id}.json`;
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

export function canonicalFactPageUrl(fact: FactRecord): string {
  return buildFactPath(fact.id, fact.slug);
}

export function factRevisionPageUrl(fact: FactRecord, revisionNumber: number): string {
  return `/facts/${fact.id}/rev/${revisionNumber}`;
}

export function currentSlugForFact(fact: FactRecord): string {
  return fact.slug;
}
