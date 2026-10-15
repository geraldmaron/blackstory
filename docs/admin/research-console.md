# Administration and research console

The private admin portal is the `/admin` route group inside `apps/web` (`apps/web/src/admin/**`
+ `apps/web/src/app/admin/**`), staff-gated by `apps/web/src/proxy.ts` — same Vercel deployment
as the public site. Primary desks are:

| Desk | Path | Role |
|------|------|------|
| Ops | `/admin` | Post-login landing; queue posture, env strip, deep links |
| Inbox | `/admin/inbox` | Pending research cases with full detail + live transitions |
| Cases | `/admin/cases`, `/admin/cases/[id]` | All research-case states + deep detail |
| Catalog | `/admin/catalog` | Canonical entities and places |
| Stories | `/admin/stories/review` | Story packet review (approve ≠ publish) |
| Sources | `/admin/sources` | Source organization registry |
| Releases | `/admin/releases` | Release manifests + privileged stage activate/rollback |
| More | Quick add, evidence, graylist, audit, switches | Intake and safety |

Sign-in defaults to Ops (`/admin`). A safe `?next=` path (for example the desk that bounced the
operator to login) is honored; open redirects are rejected.

## Live research triage

Inbox and Cases call `/api/research-cases` (list, detail, transition, bulk-transition, assign).
Transitions use domain `transitionResearchCase` + `commitWithAudit` and never write public
projections. Product verbs: Send to relevance, Confirm relevance, Needs evidence, Exclude, Merge.

## Authorization boundary

All mutation handlers must import the existing server authorizer from
`apps/web/src/admin/auth/server-authorization.ts` / `request-auth.ts`. Do not reproduce authorization in client code.

1. Every action checks the caller's staff role against the permission it declares. Identity comes
   from a verified Supabase session and `app_metadata.app_role` (`ADMIN_AUTH_MODE=supabase`).
2. High-impact release staging requires a durable operator reason; full activation still needs
   signed-manifest verification in this runtime.
3. The verified actor, reason, and resulting state must be included in the append-only audit event.

Browser state, route visibility and hidden buttons are not authorization. Research
roles cannot publish or retract. Publication roles cannot mutate research workflow state.
`useAdminPermissions` is display-only.

### Admin API routes

Route handlers under `apps/web/src/app/admin/api/**` call `authorizeAdminRoute(request)`, which
authenticates and then checks the role against the rule the route has in
`apps/web/src/admin/auth/route-permissions.ts`. A method and path with no rule is refused with 403,
so a new route is closed until its authority is stated. `staff read` means any verified staff role.

| Route | Permission | Roles |
|-------|-----------|-------|
| `GET` audit, auth/me, catalog/entity-ids, discovery/runs, graylist, releases, research-cases, research-cases/:id, sources, stories/packets, switches | staff read | all |
| `POST /admin/api/research-cases/:id/assign` | `research:write` | admin, research |
| `POST /admin/api/research-cases/:id/transition` | `research:write` | admin, research |
| `POST /admin/api/research-cases/bulk-transition` | `research:write` | admin, research |
| `POST /admin/api/stories/packets/:submissionId/review` | `research:write` | admin, research |
| `POST /admin/api/stories/packets/review-bulk` | `research:write` | admin, research |
| `POST /admin/api/catalog/bulk-decision` | `canonical:bulk_write` | admin |
| `POST /admin/api/releases/stage` | `publication:publish` | admin, publication |
| `POST /admin/api/research-cases/:id/promote` | `publication:publish` | admin, publication |

`route-permissions.test.ts` walks the route directory and fails if a handler has no rule, if a rule
outlives its route, or if a handler authenticates without the authority check.

## Canonical writes

The entity workbench edits `canonical.entities` through permission-checked server operations.

Every canonical write goes through `commitCanonicalWrite`
(`apps/web/src/admin/lib/canonical-write.ts`) — there is no second path. It resolves the verified
staff identity from the session, checks the role against the verb's permission, and hands the
state change to `commitWithAuditPostgres`, which writes domain state, the audit event, and the
outbox message in one transaction. A canonical write without an audit row cannot exist.

| Verb | Permission | Roles |
|------|-----------|-------|
| `entity.field_edit` | `canonical:write` | admin, research |
| `entity.merge` | `canonical:merge` | admin |
| `entity.merge_reverse` | `canonical:merge` | admin |
| `entity.bulk_kind_reassign` | `canonical:bulk_write` | admin |
| `entity.bulk_field_edit` | `canonical:bulk_write` | admin |

`apps/web/src/admin/auth/staff-permissions.ts` is the single role→permission table; the server gate
and `useAdminPermissions` both read it, so a hidden button and an enforced permission cannot
drift apart. Every write requires a non-empty operator reason, and the audit actor is always the
verified session identity — never an operator id submitted with the form.

