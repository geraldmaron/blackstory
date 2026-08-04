/**
 * Publish-time status linter: hard errors for person deceased-lexicon vs living contradictions;
 * warnings when law summaries self-describe repeal/struck-down but status remains in_force.
 */
export type PublishStatusLintSeverity = 'error' | 'warn';

export type PublishStatusLintFinding = {
  readonly entityId: string;
  readonly severity: PublishStatusLintSeverity;
  readonly code: string;
  readonly message: string;
};

export type PublishStatusLintInput = {
  readonly entityId: string;
  readonly kind: string;
  readonly summary: string;
  readonly historicalContext?: string;
  readonly status?: string;
  readonly livingStatus?: string;
};

export type PublishStatusLintReport = {
  readonly findings: readonly PublishStatusLintFinding[];
  readonly hasErrors: boolean;
  readonly hasWarnings: boolean;
};

const DECEASED_LEXICON_RE =
  /\b(died|death|deceased|passed away|killed|assassinated|d\.\s*\d{4}|death date|hanged|executed|murdered|martyred|slain|posthumous(ly)?|buried at|laid to rest)\b/i;

const LYNCHING_DECEASED_RE = /\b(was\s+lynched|lynched\s+(on|in|by)|lynching\s+of)\b/i;

const LIFE_RANGE_RE = /\((1[6-9]\d{2})\s*[–—-]\s*(1[6-9]\d{2}|20[0-2]\d)\)/;

const LAW_SELF_DEMISE_RE = /\b(repealed|struck down|overturned|ruled unconstitutional|enjoined)\b/i;

function deceasedLexiconMatches(text: string): boolean {
  if (DECEASED_LEXICON_RE.test(text) || LYNCHING_DECEASED_RE.test(text)) return true;
  const match = LIFE_RANGE_RE.exec(text);
  if (!match?.[2]) return false;
  return Number(match[2]) <= new Date().getFullYear() - 2;
}

function combinedText(input: PublishStatusLintInput): string {
  return `${input.summary} ${input.historicalContext ?? ''}`.trim();
}

export function lintPublishStatus(input: PublishStatusLintInput): PublishStatusLintReport {
  const findings: PublishStatusLintFinding[] = [];
  const text = combinedText(input);

  if (input.kind === 'person') {
    const outgoingLiving =
      input.status === 'living' ||
      (input.status === undefined &&
        input.livingStatus !== 'deceased' &&
        input.livingStatus !== 'unknown');
    if (outgoingLiving && deceasedLexiconMatches(text)) {
      findings.push({
        entityId: input.entityId,
        severity: 'error',
        code: 'person_deceased_lexicon_vs_living',
        message:
          'Summary contains deceased lexicon but outgoing person status is living (or implied living).',
      });
    }
  }

  if ((input.kind === 'law' || input.kind === 'case') && input.status === 'in_force') {
    if (LAW_SELF_DEMISE_RE.test(text)) {
      findings.push({
        entityId: input.entityId,
        severity: 'warn',
        code: 'law_self_demise_vs_in_force',
        message:
          'Law summary describes repeal/struck-down/overturn language but outgoing status is in_force.',
      });
    }
  }

  return {
    findings,
    hasErrors: findings.some((finding) => finding.severity === 'error'),
    hasWarnings: findings.some((finding) => finding.severity === 'warn'),
  };
}

export function mergePublishStatusLintReports(
  reports: readonly PublishStatusLintReport[],
): PublishStatusLintReport {
  const findings = reports.flatMap((report) => report.findings);
  return {
    findings,
    hasErrors: findings.some((finding) => finding.severity === 'error'),
    hasWarnings: findings.some((finding) => finding.severity === 'warn'),
  };
}

export function publishStatusLintFailureMessage(report: PublishStatusLintReport): string {
  const errors = report.findings.filter((finding) => finding.severity === 'error');
  const sample = errors
    .slice(0, 5)
    .map((finding) => `${finding.entityId}: ${finding.message}`)
    .join('; ');
  return `Publish status linter blocked ${errors.length} entity(ies): ${sample}`;
}
