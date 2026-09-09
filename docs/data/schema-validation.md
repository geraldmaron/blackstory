# Schema validation checklist (ADR-020 / repo-ivh4)

Generated against repo sources on 2026-07-20. **Remote apply completed** on
`blackstory-app` (`twykhihqkcldpreuovay`) after human approval (repo-iy1g).

This is a point-in-time record of one validation run, not a live view of the schema. The
coverage counts below are as of that run; the current figures are in the note under the table.
For the schema as it stands, read [postgres-schema.md](postgres-schema.md), which is the more
current companion doc. The invariant table further down still holds.

## Coverage

| Check | Result |
|-------|--------|
| All `FIRESTORE_ROOT` keys mapped | PASS (39/39) |
| Live-only `adminStoryPacketReviews` | PASS → `bb_ops.story_packet_reviews` |
| `entityEmbeddings`, `holcAreas`, `claimPromotions`, `publicationCandidates` | PASS |
| Public graph subcollections | PASS → `release_graph_*` |
| DDL `CREATE TABLE` for mapped names | PASS |
| Remote tables with RLS | PASS (62 `bb_*` base tables, as of 2026-07-20) |
| Migration files | 12 under `supabase/migrations/` (incl. advisor remediation), as of 2026-07-20 |

**Where those two counts stand now (measured 2026-09-08 against `supabase/migrations/` in this
repo, not against the remote):** 49 migration files, and 126 distinct `bb_*` tables created and
not later dropped: 34 in `bb_research`, 23 each in `bb_canonical` and `bb_reference`, 17 in
`bb_ops`, 14 in `bb_evidence`, 11 in `bb_public`, 2 in `bb_publication`, 1 each in `bb_audit`
and `bb_submissions`. The RLS PASS above was a remote check against the 12-file schema and has
not been re-run against the 37 migrations added since, so treat it as covering the original
schema only.

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
