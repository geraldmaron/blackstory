
/**
 * Defines submission-quarantine schemas, validation, normalization, spam scoring,
 * campaign detection, privacy metadata, and immutable audit records.
 */
import { createHash, randomUUID } from 'node:crypto';

export const SUBMISSION_QUARANTINE_POLICY_VERSION = '1.0.0' as const;

export type SubmissionKind = 'correction' | 'contribution' | 'abuse_report';
export type SubmissionInboxState = 'accepted' | 'rejected';
export type SubmissionModerationState =
  'pending_review' | 'flagged' | 'duplicate' | 'coordinated_campaign' | 'blocked' | 'resolved';

export type SubmissionInput = {
  readonly kind: SubmissionKind;
  readonly title: string;
  readonly statement: string;
  readonly sourceUrls: readonly string[];
  readonly targetRecordId?: string;
  readonly submitterContact?: string;
};

export type NormalizedSubmission = {
  readonly kind: SubmissionKind;
  readonly title: string;
  readonly statement: string;
  readonly sourceUrls: readonly string[];
  readonly targetRecordId?: string;
};

export type SubmissionValidationReason =
  | 'schema_invalid'
  | 'oversized'
  | 'title_invalid'
  | 'statement_invalid'
  | 'characters_invalid'
  | 'too_many_links'
  | 'source_url_invalid'
  | 'frequency_exceeded';

export type SubmissionValidationIssue = {
  readonly reason: SubmissionValidationReason;
  readonly field: string;
  readonly message: string;
};

export type SubmissionValidationLimits = {
  readonly maxBytes: number;
  readonly maxTitleCharacters: number;
  readonly maxStatementCharacters: number;
  readonly maxTargetRecordIdCharacters: number;
  readonly maxContactCharacters: number;
  readonly maxSourceUrls: number;
  readonly maxTotalLinks: number;
  readonly maxUrlCharacters: number;
  readonly maxSubmissionsPerWindow: number;
  readonly frequencyWindowMs: number;
};

export const DEFAULT_SUBMISSION_VALIDATION_LIMITS: SubmissionValidationLimits = {
  maxBytes: 16_384,
  maxTitleCharacters: 200,
  maxStatementCharacters: 6_000,
  maxTargetRecordIdCharacters: 128,
  maxContactCharacters: 320,
  maxSourceUrls: 8,
  maxTotalLinks: 10,
  maxUrlCharacters: 2_048,
  maxSubmissionsPerWindow: 8,
  frequencyWindowMs: 3_600_000,
};

export type SubmissionValidationOptions = {
  readonly limits?: Partial<SubmissionValidationLimits>;
  readonly nowMs?: number;
  readonly recentSubmissionTimestamps?: readonly number[];
};

export type SubmissionValidationResult =
  | {
      readonly valid: true;
      readonly input: SubmissionInput;
      readonly normalized: NormalizedSubmission;
    }
  | {
      readonly valid: false;
      readonly issues: readonly SubmissionValidationIssue[];
    };

export type SpamSignal =
  | 'link_density'
  | 'repeated_characters'
  | 'excessive_uppercase'
  | 'duplicate_phrases'
  | 'suspicious_phrase'
  | 'low_information';

export type SpamAssessment = {
  readonly score: number;
  readonly signals: readonly SpamSignal[];
  readonly shouldFlag: boolean;
  readonly policyVersion: typeof SUBMISSION_QUARANTINE_POLICY_VERSION;
};

export type SubmissionPrivacy = {
  readonly accessClass: 'restricted_submission';
  readonly contactPresent: boolean;
  readonly contactDigest?: string;
  readonly submitterToken?: string;
  readonly networkToken?: string;
  readonly retainedUntil: string;
  readonly excludeFromTraining: true;
};

export type SubmissionCampaignAssessment = {
  readonly duplicateOf: readonly string[];
  readonly campaignId?: string;
  readonly coordinated: boolean;
  readonly signals: readonly (
    'content_duplicate' | 'shared_sources' | 'actor_cluster' | 'network_cluster'
  )[];
};

export type SubmissionOriginal = {
  readonly payload: SubmissionInput;
  readonly contentHash: string;
  readonly receivedAt: string;
};

