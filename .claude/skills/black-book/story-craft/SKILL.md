---
name: black-book-story-craft
description: Use when drafting or recommending longform /stories articles from archive evidence using citation-gated story research packets. Triggers on "story research", "draft a story", "recommend stories", "story craft", "story packet".
---

# Story craft (citation-gated, staging only)

Assembles recommendable longform stories for `/stories` using the **research linking
method** reverse-engineered from strong oral storytelling — not the viral rhetorical
costume. LLM drafts stay proposals. Human approval maps an approved packet onto
`StoryRecord` in `apps/web/src/data/stories-seed.ts`. There is no auto-publish.

Brand register: [`docs/ui/story.md`](../../../docs/ui/story.md) — place-first, evidence
before assertion, proud/precise/unflinching, **never trauma-forward as the default lead**.

Domain: `@repo/domain` → `story-research/` (`story.research.packet.v1`).
CLI: `story-research-run` → optional `--commit` stages `story_packet` quarantine only.

## Ten research moves (keep)

1. **Thesis question** — one sentence the story answers.
2. **Start-line relocation** — name the conventional middle; push earlier with a checkable origin.
3. **Named anchors** — person + date + place + instrument when possible.
4. **Omitted actors** — who the popular version erased.
5. **Winner-built test** — constitutions, treaties, statutes, budgets — not campaign rhetoric.
6. **Mechanism layer** — legal / economic / institutional why.
7. **Pattern cases** — capped parallels across place or time.
8. **Authority witnesses** — unexpected corroborators (only as published cites or authority leads).
9. **Present bridge** — structural continuity + verification off-ramp the reader can check.
10. **Cite map** — every load-bearing sentence maps to a published claim/fact/entity or stays `needs_evidence`.

## Hard bans (drop)

- Trauma-as-hook / graphic violence as the opening paragraph.
- Unsourced sweeping claims (“every continent,” market billions without a cite).
- Personal family testimony as proof (living-person / privacy rules).
- Conclusory procedural language outside constitution vocabulary.
- Treating LLM confidence or authority-host URLs alone as publication authority.
- Open-web scrape-as-truth. Authority hosts (`AUTHORITY_HOST_SUFFIXES`) produce **leads**, not silent body facts.

## Topics file

```json
{
  "topics": [
    {
      "topicId": "topic-alamo-start-line",
      "title": "Before the battle cry",
      "eraLabel": "1821–1848",
      "placeLabel": "Texas",
      "relatedEntityIds": ["ent_alamo_mission"],
      "relatedFactIds": ["BB-F-TX-1836"],
      "publishedClaims": [
        {
          "id": "claim_clarissa_indenture",
          "workflowStatus": "accepted",
          "publicationStatus": "published",
          "label": "Clarissa indenture",
          "role": "named_case"
        }
      ],
      "authorityLeadHints": ["https://www.loc.gov/item/example/"]
    }
  ]
}
```

## Dry-run (default)

```bash
OPERATOR_CLI_PRIVACY_PEPPER=dev node --conditions development --import tsx \
  packages/operator-cli/src/bin.ts story-research-run \
  --topics /tmp/story-topics.json \
  --provider mock \
  --operator-id "$USER" --session-id "cursor-$(date +%s)" --identity-source cursor_session
```

Providers: `mock` (default), `openrouter`, `ollama`. Pass `--model …` when not using mock.

## Commit (stage only)

Add `--commit` only after the owner reviews JSON. That writes quarantine `story_packet`
proposals (and may open draft research cases for `recommend` / `needs_evidence`).
There is no `--publish` / `--promote`.

## Human approval handoff

1. Sign in at the admin portal: `http://localhost:3001/login` (Firebase
   email/password — provision operators under Authentication in the Firebase Console).
2. Open **Story review**: `http://localhost:3001/stories/review`.
   Default queue is **pending** human review. Use status chips, search, filters,
   sort, multi-select, and bulk approve / needs-evidence / reject (cap 50).
3. Approve returns seed handoff JSON only — paste into `apps/web/src/data/stories-seed.ts`.
   Nothing auto-publishes.
3. Inspect `validationIssues`, cite map, and draft body.
4. **Approve** records a review decision and returns seed handoff JSON — it does **not**
   publish. Paste into `apps/web/src/data/stories-seed.ts`.
5. Reject / needs_evidence updates the review record for follow-up research cases.

CLI `--commit` only stages quarantine; the portal is where you review.

## Never

- Never call promotion gates or release activation.
- Never paste unresolved or unpublished cites into seed stories.
- Never lead with graphic violence to “earn” attention.
- Never invent market figures, continental claims, or family proof.
