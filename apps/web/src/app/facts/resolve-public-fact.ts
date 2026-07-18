/**
 * Public fact resolution helpers for web routes.
 *
 * Encodes the read-path rules from the domain publish/resolution gates: draft/under_review facts
 * are not public (404); deprecated/superseded/corrected facts stay resolvable with a banner, never
 * 404. Slug mismatches must redirect to the current canonical `/facts/{id}/{slug}` path.
 */
import {
  buildFactJsonPath,
  buildFactPath,
  buildFactRevisionPath,
  isFactId,
  isPubliclyResolvableFactStatus,
  slugifyFactStatement,
  type FactRecord,
  type FactRevision,
} from '@blap/domain';
import { getSeedFact, listSeedFacts } from '../../data/facts-seed';

export type PublicFactResolution =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'not_public'; readonly fact: FactRecord }
  | { readonly kind: 'redirect'; readonly destination: string }
  | { readonly kind: 'ok'; readonly fact: FactRecord };

export function resolvePublicFact(id: string, requestedSlug?: string): PublicFactResolution {
  if (!isFactId(id)) return { kind: 'not_found' };
  const fact = getSeedFact(id);
  if (!fact) return { kind: 'not_found' };
  if (!isPubliclyResolvableFactStatus(fact.status)) return { kind: 'not_public', fact };
  const canonicalSlug = slugifyFactStatement(fact.shortStatement);
  if (requestedSlug !== undefined && requestedSlug !== canonicalSlug) {
    return { kind: 'redirect', destination: buildFactPath(fact.id, canonicalSlug) };
  }
  return { kind: 'ok', fact };
}

export function listPublicFacts(): readonly FactRecord[] {
  return listSeedFacts().filter((fact) => isPubliclyResolvableFactStatus(fact.status));
}

export function listPublicFactStaticParams(): readonly { readonly id: string; readonly slug: string }[] {
  return listPublicFacts().map((fact) => ({
    id: fact.id,
    slug: slugifyFactStatement(fact.shortStatement),
  }));
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

export function resolveFactRevision(
  id: string,
  revisionNumber: number,
): { readonly kind: 'not_found' } | { readonly kind: 'not_public'; readonly fact: FactRecord } | { readonly kind: 'ok'; readonly fact: FactRecord; readonly revision: FactRevision } {
  const resolved = resolvePublicFact(id);
  if (resolved.kind === 'not_found') return { kind: 'not_found' };
  if (resolved.kind === 'not_public') return { kind: 'not_public', fact: resolved.fact };
  if (resolved.kind !== 'ok') return { kind: 'not_found' };
  const fact = resolved.fact;
  const revision = fact.revisions.find((entry) => entry.revisionNumber === revisionNumber);
  if (!revision) return { kind: 'not_found' };
  return { kind: 'ok', fact, revision };
}

/** Parses `/facts/{id}.json` segment values and bare ids for the JSON route handler.  */
export function parseFactIdParam(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed.endsWith('.json')) {
    const id = trimmed.slice(0, -'.json'.length);
    return isFactId(id) ? id : undefined;
  }
  return isFactId(trimmed) ? trimmed : undefined;
}

export function canonicalFactJsonUrl(fact: FactRecord, baseUrl?: string): string {
  const path = buildFactJsonPath(fact.id);
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path;
}

export function canonicalFactPageUrl(fact: FactRecord): string {
  return buildFactPath(fact.id, slugifyFactStatement(fact.shortStatement));
}

export function factRevisionPageUrl(fact: FactRecord, revisionNumber: number): string {
  return buildFactRevisionPath(fact.id, revisionNumber);
}

export function currentSlugForFact(fact: FactRecord): string {
  return slugifyFactStatement(fact.shortStatement);
}
