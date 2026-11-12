# Agent Instructions

## Mobile local QA (agents)

**Default for mobile smoke / "app works locally": Path A (prod-like).** Production never uses Metro; do not open the Debug dev client and expect prod behavior.

| Goal | Command | Pass signal |
|---|---|---|
| Agent gate (mobile ready) | `pnpm mobile:ios:verify` | api-public live + Release app on booted Simulator; **Metro not required** |
| Launch / rebuild embedded bundle | `pnpm mobile:ios:release` | Release install; relaunch without packager URL |
| Relaunch only | `pnpm mobile:ios:launch` | App runs from embedded bundle |

**Path B (hot reload only):** `pnpm dev:mobile` / `pnpm dev:mobile:verify` when actively editing JS. Never claim mobile healthy from `127.0.0.1:8081` `/status` alone while the iOS dev client may still target another LAN port (`:8082`, `:8083`). Path B verify must pass LAN bundle smoke + simulator packager alignment.

Static gates run from `apps/mobile` on its own npm graph, not through root `pnpm lint` (which
excludes `apps/mobile/**`): `npm run lint` (ESLint, warnings fail), `npm run typecheck`, `npm test`.
CI runs all three in the Mobile Lint / Mobile Typecheck / Mobile Unit Tests jobs.

See `apps/mobile/README.md` for setup (`API_BASE_URL=http://127.0.0.1:8080` in `apps/mobile/.env.local`).

## BlackStory research lanes

Start at [`docs/architecture.md`](docs/architecture.md) and
[`docs/research/README.md`](docs/research/README.md). These define current authority and the
challenge procedure. Inspect code and evidence before accepting a design claim. Historical
ADRs/PRDs and dated audits are supporting records, not competing operating instructions.
Code comments explain behavior and constraints, not session history or incidental dates.


