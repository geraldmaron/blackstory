# Read test for the front page: the retelling against a direct front

**Status:** written 2026-11-23, before the retelling was called done. Not yet run. It needs five
students, whom the owner recruits (`docs/ui/DESIGN.md` section 15 item 3).
**Decides:** whether the retelling becomes the entrance at `/`. Until this test passes, the
current home page stays the default and the retelling lives at `/story` (`DESIGN.md` section
9.7, verdict (e)).
**Compares:** two fronts on the same device.

| Front            | Address                                                   | What the student sees first                           |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| A, the retelling | `/?opening=1`, first visit                                | Scene 1, "History"                                    |
| B, direct        | `/?opening=1` after the tester has set the returning flag | Scene 6: the wordmark, the country, then the contents |

To set B: open `/?opening=1` once, press "Skip to the archive", go back, reload. The page now
opens on scene 6. To reset to A, clear the site's storage (the only key is `ds-front-seen`).

Five readers is a gate, not a statistic. It can show that students get lost. It cannot show that
nobody will. A tie goes to B, because B is shorter.

## 1. Who and how

- Five students: at least one in middle school, one in high school and one in college.
- One student at a time, on the device they use for school. Record the device, the window size
  and whether reduced motion is on. At least two sessions are on a phone.
- Students 1, 3 and 5 see front A first; students 2 and 4 see front B first. Each sees the other
  front at the end, for question 6 only.
- The tester says only: "This is a website. Use it the way you would if a teacher had given you
  the link. Tell me when you think you know what it is." The tester does not scroll, point or
  explain, and does not say what the site is.
- Time from the page appearing. Note, with the time: the first scroll; each scene reached; any
  press of "Skip to the archive" or of a rail word; any use of the town field; the moment the
  student leaves the opening by any route.
- Stop the opening part after three minutes if the student has not left it, and note where they
  were.

## 2. Tasks and what counts

| #   | Ask                                                                                       | Counts as done                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | (Nothing. Watch.)                                                                         | The student either reaches scene 6 or leaves the opening by a link, within three minutes, without asking what to do                                                                                                                              |
| 2   | "What is this site?" Asked once the student says they know, or at three minutes           | The answer has two of these three in the student's own words: it is about Black history; it is records or an archive with sources; the records are tied to places on a map. "A map" alone is not enough. "A history website" alone is not enough |
| 3   | "Why are parts of the map dark?"                                                          | "Nobody has researched there yet", in any words. "Nothing happened there" is the wrong answer this page exists to prevent, and is recorded as such                                                                                               |
| 4   | "Find a record near (a town the tester names, with at least one record within 50 miles)." | The student opens a record's page for a place near that town, by any route (the town field, the map, search), within two minutes                                                                                                                 |
| 5   | "Now get to the full archive." Asked from wherever the student is                         | The student reaches the map or the list within 30 seconds                                                                                                                                                                                        |
| 6   | Show the other front. "Which would you rather land on for a class assignment, and why?"   | Any answer. Record the choice and the reason in the student's words                                                                                                                                                                              |

Also record, without asking: whether the student said anything about the words changing; whether
they read a record's claim or its grade aloud; whether they tried to move the map by hand
(scrolling moves it here, dragging does not); anything they tapped that did nothing.

## 3. Pass criteria, written before the test

Front A becomes the entrance only if all five hold.

1. **Nobody is stranded.** All five students complete task 1 on front A: each finishes or
   leaves the opening on their own inside three minutes.
2. **Skipping works.** Every student who skips or leaves early on front A still completes task 5. A student who presses "Skip to the archive" and then cannot say where they are fails this.
3. **They can say what it is.** At least four of five pass task 2 after front A, and front A does
   no worse than front B on task 2 among the students who saw it first.
4. **Dark is read correctly.** At least four of five pass task 3. Any "nothing happened there"
   is reported to the owner whatever the count.
5. **It is not too long.** The median time from first scroll to leaving the opening on front A
   is under 90 seconds, and no more than one student, asked question 6, calls it too long or
   says they would skip it every time.

If criteria 1 to 4 pass and 5 fails, the retelling stays at `/story`, linked from the front as
"Watch the opening", and front B becomes the entrance.

## 4. Results

Not run.

| Student | Level | Device, window | First front | Task 1 (time, how it ended) | Task 2 | Task 3 | Task 4 | Task 5 | Prefers | Notes |
| ------- | ----- | -------------- | ----------- | --------------------------- | ------ | ------ | ------ | ------ | ------- | ----- |
| 1       |       |                | A           |                             |        |        |        |        |         |       |
| 2       |       |                | B           |                             |        |        |        |        |         |       |
| 3       |       |                | A           |                             |        |        |        |        |         |       |
| 4       |       |                | B           |                             |        |        |        |        |         |       |
| 5       |       |                | A           |                             |        |        |        |        |         |       |
