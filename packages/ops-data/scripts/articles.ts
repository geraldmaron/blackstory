/**
 * Article lifecycle CLI — the long-form /articles publication surface.
 *
 * Articles are authored as fixture modules, applied to bb_reference.articles at
 * any lifecycle status, promoted to published behind the publish gate, and
 * projected into bb_public.release_articles for the active release. Mirrors the
 * theme-impact packet CLI (packages/ops-data/scripts/theme-packets.ts).
 *
 * Usage (repo root; DATABASE_URL required for every command except validate):
 *   node --conditions development --import tsx packages/ops-data/scripts/articles.ts \
 *     validate packages/ops-data/fixtures/articles/buying-a-home.ts
 *   ... articles.ts apply <fixture.ts ...>     # upsert at declared status
 *   ... articles.ts promote <articleId ...>    # gate + flip to published
 *   ... articles.ts project                    # published -> active release
 *   ... articles.ts audit                      # drift check: release vs reference
 *
 * All write commands run inside a transaction and honor DRY_RUN=1 (rollback).
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { assertArticleCitationIntegrity, publicArticleProjectionSchema } from '@repo/schemas';
import {
  checkDoiCitation,
  isAnchorTierUrl,
  lookupSourceTier,
  type SourceTier,
  type SafeHttpClient,
} from '@repo/domain';
import { z } from 'zod';
import pg from 'pg';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

const USAGE = 'usage: articles.ts <validate|apply|promote|project|audit> [args...]';

/** Authoring shape: the projection doc minus the release-assigned id, plus status. */
const articleAuthoringSchema = publicArticleProjectionSchema
  .omit({ releaseId: true })
  .extend({ status: z.enum(['draft', 'review', 'published']) });
type ArticleAuthoring = z.infer<typeof articleAuthoringSchema>;

const REFERENCED_PACKET_BLOCKS = new Set(['figure', 'stat', 'primaryDocument', 'timeline']);

function isArticleLike(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { slug?: unknown }).slug === 'string' &&
    Array.isArray((value as { body?: unknown }).body)
  );
}

async function loadFixtureArticles(paths: readonly string[]): Promise<readonly ArticleAuthoring[]> {
  if (paths.length === 0) throw new Error('at least one fixture module path is required');
  const articles = new Map<string, ArticleAuthoring>();
  for (const path of paths) {
    const module: Record<string, unknown> = await import(pathToFileURL(resolve(path)).href);
    let found = 0;
    for (const exported of Object.values(module)) {
      const candidates = Array.isArray(exported) ? exported : [exported];
      for (const candidate of candidates) {
        if (!isArticleLike(candidate)) continue;
        found += 1;
        const article = articleAuthoringSchema.parse(candidate);
        const prior = articles.get(article.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(article)) {
          throw new Error(`article ${article.id} defined twice with different content`);
        }
        articles.set(article.id, article);
      }
    }
    if (found === 0) {
      throw new Error(`${path}: no Article exports found (export an article object or an array)`);
    }
  }
  return [...articles.values()];
}

/**
 * Source-quality gate (consults the shared tier registry, not a parallel list — same
 * rule theme-packets.ts's gateSourceTiers enforces for packet observations): every
 * reference's url is classified into a trust tier. T4 (untrusted, unclassified) is a
 * hard error on published articles and a surfaced warning otherwise.
 */
function gateArticleSourceTiers(article: ArticleAuthoring): {
  tally: Record<SourceTier, number>;
  warnings: string[];
} {
  const tally: Record<SourceTier, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
  const warnings: string[] = [];
  const errors: string[] = [];
  for (const reference of article.references) {
    let tier: SourceTier = 'T4';
    try {
      tier = lookupSourceTier(reference.url).tier;
    } catch {
      tier = 'T4';
    }
    tally[tier] += 1;
    if (tier === 'T4') {
      const message = `${article.id} / reference ${reference.id}: untrusted (T4) url ${JSON.stringify(reference.url)}`;
      if (article.status === 'published') errors.push(message);
      else warnings.push(message);
    }
  }
  if (errors.length > 0) {
    throw new Error(`source-tier gate failed (published articles):\n  ${errors.join('\n  ')}`);
  }
  return { tally, warnings };
}

const ANCHORABLE_BLOCKS = new Set(['stat', 'figure', 'pullquote']);

