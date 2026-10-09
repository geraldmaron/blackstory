/** Collection discovery over versioned policies. Recommendations are not evidence acceptance. */
import {
  assertContract,
  type SourceLibraryQuery,
  type SourceLibraryResult,
} from '@repo/research-kernel';
export type { SourceLibraryQuery, SourceLibraryResult } from '@repo/research-kernel';

export function sourceLibraryQueryFromParams(params: URLSearchParams): SourceLibraryQuery {
  const allowed = new Set([
    'question',
    'assertionClass',
    'subject',
    'geography',
    'period',
    'reviewStatus',
    'limit',
    'offset',
  ]);
  const value: Record<string, unknown> = {};
  for (const [key, raw] of params) {
    if (!allowed.has(key) || key in value)
      throw new Error(`Invalid source-library parameter: ${key}`);
    value[key] = ['limit', 'offset'].includes(key) ? Number(raw) : raw;
  }
  return assertContract('SourceLibraryQuery', value);
}

// Full-text terms are parameters; no request can add SQL or tsquery operators.
function searchTerms(value: string | undefined): string {
  return [...new Set(value?.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])]
    .filter(
      (term) =>
        term.length > 2 &&
        ![
          'research',
          'record',
          'records',
          'blackstory',
          'create',
          'update',
          'propose',
          'these',
          'those',
          'similar',
          'existing',
          'find',
          'verify',
        ].includes(term),
    )
    .slice(0, 40)
    .join(' | ');
}

export const SOURCE_LIBRARY_SQL = `
WITH latest AS (
  SELECT DISTINCT ON (id) * FROM evidence.source_policies
  WHERE collection_guidance IS NOT NULL AND sealed_at IS NOT NULL ORDER BY id, created_at DESC, version DESC
), matched AS (
  SELECT p.*, o.name AS publisher,
    ($1<>'' AND to_tsvector('english',p.display_name||' '||coalesce((p.collection_guidance->'subjects')::text,'')||' '||coalesce((p.collection_guidance->'geography')::text,'')||' '||coalesce((p.collection_guidance->'documentTypes')::text,'')) @@ to_tsquery('english',$1)) AS question_match,
    ($2<>'' AND p.collection_guidance->'suitableEvidenceNeeds' ? $2) AS assertion_match
  FROM latest p LEFT JOIN evidence.source_organizations o ON o.id=p.organization_id
  WHERE ($1='' OR to_tsvector('english',p.display_name||' '||coalesce((p.collection_guidance->'subjects')::text,'')||' '||coalesce((p.collection_guidance->'geography')::text,'')||' '||coalesce((p.collection_guidance->'documentTypes')::text,'')) @@ to_tsquery('english',$1))
    AND ($2='' OR p.collection_guidance->'suitableEvidenceNeeds' ? $2)
    AND ($3='' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.collection_guidance->'subjects') x WHERE x ILIKE '%'||$3||'%'))
    AND ($4='' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.collection_guidance->'geography') x WHERE x ILIKE '%'||$4||'%' OR x IN ('United States','Global')))
    AND ($5='' OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p.collection_guidance->'periods') x WHERE x ILIKE '%'||$5||'%' OR x='All periods'))
    AND ($6='' OR p.collection_guidance->>'reviewStatus'=$6)
), page AS (
  SELECT * FROM matched ORDER BY assertion_match DESC, question_match DESC,
    (collection_guidance->>'reviewStatus'='reviewed') DESC, display_name, id
  LIMIT $7 OFFSET $8
)
SELECT (SELECT count(*)::int FROM matched) AS total,
  COALESCE(jsonb_agg(jsonb_build_object(
    'policyId',p.id,'policyVersion',p.version,'collection',p.display_name,
    'organizationId',p.organization_id,'publisher',p.publisher,'guidance',p.collection_guidance,
    'matchReasons',to_jsonb(array_remove(ARRAY[
      CASE WHEN p.question_match THEN 'Question terms match collection identity or coverage' END,
      CASE WHEN p.assertion_match THEN 'Collection is suited to the requested evidence need' END,
      CASE WHEN $3<>'' THEN 'Subject coverage matches' END,
      CASE WHEN $4<>'' THEN 'Geographic coverage matches or is broad' END,
      CASE WHEN $5<>'' THEN 'Period coverage matches or is broad' END
    ],NULL)),
    'claimFitness',COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'sourceClass',p.source_class,'claimClass',f.claim_class,
      'fitness',CASE WHEN f.fitness='lead_only' THEN 'leadOnly' ELSE f.fitness END,
      'limitations',f.limitations) ORDER BY f.claim_class)
      FROM evidence.source_policy_claim_fitness f WHERE f.source_policy_id=p.id AND f.source_policy_version=p.version
        AND ($2='' OR f.claim_class=$2)),'[]'::jsonb)
  ) ORDER BY p.assertion_match DESC,p.question_match DESC,(p.collection_guidance->>'reviewStatus'='reviewed') DESC,p.display_name,p.id)
    FILTER (WHERE p.id IS NOT NULL),'[]'::jsonb) AS items FROM page p`;

export async function querySourceLibrary(
  db: { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> },
  candidate: unknown,
): Promise<SourceLibraryResult> {
  const query = assertContract('SourceLibraryQuery', candidate);
  const limit = query.limit ?? 20,
    offset = query.offset ?? 0;
  const result = await db.query(SOURCE_LIBRARY_SQL, [
    searchTerms(query.question),
    query.assertionClass ?? '',
    query.subject ?? '',
    query.geography ?? '',
    query.period ?? '',
    query.reviewStatus ?? '',
    limit,
    offset,
  ]);
  const row = result.rows[0];
  if (!row) throw new Error('Source library did not return accounting');
  const total = Number(row.total);
  return assertContract('SourceLibraryResult', {
    schemaVersion: '1.0.0',
    query,
    items: row.items,
    total,
    nextOffset: offset + limit < total ? offset + limit : null,
    limitations: [
      'Recommendations guide discovery; inspect the underlying document for each assertion.',
      'Coverage is incomplete. Search outside the library and record access failures and unresolved needs.',
      'Citation usage and legacy numerical priors confer no evidence or publication authority.',
    ],
  });
}
