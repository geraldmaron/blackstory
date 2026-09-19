/**
 * Applies source-specific corrections and corroboration to the listed civil-rights records.
 * Each assertion retains its cited institution or publication; source disagreement and
 * unsupported geographic specificity require explicit treatment.
 */
import pg from 'pg';
import { remindToRepublishCatalogArtifacts } from './lib/catalog-republish-reminder.ts';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.FIX_CRL_UNCORROBORATED_APPLY === '1';

const MIZELL_ID = 'civil-rights-leaders-von-d-mizell';
const SHIRLEY_ID = 'civil-rights-leaders-calvin-shirley';
const JOHNSON_ID = 'civil-rights-leaders-eula-johnson';
const PENN_ID = 'civil-rights-leaders-william-f-penn';

const MUSEUM_MIZELL =
  'https://floridacivilrightsmuseum.org/exhibition/broward-county/dr-von-d-mizell/';
const MUSEUM_JOHNSON =
  'https://floridacivilrightsmuseum.org/exhibition/broward-county/eula-mae-gandy-johnson/';
const YALE_PENN = 'https://onlineexhibits.library.yale.edu/s/early-black-yale-students/item/21395';
const LOC_ATLANTA_BRANCH = 'https://www.loc.gov/item/93513164/';

const MUSEUM_LABEL_MIZELL = 'Florida Civil Rights Museum: Dr. Von D. Mizell';
const MUSEUM_LABEL_JOHNSON = 'Florida Civil Rights Museum: Eula Mae Gandy Johnson';
const MUSEUM_SOURCE = 'floridacivilrightsmuseum.org';

type ProjectionClaim = {
  readonly id: string;
  readonly predicate: string;
  readonly object: string;
  readonly confidenceLevel: 'high' | 'medium' | 'low';
  readonly citationSource: string;
  readonly citationHref: string;
  readonly citationLabel: string;
  readonly independentLineageCount?: number;
};

/** Claims to append, keyed by entity. Ids continue each record's existing numbering. */
const ADDITIONS: Readonly<Record<string, readonly ProjectionClaim[]>> = {
  [MIZELL_ID]: [
    {
      id: 'claim_civil_rights_leaders_von_d_mizell_04',
      predicate: 'medical_career_milestone',
      object:
        "Educated at Morehouse College in Atlanta, Mizell returned to his hometown of Fort Lauderdale and became Broward County's second African American doctor.",
      confidenceLevel: 'high',
      citationSource: MUSEUM_SOURCE,
      citationHref: MUSEUM_MIZELL,
      citationLabel: MUSEUM_LABEL_MIZELL,
    },
  ],
  [JOHNSON_ID]: [
    {
      id: 'claim_civil_rights_leaders_eula_johnson_04',
      predicate: 'led_naacp_branch',
      object:
        'In 1959 Johnson became the first woman to serve as president of the Fort Lauderdale branch of the NAACP.',
      confidenceLevel: 'high',
      citationSource: MUSEUM_SOURCE,
      citationHref: MUSEUM_JOHNSON,
      citationLabel: MUSEUM_LABEL_JOHNSON,
      // The NSU exhibit (claim 01) carries the "first woman" half from an independent root.
      independentLineageCount: 2,
    },
  ],
  [PENN_ID]: [
    {
      id: 'claim_civil_rights_leaders_william_f_penn_02',
      predicate: 'medical_degree',
      object:
        'Earned his MD at Yale School of Medicine in 1897, having begun medical school at Leonard Medical College in Raleigh, North Carolina before moving to Yale in 1894.',
      confidenceLevel: 'high',
      citationSource: 'onlineexhibits.library.yale.edu',
      citationHref: YALE_PENN,
      citationLabel: 'Yale University Library: William Fletcher Penn',
    },
    {
      id: 'claim_civil_rights_leaders_william_f_penn_03',
      predicate: 'medical_career_milestone',
      object:
        "A prominent doctor and surgeon in Atlanta who also served as chief of surgery at the US Veterans' Hospital in Tuskegee, Alabama.",
      confidenceLevel: 'high',
      citationSource: 'onlineexhibits.library.yale.edu',
      citationHref: YALE_PENN,
      citationLabel: 'Yale University Library: William Fletcher Penn',
    },
    {
      id: 'claim_civil_rights_leaders_william_f_penn_04',
      predicate: 'founded_organization',
      object: 'A founding member of the Atlanta branch of the NAACP.',
      confidenceLevel: 'high',
      citationSource: 'onlineexhibits.library.yale.edu',
      citationHref: YALE_PENN,
      citationLabel: 'Yale University Library: William Fletcher Penn',
      // Corroborated by the Library of Congress print of the branch's 1917 officers (claim 05).
      independentLineageCount: 2,
    },
    {
      id: 'claim_civil_rights_leaders_william_f_penn_05',
      predicate: 'held_office',
      object:
        "Dr. William F. Penn appears among the officers and executive committee of the NAACP's Atlanta branch in a 1917 photograph from the association's own records, alongside John Hope, Harry H. Pace, Louis T. Wright and Walter F. White.",
      confidenceLevel: 'high',
      citationSource: 'loc.gov',
      citationHref: LOC_ATLANTA_BRANCH,
      citationLabel:
        'Library of Congress: Officers and executive committee of the Atlanta branch, 1917',
    },
  ],
};

