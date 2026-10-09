-- Archive full prior profiles before removing obsolete classifier commentary.
INSERT INTO audit.events(id,action,category,actor,subject,reason,request_id,correlation_id,idempotency_key,occurred_at,data)
SELECT extensions.gen_random_uuid()::text,'source_library.profile_recheck','research',
 '{"id":"source-library-method-review","type":"operator"}'::jsonb,
 jsonb_build_object('organizationId',o.id),'Profile provenance was revisited; collection pages and access do not recertify all descriptive assertions.',
 'source-library-curation-v1','source-library-curation-v1','profile-recheck:'||o.id,clock_timestamp(),
 jsonb_build_object('priorProfile',to_jsonb(o),'status','needs_recheck')
FROM evidence.source_organizations o WHERE o.profile_reviewed_at IS NOT NULL;
UPDATE evidence.source_organizations o SET
 profile_review_status='needs_recheck',
 limitations=ARRAY(SELECT x FROM unnest(o.limitations) x
   WHERE x !~* '(tier[123]|classifier|confidence engine|code classifies|code treats|classified in|per .*claim-corroborate|pair with a .gov)')
   || ARRAY['Publisher guidance needs document-relative recheck. Legacy tiers and usage do not establish assertion truth.'],
 updated_at=clock_timestamp()
WHERE o.profile_reviewed_at IS NOT NULL;

-- Exact inspected membership only; other items remain unknown.
UPDATE evidence.source_items SET source_policy_id='collection-nps-nominations',source_policy_version='1'
WHERE url IN ('https://npgallery.nps.gov/GetAsset/9814b816-e5bd-4513-8b58-415d397c5297','https://npgallery.nps.gov/GetAsset/81caf24c-7dae-4316-8ada-a13a4d8647ce');
UPDATE evidence.source_items SET source_policy_id='collection-missouri-nominations',source_policy_version='1'
WHERE url='https://mostateparks.com/sites/g/files/zuston361/files/media/pdf/2025/02/lincoln-high-school-jackson-county.pdf';
UPDATE evidence.source_items SET source_policy_id='collection-delaware-archives-narratives',source_policy_version='1'
WHERE url='https://archives.delaware.gov/2026/02/27/delawares-fight-for-school-desegregation-part-1/';

-- Item guidance is retained as archival data, with an audit record. Live consumers use policy revisions.
INSERT INTO audit.events(id,action,category,actor,subject,reason,request_id,correlation_id,idempotency_key,occurred_at,data)
SELECT extensions.gen_random_uuid()::text,'source_library.item_guidance_archived','research',
 '{"id":"source-library-method-review","type":"operator"}'::jsonb,jsonb_build_object('sourceId',id),
 'Copied item guidance is superseded by immutable collection profiles; no evidence reference removed.',
 'source-library-curation-v1','source-library-curation-v1','item-guidance:'||id,clock_timestamp(),research_guidance
FROM evidence.evidence_sources WHERE research_guidance<>'{}'::jsonb;

INSERT INTO research.cases(id,state,candidate_id,title,assignment)
SELECT 'source-library-lincoln-date-review','candidate','nrhp-black-heritage-13001086','Lincoln High School: disputed institutional founding dates',
 jsonb_build_object('queue','backfill','priority','high','assignedBy','source-library-method-review','assignedAt',clock_timestamp())
WHERE NOT EXISTS(SELECT 1 FROM research.cases WHERE title='Lincoln High School: disputed institutional founding dates');
INSERT INTO research.case_checklist_items(case_id,key,complete,note)
SELECT id,'founding_date_conflict',false,
 'Distinguish district school in 1867, secondary coursework in 1882, dedicated building in 1890 and Woodland classes in September 1936. The district brochure says 1865; primary district records are still needed. See docs/research/historic-black-secondary-schools-2026-10-07.md. This uncertainty is case-specific.'
FROM research.cases WHERE title='Lincoln High School: disputed institutional founding dates'
ON CONFLICT(case_id,key) DO NOTHING;

-- Bounded exact-assertion remediation. Host is a discovery risk signal, never a finding of falsity.
WITH candidates AS (
 SELECT c.id AS claim_id,v.id AS version_id,c.entity_id,e.display_name,v.predicate,v.object,
   bool_and(pc.host='en.wikipedia.org' OR pc.host LIKE '%.wikipedia.org' OR pc.host='wikidata.org' OR pc.host LIKE '%.wikidata.org') AS only_discovery,
   (v.predicate ~* '(first|only|largest|earliest|caus)' OR v.object::text ~* '\m(first|only|largest|earliest)\M') AS consequential
 FROM canonical.claims c JOIN canonical.claim_versions v ON v.id=c.current_version_id
 JOIN canonical.entities e ON e.id=c.entity_id
 JOIN evidence.published_citations pc ON pc.claim_id=c.id AND pc.entity_id=c.entity_id
 GROUP BY c.id,v.id,c.entity_id,e.display_name,v.predicate,v.object
), queued AS (
 SELECT * FROM candidates WHERE only_discovery
 ORDER BY consequential DESC,claim_id LIMIT 200
), cases AS (
 INSERT INTO research.cases(id,state,candidate_id,title,assignment)
 SELECT 'source-library-claim:'||version_id,'candidate',entity_id,
   'Evidence review: '||display_name||' / '||predicate,
   jsonb_build_object('queue','backfill','priority',CASE WHEN consequential THEN 'high' ELSE 'normal' END,
     'assignedBy','source-library-method-review','assignedAt',clock_timestamp())
 FROM queued ON CONFLICT(id) DO NOTHING RETURNING id
)
INSERT INTO research.case_checklist_items(case_id,key,complete,note)
SELECT 'source-library-claim:'||version_id,'exact_assertion_review',false,
 jsonb_build_object('claimId',claim_id,'claimVersionId',version_id,'entityId',entity_id,
   'predicate',predicate,'assertion',object,'trigger','Only discovery citations were found for this current published claim',
   'required','Inspect underlying sources, test scope and counterevidence. A name containing First is not itself a superlative. Preserve supported claims; no host-based rewriting.')::text
FROM queued ON CONFLICT(case_id,key) DO NOTHING;
