/**
 * Plain-language labels for publisher kind, tier, and fitness values shown in the source
 * library desk.
 */
const PUBLISHER_KIND_LABELS: Readonly<Record<string, string>> = {
  government_archive: 'Government archive',
  government_agency: 'Government agency',
  court_legal: 'Court / legal',
  academic_library_archive: 'Academic library or archive',
  museum: 'Museum',
  encyclopedia_reference: 'Encyclopedia / reference',
  news_media: 'News media',
  nonprofit_heritage: 'Nonprofit heritage organization',
  wiki_crowd: 'Wiki / crowd-sourced',
  commercial_database: 'Commercial database',
  other: 'Other',
};

const TIER_LABELS: Readonly<Record<string, string>> = {
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  tier3: 'Tier 3',
};

const FITNESS_LABELS: Readonly<Record<string, string>> = {
  authoritative: 'Authoritative',
  strong: 'Strong',
  conditional: 'Conditional',
  lead_only: 'Lead only',
  unfit: 'Unfit',
};

export function formatPublisherKind(kind: string | undefined): string {
  if (!kind) return 'Unclassified';
  return PUBLISHER_KIND_LABELS[kind] ?? kind.replaceAll('_', ' ');
}

export function formatTier(tier: string | undefined): string {
  if (!tier) return 'Untiered';
  return TIER_LABELS[tier] ?? tier.replaceAll('_', ' ');
}

export function formatFitness(fitness: string): string {
  return FITNESS_LABELS[fitness] ?? fitness.replaceAll('_', ' ');
}
