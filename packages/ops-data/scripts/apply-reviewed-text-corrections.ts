/**
 * Apply independently verified text corrections to live records, everywhere the text lives.
 *
 * A live record's summary and context are copied into the published row and its projection, the
 * search index facets, the canonical entity's editorial block and, for lane records, the landscape
 * row a republish rebuilds from. Correcting only the published row lets the next republish restore
 * the error, so every copy that exists is corrected in one transaction.
 *
 * Input: --corrections-file=<json> with entries
 *   { entityId, summary, historicalContext?, claimFixes?: [{ from, to }], mustNotContain: [phrase] }
 * Each entry must already have passed the other provider's verification; this script does not
 * review anything. `mustNotContain` lists the wrong phrases: the run rolls back if any survives in
 * the published row, its search facets or the canonical record.
 *
 * Dry run by default (it writes inside a transaction and rolls back). Writes need DRY_RUN=0 TEXT_CORRECTIONS_APPLY=1. The previous text of every
 * field is written to --backup-file before anything changes. Afterwards, republish the CDN catalog
 * and purge Cloudflare (CLAUDE.md, "Republishing the CDN catalog after a published write").
 */
import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { connectWithDeadline, normalizePgConnectionString } from './lib/pg-connection.ts';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';

type Correction = {
  readonly entityId: string;
  readonly summary: string;
  readonly historicalContext?: string;
  readonly claimFixes?: readonly { readonly from: string; readonly to: string }[];
  /** Exact strings replaced wherever they occur, such as a keyword that repeats a wrong phrase. */
  readonly textFixes?: readonly { readonly from: string; readonly to: string }[];
  readonly mustNotContain: readonly string[];
};

const WRITE = process.env.DRY_RUN === '0' && process.env.TEXT_CORRECTIONS_APPLY === '1';

function flag(name: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!hit) throw new Error(`--${name}= is required`);
  return hit.slice(name.length + 3);
}

/** Replace a fixed claim's exact text anywhere in a JSON value, e.g. a notability note that repeats it. */
function replaceEverywhere(value: unknown, fixes: Correction['claimFixes']): unknown {
  if (!fixes?.length) return value;
  if (typeof value === 'string') {
    for (const fix of fixes) {
      if (value === fix.from) return fix.to;
      if (value === `${fix.from}.`) return fix.to.endsWith('.') ? fix.to : `${fix.to}.`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => replaceEverywhere(item, fixes));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceEverywhere(item, fixes)]),
    );
  }
  return value;
}

/** Replace a claim's object wherever claims are stored; returns how many were replaced. */
function fixClaims(
  claims: unknown,
  fixes: Correction['claimFixes'],
): { claims: unknown; hits: number } {
  if (!Array.isArray(claims) || !fixes?.length) return { claims, hits: 0 };
  let hits = 0;
  const next = claims.map((claim: Record<string, unknown>) => {
    const fix = fixes.find((f) => f.from === claim.object);
    if (!fix) return claim;
    hits += 1;
    return { ...claim, object: fix.to };
  });
  return { claims: next, hits };
}

