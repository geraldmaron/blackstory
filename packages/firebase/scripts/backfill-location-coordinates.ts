/**
 * Backfills real coordinates for gap-fill subjects the judge already located in
 * text (packet.drafts.location) but which auto-promote-corsair-keeps.ts held
 * because the subject's own Wikipedia article carries no Wikidata coordinates —
 * the common case for laws, government bodies, and organizations with no single
 * point of their own. Writes an augmented copy of the subjects file with lat/lng
 * patched in wherever resolveGovernmentCenterCoordinates finds a real anchor
 * (a named headquarters/milestone site, a state capitol, or the U.S. Capitol for
 * federal subjects) — every value is itself a real, separately-verifiable
 * Wikipedia/Wikidata lookup, never a guessed point. Unresolved subjects are left
 * exactly as they were, still correctly held.
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/firebase/scripts/backfill-location-coordinates.ts \
 *     --run <run.json> --subjects <subjects.json> --out <augmented-subjects.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveGovernmentCenterCoordinates } from './lib/corroborate-source.ts';
import { mapPool } from '../../operator-cli/src/map-pool.ts';

type SubjectMeta = {
  readonly subjectId: string;
  readonly title: string;
  readonly kind?: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision?: string;
  readonly locationLabel?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly corroboratingSourceUrl?: string;
};

type EnrichmentItem = {
  readonly packet: {
    readonly subjectId: string;
    readonly decision: string;
    readonly drafts: {
      readonly location?: {
        readonly jurisdictionLabel: string;
        readonly locationLabel: string;
        readonly locationPrecision: string;
      };
    };
  };
};

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const runPath = readArgFlag('--run');
  const subjectsPath = readArgFlag('--subjects');
  const outPath = readArgFlag('--out');
  const concurrency = Number(readArgFlag('--concurrency') ?? '4');
  if (!runPath || !subjectsPath || !outPath) {
    console.error('Usage: --run <run.json> --subjects <subjects.json> --out <augmented-subjects.json>');
    process.exit(2);
  }

  const runData = JSON.parse(readFileSync(runPath, 'utf8')) as { items: readonly EnrichmentItem[] };
  const subjectsData = JSON.parse(readFileSync(subjectsPath, 'utf8')) as { subjects: readonly SubjectMeta[] };
  const locationBySubjectId = new Map(
    runData.items
      .filter((item) => item.packet.decision === 'keep' && item.packet.drafts.location)
      .map((item) => [item.packet.subjectId, item.packet.drafts.location as NonNullable<typeof item.packet.drafts.location>]),
  );

  let attempted = 0;
  let resolved = 0;
  const augmented = await mapPool(
    subjectsData.subjects,
    async (subject) => {
      if (subject.lat !== undefined && subject.lng !== undefined) return subject; // already has real coordinates
      const location = locationBySubjectId.get(subject.subjectId);
      if (!location) return subject; // judge never proposed a location for this one — nothing to backfill
      attempted += 1;
      const coords = await resolveGovernmentCenterCoordinates(
        location.jurisdictionLabel,
        location.locationLabel,
        location.locationPrecision,
      );
      if (!coords) return subject;
      resolved += 1;
      console.error(`[backfill] ${subject.title}: ${coords.lat}, ${coords.lng}`);
      return { ...subject, lat: coords.lat, lng: coords.lng };
    },
    { concurrency },
  );

  writeFileSync(outPath, `${JSON.stringify({ subjects: augmented }, null, 2)}\n`);
  console.log(JSON.stringify({ totalSubjects: subjectsData.subjects.length, attempted, resolved, outPath }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
