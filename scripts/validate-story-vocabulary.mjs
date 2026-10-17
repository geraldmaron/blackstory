/**
 * Keeps the Story vocabulary single: a published piece is a Story, its `format` is `chapter` or
 * `entry`, and an ordered set of entries is a `collection`. "Article" is retired as a content-type
 * name, so identifiers, tables, columns, routes and stored values that carry it are rejected.
 *
 * Deliberately NOT banned, because they are not the content type: the HTML `<article>` element,
 * schema.org `Article` JSON-LD, "article" meaning a
 * news or encyclopedia article, a statute's "Article III", and a few third-party URLs. Applied
 * migrations (`supabase/migrations/`) are history and are never rewritten.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BANNED = [
  [/\bPublicArticle\w*/, 'PublicArticle* type (use PublicStory*)'],
  [
    /\b(?:hydrate|read|save|publish|review|archive|unarchive|restore|rollback|list|resolve)Article\w*\b/,
    'Article* function name (use Story*)',
  ],
  [
    /\b(?:ArticleDraft|ArticleRow|ArticleAuthoring|ArticleKind|HydratedArticle\w*|ArticleBody\w*|ArticleProse\w*|ArticleReferences\w*|ArticleHeroPhoto)\b/,
    'Article* type or component (use Story*)',
  ],
  [
    /\barticle(?:Draft|Kind|Series|Id|Ids|Slug|Packet|Payload|Block)\w*\b/,
    'article* identifier (use story*)',
  ],
  [
    /\b(?:release_articles|article_revisions|article_reviews|article_publications)\b/,
    'article table name (use story*)',
  ],
  [/\b(?:reference|bb_reference)\.articles\b/, 'reference.articles (renamed reference.stories)'],
  [/\barticle_id\b/, 'article_id column (use story_id)'],
  [
    /\bkind:\s*['"]article['"]|['"]kind['"]:\s*['"]article['"]/,
    "kind: 'article' (format is 'entry')",
  ],
  [
    /\/admin\/(?:api\/articles|stories\/articles)\b/,
    'legacy admin route (use /admin/stories, /admin/api/stories)',
  ],
  [
    /\b(?:lib\/articles|components\/article)\//,
    'legacy module path (use lib/stories, components/story)',
  ],
  [
    /\b(?:lint|build|documentTo|toDocument)Article\w*|\barticleToDocument\b/,
    'Article* editor function (use Story*)',
  ],
  [/\.article\.json\b/, '.article.json draft files (use .story.json)'],
  [
    /\bds-(?:story-)?article\b|\badmin-base-article\b/,
    'ds-article CSS prefix (renamed ds-reading)',
  ],
  [/article\.cover\.package/, 'article cover package kind (use story.cover.package)'],
];

const SKIP_PREFIXES = [
  'supabase/migrations/', // applied history is immutable
  'supabase/rehearsal/', // the rehearsal record names the legacy objects it renames
  '.beads/',
  'docs/admin/admin-surface-audit-2026-10.md', // dated audits describe the system as it was
  'docs/admin/editorial-production-rollout.md',
  'docs/research/lives-archive-verification.md', // dated verification record
  'scripts/validate-story-vocabulary.mjs',
];
const EXT = /\.(?:ts|tsx|mts|mjs|cjs|js|json|css|sql|py|sh|md|yml|yaml)$/;

const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .split('\n')
  .filter(
    (f) =>
      f &&
      EXT.test(f) &&
      !SKIP_PREFIXES.some((p) => f.startsWith(p)) &&
      !f.includes('node_modules/'),
  );

const violations = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    for (const [pattern, why] of BANNED) {
      if (pattern.test(lines[i]))
        violations.push(`${file}:${i + 1}: ${why}\n    ${lines[i].trim().slice(0, 140)}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Story vocabulary: ${violations.length} legacy "article" content-type reference(s):\n`,
  );
  console.error(violations.slice(0, 60).join('\n'));
  if (violations.length > 60) console.error(`\n... and ${violations.length - 60} more`);
  process.exit(1);
}
console.log(`Story vocabulary: ${files.length} files checked, no legacy content-type names.`);