export type QuarantinedSubmissionRecord = {
  readonly id: string;
  readonly original: SubmissionOriginal;
  readonly normalized: NormalizedSubmission;
  readonly privacy: SubmissionPrivacy;
  readonly spam: SpamAssessment;
  readonly campaign: SubmissionCampaignAssessment;
  readonly inboxState: 'accepted';
  readonly moderationState: SubmissionModerationState;
  readonly createdAt: string;
  readonly policyVersion: typeof SUBMISSION_QUARANTINE_POLICY_VERSION;
  readonly destination: 'submission_quarantine';
  readonly canonicalWriteAllowed: false;
};

export type RejectedSubmission = {
  readonly inboxState: 'rejected';
  readonly issues: readonly SubmissionValidationIssue[];
  readonly policyVersion: typeof SUBMISSION_QUARANTINE_POLICY_VERSION;
};

export type SubmissionIntakeResult =
  | { readonly accepted: true; readonly record: QuarantinedSubmissionRecord }
  | { readonly accepted: false; readonly rejection: RejectedSubmission };

export type CampaignObservation = {
  readonly submissionId: string;
  readonly observedAtMs: number;
  readonly contentFingerprint: string;
  readonly sourceFingerprint: string;
  readonly submitterToken?: string;
  readonly networkToken?: string;
};

export type CampaignDetectorOptions = {
  readonly windowMs?: number;
  readonly coordinatedActorThreshold?: number;
  readonly coordinatedNetworkThreshold?: number;
  readonly maxObservations?: number;
};

export type SubmissionIntakeContext = {
  readonly receivedAtMs?: number;
  readonly submitterToken?: string;
  readonly networkToken?: string;
  readonly privacyPepper: string;
  readonly retentionDays?: number;
  readonly recentSubmissionTimestamps?: readonly number[];
};

const ALLOWED_KEYS = new Set([
  'kind',
  'title',
  'statement',
  'sourceUrls',
  'targetRecordId',
  'submitterContact',
]);
const SUBMISSION_KINDS = new Set<SubmissionKind>(['correction', 'contribution', 'abuse_report']);
const BIDI_CONTROL_CHARACTERS = /[\u202A-\u202E\u2066-\u2069]/u;
const INLINE_URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+/giu;

function containsProhibitedCharacters(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint !== undefined &&
      ((codePoint >= 0 && codePoint <= 8) ||
        codePoint === 11 ||
        codePoint === 12 ||
        (codePoint >= 14 && codePoint <= 31) ||
        codePoint === 127)
    ) {
      return true;
    }
  }
  return BIDI_CONTROL_CHARACTERS.test(value);
}

function mergedLimits(
  limits: Partial<SubmissionValidationLimits> | undefined,
): SubmissionValidationLimits {
  return { ...DEFAULT_SUBMISSION_VALIDATION_LIMITS, ...limits };
}

function issue(
  reason: SubmissionValidationReason,
  field: string,
  message: string,
): SubmissionValidationIssue {
  return { reason, field, message };
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/gu, '\n')
    .replace(/[ \t]+/gu, ' ')
    .trim();
}

function parseSubmission(value: unknown): SubmissionInput | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !ALLOWED_KEYS.has(key))) {
    return undefined;
  }
  if (
    typeof candidate.kind !== 'string' ||
    !SUBMISSION_KINDS.has(candidate.kind as SubmissionKind) ||
    typeof candidate.title !== 'string' ||
    typeof candidate.statement !== 'string' ||
    !Array.isArray(candidate.sourceUrls) ||
    !candidate.sourceUrls.every((url) => typeof url === 'string') ||
    (candidate.targetRecordId !== undefined && typeof candidate.targetRecordId !== 'string') ||
    (candidate.submitterContact !== undefined && typeof candidate.submitterContact !== 'string')
  ) {
    return undefined;
  }
  return {
    kind: candidate.kind as SubmissionKind,
    title: candidate.title,
    statement: candidate.statement,
    sourceUrls: candidate.sourceUrls as string[],
    ...(candidate.targetRecordId !== undefined
      ? { targetRecordId: candidate.targetRecordId as string }
      : {}),
    ...(candidate.submitterContact !== undefined
      ? { submitterContact: candidate.submitterContact as string }
      : {}),
  };
}

