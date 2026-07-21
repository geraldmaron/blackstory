# Story rewrite human review

Staged longform rewrites live under `.cache/story-rewrites/{slug}.json`. They are
**artifacts only** — never copied into `public-story-seed` or published releases without
explicit owner approval per story.

## Run the lane

**Mock (no secrets, workflow validation):**

```bash
node --conditions development --import tsx packages/firebase/scripts/rewrite-seed-stories.ts
```

**Live OpenRouter (Kimi K2.5 quality roster):**

```bash
run-with-dev-secrets -- \
  STORY_REWRITE_LLM_PROVIDER=openrouter \
  node --conditions development --import tsx packages/firebase/scripts/rewrite-seed-stories.ts
```

Optional flags: `--slug before-the-battle-cry`, `--output .cache/story-rewrites`,
`--provider mock|openrouter|hybrid`, `--model moonshotai/kimi-k2.5`.

Each artifact JSON includes `draft`, `wordCount`, `originalWordCount`,
`validationIssues`, and `rawModelContent`.

## Automated gates (must pass before human review)

- At least **four** body sections
- At least **900** words
- At least **2×** the seed story word count
- No paragraph over **1800** characters
- Public schema shape: `{ body: [{ heading?, paragraphs[] }] }`

Mock artifacts satisfy these gates for workflow testing. Live Kimi rewrites must pass the
same checks; non-empty `validationIssues` means do not approve yet.

## One-by-one review checklist

Review **one slug at a time**. Do not batch-approve all five.

1. **Open the artifact** — `.cache/story-rewrites/{slug}.json` and the live seed at
   `/stories/{slug}` (or `packages/domain/src/publication/public-story-seed.ts`).
2. **Thesis preserved** — Title, dek, era, place, and start-line relocation match the seed
   intent; the rewrite expands rather than pivots.
3. **Evidence-bound** — Every factual claim traceable to `draft.sources` labels/URLs or
   seed prose; no invented quotations, dates, names, statistics, or motives.
4. **Place-first** — Opening orients to `placeLabel`; map dignity rules hold (no trauma
   hooks, spectacle, or anonymous people).
5. **Structure** — Four to six sections with clear headings; verification/off-ramp
   paragraph tells the reader what to check.
6. **Voice** — BlackStory editorial rules: evidence before assertion, specific over
   sweeping, pride without spectacle.
7. **Related entities** — `relatedEntityIds` unchanged unless you deliberately amend with
   catalog evidence.
8. **Validation** — `validationIssues` is empty; if not, reject or re-run the lane.
9. **Decision** — Approve for publication staging, request another rewrite, or keep seed
   until evidence supports expansion.

Record the decision outside the artifact (issue tracker or release notes). Publication of an
approved rewrite is a separate, explicit step — not part of this lane.

## Seed slugs in scope

| Slug | Title |
| --- | --- |
| `before-the-battle-cry` | Before the battle cry |
| `what-the-winners-wrote` | What the winners wrote |
| `the-log-cabin-costume` | The log cabin costume |
| `twelve-years-then-redemption` | Twelve years then redemption |
| `after-the-second-reconstruction` | After the second reconstruction |

## Remaining blockers for live quality

- **OpenRouter credentials** — `OPENROUTER_API_KEY` via `run-with-dev-secrets` (1Password).
- **Model availability** — Roster rotates on failure (`STORY_REWRITE_MODELS` in `.env.example`).
- **Human publication** — Approved rewrites still require a separate promote/publish path;
  this lane never writes Firestore or seed files.
