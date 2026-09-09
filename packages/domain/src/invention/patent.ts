/**
 * Patents as structured receipts.
 *
 * A patent is not an entity in the public graph. Making every patent a record would fill the
 * catalog with documents nobody is looking for, and would quietly turn "this document exists"
 * into "this person invented this thing" — the exact slide this whole model is built to stop.
 *
 * What a patent IS, is the best available evidence for a narrow set of facts: who filed, what
 * they claimed, when, and to whom it was assigned. It is not evidence that the filer was Black,
 * that the device sold, that it mattered, or that nobody got there first. `assessSourceFitness`
 * in @repo/domain-core/claims/source-fitness holds that table; this module holds the record.
 *
 * INVENTOR NAMES ARE STORED AS PUBLISHED. "Jan E. Matzeliger" on the face of a patent is a
 * historical fact about the document, and normalizing it away loses the evidence. Resolution to
 * a canonical person is a separate, reversible act with its own confidence — and `unresolved`
 * is a legitimate resting state, not a null waiting to be guessed at.
 */

/** Where a patent office record came from. A mirror is not a second source. */
export const PATENT_SOURCE_SYSTEMS = [
  'uspto',
  'nara',
  'google_patents_mirror',
  'other_verified',
] as const;
export type PatentSourceSystem = (typeof PATENT_SOURCE_SYSTEMS)[number];

/**
 * How a named inventor on a patent relates to a canonical person.
 *
 * `unresolved` is the honest state for a name the catalog has not matched to a person, and it
 * must survive: a patent naming four inventors of whom one is in the catalog still names four.
 * `not_in_scope` marks a real person deliberately not modeled — a co-inventor outside the
 * catalog's subject matter, who must still appear so the attribution stays truthful.
 */
export const INVENTOR_RESOLUTION_STATES = ['resolved', 'unresolved', 'not_in_scope'] as const;
export type InventorResolutionState = (typeof INVENTOR_RESOLUTION_STATES)[number];

export type PatentInventorAssociation = {
  /** Exactly as the patent publishes it, including initials, spelling and any error. */
  readonly nameAsPublished: string;
  readonly resolution: InventorResolutionState;
  /** Set only when resolution is 'resolved'. */
  readonly canonicalEntityId?: string;
  /** Position on the patent, 1-based, where the document gives an order. */
  readonly order?: number;
  /** Residence as printed on the patent. Evidence of an address at filing, NOT of where the work happened. */
  readonly residenceAsPublished?: string;
};

