/**
 * Public address lines for entity and place pages. The release projection carries location
 * honesty in `locationLabel` + `locationPrecision`; this module composes the reader-facing
 * address string and flags records that need enrichment.
 */
import { isDisplayableJurisdictionLabel } from '@repo/domain/map/geography';

export type PublicAddressInput = {
  readonly displayName?: string;
  readonly locationLabel: string;
  readonly jurisdictionLabel?: string;
  readonly locationPrecision: string;
  readonly kind: string;
};

const PLACE_LIKE_KINDS = new Set(['place', 'school', 'organization', 'institution', 'event']);

const WITHHELD_RE = /^(place withheld|unknown|location withheld)$/iu;

/** Parenthetical map notes stripped from reader-facing copy. */
const PRECISION_DISCLAIMER_RE = /\s*\([^)]*(?:pin|schematic)[^)]*\)\s*$/iu;

const CITY_ONLY_DISCLAIMER_RE = /\bno specific street address documented\b|\bcity-level pin\b/iu;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripPrecisionDisclaimer(label: string): string {
  return normalizeWhitespace(label.replace(PRECISION_DISCLAIMER_RE, ''));
}

function jurisdictionInLabel(label: string, jurisdiction: string): boolean {
  const labelLower = label.toLowerCase();
  for (const part of jurisdiction.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length > 0 && labelLower.includes(trimmed.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/** True when the label reads as withheld or intentionally non-specific. */
export function isWithheldPublicAddress(label: string): boolean {
  const trimmed = normalizeWhitespace(label);
  if (trimmed.length === 0) return true;
  if (WITHHELD_RE.test(trimmed)) return true;
  if (CITY_ONLY_DISCLAIMER_RE.test(trimmed)) return true;
  return false;
}

/**
 * Best public address string for display and maps handoff. Never invents street precision;
 * may compose display name + jurisdiction when the stored label is withheld.
 */
export function resolvePublicAddressLine(input: PublicAddressInput): string {
  const rawLabel = normalizeWhitespace(input.locationLabel);
  const label = stripPrecisionDisclaimer(rawLabel);
  const rawJurisdiction = input.jurisdictionLabel;
  const jurisdiction =
    rawJurisdiction !== undefined && isDisplayableJurisdictionLabel(rawJurisdiction)
      ? rawJurisdiction.trim()
      : undefined;
  const displayName = input.displayName?.trim();

  if (!isWithheldPublicAddress(label)) {
    if (jurisdiction) {
      if (label === jurisdiction || jurisdictionInLabel(label, jurisdiction)) {
        return label.length >= jurisdiction.length ? label : jurisdiction;
      }
      // Append jurisdiction whenever the label omits it (neighborhood, campus, street, city).
      return `${label}, ${jurisdiction}`;
    }
    return label;
  }

  if (displayName && jurisdiction) {
    return `${displayName}, ${jurisdiction}`;
  }
  if (jurisdiction) {
    return jurisdiction;
  }
  if (displayName) {
    return displayName;
  }
  return 'Place withheld';
}

export type PublicAddressAuditIssueKind =
  'withheld_label' | 'city_only_visitable' | 'empty_label' | 'generic_city_disclaimer';

export type PublicAddressAuditIssue = {
  readonly entityId: string;
  readonly displayName: string;
  readonly kind: string;
  readonly issue: PublicAddressAuditIssueKind;
  readonly locationLabel: string;
  readonly locationPrecision: string;
  readonly suggestedAction: string;
};

function isVisitableKind(kind: string): boolean {
  return PLACE_LIKE_KINDS.has(kind);
}

/**
 * Flags published records whose public address line is weaker than their kind and precision
 * suggest. Operators use this to queue locate / attach-evidence work.
 */
export function auditPublicAddressCoverage(
  entities: readonly PublicAddressInput[],
  entityIdFor: (entity: PublicAddressInput, index: number) => string = (_, index) =>
    `index-${index}`,
): readonly PublicAddressAuditIssue[] {
  const issues: PublicAddressAuditIssue[] = [];

  entities.forEach((entity, index) => {
    const entityId = entityIdFor(entity, index);
    const label = normalizeWhitespace(entity.locationLabel);
    const displayName = entity.displayName?.trim() ?? entityId;

    if (label.length === 0) {
      issues.push({
        entityId,
        displayName,
        kind: entity.kind,
        issue: 'empty_label',
        locationLabel: label,
        locationPrecision: entity.locationPrecision,
        suggestedAction: 'Add a sourced locationLabel at the finest supported public precision.',
      });
      return;
    }

    if (!isVisitableKind(entity.kind)) {
      return;
    }

    const resolved = resolvePublicAddressLine(entity);

    if (resolved === 'Place withheld' || isWithheldPublicAddress(label)) {
      issues.push({
        entityId,
        displayName,
        kind: entity.kind,
        issue: 'withheld_label',
        locationLabel: label,
        locationPrecision: entity.locationPrecision,
        suggestedAction:
          'Run locate / attach-evidence and publish institution or campus precision when sourced.',
      });
      return;
    }

    if (CITY_ONLY_DISCLAIMER_RE.test(label)) {
      issues.push({
        entityId,
        displayName,
        kind: entity.kind,
        issue: 'generic_city_disclaimer',
        locationLabel: label,
        locationPrecision: entity.locationPrecision,
        suggestedAction:
          'Replace city-level disclaimer with a sourced street or campus address when evidence allows.',
      });
      return;
    }

    if (
      entity.locationPrecision === 'city' &&
      (entity.kind === 'school' || entity.kind === 'institution' || entity.kind === 'organization')
    ) {
      issues.push({
        entityId,
        displayName,
        kind: entity.kind,
        issue: 'city_only_visitable',
        locationLabel: label,
        locationPrecision: entity.locationPrecision,
        suggestedAction:
          'Institution records should carry campus or institution precision when a visit address is documented.',
      });
    }
  });

  return issues;
}
