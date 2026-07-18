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

## Brand Language

The binding source is `brand-system/` ("Blap Brand Identity System 3.0.0-final" — see
`brand-system/guide/black-book-brand-guide-final.pdf`). Anything an agent ships that a user can
see must follow it. Where older docs or code disagree (pure-white canvas, Sora display type,
zero-radius rule, code-typed wordmark), the pack wins; BB-096 tracks the reconciliation.

**Idea and voice.** "The book is the record. The pin is the place. The B is the name." Core line:
*History, pinned to place.* Support line: *People. Places. Evidence. Context.* Copy is specific
over sweeping, evidence before assertion, pride without spectacle; invite, do not lecture. Never
sensational framings ("the untold truth they hid from you") or completeness overclaims.

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

**Type.** Inter Display + Inter (display 600–700 at 48–72px fluid; UI 400–600), Source Serif 4
for editorial/longform (400–600), IBM Plex Mono for data, citations, dates, confidence, and
technical labels (400–500). H1 36–48, H2 24–32, body 16–18. All open-source; no licensed fonts.

**Shape.** Radii 8/16/28px (sm/md/lg). Flat matte fills only — no bevels, shadows, glows,
gradients, 3D, or ornamental motion, anywhere, ever.

**The mark.** The Pinned Page symbol IS the first B; visible wordmark text begins "lack Book".
The lockup is outlined artwork — never reconstruct it by typing the name beside the symbol.
Never: a typed second B, stretching, recoloring beyond approved light/dark/monochrome variants,
removing the pin, adding effects, or crowding the clear space (≥ the visible pin width). Use the
compact mark below 32px. Serve from `apps/web/public/brand/` (masters + checksums in
`brand-system/`; when a master changes, re-copy and refresh `asset-manifest.json` +
`sha256sums.txt`).

**Imagery and people.** Place first; evidence visible; people with context — a person is always
identified (PERSON / ROLE / PLACE / YEAR), never anonymous decoration. Avoid generic "Black
history" stock imagery, automatic sepia filters, AI images presented as documentary material,
and maps without source/precision context.

**Map dignity rules (acceptance-level, carried from BB-051).** No red or alarm hues for
violence-adjacent records; no crime-heat rendering; color is never the only signal (confidence
stays glyph-encoded); points render no sharper than stored precision and a coarsened point is
never labeled as an exact address.

**File naming.** Lowercase-kebab file names everywhere, including docs and asset packs
(`readme.md`, `asset-manifest.json`) — no uppercase file names in new work.

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
