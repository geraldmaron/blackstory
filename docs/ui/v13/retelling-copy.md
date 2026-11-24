# The retelling's copy: one sentence a scene

**Status:** first drafts, 2026-11-23. **Provisional.** The first line of each scene is wired in
`apps/web/src/app/front/retelling-copy.ts`; the two alternatives are for the owner and a prose
review (`docs/ui/story.md`, `docs/content/neo-voice.md`). Neo and the prose review have not read
these.
**Rule (`docs/ui/DESIGN.md` section 9.7):** a scene's sentence says only what its word means. It
makes no claim about history, so it needs no source. It names no person, year or count.

The rules these were written to: short declarative sentences; no "we"; no rhetorical question;
no exclamation point; no dash; no colon; American English; at most one line on the page that
reads as an epigram. A unit test holds the mechanical ones (`retelling-picks.test.ts`).

| Scene | Word          | Wired (first draft)                            | Alternative A                                      | Alternative B                                |
| ----- | ------------- | ---------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| 1     | History       | History is the story that got told, so keep going and watch the word change. (Changed 2026-11-23 with the first screen's rebuild; was: History is the record of what happened.)        | History is what happened, and what was kept of it. | History is the past, as it was written down. |
| 2     | _His_ story   | His story is one man’s part of it.             | His story is what one man did, and where.          | His story belongs to one man.                |
| 3     | _Her_ story   | Her story is one woman’s part of it.           | Her story is what one woman did, and where.        | Her story belongs to one woman.              |
| 4     | _Your_ story  | Your story is the part nearest you.            | Your story starts where you live.                  | Your story is the part with your town in it. |
| 5     | _Their_ story | Their story is what many people made together. | Their story belongs to everyone who built it.      | Their story is the part no one made alone.   |

Scenes 2 and 3 are deliberately the same sentence with one word changed. That is the brand's
own move (the word changes, "story" holds), and it keeps the page from saying anything about men
that it does not say about women.

Watch for: "one man's part of it" leans on scene 1's "it" (the record of what happened). If
scene 1's sentence changes, read 2 and 3 again. Alternative B for scene 1 ("as it was written
down") edges toward a claim about who wrote history; it is the least safe of the three.

## Scene 6

Not provisional: the brand line, set under the official wordmark artwork.

> History, pinned to place.

Provisional: the archive's one sentence. It carries the count of published records as a number
in a sentence, read from the live catalog, and says what a dark place means.

|       | Sentence                                                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wired | BlackStory is an archive of 4,403 sourced records of Black history in the United States, each pinned to the place it happened, and the dark places on this map are the ones not researched yet. |
| A     | BlackStory is an archive of 4,403 sourced records of Black history in the United States, each pinned to its place. A dark place on this map has not been researched yet.                        |
| B     | BlackStory pins 4,403 sourced records of Black history to the places they happened, and where this map is dark, the research has not reached yet.                                               |

The task asked for one sentence; alternative A is two and reads more easily aloud.

## Other words on the page

| Where                     | Words                                                                                                      | Note                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Rail                      | History, His story, Her story, Your story, Their story, BlackStory                                         | The six words, as links                                                                                |
| Throughout                | Skip to the archive                                                                                        | A link to the map                                                                                      |
| Between scenes            | Down to Tallahassee, Florida. About 960 miles northeast to Auburn, New York. Up to the whole country.      | Distance and direction only, computed from the two records. Never "then", "next" or "from there"       |
| Scene 4                   | Type a town.                                                                                               | The field's prompt, from section 9.7                                                                   |
| Scene 4                   | Use my location                                                                                            | A separate button                                                                                      |
| Scene 4, an answer        | The nearest records to Tuskegee, Alabama                                                                   | Then up to three record names, each with its distance                                                  |
| Scene 4, nothing near     | Nothing within 50 miles of Tuskegee, Alabama is researched yet. The nearest record is (name), 212 mi away. | Plain, and true by arithmetic                                                                          |
| Scene 4, no script        | This field needs JavaScript to answer.                                                                     |                                                                                                        |
| Scene 6                   | How coverage works                                                                                         | Link to Method                                                                                         |
| Scene 6, returning reader | Watch the opening                                                                                          | Link back to scene 1                                                                                   |
| Contents                  | In the archive                                                                                             | The contents' heading                                                                                  |
| Contents                  | Archive, Stories, Data, Memorial                                                                           | Each followed by its own line from the destination catalog (`packages/public-contracts`), not new copy |
| No WebGL                  | The map could not start in this browser. Everything on this page still works.                              | Carried from the current home page                                                                     |
