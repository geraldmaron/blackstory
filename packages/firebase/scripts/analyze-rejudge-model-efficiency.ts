/**
 * One-off analysis of DC rejudge artifacts: model efficiency for publishable keeps.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
const cacheDir = join(scriptDir, '../../../.cache/dc-enrichment');
const AUTO_PROMOTE_CONFIDENCE_FLOOR = 0.8;

/** OpenRouter public ballparks $/1M tokens (input/output avg blend, uncertain). */
const COST_BALLPARK: Record<string, number> = {
  'z-ai/glm-4.5-air': 0.15,
  'qwen/qwen3-32b': 0.08,
  'qwen/qwen-2.5-72b-instruct': 0.35,
  'qwen/qwen3.5-122b-a10b': 0.6,
  'qwen/qwen-2.5-7b-instruct': 0.03,
  unknown: 0.2,
};

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

type Judgment = {
  subjectId: string;
  model: string;
  decision: string;
  confidence: number;
  jsonError: boolean;
  promoteEligible: boolean;
  source: string;
  latencyMs?: number;
};

function loadSubjects(): Map<string, SubjectMeta> {
  const file = existsSync(join(cacheDir, 'rejudge-keeps-subjects-augmented.json'))
    ? join(cacheDir, 'rejudge-keeps-subjects-augmented.json')
    : join(cacheDir, 'rejudge-keeps-subjects.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as { subjects: readonly SubjectMeta[] };
  return new Map(data.subjects.map((s) => [s.subjectId, s]));
}

function isJsonError(decision: string, error?: string, validationIssues?: readonly string[]): boolean {
  if (error && /json|JSON|Unterminated|Unexpected end|double-quoted property|empty completion|timeout|SIGTERM/i.test(error)) {
    return true;
  }
  if (validationIssues?.some((v) => v.includes('completion_error'))) return true;
  if (decision === 'error') return true;
  return false;
}

function evaluatePromoteEligible(
  subject: SubjectMeta | undefined,
  packet: {
    decision: string;
    confidence: number;
    validationIssues: readonly string[];
    claims: readonly {
      citationHref?: string;
      predicate?: string;
      object?: string;
      confidenceLevel?: string;
      citationSource?: string;
      citationLabel?: string;
    }[];
    subjectId: string;
    subjectTitle?: string;
    publicSummary?: string;
    historicalContext?: string;
    topicIds?: readonly string[];
    eraBuckets?: readonly string[];
    keywords?: readonly string[];
  },
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
    const result = computeClaimConfidence(`${packet.subjectId}-claim-${index}`, sources);
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
  const normalizedDrafts = normalizeEnrichmentDrafts({
    publicSummary: packet.publicSummary,
    eraBuckets: packet.eraBuckets,
    topicIds: packet.topicIds,
  });
  const entry: ReleaseSourceEntity = {
    id: packet.subjectId,
    kind: subject.kind ?? 'place',
    displayName: packet.subjectTitle ?? subject.title,
    summary: normalizedDrafts.publicSummary ?? '',
    ...(normalizedDrafts.eraBuckets && normalizedDrafts.eraBuckets.length > 0
      ? { eraBuckets: normalizedDrafts.eraBuckets }
      : {}),
    ...(normalizedDrafts.topicIds && normalizedDrafts.topicIds.length > 0
      ? { topicTags: normalizedDrafts.topicIds, topicIds: normalizedDrafts.topicIds }
      : {}),
    mentionedEntityIds: [],
    ...(packet.keywords ? { keywords: packet.keywords } : {}),
    jurisdictionLabel: subject.jurisdictionLabel,
    locationPrecision: subject.locationPrecision,
    locationLabel: subject.locationLabel,
    lat: subject.lat ?? 0,
    lng: subject.lng ?? 0,
    claims: releaseClaims,
    ...(packet.historicalContext ? { historicalContext: packet.historicalContext } : {}),
  };
  const build = buildReleaseEntityArtifacts(entry, {
    releaseId: 'auto-promotion-preview',
    generatedAt: new Date().toISOString(),
  });
  return build.ok;
}

function ingestProgressNdjson(path: string, source: string, judgments: Judgment[], _subjects: Map<string, SubjectMeta>): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      const model = String(row.modelId ?? row.model ?? 'unknown');
      const subjectId = String(row.subjectId ?? row.id ?? '');
      if (!subjectId) continue;
      const decision = String(row.decision ?? 'unknown');
      const error = row.error ? String(row.error) : undefined;
      const jsonError = isJsonError(decision, error);
      const confidence = typeof row.confidence === 'number' ? row.confidence : 0;
      const promoteEligible =
        typeof row.promoteEligible === 'boolean'
          ? row.promoteEligible
          : false;
      judgments.push({
        subjectId,
        model,
        decision: jsonError ? 'json_error' : decision,
        confidence,
        jsonError,
        promoteEligible,
        source,
      });
    } catch {
      // skip
    }
  }
}

