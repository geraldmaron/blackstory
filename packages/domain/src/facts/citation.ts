/**
 * `FactRecord.citations` shape: CSL-JSON (MIT-licensed schema,
 * rendered client-side via citation.js see `../facts/index.ts`'s module doc for the pointer)
 * plus a Black Book extension block. Deliberately a DIFFERENT, sibling type from
 * `../citations/citation.ts`'s `Citation` (the link-rot-management record keyed by
 * `claimId`): that type models one atomic claim's citation for link-health monitoring;
 * this type models one CSL-JSON bibliographic reference plus the Black Book fields a fact
 * citation must carry per spec. Both ultimately anchor to the same
 * `SourceCapture`/`archivedUrl` discipline, but this module does not import or re-export the
 * other's `Citation` a future adapter (mirroring `buildCitationFromEvidence`) can bridge them
 * if a caller needs both.
 *
 * Fail-closed rule: "unsourced" is not a publishable state. Every WEB citation
 * (`csl.URL` present) must carry `archivedUrl` + `archivedAt` (the archived-capture pointer,
 * ) and `accessedAt` (the retrieval date) before a fact may reach `published`/`corrected`
 * see `./publish-gate.ts` for the gate this type feeds.
 */

export const CITATION_SOURCE_CLASSES = ['primary', 'secondary', 'tertiary'] as const;
export type CitationSourceClass = (typeof CITATION_SOURCE_CLASSES)[number];

export const CITATION_ROLES = ['supports', 'contradicts', 'contextualizes'] as const;
export type CitationRole = (typeof CITATION_ROLES)[number];

/**
 * Minimal CSL-JSON bibliographic reference fields this registry actually consumes. Deliberately
 * NOT a full CSL-JSON schema port (that lives in the `csl-json` MIT schema itself, consumed by
 * citation.js at render time) — this is the subset Black Book stores and validates; any other
 * CSL-JSON field a caller wants to persist can ride along as an unchecked passthrough via
 * `Record<string, unknown>` widening at the storage boundary, outside this module's concern.
 */
export type CslJsonReference = {
  readonly id: string;
  /** CSL item type, e.g. "webpage", "book", "legal_case", "personal_communication". */
  readonly type: string;
  readonly title?: string;
  readonly author?: readonly {
    readonly family?: string;
    readonly given?: string;
    readonly literal?: string;
  }[];
  readonly issued?: {
    readonly 'date-parts'?: readonly (readonly number[])[];
    readonly raw?: string;
  };
  readonly URL?: string;
  readonly publisher?: string;
  readonly 'container-title'?: string;
};

/**
 * The Black Book extension block layered onto every CSL-JSON reference ('s field
 * list). `sourceClass`/`role` classify the citation's evidentiary weight and stance toward the
 * fact's statement; `excerpt` is the supporting passage (never left implicit); `documentId`
 * points into the primary-document store ( DocumentCloud-pending self-host + SHA-256
 * fallback) so hosting stays swappable.
 */
export type FactCitationExtension = {
  readonly sourceClass: CitationSourceClass;
  readonly role: CitationRole;
  readonly excerpt: string;
  readonly pageLocator?: string;
  readonly url?: string;
  readonly archivedUrl?: string;
  readonly archivedAt?: string;
  readonly accessedAt?: string;
  readonly documentId?: string;
  readonly sourceNote?: string;
};

export type FactCitation = {
  readonly csl: CslJsonReference;
} & FactCitationExtension;

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

/** A "web source" is any citation carrying a URL either on the CSL reference or the extension. */
export function isWebFactCitation(citation: FactCitation): boolean {
  return isNonEmpty(citation.csl.URL) || isNonEmpty(citation.url);
}

/**
 * Fail-closed structural validity for one fact citation. Every citation needs a
 * sourceClass, role, and non-empty excerpt. Web citations additionally require
 * `archivedUrl` + `archivedAt` (the archived-capture pointer) and `accessedAt` (the retrieval
 * date) "unsourced" (and, for a web source, "unarchived") is never a publishable state.
 */
export function assertFactCitationStructurallyComplete(citation: FactCitation): void {
  if (!isNonEmpty(citation.csl.id)) {
    throw new Error('Fact citation requires a non-empty csl.id');
  }
  if (!(CITATION_SOURCE_CLASSES as readonly string[]).includes(citation.sourceClass)) {
    throw new Error(`Unknown citation sourceClass "${citation.sourceClass}"`);
  }
  if (!(CITATION_ROLES as readonly string[]).includes(citation.role)) {
    throw new Error(`Unknown citation role "${citation.role}"`);
  }
  if (!isNonEmpty(citation.excerpt)) {
    throw new Error('Fact citation requires a non-empty excerpt (the supporting passage)');
  }
  if (isWebFactCitation(citation)) {
    if (
      !isNonEmpty(citation.archivedUrl) ||
      !isNonEmpty(citation.archivedAt) ||
      !isIsoDate(citation.archivedAt)
    ) {
      throw new Error(
        'Web fact citations require an archivedUrl and a valid ISO archivedAt ( capture pointer)',
      );
    }
    if (!isNonEmpty(citation.accessedAt) || !isIsoDate(citation.accessedAt)) {
      throw new Error('Web fact citations require a valid ISO accessedAt (retrieval date)');
    }
  } else if (!isNonEmpty(citation.accessedAt) || !isIsoDate(citation.accessedAt)) {
    throw new Error(
      'Fact citations require a valid ISO accessedAt (retrieval date), web or offline',
    );
  }
}

export function isFactCitationStructurallyComplete(citation: FactCitation): boolean {
  try {
    assertFactCitationStructurallyComplete(citation);
    return true;
  } catch {
    return false;
  }
}
