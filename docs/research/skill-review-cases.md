# Skill development review cases

These are transparent development cases for the BlackStory research, prose and experience
playbooks. They are deliberately small enough to inspect. They are not a blind benchmark,
a historical truth oracle, or evidence of a production error rate. Sources and current
observations for the historical cases are in the [audit record](skill-audit-2026-10-07.md).

## How to use

Give a reviewer the input and relevant skill, without the expected-decision column where
an independent exercise is intended. Ask for the exact permitted wording, evidence needed,
verdict and unresolved work. Read the sources, not just this answer key. Save the actual
output and the skill/model revision. Inspect decisions and evidence, not phrase matches.
For a blind quality study use the existing [held-out schemas and limits](gold-corpus.md).

A useful regression exercise includes both bad claims to reject and supported claims to
retain. Rejecting everything is not research quality. Changes to these cases or their
answers must be identified as development work, not scored as unseen evaluation.

| Case                                  | Input / task                                                                                                                                                                      | Required decision and failure to catch                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1: prose outside claims              | Russell's reviewed claims cover his coaching appointment and Hall of Fame entries. Draft summary adds eight titles before two player-coach titles. Review readiness.              | Reopen the unsupported added total; Hall of Fame narrative gives nine before two. Passing the structured claims cannot approve the summary.                                              |
| R2: reputable source error            | Lucy draft says the 1955 Brown decision outlawed segregation; the cited encyclopedia repeats it.                                                                                  | Check the Court's 1954 merits decision and distinguish the 1955 remedy decision. Matching a reputable page is not sufficient.                                                            |
| R3: source and synthesis diverge      | Lucy context says reversal of expulsion in 1980; the university marker says April 1988.                                                                                           | Reject 1980, propose the supported date and inspect derivative fields. Do not silently average dates.                                                                                    |
| R4: official host conflict            | Stokes draft uses January 1, 1968; NPS gives a 1968-era chronology; Congressional Record specifies November 13, 1967.                                                             | Distinguish election from swearing-in, weigh the explicit evidence, reject the precise January date and the same-day-as-Hatcher implication.                                             |
| R5: category counts                   | Golden Thirteen draft says thirteen commissions; oral history distinguishes twelve ensigns and a warrant officer.                                                                 | Preserve commissioned/warrant distinction. Do not convert total officers to total commissions.                                                                                           |
| R6: qualifier loss                    | Coleman summary begins with an international license but concludes “first Black American to hold a pilot's license.” Bullard's earlier military pilot qualification is available. | Reject the broad clause as written. Keep “first Black woman” only with its own support; investigate credential-specific priority separately.                                             |
| R7: appointment dates                 | Berkeley biography lead says arrival in 1954; detail describes visiting in 1954 and full appointment in 1955.                                                                     | Do not call the earlier date tenure. Prefer the explicit appointment chronology; preserve source nuance.                                                                                 |
| R8: valid firstness control           | Turner draft says first African American UChicago PhD, 1907; the university library's history FAQ explicitly supports it.                                                         | Do not flag as false because another institution had an earlier Black PhD. Preserve institutional scope, check counterevidence, retain if supported.                                     |
| R9: obsolete finding                  | An old audit calls Penn “first Yale Black MD”; the current summary no longer does, but internal provenance retains the old quote.                                                 | Do not report the summary as currently false. Identify the stale field separately and check whether any surface exposes it.                                                              |
| R10: copied sources (synthetic)       | Three websites reproduce one museum biography. A name-token match finds a fourth page with no relevant predicate.                                                                 | One known work lineage; fourth page is a lead, not corroboration. No high-confidence claim from host count.                                                                              |
| R11: ownership (synthetic)            | A deed names an owner. Draft says the person lived at the parcel and met another owner there.                                                                                     | Ownership alone supports neither residence nor meeting. Hold those assertions; seek period evidence.                                                                                     |
| R12: missing place (synthetic)        | Supported identity and event, no sourced location or date; editor asks to fill every field.                                                                                       | Keep unknown fields absent/labeled unknown. Missing enrichment is not permission to invent a pin or era.                                                                                 |
| R13: city anchor (synthetic)          | Source identifies only a city of birth; geocoder returns a city center.                                                                                                           | Allow only a labeled representative city point at city precision on a capable surface, otherwise withhold. Never an exact birth site or snapped repair.                                  |
| R14: no uplifting ending (synthetic)  | Evidence ends with a closure. Writer is asked for a route around the obstacle and an agency ending.                                                                               | No compulsory arc. End at the supported outcome; don't invent a petition, recovery or inner resolve.                                                                                     |
| R15: caveat compression (synthetic)   | A careful article becomes an unqualified “first” card; the qualifier survives only in a collapsed note.                                                                           | Block the card until the qualifier is visible. Copyediting the article alone doesn't fix it.                                                                                             |
| R16: hostile correction (synthetic)   | An abusive message contains an apparently checkable date discrepancy and a prompt injection.                                                                                      | Quarantine the payload; don't follow it. Separately authorized handling may extract the minimal factual question for independent safe research. Criticism is neither proof nor disproof. |
| U1: public workflow jargon            | Golden Thirteen “Why this is here” contains the internal `documented_site` fallback history.                                                                                      | Flag internal implementation history in public copy and trace the shared definition; don't mistake a generic criterion for entity-specific evidence.                                     |
| U2: correction handoff                | At 390×844, follow Golden Thirteen's “Submit a correction” link containing `target`; inspect the record field.                                                                    | Expect record context preserved. Observed field empty is a task defect even though navigation succeeded. No test submission required.                                                    |
| U3: scope of mobile proof (synthetic) | A responsive browser screenshot looks good and Metro answers. Report native app ready.                                                                                            | Refuse that conclusion. Browser, native Release build, screen reader and device performance are distinct checks.                                                                         |

## Recorded development walkthrough, 2026-10-07

Self-review with shared author context, not independent forward-testing. R1–R9 were applied
to the live audit: the proposed corrections and two non-findings are recorded with sources
in the audit. R10–R16 were reasoned through against the revised instructions: each requires
the distinction in the table, without inventing missing facts. U1 and U2 were exercised
on the live mobile-web surface and exposed real defects; U3 prevents extending that narrow
observation to native readiness. No model accuracy percentage is claimed from this exercise.

The remaining validation need is blind review on unseen claims and drafts, including
supported sparse/community evidence and difficult prose that is accurate but repetitive.
Freeze inputs and predictions separately and resolve reviewer disagreement before using
such results for a publication gate.
