---
name: blackstory-prose-review
description: Review BlackStory summaries, context, stories, captions and narrative prose for clarity, dignity, evidence fidelity and formulaic writing. Use after drafting or rewriting; it does not replace source verification or authorize publication.
---

# Prose review

Use [Neo's voice contract](../../../docs/content/neo-voice.md) and the
[fact protocol](../../../docs/methodology/chapter-fact-validation.md).
Do not assume upstream fact review covers words introduced during drafting.

## Review the exact rendered copy

- **Meaning:** compare every factual clause with the reviewed assertion. Check dates,
  counts, firstness, role and credential qualifiers, causality and tense. A summary
  can be false while every structured claim passes. Send a new or changed claim
  back to `blackstory-claim-corroborate`; don't quietly repair its evidence yourself.
- **Reader's question:** does the opening explain who or what this is and why this
  record matters, at the length the surface needs? Cut setup that delays the answer.
- **Specificity:** remove generic acclaim, invented atmosphere, moral instruction,
  empty transitions and the second sentence that only praises the first. Do not
  replace them with new historical details without reopening research.
- **Structure:** compare neighboring entries for repeated openings, adversity-to-triumph
  arcs and identical endings. A sparse record may remain short. No compulsory scene,
  agency ending, second person, rhetorical quota or clause count.
- **Dignity:** name documented actors and their actions; don't adopt dehumanizing
  source language, invent feelings, sensationalize violence or force consolation.
  Quote harmful language only when needed to understand the evidence and attribute it.
- **Uncertainty:** keep any limitation that changes meaning beside the claim, including
  in cards, captions and mobile previews. A method note may explain it further.
- **Voice:** grade against "Who's telling it" in the contract, not against taste. Cover
  the byline and ask whether the passage could pass unchanged as a nomination form, an
  encyclopedia entry or a documentary script. Check the never-list item by item, quoting
  each hit. Read three neighboring records or sections for a shared opening, move or
  ending; a pattern across them is a finding even when each instance is fine alone.
  Performed Blackness (dialect, slang, "we," signals in place of attention) is a
  dignity blocker, not a craft note.
- **Reading:** read aloud for natural cadence. Check links, quotations, headings,
  repeated text and truncation on the destination surface. Interface microcopy follows
  `docs/ui/story.md`; narrative rules must not obscure a button's purpose.

## Findings and decision

Give the exact passage, reader impact, evidence or rule, and the limit of the supported
meaning. Name the defect and don't supply the sentence, except for a quotation or wording
a source fixes exactly; the writer rewrites the paragraph and it's rechecked.
Distinguish **factual blocker**, **clarity/dignity blocker**, **no person is telling
this**, **wrong voice** (someone is telling it, but it's a placard, a script or a house
template instead of Neo), and **optional craft note**. Every rewrite must preserve or narrow the supported
meaning. A mistaken finding can be rebutted with evidence; record the resolution.
Unresolved consequential disputes go to the responsible reviewer. Style preference is
not a factual veto.

**No person is telling this** blocks longform when, tested against the paired samples
in the voice contract, a passage is only facts in a row: no explanation of why, nothing
connected, nothing noticed, or an event with no buildup. Quote the passage and say which
move is missing. It ranks below factual blockers and can't justify an unsupported
sentence. It doesn't apply to short records. For each connective sentence, check that it
adds no fact and that a careful reader wouldn't take it as more than its facts support.

**Wrong voice** blocks longform and new entity copy the same way, below factual blockers.
Quote the passage, name the never-list item or the template it repeats, and leave the
rewrite to the writer. The word-level part of the never-list is also enforced in code
(`findProseVoiceIssues`); a clean run there proves only that those patterns are absent.

Verdict: **pass / revise / blocked on evidence**. Name the draft revision reviewed,
coverage, uninspected surfaces and open findings. Then use
[ringer review](../blackstory-ringer-review/SKILL.md) for publication readiness. This is an
editorial check, not an AI-authorship detector; no phrase blacklist proves quality.
