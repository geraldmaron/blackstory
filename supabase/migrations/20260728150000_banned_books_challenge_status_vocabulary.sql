-- Align bb_reference.banned_book_challenges with the domain vocabulary before the
-- first load of the curated corpus.
--
-- 20260721120000_banned_books_reference.sql allowed only ('reported','rescinded',
-- 'unknown'), but BannedBookChallengeStatus in packages/domain/src/banned-books/types.ts
-- defines six values. The curated corpus (77 books / 293 challenges) uses four of them:
-- reported 185, banned 83, restricted 18, rescinded 7 — so 101 rows would be rejected
-- by the original CHECK. 'retained' is in the vocabulary but unused so far.
--
-- Also adds title_at_challenge, which BannedBookChallenge carries (the title a work was
-- challenged under, when it differs from the catalog title) and the table had no column
-- for. One row in the current corpus uses it; without this it would be silently dropped.

ALTER TABLE bb_reference.banned_book_challenges
  DROP CONSTRAINT banned_book_challenges_status_check;

ALTER TABLE bb_reference.banned_book_challenges
  ADD CONSTRAINT banned_book_challenges_status_check
  CHECK (status IN ('reported', 'banned', 'restricted', 'retained', 'rescinded', 'unknown'));

ALTER TABLE bb_reference.banned_book_challenges
  ADD COLUMN IF NOT EXISTS title_at_challenge text;
