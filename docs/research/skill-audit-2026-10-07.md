# BlackStory skill and factual audit: 2026-10-07

VERDICT: Needs validation

The revised skills are suitable for a more disciplined, manually reviewed workflow.
They do not yet establish reliable factual publication or certify the application's
usability. The most important next control is exact final-prose review binding; the
most urgent content work is correcting the six records below through publication review.

## Intent and scope

BlackStory connects Black history to people and places with inspectable evidence. Its
promise depends on honest identity, location, time, relationships and uncertainty, not
on how complete a record looks or how confidently its prose reads.

Reviewed the 19 committed BlackStory skills and shared research-framework entry point,
owning research/prose/UI contracts, relevant implementation, and public release data.
Added one BlackStory experience-review playbook. Also inventoried 145 additional ignored,
machine-local skills; inspected relevant research and frontend examples, not that entire
shared library. Those copies are not maintained by this repository.

The factual audit is risk-based sampling, not a prevalence estimate. Read-only database
snapshot at 2026-10-07T21:53:55.238Z: release
`rel_20260918_dunbar_media_correction_001`, 4,210 entities. The public release artifact's
summaries matched all database summaries; its generated timestamp was
2026-09-20T18:40:46.875Z. Live browser/HTML checks confirmed the reported text. No
production data, release activation, cloud publication, paid model run or schedule changed.

## Confirmed errors and misleading scope

These corrections concern particular assertions, not the truth of the entire biography.
Source pages below were opened in this audit. Proposed wording still needs final editorial
and publication-role review alongside the rest of each record.

