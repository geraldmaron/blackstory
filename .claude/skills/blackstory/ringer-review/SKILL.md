---
name: blackstory-ringer-review
description: Adversarial red-team review of a chapter or long-form piece before publication. Use when a draft is ready to ship, when asked to stress-test prose against hostile readings, bad-faith fact-checks, or context-stripped clips, or when deciding whether a contested claim survives contact with credentialed critics.
---

# Ringer review

Judgment playbook. The evidence base is
[`docs/research/ringer-attack-taxonomy.md`](../../../../docs/research/ringer-attack-taxonomy.md):
which attacks on comparable published work (the 1619 Project, NMAAHC, others) landed,
which bounced, and why. Read it once before the first review; tag findings with its
attack codes (A1–A13).

**Authority rule.** The ringer's correction-forcing findings are hard blockers. The
drafter fixes them or escalates to a human; the drafter never overrules them. The most
damaging story about comparable work was not the error itself, it was "their own
fact-checker was ignored" (A3). This skill exists so that story can never be told
about this project.

**Weighting.** Spend roughly 80% of the pass hardening individual factual claims
against a credentialed skeptic, 20% anticipating the clip. Rhetorical attacks bounce
off well-sourced work; a single unsupported superlative does not.

## The six chairs

Run all six against the full draft. One pass, tagged findings.

| Chair | Simulates | Core question |
|---|---|---|
| The Historian | credentialed specialists in the subfield | Which sentence would a specialist write a public letter about? Which would our own fact-checker flag? (A1, A2, A3) |
| The Producer | hostile-cable segment booker | What are the three most quotable 12-second extracts, read without their surrounding paragraph? (A11) |
| The Opposition Researcher | professional label-attacher | What label attaches here? Which phrase gets recodified? Which affiliation or source becomes the story? (A5, A8) |
| The Literalist | bad-faith fact-check desk | Which word is technically imprecise enough to score "Mostly False"? Every superlative, number, date, and "banned"-class verb. (A4, A10) |
| The Legislator | divisive-concepts drafter | Which sentence gets read aloud in committee as the reason to restrict this? Does it accuse living individuals, or document systems? (A6) |
| The Sympathetic Reader | the audience we actually want | Where does the prose ask me to feel something the evidence has not yet earned? Where does it talk down to me? |

## Scoring

Every finding carries two labels.

**Severity:**

- `correction-forcing` — would force a public change if found after publication.
  Hard-fail; the chapter does not ship with one open.
- `clip-friendly` — survives scrutiny but travels badly out of context. Log it with a
  prepared one-paragraph response; rewrite only if the fix costs nothing true.
- `bounces` — hostile framing with no factual purchase. No action. Named so nobody
  mistakes it for a real finding.

**Fix:** `strike` / `qualify` / `source` / `hold-with-response`.

## The bar

All nine, or the chapter does not ship:

1. Zero `correction-forcing` findings open.
2. Every factual claim resolves to a primary source, or is explicitly written as
   contested with the dispute shown in prose (`docs/content/neo-voice.md` Part V).
3. Every superlative ("first," "only," "largest," "never," "no one") has a source that
   itself makes the superlative claim, or is cut. Same bar as
   [`blackstory-claim-corroborate`](../claim-corroborate/SKILL.md).
4. Every interpretive claim is grammatically marked as a reading; the strongest
   opposing reading of contested evidence is named (claim typing,
   `docs/content/neo-voice.md`).
5. Every quote carries provenance the apparatus can show: repository, record group,
   page, or the published document itself.
6. Every statistic is traced past its most recent repeater to its origin (SIFT
   lateral-reading rule). A number quoted from a book that quoted a paper cites the
   paper, and the dispute about the paper if one exists (A4).
7. Every standalone extractable artifact (chart, list, pullquote, image caption) is
   independently defensible with zero surrounding prose (A7).
8. The two or three likeliest attacks on this specific chapter are prebunked in the
   text or its method notes: the counter-document quoted, the counter-reading named
   and answered first.
9. Every `clip-friendly` finding is logged with its prepared response.

## The line the ringer does not cross

The ringer hardens evidence; it never softens framing. A6 (divisive), A13
(grievance-industry), and the recodified label (A5) are unappeasable by design; their
authors have said so on the record. Chasing their approval costs the work its reason
to exist and buys nothing. Give up every unsupported adjective without a fight; give
up nothing on the moral seriousness of the subject or on truthful, sourced claims
that hostile media will dislike. If a finding's only justification is "this will
anger people who cannot be satisfied," it is `bounces`, and it closes without a
change.

## Output

A findings table (chair, attack code, quoted sentence, severity, fix, proposed
rewrite where fix is not `strike`), the clip log with prepared responses, and an
explicit verdict: **ship / fix-then-ship / hold**. File the findings with the draft;
the log is part of the chapter's record.