function normalizeUrl(rawUrl: string): string | undefined {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return undefined;
    }
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return undefined;
  }
}

export function validateAndNormalizeSubmission(
  value: unknown,
  options: SubmissionValidationOptions = {},
): SubmissionValidationResult {
  const limits = mergedLimits(options.limits);
  const input = parseSubmission(value);
  if (!input) {
    return {
      valid: false,
      issues: [issue('schema_invalid', '$', 'Submission does not match the approved schema.')],
    };
  }

  const issues: SubmissionValidationIssue[] = [];
  const encodedBytes = Buffer.byteLength(JSON.stringify(input), 'utf8');
  if (encodedBytes > limits.maxBytes) {
    issues.push(issue('oversized', '$', 'Submission exceeds the maximum encoded size.'));
  }

  const title = normalizeText(input.title);
  const statement = normalizeText(input.statement);
  const targetRecordId = input.targetRecordId ? normalizeText(input.targetRecordId) : undefined;
  if (title.length < 3 || title.length > limits.maxTitleCharacters) {
    issues.push(issue('title_invalid', 'title', 'Title length is outside the accepted range.'));
  }
  if (statement.length < 20 || statement.length > limits.maxStatementCharacters) {
    issues.push(
      issue('statement_invalid', 'statement', 'Statement length is outside the accepted range.'),
    );
  }
  if (
    input.targetRecordId !== undefined &&
    (targetRecordId === undefined ||
      targetRecordId.length < 1 ||
      targetRecordId.length > limits.maxTargetRecordIdCharacters)
  ) {
    issues.push(
      issue('schema_invalid', 'targetRecordId', 'Target record identifier is outside policy.'),
    );
  }
  if (
    input.submitterContact !== undefined &&
    (input.submitterContact.length > limits.maxContactCharacters ||
      containsProhibitedCharacters(input.submitterContact))
  ) {
    issues.push(
      issue('characters_invalid', 'submitterContact', 'Submitter contact is outside policy.'),
    );
  }
  if (
    containsProhibitedCharacters(input.title) ||
    containsProhibitedCharacters(input.statement) ||
    (input.targetRecordId !== undefined && containsProhibitedCharacters(input.targetRecordId))
  ) {
    issues.push(
      issue('characters_invalid', '$', 'Submission contains prohibited control characters.'),
    );
  }

  const normalizedSourceUrls: string[] = [];
  if (input.kind !== 'abuse_report' && input.sourceUrls.length === 0) {
    issues.push(
      issue('source_url_invalid', 'sourceUrls', 'At least one HTTPS source URL is required.'),
    );
  }
  if (input.sourceUrls.length > limits.maxSourceUrls) {
    issues.push(issue('too_many_links', 'sourceUrls', 'Too many source URLs were supplied.'));
  }
  for (const sourceUrl of input.sourceUrls) {
    const normalized = normalizeUrl(sourceUrl);
    if (
      sourceUrl.length > limits.maxUrlCharacters ||
      containsProhibitedCharacters(sourceUrl) ||
      !normalized
    ) {
      issues.push(
        issue('source_url_invalid', 'sourceUrls', 'Source URLs must be valid public HTTPS URLs.'),
      );
      continue;
    }
    if (!normalizedSourceUrls.includes(normalized)) {
      normalizedSourceUrls.push(normalized);
    }
  }

  const inlineLinkCount = statement.match(INLINE_URL_PATTERN)?.length ?? 0;
  if (inlineLinkCount + normalizedSourceUrls.length > limits.maxTotalLinks) {
    issues.push(issue('too_many_links', '$', 'Submission contains too many links.'));
  }

  const nowMs = options.nowMs ?? Date.now();
  const recentCount = (options.recentSubmissionTimestamps ?? []).filter(
    (timestamp) => timestamp <= nowMs && nowMs - timestamp < limits.frequencyWindowMs,
  ).length;
  if (recentCount >= limits.maxSubmissionsPerWindow) {
    issues.push(
      issue('frequency_exceeded', '$', 'Submission frequency exceeds the intake policy.'),
    );
  }

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    input,
    normalized: {
      kind: input.kind,
      title,
      statement,
      sourceUrls: normalizedSourceUrls.sort(),
      ...(targetRecordId ? { targetRecordId } : {}),
    },
  };
}