| Record and field                             | Released assertion                                  | Finding and proposed correction                                                                                                                                                         | Opened counterevidence                                                                                                                                                                 |
| -------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ent_bill_russell_001`, summary              | Eight titles before two as player-coach             | Nine before the two player-coach titles, eleven total.                                                                                                                                  | [Basketball Hall of Fame biography](https://www.hoophall.com/hall-of-famers/bill-russell-1), paragraph describing the nine-time champions before the two additional titles             |
| Russell, historical context                  | Playing and coaching careers both spent with Boston | Coaching also included Seattle and Sacramento. Remove the Boston-only career assertion.                                                                                                 | [NBA biography](https://www.nba.com/news/history-nba-legend-bill-russell)                                                                                                              |
| `ent_autherine_lucy_ua_001`, summary         | 1955 Brown decision outlawed segregation            | The merits decision was May 17, 1954. Distinguish it from Brown II's 1955 remedial ruling.                                                                                              | [National Archives opinion transcript](https://www.archives.gov/milestone-documents/brown-v-board-of-education), decision/date                                                         |
| Lucy, historical context                     | Expulsion rescinded in 1980                         | Use April 1988.                                                                                                                                                                         | [University of Alabama marker transcription](https://adhc.lib.ua.edu/adhc-omekaS/s/historicalmarkers/item/20), expulsion-reversal passage                                              |
| `ent_carl_stokes_001`, summary/claim/context | Took office January 1, 1968; same day as Hatcher    | Sworn November 13, 1967. Remove the unsupported same-day comparison.                                                                                                                    | [Congressional Record, September 23, 1997](https://www.govinfo.gov/content/pkg/CREC-1997-09-23/pdf/CREC-1997-09-23.pdf), printed H7588 (PDF page 27)                                   |
| `disc_golden_thirteen_q5579862`, summary     | Thirteen graduates received commissions             | Twelve commissioned ensigns and one warrant officer. Preserve the distinction between officers and commissions.                                                                         | [US Naval Institute oral history](https://www.usni.org/magazines/proceedings/1987/may/oral-history-golden-thirteen), introduction distinguishing twelve and one                        |
| `ent_bessie_coleman_001`, summary/claim      | First Black American to hold a pilot's license      | False at that broad scope: Bullard was a qualified pilot earlier. Retain the verified Black-woman distinction; investigate international/civil/military credential priority separately. | [US Air Force history of Eugene Bullard](https://www.af.mil/News/Article/111762/first-african-american-pilot-a-war-hero-during-wwi/), license and pre-August-1917 service chronology   |
| `ent_david_blackwell_001`, summary           | First Black tenured Berkeley professor in 1954      | Conflates arrival/visiting appointment with full appointment. Distinguish visiting in 1954 from full professor in 1955.                                                                 | [Berkeley Statistics history](https://statistics.berkeley.edu/about/history) and [Berkeley obituary](https://news.berkeley.edu/2010/07/15/blackwell/), detailed appointment chronology |

Source fallibility is observable here. The [Encyclopedia of Alabama Lucy entry](https://encyclopediaofalabama.org/article/autherine-lucy/)
itself misdates the Brown merits ruling while giving the 1988 expulsion reversal correctly.
The [NPS Stokes page](https://www.nps.gov/people/carl-b-stokes.htm) has an inconsistent
1968-era chronology; its official host cannot justify January 1. Berkeley's broad lead
and specific appointment chronology also require careful reading. Exact quote matching
and institutional reputation alone would not catch these problems.

Counterchecks that did **not** establish a current false summary:

- William F. Penn's old Yale-firstness error is already absent from the current summary
  and claims. A stale `eraProvenance.quote` still contains the old claim; inspect its consumers.
- Charles Henry Turner's first African American UChicago PhD in 1907 is supported by
  the [university library history FAQ](https://www.lib.uchicago.edu/scrc/archives/frequently-asked-questions-about-uchicago-history/).
- Lucy's degree completion versus conferral year was not classified as a falsehood.
  Neither were suspected Tandy, Nottoway, McCoy or Barbara Jordan formulations without
  sufficient scope-specific counterevidence.

## Release-wide evidence gaps

Ran the existing pure `auditSuperlativeWikipediaOnly` and `summarizeFindings` helpers on
the fetched public catalog. They returned 181 finding rows across 173 entities: 147
`first_to_do_x`, 34 `only_or_oldest`. Of those finding rows, 123 concern entities whose
summary uses superlative language and 57 concern entities with no non-Wikipedia claim.
Those are row counts, not necessarily distinct entity counts. This reproduces the cohort
already tracked by `repo-z97f`; it is not 173 proven falsehoods.

The snapshot also has 1,931 entities with one citation-HREF hostname, including 371 with
Wikipedia alone; `repo-4bkxp` already tracks single-host evidence. A hostname is not an
independent work lineage. Sixty-one entities have an inclusion-basis row with empty
`evidenceIds`; none has a dangling nonempty evidence ID in this snapshot. These observations
identify review needs, not an automatic delete list. Claim labels include 7,496 high,
1,655 medium and 3,029 low, contradicting the old citation document's “zero low” statement.

## Method defects and changes

| Finding                                | Why it fails                                                                                                                      | Change in this branch                                                                                                               |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reviewed claims do not cover all prose | `assessPublicationClaims` accepts `id` and `claims`; summary/context may add assertions outside it.                               | All visible factual clauses require evidence mapping and exact-revision review. Runtime enforcement explicitly remains outstanding. |
| Retrieval called corroboration         | `corroborate-source.ts` uses name-token matches and ranked hosts, without the assertion to verify.                                | Distinguish candidate discovery, entailment, source fitness, independent lineage and contradiction review.                          |
| Prestige/source-count shortcuts        | A fit institution may still err; different domains can repeat one work.                                                           | Claim-relative criticism, counterexample searches, work lineage, scoped single-source attribution, no majority-vote resolution.     |
| Formulaic voice                        | Compulsory scene openings, obstacle/pathway pairs, agency endings and rhetorical budgets encourage selection bias and repetition. | Replace those rules with reader question, supported structure, natural cadence and explicit anti-padding checks.                    |
| Caveats hidden from readers            | A method note cannot repair a misleading summary or mobile excerpt.                                                               | Keep material qualifiers beside every independently read assertion.                                                                 |
| Overstated evaluation                  | The policy corpus was described as 120 examples and implied semantic evidence quality.                                            | Correct to 125; distinguish policy fixtures, existing held-out passage/identity tests and transparent skill development cases.      |
| Contradictory location/publish advice  | Allowed city precision conflicted with a centroid ban; preview treated missing enrichment as if it were false data.               | Honest representative city anchors permitted; misleading displayed values block; truly unknown fields can remain absent.            |
| Document-type overclaim                | Relationship skill said a deed proves residence.                                                                                  | Separate ownership from residence, case allegations from findings, incorporation from operating history.                            |
| Intake routing risk                    | Hostile mail and parked research candidates could be conflated; valid criticism could be discarded with abuse.                    | Preserve quarantine and safe handling while allowing a separately sanitized factual question to be investigated.                    |
| Stale surface repair directions        | Same skill both prohibited and demanded workflow dispatch.                                                                        | One authorized artifact publication path, then artifact/cache/live verification; remove old incident counts as rules.               |
| UI guidance drift                      | UI index listed retired fonts/shadow exception; mobile inventory described obsolete tabs.                                         | Reconcile these specific facts against current brand/navigation sources and add task-based web/native review.                       |

All eight CLI pointers remain pointers to one operations reference. Editorial/story pointers
now route to the same drafting and review loop; graylist explicitly requires intake clearance.
Coverage-target retains its useful distinction between catalog gaps and historical absence.
Identity, relationship, preview, source, prose and surface playbooks retain role separation,
safe retrieval and dignity constraints. No runtime schema or public API changed.

Searches covered this repo's evaluation/research/UI paths, sibling project skills and installed
skills. Existing held-out evaluation, source clients, lineage and UI patterns are reused.
The new experience skill adds BlackStory task/evidence/native routing to existing usability
principles; it does not add a UI library, competing component system or benchmark runner.

## Observed interface problems

Applied the experience review to Golden Thirteen and its correction entry on the live site
at 390×844. DOM measurement showed viewport and scroll width both 390, so no horizontal
page overflow was observed in that state. Sources and the correction link were present.
Following the correction link retained `target=disc_golden_thirteen_q5579862` in the URL
but left the `targetRecordId` field empty. No form was submitted; viewport override was reset.

The same record's “Why this is here” displays internal classification history including
`documented_site` and a retired fallback explanation, sourced from
`packages/domain/src/entity-status.ts`. It also presents a generic site criterion for a
group of officers. Review both the public definition and this record's evidence basis.
These are observed task/content defects, not merely aesthetic preferences.

This was a narrow mobile-web observation. Native Release launch, screen-reader operation,
both-theme coverage, text enlargement, offline recovery, performance and broader task testing
were not performed. The new skill specifies them; it does not claim they passed.

## Shared skill findings outside the committed set

The ignored `frontend-design/accessibility` copy states that WCAG 2.2 is required by ADA
and Section 508. Opened [DOJ Title II guidance](https://www.ada.gov/resources/2024-03-08-web-rule/)
specifies WCAG 2.1 AA, while [Section508.gov](https://www.section508.gov/develop/applicability-conformance/)
specifies WCAG 2.0 AA. A project's WCAG 2.2 target must not be presented as a blanket legal
requirement. This is a source-version correction, not a legal compliance determination.
The generic UX skill's fixed 5–7-navigation-item rule is an unsupported universal heuristic;
the researcher skill's primary-only and freshness shortcuts need domain boundaries.
The shared library needs correction at its owner/sync source, not an ignored local patch.

## Adversarial challenge of the revised approach

Steelman: exact evidence, source criticism and independent review can prevent known failure
classes while preserving sparse and community history. Shared methods across prose formats
reduce the opportunity for a polished summary to evade scrutiny. Reusing current contracts
avoids a second research system.

1. **Strongest failure mode, serious:** an operator skips the prose map or edits a summary
   after review; structured claims still pass and false copy ships. A procedural skill
   cannot enforce exact revision binding. Smallest remedy: a publication check covering
   every visible prose field and invalidating changed evidence/text.
2. **Best alternative, serious:** a database-bound assertion/prose review contract would
   fail closed even when a skill is not loaded. It is stronger than more prompting and
   is the recommended next engineering control; it still needs factual adjudication.
3. **Load-bearing claims, serious:** opened evidence supports the specific corrections and
   inspected code supports the gate gap. No blind study establishes that revised prompts
   generalize. Smallest remedy: independently adjudicated unseen claim/prose cases using
   the existing evaluation schemas, with false acceptance/rejection reported separately.
4. **Assumption inversion:** if primary/institutional evidence is wrong or unavailable,
   the method must accept appropriate scholarship/community evidence and honest uncertainty.
   The revised source-fitness and single-record rules permit this; source-count quotas did not.
5. **Who bears the cost:** represented people and readers pay for errors and exclusion;
   operators pay for overlong review. Risk-based review and keeping legitimate unknowns
   visible limit both. Forced completeness and automatic uplift fail this test.
6. **Hostile expert:** the easiest challenge is that known live errors remain while the
   method is being improved. Correct the released assertions through review, preserve
   errata, and verify derivatives. Do not call changed instructions a repaired catalog.

Verification record

- Steelman stated: answered, “exact evidence, source criticism and independent review.”
- All six run: answered; serious findings in enforcement and generalization, plus live remediation.
- Findings concrete: three serious control/validation findings; no new fatal method contradiction identified.
- VERDICT: needs validation.
- Self-review: shared-context, disclosed; no independent reviewer or blind model run claimed.
- No improvement drift: challenge findings identify breakage; changes are documented separately above.
- Intake: readback preserved the audit and added hardening, prose and web/native scope; no user blocker.
- Investigative research: opened evidence, contrary cases and coverage limits recorded; no prevalence claim.
- Skill creation: structure/link/behavior checks are recorded below; prompts are procedural controls.
- Implementation verification: not applied as a code-change workflow; this branch changes skills and documentation only.
- Commit-and-pr: full staged diff reviewed for the single scope “skill hardening and its evidence record”; no secrets found; branch `codex/research-skill-hardening`; imperative summary and explanatory body follow the observed repository convention; no PR requested or opened; commit/push authorized by the user's project instruction “all changes committed AND pushed.”

## Tracked follow-through

- `repo-bx2d7`: six record corrections and derivative verification.
- `repo-zg87h`: exact prose-review binding and unseen evaluation.
- `repo-7aru8`: correction form loses record context.
- `repo-lmhel`: internal classification history in public explanations.
- `repo-9a2ao`: shared skill owner/sync corrections.
- Existing `repo-z97f` and `repo-4bkxp`: superlative and single-host cohorts; not duplicated.

## Validation record

- Skill structure: Python loaded the installed skill-creator `quick_validate.py` and called
  `validate_skill` for every BlackStory skill plus research-framework: **21 checked, zero
  failures**. This checks frontmatter/name/description/scaffold shape, not research accuracy.
- Affected CI: `fnm exec --using=22 -- ./scripts/ci-local.sh --base 461c10ab`: **passed**
  the selected governance lane on Node 22.23.1 / pnpm 9.12.3. Code/mobile/Python/security
  lanes were gated off for this documentation-only diff. Remote ruleset validation was
  explicitly skipped by the script. This is not a full application test pass.
- Link inspection: a Python check resolved Markdown local targets in changed files. It found
  the old missing `patterns-how-it-works.md` reference; source inspection showed a retired
  redirect route, so the index entry was corrected. Final results recorded below.
- Formatting: a forced Prettier check (normally Markdown is ignored by root formatting)
  initially identified 14 files needing normalization. Final result recorded below.
- Factual/browser evidence: read-only release and live page checks described above; the
  [development case walkthrough](skill-review-cases.md) records decisions and self-review limits.
- Not run: paid/blind model evaluation, native/device QA, comprehensive accessibility and
  catalog-wide historical adjudication. No claim of passing those checks is made.

Final local checks: 160 relative Markdown links resolved with zero missing targets.
`fnm exec --using=22 -- pnpm exec prettier --check --ignore-path /dev/null` run with
all 27 changed/new Markdown paths passed after normalization. `git diff --check` passed.
These outcomes validate the files, not factual accuracy or native behavior.
