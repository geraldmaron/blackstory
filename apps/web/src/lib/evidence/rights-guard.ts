/**
 * Rights-limited excerpt and source-link resolution for the evidence interface:
 * source links do not leak private evidence or protected information.
 *
 * Reuses rights-status publication gate (`canPublishWithRights` from
 * `@repo/domain`) rather than re-implementing excerpt/media publication rules, and
 * additionally withholds any citation link explicitly flagged as resolving to private or
 * protected evidence (e.g. a living-person-sensitive capture, an internal-only source) even when
 * its rights status alone would otherwise permit citation.
 */
import { canPublishWithRights, type PublicationContentKind } from '@repo/domain';
import type {
  EvidenceCitationInput,
  EvidenceCitationView,
  EvidenceExcerptInput,
  EvidenceExcerptView,
} from './types';

function excerptContentKind(
  excerptKind: EvidenceExcerptInput['excerptKind'],
): PublicationContentKind {
  if (excerptKind === 'substantial') return 'substantial_excerpt';
  if (excerptKind === 'short') return 'short_excerpt';
  return 'citation';
}

/** Resolve whether an evidence excerpt may render publicly given its rights status, deferring to
 * constitution-driven gate rather than a locally-invented rule. */
export function resolveExcerptForDisplay(input: EvidenceExcerptInput): EvidenceExcerptView {
  const contentKind = excerptContentKind(input.excerptKind);
  const publishable = canPublishWithRights({
    rightsStatus: input.rightsStatus,
    contentKind,
    ...(input.publicationPermissions
      ? { publicationPermissions: input.publicationPermissions }
      : {}),
    ...(input.prohibitedUses ? { prohibitedUses: input.prohibitedUses } : {}),
  });

  if (!input.text.trim() || !publishable) {
    return {
      visible: false,
      reason: !input.text.trim()
        ? 'No excerpt is available for this claim yet.'
        : `Excerpt withheld: rights status "${input.rightsStatus}" does not permit publishing ` +
          `a ${input.excerptKind} excerpt.`,
    };
  }

  return { visible: true, text: input.text, excerptKind: input.excerptKind };
}

/** Resolve a citation for display, stripping any outbound link (and substituting an explicit
 * withheld notice) when the citation is flagged as resolving to protected or private evidence. */
export function resolveCitationForDisplay(input: EvidenceCitationInput): EvidenceCitationView {
  if (input.protectedFromPublicLink) {
    return {
      source: input.source,
      label: input.label,
      withheldReason:
        input.protectedReason ??
        'Source link withheld \u2014 this citation resolves to protected or private evidence ' +
          'that is not shown publicly.',
    };
  }

  return {
    source: input.source,
    label: input.label,
    ...(input.href ? { href: input.href } : {}),
  };
}
