# Admin editorial workspace

Binding scope: private article writing, contributor profiles and entity prose proposals.
Extends the admin shell, canonical catalog and public article renderer. Uses the
existing kit tokens and the flat matte surface law. Uber Base Web owns management controls and interaction behavior; the public reading kit remains the source of public presentation.

## Writing and returning

Articles live in `reference.articles`. The Tiptap writing canvas is an adapter over typed article blocks;
HTML and editor JSON are never alternative content stores. Paragraphs, section headings,
flat lists, quotations and citation chips are editable in place. Structured evidence and
media blocks retain their exact packet, assertion, selector, rights and entity bindings.
Block details opens their inspector, including quotation attribution. Unsupported inline
formatting and nested lists are not offered, because the public article contract cannot
represent them. A failed document conversion pauses saving and preserves the visible text.

The writing canvas sits beside an inspector for settings, sources, credits, records, media,
history and review. Moving between inspector sections preserves article state. The article
library offers title/slug search, state filtering, saved revision previews and explicit empty
results. It does not silently truncate the article collection. On narrow screens it uses
compact article rows and the inspector becomes a full-width Base Web dialog. Closing it
returns focus to its opener. Entity management separates prose/evidence, identity, locations
and merge history into Base Web tabs that keep their form state mounted. Contributor
management uses a master/detail view with immutable existing profile IDs.
Entity and source links open a separate tab so the writing position remains available.
Controls have labels and visible keyboard focus. Selects use Base Web’s searchable combobox path to retain explicit input semantics. Desktop controls use Base Web compact sizing; coarse-pointer controls retain 44px targets.
Both themes use `--ds-ink`, `--ds-surface`, `--ds-border` and `--ds-accent`.

A visible status distinguishes unsaved changes, pending work, a saved revision and a
failed save. Browser session recovery is scoped to the signed-in account and article;
it is a recovery copy, never publication authority. Conflicting saves preserve the
local text and require comparison. Restoring history creates another draft revision without reloading the page. Text typed while restoration runs remains local, with saving paused for comparison. First saves are serialized before a database row exists, and subsequent saves compare the locked revision.

## Evidence, people and relationships

Gerald Dagher and Neo are selectable contributor profiles. Neo is described as a house
editorial identity. Public credits snapshot profile names, identity kinds and ordered
roles per article revision. Private staff-account mapping never enters public payloads.
Migration leaves legacy article credits empty instead of inferring authorship.

Sources locate evidence; a URL alone does not substantiate a claim. The existing
citation, reviewed-anchor, packet, source and prose gates remain the publication gates.
Drafts allow unfinished fields; preview and review show their publication blockers.

Article associations use the domain `cites-edge` derivation. They do not create historical
relationships. The entity panel shows draft and current public article usage separately.
Entity prose and relationship proposals enter the existing quarantined intake. A publisher
reviews the exact proposal, evidence excerpts and target predicates before the canonical
write boundary applies it. A changed canonical snapshot requires a fresh proposal.
Canonical changes await the existing catalog release workflow.

## Publication and correction

Preview reads an explicit saved revision and uses the public body and reference components.
Review attests evidence, rights and prose for that revision. Editing content invalidates its
approval. Publication clones the immutable catalog release, includes signed article artifacts,
verifies uploaded bytes and uses the shared public/mobile activation executor. Failed work
leaves both pointers intact. Media uploads stay in a private bucket until the reviewed article
is released; credit and rights persist alongside the stored bytes. Image blocks support direct private uploads from their inspector after credit and rights are recorded. An upload cannot overwrite a block edited while the request was running.

The last article publication can restore its preceding public article while it remains the
active release. Rollback verifies the prior signed article artifact, creates a new signed
release and preserves unrelated catalog content. Legacy releases without signed article
artifacts require restoring and reviewing a draft instead. A changed release requires reload.

The library defaults to active articles. Recoverable archive keeps revision history and makes
prose read-only. Archived records remain searchable through the publication-state filter;
restore returns them to draft and invalidates approval. Removing a currently public article
requires retraction authority, explicit confirmation and an unchanged public release baseline.
It creates a new signed release that excludes only that article and activates public/mobile
pointers together. Restore never republishes automatically.

Simultaneous live editing and public contributor onboarding are outside this pattern.

## Design-system integration

Base Web is explicitly transpiled with the application so root-provider and subpath controls share one compiled theme context. The admin-only provider themes Base Web with BlackStory ink, paper, typography and radii.
It emits incremental server style batches and merges their hydration cache metadata for
Styletron. Caption IDs use React IDs rather than the library’s process-wide UID counter.
Checkbox marks use literal brand token values inside embedded SVGs, where CSS variables
cannot resolve. Portal layers read the kit’s navigation-drawer tier so a modal always covers
the sticky writing toolbar. Modal semantics, Escape and focus return are explicit.

Shared FormData adapters preserve audited server actions, control values, checkboxes and
focus refs while using Base Web Input, Textarea, Select and Button. Searchable record
selection uses `AdminRecordPicker` and the existing canonical-record lookup endpoint in
both article associations and historical relationship proposals. A selected name resolves
to its stable ID; choosing an article association still does not create a historical edge.
Existing semantic data tables and shared evidence components are retained where their
behavior already meets the task. Surface CSS owns layout and density, not a second control
skin. Validation builds may use `APP_NEXT_DIST_DIR=.next-validation` so the running editor’s
Next output is not replaced during a production build.

**Dependency decision: accepted with controls.** Base Web 16.1.1, Styletron and Tiptap 3.32.0
are MIT licensed. The alternative was retaining the native-form kit; it would not deliver
the owner-selected management system. The principal risks are legacy transitive React peer
ranges, server hydration and losing native FormData/accessibility behavior during migration.
Controls include explicit hydration integration, canonical block round-trip tests, real
browser journeys, production builds and role/publication tests. Avoid the older virtualized
and map components pulled transitively by Base Web. The dependency audit found no advisory
path through these added libraries; existing repository advisories are tracked separately.
