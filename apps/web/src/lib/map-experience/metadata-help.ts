/**
 * Plain-language help for Explore metadata fields and value marks (confidence,
 * status, kind filters). Used as native `title` tooltips and richer aria-labels
 * so icons are never unexplained glyphs.
 */

export type MetaFieldKey =
  | 'kind'
  | 'tone'
  | 'era'
  | 'theme'
  | 'confidence'
  | 'evidence'
  | 'where'
  | 'status';

const FIELD_HELP: Readonly<Record<MetaFieldKey, string>> = {
  kind: 'What kind of record this is — person, place, school, event, institution, and related types.',
  tone:
    'Historical tone from the Color key — massacre or atrocity, plantation, or Black epicenter. Shade only; the kind shape stays the same.',
  era: 'The time period most associated with this record.',
  theme: 'A historical theme tag used to narrow the map (for example education or civil rights).',
  confidence:
    'How strongly the strongest accepted claim on this record is evidenced. This is an evidence score, not a probability that the claim is true.',
  evidence: 'How many accepted, cited claims sit on the full record.',
  where: 'The U.S. state where this record is pinned on the map.',
  status:
    'Lifecycle of the subject — whether it is still active, historic, living, deceased, or a legal status.',
};

const CONFIDENCE_HELP: Readonly<Record<string, string>> = {
  high: 'High confidence: the strongest accepted claim is well supported by sources.',
  medium: 'Medium confidence: supporting evidence is mixed or only moderately strong.',
  low: 'Low confidence: supporting evidence is thin or weaker so far.',
  unrated: 'Unrated: an evidence-strength score has not been assigned yet.',
};

const STATUS_HELP: Readonly<Record<string, string>> = {
  active: 'Active: still operating or recognized as a present-day place or institution.',
  historic:
    'Historic: no longer active as a present-day place or institution; remembered historically.',
  inactive: 'Inactive: not currently operating.',
  living: 'Living: concerns a living person (privacy rules apply on the public map).',
  deceased: 'Deceased: concerns a person who has died.',
  in_force: 'In force: a legal rule or order that is still in effect.',
  amended: 'Amended: legal text that has been changed.',
  repealed: 'Repealed: a legal rule that has been withdrawn.',
  struck_down: 'Struck down: a legal rule invalidated by a court.',
  enjoined: 'Enjoined: a legal rule temporarily blocked by a court order.',
  archived: 'Archived: kept for reference and no longer treated as current.',
  draft: 'Draft: not yet published as a finished public record.',
};

/** Help copy for Explore / result-list field labels (Kind, Confidence, Status, …). */
export function metaFieldHelp(field: MetaFieldKey): string {
  return FIELD_HELP[field];
}

/** Help copy for a confidence tier mark. */
export function confidenceHelp(tier: string): string {
  const key = tier.trim().toLowerCase();
  return CONFIDENCE_HELP[key] ?? `Confidence tier: ${tier}.`;
}

/** Help copy for an entity lifecycle status mark. */
export function statusHelp(status: string): string {
  const key = status.trim().toLowerCase();
  return STATUS_HELP[key] ?? `Status: ${status.replace(/_/g, ' ')}.`;
}
