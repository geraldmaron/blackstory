/**
 * Gated auto-promotion: converts enrichment-run "keep" packets that clear a strict,
 * deterministic bar into publish-ready national-catalog fixture entries. This is the
 * only automated path from LLM output toward the public catalog — it never writes to
 * Firestore itself. It hands off a validated fixture file that still requires the
 * existing human-run `publish-national-catalog.ts` command, preserving the
 * intake/publication separation the source-program methodology requires (see
 * packages/firebase/fixtures/seed-programs/blackstory-starter-2026-07/source-program-workbook.json,
 * "Methodology" sheet, rule 1).
 *
 * The bar (ALL must hold, or the item is held for human review with a reason):
 *  1. decision === 'keep', confidence >= AUTO_PROMOTE_CONFIDENCE_FLOOR (stricter than the
 *     0.6 staging floor in commit-enrichment-keeps.ts), zero validationIssues.
 *  2. At least one claim, and EVERY claim clears the product constitution's real
 *     confidence-publish threshold (lib/confidence.ts — sourceAuthority + lineage-
 *     independence + directness + ... , weighted, same engine canonicalClaims uses,
 *     not a duplicate/looser one). A claim's evidence is its own citation PLUS the
 *     subject's independently-found corroborating source when one exists (built by
 *     build-discovery-enrichment-subjects.ts's citation-trail/search step) — this is
 *     what lets a Wikipedia-sourced claim clear the bar when a real Tier-1 source
 *     corroborates it, instead of being capped by whichever one source it started with.
 *  3. subject.kind !== 'person'. Living-status privacy determination (methodology rule 6)
 *     requires human judgment this script does not attempt; person entities always fall
 *     through to human review regardless of source tier.
 *  4. A derivable notabilityBasis (>=1) and a passing fact-publish gate, using the same
 *     domain gates the manual publish script enforces — so nothing published this way is
 *     held to a lower bar than a human-curated entry.
 *  5. Reference resolution (`resolveReleaseEntityReferences`) succeeds: topics registered,
 *     evidence ids resolve, location fields non-empty.
 *
 * Usage:
 *   node --conditions development --import tsx packages/firebase/scripts/auto-promote-corsair-keeps.ts \
 *     --run .cache/overnight-enrichment/run-<stamp>.json \
 *     --subjects .cache/overnight-enrichment/subjects-<stamp>.json
 *
 * Output:
 *   packages/firebase/fixtures/national-catalog/auto-promoted-<date>.json  (publish-ready)
 *   .cache/auto-promotion/report-<date>.json                              (promoted/held + reasons)
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
import { normalizeEnrichmentDrafts } from './lib/normalize-enrichment-drafts.ts';

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
  if (!runPath || !subjectsPath) {
    console.error('Usage: --run <enrichment run.json> --subjects <subjects.json>');
    process.exit(2);
  }
  const runData = JSON.parse(readFileSync(runPath, 'utf8')) as { items: readonly EnrichmentItem[] };
  const subjectsData = JSON.parse(readFileSync(subjectsPath, 'utf8')) as {
    subjects: readonly SubjectMeta[];
  };
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
      continue; // rejects/needs_evidence are not this gate's concern
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
    if (subject.kind === 'person') {
      held.push({
        subjectId: packet.subjectId,
        title,
        reason: 'person entities require human living-status/privacy review',
      });
      continue;
    }
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

    const normalizedDrafts = normalizeEnrichmentDrafts(packet.drafts);

    const entry: ReleaseSourceEntity = {
      id: packet.subjectId,
      kind: subject.kind ?? 'place',
      displayName: title,
      summary: normalizedDrafts.publicSummary ?? '',
      ...(normalizedDrafts.eraBuckets && normalizedDrafts.eraBuckets.length > 0
        ? { eraBuckets: normalizedDrafts.eraBuckets }
        : {}),
      ...(normalizedDrafts.topicIds && normalizedDrafts.topicIds.length > 0
        ? { topicTags: normalizedDrafts.topicIds, topicIds: normalizedDrafts.topicIds }
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

    // Reuse the SAME builder the manual publish path uses — fact-publish gate,
    // notability-basis derivation, and reference resolution all run identically here,
    // so nothing auto-promoted clears a lower bar than a human-curated entry.
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

  const stamp = readArgFlag('--stamp') ?? runPath.match(/run-(.+)\.json$/u)?.[1] ?? 'unstamped';
  const outFixturePath = join(catalogDir, `auto-promoted-${stamp}.json`);
  writeFileSync(outFixturePath, `${JSON.stringify(promoted, null, 2)}\n`);
  writeFileSync(
    join(reportDir, `report-${stamp}.json`),
    `${JSON.stringify(
      {
        total: runData.items.length,
        promoted: promoted.length,
        held: held.length,
        heldReasons: held,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    JSON.stringify(
      {
        total: runData.items.length,
        promotedCount: promoted.length,
        heldCount: held.length,
        fixture: promoted.length > 0 ? outFixturePath : '(none written — nothing cleared the bar)',
        nextStep:
          promoted.length > 0
            ? 'Run `node --conditions development --import tsx packages/firebase/scripts/publish-national-catalog.ts` ' +
              '(DRY_RUN=1 first) to validate + publish this fixture. This script never writes to Firestore itself.'
            : undefined,
      },
      null,
      2,
    ),
  );
  if (promoted.length === 0 && existsSync(outFixturePath)) {
    // Avoid leaving a stray empty fixture from a prior run's naming collision.
    writeFileSync(outFixturePath, '[]\n');
  }
}

main();