## Bulk field edits

Select rows (or Select all matching, which resolves every id under the current filter) and the
bulk panel applies `kind`, `living_status`, or `sensitivity` to the whole set. Above 250 records
it takes a review click before the apply click, naming the exact count and the exact change.

The set is **pinned to explicit ids**, not re-derived from the filter at apply time. The operator
confirmed a count against a specific set; re-running the filter would quietly include rows that
drifted into it since, which is the surprise the confirm step exists to prevent.

A kind change writes `entity_class` in the same statement. The two are 1:1 across all 4,097 live
rows, and every class facet reads `entity_class`, so splitting them would file the whole set under
its old class permanently. The derivation is `entityClassForKind`
(`apps/web/src/admin/lib/entity-vocabulary.ts`), which is also what the single-record editor uses.

Absorbed records are skipped: they are merge tombstones pointing at a survivor, and editing one
changes nothing anyone reads. The skipped count is reported back.

The values being overwritten are read first and recorded on the audit event **grouped by prior
value** — a thousand rows moving from `institution` to `organization` is one group holding a
thousand ids, not a thousand before/after pairs. That keeps the event a readable size while still
carrying what an un-do needs.

One statement, one transaction, one audit event, so 5 rows and 5,000 cost the same and either all
land or none do. This is why the bulk field-edit path has no 50-row cap: the separate
bulk-*decision* path (`/api/catalog/bulk-decision`) commits once per entity, which is what that
cap is protecting against, and it is unchanged.

## Merging entities

Select two or more records in the workbench and choose Merge (`/catalog/merge?ids=…`). The
survivor keeps its own name, kind, and sensitivity; everything the absorbed records own moves to
it, and the absorbed records stay in the archive marked `merge_state.status = 'absorbed'`.

**A merge moves rows and never deletes them.** A row that cannot move cleanly stays with the
absorbed record and is reported on the survivor's page. The live schema produces exactly three
such cases: an `entity_relationships` edge or an `event_participation` row whose endpoints would
both become the survivor (a self-loop is not a fact about anything), a participation row that
would violate `UNIQUE (event_id, participant_id, role)`, and the single-row-per-entity tables
`entity_embeddings` and `entity_reconciliation_status`, where the survivor's own row wins.