function ingestEnrichmentRun(path: string, source: string, judgments: Judgment[], subjects: Map<string, SubjectMeta>): void {
  if (!existsSync(path)) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return;
  }
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return;
  const run = { items } as {
    items: readonly {
      packet: {
        subjectId: string;
        subjectTitle?: string;
        decision: string;
        confidence: number;
        validationIssues: readonly string[];
        drafts: {
          claims?: readonly {
            citationHref?: string;
            predicate?: string;
            object?: string;
            confidenceLevel?: string;
            citationSource?: string;
            citationLabel?: string;
          }[];
          publicSummary?: string;
          historicalContext?: string;
          topicIds?: readonly string[];
          eraBuckets?: readonly string[];
          keywords?: readonly string[];
        };
        model?: { modelId?: string };
        createdAt?: string;
      };
      error?: string;
    }[];
  };
  for (const item of run.items) {
    const { packet } = item;
    const model = packet.model?.modelId ?? 'unknown';
    const jsonError = isJsonError(item.error ? 'error' : packet.decision, item.error, packet.validationIssues);
    const subject = subjects.get(packet.subjectId);
    const promoteEligible = evaluatePromoteEligible(subject, {
      decision: packet.decision,
      confidence: packet.confidence,
      validationIssues: packet.validationIssues,
      claims: packet.drafts.claims ?? [],
      subjectId: packet.subjectId,
      subjectTitle: packet.subjectTitle,
      publicSummary: packet.drafts.publicSummary,
      historicalContext: packet.drafts.historicalContext,
      topicIds: packet.drafts.topicIds,
      eraBuckets: packet.drafts.eraBuckets,
      keywords: packet.drafts.keywords,
    });
    judgments.push({
      subjectId: packet.subjectId,
      model,
      decision: jsonError ? 'json_error' : item.error ? 'error' : packet.decision,
      confidence: packet.confidence,
      jsonError,
      promoteEligible,
      source,
    });
  }
}

function ingestLogsForLatency(judgments: Judgment[]): void {
  const logPath = join(cacheDir, 'rejudge-multi-pass.log');
  if (!existsSync(logPath)) return;
  const text = readFileSync(logPath, 'utf8');
  const re = /\[(\d+(?:\.\d+)?)s\]\s+(\S+)\s+→\s+(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const latencyMs = Math.round(parseFloat(m[1]!) * 1000);
    const subjectId = m[2]!;
    for (const j of judgments) {
      if (j.subjectId === subjectId && j.latencyMs === undefined) j.latencyMs = latencyMs;
    }
  }
}

