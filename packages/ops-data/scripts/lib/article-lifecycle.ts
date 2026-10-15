/** Shared article persistence and evidence gates for the CLI and authenticated editor. */
import { assertReviewedPublicationAnchors } from './reviewed-anchors.js';
import { safeFetchIsReachable } from './safe-fetch.js';
import { createHash } from 'node:crypto';
import { assertArticleCitationIntegrity, publicArticleProjectionSchema } from '@repo/schemas';
import {
  checkDoiCitation,
  lookupSourceTier,
  type SourceTier,
  type SafeHttpClient,
} from '@repo/domain';
import { SELF_REFERENCE_PATTERNS, findProseVoiceIssues } from '@repo/domain/editorial';
import { z } from 'zod';
import type pg from 'pg';
export const articleAuthoringSchema = publicArticleProjectionSchema
  .omit({ releaseId: true })
  .extend({ status: z.enum(['draft', 'review', 'published']) });
export type ArticleAuthoring = z.infer<typeof articleAuthoringSchema>;

const REFERENCED_PACKET_BLOCKS = new Set(['figure', 'stat', 'primaryDocument', 'timeline']);

function gateArticleSourceTiers(article: ArticleAuthoring): {
  tally: Record<SourceTier, number>;
  warnings: string[];
} {
  const tally: Record<SourceTier, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  const warnings: string[] = [];
  for (const reference of article.references) {
    let tier: SourceTier = 'T4';
    try {
      tier = lookupSourceTier(reference.url).tier;
    } catch {
      tier = 'T4';
    }
    tally[tier] += 1;
    if (tier === 'T4') {
      const message = `${article.id} / reference ${reference.id}: unclassified discovery host ${JSON.stringify(reference.url)}`;
      warnings.push(message);
    }
  }
  return { tally, warnings };
}

const ANCHORABLE_BLOCKS = new Set(['stat', 'figure', 'pullquote']);

/** Offline validation cannot establish reviewed support. Publication checks every assertion block. */
function gateLoadBearingAnchors(article: ArticleAuthoring): { warnings: string[] } {
  return {
    warnings: article.body.flatMap((block, index) =>
      ANCHORABLE_BLOCKS.has(block.type)
        ? [
            `${article.id} / body[${index}]: publication requires database-reviewed exact assertions and assessed independent work lineages`,
          ]
        : [],
    ),
  };
}