Because nothing is destroyed, the merge is reversible in the literal sense: `applyState` returns
the id of every row it moved and where it came from, that record is written onto the merge's audit
event, and Reverse this merge (on the survivor's page) reads it back and repoints each row.
Merges made before this existed — including the two from
`packages/ops-data/scripts/merge-duplicate-hubs.ts`, which resolves collisions by deleting the
losing rows — have no reversal record and are shown as not reversible rather than offering a
button that would fail.

A merge is a canonical decision and does not touch `published.release_entities` or
`published.search_index`. The next release build reads canonical; the signed manifest is still the
only thing that changes what is live.

## Query timeouts

Desks are server components, so first byte blocks on Postgres. The pool carries a connect
timeout, a `statement_timeout`, and a client-side query timeout
(`apps/web/src/admin/lib/canonical-postgres-client.ts`, overridable via `DATABASE_CONNECT_TIMEOUT_MS`,
`DATABASE_STATEMENT_TIMEOUT_MS`, `DATABASE_QUERY_TIMEOUT_MS`). Page reads wrap in
`readPostgresOrDegrade`, which turns an unreachable database into a banner in about five seconds
instead of a render that hangs for minutes. Genuine query errors still throw — degradation must
not hide broken SQL.

## Publication safety

Console and release actions may target canonical drafts or immutable release candidates. They must
never target `/api/public/**`, an active projection document, or a public release snapshot in place.
Retraction and rollback use release replacement semantics.

Bulk research transitions enforce a 50-item limit and reject duplicates.

## Deployment checks

Verify Supabase Auth configuration, staff role grants, scoped database credentials and audit
writes on the actual deployment. Test unauthorized access as well as successful sign-in. A
local test or hidden button does not prove production authorization.

## Editorial workspace audit and delivery contract

Status: audit complete; implementation proposed. Inspected October 14, 2026.
Audience: staff writing, editing, reviewing and publishing articles and entity prose.
Owner request: Gerald must be an available author, including joint credits with Neo,
and the whole editing and publication journey must work without a parallel CMS.

### Observed capabilities

These observations distinguish authenticated production navigation from source inspection.
No production content or account was changed during the audit.

| Task | Observed result | Evidence |
|---|---|---|
| Read and review a staged story | The live review desk opens a draft and offers approve, needs evidence and reject. The only editable prose is a decision note. | **ran:** `/admin/stories/review`, opened “Two names before Dunbar”; **read:** `StoryReviewDesk.tsx` and packet review route |
| Edit an article | Following “Open cover package” opens cover fields, not a body editor or author selector. | **ran:** `/admin/stories/articles/two-names-before-dunbar`; **read:** its page, form and actions |
| Save a cover | Drafts and ready packages use a process-local `Map`. The action takes an uploaded filename; it does not persist the uploaded bytes. Durability was not tested by writing production data. | **read:** `admin/stories/cover-package-store.ts` and cover actions |
| Manage entity prose | Bessie Coleman's admin record offers name, kind, living status, aliases, sensitivity and identifiers. Locations are read-only. No summary, historical context, claim or relationship editor appears there. | **ran:** `/admin/catalog/ent_bessie_coleman_001`; **read:** `EntityRecordEditor.tsx`, `entity-edit.ts` and detail page |
| Set article authors | The article schema has no contributor field. The public page hardcodes Neo in the byline and BlackStory in structured metadata. | **read:** `packages/schemas/src/public-articles.ts`, `app/stories/[slug]/page.tsx` |
| Continue after packet approval | Approval returns a seed handoff, not a durable editable article revision. Public article reads use release articles. | **read:** `admin/lib/postgres-story-packets.ts`, review route and `lib/articles/source.ts` |
| Publish from Releases | The handler stages a decision and returns `executionAllowed: false`. The admin home description overstates this desk's activation capability. | **read:** `api/releases/stage/route.ts`, `ReleasesDesk.tsx`, admin home |

The existing article lifecycle already uses `reference.articles`, typed body blocks,
references, related entity IDs and `published.release_articles`. The article CLI carries
validation and projection behavior. Extend and extract those capabilities rather than
creating a second article store or another set of validation rules.

### Context map

Context map: editorial management
Status: final for the inspected boundary; implementation remains proposed.
Created: October 14, 2026. Last updated: October 14, 2026.
Mapped by: repository audit. Contributors: owner requirements and session inspection.
For: a coherent authoring and entity-management path for this article and subsequent work.

**Entities**

- Staff identity: authenticated actor and permission source. **seen: read, ran**
- Story packet desk: staged research and private review decisions. **seen: read, ran**
- Cover desk: cover-specific form and process-local draft state. **seen: read, ran**
- Article lifecycle: reference records, typed contracts, validation and release projection. **seen: read**
- Entity catalog: canonical identity edits and audited write service. **seen: read, ran**
- Public readers: released articles, entities and shared story-to-record associations. **seen: read**

**Relationships**

- Staff identity **blocks** unauthorized mutation through shared permission checks. **seen: read**
- Story packet desk **feeds** a seed handoff after approval. **seen: read**
- Cover desk **depends-on** process memory for its current draft state. **seen: read**
- Article lifecycle **feeds** release article projections. **seen: read**
- Public readers **depend-on** released article and entity projections. **seen: read**
- Article associations **feed** record backlinks through shared domain `cites-edge`. **seen: read**
- Entity catalog **depends-on** `commitCanonicalWrite` for audited canonical edits. **seen: read**

**Obligations**

- Editing owes durable save, revision recovery and honest status to staff. **seen: was-told, owner request**
- Authorship owes explicit credits to Gerald and other contributors. **seen: was-told, owner request**
- Publication owes evidence review, authorized execution and verified public results to readers. **seen: read, publication and prose-review contracts**

**Boundaries**

- Production account provisioning, database writes and publication were outside the read-only audit.
- General historical research and article factual review remain separate from editing capability.
- Existing location-management work owns geocoding; prose editing must not invent another flow.

**Unknowns**

- Gerald's stable account-to-contributor binding and any existing database-only contributor data:
  **not-yet-looked**, requires an authorized database inspection; authenticated UI establishes
  staff access, not an author profile.
- Complete deployed schema and migration compatibility for revision storage:
  **not-yet-looked**, inspect before implementation.
- Editor-engine choice and round-trip behavior for existing typed blocks:
  **not-yet-looked**, evaluate existing sibling/tooling capabilities before choosing a dependency.
- Full publication executor integration with an interactive article draft:
  **looked-and-unclear**, existing CLI and management execution paths need an integration test.

### Proposed behavior and acceptance

**Decided by the owner:** support full article editing, entity/prose management, Gerald's
author identity and explicit coauthorship with Neo. Preserve a coherent end-to-end experience.

**Outcomes**

1. Staff can create, reopen and revise a complete article, including its body, references,
   contributors, cover, rights information and linked records.
2. Entity prose and historical relationships can be proposed with evidence, with clear
   canonical-versus-published state and the articles affected by a change.
3. An exact reviewed revision can move through preview and authorized publication, with
   public verification, correction history and rollback.

**Constraints:** reuse the existing article/block contract, canonical-write boundary,
shared role permissions, citation/anchor validation and release readers. These follow
the architecture, administrator identity and publication contracts. An author's public
profile never exposes login contact or auth identifiers and grants no staff privileges.

**Assumptions:** initial contributors are staff-managed; public self-service onboarding
is not required for this journey. A browser editor can map losslessly to the existing
block contract; prove that with real article content before selecting an engine.

**Contributor contract:** use stable contributor identities and ordered per-revision
credits. Privately link Gerald Dagher's profile to his verified account. Keep the audit
actor, credited writer, editor and reviewer distinct. Represent Neo explicitly as the
house editorial identity described in `docs/content/neo-voice.md`, with disclosure and
no invented human biography. “Gerald Dagher and Neo” must be a supported selected credit,
not a hardcoded site-wide default. Public byline and structured metadata consume the same
approved credit data; do not invent historical authorship during migration.

**Editing contract:** durable database revisions with stale-save conflict detection,
recoverable local edits and visible saved/pending/failed states. Save drafts with explicit
evidence blockers. Bind review to the exact content revision; factual edits reopen the
affected review. Import packets into the article lifecycle. Persist media bytes and
rights metadata; retire process-local cover storage and the manual seed handoff on cutover.
The choice of storage shape is contingent on the schema inspection above.

**Relationship contract:** keep authorship, article association, evidence citation and
historical relationship distinct. Reuse the existing `cites-edge` derivation for web,
API and mobile. An editorial association must not create a historical edge. Link existing
entities by stable IDs and show reverse article usage before merge, correction or retraction.
Returning from an entity or source must restore the draft and its editing position.

**Acceptance journey:** use “What Black Women Make Possible” as the realistic draft.
In a controlled environment, create it, select Gerald and Neo credits, add and reorder
prose blocks, attach citations and entity links, save and reopen it, then exercise a
stale concurrent edit, expired session and failed save without losing work. Propose an
evidenced entity summary and return to the draft. Preview the exact revision with the
public renderer, complete review, publish through the existing authorized executor,
verify matching web byline/metadata and record backlinks, then demonstrate correction
and rollback. Unfinished historical research must remain a publication blocker.

**Priorities:** the critical path is durable revision and contributor contracts. Next,
integrate the editor and entity/evidence panels using existing services. Publication
integration and observed end-to-end acceptance finish the first delivery. Public
contributor onboarding and simultaneous live co-editing are later; neither is needed
to support multiple credited authors with safe sequential editing.

**Challenge decision: accepted with controls.** A separate rich-text CMS would create
competing content and publication authority; appending Gerald to the current byline would
leave credits uneditable and metadata inconsistent. The supported alternative is one
editorial workspace over the existing article lifecycle, with explicit adapters where
article and entity content differ. Do not replace structured evidence with unrestricted HTML.

**Verification record:** seven typed relationships; entities and relationships carry
read/ran/was-told evidence. Load-bearing flow claims were inspected in source; three
live desks were exercised read-only. Four unknowns are classified above. The handoff
was reread against the acceptance journey; account provisioning and actual publication
remain explicit implementation work. Requirements separate owner decisions, three
outcomes, sourced constraints and two assumptions. Acceptance describes observable
results; priorities and later scope are explicit. No code tests, database changes,
save/recovery tests, keyboard audit or light-theme audit ran for this read-only assessment.

## Editorial implementation, October 14, 2026

The implementation on `codex/editorial-workspace` replaces the cover-only process-local
editor with durable article revisions, contributor profiles, exact-revision review,
private media, public-renderer previews, signed publication and rollback. Gerald Dagher
and the disclosed Neo identity can share ordered credits. Public bylines and Article
metadata read those snapshots. Existing article rows keep empty credits until an editor
assigns them; the migration does not infer authorship.

Uber Base Web now owns the management shell and form controls. The primary editor is a
Tiptap canvas over the existing typed body contract, with a compact inspector and a mobile
modal. Entity tabs, the article library and contributor master/detail support the complete
editing journey. Research packet approval creates a durable article draft, with source and
credit completion still required. Manual seed handoff is retired from the web workflow.

Entity prose/evidence proposals reuse quarantined intake. Review applies through the
canonical audit/outbox boundary, records evidence-backed historical relationships and
rejects stale snapshots. Private editorial rows are excluded from the public corrections
credential. Article associations and historical relationships remain distinct.

See [the UI contract](../ui/patterns-admin-editorial.md) and
[the verification record](./editorial-workspace-verification.md) for the checks and limits.
Production migration, deployment and publication of the unfinished historical article have
not been performed. The bounded theme recommendation and source gaps remain in the project
tracker; local acceptance data is disposable.

Follow-up: [hydration diagnosis and existing-article CRUD verification](./editorial-hydration-crud-verification.md) records the recovered theme context, canonical article audit and recoverable archive workflow.
