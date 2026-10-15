-- Recoverable editorial deletion retains revisions and signed public release history.
ALTER TABLE reference.articles ADD COLUMN archived_at timestamptz;
ALTER TABLE reference.articles ADD CONSTRAINT articles_archived_draft
 CHECK (archived_at IS NULL OR status='draft');
