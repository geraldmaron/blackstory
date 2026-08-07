/**
 * Person-status campaign (repo-n7p6.8): resolve published status='unknown' persons via
 * Wikidata P569 (birth) / P570 (death), staged to the living-status-review lane.
 *
 * For every active-release person with projection status 'unknown' and a stored Wikidata QID
 * (bb_canonical.entity_identifiers, namespace 'wikidata'):
 *   - fetch Special:EntityData/{qid}.json
 *   - extract en label/description, P569/P570 years
 *   - persons with a P570 death date are staged to bb_research.landscape_candidates
 *     (lane living-status-review, same shape as stage-text-mined-death-review.ts) for
 *     operator batch approval via apply-death-review-verdicts.ts
 *   - persons without P570 stay 'unknown' — this script never writes bb_canonical.living_status
 *     and never weakens treatAsLiving('unknown') redaction.
 *
 * Every fetch attempt (staged, no-death-date, fetch-failed, no-qid) is recorded in the
 * source_program_runs summary and in the JSON report.
 *
 * Confidence written into the report/TSV:
 *   high   — normalized en label equals normalized display name, death year present with
 *            year-or-better precision, and plausible against birth year when known
 *   medium — alias match or minor label variance, dates still plausible
 *   low    — label mismatch or implausible dates; stage but do not auto-approve
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a && export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/stage-wikidata-status-review.ts
 *
 * Apply inserts:
 *   DRY_RUN=0 STAGE_WIKIDATA_STATUS_REVIEW_APPLY=1 ...
 *
 * Outputs (default .cache/wikidata-status-review/, override via WIKIDATA_STATUS_REVIEW_REPORT /
 * WIKIDATA_STATUS_REVIEW_TSV):
 *   report.json   (all attempts)
 *   verdicts.tsv  (apply-death-review-verdicts.ts input; verdict column pre-filled 'approve'
 *   only for high-confidence rows, else 'reject' with empty true_death_year so the apply script
 *   quarantines nothing silently — operator edits before use)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.STAGE_WIKIDATA_STATUS_REVIEW_APPLY === '1';
const LANE = 'living-status-review' as const;
const PROGRAM_ID = 'wikidata-status-review' as const;
/**
 * Defaults live under the repo's own .cache/ (same pattern as enrich-entities-llm.ts's
 * REPORT_DIR), not the shared system /tmp — a predictable path in a world-writable directory is
 * an insecure-temp-file pattern (symlink/race risk) that a raw /tmp default invites.
 */
const REPORT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.cache/wikidata-status-review',
);
const REPORT_PATH =
  process.env.WIKIDATA_STATUS_REVIEW_REPORT?.trim() || join(REPORT_DIR, 'report.json');
const TSV_PATH = process.env.WIKIDATA_STATUS_REVIEW_TSV?.trim() || join(REPORT_DIR, 'verdicts.tsv');
const FETCH_DELAY_MS = Number(process.env.WIKIDATA_FETCH_DELAY_MS ?? 400);

type PersonRow = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly qid: string | null;
};

type WikidataDates = {
  readonly label: string | null;
  readonly description: string | null;
  readonly aliases: readonly string[];
  readonly birthYear: number | null;
  readonly birthPrecision: number | null;
  readonly deathYear: number | null;
  readonly deathPrecision: number | null;
};