export function scoreSubmissionSpam(submission: NormalizedSubmission): SpamAssessment {
  const combined = `${submission.title}\n${submission.statement}`;
  const words = combined.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const uniqueWords = new Set(words);
  const signals = new Set<SpamSignal>();
  let score = 0;

  if (submission.sourceUrls.length >= 5 || (combined.match(INLINE_URL_PATTERN)?.length ?? 0) >= 4) {
    signals.add('link_density');
    score += 35;
  }
  if (/(.)\1{7,}/u.test(combined)) {
    signals.add('repeated_characters');
    score += 20;
  }
  const letters = combined.match(/\p{L}/gu) ?? [];
  const uppercase = combined.match(/\p{Lu}/gu) ?? [];
  if (letters.length >= 30 && uppercase.length / letters.length > 0.65) {
    signals.add('excessive_uppercase');
    score += 15;
  }
  const trigrams = words.slice(0, -2).map((_, index) => words.slice(index, index + 3).join(' '));
  if (new Set(trigrams).size < trigrams.length * 0.65) {
    signals.add('duplicate_phrases');
    score += 20;
  }
  if (
    /\b(?:buy now|guaranteed profit|crypto giveaway|seo services|click here)\b/iu.test(combined)
  ) {
    signals.add('suspicious_phrase');
    score += 35;
  }
  if (words.length >= 12 && uniqueWords.size / words.length < 0.3) {
    signals.add('low_information');
    score += 20;
  }

  const boundedScore = Math.min(100, score);
  return {
    score: boundedScore,
    signals: [...signals],
    shouldFlag: boundedScore >= 40,
    policyVersion: SUBMISSION_QUARANTINE_POLICY_VERSION,
  };
}

export function fingerprintSubmission(submission: NormalizedSubmission): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind: submission.kind,
        title: submission.title.toLocaleLowerCase('en-US'),
        statement: submission.statement.toLocaleLowerCase('en-US'),
        sourceUrls: submission.sourceUrls,
        targetRecordId: submission.targetRecordId ?? null,
      }),
    )
    .digest('hex');
}

function fingerprintSources(sourceUrls: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...sourceUrls].sort()))
    .digest('hex');
}

