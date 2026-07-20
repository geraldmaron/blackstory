/**
 * One-off variant of auto-promote-corsair-keeps.ts for the manual living-status/privacy
 * review pass explicitly requested and confirmed by the owner (2026-07-20): given a
 * curated exclude-list of subjectIds the owner has NOT cleared (living, contemporary, or
 * factually disputed figures), every OTHER person-kind subject is allowed past the
 * person-privacy gate that auto-promote-corsair-keeps.ts always applies. Every other
 * gate (confidence floor, claim count, location completeness, per-claim confidence
 * threshold, buildReleaseEntityArtifacts validation) is identical and unmodified — this
 * does not lower the bar anywhere except the one gate the owner explicitly reviewed.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/auto-promote-person-review.ts \
 *     --run <run.json> --subjects <subjects.json> --exclude <exclude-ids.json> --stamp <stamp>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildReleaseEntityArtifacts,
  type ReleaseSourceClaim,
  type ReleaseSourceEntity,
} from '@repo/domain';
import { computeClaimConfidence, type SourceForConfidence } from './lib/confidence.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, '../../..');
const catalogDir = join(repoRoot, 'packages/firebase/fixtures/national-catalog');
const reportDir = join(repoRoot, '.cache/auto-promotion');

const AUTO_PROMOTE_CONFIDENCE_FLOOR = 0.8;

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

type PacketClaim = {
  readonly predicate?: string;
  readonly object?: string;
  readonly confidenceLevel?: string;
  readonly citationSource?: string;
  readonly citationHref?: string;
  readonly citationLabel?: string;
};

type EnrichmentItem = {
  readonly packet: {
    readonly subjectId: string;
    readonly subjectTitle?: string;
    readonly decision: string;
    readonly confidence: number;
    readonly validationIssues: readonly string[];
    readonly drafts: {
      readonly publicSummary?: string;
      readonly historicalContext?: string;
      readonly claims?: readonly PacketClaim[];
      readonly topicIds?: readonly string[];
      readonly eraBuckets?: readonly string[];
      readonly keywords?: readonly string[];
    };
  };
};

function readArgFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function main(): void {
  const runPath = readArgFlag('--run');
  const subjectsPath = readArgFlag('--subjects');
  const excludePath = readArgFlag('--exclude');
  if (!runPath || !subjectsPath || !excludePath) {
    console.error('Usage: --run <run.json> --subjects <subjects.json> --exclude <exclude-ids.json> --stamp <stamp>');
    process.exit(2);
  }
  const runData = JSON.parse(readFileSync(runPath, 'utf8')) as { items: readonly EnrichmentItem[] };
  const subjectsData = JSON.parse(readFileSync(subjectsPath, 'utf8')) as {
    subjects: readonly SubjectMeta[];
  };
  const excludeIds = new Set<string>(JSON.parse(readFileSync(excludePath, 'utf8')) as readonly string[]);
  const subjectById = new Map(subjectsData.subjects.map((subject) => [subject.subjectId, subject]));

  mkdirSync(catalogDir, { recursive: true });
  mkdirSync(reportDir, { recursive: true });

  const promoted: ReleaseSourceEntity[] = [];
  const held: Array<{ subjectId: string; title: string; reason: string }> = [];

  for (const item of runData.items) {
    const { packet } = item;
    const subject = subjectById.get(packet.subjectId);
    const title = packet.subjectTitle ?? subject?.title ?? packet.subjectId;

    if (packet.decision !== 'keep') {
      continue;
    }
    if (packet.confidence < AUTO_PROMOTE_CONFIDENCE_FLOOR) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: `confidence ${packet.confidence} below auto-promote floor ${AUTO_PROMOTE_CONFIDENCE_FLOOR}`,
      });
      continue;
    }
    if (packet.validationIssues.length > 0) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: `validation issues: ${packet.validationIssues.join('; ')}`,
      });
      continue;
    }
    if (!subject) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: 'no matching subject metadata (location/kind unknown)',
      });
      continue;
    }
    if (subject.kind === 'person' && excludeIds.has(packet.subjectId)) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: 'person entity — living/contemporary or disputed, held per owner review 2026-07-20',
      });
      continue;
    }
    // NOTE: unlike auto-promote-corsair-keeps.ts, person-kind subjects NOT on the
    // exclude list fall through to the same gates every other kind faces below —
    // this is the one deliberate, owner-confirmed difference from that script.
    const draftClaims = packet.drafts.claims ?? [];
    if (draftClaims.length === 0) {
      held.push({ subjectId: packet.subjectId, title, reason: 'no structured claims in draft' });
      continue;
    }
    if (!subject.jurisdictionLabel || !subject.locationLabel || !subject.locationPrecision) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: 'missing jurisdiction/location fields',
      });
      continue;
    }

    const belowThreshold: string[] = [];
    draftClaims.forEach((claim, index) => {
      if (!claim.citationHref) {
        belowThreshold.push(`claims[${index}]: no citationHref`);
        return;
      }
      const sources: SourceForConfidence[] = [
        { url: claim.citationHref, textContainsSubjectName: true },
      ];
      if (subject.corroboratingSourceUrl && subject.corroboratingSourceUrl !== claim.citationHref) {
        sources.push({ url: subject.corroboratingSourceUrl, textContainsSubjectName: true });
      }
      const result = computeClaimConfidence(`${packet.subjectId}-claim-${index}`, sources);
      if (!result.passesPublishThreshold) {
        belowThreshold.push(
          `claims[${index}]: confidence ${result.score} below threshold ${result.threshold} ` +
            `(${result.independentLineageCount} independent source(s), authority ${result.components.sourceAuthority})`,
        );
      }
    });
    if (belowThreshold.length > 0) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: `insufficient confidence: ${belowThreshold.join('; ')}`,
      });
      continue;
    }

    const claims: ReleaseSourceClaim[] = draftClaims.map((claim) => ({
      predicate: claim.predicate ?? 'documented_site',
      object: claim.object ?? '',
      confidenceLevel:
        claim.confidenceLevel === 'high' ||
        claim.confidenceLevel === 'medium' ||
        claim.confidenceLevel === 'low'
          ? claim.confidenceLevel
          : 'medium',
      citationSource:
        claim.citationSource ?? new URL(claim.citationHref ?? 'https://unknown').hostname,
      citationHref: claim.citationHref,
      citationLabel: claim.citationLabel ?? claim.citationSource ?? 'Source',
    }));

    const entry: ReleaseSourceEntity = {
      id: packet.subjectId,
      kind: subject.kind ?? 'place',
      displayName: title,
      summary: packet.drafts.publicSummary ?? '',
      ...(packet.drafts.eraBuckets ? { eraBuckets: packet.drafts.eraBuckets } : {}),
      ...(packet.drafts.topicIds
        ? { topicTags: packet.drafts.topicIds, topicIds: packet.drafts.topicIds }
        : {}),
      mentionedEntityIds: [],
      ...(packet.drafts.keywords ? { keywords: packet.drafts.keywords } : {}),
      jurisdictionLabel: subject.jurisdictionLabel,
      locationPrecision: subject.locationPrecision,
      locationLabel: subject.locationLabel,
      lat: subject.lat ?? 0,
      lng: subject.lng ?? 0,
      claims,
      ...(packet.drafts.historicalContext
        ? { historicalContext: packet.drafts.historicalContext }
        : {}),
    };

    const build = buildReleaseEntityArtifacts(entry, {
      releaseId: 'auto-promotion-preview',
      generatedAt: new Date().toISOString(),
    });
    if (!build.ok) {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: `${build.reason}: ${build.message}`,
      });
      continue;
    }

    promoted.push(entry);
  }

  const stamp = readArgFlag('--stamp') ?? 'person-review';
  const outFixturePath = join(catalogDir, `auto-promoted-${stamp}.json`);
  writeFileSync(outFixturePath, `${JSON.stringify(promoted, null, 2)}\n`);
  writeFileSync(
    join(reportDir, `report-${stamp}.json`),
    `${JSON.stringify(
      { total: runData.items.length, promoted: promoted.length, held: held.length, heldReasons: held },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      { total: runData.items.length, promotedCount: promoted.length, heldCount: held.length, fixture: outFixturePath },
      null,
      2,
    ),
  );
  if (promoted.length === 0 && existsSync(outFixturePath)) {
    writeFileSync(outFixturePath, '[]\n');
  }
}

main();
