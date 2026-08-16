-- Drop leftover one-off backup tables after the 2026-08 restore check.
--
-- Counts at drop (2026-08-15): release_entities_backup_prerepub 4092,
-- search_index_backup_prerepub 4092, search_index_backup_repo_bx4d 4092,
-- status_history_backup_repo_i2st 2112. Live bb_public.release_entities and
-- search_index stay (4092 rows). Status-history undo is the JSON artifact from
-- withdraw-laundered-active-status.ts, not this table.

DROP TABLE IF EXISTS bb_public.release_entities_backup_prerepub;
DROP TABLE IF EXISTS bb_public.search_index_backup_prerepub;
DROP TABLE IF EXISTS bb_public.search_index_backup_repo_bx4d;
DROP TABLE IF EXISTS bb_canonical.status_history_backup_repo_i2st;
