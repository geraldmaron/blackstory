# Admin audit and studio rebuild (2026-11-10)

What the admin is for, how the owner moves through it, where it broke, what changed on branch
`admin-studio`, and what is still open. Evidence is from the code, the live database (read only),
and screenshots of the running admin taken with the observer session
(`apps/web/scripts/admin-dev-session.mts`).

## What the admin is for

One person runs BlackStory. The admin is where that person does five jobs, in roughly this
order of how often they come up:

1. **Write.** Draft and publish long-form stories and short entries, with sources and record
   links, credited to the owner, Neo (the house editorial identity) or both.
2. **Decide.** Clear what is waiting: submissions, research cases, story packets, requests.
3. **Fix records.** Correct or merge an entity, check its public state.
4. **Bring material in.** Quick add a URL, attach evidence, review the graylist and discovery runs.
5. **Keep the system honest.** Sources, citation health, releases, audit log, switches.

## Critical journeys and where they broke

| Journey | Steps before | Breaks found |
|---|---|---|
| Write and publish a story | Stories, then editor with 7 settings tabs, separate preview route, review, publish | Title and summary edited as form fields; toolbar wrapped to two rows; citations shown as raw ids mid-sentence (`[fox5-georgia]`); slug typed by hand; tags in a newline textarea; preview only of a saved revision in another tab; no bold, italics, outbound links, tables or video possible; contributor profiles managed on a separate page with a hand-typed id |
| Credit an author | Contributors page, then the story's Credits tab | 49 of 50 stories have no credits, so 49 public pages said "Contributor credits not recorded"; the owner's profile existed with an empty bio and no link to his login; the byline read "Name (author, house editorial identity)" |
| Decide what is waiting | Work home, Queue, Inbox, Research cases, Requests | Five views of one question; the home page was hero-metric cards plus a "Jump to" list that repeated the nav, plus a session card |
| Move around | Sidebar grouped by pipeline stage | Two items lit at once on nested routes (prefix match); a 76px empty band above every admin page (the public shell bar's clearance applied where that bar is not rendered) |
| Fix a record, intake, sources | Catalog, quick add, evidence, sources desks | Not rebuilt in this pass; see "Still open" |

## Adversarial review

The plan was challenged by a second model (Codex, read-only against the repo) before any code
was written. Its verdicts and what was done with them:

| Decision | Verdict | Outcome |
|---|---|---|
| Full-screen studio outside the admin shell | Rejected: loses the command palette and route escape | Kept the shell; added focus mode |
| Inline grammar inside the existing prose strings | Needs validation: precedence with `[[id\|Label]]`, round trip | Atoms parse first and are never re-scanned; italic is `_x_` so bold-italic is unambiguous; fixture round trip, 3,000-string fuzz, and a scan of all 50 live stories (no `*`, `_`, links or backslashes in prose) |
| Shared prose enumerator for gates | Incomplete: reference numbering and pull quotes were missed | Numbering, citation integrity, word count, voice and standalone gates all use `storyBlockProseTexts`; pull quotes now render through StoryProse |
| Video embeds | CSP blocks every frame | `frame-src` allows exactly YouTube's privacy domain, Vimeo and Internet Archive in both CSP copies; LOC files play from the existing `media-src`; nothing loads before play |
| Live client-side preview | Needs validation: no client payload for evidence blocks | Preview shows the real server preview of the latest autosaved revision |
| Auto-tagging | Accepted with controls | Suggestions only, with the source records named, one click to accept, never re-applied; theme, era and place are not guessed |
| Slug derived from title | Accepted with controls | Follows the title only until first save; a later change on a published story warns that old links break (there are no redirects) |
| Today and nav regroup | Accepted with controls | Today reuses the queue projection; longest-match activation is tested |

A second Codex pass reviewed the finished diff. Four of its five findings were fixed: link
labels containing `]` vanished on reload; literal `[ref:x]` prose became a citation; editing one
word rewrote legacy punctuation such as `5 * 3`; and moving a card left the details panel on the
wrong block. The fifth is listed under "Still open".

## What changed (branch `admin-studio`)

- **Contract.** `**strong**`, `_em_`, `[label](https://...)` in every prose string; new `table`,
  `video` and `divider` blocks; one tokenizer in `packages/schemas/src/story-inline.ts` used by
  the renderer, editor and gates. Rendered public story markup is byte-identical to before for
  every block type in use, apart from the byline.
- **Byline.** "By Gerald Dagher and Neo", then "Research by" and "Edited by" lines. With no author
  credited the byline is "By Neo".
- **Desk.** Nav grouped by job (Today, Write, Records, Intake, Sources, System). Today: stories to
  pick up, then the oldest open items. People & bylines: id derived from the name, "This is me"
  linking, stories credited.
- **Studio.** `/admin/stories/<slug>` is a manuscript in public reading order (cover, period and
  place, title, summary, byline chips, body) with one margin of disclosure sections ordered by
  when a writer needs them (readiness, address, topics, credits, sources, linked records,
  collection, history). Type `@` to link a record, `/` for blocks, Mod-K for a link, Mod-Shift-K
  to cite. Preview splits the studio with the server-rendered preview of the latest autosave.
  Focus mode (Mod-.) hides the nav and margin. Save, review, publish, rollback, archive and
  restore calls are unchanged.
- **Found while verifying in the browser and fixed.** Today crashed on a client-only button in a
  server component. Mod-K opened the command palette over the link field. The preview iframe was
  blocked by `frame-ancestors 'none'` and then hydrated against a different tree (fixed with a
  dedicated `/preview/embed` route, the only framable admin path). Video-card labels vanished
  under the selection highlight. A new admin API route had no permission rule. Formatting the
  contract cannot store would have paused autosave.

## Owner decisions recorded

- 2026-11-10: AI agents may publish entities, and an approval may be granted from an agent session. Entity publishing therefore does not need an admin button; the admin's job is to show what was published and why.
- 2026-11-10: Publishing a story through the admin keeps requiring a credited person as author (`store.ts` storyBlockers, in place since 2026-10-14). Neo can co-author; Neo-only stories publish through agent sessions.

## Still open

| Item | Why it is open |
|---|---|
| The shell-wide rule `.admin-base-shell a:not([data-baseweb="button"])` makes every admin link copper | Changing it touches every desk; Today overrides it locally for now |
| Catalog, quick add, evidence, sources, citation health, releases and switches desks | Not rebuilt in this pass; SURFACES.md 3.5 lists their defects (three table implementations, no conflict UI, raw filter forms, switches with no toggle UI) |
| Unlinking a staff account from a contributor profile | `access_control.contributor_accounts.user_id` is unique and has no unlink path |
| Story slug redirects | None exist; renaming a published story's slug breaks its links |
| A pasted or dropped image creates an image block but does not keep the file | Uploads need a credit and rights first; the block's details ask for both, then the file is added there |
| Citation numbers in the editor ignore data-block provenance | They can read one or two lower than the published numbers on stories with figures or stats |
| Figure and stat captions and dispute claims are outside the citation, voice and link gates | True before this branch too; they render as plain text. Whether evidence captions must carry citations is a policy call |
| Italics inside a word cannot be stored by the grammar | The editor drops that emphasis with a notice; words are never lost |
| Scheduled publish, a shared media library, focal points for covers | Not requested for this pass |
| `home-first-paint.test.ts` and `SiteFooter.test.tsx` | Fail on the base commit already; unrelated to this work |
