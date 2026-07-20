/**
 * Content catalog for the public docs site.
 * Walks apps/docs/content/*.md, parses front matter, and builds nav + search index.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const CONTENT_ROOT = path.join(process.cwd(), 'content');

export type DocNavGroup = 'start' | 'concepts' | 'reference';

export type DocEntry = {
  slug: string;
  url: string;
  title: string;
  description: string;
  nav: DocNavGroup;
  order: number;
  body: string;
};

const NAV_LABELS: Record<DocNavGroup, string> = {
  start: 'Get started',
  concepts: 'Concepts',
  reference: 'Reference',
};

export function navLabel(group: DocNavGroup): string {
  return NAV_LABELS[group];
}

function listMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(dir, name));
}

export function loadAllDocs(): DocEntry[] {
  const files = listMarkdownFiles(CONTENT_ROOT);
  const docs: DocEntry[] = files.map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    const slug = path.basename(filePath, '.md');
    const nav = (data.nav as DocNavGroup) || 'reference';
    return {
      slug,
      url: `/guides/${slug}/`,
      title: String(data.title ?? slug),
      description: String(data.description ?? ''),
      nav,
      order: Number(data.order ?? 99),
      body: content.trim(),
    };
  });
  return docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function loadDoc(slug: string): DocEntry | undefined {
  return loadAllDocs().find((doc) => doc.slug === slug);
}

export function docsByNav(): { group: DocNavGroup; label: string; docs: DocEntry[] }[] {
  const groups: DocNavGroup[] = ['start', 'concepts', 'reference'];
  const all = loadAllDocs();
  return groups.map((group) => ({
    group,
    label: navLabel(group),
    docs: all.filter((doc) => doc.nav === group),
  }));
}

export type SearchHit = {
  slug: string;
  url: string;
  title: string;
  description: string;
  excerpt: string;
};

export function buildSearchIndex(): SearchHit[] {
  return loadAllDocs().map((doc) => ({
    slug: doc.slug,
    url: doc.url,
    title: doc.title,
    description: doc.description,
    excerpt: doc.body.replace(/\s+/g, ' ').slice(0, 240),
  }));
}