/** Word count is diagnostic; evidence and editorial review determine sufficiency. */
function visibleProse(text: string): string {
  return text
    .replace(/\[ref:[a-z0-9-]+\]/g, ' ')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

export function countProseWords(article: ArticleAuthoring): number {
  let words = 0;
  for (const block of article.body) {
    if (block.type !== 'paragraph') continue;
    const visible = visibleProse((block as { text?: string }).text ?? '');
    words += visible.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

/**
 * Call-out gate. A `list` item is the most quotable, most screenshot-able unit an article
 * publishes: a single flat assertion that a named president did a specific thing on a
 * specific date. Every one of them carries its own citation, so a bullet lifted out of
 * the page still arrives with its receipt attached. Enforced for every kind, because a
 * bullet in a chapter is no less liftable than a bullet in a record entry.
 */
function gateCalloutCitations(article: ArticleAuthoring): { warnings: string[] } {
  const findings: string[] = [];
  article.body.forEach((block, index) => {
    if (block.type !== 'list') return;
    block.items.forEach((item, itemIndex) => {
      if (/\[ref:[a-z0-9-]+\]/.test(item)) return;
      const excerpt = visibleProse(item).slice(0, 80).replace(/\s+/g, ' ');
      findings.push(
        `${article.id} / body[${index}].items[${itemIndex}]: call-out carries no [ref:id] citation — "${excerpt}…"`,
      );
    });
  });
  if (findings.length === 0) return { warnings: [] };
  if (article.status === 'published') {
    throw new Error(
      `call-out citation gate failed (published articles):\n  ${findings.join('\n  ')}`,
    );
  }
  return { warnings: findings };
}

/**
 * Series integrity. Within one series id, `position` is the ordering key the index sorts
 * on and must be unique — two entries claiming the same slot sort nondeterministically,
 * which reads as a bug in the collection rather than in the data. Checked across the
 * whole fixture set being validated together, and against the database on apply.
 */
export function gateSeriesPositions(articles: readonly ArticleAuthoring[]): void {
  const seen = new Map<string, string>();
  const collisions: string[] = [];
  for (const article of articles) {
    if (!article.series) continue;
    const key = `${article.series.id}#${article.series.position}`;
    const prior = seen.get(key);
    if (prior && prior !== article.id) {
      collisions.push(
        `series "${article.series.id}" position ${article.series.position} claimed by both ${prior} and ${article.id}`,
      );
    }
    seen.set(key, article.id);
  }
  if (collisions.length > 0) {
    throw new Error(`series position gate failed:\n  ${collisions.join('\n  ')}`);
  }
}

/**
 * Requires standalone historical prose without publisher self-reference or navigation
 * instructions. Use entity links and relatedEntityIds for related history. Published violations
 * fail; drafts receive warnings. See docs/content/neo-voice.md.
 */
function gateStandaloneProse(article: ArticleAuthoring): { warnings: string[] } {
  const findings: string[] = [];
  article.body.forEach((block, index) => {
    const texts =
      block.type === 'paragraph' || block.type === 'pullquote'
        ? [(block as { text?: string }).text ?? '']
        : block.type === 'list'
          ? block.items
          : [];
    for (const text of texts) {
      let flagged = false;
      for (const { label, pattern } of SELF_REFERENCE_PATTERNS) {
        const match = pattern.exec(text);
        if (!match) continue;
        const start = Math.max(0, match.index - 40);
        const excerpt = text.slice(start, match.index + match[0].length + 40).replace(/\s+/g, ' ');
        findings.push(
          `${article.id} / body[${index}] (${block.type}): prose ${label} — …${excerpt}… ` +
            `(link related history with [[entityId|Label]] instead)`,
        );
        flagged = true;
        break;
      }
      if (flagged) break;
    }
  });
  if (findings.length === 0) return { warnings: [] };
  if (article.status === 'published') {
    throw new Error(
      `standalone-prose gate failed (published articles):\n  ${findings.join('\n  ')}`,
    );
  }
  return { warnings: findings };
}

/**
 * Word-level voice (docs/content/neo-voice.md never-list item 9): em dashes and expanded
 * contractions in narration. Warnings only, at every status: published chapters predate this
 * check, and a gate that turned hard overnight would block unrelated republishes. Quoted
 * testimony is exempt inside findProseVoiceIssues.
 */
function gateProseVoice(article: ArticleAuthoring): { warnings: string[] } {
  const warnings: string[] = [];
  article.body.forEach((block, index) => {
    const texts =
      block.type === 'paragraph'
        ? [(block as { text?: string }).text ?? '']
        : block.type === 'list'
          ? block.items
          : [];
    for (const text of texts) {
      for (const finding of findProseVoiceIssues(text)) {
        if (finding.rule !== 'em-dash' && finding.rule !== 'expanded-contraction') continue;
        warnings.push(
          `${article.id} / body[${index}] (${block.type}): prose ${finding.label}: …${finding.excerpt}…`,
        );
      }
    }
  });
  return { warnings };
}

/**
 * Offline gates: schema (via loader) + inline-citation integrity + source-tier gate +
 * standalone-prose gate + word-level voice warnings.
 */
export function validateArticleOffline(article: ArticleAuthoring): void {
  assertArticleCitationIntegrity(article);
  const { warnings: tierWarnings } = gateArticleSourceTiers(article);
  for (const warning of tierWarnings) console.warn(`warning: ${warning}`);
  const { warnings: anchorWarnings } = gateLoadBearingAnchors(article);
  for (const warning of anchorWarnings) console.warn(`warning: ${warning}`);
  const { warnings: standaloneWarnings } = gateStandaloneProse(article);
  for (const warning of standaloneWarnings) console.warn(`warning: ${warning}`);
  const { warnings: voiceWarnings } = gateProseVoice(article);
  for (const warning of voiceWarnings) console.warn(`warning: ${warning}`);
  const { warnings: calloutWarnings } = gateCalloutCitations(article);
  for (const warning of calloutWarnings) console.warn(`warning: ${warning}`);
}

type PacketRow = {
  readonly id: string;
  readonly observations: readonly { readonly observationId: string }[];
  readonly derived: readonly { readonly derivedId: string }[];
  readonly artifacts: readonly { readonly artifactId: string; readonly dated?: string }[];
};
type PacketRefRows = {
  readonly observationIds: ReadonlySet<string>;
  readonly derivedIds: ReadonlySet<string>;
  readonly artifactIds: ReadonlySet<string>;
  readonly hasDatedArtifact: boolean;
};

/**
 * Publish gate: every figure/stat/primaryDocument/timeline block must resolve
 * against a *published* theme-impact packet's rows, and every map-inset entity
 * must exist in the release entity set.
 */
export async function verifyArticleReferences(
  client: pg.PoolClient,
  article: ArticleAuthoring,
): Promise<void> {
  for (const block of article.body) {
    if (ANCHORABLE_BLOCKS.has(block.type))
      await assertReviewedPublicationAnchors(
        client,
        block,
        'anchors' in block ? block.anchors : undefined,
        block.type !== 'pullquote',
      );
  }
  const packetIds = new Set<string>();
  const entityIds = new Set<string>(article.relatedEntityIds);
  for (const block of article.body) {
    if (block.type === 'mapInset') entityIds.add(block.entityId);
    if (REFERENCED_PACKET_BLOCKS.has(block.type) && 'packetId' in block && block.packetId) {
      packetIds.add(block.packetId);
    }
  }

  const problems: string[] = [];

  const packetsById = new Map<string, PacketRefRows>();
  if (packetIds.size > 0) {
    const rows = await client.query<PacketRow>(
      `SELECT id, observations, derived, artifacts FROM reference.theme_impact_packets
       WHERE id = ANY($1::text[]) AND status = 'published'`,
      [[...packetIds]],
    );
    for (const row of rows.rows) {
      packetsById.set(row.id, {
        observationIds: new Set((row.observations ?? []).map((o) => o.observationId)),
        derivedIds: new Set((row.derived ?? []).map((d) => d.derivedId)),
        artifactIds: new Set((row.artifacts ?? []).map((a) => a.artifactId)),
        hasDatedArtifact: (row.artifacts ?? []).some((a) => Boolean(a.dated)),
      });
    }
    for (const id of packetIds) {
      if (!packetsById.has(id)) problems.push(`packet "${id}" is not a published packet`);
    }
  }

  for (const block of article.body) {
    if (!('packetId' in block) || !block.packetId) continue;
    const packet = packetsById.get(block.packetId);
    if (!packet) continue; // already reported as missing
    if (block.type === 'stat') {
      const ids = block.kind === 'observation' ? packet.observationIds : packet.derivedIds;
      if (!ids.has(block.refId)) {
        problems.push(`stat refId "${block.refId}" not found on packet "${block.packetId}"`);
      }
    } else if (block.type === 'primaryDocument') {
      if (!packet.artifactIds.has(block.refId)) {
        problems.push(`primaryDocument refId "${block.refId}" not on packet "${block.packetId}"`);
      }
    } else if (block.type === 'timeline') {
      if (!packet.hasDatedArtifact) {
        problems.push(`timeline packet "${block.packetId}" has no dated artifacts`);
      }
    }
  }

  if (entityIds.size > 0) {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<{ entity_id: string }>(
      `SELECT entity_id FROM published.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, [...entityIds]],
    );
    const found = new Set(rows.rows.map((row) => row.entity_id));
    for (const id of entityIds) {
      if (!found.has(id)) problems.push(`linked entity "${id}" not in the active release`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`article "${article.slug}" reference gate failed:\n  ${problems.join('\n  ')}`);
  }
}

export const UPSERT_SQL = `
INSERT INTO reference.articles (
  id, slug, title, summary, theme_id, era_label, place_label, published_at, updated_at,
  hero_image, body, "references", related_entity_ids, status, kind, series, tags, contributors, row_updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date,
  $10::jsonb, $11::jsonb, $12::jsonb, $13::text[], $14, $15, $16::jsonb, $17::text[], $18::jsonb, now()
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  theme_id = EXCLUDED.theme_id,
  era_label = EXCLUDED.era_label,
  place_label = EXCLUDED.place_label,
  published_at = EXCLUDED.published_at,
  updated_at = EXCLUDED.updated_at,
  hero_image = EXCLUDED.hero_image,
  body = EXCLUDED.body,
  "references" = EXCLUDED."references",
  related_entity_ids = EXCLUDED.related_entity_ids,
  status = EXCLUDED.status,
  kind = EXCLUDED.kind,
  series = EXCLUDED.series,
  tags = EXCLUDED.tags,
  contributors = EXCLUDED.contributors,
  row_updated_at = now()
RETURNING id, status;
`;

export const REFERENCE_COLUMNS = `id, slug, title, summary, theme_id, era_label, place_label,
  published_at, updated_at, hero_image, body, "references", related_entity_ids, status,
  kind, series, tags, contributors`;

export type ArticleRow = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly theme_id: string | null;
  readonly era_label: string;
  readonly place_label: string;
  readonly published_at: string | Date;
  readonly updated_at: string | Date | null;
  readonly hero_image: unknown;
  readonly body: unknown;
  readonly references: unknown;
  readonly related_entity_ids: readonly string[];
  readonly status: string;
  readonly kind: string | null;
  readonly series: unknown;
  readonly tags: readonly string[] | null;
  readonly contributors?: unknown;
};

function dateString(value: string | Date | null): string | undefined {
  if (value === null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Rebuild the public projection doc from a reference row + release id. */
export function rowToProjection(row: ArticleRow, releaseId: string) {
  const doc = {
    id: row.id,
    releaseId,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.hero_image ? { heroImage: row.hero_image } : {}),
    publishedAt: dateString(row.published_at)!,
    ...(dateString(row.updated_at) ? { updatedAt: dateString(row.updated_at) } : {}),
    eraLabel: row.era_label,
    placeLabel: row.place_label,
    ...(row.theme_id ? { themeId: row.theme_id } : {}),
    kind: row.kind ?? 'chapter',
    ...(row.series ? { series: row.series } : {}),
    tags: row.tags ?? [],
    body: row.body,
    references: row.references ?? [],
    relatedEntityIds: row.related_entity_ids ?? [],
    contributors: row.contributors ?? [],
  };
  return publicArticleProjectionSchema.parse(doc);
}

export function upsertParams(article: ArticleAuthoring): readonly unknown[] {
  return [
    article.id,
    article.slug,
    article.title,
    article.summary,
    article.themeId ?? null,
    article.eraLabel,
    article.placeLabel,
    article.publishedAt,
    article.updatedAt ?? null,
    article.heroImage ? JSON.stringify(article.heroImage) : null,
    JSON.stringify(article.body),
    JSON.stringify(article.references),
    [...article.relatedEntityIds],
    article.status,
    article.kind ?? 'chapter',
    article.series ? JSON.stringify(article.series) : null,
    [...(article.tags ?? [])],
    JSON.stringify(article.contributors ?? []),
  ];
}

export async function resolveActiveReleaseId(client: pg.PoolClient): Promise<string> {
  const active = await client.query<{ release_id: string }>(
    `SELECT release_id FROM published.active_release WHERE id = 'active'`,
  );
  const releaseId = active.rows[0]?.release_id;
  if (!releaseId) throw new Error('no active release configured in published.active_release');
  return releaseId;
}

export function contentHash(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/** Minimal SafeHttpClient for the two free/keyless DOI-resolution APIs only. */
const doiHttpClient: SafeHttpClient = async (request) => {
  const url = new URL(request.url);
  if (!['api.crossref.org', 'api.openalex.org'].includes(url.hostname)) {
    throw new Error(`doiHttpClient only supports crossref/openalex; got ${url.hostname}`);
  }
  const response = await fetch(request.url, {
    method: request.method ?? 'GET',
    ...(request.headers !== undefined ? { headers: request.headers } : {}),
  });
  const bodyText = await response.text();
  const headers: Record<string, string | undefined> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, bodyText, finalUrl: response.url };
};

/**
 * CHECK_DOIS=1 verifies attached DOIs through Crossref/OpenAlex. An unresolved DOI or
 * title/author/venue mismatch is an error regardless of publication status. Offline validation
 * does not perform these network checks.
 */
export async function gateDoiCitations(article: ArticleAuthoring): Promise<void> {
  const errors: string[] = [];
  for (const reference of article.references) {
    const citation = reference.scholarlyCitation;
    if (!citation) continue;
    const result = await checkDoiCitation(doiHttpClient, citation.doi, {
      title: citation.title,
      firstAuthorSurname: citation.firstAuthorSurname,
      venue: citation.venue,
    });
    if (result.outcome === 'unresolved') {
      errors.push(
        `${article.id} / reference ${reference.id}: DOI ${citation.doi} did not resolve (${result.reason})`,
      );
    } else if (result.outcome === 'mismatch') {
      const detail = result.mismatches
        .map(
          (m) =>
            `${m.field}: stored=${JSON.stringify(m.stored)} resolved=${JSON.stringify(m.resolved)}`,
        )
        .join('; ');
      errors.push(
        `${article.id} / reference ${reference.id}: DOI ${citation.doi} mismatch (${detail})`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`DOI resolution gate failed:\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Minimal HEAD/GET reachability check for a single reference.url, with a small retry count
 * for transient failures. Not the shared `SafeHttpClient` port from `@repo/domain` — that
 * type's request.method is `'GET' | 'POST'` only, and a plain reachability check needs HEAD
 * (falling back to GET when a server rejects HEAD with 405/501).
 */
async function checkReferenceUrlReachable(
  url: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const result = await safeFetchIsReachable(url, { maxDurationMs: 15000 });
  return result.reachable ? { ok: true } : { ok: false, reason: result.reason ?? 'Unreachable' };
}

/**
 * CHECK_URLS=1 checks every reference URL and reports reachability failures. The opt-in network
 * gate is separate from offline content validation and DOI identity checks.
 */
export async function gateReferenceUrls(article: ArticleAuthoring): Promise<void> {
  const errors: string[] = [];
  for (const reference of article.references) {
    const result = await checkReferenceUrlReachable(reference.url);
    if (!result.ok) {
      errors.push(
        `${article.id} / reference ${reference.id}: url ${JSON.stringify(reference.url)} unreachable (${result.reason})`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(`URL reachability gate failed:\n  ${errors.join('\n  ')}`);
  }
}

export function rowToProjectionAuthoring(row: ArticleRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ...(row.hero_image ? { heroImage: row.hero_image } : {}),
    publishedAt: dateString(row.published_at)!,
    ...(dateString(row.updated_at) ? { updatedAt: dateString(row.updated_at) } : {}),
    eraLabel: row.era_label,
    placeLabel: row.place_label,
    ...(row.theme_id ? { themeId: row.theme_id } : {}),
    kind: row.kind ?? 'chapter',
    ...(row.series ? { series: row.series } : {}),
    tags: row.tags ?? [],
    body: row.body,
    references: row.references ?? [],
    relatedEntityIds: row.related_entity_ids ?? [],
    contributors: row.contributors ?? [],
  };
}