export function createSubmissionCampaignDetector(options: CampaignDetectorOptions = {}) {
  const windowMs = options.windowMs ?? 86_400_000;
  const actorThreshold = options.coordinatedActorThreshold ?? 3;
  const networkThreshold = options.coordinatedNetworkThreshold ?? 3;
  const maxObservations = options.maxObservations ?? 10_000;
  const observations: CampaignObservation[] = [];

  function prune(nowMs: number): void {
    while (observations.length > 0 && nowMs - observations[0]!.observedAtMs > windowMs) {
      observations.shift();
    }
    if (observations.length > maxObservations) {
      observations.splice(0, observations.length - maxObservations);
    }
  }

  return {
    assess(
      submissionId: string,
      submission: NormalizedSubmission,
      context: Pick<SubmissionIntakeContext, 'submitterToken' | 'networkToken'>,
      nowMs: number,
    ): SubmissionCampaignAssessment {
      prune(nowMs);
      const contentFingerprint = fingerprintSubmission(submission);
      const sourceFingerprint = fingerprintSources(submission.sourceUrls);
      const duplicates = observations.filter(
        (observation) => observation.contentFingerprint === contentFingerprint,
      );
      const related = observations.filter(
        (observation) =>
          submission.sourceUrls.length > 0 && observation.sourceFingerprint === sourceFingerprint,
      );
      const actorTokens = new Set(
        [
          context.submitterToken,
          ...related.map((observation) => observation.submitterToken),
        ].filter((token): token is string => Boolean(token)),
      );
      const networkTokens = new Set(
        [context.networkToken, ...related.map((observation) => observation.networkToken)].filter(
          (token): token is string => Boolean(token),
        ),
      );
      const coordinated =
        actorTokens.size >= actorThreshold ||
        (related.length + 1 >= networkThreshold &&
          networkTokens.size === 1 &&
          networkTokens.size > 0);
      const signals: SubmissionCampaignAssessment['signals'][number][] = [];
      if (duplicates.length > 0) signals.push('content_duplicate');
      if (related.length > 0) signals.push('shared_sources');
      if (actorTokens.size >= actorThreshold) signals.push('actor_cluster');
      if (coordinated && networkTokens.size === 1) signals.push('network_cluster');

      observations.push({
        submissionId,
        observedAtMs: nowMs,
        contentFingerprint,
        sourceFingerprint,
        ...(context.submitterToken ? { submitterToken: context.submitterToken } : {}),
        ...(context.networkToken ? { networkToken: context.networkToken } : {}),
      });
      prune(nowMs);

      return {
        duplicateOf: duplicates.map((observation) => observation.submissionId),
        ...(coordinated
          ? {
              campaignId: createHash('sha256')
                .update(`${sourceFingerprint}:${Math.floor(nowMs / windowMs)}`)
                .digest('hex')
                .slice(0, 24),
            }
          : {}),
        coordinated,
        signals,
      };
    },
    size(): number {
      return observations.length;
    },
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function digestPrivateValue(value: string, pepper: string): string {
  return createHash('sha256')
    .update(`${pepper}\u0000${value.normalize('NFKC')}`)
    .digest('hex');
}

export function createQuarantinedSubmission(
  value: unknown,
  context: SubmissionIntakeContext,
  detector = createSubmissionCampaignDetector(),
): SubmissionIntakeResult {
  const nowMs = context.receivedAtMs ?? Date.now();
  const validation = validateAndNormalizeSubmission(value, {
    nowMs,
    ...(context.recentSubmissionTimestamps
      ? { recentSubmissionTimestamps: context.recentSubmissionTimestamps }
      : {}),
  });
  if (!validation.valid) {
    return {
      accepted: false,
      rejection: deepFreeze({
        inboxState: 'rejected',
        issues: validation.issues,
        policyVersion: SUBMISSION_QUARANTINE_POLICY_VERSION,
      }),
    };
  }

  const id = randomUUID();
  const timestamp = new Date(nowMs).toISOString();
  const originalPayload = structuredClone(validation.input);
  const originalHash = createHash('sha256').update(JSON.stringify(originalPayload)).digest('hex');
  const campaign = detector.assess(id, validation.normalized, context, nowMs);
  const spam = scoreSubmissionSpam(validation.normalized);
  const retentionDays = context.retentionDays ?? 365;
  const moderationState: SubmissionModerationState = campaign.coordinated
    ? 'coordinated_campaign'
    : campaign.duplicateOf.length > 0
      ? 'duplicate'
      : spam.shouldFlag
        ? 'flagged'
        : 'pending_review';

  return {
    accepted: true,
    record: deepFreeze({
      id,
      original: {
        payload: originalPayload,
        contentHash: originalHash,
        receivedAt: timestamp,
      },
      normalized: structuredClone(validation.normalized),
      privacy: {
        accessClass: 'restricted_submission',
        contactPresent: Boolean(validation.input.submitterContact),
        ...(validation.input.submitterContact
          ? {
              contactDigest: digestPrivateValue(
                validation.input.submitterContact,
                context.privacyPepper,
              ),
            }
          : {}),
        ...(context.submitterToken ? { submitterToken: context.submitterToken } : {}),
        ...(context.networkToken ? { networkToken: context.networkToken } : {}),
        retainedUntil: new Date(nowMs + retentionDays * 86_400_000).toISOString(),
        excludeFromTraining: true,
      },
      spam,
      campaign,
      inboxState: 'accepted',
      moderationState,
      createdAt: timestamp,
      policyVersion: SUBMISSION_QUARANTINE_POLICY_VERSION,
      destination: 'submission_quarantine',
      canonicalWriteAllowed: false,
    }),
  };
}

export function verifyOriginalIntegrity(record: QuarantinedSubmissionRecord): boolean {
  const actual = createHash('sha256').update(JSON.stringify(record.original.payload)).digest('hex');
  return actual === record.original.contentHash;
}
