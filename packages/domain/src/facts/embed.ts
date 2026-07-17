/**
 * Compact embed/reference view (BB-086 acceptance criteria 4 & 8) — the ONE shared shape the
 * map (BB-051/070), entity/place/event pages (BB-052), and the evidence UI (BB-053) all render
 * when they cite a fact inline. Every embed carries the SAME canonical URL and the SAME citation
 * set as the fact's own page: there is exactly one place a reader can go to see "why do we say
 * this," no matter which surface they clicked through from.
 *
 * Deliberately display-safe and small: no raw confidence score, no internal ordering key — just
 * what BB-053's `EvidenceCitationView`/`Confidence` components already know how to render, so a
 * consuming surface can drop this straight into that existing UI vocabulary.
 */
import { buildFactPath } from './ids.js';
import type { FactCitation } from './citation.js';
import type { FactRecord } from './record.js';

export type CompactFactSubjectView = {
  readonly entityId: string;
  readonly kind: string;
  readonly role?: string;
};

export type CompactFactCitationView = {
  readonly sourceTitle: string;
  readonly sourceClass: string;
  readonly role: string;
  /** Prefers the archived capture (BB-016) as the outbound link so a link-rot event on the
   * original never breaks the embed; falls back to the live URL when no archive exists yet
   * (e.g. an offline/non-web citation with no archivedUrl at all). */
  readonly href?: string;
};

export type CompactFactView = {
  readonly id: string;
  readonly slug: string;
  readonly canonicalUrl: string;
  readonly statement: string;
  readonly shortStatement: string;
  readonly claimType: string;
  readonly status: string;
  readonly confidence: string;
  readonly confidenceNote?: string;
  readonly subjects: readonly CompactFactSubjectView[];
  readonly citationCount: number;
  readonly primaryCitation?: CompactFactCitationView;
};

function citationTitle(citation: FactCitation): string {
  return citation.csl.title ?? citation.csl.id;
}

function citationHref(citation: FactCitation): string | undefined {
  return citation.archivedUrl ?? citation.csl.URL ?? citation.url;
}

function toCompactCitation(citation: FactCitation): CompactFactCitationView {
  const href = citationHref(citation);
  return {
    sourceTitle: citationTitle(citation),
    sourceClass: citation.sourceClass,
    role: citation.role,
    ...(href ? { href } : {}),
  };
}

/**
 * Builds the compact embed view for one fact. `primaryCitation` prefers the first citation with
 * `role: 'supports'` (the direct evidentiary basis of the statement), falling back to the first
 * citation of any role when no `supports` citation exists.
 */
export function buildCompactFactView(fact: FactRecord): CompactFactView {
  const primary = fact.citations.find((c) => c.role === 'supports') ?? fact.citations[0];
  return {
    id: fact.id,
    slug: fact.slug,
    canonicalUrl: buildFactPath(fact.id, fact.slug),
    statement: fact.statement,
    shortStatement: fact.shortStatement,
    claimType: fact.claimType,
    status: fact.status,
    confidence: fact.confidence,
    ...(fact.confidenceNote ? { confidenceNote: fact.confidenceNote } : {}),
    subjects: fact.subjects.map((subject) => ({
      entityId: subject.entityId,
      kind: subject.kind,
      ...(subject.role ? { role: subject.role } : {}),
    })),
    citationCount: fact.citations.length,
    ...(primary ? { primaryCitation: toCompactCitation(primary) } : {}),
  };
}

/** Builds embed views for every fact that names `entityId` as a subject — the call an
 * entity/place/event page makes to render its "Facts about this record" section (AC4). */
export function buildCompactFactViewsForEntity(
  entityId: string,
  facts: readonly FactRecord[],
): readonly CompactFactView[] {
  return facts
    .filter((fact) => fact.subjects.some((subject) => subject.entityId === entityId))
    .map(buildCompactFactView);
}
