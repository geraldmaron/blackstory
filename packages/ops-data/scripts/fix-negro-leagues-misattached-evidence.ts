/**
 * Quarantines misattached namesake articles and inserts evidence for the identified Negro
 * Leagues players. Name-token overlap alone cannot establish subject identity; occupation and
 * article subject matter must agree. Default dry-run; writes require DRY_RUN=0 and
 * FIX_NEGRO_LEAGUES_EVIDENCE_APPLY=1.
 */
import { createHash } from 'node:crypto';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_NEGRO_LEAGUES_EVIDENCE_APPLY === '1';

type Correction = {
  readonly entityId: string;
  readonly wrongTitle: string;
  readonly correctTitle: string;
  readonly wikipediaTitle: string;
};

const CORRECTIONS: readonly Correction[] = [
  {
    entityId: 'negro-leagues-hof-brown-ray',
    wrongTitle: 'Ray Brown (musician)',
    correctTitle: 'Ray Brown (Negro leagues pitcher)',
    wikipediaTitle: 'Ray_Brown_(Negro_leagues_pitcher)',
  },
  {
    entityId: 'negro-leagues-hof-foster-bill',
    wrongTitle: 'Bill Foster (character)',
    correctTitle: 'Bill Foster (baseball)',
    wikipediaTitle: 'Bill_Foster_(baseball)',
  },
  {
    entityId: 'negro-leagues-hof-grant-frank',
    wrongTitle: 'Frank Grant (boxer)',
    correctTitle: 'Frank Grant (baseball)',
    wikipediaTitle: 'Frank_Grant_(baseball)',
  },
  {
    entityId: 'negro-leagues-hof-williams-joe',
    wrongTitle: 'Joe Williams (jazz singer)',
    correctTitle: 'Smokey Joe Williams',
    wikipediaTitle: 'Smokey_Joe_Williams',
  },
  {
    entityId: 'negro-leagues-hof-taylor-ben',
    wrongTitle: 'Ben Taylor (newspaper editor)',
    correctTitle: 'Ben Taylor (first baseman, born 1888)',
    wikipediaTitle: 'Ben_Taylor_(first_baseman,_born_1888)',
  },
];

type WikipediaExtract = { readonly title: string; readonly extract: string; readonly url: string };

async function fetchExtract(title: string): Promise<WikipediaExtract> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts%7Cinfo&explaintext=1&inprop=url&titles=${title}&format=json&formatversion=2`;
  const response = await fetch(url, { headers: { 'User-Agent': 'blackstory-evidence-fix/1.0' } });
  if (!response.ok) throw new Error(`Wikipedia API ${response.status} for ${title}`);
  const data = (await response.json()) as {
    query: { pages: readonly { title: string; extract?: string; fullurl?: string }[] };
  };
  const page = data.query.pages[0];
  if (!page?.extract || !page.fullurl) throw new Error(`No extract returned for ${title}`);
  return { title: page.title, extract: page.extract, url: page.fullurl };
}

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    console.log('=== negro-leagues-hof mis-attached evidence fix ===\n');

    const extracts = new Map<string, WikipediaExtract>();
    for (const c of CORRECTIONS) {
      const extract = await fetchExtract(c.wikipediaTitle);
      extracts.set(c.entityId, extract);
      console.log(
        `${c.entityId}: fetched "${extract.title}" (${extract.extract.length} chars) — ` +
          `will quarantine "${c.wrongTitle}"`,
      );
    }

    if (DRY_RUN || !APPLY) {
      console.log(
        '\nDRY_RUN=1 (default): no database writes. ' +
          'Set DRY_RUN=0 FIX_NEGRO_LEAGUES_EVIDENCE_APPLY=1 to apply.',
      );
      return;
    }

    await client.query('BEGIN');
    try {
      for (const c of CORRECTIONS) {
        const extract = extracts.get(c.entityId);
        if (!extract) continue;

        const quarantined = await client.query(
          `UPDATE research.entity_evidence
              SET status = 'quarantined',
                  provenance = provenance || '{"misattached": true, "misattachedReason": "wrong subject — name collision, corrected by fix-negro-leagues-misattached-evidence.ts"}'::jsonb
            WHERE entity_id = $1 AND collector = 'wikipedia' AND title = $2`,
          [c.entityId, c.wrongTitle],
        );

        const contentHash = createHash('sha256').update(extract.extract).digest('hex');
        const id = `ev_fix_${c.entityId.replace(/-/g, '_')}_wikipedia`;
        await client.query(
          `INSERT INTO research.entity_evidence
             (id, entity_id, lane, collector, source_url, source_tier, title, content_text,
              content_hash, char_count, quality_score, status, provenance, fetched_at)
           VALUES ($1,$2,'negro-leagues-hof','wikipedia',$3,'tier2',$4,$5,$6,$7,0.9,'captured',$8::jsonb, now())
           ON CONFLICT (entity_id, collector, source_url) DO UPDATE SET
             content_text = EXCLUDED.content_text,
             content_hash = EXCLUDED.content_hash,
             char_count = EXCLUDED.char_count,
             quality_score = EXCLUDED.quality_score,
             status = EXCLUDED.status,
             provenance = EXCLUDED.provenance,
             fetched_at = now()`,
          [
            id,
            c.entityId,
            extract.url,
            extract.title,
            extract.extract,
            contentHash,
            extract.extract.length,
            JSON.stringify({
              manualCorrection: true,
              correctedFrom: c.wrongTitle,
              fixScript: 'fix-negro-leagues-misattached-evidence.ts',
            }),
          ],
        );
        console.log(
          `  ${c.entityId}: quarantined ${quarantined.rowCount ?? 0} wrong row(s), inserted corrected evidence`,
        );
      }
      await client.query('COMMIT');
      console.log('\nApplied.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
