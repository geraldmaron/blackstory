# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

## Mobile local QA (agents)

**Default for mobile smoke / "app works locally": Path A (prod-like).** Production never uses Metro; do not open the Debug dev client and expect prod behavior.

| Goal | Command | Pass signal |
|---|---|---|
| Agent gate (mobile ready) | `pnpm mobile:ios:verify` | api-public live + Release app on booted Simulator; **Metro not required** |
| Launch / rebuild embedded bundle | `pnpm mobile:ios:release` | Release install; relaunch without packager URL |
| Relaunch only | `pnpm mobile:ios:launch` | App runs from embedded bundle |

**Path B (hot reload only):** `pnpm dev:mobile` / `pnpm dev:mobile:verify` when actively editing JS. Never claim mobile healthy from `127.0.0.1:8081` `/status` alone while the iOS dev client may still target another LAN port (`:8082`, `:8083`). Path B verify must pass LAN bundle smoke + simulator packager alignment.

See `apps/mobile/README.md` for setup (`API_BASE_URL=http://127.0.0.1:8080` in `apps/mobile/.env.local`).

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

**Beads are internal ops only.** Never put bead ids in user-facing copy, admin chrome, error
strings, or product source comments. Cite ADRs or capability names. Tracker prefix is `repo-`.

**Color.** Black and paper lead; copper points.

| Role | Hex |
|---|---|
| Black Ink (primary ink; dark canvas) | `#0A0A0A` |
| Charcoal (dark surface) | `#161616` |
| Archive Paper (light canvas) | `#F4EFE5` |
| Surface (raised light surface) | `#FBF8F2` |
| Copper Pin (graphic accent only) | `#B86B2A` |
| Copper text on light | `#8E4F2A` |
| Copper text on dark | `#D07A32` |
| Page Sand (decorative fill) | `#D8A178` |
| Stone (secondary text) | `#6D675F` |
| Rule (hairlines) | `#D7D0C4` |

Copper is a navigational signal, not a decorative wash: roughly 10–15% of any composition,
reserved for the moment of orientation (active locations, selected filters, primary actions,
evidence markers). Raw Copper Pin never carries body-size text on light canvas. Dark theme is
first-class, not an afterthought.

**Type.** Sora SemiBold headlines; Inter UI/body; Source Serif 4 editorial/longform; IBM Plex Mono
for data, citations, dates, confidence, and technical labels. All open-source; no licensed fonts.

**Shape.** Radii 8/16/28px (sm/md/lg). Flat matte fills only — no bevels, shadows, glows,
gradients, 3D, or ornamental motion, anywhere, ever.

**The mark.** A standalone book-and-pin symbol beside the BlackStory wordmark. Lockup and symbol
are artwork — never reconstruct either by typing the wordmark next to a bare symbol render.
Serve from `apps/web/public/brand/` (masters in root `brand/`).

**Imagery and people.** Place first; evidence visible; people with context — a person is always
identified (PERSON / ROLE / PLACE / YEAR), never anonymous decoration. Avoid generic "Black
history" stock imagery, automatic sepia filters, AI images presented as documentary material,
and maps without source/precision context.

**Map dignity rules.** No red or alarm hues for violence-adjacent records; no crime-heat
rendering; color is never the only signal (confidence stays glyph-encoded); points render no
sharper than stored precision and a coarsened point is never labeled as an exact address.

**File naming.** Lowercase-kebab file names everywhere, including docs and asset packs —
no uppercase file names in new work.

## UI Design Patterns

**Index:** [`docs/ui/README.md`](docs/ui/README.md) — living pattern catalog and adoption checklists.  
**Component registry:** [`docs/ui/patterns-registry.md`](docs/ui/patterns-registry.md) — reusable modules under `apps/web/src/components/patterns/`.

### Binding docs (read before UI edits)

| Doc | Scope |
|---|---|
| [`docs/ui/brand.md`](docs/ui/brand.md) | Palette, type, mark, copper discipline, supersessions |
| [`docs/ui/design-direction-v6-home.md`](docs/ui/design-direction-v6-home.md) | `/` layout beats, hero, footer-on-home |
| [`docs/ui/design-direction-v6-explore.md`](docs/ui/design-direction-v6-explore.md) | `/explore` layout, Surface instruments, records rail |
| [`docs/ui/design-direction-v6-history.md`](docs/ui/design-direction-v6-history.md) | `/history` unified find-in-time (search merged), decade scrubber, rip list, facets |
| [`docs/ui/design-direction-v6-about.md`](docs/ui/design-direction-v6-about.md) | `/about` product thesis, Surface stack, shared gutter mosaic |
| [`docs/ui/design-direction-v6-memorial.md`](docs/ui/design-direction-v6-memorial.md) | `/memorial` names-only memorial wall + full alphabetical list |
| [`docs/ui/design-direction-v6-stories.md`](docs/ui/design-direction-v6-stories.md) | `/stories` longform edition, gutter mosaic, Surface stack |
| [`docs/ui/design-direction-v6-methodology.md`](docs/ui/design-direction-v6-methodology.md) | `/methodology` transparency receipt, evidence pipeline, Surface stack |
| [`docs/ui/design-direction-v6-books.md`](docs/ui/design-direction-v6-books.md) | `/books` challenged-titles edition, catalog rail, gutter mosaic |
| [`docs/ui/design-direction-v6-data.md`](docs/ui/design-direction-v6-data.md) | `/data` Census + indicators edition, gutter mosaic, chart panels |
| [`docs/ui/design-direction-v6-themes.md`](docs/ui/design-direction-v6-themes.md) | `/themes` impact browse, packet detail, shared gutter mosaic |
| [`docs/ui/design-direction-v6-entity.md`](docs/ui/design-direction-v6-entity.md) | `/entity/[id]` record edition, anatomy panel, safe fail states |
| [`docs/ui/design-direction-v6-mobile.md`](docs/ui/design-direction-v6-mobile.md) | `@repo/mobile` tab bar, More menu, shell chrome, theme tokens |
| [`docs/ui/design-direction-v5.md`](docs/ui/design-direction-v5.md) | Non-home surfaces, shell chrome, fixed-ink footer (non-home) |
| [`docs/ui/patterns-*.md`](docs/ui/) | Reusable site patterns (browse mode, edition fact icon, …) |
| [`docs/ui/story.md`](docs/ui/story.md) | Voice, microcopy, narrative arc |

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

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
