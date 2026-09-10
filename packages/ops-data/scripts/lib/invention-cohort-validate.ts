/**
 * Mechanical validation for invention cohort rows, shared by the staging script and its test.
 *
 * These are the checks that do not need a reader: character bounds the publisher will reject,
 * a patent number that disagrees with the URL it is supposed to cite, a `co_invented` predicate
 * on a grant naming one person. Editorial judgment — whether a sentence's scope matches what the
 * grant covers — stays with review and with the attribution policy in
 * `@repo/domain-core/claims/attribution`, which reports rather than rewrites.
 *
 * The function collects every problem instead of throwing on the first, because a cohort author
 * fixing twelve records wants twelve messages, not twelve runs.
 */
import { CONTENT_EXPECTATIONS, resolveSourceLineage } from '@repo/domain';
import type { InventionCohortRecord } from '../data/invention-cohort.ts';
import { SUMMARY_MAX_CHARS, SUMMARY_MIN_CHARS } from './entity-enrichment-llm.ts';

/**
 * The floor `distinctEvidenceLineages` is checked against, read from the same spec the
 * publish-side content-expectations gate uses (`packages/domain/src/content-expectations`) so
 * the two never drift apart. See that file's comment on `invention` for why the number is 2: an
 * invention record's whole job is to say what the contribution actually was, and one source is
 * how a process patent becomes a household-name myth.
 */
const INVENTION_MIN_DISTINCT_LINEAGES = CONTENT_EXPECTATIONS.invention.minDistinctSources;

/** Predicates the contribution vocabulary allows, mirrored here so the check is self-contained. */
const PREDICATES = new Set(['invented', 'co_invented', 'improved']);

const ID_PATTERN = /^inv_[a-z0-9]+(?:_[a-z0-9]+)*$/u;
const ERA_PATTERN = /^\d{4}s$/u;
const STATE_PATTERN = /^[A-Z]{2}$/u;
/** Digits, or a series letter and digits: `X3306` and `D7` are not patents 3306 and 7. */
const PATENT_PATTERN = /^(?:[A-Z]{1,2})?\d+$/u;
const GRANT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/** English month names, for parsing the "granted on <D Month YYYY>" phrase in a summary. */
const MONTH_NAMES: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const GRANTED_ON_PATTERN = /\bgranted on (\d{1,2}) ([A-Za-z]+) (\d{4})\b/u;

/**
 * The ISO date a summary's own "granted on <D Month YYYY>" phrase states, or `null` when the
 * summary carries no such phrase (a year-only or dateless grant, which this check has nothing to
 * cross-check against).
 */
