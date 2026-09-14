-- 0001_extensions: PostGIS, pgvector, trigram, crypto helpers (docs/data/postgres-schema.md).
-- Target: blackstory-app. Safe to re-run (IF NOT EXISTS / CREATE EXTENSION).

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