/** In-place edits to claims that already exist. */
const CLAIM_EDITS: readonly {
  readonly entityId: string;
  readonly claimId: string;
  readonly object?: string;
  readonly confidenceLevel?: 'high' | 'medium' | 'low';
  readonly independentLineageCount?: number;
  readonly why: string;
}[] = [
  {
    entityId: MIZELL_ID,
    claimId: 'claim_civil_rights_leaders_von_d_mizell_02',
    confidenceLevel: 'high',
    independentLineageCount: 2,
    why: 'Florida Civil Rights Museum independently states the South Florida scope',
  },
  {
    entityId: SHIRLEY_ID,
    claimId: 'claim_civil_rights_leaders_calvin_shirley_04',
    object:
      'Was instrumental in getting the county health department building erected in a predominantly Black Fort Lauderdale community; that facility, the Northwest Health Center, originally housed the county’s first AIDS care and treatment center.',
    confidenceLevel: 'high',
    why: 'the source names the facility and describes the neighborhood only as predominantly Black',
  },
];

/** Summaries that assert something the sources do not support, restated to what they do. */
const SUMMARY_REWRITES: Readonly<Record<string, { readonly to: string; readonly why: string }>> = {
  [SHIRLEY_ID]: {
    to: 'One of four Black physicians who sued to integrate the all-white staff of Broward General Hospital (now Broward Health Medical Center). Practiced medicine in Fort Lauderdale from 1949, delivering some 6,000 babies, and was instrumental in getting the county health department to build the Northwest Health Center in a predominantly Black neighborhood.',
    why: 'no source places the health department branch in the Sistrunk neighborhood; the Westside Gazette names the building',
  },
  [PENN_ID]: {
    to: "Earned his MD at Yale School of Medicine in 1897 and became a prominent doctor and surgeon in Atlanta, later serving as chief of surgery at the US Veterans' Hospital in Tuskegee, Alabama. A founding member of Atlanta's NAACP branch, he appears among its officers and executive committee in a 1917 photograph held in the association's records at the Library of Congress. He also founded the Fair Haven Infirmary, a hospital serving Atlanta's Black community.",
    why: 'Yale identifies Cortlandt Van Rensselaer Creed (MD 1857) as its medical school’s first African American graduate, so Penn was not the first',
  },
};

function connectionString(): string {
  const value =
    process.env.DATABASE_URL?.trim() ??
    process.env.APP_DATABASE_URL?.trim() ??
    process.env.SUPABASE_DB_URL?.trim();
  if (!value) throw new Error('DATABASE_URL, APP_DATABASE_URL, or SUPABASE_DB_URL is required');
  return value;
}

/**
 * The projection carries claims twice — the `claims` column and `projection.claims` — and
 * `projection.claimIds` alongside. Rewriting a claim in place means replacing all three
 * consistently, so the whole array is rebuilt rather than patched at an index: an index-based
 * jsonb_set would silently write to the wrong claim if the two copies ever diverge in order.
 */
function applyEdits(
  claims: readonly ProjectionClaim[],
  entityId: string,
): { readonly next: readonly ProjectionClaim[]; readonly added: number } {
  const edited = claims.map((claim) => {
    const edit = CLAIM_EDITS.find((e) => e.entityId === entityId && e.claimId === claim.id);
    if (!edit) return claim;
    return {
      ...claim,
      ...(edit.object === undefined ? {} : { object: edit.object }),
      ...(edit.confidenceLevel === undefined ? {} : { confidenceLevel: edit.confidenceLevel }),
      ...(edit.independentLineageCount === undefined
        ? {}
        : { independentLineageCount: edit.independentLineageCount }),
    };
  });
  const existingIds = new Set(edited.map((claim) => claim.id));
  const additions = (ADDITIONS[entityId] ?? []).filter((claim) => !existingIds.has(claim.id));
  return { next: [...edited, ...additions], added: additions.length };
}

