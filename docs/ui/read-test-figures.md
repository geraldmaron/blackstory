# Read test for figures: Portrait against Plain

**Status:** written 2026-11-23, before the figures were called done. Not yet run. It needs five
students, whom the owner recruits (`DESIGN.md` section 15 item 3).
**Decides:** whether the Portrait view of a figure may be the default view. Until this test
passes for a figure, Plain is that figure's default everywhere (`DESIGN.md` section 9.5).
**Covers:** `D-01` (Black share of the U.S. population by census, 1790 to 2020) and `D-02` (free
and enslaved shares of the Black population, 1790 to 1860) on `/data`.

Five readers is a gate, not a statistic. It can show that a form is misread. It cannot show that a
form is read well by everyone. A tie goes to Plain.

## 1. Who and how

- Five students: at least one in middle school, one in high school and one in college.
- One student at a time, on the device they normally use for school. Record the device and the
  window width. At least two sessions are on a phone.
- The student reads the screen. The tester does not point, explain the form, or say whether an
  answer is right until the session ends.
- The tester opens each view by its link, so the student never has to find the switch:
  `/data?view=portrait#D-01`, `/data?view=plain#D-01`, and the same for `D-02`.
- The Numbers view is not shown during the questions. A student who opens it on their own is
  noted, and that answer is scored as "used the table", not as a Portrait or Plain reading.
- Time each answer from the end of the question to the end of the answer.

### Order

Each student sees each figure in both views, with different question forms so that a remembered
answer does not help. The view order alternates so neither view always goes first.

| Student | D-01 first view (form) | D-01 second view (form) | D-02 first view (form) | D-02 second view (form) |
| ------- | ---------------------- | ----------------------- | ---------------------- | ----------------------- |
| 1 | Portrait (A) | Plain (B) | Plain (A) | Portrait (B) |
| 2 | Plain (A) | Portrait (B) | Portrait (A) | Plain (B) |
| 3 | Portrait (B) | Plain (A) | Plain (B) | Portrait (A) |
| 4 | Plain (B) | Portrait (A) | Portrait (B) | Plain (A) |
| 5 | Portrait (A) | Plain (B) | Plain (A) | Portrait (B) |

## 2. Questions and what counts as correct

The answer keys below were read from the live Numbers tables on 2026-11-23. If a release changes
a value, the key is re-read from the Numbers table before the test, never from this file.

### D-01, Black share of the U.S. population

| # | Tests | Form A | Form B | Correct |
| - | ----- | ------ | ------ | ------- |
| 1 | Reading one value | What share of the U.S. population was Black in 1860? | ...in 1900? | A: 14.1%. B: 11.6%. Within one point either way (13.1 to 15.1; 10.6 to 12.6) |
| 2 | Finding the low point | In which census was the share lowest, and what was it? | Same | 1930 and 9.7%. Both parts. 1920 (9.9%) or 1940 (9.8%) is wrong |
| 3 | Comparing two values | Was the share higher in 1790 or in 2020, and by about how much? | ...in 1830 or in 1990? | A: 1790, by about 7 points (19.3% against 12.3%; 6 to 8 points, or "about a third lower in 2020", is correct). B: 1830, by about 6 points (18.1% against 12.1%; 5 to 7 is correct) |
| 4 | Reading the shape | In one sentence, what did the share do between 1790 and 2020? | Same | It fell for more than a century and then rose. The turn is placed between 1920 and 1940. "It went down" alone is wrong |
| 5 | The definition change | Is the 2020 number measured the same way as the 1990 number? | ...the 2010 number and the 1980 number? | No, and the student says what changed: from 2000 the census counts people who marked Black alone, because people could mark more than one race. "No" without a reason is half correct |
| 6 | The form's trap | Portrait only: what does the whole length of the bar, end to end, stand for? Plain only: where does the vertical axis start? | Same | Portrait: nothing by itself, each stretch is one census. A student who says it is a total (all Black people, 100 percent, the whole period's population) has misread the form. Plain: zero |

### D-02, free and enslaved shares of the Black population

| # | Tests | Form A | Form B | Correct |
| - | ----- | ------ | ------ | ------- |
| 1 | Reading one value | In 1810, what percent of the Black people counted were free? | ...in 1850? | A: 13.5%. B: 11.9%. Within one point either way |
| 2 | Finding an extreme | In which census was the enslaved share highest, and what was it? | In which census was the free share highest, and what was it? | A: 1790, 92.1%. B: 1830, 13.7% |
| 3 | Comparing two values | Was a larger share free in 1790 or in 1830? | ...in 1820 or in 1860? | A: 1830 (13.7% against 7.9%). B: 1820 (13.2% against 11.0%) |
| 4 | Reading the whole | Was there any census here where fewer than eight in ten were enslaved? | ...where more than one in five were free? | No. The enslaved share is never under 86.3% |
| 5 | Scope | Why does the figure stop at 1860? | Same | The census counted enslaved and free people separately only through 1860; slavery ended before the 1870 census. "The data is missing" is wrong |
| 6 | The form's trap | Does this figure tell you how many people were enslaved in 1860? | ...in 1790? | No. It shows shares; the count is in the Numbers table. A student who reads a count off the height or area has misread the form |

Portrait prints every value on its mark. Plain prints only a few and shows the rest when a mark is
pointed at or focused; a student may do that, and a student who reads the axis instead is scored
the same way. That is why a single value counts as correct within one point in both views: the
test asks whether Portrait is read as accurately as Plain, not whether a printed number can be
copied. An exact reading is noted in the record as well.

## 3. Scoring

For each figure and each view: six questions, five students, 30 answers. One point for a correct
answer, half a point where the table above says so, zero otherwise. Record for each answer the
score, the time, the student's words when wrong, and anything they said about the form unprompted.

A **misreading** is a wrong answer of a kind the form invites and the other view does not: a total
read from the coiled bar's whole length, a census read from the wrong stretch of the coil, a count
read from a proportional field. It is recorded separately from an ordinary slip.

## 4. Pass criteria, per figure

Portrait may become a figure's default view only when all five hold for that figure:

1. **As accurate.** Portrait's total score is at least Plain's total score.
2. **No question lost.** No question is answered wrong in Portrait by two or more students who
   answered its other form right in Plain.
3. **No misreading.** No student makes a misreading as defined in section 3, on questions 1 to 6.
4. **Not slower by much.** Portrait's median answer time on questions 1 to 3 is at most one and a
   half times Plain's.
5. **Phones included.** Criteria 1 to 3 also hold when counted over the phone sessions alone.

If any one fails, Plain stays the default for that figure and the result names which criterion
failed and on which question. A form that fails criterion 3 for two or more students is reported
to the owner as a candidate for removal, not for a redesign in place.

Whatever the result, Plain and Numbers remain the print default and the default below 40rem
(`DESIGN.md` section 9.5).

## 5. Record

One row per answer, kept with the phase notes and summarized in the 6a row of `DESIGN.md`
section 13:

`student, level, device, window width, figure, view, form, question, answer as said, score, seconds, misreading (yes or no), note`