type Attempt = {
  readonly entityId: string;
  readonly displayName: string;
  readonly qid: string | null;
  readonly outcome: 'staged_deceased' | 'no_death_date' | 'fetch_failed' | 'no_qid';
  readonly confidence?: 'high' | 'medium' | 'low';
  readonly reason?: string;
  readonly birthYear?: number | null;
  readonly deathYear?: number | null;
  readonly wikidataLabel?: string | null;
  readonly wikidataDescription?: string | null;
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["'".]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Wikidata time strings look like "+1929-01-15T00:00:00Z"; precision 9=year, 10=month, 11=day. */
function parseTimeClaim(
  claims: Record<string, unknown> | undefined,
  property: string,
): { year: number | null; precision: number | null } {
  const list = (claims?.[property] ?? []) as Array<{
    mainsnak?: { datavalue?: { value?: { time?: string; precision?: number } } };
    rank?: string;
  }>;
  if (!Array.isArray(list) || list.length === 0) return { year: null, precision: null };
  const usable = list.filter((c) => c.rank !== 'deprecated');
  const preferred = usable.find((c) => c.rank === 'preferred') ?? usable[0];
  const value = preferred?.mainsnak?.datavalue?.value;
  const time = value?.time;
  if (typeof time !== 'string') return { year: null, precision: null };
  const match = /^([+-])(\d{1,16})-/.exec(time);
  if (!match) return { year: null, precision: null };
  const year = Number.parseInt(match[2] ?? '', 10) * (match[1] === '-' ? -1 : 1);
  return {
    year: Number.isFinite(year) ? year : null,
    precision: typeof value?.precision === 'number' ? value.precision : null,
  };
}

async function fetchWikidataDates(qid: string): Promise<WikidataDates> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  let res: Response | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    res = await fetch(url, {
      headers: { 'user-agent': 'blackstory-ops (person-status campaign; contact: operator)' },
    });
    if (res.status !== 429) break;
    const retryAfter = Number(res.headers.get('retry-after') ?? 0);
    const backoffMs = Math.max(retryAfter * 1000, 2000 * 2 ** attempt);
    await sleep(backoffMs);
  }
  if (!res || !res.ok) {
    throw new Error(`Wikidata request failed: ${res?.status ?? 'no response'} for ${qid}`);
  }
  const data = (await res.json()) as {
    entities?: Record<
      string,
      {
        labels?: Record<string, { value?: string }>;
        descriptions?: Record<string, { value?: string }>;
        aliases?: Record<string, Array<{ value?: string }>>;
        claims?: Record<string, unknown>;
      }
    >;
  };
  // Redirected QIDs come back keyed by their target id.
  const entity = data.entities?.[qid] ?? Object.values(data.entities ?? {})[0];
  const claims = entity?.claims as Record<string, unknown> | undefined;
  const birth = parseTimeClaim(claims, 'P569');
  const death = parseTimeClaim(claims, 'P570');
  return {
    label: entity?.labels?.en?.value ?? null,
    description: entity?.descriptions?.en?.value ?? null,
    aliases: (entity?.aliases?.en ?? []).map((a) => a.value ?? '').filter(Boolean),
    birthYear: birth.year,
    birthPrecision: birth.precision,
    deathYear: death.year,
    deathPrecision: death.precision,
  };
}

const YEAR_PRECISION = 9;
const CURRENT_YEAR = 2026;

function assessConfidence(
  person: PersonRow,
  dates: WikidataDates,
): { confidence: 'high' | 'medium' | 'low'; reason: string } {
  const target = normalizeName(person.display_name);
  const labelMatches = dates.label !== null && normalizeName(dates.label) === target;
  const aliasMatches = dates.aliases.some((a) => normalizeName(a) === target);
  const yearPrecise = dates.deathPrecision !== null && dates.deathPrecision >= YEAR_PRECISION;
  const plausible =
    dates.deathYear !== null &&
    dates.deathYear <= CURRENT_YEAR &&
    (dates.birthYear === null ||
      (dates.deathYear - dates.birthYear >= 10 && dates.deathYear - dates.birthYear <= 115));

  if (!plausible) {
    return {
      confidence: 'low',
      reason: `implausible dates: birth=${dates.birthYear ?? '?'} death=${dates.deathYear ?? '?'}`,
    };
  }
  if (!yearPrecise) {
    return { confidence: 'medium', reason: 'death date precision coarser than year' };
  }
  if (labelMatches) {
    return { confidence: 'high', reason: `exact label match "${dates.label}"` };
  }
  if (aliasMatches) {
    return { confidence: 'medium', reason: `alias match (label "${dates.label ?? '?'}")` };
  }
  return {
    confidence: 'low',
    reason: `label mismatch: wikidata "${dates.label ?? '?'}" vs "${person.display_name}"`,
  };
}