/**
 * Two-anchor corroboration rule (repo-k2q3 crit 3). A stat/figure/pullquote block
 * that declares `anchors` is asserting itself as a load-bearing figure; validate then
 * enforces the declaration: published requires two independent T1/T2 anchors, or one
 * T1 anchor plus `replicationVerified: true` (a human attesting the cited replication
 * package was checked — see repo-fj3a). A block with no `anchors` field is not
 * considered load-bearing and is not gated; this rule doesn't retroactively demand
 * anchors on every existing figure, only ones an author flags as needing them.
 */
function gateLoadBearingAnchors(article: ArticleAuthoring): { warnings: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  article.body.forEach((block, index) => {
    if (!ANCHORABLE_BLOCKS.has(block.type)) return;
    const anchors = (block as { anchors?: readonly { url: string }[] }).anchors;
    if (anchors === undefined) return;
    const replicationVerified =
      (block as { replicationVerified?: boolean }).replicationVerified === true;

    const anchorTiers = anchors.map((anchor) => isAnchorTierUrl(anchor.url));
    const independentHosts = new Set(
      anchors.map((anchor) => {
        try {
          return new URL(anchor.url).hostname.toLowerCase();
        } catch {
          return anchor.url;
        }
      }),
    );
    const anchorTierCount = anchorTiers.filter(Boolean).length;
    const satisfiesTwoAnchors = anchorTierCount >= 2 && independentHosts.size >= 2;
    const satisfiesReplicationException = anchorTierCount >= 1 && replicationVerified;

    if (!satisfiesTwoAnchors && !satisfiesReplicationException) {
      const message =
        `${article.id} / body[${index}] (${block.type}): load-bearing figure declares anchors ` +
        `but has neither two independent T1/T2 anchors nor one T1/T2 anchor + replicationVerified`;
      if (article.status === 'published') errors.push(message);
      else warnings.push(message);
    }
  });
  if (errors.length > 0) {
    throw new Error(
      `load-bearing anchor gate failed (published articles):\n  ${errors.join('\n  ')}`,
    );
  }
  return { warnings };
}

/**
 * Immersion floor (editorial direction, 2026-07-27): a published chapter carries
 * at least 2,000 words of body prose across its paragraph blocks. Counted after
 * stripping `[ref:id]` markers and reducing `[[entityId|Label]]` markup to its
 * visible label, so citation plumbing never pads the floor. Hard error on
 * published articles, surfaced warning otherwise — same posture as the tier gate.
 */
const MIN_PUBLISHED_PROSE_WORDS = 2000;

/**
 * The floor is per-kind, because the two kinds promise the reader different things.
 * A `chapter` promises immersion and has to earn it with sourced depth. An `article`
 * promises a compact, comparable record entry, and padding one to 2,000 words would be
 * the exact failure the chapter floor exists to prevent, pointed the other way. The
 * article floor is set where a paragraph of real context lives and a stub does not.
 */
const MIN_PROSE_WORDS_BY_KIND: Record<'chapter' | 'article', number> = {
  chapter: MIN_PUBLISHED_PROSE_WORDS,
  article: 120,
};

