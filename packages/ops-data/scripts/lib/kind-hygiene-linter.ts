/**
 * Catalog kind-hygiene linter: person-as-event mismatches and duplicate topicTags.
 */
export type KindHygieneLintSeverity = 'error' | 'warn';

export type KindHygieneLintFinding = {
  readonly entityId: string;
  readonly severity: KindHygieneLintSeverity;
  readonly code: 'person_as_event' | 'duplicate_topic_tags' | 'duplicate_topic_ids';
  readonly message: string;
};

export type KindHygieneLintInput = {
  readonly entityId: string;
  readonly kind: string;
  readonly displayName?: string;
  readonly entityClass?: string | null;
  readonly livingStatus?: string;
  readonly topicTags?: readonly string[];
  readonly topicIds?: readonly string[];
};

export type KindHygieneLintReport = {
  readonly findings: readonly KindHygieneLintFinding[];
  readonly hasErrors: boolean;
};

const EVENT_SHAPED_NAME_RE =
  /\b(massacre|march|boycott|riot|uprising|founding|integration|lynching|massacre|protest|resistance|movement)\b/i;

/** Discovery ids ending in _q{digits} are usually Wikidata-backed person records. */
const DISC_PERSON_QID_RE = /^disc_[a-z0-9_]+_q\d+$/i;

function hasDuplicates(values: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key.length === 0) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (key.length === 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

export function lintKindHygiene(input: KindHygieneLintInput): KindHygieneLintReport {
  const findings: KindHygieneLintFinding[] = [];

  if (input.kind === 'event') {
    const looksLikePersonQid = DISC_PERSON_QID_RE.test(input.entityId);
    const nameLooksLikeEvent = EVENT_SHAPED_NAME_RE.test(input.displayName ?? '');
    const personLiving =
      input.livingStatus === 'living' ||
      input.livingStatus === 'deceased' ||
      input.entityClass === 'person';
    if ((looksLikePersonQid && !nameLooksLikeEvent) || personLiving) {
      findings.push({
        entityId: input.entityId,
        severity: 'error',
        code: 'person_as_event',
        message:
          'Entity is kind=event but matches person-shaped discovery or lifecycle signals.',
      });
    }
  }

  const topicTags = input.topicTags ?? [];
  if (topicTags.length > 0 && hasDuplicates(topicTags)) {
    findings.push({
      entityId: input.entityId,
      severity: 'error',
      code: 'duplicate_topic_tags',
      message: `Duplicate topicTags: ${duplicateValues(topicTags).join(', ')}`,
    });
  }

  const topicIds = input.topicIds ?? [];
  if (topicIds.length > 0 && hasDuplicates(topicIds)) {
    findings.push({
      entityId: input.entityId,
      severity: 'error',
      code: 'duplicate_topic_ids',
      message: `Duplicate topicIds: ${duplicateValues(topicIds).join(', ')}`,
    });
  }

  return {
    findings,
    hasErrors: findings.some((finding) => finding.severity === 'error'),
  };
}

export function mergeKindHygieneLintReports(
  reports: readonly KindHygieneLintReport[],
): KindHygieneLintReport {
  const findings = reports.flatMap((report) => report.findings);
  return {
    findings,
    hasErrors: findings.some((finding) => finding.severity === 'error'),
  };
}

export function kindHygieneLintFailureMessage(report: KindHygieneLintReport): string {
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  const sample = errors
    .slice(0, 5)
    .map((finding) => `${finding.entityId}: ${finding.message}`)
    .join('; ');
  return `Kind hygiene linter blocked ${errors.length} entity(ies): ${sample}`;
}