async function loadUnknownPersons(client: pg.Client): Promise<PersonRow[]> {
  const { rows } = await client.query<PersonRow>(
    `SELECT re.entity_id,
            re.display_name,
            (SELECT ei.value FROM bb_canonical.entity_identifiers ei
              WHERE ei.entity_id = re.entity_id AND ei.namespace = 'wikidata'
              ORDER BY ei.created_at ASC LIMIT 1) AS qid
     FROM bb_public.release_entities re
     JOIN bb_public.active_release ar ON ar.release_id = re.release_id
     WHERE re.kind = 'person'
       AND re.projection->>'status' = 'unknown'
     ORDER BY re.entity_id`,
  );
  return rows;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const persons = await loadUnknownPersons(client);
    console.log('=== Stage Wikidata P569/P570 status review ===');
    console.log(`Active-release unknown persons: ${persons.length}`);

    const attempts: Attempt[] = [];
    for (const person of persons) {
      if (!person.qid) {
        attempts.push({
          entityId: person.entity_id,
          displayName: person.display_name,
          qid: null,
          outcome: 'no_qid',
          reason: 'no wikidata identifier stored; stays unknown',
        });
        continue;
      }
      try {
        const dates = await fetchWikidataDates(person.qid);
        if (dates.deathYear === null) {
          attempts.push({
            entityId: person.entity_id,
            displayName: person.display_name,
            qid: person.qid,
            outcome: 'no_death_date',
            birthYear: dates.birthYear,
            deathYear: null,
            wikidataLabel: dates.label,
            wikidataDescription: dates.description,
            reason: dates.birthYear
              ? `no P570; P569 birth ${dates.birthYear}; stays unknown`
              : 'no P569/P570 dates; stays unknown',
          });
        } else {
          const { confidence, reason } = assessConfidence(person, dates);
          attempts.push({
            entityId: person.entity_id,
            displayName: person.display_name,
            qid: person.qid,
            outcome: 'staged_deceased',
            confidence,
            reason,
            birthYear: dates.birthYear,
            deathYear: dates.deathYear,
            wikidataLabel: dates.label,
            wikidataDescription: dates.description,
          });
        }
      } catch (error) {
        attempts.push({
          entityId: person.entity_id,
          displayName: person.display_name,
          qid: person.qid,
          outcome: 'fetch_failed',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      await sleep(FETCH_DELAY_MS);
    }

    const staged = attempts.filter((a) => a.outcome === 'staged_deceased');
    const counts = {
      total: attempts.length,
      staged_deceased: staged.length,
      no_death_date: attempts.filter((a) => a.outcome === 'no_death_date').length,
      fetch_failed: attempts.filter((a) => a.outcome === 'fetch_failed').length,
      no_qid: attempts.filter((a) => a.outcome === 'no_qid').length,
      high: staged.filter((a) => a.confidence === 'high').length,
      medium: staged.filter((a) => a.confidence === 'medium').length,
      low: staged.filter((a) => a.confidence === 'low').length,
    };
    console.log(JSON.stringify(counts, null, 2));

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    mkdirSync(dirname(TSV_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, JSON.stringify({ counts, attempts }, null, 2));
    const tsvHeader =
      'entity_id\tdisplay_name\tmined_year\tmined_signal\tverdict\ttrue_death_year\tconfidence\treason';
    // Wikidata-sourced strings (label/description feed displayName/reason) are untrusted input —
    // strip tabs/newlines before joining so a stray control character can never shift a column in
    // the TSV that apply-death-review-verdicts.ts parses by splitting on '\t'.
    const tsvField = (value: string): string => value.replace(/[\t\r\n]+/g, ' ').trim();
    const tsvLines = staged.map((a) =>
      [
        tsvField(a.entityId),
        tsvField(a.displayName),
        String(a.deathYear ?? ''),
        'wikidata_p570',
        a.confidence === 'high' ? 'approve' : 'reject',
        '',
        a.confidence ?? 'low',
        tsvField(`${a.reason ?? ''} (${a.qid}; birth ${a.birthYear ?? '?'})`),
      ].join('\t'),
    );
    writeFileSync(TSV_PATH, [tsvHeader, ...tsvLines].join('\n') + '\n');
    console.log(`Report: ${REPORT_PATH}`);
    console.log(`Verdict TSV: ${TSV_PATH}`);

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDry run only — no inserts. Set DRY_RUN=0 STAGE_WIKIDATA_STATUS_REVIEW_APPLY=1 to apply.',
      );
      return;
    }

    const runId = `run_wikidata_status_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    const nowIso = new Date().toISOString();
    let inserted = 0;
    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO bb_research.source_program_runs
          (id, lane, source_program_id, source_program_name, retrieved_at, rows_fetched, candidate_count, summary, updated_at)
         VALUES ($1, 'other', $2, $3, now(), $4, $5, $6::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           rows_fetched = EXCLUDED.rows_fetched,
           candidate_count = EXCLUDED.candidate_count,
           summary = EXCLUDED.summary,
           updated_at = now()`,
        [
          runId,
          PROGRAM_ID,
          'Wikidata P569/P570 person-status review',
          attempts.length,
          staged.length,
          JSON.stringify({ lane: LANE, counts, source: 'wikidata_p569_p570' }),
        ],
      );

      for (const a of staged) {
        const landscapeId = `landcand_wikidata_status_${a.entityId}`
          .replace(/[^a-zA-Z0-9_]+/g, '_')
          .slice(0, 180);
        const result = await client.query(
          `INSERT INTO bb_research.landscape_candidates
            (id, run_id, lane, source_program_id, source_item_id, display_name, kind, summary,
             canonical_url, research_lane_only, status, payload, provenance, discovered_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,'person',$7,$8,true,'pending',$9::jsonb,$10::jsonb,$11,now())
           ON CONFLICT (lane, source_item_id) DO UPDATE SET
             run_id = EXCLUDED.run_id,
             summary = EXCLUDED.summary,
             payload = EXCLUDED.payload,
             provenance = EXCLUDED.provenance,
             updated_at = now()
           WHERE bb_research.landscape_candidates.payload->'personReview'->>'approved' IS DISTINCT FROM 'true'
             AND bb_research.landscape_candidates.status IS DISTINCT FROM 'quarantined'`,
          [
            landscapeId,
            runId,
            LANE,
            PROGRAM_ID,
            a.entityId,
            a.displayName,
            `Wikidata P570 deceased signal (${a.deathYear}, ${a.confidence}): ${a.reason ?? ''}`.slice(
              0,
              300,
            ),
            `https://www.wikidata.org/wiki/${a.qid}`,
            JSON.stringify({
              entityId: a.entityId,
              personReview: {
                livingStatus: 'deceased' as const,
                deathYear: a.deathYear,
                signal: 'wikidata_p570',
                approved: false,
              },
              ...(a.birthYear !== null && a.birthYear !== undefined
                ? { birthYear: a.birthYear }
                : {}),
              deathYear: a.deathYear,
            }),
            JSON.stringify({
              source: 'wikidata_p569_p570',
              qid: a.qid,
              wikidataLabel: a.wikidataLabel,
              wikidataDescription: a.wikidataDescription,
              confidence: a.confidence,
              reason: a.reason,
              citation: `https://www.wikidata.org/wiki/${a.qid}`,
            }),
            nowIso,
          ],
        );
        inserted += result.rowCount ?? 0;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    console.log(`\nApplied: upserted ${inserted} landscape_candidates rows (lane=${LANE}).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