function visibleProse(text: string): string {
  return text
    .replace(/\[ref:[a-z0-9-]+\]/g, ' ')
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

function countProseWords(article: ArticleAuthoring): number {
  let words = 0;
  for (const block of article.body) {
    if (block.type !== 'paragraph') continue;
    const visible = visibleProse((block as { text?: string }).text ?? '');
    words += visible.split(/\s+/).filter(Boolean).length;
  }
  return words;
}

function gateProseWordFloor(article: ArticleAuthoring): { proseWords: number; warnings: string[] } {
  const proseWords = countProseWords(article);
  const kind = article.kind ?? 'chapter';
  const floor = MIN_PROSE_WORDS_BY_KIND[kind];
  if (proseWords >= floor) return { proseWords, warnings: [] };
  const message = `${article.id}: body prose is ${proseWords} words, below the ${floor}-word ${kind} floor`;
  if (article.status === 'published') {
    throw new Error(`prose word-floor gate failed (published articles):\n  ${message}`);
  }
  return { proseWords, warnings: [message] };
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
function gateSeriesPositions(articles: readonly ArticleAuthoring[]): void {
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
 * Standalone-prose gate (editorial direction, 2026-08-07). A chapter is a piece of
 * history, not a page of a product: its prose never names the site it is published on,
 * never cross-references sibling chapters as chapters, and never speaks in the
 * publisher's first person ("our summary," "a story we are telling you"). Readers arrive
 * on these pages from search and syndication with no idea what else exists here, and a
 * sentence like "another chapter on this site follows what happened next" is a dead end
 * to them and an unexplained brand reference to everyone else. Related history is reached
 * through `[[entityId|Label]]` links and `relatedEntityIds`, which resolve to real
 * records, rather than through prose pointing at navigation.
 *
 * Hard error on published articles, surfaced warning otherwise — same posture as the tier
 * and word-floor gates. Governed by docs/content/neo-voice.md Part V ("The chapter stands alone").
 */
const SELF_REFERENCE_PATTERNS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
  { label: 'names the publishing surface', pattern: /\bthis (?:site|website|project|page)\b/i },
  {
    label: 'names the publishing surface',
    pattern: /\b(?:on|across|throughout) (?:the|our) site\b/i,
  },
  {
    label: 'cross-references a sibling chapter',
    pattern: /\b(?:another|the other|a sibling|the next|the previous) chapters?\b/i,
  },
  { label: 'cross-references a sibling chapter', pattern: /\bchapters? (?:here|on this)\b/i },
  {
    label: 'cross-references a sibling chapter',
    pattern: /\bthe (?:wealth|redlining|housing|voting|sentencing) chapter\b/i,
  },
  {
    label: "speaks in the publisher's first person",
    pattern: /\b(?:we|our) (?:are telling|tell|show|summari[sz]e|built|collected|assembled)\b/i,
  },
  {
    label: "speaks in the publisher's first person",
    pattern: /\b(?:our summary|needs us in order|we are telling you)\b/i,
  },
];

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
 * Offline gates: schema (via loader) + inline-citation integrity + source-tier gate +
 * prose floor + standalone-prose gate.
 */
function validateArticleOffline(article: ArticleAuthoring): void {
  assertArticleCitationIntegrity(article);
  const { warnings: tierWarnings } = gateArticleSourceTiers(article);
  for (const warning of tierWarnings) console.warn(`warning: ${warning}`);
  const { warnings: anchorWarnings } = gateLoadBearingAnchors(article);
  for (const warning of anchorWarnings) console.warn(`warning: ${warning}`);
  const { warnings: floorWarnings } = gateProseWordFloor(article);
  for (const warning of floorWarnings) console.warn(`warning: ${warning}`);
  const { warnings: standaloneWarnings } = gateStandaloneProse(article);
  for (const warning of standaloneWarnings) console.warn(`warning: ${warning}`);
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
async function verifyArticleReferences(
  client: pg.PoolClient,
  article: ArticleAuthoring,
): Promise<void> {
  const packetIds = new Set<string>();
  const entityIds = new Set<string>();
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
      `SELECT id, observations, derived, artifacts FROM bb_reference.theme_impact_packets
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
      `SELECT entity_id FROM bb_public.release_entities
       WHERE release_id = $1 AND entity_id = ANY($2::text[])`,
      [releaseId, [...entityIds]],
    );
    const found = new Set(rows.rows.map((row) => row.entity_id));
    for (const id of entityIds) {
      if (!found.has(id)) problems.push(`mapInset entity "${id}" not in the active release`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`article "${article.slug}" reference gate failed:\n  ${problems.join('\n  ')}`);
  }
}

const UPSERT_SQL = `
INSERT INTO bb_reference.articles (
  id, slug, title, summary, theme_id, era_label, place_label, published_at, updated_at,
  hero_image, body, "references", related_entity_ids, status, kind, series, tags, row_updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::date, $9::date,
  $10::jsonb, $11::jsonb, $12::jsonb, $13::text[], $14, $15, $16::jsonb, $17::text[], now()
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
  row_updated_at = now()
RETURNING id, status;
`;

const REFERENCE_COLUMNS = `id, slug, title, summary, theme_id, era_label, place_label,
  published_at, updated_at, hero_image, body, "references", related_entity_ids, status,
  kind, series, tags`;

type ArticleRow = {
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
};

function dateString(value: string | Date | null): string | undefined {
  if (value === null) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** Rebuild the public projection doc from a reference row + release id. */
function rowToProjection(row: ArticleRow, releaseId: string) {
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
  };
  return publicArticleProjectionSchema.parse(doc);
}

function upsertParams(article: ArticleAuthoring): readonly unknown[] {
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
  ];
}

type DbContext = {
  readonly pool: pg.Pool;
  readonly client: pg.PoolClient;
  readonly dryRun: boolean;
};

async function withDb<T>(run: (ctx: DbContext) => Promise<T>): Promise<T> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error('DATABASE_URL is required for this command');
  const dryRun = process.env.DRY_RUN === '1';
  const conn = normalizePgConnectionString(databaseUrl);
  const pool = new pg.Pool({
    connectionString: conn.connectionString,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout = '60s'`);
    const value = await run({ pool, client, dryRun });
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function resolveActiveReleaseId(client: pg.PoolClient): Promise<string> {
  const active = await client.query<{ release_id: string }>(
    `SELECT release_id FROM bb_public.active_release WHERE id = 'active'`,
  );
  const releaseId = active.rows[0]?.release_id;
  if (!releaseId) throw new Error('no active release configured in bb_public.active_release');
  return releaseId;
}

function contentHash(payload: unknown): string {
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
    headers: request.headers,
  });
  const bodyText = await response.text();
  const headers: Record<string, string | undefined> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: response.status, headers, bodyText, finalUrl: response.url };
};

/**
 * DOI resolution gate (repo-k2q3 crit 2 / repo-vdtm): live network call against
 * Crossref/OpenAlex, so gated behind CHECK_DOIS=1 rather than run unconditionally like
 * the offline hash/tier lints. Any reference with a `scholarlyCitation.doi` field is
 * checked; a stored citation whose DOI resolves to a mismatching title/author/venue,
 * or fails to resolve at all, is a hard error regardless of article status — an
 * attached DOI is a specific factual claim, not a soft-linted quality signal.
 */
async function gateDoiCitations(article: ArticleAuthoring): Promise<void> {
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

async function commandValidate(paths: readonly string[]): Promise<void> {
  const articles = await loadFixtureArticles(paths);
  for (const article of articles) validateArticleOffline(article);
  gateSeriesPositions(articles);

  // DB-binding gate: when DATABASE_URL is present, transitively resolve every
  // figure/stat/primaryDocument/timeline refId against its published packet's
  // rows (and mapInset entities against the release), so a validate that passes
  // with DB access proves the article's citations actually exist. Skipped when
  // offline (CI-safe); offline still runs schema + inline-citation integrity.
  let bound: 'db-verified' | 'offline-skipped' = 'offline-skipped';
  if (process.env.DATABASE_URL?.trim()) {
    await withDb(async ({ client }) => {
      for (const article of articles) await verifyArticleReferences(client, article);
    });
    bound = 'db-verified';
  }

  let doiChecked = false;
  if (process.env.CHECK_DOIS === '1') {
    for (const article of articles) await gateDoiCitations(article);
    doiChecked = true;
  }

  console.log(
    JSON.stringify(
      {
        command: 'validate',
        ok: true,
        bound,
        doiChecked,
        articles: articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          kind: a.kind ?? 'chapter',
          status: a.status,
          blocks: a.body.length,
          references: a.references.length,
          proseWords: countProseWords(a),
        })),
      },
      null,
      2,
    ),
  );
}

