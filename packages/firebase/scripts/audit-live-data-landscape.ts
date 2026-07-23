/**
 * Read-only structural and content-coverage audit for the hosted Postgres ledger.
 *
 * The audit deliberately emits aggregate metadata only: no auth records, submission
 * payloads, source-capture bodies, or secrets. Exact row counts are collected for
 * BlackStory-owned schemas; platform schemas retain catalog estimates.
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/audit-live-data-landscape.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpsPostgresPool } from '../../data-access/src/postgres/pool.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const reportDir = join(repoRoot, '.cache/research-data-audit');

const COVERAGE_PROBES = [
  { id: 'plantations', pattern: '\\m(plantation|slaveholding estate|rice estate|sugar estate)\\M' },
  { id: 'enslavement', pattern: '\\m(enslaved|enslavement|slavery|slave trade)\\M' },
  {
    id: 'free-black-communities',
    pattern: '\\m(free Black|freedmen|freedpeople|contraband camp)\\M',
  },
  { id: 'reconstruction', pattern: '\\m(Reconstruction|Freedmen.s Bureau)\\M' },
  {
    id: 'black-towns-settlements',
    pattern: '\\m(Black town|freedmen.s town|all-Black town|settlement)\\M',
  },
  { id: 'churches-religion', pattern: '\\m(church|mosque|synagogue|congregation|religious)\\M' },
  { id: 'cemeteries-burial', pattern: '\\m(cemetery|burial ground|graveyard)\\M' },
  { id: 'schools-education', pattern: '\\m(school|college|university|academy|education)\\M' },
  { id: 'rosenwald-schools', pattern: '\\m(Rosenwald)\\M' },
  { id: 'newspapers-publishing', pattern: '\\m(newspaper|press|publisher|publication)\\M' },
  {
    id: 'business-commerce',
    pattern: '\\m(business|entrepreneur|bank|insurance|hotel|restaurant)\\M',
  },
  {
    id: 'mutual-aid-fraternal',
    pattern: '\\m(mutual aid|fraternal|benevolent|lodge|sorority|fraternity)\\M',
  },
  { id: 'labor-workers', pattern: '\\m(labor|worker|union|strike|sharecropper|tenant farmer)\\M' },
  { id: 'military-service', pattern: '\\m(military|regiment|battalion|airmen|soldier|veteran)\\M' },
  { id: 'medicine-health', pattern: '\\m(medicine|medical|physician|nurse|hospital|health)\\M' },
  {
    id: 'science-technology',
    pattern: '\\m(science|scientist|engineer|inventor|technology|mathematician)\\M',
  },
  {
    id: 'arts-performance',
    pattern: '\\m(art|artist|music|musician|theater|theatre|dance|literature)\\M',
  },
  { id: 'sports', pattern: '\\m(sport|baseball|football|basketball|athlete|Negro league)\\M' },
  { id: 'civil-rights', pattern: '\\m(civil rights|voting rights|desegregation|integration)\\M' },
  {
    id: 'resistance-rebellion',
    pattern: '\\m(resistance|rebellion|revolt|uprising|insurrection)\\M',
  },
  {
    id: 'underground-railroad',
    pattern: '\\m(Underground Railroad|freedom seeker|fugitive slave)\\M',
  },
  {
    id: 'migration-diaspora',
    pattern: '\\m(migration|diaspora|Great Migration|exodus|emigration)\\M',
  },
  { id: 'law-courts', pattern: '\\m(law|court|legal|lawsuit|Supreme Court|constitution)\\M' },
  {
    id: 'politics-officeholders',
    pattern: '\\m(mayor|legislator|senator|representative|officeholder|politician)\\M',
  },
  { id: 'violence-memorialization', pattern: '\\m(lynching|massacre|racial terror|memorial)\\M' },
  {
    id: 'museums-archives',
    pattern: '\\m(museum|archive|library|historic site|heritage center)\\M',
  },
  {
    id: 'housing-neighborhoods',
    pattern: '\\m(housing|neighborhood|district|redlining|urban renewal)\\M',
  },
  {
    id: 'agriculture-foodways',
    pattern: '\\m(agriculture|farm|foodways|rice|cotton|sugar|tobacco)\\M',
  },
  { id: 'maritime-waterways', pattern: '\\m(maritime|seaport|ship|river|canal|dock|steamboat)\\M' },
  {
    id: 'international-caribbean',
    pattern: '\\m(Caribbean|Haiti|Jamaica|Bahamas|Cuba|Pan-African)\\M',
  },
] as const;

type RelationRow = {
  readonly schema_name: string;
  readonly relation_name: string;
  readonly relation_type: string;
  readonly estimated_rows: number;
  readonly total_bytes: number;
  readonly rls_enabled: boolean;
  readonly rls_forced: boolean;
  exact_rows?: number;
};

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function isProductRelation(row: RelationRow): boolean {
  return (
    row.schema_name.startsWith('bb_') ||
    (row.schema_name === 'public' && row.relation_name.startsWith('published_'))
  );
}

function rowsByKey(rows: readonly Record<string, unknown>[], key: string): string[] {
  return rows.map((row) => `${String(row[key] ?? 'unknown')}: ${String(row.n ?? 0)}`);
}

function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly (string | number | boolean | null)[])[],
): string {
  const head = `| ${headers.join(' | ')} |`;
  const rule = `|${headers.map(() => '---').join('|')}|`;
  const body = rows.map((row) => `| ${row.map((value) => String(value ?? '')).join(' | ')} |`);
  return [head, rule, ...body].join('\n');
}

async function main(): Promise<void> {
  const pool = getOpsPostgresPool({ ...process.env, DATABASE_SSL: 'true' });
  const client = await pool.connect();

  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const serverResult = await client.query<{
      database_name: string;
      database_role: string;
      postgres_version: string;
      database_size_bytes: number;
    }>(`
      SELECT
        current_database() AS database_name,
        current_user AS database_role,
        current_setting('server_version') AS postgres_version,
        pg_database_size(current_database())::bigint AS database_size_bytes
    `);

    const schemasResult = await client.query<{
      schema_name: string;
      owner: string;
    }>(`
      SELECT n.nspname AS schema_name, pg_get_userbyid(n.nspowner) AS owner
      FROM pg_namespace n
      WHERE n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
      ORDER BY n.nspname
    `);

    const relationsResult = await client.query<RelationRow>(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS relation_name,
        CASE c.relkind
          WHEN 'r' THEN 'table'
          WHEN 'p' THEN 'partitioned_table'
          WHEN 'v' THEN 'view'
          WHEN 'm' THEN 'materialized_view'
          WHEN 'S' THEN 'sequence'
          WHEN 'f' THEN 'foreign_table'
          ELSE c.relkind::text
        END AS relation_type,
        GREATEST(c.reltuples, 0)::bigint AS estimated_rows,
        CASE
          WHEN c.relkind IN ('r', 'p', 'm') THEN pg_total_relation_size(c.oid)::bigint
          ELSE 0::bigint
        END AS total_bytes,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname <> 'information_schema'
        AND n.nspname NOT LIKE 'pg\\_%' ESCAPE '\\'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
      ORDER BY n.nspname, c.relname
    `);

    const relations = relationsResult.rows;
    for (const relation of relations.filter(isProductRelation)) {
      if (
        !['table', 'partitioned_table', 'view', 'materialized_view'].includes(
          relation.relation_type,
        )
      ) {
        continue;
      }
      const qualifiedName = `${quoteIdentifier(relation.schema_name)}.${quoteIdentifier(
        relation.relation_name,
      )}`;
      const countResult = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM ${qualifiedName}`,
      );
      relation.exact_rows = countResult.rows[0]?.n ?? 0;
    }

    const columnsResult = await client.query(`
      SELECT
        table_schema AS schema_name,
        table_name,
        ordinal_position,
        column_name,
        data_type,
        udt_schema,
        udt_name,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema <> 'information_schema'
        AND table_schema NOT LIKE 'pg\\_%' ESCAPE '\\'
      ORDER BY table_schema, table_name, ordinal_position
    `);

    const constraintsResult = await client.query(`
      SELECT
        n.nspname AS schema_name,
        c.relname AS table_name,
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname LIKE 'bb\\_%' ESCAPE '\\' OR n.nspname = 'public'
      ORDER BY n.nspname, c.relname, con.conname
    `);

    const indexesResult = await client.query(`
      SELECT schemaname AS schema_name, tablename AS table_name, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname LIKE 'bb\\_%' ESCAPE '\\' OR schemaname = 'public'
      ORDER BY schemaname, tablename, indexname
    `);

    const policiesResult = await client.query(`
      SELECT
        schemaname AS schema_name,
        tablename AS table_name,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname LIKE 'bb\\_%' ESCAPE '\\' OR schemaname = 'public'
      ORDER BY schemaname, tablename, policyname
    `);

    const grantsResult = await client.query(`
      SELECT table_schema AS schema_name, table_name, grantee, privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema LIKE 'bb\\_%' ESCAPE '\\' OR table_schema = 'public'
      ORDER BY table_schema, table_name, grantee, privilege_type
    `);

    const functionsResult = await client.query(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        pg_get_function_identity_arguments(p.oid) AS arguments,
        p.prosecdef AS security_definer,
        p.provolatile AS volatility
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname LIKE 'bb\\_%' ESCAPE '\\' OR n.nspname = 'public'
      ORDER BY n.nspname, p.proname, arguments
    `);

    const extensionsResult = await client.query(`
      SELECT extname AS name, extversion AS version
      FROM pg_extension
      ORDER BY extname
    `);

    const activeReleaseResult = await client.query(`
      SELECT ar.*, r.status, r.created_at, r.activated_at, r.updated_at
      FROM bb_public.active_release ar
      JOIN bb_publication.releases r ON r.id = ar.release_id
      WHERE ar.id = 'active'
    `);

    const releaseStatusesResult = await client.query(`
      SELECT status, COUNT(*)::int AS n
      FROM bb_publication.releases
      GROUP BY status
      ORDER BY n DESC, status
    `);

    const publicKindsResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT re.kind, COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE re.lat IS NOT NULL AND re.lng IS NOT NULL)::int AS map_ready
      FROM bb_public.release_entities re, active a
      WHERE re.release_id = a.release_id
      GROUP BY re.kind
      ORDER BY n DESC, re.kind
    `);

    const canonicalKindsResult = await client.query(`
      SELECT kind, entity_class, COUNT(*)::int AS n
      FROM bb_canonical.entities
      GROUP BY kind, entity_class
      ORDER BY n DESC, kind, entity_class
    `);

    const catalogHealthResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT
        COUNT(*)::int AS public_entities,
        COUNT(*) FILTER (WHERE re.lat IS NOT NULL AND re.lng IS NOT NULL)::int AS map_ready,
        COUNT(*) FILTER (WHERE re.location IS NOT NULL)::int AS with_location_payload,
        COUNT(*) FILTER (
          WHERE jsonb_typeof(re.claims) = 'array' AND jsonb_array_length(re.claims) > 0
        )::int AS with_claims,
        COUNT(*) FILTER (WHERE jsonb_typeof(re.claims) <> 'array')::int AS malformed_claim_shapes,
        COALESCE(SUM(
          CASE WHEN jsonb_typeof(re.claims) = 'array' THEN jsonb_array_length(re.claims) ELSE 0 END
        ), 0)::int AS projected_claims,
        COUNT(*) FILTER (WHERE re.primary_image IS NOT NULL)::int AS with_primary_image,
        COUNT(*) FILTER (WHERE jsonb_typeof(re.taxonomy) = 'object' AND re.taxonomy <> '{}'::jsonb)::int
          AS with_taxonomy
      FROM bb_public.release_entities re, active a
      WHERE re.release_id = a.release_id
    `);

    const canonicalHealthResult = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM bb_canonical.entities) AS entities,
        (SELECT COUNT(*)::int FROM bb_canonical.entity_locations) AS locations,
        (SELECT COUNT(*)::int FROM bb_canonical.claims) AS claims,
        (SELECT COUNT(*)::int FROM bb_canonical.claim_versions) AS claim_versions,
        (SELECT COUNT(*)::int FROM bb_canonical.claim_evidence_links) AS claim_evidence_links,
        (SELECT COUNT(*)::int FROM bb_canonical.entity_relationships) AS relationships,
        (SELECT COUNT(*)::int FROM bb_canonical.entity_aliases) AS normalized_aliases,
        (SELECT COUNT(*)::int FROM bb_canonical.entity_identifiers) AS normalized_identifiers,
        (SELECT COUNT(*)::int FROM bb_canonical.entity_embeddings) AS embeddings
    `);

    const taxonomyKeysResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT key, COUNT(*)::int AS n
      FROM bb_public.release_entities re, active a
      CROSS JOIN LATERAL jsonb_object_keys(
        CASE WHEN jsonb_typeof(re.taxonomy) = 'object' THEN re.taxonomy ELSE '{}'::jsonb END
      ) AS key
      WHERE re.release_id = a.release_id
      GROUP BY key
      ORDER BY n DESC, key
    `);

    const projectionKeysResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT key, COUNT(*)::int AS n
      FROM bb_public.release_entities re, active a
      CROSS JOIN LATERAL jsonb_object_keys(
        CASE WHEN jsonb_typeof(re.projection) = 'object' THEN re.projection ELSE '{}'::jsonb END
      ) AS key
      WHERE re.release_id = a.release_id
      GROUP BY key
      ORDER BY n DESC, key
    `);

    const claimKeysResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT key, COUNT(*)::int AS n
      FROM bb_public.release_entities re, active a
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(re.claims) = 'array' THEN re.claims ELSE '[]'::jsonb END
      ) AS claim
      CROSS JOIN LATERAL jsonb_object_keys(
        CASE WHEN jsonb_typeof(claim) = 'object' THEN claim ELSE '{}'::jsonb END
      ) AS key
      WHERE re.release_id = a.release_id
      GROUP BY key
      ORDER BY n DESC, key
    `);

    const plantationResult = await client.query(`
      WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
      SELECT
        re.entity_id,
        re.display_name,
        re.kind,
        re.lat,
        re.lng,
        re.display_name ~* '\\m(plantation|estate)\\M' AS named_site,
        re.taxonomy::text ~* '\\mplantation\\M' AS taxonomy_match,
        re.summary ~* '\\mplantation\\M' AS summary_match,
        COALESCE(re.projection ->> 'locationLabel', re.location ->> 'label') AS location_label
      FROM bb_public.release_entities re, active a
      WHERE re.release_id = a.release_id
        AND concat_ws(
          ' ',
          re.display_name,
          re.summary,
          re.projection ->> 'historicalContext',
          re.taxonomy::text,
          (re.projection -> 'keywords')::text,
          (re.projection -> 'topicTags')::text,
          (re.projection -> 'topicIds')::text
        )
          ~* '\\m(plantation|slaveholding estate|rice estate|sugar estate)\\M'
      ORDER BY named_site DESC, re.display_name
    `);

    const coverage: Record<string, unknown>[] = [];
    for (const probe of COVERAGE_PROBES) {
      const probeResult = await client.query<{
        n: number;
        map_ready: number;
        named_match: number;
      }>(
        `
          WITH active AS (SELECT release_id FROM bb_public.active_release WHERE id = 'active')
          SELECT
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE re.lat IS NOT NULL AND re.lng IS NOT NULL)::int AS map_ready,
            COUNT(*) FILTER (WHERE re.display_name ~* $1)::int AS named_match
          FROM bb_public.release_entities re, active a
          WHERE re.release_id = a.release_id
            AND concat_ws(
              ' ',
              re.display_name,
              re.summary,
              re.projection ->> 'historicalContext',
              re.taxonomy::text,
              (re.projection -> 'keywords')::text,
              (re.projection -> 'topicTags')::text,
              (re.projection -> 'topicIds')::text
            ) ~* $1
        `,
        [probe.pattern],
      );
      coverage.push({ id: probe.id, ...probeResult.rows[0] });
    }

    const researchCasesResult = await client.query(`
      SELECT state, COUNT(*)::int AS n
      FROM bb_research.cases
      GROUP BY state
      ORDER BY n DESC, state
    `);

    const researchRunsResult = await client.query(`
      SELECT mode, status, COUNT(*)::int AS n,
        COALESCE(SUM(cost_usd), 0)::numeric AS cost_usd,
        COALESCE(SUM(query_count), 0)::bigint AS query_count,
        COALESCE(SUM(candidate_url_count), 0)::bigint AS candidate_url_count,
        COALESCE(SUM(capture_count), 0)::bigint AS capture_count
      FROM bb_research.runs
      GROUP BY mode, status
      ORDER BY n DESC, mode, status
    `);

    const frontierResult = await client.query(`
      SELECT status, COUNT(*)::int AS n
      FROM bb_research.frontier_tasks
      GROUP BY status
      ORDER BY n DESC, status
    `);

    const landscapeResult = await client.query(`
      SELECT lane, status, COUNT(*)::int AS n,
        COUNT(*) FILTER (WHERE lat IS NOT NULL AND lng IS NOT NULL)::int AS map_ready
      FROM bb_research.landscape_candidates
      GROUP BY lane, status
      ORDER BY n DESC, lane, status
    `);

    const sourceProgramsResult = await client.query(`
      SELECT lane, COUNT(*)::int AS runs,
        COALESCE(SUM(rows_fetched), 0)::bigint AS rows_fetched,
        COALESCE(SUM(candidate_count), 0)::bigint AS candidates,
        COALESCE(SUM(dropped_count), 0)::bigint AS dropped
      FROM bb_research.source_program_runs
      GROUP BY lane
      ORDER BY candidates DESC, lane
    `);

    const statisticalSeriesResult = await client.query(`
      SELECT
        COALESCE(theme, 'unclassified') AS theme,
        geography_type,
        COUNT(*)::int AS series,
        COUNT(DISTINCT source_dataset)::int AS source_datasets
      FROM bb_reference.statistical_series
      GROUP BY theme, geography_type
      ORDER BY series DESC, theme, geography_type
    `);

    const statisticalSourcesResult = await client.query(`
      SELECT source_dataset, COUNT(*)::int AS series,
        (SELECT COUNT(*)::int
         FROM bb_reference.statistical_observations o
         WHERE o.metric_id IN (
           SELECT s2.metric_id FROM bb_reference.statistical_series s2
           WHERE s2.source_dataset = s.source_dataset
         )) AS observations
      FROM bb_reference.statistical_series s
      GROUP BY source_dataset
      ORDER BY observations DESC, source_dataset
    `);

    const report = {
      generatedAt: new Date().toISOString(),
      scope: {
        aggregateOnly: true,
        productSchemas: 'bb_* plus public.published_*',
        platformSchemas: 'structure and estimates only; no auth/submission/source bodies',
        coverageProbeCaveat:
          'Regex probes are discovery signals over public text/JSON, not authoritative taxonomy labels.',
      },
      server: serverResult.rows[0],
      schemas: schemasResult.rows,
      structure: {
        relations,
        columns: columnsResult.rows,
        constraints: constraintsResult.rows,
        indexes: indexesResult.rows,
        policies: policiesResult.rows,
        grants: grantsResult.rows,
        functions: functionsResult.rows,
        extensions: extensionsResult.rows,
      },
      catalog: {
        activeRelease: activeReleaseResult.rows,
        releaseStatuses: releaseStatusesResult.rows,
        publicKinds: publicKindsResult.rows,
        canonicalKinds: canonicalKindsResult.rows,
        publicHealth: catalogHealthResult.rows[0],
        canonicalHealth: canonicalHealthResult.rows[0],
        taxonomyKeys: taxonomyKeysResult.rows,
        projectionKeys: projectionKeysResult.rows,
        claimKeys: claimKeysResult.rows,
      },
      historicalCoverage: {
        probes: coverage,
        plantationMatches: plantationResult.rows,
      },
      researchOperations: {
        cases: researchCasesResult.rows,
        runs: researchRunsResult.rows,
        frontier: frontierResult.rows,
        landscapeCandidates: landscapeResult.rows,
        sourcePrograms: sourceProgramsResult.rows,
      },
      statisticalContext: {
        seriesByThemeAndGeography: statisticalSeriesResult.rows,
        sources: statisticalSourcesResult.rows,
      },
    };

    await client.query('ROLLBACK');

    mkdirSync(reportDir, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    const jsonPath = join(reportDir, `live-data-landscape-${stamp}.json`);
    const markdownPath = join(reportDir, `live-data-landscape-${stamp}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

    const productRelations = relations.filter(isProductRelation);
    const markdown = `# Live data landscape audit

Generated: ${report.generatedAt}

This is an aggregate-only, read-only audit. Coverage probes are research-discovery signals, not
authoritative classifications.

## Database

${markdownTable(
  ['Metric', 'Value'],
  [
    ['Postgres', serverResult.rows[0]?.postgres_version ?? 'unknown'],
    ['Database bytes', serverResult.rows[0]?.database_size_bytes ?? 0],
    ['Schemas', schemasResult.rows.length],
    ['BlackStory relations', productRelations.length],
    ['RLS policies', policiesResult.rows.length],
    ['Indexes', indexesResult.rows.length],
  ],
)}

## Active public catalog

${markdownTable(
  ['Kind', 'Rows', 'Map-ready'],
  publicKindsResult.rows.map((row) => [String(row.kind), Number(row.n), Number(row.map_ready)]),
)}

## Canonical health

${markdownTable(
  ['Metric', 'Value'],
  Object.entries(canonicalHealthResult.rows[0] ?? {}).map(([key, value]) => [key, Number(value)]),
)}

## Research operations

Cases: ${rowsByKey(researchCasesResult.rows, 'state').join('; ') || 'none'}

Frontier: ${rowsByKey(frontierResult.rows, 'status').join('; ') || 'none'}

## Historical coverage probes

${markdownTable(
  ['Probe', 'Public rows', 'Map-ready', 'Named matches'],
  coverage.map((row) => [
    String(row.id),
    Number(row.n),
    Number(row.map_ready),
    Number(row.named_match),
  ]),
)}

## Plantation signal

${markdownTable(
  ['Entity', 'Kind', 'Map-ready', 'Named site', 'Taxonomy match'],
  plantationResult.rows.map((row) => [
    String(row.display_name),
    String(row.kind),
    row.lat !== null && row.lng !== null,
    Boolean(row.named_site),
    Boolean(row.taxonomy_match),
  ]),
)}

Full machine-readable structure: \`${jsonPath}\`
`;
    writeFileSync(markdownPath, markdown);

    console.log(`JSON report: ${jsonPath}`);
    console.log(`Markdown report: ${markdownPath}`);
    console.log(
      `Product relations: ${productRelations.length}; public entities: ${
        catalogHealthResult.rows[0]?.public_entities ?? 0
      }; plantation matches: ${plantationResult.rows.length}`,
    );
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original audit error.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
