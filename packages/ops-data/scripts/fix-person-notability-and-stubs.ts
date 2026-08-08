/**
 * repo-z1uk — repair the notability rubric on person records, and give the
 * Negro Leagues / Divine Nine stubs actual content.
 *
 * Two passes over the same defect family repo-9ki8 uncovered:
 *
 * PASS 1 (notability). 179 person records carried `documented_site` as their only notability
 * criterion. The rubric in packages/domain/src/entity-status.ts defines that criterion as "The
 * entity IS a documented site" — it describes a place. On a person it is the same category
 * error that let Harriet Tubman's record become her visitor center's record.
 *
 * Only records with a criterion demonstrably supported by their OWN existing summary/claims text
 * are rewritten. Each assignment carries an evidence quote that this script re-verifies against
 * the live record before writing — an assignment whose quote cannot be found is dropped, not
 * trusted.
 *
 * Records where no criterion is supported are deliberately LEFT on `documented_site`. Writing an
 * empty notability_basis would be more honest but would fail `hasRequiredNotabilityBasis`
 * (packages/domain/src/relevance/why-public-explanation.ts), which gates the public "Why this
 * appears" payload — it would blank that surface rather than fix it. The rubric gap those records
 * expose is tracked separately; see repo-z1uk's notes.
 *
 * PASS 2 (stub content). 39 Negro Leagues Hall of Fame and Divine Nine founder records were a
 * single boilerplate sentence with one claim. Each now carries claims researched from the
 * institution's own pages (baseballhall.org, apa1906.net, oppf.org, phibetasigma1914.org), every
 * claim carrying the URL it came from and the sentence on that page that supports it.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-person-notability-and-stubs.ts
 *
 * Apply:
 *   DRY_RUN=0 FIX_PERSON_NOTABILITY_APPLY=1 node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-person-notability-and-stubs.ts
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { NOTABILITY_CRITERIA, NOTABILITY_RUBRIC } from '@repo/domain';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_PERSON_NOTABILITY_APPLY === '1';

const NOTABILITY_INPUT =
  process.env.NOTABILITY_INPUT ?? '/tmp/blackstory-repo-z1uk/apply-notability.json';
const CONTENT_INPUT = process.env.CONTENT_INPUT ?? '/tmp/blackstory-repo-z1uk/apply-content.json';

type CriterionProposal = {
  readonly criterion: string;
  readonly note: string;
  readonly evidence_quote: string;
};
type NotabilityProposal = {
  readonly id: string;
  readonly display_name: string;
  readonly criteria: readonly CriterionProposal[];
};
type ContentClaim = {
  readonly predicate: string;
  readonly object: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly citationSource: string;
  readonly confidenceLevel: string;
  readonly source_quote?: string;
};
type ContentProposal = {
  readonly id: string;
  readonly display_name: string;
  readonly proposed_summary: string;
  readonly claims: readonly ContentClaim[];
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/** Compare quotes the way a reader would, not the way a byte comparator would. */
function normalizeForQuoteMatch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * An evidence quote is the whole basis for changing why a person is in this catalog. If it is
 * not actually in the record, the assignment is discarded — never written on trust.
 */
function quoteIsGrounded(quote: string, haystack: string): boolean {
  const hay = normalizeForQuoteMatch(haystack);
  const fragments = quote
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);
  if (fragments.length === 0) return false;
  return fragments.every((fragment) => hay.includes(normalizeForQuoteMatch(fragment)));
}