async function commandApply(paths: readonly string[]): Promise<void> {
  const articles = await loadFixtureArticles(paths);
  for (const article of articles) validateArticleOffline(article);
  gateSeriesPositions(articles);

  const result = await withDb(async ({ client, dryRun }) => {
    const applied: { id: string; status: string }[] = [];
    for (const article of articles) {
      if (article.status === 'published') await verifyArticleReferences(client, article);
      const row = await client.query<{ id: string; status: string }>(
        UPSERT_SQL,
        upsertParams(article) as unknown[],
      );
      applied.push(row.rows[0]!);
    }
    return { applied, dryRun };
  });

  console.log(JSON.stringify({ command: 'apply', ...result }, null, 2));
}

async function commandPromote(articleIds: readonly string[]): Promise<void> {
  if (articleIds.length === 0) throw new Error('at least one article id is required');

  const result = await withDb(async ({ client, dryRun }) => {
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE id = ANY($1::text[])`,
      [[...articleIds]],
    );
    const foundIds = new Set(rows.rows.map((row) => row.id));
    const missing = articleIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) throw new Error(`articles not found: ${missing.join(', ')}`);

    for (const row of rows.rows) {
      const authoring = articleAuthoringSchema.parse({
        ...rowToProjectionAuthoring(row),
        status: 'published',
      });
      validateArticleOffline(authoring);
      await verifyArticleReferences(client, authoring);
    }

    const promoted: string[] = [];
    for (const id of articleIds) {
      const updated = await client.query<{ id: string }>(
        `UPDATE bb_reference.articles SET status = 'published', row_updated_at = now()
         WHERE id = $1 RETURNING id`,
        [id],
      );
      promoted.push(updated.rows[0]!.id);
    }
    return { promoted, dryRun };
  });

  console.log(JSON.stringify({ command: 'promote', ...result }, null, 2));
}

/** Reference row -> authoring doc shape (no releaseId), for the promote gate. */
function rowToProjectionAuthoring(row: ArticleRow) {
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
  };
}

async function commandProject(): Promise<void> {
  const result = await withDb(async ({ client, dryRun }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const rows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE status = 'published' ORDER BY id`,
    );

    const projected: string[] = [];
    const unchanged: string[] = [];
    for (const row of rows.rows) {
      const doc = rowToProjection(row, releaseId);
      const hash = contentHash(doc);
      const upserted = await client.query<{ article_id: string }>(
        `INSERT INTO bb_public.release_articles (
           release_id, article_id, slug, theme_id, published_at, payload, content_hash
         ) VALUES ($1, $2, $3, $4, $5::date, $6::jsonb, $7)
         ON CONFLICT (release_id, article_id) DO UPDATE SET
           slug = EXCLUDED.slug,
           theme_id = EXCLUDED.theme_id,
           published_at = EXCLUDED.published_at,
           payload = EXCLUDED.payload,
           content_hash = EXCLUDED.content_hash
         WHERE bb_public.release_articles.content_hash IS DISTINCT FROM EXCLUDED.content_hash
         RETURNING article_id`,
        [
          releaseId,
          doc.id,
          doc.slug,
          doc.themeId ?? null,
          doc.publishedAt,
          JSON.stringify(doc),
          hash,
        ],
      );
      if (upserted.rows[0]) projected.push(doc.id);
      else unchanged.push(doc.id);
    }

    const stale = await client.query<{ article_id: string }>(
      `DELETE FROM bb_public.release_articles
       WHERE release_id = $1 AND article_id <> ALL($2::text[])
       RETURNING article_id`,
      [releaseId, rows.rows.map((row) => row.id)],
    );

    return {
      releaseId,
      projected,
      unchanged,
      removedStale: stale.rows.map((row) => row.article_id),
      dryRun,
    };
  });

  console.log(JSON.stringify({ command: 'project', ...result }, null, 2));
}

