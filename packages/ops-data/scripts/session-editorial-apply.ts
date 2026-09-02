/**
 * Validates a fan-out batch of session-drafted editorial judgments through the SAME
 * domain functions the LLM-provider path uses (buildEditorialPacket, validateEditorialDrafts)
 * — so a session-drafted answer and an OpenRouter-drafted answer are judged by identical
 * rules. Never writes anywhere: this lane is brand-new candidates (not yet in the catalog),
 * so the output is a review packet file for a human to read before anything is promoted to
 * landscape_candidates — a materially bigger, more sensitive step than the entity-enrichment
 * lane's session-enrich-apply.ts (which only fills fields on already-catalogued entities).
 *
 * Usage:
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/session-editorial-apply.ts \
 *     --subjects=<dir>/subjects.json --answers-file=<dir>/answers.jsonl --out=<dir>/packets.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  buildEditorialPacket,
  validateEditorialDrafts,
  type EditorialClaimDraft,
  type EditorialDecision,
  type EditorialFieldDraft,
  type EditorialPacket,
} from '@repo/domain';

type Subject = {
  readonly subjectId: string;
  readonly title: string;
  readonly sourceSnippets?: readonly string[];
};

type Answer = { readonly subjectId: string; readonly rawContent: string };

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

function toSafeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toSafeStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : undefined;
}

function parseDecision(raw: unknown): EditorialDecision {
  if (raw === 'reject' || raw === 'needs_evidence' || raw === 'keep') return raw;
  return 'needs_evidence';
}

function parseClaims(raw: unknown): readonly EditorialClaimDraft[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const claims = raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      predicate: toSafeString(item.predicate) ?? '',
      object: toSafeString(item.object) ?? '',
      confidenceLevel: (toSafeString(item.confidenceLevel) ?? 'low') as 'high' | 'medium' | 'low',
      citationSource: toSafeString(item.citationSource) ?? '',
      citationHref: toSafeString(item.citationHref) ?? '',
      citationLabel: toSafeString(item.citationLabel) ?? '',
    }));
  return claims.length > 0 ? claims : undefined;
}

/** Pulls every URL a subject's sourceSnippets actually offered, so claims can't cite outside them. */
function extractAllowedHrefs(sourceSnippets: readonly string[] | undefined): readonly string[] {
  if (!sourceSnippets) return [];
  const hrefs: string[] = [];
  for (const snippet of sourceSnippets) {
    const match = /https?:\/\/\S+/u.exec(snippet.split('\n')[0] ?? '');
    if (match) hrefs.push(match[0]);
  }
  return hrefs;
}

function parseDrafts(raw: Record<string, unknown> | undefined): EditorialFieldDraft {
  if (!raw) return {};
  return {
    ...(toSafeString(raw.publicSummary) !== undefined
      ? { publicSummary: toSafeString(raw.publicSummary) }
      : {}),
    ...(toSafeString(raw.historicalContext) !== undefined
      ? { historicalContext: toSafeString(raw.historicalContext) }
      : {}),
    ...(toSafeString(raw.identityLabel) !== undefined
      ? { identityLabel: toSafeString(raw.identityLabel) }
      : {}),
    ...(toSafeString(raw.relevanceNote) !== undefined
      ? { relevanceNote: toSafeString(raw.relevanceNote) }
      : {}),
    ...(toSafeStringArray(raw.relatedEntityIds) !== undefined
      ? { relatedEntityIds: toSafeStringArray(raw.relatedEntityIds) }
      : {}),
    ...(toSafeString(raw.proposedRelationshipNotes) !== undefined
      ? { proposedRelationshipNotes: toSafeString(raw.proposedRelationshipNotes) }
      : {}),
    ...(parseClaims(raw.claims) !== undefined ? { claims: parseClaims(raw.claims) } : {}),
    ...(toSafeStringArray(raw.topicIds) !== undefined
      ? { topicIds: toSafeStringArray(raw.topicIds) }
      : {}),
    ...(toSafeStringArray(raw.eraBuckets) !== undefined
      ? { eraBuckets: toSafeStringArray(raw.eraBuckets) }
      : {}),
    ...(toSafeStringArray(raw.keywords) !== undefined
      ? { keywords: toSafeStringArray(raw.keywords) }
      : {}),
  };
}

function main(): void {
  const subjectsPath = flag('subjects', '');
  const answersPath = flag('answers-file', '');
  const outPath = flag('out', '');
  if (!subjectsPath || !answersPath || !outPath) {
    throw new Error('--subjects=, --answers-file= and --out= are all required');
  }

  const subjectData = JSON.parse(readFileSync(subjectsPath, 'utf8')) as {
    subjects?: readonly Subject[];
  };
  const subjectById = new Map((subjectData.subjects ?? []).map((s) => [s.subjectId, s]));

  const answers: Answer[] = readFileSync(answersPath, 'utf8')
    .trim()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Answer);

  const nowIso = new Date().toISOString();
  const packets: EditorialPacket[] = [];
  let keepCount = 0;
  let rejectCount = 0;
  let needsEvidenceCount = 0;
  let quarantinedCount = 0;

  for (const answer of answers) {
    const subject = subjectById.get(answer.subjectId);
    let model: Record<string, unknown>;
    try {
      model = JSON.parse(answer.rawContent) as Record<string, unknown>;
    } catch (error) {
      packets.push(
        buildEditorialPacket({
          subjectId: answer.subjectId,
          subjectTitle: subject?.title,
          decision: 'needs_evidence',
          rationale: `Unparseable model output: ${(error as Error).message}`,
          confidence: 0,
          drafts: {},
          validationIssues: ['rawContent is not valid JSON'],
          createdAt: nowIso,
        }),
      );
      needsEvidenceCount += 1;
      quarantinedCount += 1;
      continue;
    }

    const decision = parseDecision(model.decision);
    const drafts = parseDrafts(model.drafts as Record<string, unknown> | undefined);
    const allowedCitationHrefs = extractAllowedHrefs(subject?.sourceSnippets);
    const { issues } = validateEditorialDrafts(drafts, { allowedCitationHrefs });

    packets.push(
      buildEditorialPacket({
        subjectId: answer.subjectId,
        subjectTitle: subject?.title,
        decision,
        rationale: toSafeString(model.rationale) ?? '',
        confidence: typeof model.confidence === 'number' ? model.confidence : 0,
        drafts,
        validationIssues: issues,
        createdAt: nowIso,
      }),
    );

    if (issues.length > 0) quarantinedCount += 1;
    else if (decision === 'keep') keepCount += 1;
    else if (decision === 'reject') rejectCount += 1;
    else needsEvidenceCount += 1;
  }

  writeFileSync(outPath, `${JSON.stringify({ packets, count: packets.length }, null, 2)}\n`);
  console.log(
    JSON.stringify({
      total: packets.length,
      keep: keepCount,
      reject: rejectCount,
      needsEvidence: needsEvidenceCount,
      cleanPacketsWithIssues: quarantinedCount,
      outPath,
    }),
  );
  console.log('\nPrepare-only: nothing written to landscape_candidates or any live table.');
  console.log('Review packets, then decide promotion separately (never automatic).');
}

main();