async function main(): Promise<void> {
  const corrections = JSON.parse(readFileSync(flag('corrections-file'), 'utf8')) as Correction[];
  const backupFile = flag('backup-file');
  for (const c of corrections) {
    if (!c.entityId || !c.summary?.trim() || !Array.isArray(c.mustNotContain)) {
      throw new Error(`Malformed correction for ${c.entityId}`);
    }
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));
  const client = await connectWithDeadline<pg.PoolClient>(pool);
  const backup: Record<string, unknown> = {};
  try {
    // The dry run also writes, so it can read back every copy, then always rolls back.
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM published.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    for (const c of corrections) {
      const pub = (
        await client.query(
          `SELECT summary, claims, projection FROM published.release_entities
           WHERE release_id = $1 AND entity_id = $2 FOR UPDATE`,
          [releaseId, c.entityId],
        )
      ).rows[0];
      if (!pub) throw new Error(`${c.entityId} is not in the active release`);
      const search = (
        await client.query(
          `SELECT facets FROM published.search_index WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, c.entityId],
        )
      ).rows[0];
      const canon = (
        await client.query(`SELECT kind_detail FROM canonical.entities WHERE id = $1`, [c.entityId])
      ).rows[0];
      const land = (
        await client.query(
          `SELECT summary, payload FROM research.landscape_candidates WHERE id = $1`,
          [c.entityId],
        )
      ).rows[0];
      backup[c.entityId] = {
        published: { summary: pub.summary, claims: pub.claims, projection: pub.projection },
        searchFacets: search?.facets ?? null,
        canonicalKindDetail: canon?.kind_detail ?? null,
        landscape: land ? { summary: land.summary, payload: land.payload } : null,
      };

      // Count claim fixes against the stored claims before the deep replace rewrites them.
      const projClaims = fixClaims(pub.projection.claims, c.claimFixes);
      const fixes = [...(c.claimFixes ?? []), ...(c.textFixes ?? [])];
      const projection: Record<string, unknown> = {
        ...(replaceEverywhere(pub.projection, fixes) as Record<string, unknown>),
        summary: c.summary,
      };
      if (c.historicalContext !== undefined) projection.historicalContext = c.historicalContext;
      if ((c.claimFixes?.length ?? 0) > 0 && projClaims.hits === 0) {
        throw new Error(`${c.entityId}: a claim fix matched no published claim`);
      }
      // summary, claims and the other columns are generated from projection.
      await client.query(
        `UPDATE published.release_entities SET projection = $3::jsonb
         WHERE release_id = $1 AND entity_id = $2`,
        [releaseId, c.entityId, JSON.stringify(projection)],
      );
      if (search) {
        await client.query(
          `UPDATE published.search_index SET facets = jsonb_set($4::jsonb, '{summary}', to_jsonb($3::text), true)
           WHERE release_id = $1 AND entity_id = $2`,
          [
            releaseId,
            c.entityId,
            c.summary,
            JSON.stringify(replaceEverywhere(search.facets, fixes)),
          ],
        );
      }
      if (canon?.kind_detail?.editorial) {
        const editorial: Record<string, unknown> = {
          ...(replaceEverywhere(canon.kind_detail.editorial, fixes) as Record<string, unknown>),
          summary: c.summary,
        };
        if (c.historicalContext !== undefined && 'historicalContext' in editorial) {
          editorial.historicalContext = c.historicalContext;
        }
        await client.query(
          `UPDATE canonical.entities SET kind_detail = jsonb_set(kind_detail, '{editorial}', $2::jsonb), updated_at = now()
           WHERE id = $1`,
          [c.entityId, JSON.stringify(editorial)],
        );
      }
      if (land) {
        const payload = { ...(replaceEverywhere(land.payload, fixes) as Record<string, unknown>) };
        if (c.historicalContext !== undefined && 'historicalContext' in payload) {
          payload.historicalContext = c.historicalContext;
        }
        if (Array.isArray(payload.evidenceCitations) && c.claimFixes?.length) {
          payload.evidenceCitations = (payload.evidenceCitations as Record<string, unknown>[]).map(
            (e) => {
              const fix = c.claimFixes!.find((f) => f.from === e.quote);
              return fix ? { ...e, quote: fix.to } : e;
            },
          );
        }
        await client.query(
          `UPDATE research.landscape_candidates SET summary = $2, payload = $3::jsonb, updated_at = now() WHERE id = $1`,
          [c.entityId, c.summary, JSON.stringify(payload)],
        );
      }

      // Read back every copy and refuse to keep any wrong phrase.
      const after = (
        await client.query(
          `SELECT (SELECT row_to_json(e)::text FROM published.release_entities e WHERE e.release_id = $1 AND e.entity_id = $2)
                  || coalesce((SELECT facets::text FROM published.search_index WHERE release_id = $1 AND entity_id = $2), '')
                  || coalesce((SELECT kind_detail::text FROM canonical.entities WHERE id = $2), '')
                  || coalesce((SELECT summary || payload::text FROM research.landscape_candidates WHERE id = $2), '') AS text`,
          [releaseId, c.entityId],
        )
      ).rows[0].text as string;
      const survivors = c.mustNotContain.filter((phrase) =>
        after.toLowerCase().includes(phrase.toLowerCase()),
      );
      console.log(
        `${c.entityId}: published${search ? ', search' : ''}${canon?.kind_detail?.editorial ? ', canonical' : ''}${land ? ', landscape' : ''}` +
          `${projClaims.hits ? `, ${projClaims.hits} claim(s)` : ''}${survivors.length ? `; STILL CONTAINS ${JSON.stringify(survivors)}` : '; clean'}`,
      );
      if (survivors.length > 0)
        throw new Error(`${c.entityId} still contains a wrong phrase; rolling back`);
    }

    writeFileSync(backupFile, JSON.stringify(backup, null, 1));
    await client.query(WRITE ? 'COMMIT' : 'ROLLBACK');
    console.log(
      WRITE ? `Applied ${corrections.length}. Backup: ${backupFile}` : 'DRY RUN: rolled back.',
    );
    if (WRITE) remindToRepublishCatalogArtifacts(corrections.length);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
