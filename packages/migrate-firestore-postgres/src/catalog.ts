/**
 * Collection catalog: Firestore path → Postgres target, migrate priority, empty-skip policy.
 */
import { FIRESTORE_ROOT } from '@repo/firebase';

export type MigratePriority = 'high' | 'medium' | 'large' | 'skip-empty-expected';

export type CollectionSpec = {
  readonly firestore: string;
  readonly target: string;
  readonly priority: MigratePriority;
  readonly notes?: string;
};

/** Live-only collections not in FIRESTORE_ROOT. */
export const LIVE_ONLY_COLLECTIONS = [
  'adminStoryPacketReviews',
  'entityEmbeddings',
  'holcAreas',
] as const;

export const COLLECTION_SPECS: readonly CollectionSpec[] = [
  { firestore: 'policy', target: 'bb_ops.policy_active', priority: 'high' },
  { firestore: 'policyVersions', target: 'bb_ops.policy_versions', priority: 'high' },
  { firestore: 'killSwitches', target: 'bb_ops.kill_switches', priority: 'high' },
  { firestore: 'publicationReleases', target: 'bb_publication.releases', priority: 'high' },
  { firestore: 'publicMeta', target: 'bb_public.active_release+materialized_snapshots', priority: 'high' },
  { firestore: 'evidenceSources', target: 'bb_evidence.evidence_sources', priority: 'high' },
  { firestore: 'sourceItems', target: 'bb_evidence.source_items', priority: 'high' },
  { firestore: 'sourceCaptures', target: 'bb_evidence.source_captures', priority: 'high' },
  { firestore: 'retrievalEvents', target: 'bb_evidence.retrieval_events', priority: 'high' },
  { firestore: 'researchCases', target: 'bb_research.cases(+history/checklist)', priority: 'high' },
  { firestore: 'censusNationalDecades', target: 'bb_reference.census_national_decades', priority: 'high' },
  { firestore: 'publicSearchIndex', target: 'bb_public.search_index', priority: 'medium' },
  { firestore: 'publicReleases', target: 'bb_public.release_* (subcollections)', priority: 'medium', notes: 'Parent docs may be missing; migrate subcollections' },
  { firestore: 'censusStateDecades', target: 'bb_reference.census_state_decades', priority: 'medium' },
  { firestore: 'auditEvents', target: 'bb_audit.events', priority: 'medium' },
  { firestore: 'outboxMessages', target: 'bb_ops.outbox_messages', priority: 'medium' },
  { firestore: 'idempotencyKeys', target: 'bb_ops.idempotency_keys', priority: 'medium' },
  { firestore: 'submissionInbox', target: 'bb_submissions.intake_items', priority: 'medium' },
  { firestore: 'adminStoryPacketReviews', target: 'bb_ops.story_packet_reviews', priority: 'medium' },
  { firestore: 'entityRelationships', target: 'bb_canonical.entity_relationships', priority: 'medium' },
  { firestore: 'entityEmbeddings', target: 'bb_canonical.entity_embeddings', priority: 'medium' },
  { firestore: 'censusCountyDecades', target: 'bb_reference.census_county_decades', priority: 'large' },
  { firestore: 'acsCountyProfiles', target: 'bb_reference.acs_county_profiles', priority: 'large' },
  { firestore: 'acsTractProfiles', target: 'bb_reference.acs_tract_profiles', priority: 'large' },
  { firestore: 'ucrAgencies', target: 'bb_reference.ucr_agencies', priority: 'large' },
  { firestore: 'ucrStateParticipation', target: 'bb_reference.ucr_state_participation', priority: 'large' },
  { firestore: 'opportunityAtlasTracts', target: 'bb_reference.opportunity_atlas_tracts', priority: 'large' },
  { firestore: 'hateCrimeCountyYears', target: 'bb_reference.hate_crime_county_years', priority: 'large' },
  { firestore: 'holcAreas', target: 'bb_reference.holc_areas', priority: 'large' },
  { firestore: 'canonicalEntities', target: 'bb_canonical.entities', priority: 'skip-empty-expected' },
  { firestore: 'canonicalClaims', target: 'bb_canonical.claims', priority: 'skip-empty-expected' },
  { firestore: 'claimEvidenceLinks', target: 'bb_canonical.claim_evidence_links', priority: 'skip-empty-expected' },
  { firestore: 'evidenceRecords', target: 'bb_evidence.evidence_records', priority: 'skip-empty-expected' },
  { firestore: 'evidenceLineage', target: 'bb_evidence.evidence_lineage', priority: 'skip-empty-expected' },
  { firestore: 'sourceOrganizations', target: 'bb_evidence.source_organizations', priority: 'skip-empty-expected' },
  { firestore: 'sourceDomains', target: 'bb_evidence.source_domains', priority: 'skip-empty-expected' },
  { firestore: 'jurisdictions', target: 'bb_reference.jurisdictions', priority: 'skip-empty-expected' },
  { firestore: 'entityMerges', target: 'bb_canonical.entity_merges', priority: 'skip-empty-expected' },
  { firestore: 'catalogDecisions', target: 'bb_ops.catalog_decisions', priority: 'skip-empty-expected' },
  { firestore: 'discoveryCampaignRuns', target: 'bb_ops.discovery_campaign_runs', priority: 'skip-empty-expected' },
  { firestore: 'outboxConsumerReceipts', target: 'bb_ops.outbox_consumer_receipts', priority: 'skip-empty-expected' },
  { firestore: 'censusCountyHistoricalDecades', target: 'bb_reference.census_county_historical_decades', priority: 'skip-empty-expected' },
];

export function allKnownFirestoreCollections(): readonly string[] {
  return [...new Set([...Object.values(FIRESTORE_ROOT), ...LIVE_ONLY_COLLECTIONS])].sort();
}
