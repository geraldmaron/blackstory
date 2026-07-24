/**
 * Export web legal seed (snapshots + explainers) to mobile JSON catalog.
 * Run from repo root:
 *   node --conditions=development --import tsx apps/mobile/scripts/export-law-seed.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(here, '../../../apps/web/src/data/legal-seed.ts');
const outPath = resolve(here, '../src/features/law/catalog-seed.json');

const {
  LEGAL_SEED_RELEASE_ID,
  listLegalSnapshots,
  getLegalCatalogEntry,
  getLegalFact,
} = await import(pathToFileURL(seedPath).href);

const entries = listLegalSnapshots().map((snapshot) => {
  const catalog = getLegalCatalogEntry(snapshot.id);
  const fact = snapshot.factId ? getLegalFact(snapshot.factId) : undefined;
  const subject = fact?.subjects?.find((s) => s.role === 'primary-subject');
  return {
    id: snapshot.id,
    slug: snapshot.slug,
    title: snapshot.title,
    kind: snapshot.kind,
    lawStatus: snapshot.lawStatus,
    jurisdictionId: snapshot.jurisdictionId,
    topics: [...snapshot.topics],
    citation: snapshot.citation.canonicalCitation,
    sourceUrl: snapshot.citation.archive.sourceUrl,
    officialUrl: snapshot.citation.archive.officialUrl ?? snapshot.citation.archive.sourceUrl,
    archivedCaptureUrl: snapshot.citation.archive.archivedCaptureUrl,
    retrievedAt: snapshot.citation.archive.retrievedAt,
    licenseTag: snapshot.citation.licenseTag,
    ...(snapshot.factId ? { factId: snapshot.factId } : {}),
    ...(subject?.entityId ? { canonicalEntityId: subject.entityId } : {}),
    ...(catalog?.explainer
      ? {
          explainer: {
            whatItSays: catalog.explainer.whatItSays,
            whatItMeans: [...catalog.explainer.whatItMeans],
            whyItMatters: [...catalog.explainer.whyItMatters],
            rightsToday: catalog.explainer.rightsToday.map((row) => ({
              label: row.label,
              agencyUrl: row.agencyUrl,
            })),
            primarySources: catalog.explainer.primarySources.map((row) => ({
              label: row.label,
              url: row.url,
              licenseTag: row.licenseTag,
            })),
            reviewedAt: catalog.explainer.reviewedAt,
            ...(catalog.explainer.termOfArtLinks
              ? {
                  termOfArtLinks: catalog.explainer.termOfArtLinks.map((row) => ({
                    term: row.term,
                    wexUrl: row.wexUrl,
                  })),
                }
              : {}),
          },
        }
      : {}),
  };
});

const snapshot = {
  version: LEGAL_SEED_RELEASE_ID,
  generatedAt: new Date().toISOString(),
  entries,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Wrote ${outPath} (${entries.length} law entries, version ${snapshot.version})`);
