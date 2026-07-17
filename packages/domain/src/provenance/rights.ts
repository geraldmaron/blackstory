/**
 * Rights status and publication gates for evidence media and substantial excerpts (BB-016).
 * Constitution publicationRestrictions.requireRightsStatus drives the gate.
 */
import { loadProductConstitution } from '@black-book/schemas';

export const RIGHTS_STATUSES = [
  'unknown',
  'public_domain',
  'licensed',
  'fair_use',
  'restricted',
  'prohibited',
] as const;

export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

/** Rights statuses that may authorize publishing media or substantial excerpts. */
export const PUBLISHABLE_RIGHTS_STATUSES = [
  'public_domain',
  'licensed',
  'fair_use',
] as const satisfies readonly RightsStatus[];

export type PublishableRightsStatus = (typeof PUBLISHABLE_RIGHTS_STATUSES)[number];

export const PUBLICATION_PERMISSIONS = [
  'cite',
  'short_excerpt',
  'substantial_excerpt',
  'display_media',
  'redistribute',
] as const;

export type PublicationPermission = (typeof PUBLICATION_PERMISSIONS)[number];

export const PROHIBITED_USES = [
  'commercial_reuse',
  'full_text_republication',
  'biometric_extraction',
  'living_person_doxxing',
  'unattributed_reuse',
  'other',
] as const;

export type ProhibitedUse = (typeof PROHIBITED_USES)[number];

export type ExcerptKind = 'none' | 'short' | 'substantial';

export type PublicationContentKind = 'citation' | 'short_excerpt' | 'substantial_excerpt' | 'media';

export type RightsPolicy = {
  readonly defaultStatus: RightsStatus;
  readonly publicationPermissions: readonly PublicationPermission[];
  readonly prohibitedUses: readonly ProhibitedUse[];
};

export type RightsGateInput = {
  readonly rightsStatus: RightsStatus;
  readonly contentKind: PublicationContentKind;
  readonly publicationPermissions?: readonly PublicationPermission[];
  readonly prohibitedUses?: readonly ProhibitedUse[];
};

export function isRightsStatus(value: string): value is RightsStatus {
  return (RIGHTS_STATUSES as readonly string[]).includes(value);
}

export function isPublishableRightsStatus(status: RightsStatus): boolean {
  return (PUBLISHABLE_RIGHTS_STATUSES as readonly RightsStatus[]).includes(status);
}

/**
 * True when publishing this content kind requires an explicit non-unknown rights status.
 * Citation-only / short excerpts may proceed with unknown under constitution review;
 * media and substantial excerpts always require resolved rights.
 */
export function requiresResolvedRights(contentKind: PublicationContentKind): boolean {
  return contentKind === 'media' || contentKind === 'substantial_excerpt';
}

export function assertRightsStatusForPublication(input: RightsGateInput): void {
  const policy = loadProductConstitution();
  if (!policy.publicationRestrictions.requireRightsStatus) {
    return;
  }

  if (input.prohibitedUses?.includes('full_text_republication') && input.contentKind !== 'citation') {
    throw new Error('Publication blocked: prohibited use full_text_republication');
  }

  if (!requiresResolvedRights(input.contentKind)) {
    return;
  }

  if (input.rightsStatus === 'unknown' || input.rightsStatus === 'prohibited') {
    throw new Error(
      `Rights status "${input.rightsStatus}" cannot publish ${input.contentKind}; resolved rights required`,
    );
  }

  if (input.rightsStatus === 'restricted') {
    throw new Error(`Rights status "restricted" cannot publish ${input.contentKind}`);
  }

  if (!isPublishableRightsStatus(input.rightsStatus)) {
    throw new Error(`Rights status "${input.rightsStatus}" is not publishable for ${input.contentKind}`);
  }

  const needed: PublicationPermission =
    input.contentKind === 'media'
      ? 'display_media'
      : input.contentKind === 'substantial_excerpt'
        ? 'substantial_excerpt'
        : 'short_excerpt';

  if (input.publicationPermissions && !input.publicationPermissions.includes(needed)) {
    throw new Error(`Publication permission "${needed}" is not granted for this evidence`);
  }
}

export function canPublishWithRights(input: RightsGateInput): boolean {
  try {
    assertRightsStatusForPublication(input);
    return true;
  } catch {
    return false;
  }
}