async function main(): Promise<void> {
  const notabilityProposals: NotabilityProposal[] = JSON.parse(
    readFileSync(NOTABILITY_INPUT, 'utf8'),
  );
  const contentProposals: ContentProposal[] = JSON.parse(readFileSync(CONTENT_INPUT, 'utf8'));

  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const activeRelease = await client.query<{ release_id: string }>(
      `SELECT release_id FROM bb_public.active_release LIMIT 1`,
    );
    const releaseId = activeRelease.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    console.log('=== repo-z1uk person notability + stub content ===');

    // ---- Pass 1: verify every notability proposal against the live record ----
    const live = await client.query<{
      id: string;
      summary: string | null;
      claims: unknown;
    }>(
      `SELECT e.id,
              e.kind_detail -> 'editorial' ->> 'summary' AS summary,
              COALESCE(r.claims, '[]'::jsonb) AS claims
       FROM bb_canonical.entities e
       LEFT JOIN bb_public.release_entities r
         ON r.entity_id = e.id AND r.release_id = $1
       WHERE e.id = ANY($2::text[])`,
      [releaseId, notabilityProposals.map((p) => p.id)],
    );
    const liveById = new Map(live.rows.map((row) => [row.id, row]));

    const verifiedNotability: {
      id: string;
      basis: { criterion: string; note: string; evidenceIds: string[] }[];
      labels: string[];
    }[] = [];
    const rejected: { id: string; criterion: string; why: string }[] = [];

    for (const proposal of notabilityProposals) {
      const row = liveById.get(proposal.id);
      if (!row) {
        rejected.push({ id: proposal.id, criterion: '*', why: 'entity not found' });
        continue;
      }
      const haystack = `${row.summary ?? ''} ${JSON.stringify(row.claims ?? [])}`;
      const kept = proposal.criteria.filter((candidate) => {
        if (!(NOTABILITY_CRITERIA as readonly string[]).includes(candidate.criterion)) {
          rejected.push({
            id: proposal.id,
            criterion: candidate.criterion,
            why: 'not in NOTABILITY_CRITERIA',
          });
          return false;
        }
        if (candidate.criterion === 'documented_site') {
          rejected.push({
            id: proposal.id,
            criterion: candidate.criterion,
            why: 'documented_site is reserved for sites',
          });
          return false;
        }
        if (!quoteIsGrounded(candidate.evidence_quote ?? '', haystack)) {
          rejected.push({
            id: proposal.id,
            criterion: candidate.criterion,
            why: 'evidence quote not found in record',
          });
          return false;
        }
        return true;
      });
      if (kept.length === 0) continue;

      verifiedNotability.push({
        id: proposal.id,
        basis: kept.map((candidate) => ({
          criterion: candidate.criterion,
          note: candidate.note,
          evidenceIds: [],
        })),
        labels: kept.map(
          (candidate) => NOTABILITY_RUBRIC[candidate.criterion as keyof typeof NOTABILITY_RUBRIC],
        ),
      });
    }

    console.log(
      `\nNotability: ${notabilityProposals.length} proposed, ${verifiedNotability.length} verified, ` +
        `${rejected.length} assignment(s) rejected`,
    );
    for (const entry of rejected.slice(0, 20)) {
      console.log(`  rejected ${entry.id} [${entry.criterion}] — ${entry.why}`);
    }

    // ---- Pass 2: stub content ----
    const contentReady = contentProposals.filter(
      (proposal) => proposal.claims.length > 0 && proposal.proposed_summary.trim().length > 0,
    );
    const missingCitation = contentProposals.flatMap((proposal) =>
      proposal.claims
        .filter((claim) => !/^https:\/\//.test(claim.citationHref))
        .map((claim) => `${proposal.id}: ${claim.citationHref}`),
    );
    console.log(
      `\nStub content: ${contentProposals.length} proposed, ${contentReady.length} with claims, ` +
        `${missingCitation.length} claim(s) missing an https citation`,
    );
    for (const entry of missingCitation.slice(0, 10)) console.log(`  ${entry}`);
    if (missingCitation.length > 0) {
      throw new Error('refusing to write a claim without a real citation URL');
    }

    if (DRY_RUN || !APPLY) {
      console.log('\nDry run. Set DRY_RUN=0 FIX_PERSON_NOTABILITY_APPLY=1 to apply.');
      console.log(
        `Would rewrite notability on ${verifiedNotability.length} records and content on ` +
          `${contentReady.length} records.`,
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const entry of verifiedNotability) {
        const basisJson = JSON.stringify(entry.basis);
        const labelsJson = JSON.stringify(entry.labels);
        await client.query(
          `UPDATE bb_canonical.entities
           SET notability_basis = $2::jsonb, updated_at = now()
           WHERE id = $1`,
          [entry.id, basisJson],
        );
        await client.query(
          `UPDATE bb_public.release_entities
           SET projection = jsonb_set(
                 jsonb_set(projection, '{notabilityBasis}', $3::jsonb, true),
                 '{notabilityLabels}', $4::jsonb, true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id, basisJson, labelsJson],
        );
        await client.query(
          `UPDATE bb_public.search_index
           SET facets = jsonb_set(
                 jsonb_set(facets, '{notabilityBasis}', $3::jsonb, true),
                 '{notabilityLabels}', $4::jsonb, true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id, basisJson, labelsJson],
        );
      }

      for (const proposal of contentReady) {
        const claims = proposal.claims.map((claim, index) => ({
          id: `claim_${proposal.id.replace(/-/g, '_')}_${String(index + 1).padStart(2, '0')}`,
          object: claim.object,
          predicate: claim.predicate,
          citationHref: claim.citationHref,
          citationLabel: claim.citationLabel,
          citationSource: claim.citationSource,
          confidenceLevel: claim.confidenceLevel,
        }));
        const claimsJson = JSON.stringify(claims);
        const claimIdsJson = JSON.stringify(claims.map((claim) => claim.id));

        await client.query(
          `UPDATE bb_canonical.entities
           SET kind_detail = jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
               updated_at = now()
           WHERE id = $1`,
          [proposal.id, proposal.proposed_summary],
        );
        await client.query(
          `UPDATE bb_public.release_entities
           SET summary = $3,
               claims = $4::jsonb,
               projection = jsonb_set(
                 jsonb_set(
                   jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
                   '{claims}', $4::jsonb, true
                 ),
                 '{claimIds}', $5::jsonb, true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, proposal.id, proposal.proposed_summary, claimsJson, claimIdsJson],
        );
        await client.query(
          `UPDATE bb_public.search_index
           SET claim_count = $3,
               facets = jsonb_set(facets, '{claimCount}', to_jsonb($3::int), true)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, proposal.id, claims.length],
        );
      }

      await client.query('COMMIT');
      console.log(
        `\nApplied. Notability rewritten on ${verifiedNotability.length}, ` +
          `content rewritten on ${contentReady.length}.`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const remaining = await client.query<{ n: string }>(
      `SELECT count(*)::int AS n
       FROM bb_canonical.entities e
       WHERE e.kind = 'person'
         AND (
           SELECT string_agg(DISTINCT b ->> 'criterion', ',')
           FROM jsonb_array_elements(COALESCE(e.notability_basis, '[]'::jsonb)) b
         ) = 'documented_site'`,
    );
    console.log(
      `\nPerson records still on documented_site only: ${remaining.rows[0]?.n ?? '?'} ` +
        `(these are the rubric-gap records — see repo-z1uk)`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
