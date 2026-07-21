# Schema validation checklist (ADR-020 / repo-ivh4)

Generated against repo sources on 2026-07-20. **Remote apply completed** on
`blackstory-app` (`twykhihqkcldpreuovay`) after human approval (repo-iy1g).

## Coverage

| Check | Result |
|-------|--------|
| All `FIRESTORE_ROOT` keys mapped | PASS (39/39) |
| Live-only `adminStoryPacketReviews` | PASS → `bb_ops.story_packet_reviews` |
| `entityEmbeddings`, `holcAreas`, `claimPromotions`, `publicationCandidates` | PASS |
| Public graph subcollections | PASS → `release_graph_*` |
| DDL `CREATE TABLE` for mapped names | PASS |
| Remote tables with RLS | PASS (62 `bb_*` base tables) |
| Migration files | 12 under `supabase/migrations/` (incl. advisor remediation) |

## Invariant encoding

| Invariant | Where |
|-----------|--------|
| Research cannot publish | `bb_publication.activate_release` rejects `bb_role=research`; no UPDATE policy on `active_release` |
| Active release singleton | `bb_public.active_release.id CHECK (id = 'active')` |
| Evidence requires source item | `bb_evidence.evidence_records.source_item_id NOT NULL` + FK |
| Claim versions append-only | `REVOKE UPDATE, DELETE` on `claim_versions` |
| Discovery never publishes | `public_effect = 'none'` CHECK |
| Statistic provenance | NOT NULL source/source_url/retrieved_at/content_hash |
| Roles from app_metadata | `bb_auth.current_role()` |

## Advisors (post-apply)

| Type | Result |
|------|--------|
| Security | Clean after `advisor_remediation` (search_path + RLS initplan + bb_ops deny policies) |
| Performance | Expected INFO only: unused indexes on empty tables; Auth connection strategy |

## Gate

Remote DDL **applied**. Further schema changes require new migrations + review.
