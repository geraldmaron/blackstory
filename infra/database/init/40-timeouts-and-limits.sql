-- Statement, lock, and idle-in-transaction timeouts plus connection budgets (BB-012).
-- Applied at database and role level for local/CI parity with Cloud SQL flags.

ALTER DATABASE blackbook SET statement_timeout = '30s';
ALTER DATABASE blackbook SET lock_timeout = '5s';
ALTER DATABASE blackbook SET idle_in_transaction_session_timeout = '15s';

-- Role-specific tighter budgets for public edge traffic.
ALTER ROLE role_public_read SET statement_timeout = '10s';
ALTER ROLE role_public_read SET lock_timeout = '2s';
ALTER ROLE role_public_read SET idle_in_transaction_session_timeout = '5s';
ALTER ROLE role_public_read CONNECTION LIMIT 40;

ALTER ROLE role_submissions_write SET statement_timeout = '15s';
ALTER ROLE role_submissions_write SET lock_timeout = '3s';
ALTER ROLE role_submissions_write SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE role_submissions_write CONNECTION LIMIT 30;

ALTER ROLE role_admin_app SET statement_timeout = '30s';
ALTER ROLE role_admin_app CONNECTION LIMIT 20;

ALTER ROLE role_research SET statement_timeout = '5min';
ALTER ROLE role_research SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE role_research CONNECTION LIMIT 25;

ALTER ROLE role_publication SET statement_timeout = '5min';
ALTER ROLE role_publication SET idle_in_transaction_session_timeout = '60s';
ALTER ROLE role_publication CONNECTION LIMIT 25;

ALTER ROLE role_security SET statement_timeout = '2min';
ALTER ROLE role_security CONNECTION LIMIT 15;

ALTER ROLE role_migrations SET statement_timeout = '0';
ALTER ROLE role_migrations CONNECTION LIMIT 3;

ALTER ROLE role_backup_readonly SET statement_timeout = '0';
ALTER ROLE role_backup_readonly CONNECTION LIMIT 5;
