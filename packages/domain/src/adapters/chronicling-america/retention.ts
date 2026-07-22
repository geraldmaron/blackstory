/**
 * Candidate retention rules for Chronicling America newspaper metadata.
 * Only qualifying bibliographic fields proceed toward discovery.
 */
import type {
  ChroniclingAmericaRejectedRecord,
  ChroniclingAmericaRetentionRules,
  RawChroniclingAmericaRecord,
} from './types.js';

function readString(raw: RawChroniclingAmericaRecord, field: string): string | undefined {
  const value = raw[field];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function qualifiesForCandidateRetention(
  raw: RawChroniclingAmericaRecord,
  rules: ChroniclingAmericaRetentionRules,
): { qualified: true } | { qualified: false; reason: string } {
  for (const field of rules.requiredFields) {
    if (!readString(raw, field)) {
      return { qualified: false, reason: `missing_required_field:${field}` };
    }
  }

  const title = readString(raw, 'title');
  if (!title || title.length < rules.minTitleLength) {
    return { qualified: false, reason: 'title_too_short' };
  }

  const classification = readString(raw, 'classification');
  if (classification && !rules.allowedClassifications.includes(classification)) {
    return { qualified: false, reason: 'classification_not_allowed' };
  }

  if (rules.requireCanonicalUrl && !readString(raw, 'canonicalUrl')) {
    return { qualified: false, reason: 'missing_canonical_url' };
  }

  return { qualified: true };
}

export function partitionByRetention(
  records: readonly RawChroniclingAmericaRecord[],
  rules: ChroniclingAmericaRetentionRules,
): {
  readonly qualified: readonly RawChroniclingAmericaRecord[];
  readonly rejected: readonly ChroniclingAmericaRejectedRecord[];
} {
  const qualified: RawChroniclingAmericaRecord[] = [];
  const rejected: ChroniclingAmericaRejectedRecord[] = [];

  for (const record of records) {
    const stableIdentifier =
      readString(record, 'stableIdentifier') ?? readString(record, 'id') ?? 'unknown';
    const gate = qualifiesForCandidateRetention(record, rules);
    if (gate.qualified) {
      qualified.push(record);
    } else {
      rejected.push({ stableIdentifier, reason: gate.reason });
    }
  }

  return { qualified, rejected };
}