async function commandAudit(): Promise<void> {
  const result = await withDb(async ({ client }) => {
    const releaseId = await resolveActiveReleaseId(client);
    const referenceRows = await client.query<ArticleRow>(
      `SELECT ${REFERENCE_COLUMNS} FROM bb_reference.articles WHERE status = 'published'`,
    );
    const releaseRows = await client.query<{ article_id: string; content_hash: string }>(
      `SELECT article_id, content_hash FROM bb_public.release_articles WHERE release_id = $1`,
      [releaseId],
    );
    const releaseHashById = new Map(
      releaseRows.rows.map((row) => [row.article_id, row.content_hash]),
    );

    const articles: { article_id: string; state: string }[] = [];
    for (const row of referenceRows.rows) {
      const releaseHash = releaseHashById.get(row.id);
      releaseHashById.delete(row.id);
      if (releaseHash === undefined) {
        articles.push({ article_id: row.id, state: 'published_not_projected' });
      } else if (releaseHash !== contentHash(rowToProjection(row, releaseId))) {
        articles.push({ article_id: row.id, state: 'drifted_since_projection' });
      } else {
        articles.push({ article_id: row.id, state: 'ok' });
      }
    }
    for (const articleId of releaseHashById.keys()) {
      articles.push({ article_id: articleId, state: 'in_release_only' });
    }
    return { releaseId, articles, issues: articles.filter((row) => row.state !== 'ok') };
  });
  console.log(JSON.stringify({ command: 'audit', ...result }, null, 2));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'validate':
      return commandValidate(args);
    case 'apply':
      return commandApply(args);
    case 'promote':
      return commandPromote(args);
    case 'project':
      return commandProject();
    case 'audit':
      return commandAudit();
    default:
      throw new Error(USAGE);
  }
}

await main();
