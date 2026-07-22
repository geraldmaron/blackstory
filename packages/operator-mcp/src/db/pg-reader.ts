/**
 * Postgres implementation of IndicatorDbReader over bb_reference.statistical_* tables.
 * Uses DATABASE_URL (research/operator role — never service-role in public MCP paths).
 */
import pg from 'pg';
import type {
  EntityBindingRow,
  IndicatorDbReader,
  ListObservationsFilters,
  ListSeriesFilters,
  ObservationRow,
  ResolveObservationFilters,
  SeriesRow,
} from './types.js';

function wantsManagedSsl(connectionString: string): boolean {
  return (
    process.env.DATABASE_SSL === '1' ||
    process.env.DATABASE_SSL === 'true' ||
    /supabase\.(co|com)/i.test(connectionString)
  );
}

function normalizePgConnectionString(connectionString: string): {
  readonly connectionString: string;
  readonly ssl?: { readonly rejectUnauthorized: false };
} {
  if (!wantsManagedSsl(connectionString)) {
    return { connectionString };
  }
  let normalized = connectionString;
  try {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    url.searchParams.set('uselibpqcompat', 'true');
    url.searchParams.set('sslmode', 'require');
    normalized = url.toString();
  } catch {
    normalized = connectionString;
  }
  return {
    connectionString: normalized,
    ssl: { rejectUnauthorized: false },
  };
}

export function resolveOperatorDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const url = environment.DATABASE_URL?.trim() || environment.APP_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL (or APP_DATABASE_URL) is required for operator MCP indicator reads',
    );
  }
  if (environment.NEXT_PUBLIC_DATABASE_URL || environment.NEXT_PUBLIC_POSTGRES_URL) {
    throw new Error('Public database credentials must not be used for operator MCP');
  }
  return url;
}

export function createOperatorPgPool(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): pg.Pool {
  const raw = resolveOperatorDatabaseUrl(environment);
  const conn = normalizePgConnectionString(raw);
  const maxRaw = environment.DATABASE_POOL_MAX?.trim();
  const max = maxRaw ? Number(maxRaw) : 4;
  return new pg.Pool({
    connectionString: conn.connectionString,
    max: Number.isInteger(max) && max > 0 ? max : 4,
    ...(conn.ssl ? { ssl: conn.ssl } : {}),
  });
}

export class PgIndicatorDbReader implements IndicatorDbReader {
  constructor(private readonly pool: pg.Pool) {}

  async listSeries(filters: ListSeriesFilters): Promise<readonly SeriesRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.metricId) {
      params.push(filters.metricId);
      clauses.push(`metric_id = $${params.length}`);
    }
    if (filters.theme) {
      params.push(filters.theme);
      clauses.push(`theme = $${params.length}`);
    }
    if (filters.geographyType) {
      params.push(filters.geographyType);
      clauses.push(`geography_type = $${params.length}`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await this.pool.query<SeriesRow>(
      `SELECT metric_id, metric_definition, universe, unit, source_dataset, source_table,
              source_variable, geography_type, estimate_type, period_type,
              external_data_source_id, theme
       FROM bb_reference.statistical_series
       ${where}
       ORDER BY metric_id`,
      params,
    );
    return result.rows;
  }

  async getSeries(metricId: string): Promise<SeriesRow | null> {
    const rows = await this.listSeries({ metricId });
    return rows[0] ?? null;
  }

  async jurisdictionExists(jurisdictionId: string): Promise<boolean> {
    const result = await this.pool.query<{ readonly exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM bb_reference.jurisdictions WHERE id = $1) AS exists',
      [jurisdictionId],
    );
    return result.rows[0]?.exists === true;
  }

  async listObservations(filters: ListObservationsFilters): Promise<readonly ObservationRow[]> {
    const clauses = ['metric_id = $1'];
    const params: unknown[] = [filters.metricId];

    if (filters.jurisdictionId) {
      params.push(filters.jurisdictionId);
      clauses.push(`jurisdiction_id = $${params.length}`);
    }
    if (filters.referencePeriod) {
      params.push(filters.referencePeriod);
      clauses.push(`reference_period = $${params.length}`);
    }

    params.push(filters.limit);
    const limitParam = `$${params.length}`;

    const result = await this.pool.query<ObservationRow>(
      `SELECT id, metric_id, jurisdiction_id, boundary_version, reference_period,
              dataset_vintage, estimate, margin_of_error, status, source, source_url,
              retrieved_at, content_hash
       FROM bb_reference.statistical_observations
       WHERE ${clauses.join(' AND ')}
       ORDER BY reference_period DESC, jurisdiction_id
       LIMIT ${limitParam}`,
      params,
    );
    return result.rows;
  }

  async resolveObservation(filters: ResolveObservationFilters): Promise<ObservationRow | null> {
    if (!filters.jurisdictionId) {
      return null;
    }
    const rows = await this.listObservations({
      metricId: filters.metricId,
      jurisdictionId: filters.jurisdictionId,
      ...(filters.referencePeriod !== undefined ? { referencePeriod: filters.referencePeriod } : {}),
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async listEntityBindings(
    entityId: string,
    purpose?: string,
  ): Promise<readonly EntityBindingRow[]> {
    const params: unknown[] = [entityId];
    let purposeClause = '';
    if (purpose) {
      params.push(purpose);
      purposeClause = `AND purpose = $${params.length}`;
    }

    const result = await this.pool.query<EntityBindingRow>(
      `SELECT id, entity_id, metric_id, purpose, jurisdiction_id, notes
       FROM bb_reference.entity_context_bindings
       WHERE entity_id = $1 ${purposeClause}
       ORDER BY metric_id, jurisdiction_id NULLS LAST`,
      params,
    );
    return result.rows;
  }
}

export function createPgIndicatorDbReader(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PgIndicatorDbReader {
  return new PgIndicatorDbReader(createOperatorPgPool(environment));
}
