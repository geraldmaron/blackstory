-- Black Book local/CI Postgres extensions (BB-012).
-- Applied via docker-entrypoint-initdb.d or `pnpm db:init`.
-- Keep Cloud SQL extension set aligned (PostGIS + FTS helpers).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