function grantDateFromSummary(summary: string): string | null {
  const match = GRANTED_ON_PATTERN.exec(summary);
  if (!match) return null;
  const [, day, monthName, year] = match;
  const month = MONTH_NAMES[(monthName ?? '').toLowerCase()];
  if (month === undefined) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Whether an ISO `YYYY-MM-DD` string names a calendar date that actually exists. */
function isRealCalendarDate(isoDate: string): boolean {
  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * British spellings that the American-English rule forbids in published prose.
 *
 * Listed as whole words with their American counterpart so the message tells the author what to
 * write, rather than only that something is wrong.
 */
const BRITISH_SPELLINGS: readonly (readonly [string, string])[] = [
  ['revolutionised', 'revolutionized'],
  ['commercialised', 'commercialized'],
  ['recognised', 'recognized'],
  ['organised', 'organized'],
  ['specialised', 'specialized'],
  ['standardised', 'standardized'],
  ['licence', 'license'],
  ['labour', 'labor'],
  ['honour', 'honor'],
  ['neighbourhood', 'neighborhood'],
  ['travelled', 'traveled'],
  ['modelling', 'modeling'],
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./u, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Prose fields, for checks that apply to everything a reader will see. */
function proseFields(row: InventionCohortRecord): readonly (readonly [string, string])[] {
  return [
    ['summary', row.summary],
    ['historicalContext', row.historicalContext],
    ['impactStatement', row.impactStatement],
  ];
}

/**
 * Distinct publishers backing a row.
 *
 * Host is a coarse proxy for publisher and a deliberate one: two URLs on patents.google.com are
 * one mirror of one office, however many patents they point at. It is the same reason lineage
 * may not be a hostname — a coarse key is safe when it can only under-count independence.
 */
export function distinctEvidenceHosts(row: InventionCohortRecord): readonly string[] {
  const hosts = new Set<string>();
  for (const citation of row.evidence) {
    const host = hostOf(citation.sourceUrl);
    if (host !== null) hosts.add(host);
  }
  return [...hosts].sort();
}

/**
 * The subset of a cohort record `distinctEvidenceLineages` needs. Structural rather than
 * `InventionCohortRecord` itself so `stage-inventor-cohort.ts`'s person rows — a different shape,
 * with no `contributors` or `impactStatement` — can reuse the same lineage counting instead of a
 * second copy of it.
 */
export type EvidenceLineageSource = {
  readonly canonicalUrl: string;
  readonly evidence: readonly { readonly sourceUrl: string }[];
};

/**
 * Distinct lineages backing a row: the underlying works and authorities it cites, not the hosts
 * that happen to serve them.
 *
 * `distinctEvidenceHosts` is a coarse proxy that undercounts in one direction only — two hosts
 * are never one publisher when they should be one. It overcounts in the other: `uspto.gov` and
 * `patents.google.com` are two hosts for one grant, so a row citing only those looked like two
 * sources when it had one. `resolveSourceLineage` (`@repo/domain-core/claims/lineage`) is the
 * actual answer — it collapses a patent mirror and the Patent Office onto one work key, collapses
 * an authority's subdomains onto one authority key, and flags Wikipedia and its siblings as a
 * bridge that may carry a claim but never corroborates one. This is what the invention floor in
 * `CONTENT_EXPECTATIONS` actually checks.
 *
 * `canonicalUrl` is included alongside `row.evidence`: the canonical page is a document the
 * record cites too, and a row whose only evidence citation duplicates its own canonical URL has
 * exactly one source, not two.
 */
export function distinctEvidenceLineages(row: EvidenceLineageSource): readonly string[] {
  const keys = new Set<string>();
  const urls = [row.canonicalUrl, ...row.evidence.map((citation) => citation.sourceUrl)];
  for (const url of urls) {
    const lineage = resolveSourceLineage({ url });
    if (!lineage.bridge) keys.add(lineage.key);
  }
  return [...keys].sort();
}

/** Every mechanical problem in one row, as messages already prefixed with the row id. */
export function validateInventionRow(row: InventionCohortRecord): readonly string[] {
  const problems: string[] = [];
  const say = (message: string): void => {
    problems.push(`${row.id}: ${message}`);
  };

  if (!ID_PATTERN.test(row.id)) say(`id must match ${String(ID_PATTERN)}`);
  if (row.displayName.trim().length === 0) say('displayName is empty');

  if (row.summary.length < SUMMARY_MIN_CHARS || row.summary.length > SUMMARY_MAX_CHARS) {
    say(`summary length ${row.summary.length} outside ${SUMMARY_MIN_CHARS}..${SUMMARY_MAX_CHARS}`);
  }
  if (row.historicalContext.trim().length === 0) say('historicalContext is empty');
  if (row.impactStatement.trim().length === 0) say('impactStatement is empty');

  for (const [field, text] of proseFields(row)) {
    for (const [british, american] of BRITISH_SPELLINGS) {
      if (new RegExp(`\\b${british}\\b`, 'iu').test(text)) {
        say(`${field} uses British spelling "${british}"; write "${american}"`);
      }
    }
  }

  if (row.contributors.length === 0) say('has no contributors');
  for (const contributor of row.contributors) {
    if (contributor.name.trim().length === 0) say('a contributor has an empty name');
    if (!PREDICATES.has(contributor.predicate)) {
      say(`contributor ${contributor.name} has unknown predicate ${contributor.predicate}`);
    }
    if (contributor.predicate === 'co_invented' && row.contributors.length < 2) {
      say(`contributor ${contributor.name} is co_invented but no one else is named`);
    }
  }

  if (!ERA_PATTERN.test(row.era)) say(`era ${row.era} must read like "1880s"`);

  if (row.grantDate !== undefined) {
    if (!GRANT_DATE_PATTERN.test(row.grantDate)) {
      say(`grantDate ${row.grantDate} must read like YYYY-MM-DD`);
    } else if (!isRealCalendarDate(row.grantDate)) {
      say(`grantDate ${row.grantDate} is not a real calendar date`);
    } else {
      const decadeMatch = ERA_PATTERN.test(row.era) ? /^(\d{4})s$/u.exec(row.era) : null;
      if (decadeMatch?.[1]) {
        const decadeStart = Number(decadeMatch[1]);
        const grantYear = Number(row.grantDate.slice(0, 4));
        if (grantYear < decadeStart || grantYear > decadeStart + 9) {
          say(`grantDate ${row.grantDate} falls outside era ${row.era}`);
        }
      }

      const summaryDate = grantDateFromSummary(row.summary);
      if (summaryDate !== null && summaryDate !== row.grantDate) {
        say(
          `grantDate ${row.grantDate} disagrees with the summary's "granted on" date ${summaryDate}`,
        );
      }
    }
  }
  if (!STATE_PATTERN.test(row.state)) say(`state ${row.state} must be a two-letter code`);
  if (row.city.trim().length === 0) say('city is empty');
  if (!Number.isFinite(row.lat) || row.lat < 17 || row.lat > 72) say(`lat ${row.lat} is off-map`);
  if (!Number.isFinite(row.lng) || row.lng < -180 || row.lng > -60) {
    say(`lng ${row.lng} is off-map`);
  }

  if (!row.canonicalUrl.startsWith('https://')) say('canonicalUrl is not https');
  if (row.patentNumber !== undefined) {
    if (!PATENT_PATTERN.test(row.patentNumber)) {
      say(
        `patentNumber ${row.patentNumber} must be digits, with a series letter only where the grant has one`,
      );
    } else if (!row.canonicalUrl.includes(row.patentNumber)) {
      say(`patentNumber ${row.patentNumber} does not appear in canonicalUrl ${row.canonicalUrl}`);
    }
  }

  if (row.evidence.length === 0) say('has no evidence citation');
  for (const citation of row.evidence) {
    if (hostOf(citation.sourceUrl) === null)
      say(`evidence sourceUrl is not a URL: ${citation.sourceUrl}`);
    else if (!citation.sourceUrl.startsWith('https://'))
      say(`evidence sourceUrl is not https: ${citation.sourceUrl}`);
    if (citation.title.trim().length === 0) say('an evidence citation has an empty title');
    if (citation.quote.trim().length === 0) say(`evidence ${citation.title} has an empty quote`);
  }

  const lineages = distinctEvidenceLineages(row);
  if (lineages.length < INVENTION_MIN_DISTINCT_LINEAGES) {
    say(
      `cites ${lineages.length} independent publisher(s); the invention floor is ${INVENTION_MIN_DISTINCT_LINEAGES} (a patent mirror and the patent office are one, Wikipedia is none)`,
    );
  }

  return problems;
}

/**
 * Every mechanical problem across a cohort, including the cross-row ones.
 *
 * Duplicate ids are checked here rather than per row because a row cannot see its siblings, and
 * a duplicate id silently overwrites a staged candidate through the `ON CONFLICT` upsert.
 */
export function validateInventionCohort(
  cohort: readonly InventionCohortRecord[],
): readonly string[] {
  const problems: string[] = [];
  const seenIds = new Map<string, number>();

  for (const row of cohort) {
    problems.push(...validateInventionRow(row));
    seenIds.set(row.id, (seenIds.get(row.id) ?? 0) + 1);
  }

  for (const [id, count] of seenIds) {
    if (count > 1) problems.push(`${id}: appears ${count} times; ids must be unique`);
  }

  return problems;
}