async function main(): Promise<void> {
  const { connectionString: cs, ssl } = normalizePgConnectionString(connectionString());
  const client = new pg.Client({ connectionString: cs, ssl });
  await client.connect();

  try {
    const releaseId = (
      await client.query<{ release_id: string }>(
        `SELECT release_id FROM published.active_release LIMIT 1`,
      )
    ).rows[0]?.release_id;
    if (!releaseId) throw new Error('no active release');

    const entityIds = [MIZELL_ID, SHIRLEY_ID, JOHNSON_ID, PENN_ID];
    const rows = (
      await client.query<{
        entity_id: string;
        summary: string;
        claims: ProjectionClaim[];
      }>(
        `SELECT entity_id, summary, COALESCE(claims, '[]'::jsonb) AS claims
         FROM published.release_entities
         WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
        [releaseId, entityIds],
      )
    ).rows;
    for (const id of entityIds) {
      if (!rows.some((row) => row.entity_id === id))
        throw new Error(`${id} not found in the active release`);
    }

    console.log('=== repo-wqtq: civil-rights-leaders uncorroborated summary details ===\n');

    const plan = rows.map((row) => {
      const { next, added } = applyEdits(row.claims, row.entity_id);
      const rewrite = SUMMARY_REWRITES[row.entity_id];
      const summary = rewrite?.to ?? row.summary;
      if (summary.length < 120)
        throw new Error(
          `${row.entity_id}: rewritten summary is under the 120-char projection floor`,
        );
      return { entityId: row.entity_id, before: row.summary, summary, claims: next, added };
    });

    for (const item of plan) {
      console.log(`--- ${item.entityId}`);
      const rewrite = SUMMARY_REWRITES[item.entityId];
      if (rewrite) {
        console.log(`  summary rewritten — ${rewrite.why}`);
        console.log(`    before: ${item.before}`);
        console.log(`    after:  ${item.summary}`);
      } else {
        console.log('  summary unchanged (the sources back what it already says)');
      }
      for (const edit of CLAIM_EDITS.filter((e) => e.entityId === item.entityId))
        console.log(`  edit ${edit.claimId} — ${edit.why}`);
      console.log(`  claims ${item.claims.length - item.added} -> ${item.claims.length}`);
      for (const claim of item.claims.slice(item.claims.length - item.added))
        console.log(`    + ${claim.id} [${claim.citationSource}] ${claim.object}`);
      console.log();
    }

    if (DRY_RUN || !APPLY) {
      console.log('Dry run. Set DRY_RUN=0 FIX_CRL_UNCORROBORATED_APPLY=1 to apply.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const item of plan) {
        const claimsJson = JSON.stringify(item.claims);
        const claimIdsJson = JSON.stringify(item.claims.map((claim) => claim.id));
        await client.query(
          `UPDATE published.release_entities
           SET projection = jsonb_set(
                 jsonb_set(
                   jsonb_set(projection, '{summary}', to_jsonb($3::text), true),
                   '{claims}', $4::jsonb, true
                 ),
                 '{claimIds}', $5::jsonb, true
               )
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, item.entityId, item.summary, claimsJson, claimIdsJson],
        );
        await client.query(
          `UPDATE canonical.entities
           SET kind_detail = jsonb_set(kind_detail, '{editorial,summary}', to_jsonb($2::text), true),
               updated_at = now()
           WHERE id = $1`,
          [item.entityId, item.summary],
        );
        await client.query(
          `UPDATE published.search_index
           SET claim_count = $3,
               facets = jsonb_set(facets, '{claimCount}', to_jsonb($3::int), true)
           WHERE release_id = $1 AND entity_id = $2`,
          [releaseId, item.entityId, item.claims.length],
        );
      }
      await client.query('COMMIT');
      console.log('Applied.');
      remindToRepublishCatalogArtifacts(plan.length);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

    const after = await client.query(
      `SELECT e.entity_id, jsonb_array_length(e.claims) AS claims, s.claim_count, e.summary
       FROM published.release_entities e
       JOIN published.search_index s
         ON s.release_id = e.release_id AND s.entity_id = e.entity_id
       WHERE e.release_id = $1 AND e.entity_id = ANY($2::text[])
       ORDER BY e.entity_id`,
      [releaseId, entityIds],
    );
    console.log('\nAfter:');
    for (const row of after.rows)
      console.log(`  ${row.entity_id}: ${row.claims} claims (index ${row.claim_count})`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
