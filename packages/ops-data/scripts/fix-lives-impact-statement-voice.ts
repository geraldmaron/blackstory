/**
 * Voice-only correction of law and case impact statements in the active release.
 *
 * Lives shows a record's impact statement as "What followed" on its rule card, and that text
 * answers to docs/content/neo-voice.md like any other narration: no em dash, no expanded negative
 * contraction. On 2026-09-20, 27 of the 43 published impact statements carried em dashes. This
 * script replaces a statement with a reworded one and proves, before it writes, that the rewording
 * changed the voice and nothing else.
 *
 * WHERE THE TEXT LIVES. `published.release_entities.projection.impactStatement` is the only copy
 * for the curated law records (checked 2026-09-20: `canonical.entities` holds no impact statement,
 * the legal snapshots and search index do not carry it, `public.published_entities` is a view).
 * Records staged through the law-editorial lane also carry `payload.impactStatement` on their
 * `research.landscape_candidates` row, and the incremental publisher rebuilds the live row from
 * that payload on republish, so both copies are written or the next republish reverts the fix.
 *
 * WHAT IT REFUSES. For every record it checks, and aborts the whole run on any failure:
 *   - the live text still hashes to `expectedOldSha256` (nobody edited it since it was read);
 *   - the new text passes `findProseVoiceIssues` for em dashes and expanded contractions;
 *   - FIDELITY: every number, every year, every quoted string and every capitalized name in the
 *     old text is present in the new one, and the new one introduces no number or year of its own.
 *     A deliberate exception is listed per record in `fidelityExceptions` with the reason, and is
 *     printed, so a dropped fact is never silent.
 * It does not judge whether a statement's claims are sourced. That evidence debt is tracked
 * separately; this script only guarantees the rewording did not add to it or subtract from it.
 *
 * The rewritten text is entity data and lives OUTSIDE git (session scratch or .cache):
 *   [{ "id": "...", "expectedOldSha256": "...", "impactStatement": "...",
 *      "fidelityExceptions": [{ "token": "...", "reason": "..." }] }]
 *
 * Default is dry-run. Production writes require DRY_RUN=0 FIX_LIVES_IMPACT_VOICE_APPLY=1.
 * After apply: rebuild the Lives snapshots (build-lives-snapshots.ts), then republish the CDN
 * catalog locally (publish-release-catalog-artifacts.ts). See CLAUDE.md.
 *
 * Usage (repo root):
 *   set -a && . apps/web/.env.local && set +a
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/fix-lives-impact-statement-voice.ts --file=/path/to/rewrites.json
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { findProseVoiceIssues } from '@repo/domain/editorial';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_LIVES_IMPACT_VOICE_APPLY === '1';

type Rewrite = {
  readonly id: string;
  readonly expectedOldSha256: string;
  readonly impactStatement: string;
  readonly fidelityExceptions?: readonly { readonly token: string; readonly reason: string }[];
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const STOP_CAPITALIZED = new Set([
  'A',
  'An',
  'And',
  'After',
  'Adopted',
  'But',
  'Even',
  'For',
  'Its',
  'It',
  'No',
  'The',
  'Their',
  'Then',
  'That',
  'Those',
  'They',
  'This',
  'These',
  'States',
  'Once',
  'Black',
  'White',
]);

/** Facts a rewording must carry across: numbers, years, quotations, and capitalized names. */
export function fidelityTokens(text: string): {
  readonly numbers: readonly string[];
  readonly quotes: readonly string[];
  readonly names: readonly string[];
} {
  // A thousands comma belongs to the number (2,000); a trailing one is punctuation (1968,).
  const numbers = [...text.matchAll(/\$?\d(?:[\d,]*\d)?(?:\.\d+)?/g)].map((m) => m[0]);
  const quotes = [...text.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((m) =>
    (m[1] ?? m[2] ?? '').replace(/[.,;:]$/, ''),
  );
  const names = [...text.matchAll(/\b[A-Z][A-Za-z'’.-]*[a-z]\b/g)]
    .map((m) => m[0].replace(/['’]s$/, '').replace(/\.$/, ''))
    .filter((word) => !STOP_CAPITALIZED.has(word));
  return { numbers, quotes, names };
}

export function fidelityProblems(oldText: string, rewrite: Rewrite): readonly string[] {
  const allowed = new Set((rewrite.fidelityExceptions ?? []).map((e) => e.token));
  const before = fidelityTokens(oldText);
  const after = fidelityTokens(rewrite.impactStatement);
  const problems: string[] = [];
  for (const kind of ['numbers', 'quotes', 'names'] as const) {
    const kept = new Set(after[kind]);
    for (const token of new Set(before[kind])) {
      if (!kept.has(token) && !allowed.has(token))
        problems.push(`drops ${kind.slice(0, -1)} "${token}"`);
    }
  }
  const had = new Set(before.numbers);
  for (const token of new Set(after.numbers)) {
    if (!had.has(token) && !allowed.has(token)) problems.push(`introduces number "${token}"`);
  }
  const hadNames = new Set(before.names);
  for (const token of new Set(after.names)) {
    if (!hadNames.has(token) && !allowed.has(token)) problems.push(`introduces name "${token}"`);
  }
  return problems;
}

async function main(): Promise<void> {
  const file = arg('file');
  if (!file) throw new Error('--file=/path/to/rewrites.json is required');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const rewrites = JSON.parse(readFileSync(file, 'utf8')) as readonly Rewrite[];
  const pool = new pg.Pool(normalizePgConnectionString(url));
  const client = await pool.connect();
  try {
    const release = await client.query<{ release_id: string }>(
      "SELECT release_id FROM published.active_release WHERE id = 'active'",
    );
    const releaseId = release.rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const failures: string[] = [];
    const plan: { id: string; text: string; landscape: boolean }[] = [];
    for (const rewrite of rewrites) {
      const live = await client.query<{ impact: string | null; landscape: boolean }>(
        `SELECT e.projection->>'impactStatement' AS impact,
                EXISTS (SELECT 1 FROM research.landscape_candidates l
                        WHERE l.id = e.entity_id AND l.payload ? 'impactStatement') AS landscape
         FROM published.release_entities e WHERE e.release_id = $1 AND e.entity_id = $2`,
        [releaseId, rewrite.id],
      );
      const row = live.rows[0];
      if (!row?.impact) {
        failures.push(`${rewrite.id}: no live impact statement`);
        continue;
      }
      if (sha256(row.impact) !== rewrite.expectedOldSha256) {
        failures.push(
          `${rewrite.id}: live text changed since it was read; re-read before rewriting`,
        );
        continue;
      }
      const voice = findProseVoiceIssues(rewrite.impactStatement).filter(
        (finding) => finding.rule === 'em-dash' || finding.rule === 'expanded-contraction',
      );
      for (const finding of voice)
        failures.push(`${rewrite.id}: ${finding.label}: …${finding.excerpt}…`);
      for (const problem of fidelityProblems(row.impact, rewrite))
        failures.push(`${rewrite.id}: ${problem}`);
      for (const exception of rewrite.fidelityExceptions ?? []) {
        console.log(`exception  ${rewrite.id}: "${exception.token}": ${exception.reason}`);
      }
      plan.push({ id: rewrite.id, text: rewrite.impactStatement, landscape: row.landscape });
    }

    if (failures.length > 0) {
      console.error(`REFUSED: ${failures.length} problem(s). Nothing was written.`);
      for (const failure of failures) console.error(`  ${failure}`);
      process.exitCode = 1;
      return;
    }

    console.log(`${plan.length} statement(s) pass the voice gate and the fidelity check.`);
    console.log(`landscape copies to mirror: ${plan.filter((entry) => entry.landscape).length}`);
    if (DRY_RUN || !APPLY) {
      console.log('Dry run. Set DRY_RUN=0 FIX_LIVES_IMPACT_VOICE_APPLY=1 to write.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const entry of plan) {
        const updated = await client.query(
          `UPDATE published.release_entities
           SET projection = jsonb_set(projection, '{impactStatement}', to_jsonb($3::text), false)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, entry.id, entry.text],
        );
        if (updated.rowCount !== 1)
          throw new Error(`${entry.id}: expected 1 live row, got ${updated.rowCount}`);
        if (entry.landscape) {
          await client.query(
            `UPDATE research.landscape_candidates
             SET payload = jsonb_set(payload, '{impactStatement}', to_jsonb($2::text), false)
             WHERE id = $1`,
            [entry.id, entry.text],
          );
        }
      }
      await client.query('COMMIT');
      console.log(`Wrote ${plan.length} impact statement(s) in release ${releaseId}.`);
      console.log('Next: rebuild the Lives snapshots, then republish the CDN catalog locally.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

const invokedDirectly = process.argv[1]?.endsWith('fix-lives-impact-statement-voice.ts');
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