export type CanonicalPatent = {
  readonly id: string;
  /** ISO 3166-1 alpha-2, or a historical office code. */
  readonly jurisdiction: string;
  /**
   * As granted, without leading zeros or kind code. Design, reissue, plant and X-patents keep
   * their series letter because it is part of the number: D7 is not patent 7.
   */
  readonly patentNumber: string;
  readonly applicationNumber?: string;
  readonly publicationNumber?: string;
  /** The title as the document gives it. Period titles frequently say "Improvement in ..."; keep that. */
  readonly title: string;
  readonly filingDate?: string;
  readonly grantDate?: string;
  readonly priorityDate?: string;
  readonly inventors: readonly PatentInventorAssociation[];
  readonly assigneeNamesAsPublished?: readonly string[];
  /** The SourceItem this record was read from. */
  readonly canonicalSourceItemId: string;
  /** The durable capture, where one is held. */
  readonly captureId?: string;
  readonly sourceSystem: PatentSourceSystem;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

/** How a patent relates to the invention it documents. One invention can have several. */
export const INVENTION_PATENT_RELATIONS = [
  /** The patent that documents the contribution the record is about. */
  'core',
  'improvement',
  'related',
  'continuation',
  'design',
  'process',
  'apparatus',
] as const;
export type InventionPatentRelation = (typeof INVENTION_PATENT_RELATIONS)[number];

export type InventionPatentLink = {
  readonly inventionEntityId: string;
  readonly patentId: string;
  readonly relation: InventionPatentRelation;
  /** Why this patent is attached to this invention, in a sentence. */
  readonly note?: string;
};

/**
 * Whether an invention's intellectual-property situation is known, and what it is.
 *
 * `unpatented` and `documented_without_patent` are distinct: the first says a patent was never
 * obtained, the second says the innovation is attested by other records and the patent question
 * may not even apply. Both are ordinary states. Neither is a gap to be filled.
 */
export const IP_STATUSES = [
  'patented',
  'patent_pending',
  'unpatented',
  'documented_without_patent',
  'trade_secret_or_proprietary',
  'unknown',
] as const;
export type IntellectualPropertyStatus = (typeof IP_STATUSES)[number];

export type InventionFields = {
  readonly ipStatus: IntellectualPropertyStatus;
  /**
   * The contribution in one bounded sentence, written to the evidence rather than to the
   * category. "An improved process for manufacturing carbon conductors used in incandescent
   * lamps", not "the light bulb".
   */
  readonly contributionDescriptor?: string;
  readonly patents?: readonly InventionPatentLink[];
};

const PATENT_NUMBER_PATTERN = /^(D|RE|PP|X|H|T)?(\d{1,9})$/u;

/**
 * Normalize a patent number to its identity.
 *
 * Leading zeros, comma grouping, the country prefix and the kind code are how a number was
 * written down, not which document it is. This is the same normalization
 * `resolveSourceLineage` uses, so a patent cited two ways lands on one lineage.
 */
export function normalizePatentNumber(raw: string): string | undefined {
  const cleaned = raw.toUpperCase().replace(/[,\s_-]/gu, '');
  const withoutCountry = cleaned.replace(/^US/u, '');
  const withoutKind = withoutCountry.replace(/(?<=\d)[A-Z]\d?$/u, '');
  const match = PATENT_NUMBER_PATTERN.exec(withoutKind.replace(/^(D|RE|PP|X|H|T)?0+/u, '$1'));
  if (match === null) return undefined;
  return `${match[1] ?? ''}${match[2]}`;
}

/** A stable id for a patent, so the same document read twice is one record. */
export function patentIdFor(jurisdiction: string, patentNumber: string): string | undefined {
  const normalized = normalizePatentNumber(patentNumber);
  if (normalized === undefined) return undefined;
  return `pat_${jurisdiction.toLowerCase()}_${normalized.toLowerCase()}`;
}

/** Inventors this patent names who are not resolved to a canonical person. */
export function unresolvedInventors(patent: CanonicalPatent): readonly PatentInventorAssociation[] {
  return patent.inventors.filter((inventor) => inventor.resolution === 'unresolved');
}

/** True when the patent names more than one inventor, whatever their resolution state. */
export function isMultiInventor(patent: CanonicalPatent): boolean {
  return patent.inventors.length > 1;
}

/**
 * Guard a sole-inventor attribution against the document.
 *
 * The West/Sessler, Sampson/Miley, Brown/Brown and Jones/Numero cases all fail here. Centring
 * the contributor a Black-history catalog exists to cover is editorial judgment and entirely
 * legitimate; dropping the others from the record is an error about the past.
 */
export function assertSoleInventorClaimSupported(
  patent: CanonicalPatent,
  claimedInventorEntityId: string,
): void {
  if (!isMultiInventor(patent)) return;
  const names = patent.inventors.map((i) => i.nameAsPublished).join(', ');
  throw new Error(
    `Patent ${patent.jurisdiction} ${patent.patentNumber} names ${patent.inventors.length} inventors (${names}); ` +
      `it cannot support a sole-inventor attribution to ${claimedInventorEntityId}. Use co_invented and model every named inventor.`,
  );
}

export function isPatentSourceSystem(value: string): value is PatentSourceSystem {
  return (PATENT_SOURCE_SYSTEMS as readonly string[]).includes(value);
}

export function isIntellectualPropertyStatus(value: string): value is IntellectualPropertyStatus {
  return (IP_STATUSES as readonly string[]).includes(value);
}

/**
 * Assert a patent record is internally coherent before it is stored.
 *
 * A patent with no inventors is a parsing failure, not a patent, and storing one would make
 * every downstream co-inventor check silently pass.
 */
export function assertCanonicalPatentValid(patent: CanonicalPatent): void {
  if (patent.jurisdiction.trim().length === 0) throw new Error('jurisdiction is required');
  if (normalizePatentNumber(patent.patentNumber) === undefined) {
    throw new Error(`Unreadable patent number: ${patent.patentNumber}`);
  }
  if (patent.title.trim().length === 0) throw new Error('title is required');
  if (patent.inventors.length === 0) {
    throw new Error('A patent with no named inventors is a parse failure, not a patent');
  }
  if (patent.canonicalSourceItemId.trim().length === 0) {
    throw new Error('canonicalSourceItemId is required: a receipt must say what it was read from');
  }
  for (const inventor of patent.inventors) {
    if (inventor.nameAsPublished.trim().length === 0) {
      throw new Error('Every inventor needs the name as the patent published it');
    }
    if (inventor.resolution === 'resolved' && (inventor.canonicalEntityId ?? '').trim() === '') {
      throw new Error(
        `Inventor "${inventor.nameAsPublished}" is marked resolved with no canonical entity id`,
      );
    }
    if (inventor.resolution !== 'resolved' && inventor.canonicalEntityId !== undefined) {
      throw new Error(
        `Inventor "${inventor.nameAsPublished}" carries a canonical entity id while marked ${inventor.resolution}`,
      );
    }
  }
}