Project skills are harness-independent source under `.agents/skills/<skill-name>/SKILL.md`.
Use the full `blackstory-` skill name; `research-framework` is the shared entry point.
Read [skill loading and capability requirements](docs/research/README.md#skills-and-harness-portability)
when the harness does not discover that directory. `.claude/skills/` contains discovery
links to the same files, not another implementation.

Operator-cli verbs have no skill of their own; `research-framework` routes to
[`docs/research/research-operations.md`](docs/research/research-operations.md).

**Judgment playbooks** (`entity-verify`, `claim-corroborate`, `entity-complete`,
  `entity-relate`, `coverage-target`, `publish-preview`, `neo-voice`, `prose-review`,
  `ringer-review`, `surface-triage`, `intake-review`, `experience-review`) carry decision order, source ladders, and Do/Never. They
  have no operator-cli verb of their own.

The `locate` verb Census-geocodes a sourced address (no LLM). Finding the place, confirming
which namesake, and assigning era is `blackstory-entity-verify`.

`blackstory-surface-triage` is the other direction: the data exists and a published surface
disagrees with it. It carries the projection / search-doc split, the `facets` whole-object
replace, and the 30-minute release cache that makes a correct fix look like no fix.

All commands: `node --conditions development --import tsx packages/operator-cli/src/bin.ts <verb> [flags]`. Every verb accepts `--json`; entity targets use `--entity-id`, case targets use `--case-id`. Read the operations doc before running a verb.

Session execution with the harness's own web and document tools is the default
(`docs/research/README.md`, "One request and one approval"). Use these verbs when a command is
actually needed; hosted providers are optional.

| Lane | When to use | Exact command |
|---|---|---|
| research-intake | Turn a URL/topic into a proposed lead (fetched, cited, draft research case) | `research-intake --url "<url>" --operator-id "$USER" --session-id "<id>"` |
| discovery-run | Run a bounded adapter discovery campaign against an assembled batch, get yield | `discovery-run --batch <batch.json> --campaign-id "<id>" --countries US` |
| editorial-run / enrichment-run | Check pending leads, run LLM editorial/enrichment, stage packets (never publish) | `editorial-run --subjects <subjects.json> --provider mock --operator-id "$USER" --session-id "<id>"` |
| backfill-entity | Re-run enrichment/backfill for one known entity id | `backfill-entity --entity-id <id> --provider mock --operator-id "$USER" --session-id "<id>"` |
| prose-run | Short-form prose draft for one subject (lighter than story-research-run) | `prose-run --entity-id <id> --provider mock --operator-id "$USER" --session-id "<id>"` |
| story-research-run | Draft/recommend longform `/stories` chapters and entries via citation-gated story packets | `story-research-run --topics <topics.json> --provider mock --operator-id "$USER" --session-id "<id>"` |
| harness-run | Run a thematic study (redlining, urban renewal) and draft ThemeImpactPackets | `harness-run --theme <question> --subjects <source-records.json> --max-subjects 25 --max-relations 25` |
| locate | Census-geocode a sourced address to lat/lng (no LLM). Finding the place is `blackstory-entity-verify`. | `locate --entity-id <id> --address "<address>" --precision institution --operator-id "$USER" --session-id "<id>"` |
| capture-backfill | Snapshot cited URLs into `source_captures`; looks up existing Wayback captures when a fetch fails, and `--wayback` secondary-anchors the rest at Save Page Now | `capture-backfill [--commit] [--wayback] [--max-captures 25]` |
| case-drafting (`attach-evidence`) | Check if a research case is review-ready; fill missing evidence | `attach-evidence --case-id "<id>" --description "<what this fills>" --source-url "<url>" --operator-id "$USER" --session-id "<id>"` |
| triage-graylist (`graylist-read`, `attach-evidence`) | Walk parked/weak-signal candidates; corroborate or recommend | `graylist-read --limit 20` (Postgres only — see doc); `attach-evidence` to corroborate |
| expand | Traverse Wikidata from a seed entity's QID; stage neighbors as review candidates | `expand --entity-id <id> --depth 1 [--commit]` |

## Brand Language

The binding source is the root `brand/` directory (masters, 4-page guide, token files — see
`docs/ui/brand.md` for the full usage contract). Anything an agent ships that a user can see must
follow it.

**Product name:** BlackStory. Core line: *History, pinned to place.* Support line:
*People. Places. Evidence. Context.* Copy is specific over sweeping, evidence before assertion,
pride without spectacle; invite, do not lecture. Never sensational framings or completeness
overclaims.

**Rebrand-stable code trio** (never rename these for a product rename):

| Layer | Value |
|---|---|
| npm packages | `@repo/*` |
| CSS / tokens | `ds-*` / `--ds-*` |
| Env break-glass | `APP_*` |

User-visible string and assets come from `@repo/config` identity helpers / `apps/web/public/brand/`
role-based paths (`lockup-*.png`, `symbol-*.png`, …).

**Issue ids are internal only.** Never put legacy tracker ids (`repo-…`) in user-facing copy, admin
chrome, error strings, or product source comments. Cite ADRs or capability names.

Color, type, radii, imagery and map rules live in `docs/ui/brand.md` and the `brand/` token
files; the numbered rules under "Rules for agents shipping UI" are the short form.

**The mark.** A standalone book-and-pin symbol beside the BlackStory wordmark. Lockup and symbol
are artwork — never reconstruct either by typing the wordmark next to a bare symbol render.
Serve from `apps/web/public/brand/` (masters in root `brand/`).

## UI Design Patterns

**Index:** [`docs/ui/README.md`](docs/ui/README.md) — living pattern catalog and adoption checklists.  
**Component registry:** [`docs/ui/patterns-registry.md`](docs/ui/patterns-registry.md) — reusable modules under `apps/web/src/components/patterns/`.

### Binding docs (read before UI edits)

| Doc | Scope |
|---|---|
| [`docs/ui/PROTECTED-EXPERIENCES.md`](docs/ui/PROTECTED-EXPERIENCES.md) | Memorial + evidence/precision/dignity/public/brand laws |
| [`docs/ui/design-direction-v10.md`](docs/ui/design-direction-v10.md) | Product thesis, visual models, surface law, authority order |
| [`docs/ui/brand.md`](docs/ui/brand.md) | Palette, type, mark, copper discipline |
| [`docs/ui/v10/`](docs/ui/v10/) | Inventory, DiscoveryState, Place anatomy, research, cost, reconciliation |
| [`docs/ui/design-direction-v6-mobile.md`](docs/ui/design-direction-v6-mobile.md) | `@repo/mobile` tab bar, More menu, shell chrome (until v10 mobile packet) |
| [`docs/ui/patterns-*.md`](docs/ui/) | Reusable site patterns (map encoding, record anatomy, …) |
| [`docs/ui/story.md`](docs/ui/story.md) | Voice, microcopy, narrative arc |

v6/v9 surface direction docs are archival or superseded — see [`docs/ui/v10/design-doc-reconciliation.md`](docs/ui/v10/design-doc-reconciliation.md). Do not restore Instrument chrome on `/` from v9 Atlas docs.

Kit implementation: `@repo/ui` (`packages/ui`). Where a pattern doc and the kit disagree on tokens, **the kit wins**; where layout/behavior is specified, **the pattern doc wins**.

### Rules for agents shipping UI

1. **Never invent one-off visual language.** Extend an existing pattern component or update/create the matching `docs/ui/patterns-*.md` in the **same PR/change** as the code.
2. **Check both themes** (`data-theme` light + dark) before calling UI done. Dark is first-class, not an afterthought.
3. **Copper discipline:** ~10–15% of composition; navigational signal only (active filters, primary CTA, evidence markers). Raw Copper Pin never carries body-size text on light canvas.
4. **Flat matte only:** no bevels, shadows, glows, gradients, 3D, or ornamental motion.
5. **Contrast:** WCAG 2.2 AA minimum; verify focus rings and `:focus-visible` on new controls.
6. **Copy:** no em dashes in user-facing strings on touched surfaces.
7. **Map dignity:** no alarm hues for violence-adjacent records; confidence never color-alone; points never sharper than stored precision.
8. **File naming:** lowercase-kebab for new docs, CSS, and components.

When adding a reusable control, prefer `apps/web/src/components/patterns/` + a pattern doc + a row in `patterns-registry.md`. Surface-specific layout stays in route folders (`app/`, `components/home/`, etc.) but must cite its binding direction doc.

## Session completion and branching

Follow `CLAUDE.md`: "Session Completion" and "Branching & Release Policy". Push to `staging`,
never `main`. Run `fnm exec --using=22 -- ./scripts/ci-local.sh` before a staging → main PR.