function main(): void {
  const subjects = loadSubjects();
  const judgments: Judgment[] = [];

  // Canonical progress with promote flags
  ingestProgressNdjson(join(cacheDir, 'rejudge-progress.ndjson'), 'rejudge-progress', judgments, subjects);

  // All progress streams
  for (const file of readdirSync(cacheDir, { recursive: true })) {
    if (typeof file !== 'string' || !file.endsWith('.progress.ndjson')) continue;
    ingestProgressNdjson(join(cacheDir, file), file, judgments, subjects);
  }

  // Full enrichment runs (richer promote computation)
  const runFiles = readdirSync(cacheDir).filter(
    (f) => f.endsWith('-enrichment-run.json') || f.endsWith('-run.json') || f === 'rejudge-merged-enrichment-run.json',
  );
  for (const file of runFiles) {
    if (file.includes('commit-summary')) continue;
    ingestEnrichmentRun(join(cacheDir, file), file, judgments, subjects);
  }
  for (const file of readdirSync(join(cacheDir, 'rejudge-one'))) {
    if (file.endsWith('-run.json')) {
      ingestEnrichmentRun(join(cacheDir, 'rejudge-one', file), `rejudge-one/${file}`, judgments, subjects);
    }
  }

  ingestLogsForLatency(judgments);

  // Dedupe: prefer enrichment-run over progress; latest source wins per subject+model
  const deduped = new Map<string, Judgment>();
  const sourcePriority = (s: string): number => {
    if (s.includes('-run.json')) return 3;
    if (s === 'rejudge-progress') return 2;
    return 1;
  };
  for (const j of judgments) {
    const key = `${j.subjectId}::${j.model}`;
    const existing = deduped.get(key);
    if (!existing || sourcePriority(j.source) >= sourcePriority(existing.source)) {
      deduped.set(key, j);
    }
  }
  const rows = [...deduped.values()];

  type Agg = {
    count: number;
    keep: number;
    needsEvidence: number;
    reject: number;
    jsonError: number;
    promoteEligible: number;
    confSum: number;
    keepCount: number;
    latencySum: number;
    latencyN: number;
  };
  const byModel = new Map<string, Agg>();
  for (const j of rows) {
    const agg = byModel.get(j.model) ?? {
      count: 0,
      keep: 0,
      needsEvidence: 0,
      reject: 0,
      jsonError: 0,
      promoteEligible: 0,
      confSum: 0,
      keepCount: 0,
      latencySum: 0,
      latencyN: 0,
    };
    agg.count += 1;
    if (j.decision === 'keep') {
      agg.keep += 1;
      agg.confSum += j.confidence;
      agg.keepCount += 1;
    } else if (j.decision === 'needs_evidence' || j.decision === 'json_error') agg.needsEvidence += 1;
    else if (j.decision === 'reject') agg.reject += 1;
    if (j.jsonError) agg.jsonError += 1;
    if (j.promoteEligible) agg.promoteEligible += 1;
    if (j.latencyMs !== undefined) {
      agg.latencySum += j.latencyMs;
      agg.latencyN += 1;
    }
    byModel.set(j.model, agg);
  }

  type RankRow = {
    model: string;
    count: number;
    keepPct: number;
    needsPct: number;
    jsonErrorPct: number;
    promotePct: number;
    avgKeepConf: number;
    costBallpark: number;
    efficiencyScore: number;
    avgLatencySec: number | null;
  };

  const ranked: RankRow[] = [];
  for (const [model, agg] of byModel.entries()) {
    if (model === 'unknown' || model === 'none') continue;
    const keepPct = (agg.keep / agg.count) * 100;
    const needsPct = (agg.needsEvidence / agg.count) * 100;
    const jsonErrorPct = (agg.jsonError / agg.count) * 100;
    const promotePct = (agg.promoteEligible / agg.count) * 100;
    const avgKeepConf = agg.keepCount > 0 ? agg.confSum / agg.keepCount : 0;
    const cost = COST_BALLPARK[model] ?? COST_BALLPARK.unknown!;
    // Efficiency: publishable keeps per relative cost; penalize JSON errors heavily
    const publishableRate = promotePct / 100;
    const reliability = 1 - jsonErrorPct / 100;
    const efficiencyScore = (publishableRate * reliability * 100) / cost;
    ranked.push({
      model,
      count: agg.count,
      keepPct: Math.round(keepPct * 10) / 10,
      needsPct: Math.round(needsPct * 10) / 10,
      jsonErrorPct: Math.round(jsonErrorPct * 10) / 10,
      promotePct: Math.round(promotePct * 10) / 10,
      avgKeepConf: Math.round(avgKeepConf * 1000) / 1000,
      costBallpark: cost,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100,
      avgLatencySec: agg.latencyN > 0 ? Math.round((agg.latencySum / agg.latencyN / 1000) * 10) / 10 : null,
    });
  }

  ranked.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const oneByOneDone = new Set<string>();
  for (const line of readFileSync(join(cacheDir, 'rejudge-progress.ndjson'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { id?: string; pass?: string; index?: number };
      if (row.pass === 'one-by-one' || row.index !== undefined) oneByOneDone.add(String(row.id));
    } catch {
      // skip
    }
  }
  const queue = (JSON.parse(readFileSync(join(cacheDir, 'rejudge-queue.json'), 'utf8')) as { ids: string[] }).ids;
  const remaining = queue.filter((id) => !oneByOneDone.has(id)).length;

  const recommendation = {
    primary: 'qwen/qwen3-32b',
    retry: 'qwen/qwen3-32b (same-model re-run on JSON/error)',
    avoid: ['qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-7b-instruct', 'z-ai/glm-4.5-air as primary/retry'],
    rationale:
      'Pass2 qwen3-32b: 91.5% keep, 4.7% JSON errors (~$0.08/1M). GLM pass1: 78.3% JSON fail. 72b retry: 31.2% JSON fail on 77 items. 122b n=2 only — thin-margin claim-conf escalation only. Zero promote-eligible across all passes (claim-confidence gate).',
    remainingAtStart: remaining,
  };

  const out = {
    ranked,
    recommendation,
    costNote: 'OpenRouter $/1M token ballparks — verify live pricing; used for relative scoring only.',
    totalJudgmentsDeduped: rows.length,
  };

  console.log(JSON.stringify(out, null, 2));
  writeFileSync(join(cacheDir, 'rejudge-model-efficiency-analysis.json'), `${JSON.stringify(out, null, 2)}\n`);
}

main();
