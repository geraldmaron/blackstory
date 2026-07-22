/**
 * Seeds canonical rejudge-progress.ndjson + rejudge-status.md from prior pass artifacts.
 * Run once before or alongside rejudge-dc-keeps-one-by-one.ts.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
const cacheDir = join(repoRoot, '.cache/dc-enrichment');
const progressPath = join(cacheDir, 'rejudge-progress.ndjson');
const statusPath = join(cacheDir, 'rejudge-status.md');

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

type RawProgress = {
  readonly subjectId?: string;
  readonly title?: string;
  readonly decision?: string;
  readonly modelId?: string;
  readonly error?: string;
  readonly confidence?: number;
};

type CanonicalLine = {
  readonly id: string;
  readonly displayName: string;
  readonly model: string;
  readonly decision: string;
  readonly confidence: number | null;
  readonly promoteEligible: boolean;
  readonly pass: string;
  readonly error?: string;
  readonly at: string;
};

const SOURCE_FILES: readonly { readonly file: string; readonly pass: string }[] = [
  { file: 'rejudge-pass1-glm-enrichment-run.json.progress.ndjson', pass: 'pass1-glm' },
  { file: 'rejudge-pass2-qwen3-enrichment-run.json.progress.ndjson', pass: 'pass2-qwen3' },
  { file: 'rejudge-pass3-qwen35-enrichment-run.json.progress.ndjson', pass: 'pass3-qwen35' },
  { file: 'rejudge-keeps-enrichment-run.json.progress.ndjson', pass: 'legacy-72b-batch' },
  { file: 'rejudge-retry-enrichment-run.json.progress.ndjson', pass: 'retry-72b' },
  { file: 'rejudge-retry4-enrichment-run.json.progress.ndjson', pass: 'retry4-72b' },
];

function loadSubjects(): Map<string, SubjectMeta> {
  const path = join(cacheDir, 'rejudge-keeps-subjects-augmented.json');
  const fallback = join(cacheDir, 'rejudge-keeps-subjects.json');
  const file = existsSync(path) ? path : fallback;
  const data = JSON.parse(readFileSync(file, 'utf8')) as { subjects: readonly SubjectMeta[] };
  return new Map(data.subjects.map((s) => [s.subjectId, s]));
}

function loadRunItems(): Map<string, { decision: string; confidence: number; validationIssues: string[]; claims: unknown[] }> {
  const out = new Map<string, { decision: string; confidence: number; validationIssues: string[]; claims: unknown[] }>();
  const runFile = join(cacheDir, 'rejudge-merged-enrichment-run.json');
  if (!existsSync(runFile)) return out;
  const run = JSON.parse(readFileSync(runFile, 'utf8')) as {
    items: readonly { packet: { subjectId: string; decision: string; confidence: number; validationIssues: string[]; drafts: { claims?: unknown[] } }; error?: string }[];
  };
  for (const item of run.items) {
    out.set(item.packet.subjectId, {
      decision: item.error ? 'error' : item.packet.decision,
      confidence: item.packet.confidence,
      validationIssues: [...item.packet.validationIssues],
      claims: item.packet.drafts.claims ?? [],
    });
  }
  return out;
}

function evaluatePromoteEligible(
  subject: SubjectMeta | undefined,
  packet: { decision: string; confidence: number; validationIssues: string[]; claims: readonly { citationHref?: string; predicate?: string; object?: string; confidenceLevel?: string; citationSource?: string; citationLabel?: string }[] },
): boolean {
  if (packet.decision !== 'keep') return false;
  if (packet.confidence < AUTO_PROMOTE_CONFIDENCE_FLOOR) return false;
  if (packet.validationIssues.length > 0) return false;
  if (!subject || subject.kind === 'person') return false;
  if (!subject.jurisdictionLabel || !subject.locationLabel || !subject.locationPrecision) return false;
  if (packet.claims.length === 0) return false;
  for (const [index, claim] of packet.claims.entries()) {
    if (!claim.citationHref) return false;
    const sources: SourceForConfidence[] = [{ url: claim.citationHref, textContainsSubjectName: true }];
    if (subject.corroboratingSourceUrl && subject.corroboratingSourceUrl !== claim.citationHref) {
      sources.push({ url: subject.corroboratingSourceUrl, textContainsSubjectName: true });
    }
    const result = computeClaimConfidence(`${subject.subjectId}-claim-${index}`, sources);
    if (!result.passesPublishThreshold) return false;
  }
  const releaseClaims: ReleaseSourceClaim[] = packet.claims.map((claim) => ({
    predicate: claim.predicate ?? 'documented_site',
    object: claim.object ?? '',
    confidenceLevel:
      claim.confidenceLevel === 'high' || claim.confidenceLevel === 'medium' || claim.confidenceLevel === 'low'
        ? claim.confidenceLevel
        : 'medium',
    citationSource: claim.citationSource ?? new URL(claim.citationHref ?? 'https://unknown').hostname,
    citationHref: claim.citationHref,
    citationLabel: claim.citationLabel ?? claim.citationSource ?? 'Source',
  }));
  const entry: ReleaseSourceEntity = {
    id: subject.subjectId,
    kind: subject.kind ?? 'place',
    displayName: subject.title,
    summary: '',
    jurisdictionLabel: subject.jurisdictionLabel,
    locationPrecision: subject.locationPrecision,
    locationLabel: subject.locationLabel,
    lat: subject.lat ?? 0,
    lng: subject.lng ?? 0,
    claims: releaseClaims,
    mentionedEntityIds: [],
  };
  const build = buildReleaseEntityArtifacts(entry, {
    releaseId: 'auto-promotion-preview',
    generatedAt: new Date().toISOString(),
  });
  return build.ok;
}

function score(decision: string, confidence: number | null, hasError: boolean): number {
  if (hasError) return -1;
  if (decision === 'keep') return 100 + (confidence ?? 0) * 10;
  if (decision === 'needs_evidence') return 10 + (confidence ?? 0);
  return 0;
}

function readProgressFile(file: string, pass: string): readonly { raw: RawProgress; pass: string }[] {
  const path = join(cacheDir, file);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const raw = JSON.parse(line) as RawProgress & { kind?: string };
      return { raw, pass };
    });
}

function main(): void {
  const queue = (
    JSON.parse(readFileSync(join(cacheDir, 'rejudge-queue.json'), 'utf8')) as { ids: string[] }
  ).ids;
  const subjects = loadSubjects();
  const runById = loadRunItems();

  const bestById = new Map<string, { raw: RawProgress; pass: string }>();
  for (const source of SOURCE_FILES) {
    for (const entry of readProgressFile(source.file, source.pass)) {
      const id = entry.raw.subjectId;
      if (!id) continue;
      const prev = bestById.get(id);
      const prevScore = prev
        ? score(prev.raw.decision ?? '', prev.raw.confidence ?? null, !!prev.raw.error)
        : -999;
      const nextScore = score(entry.raw.decision ?? '', entry.raw.confidence ?? null, !!entry.raw.error);
      if (!prev || nextScore > prevScore) bestById.set(id, entry);
    }
  }

  const lines: CanonicalLine[] = [];
  let keeps = 0;
  let needsEvidence = 0;
  let errors = 0;
  let promoteEligible = 0;

  for (const [_index, id] of queue.entries()) {
    const subject = subjects.get(id);
    const best = bestById.get(id);
    const runPkt = runById.get(id);
    const decision = best?.raw.decision ?? runPkt?.decision ?? 'pending';
    const hasError = !!best?.raw.error || decision === 'error';
    if (hasError) errors += 1;
    else if (decision === 'keep') keeps += 1;
    else if (decision !== 'pending') needsEvidence += 1;

    const claims = (runPkt?.claims ?? []) as CanonicalLine extends never
      ? never
      : { citationHref?: string; predicate?: string; object?: string; confidenceLevel?: string; citationSource?: string; citationLabel?: string }[];
    const eligible =
      runPkt && subject
        ? evaluatePromoteEligible(subject, {
            decision: runPkt.decision,
            confidence: runPkt.confidence,
            validationIssues: runPkt.validationIssues,
            claims,
          })
        : false;
    if (eligible) promoteEligible += 1;

    const line: CanonicalLine = {
      id,
      displayName: best?.raw.title ?? subject?.title ?? id,
      model: best?.raw.modelId ?? 'unknown',
      decision,
      confidence: runPkt?.confidence ?? best?.raw.confidence ?? null,
      promoteEligible: eligible,
      pass: best?.pass ?? 'seed-pending',
      ...(best?.raw.error ? { error: best.raw.error } : {}),
      at: new Date().toISOString(),
    };
    lines.push(line);
  }

  writeFileSync(progressPath, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);

  const processed = lines.filter((l) => l.pass !== 'seed-pending' && l.decision !== 'pending').length;
  const pending = queue.length - processed;
  const lastFive = lines.filter((l) => l.decision !== 'pending').slice(-5);

  const md = `# DC keep rejudge — live status

Updated: ${new Date().toISOString()}

**Watch progress:** \`tail -f .cache/dc-enrichment/rejudge-progress.ndjson\`

## Totals (${processed}/${queue.length} seeded from prior passes)

| Metric | Count |
|---|---:|
| Queue | ${queue.length} |
| Seeded from prior passes | ${processed} |
| Pending one-by-one | ${pending} |
| Keeps (best per id) | ${keeps} |
| Needs evidence | ${needsEvidence} |
| Errors | ${errors} |
| Promote eligible | ${promoteEligible} |

## Models used in prior passes

1. \`z-ai/glm-4.5-air\` (pass1-glm) — JSON unreliable on many items
2. \`qwen/qwen3-32b\` (pass2-qwen3) — primary recovery pass (97 keeps)
3. \`qwen/qwen3.5-122b-a10b\` (pass3) — stalled at 2/100; resumed one-by-one

## What's next

- Continue **one-by-one** (\`concurrency 1\`) for remaining queue ids
- GLM first → qwen3-32b retry → qwen2.5-72b fallback on JSON fail
- Append each result to \`rejudge-progress.ndjson\`
- **Promote waves of 5** when auto-promote bar clears

## Last 5 seeded results

${lastFive.length === 0 ? '_No completed items yet._' : lastFive.map((r) => `- \`${r.id}\` **${r.displayName}** → ${r.decision} conf=${r.confidence ?? 'n/a'} model=\`${r.model}\` pass=${r.pass}${r.promoteEligible ? ' ✅ eligible' : ''}${r.error ? ` err=${r.error.slice(0, 60)}` : ''}`).join('\n')}
`;
  writeFileSync(statusPath, md);

  console.log(JSON.stringify({ progressPath, statusPath, lines: lines.length, processed, pending, keeps, promoteEligible }, null, 2));
}

main();
