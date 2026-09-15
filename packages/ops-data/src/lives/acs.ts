/**
 * American Community Survey five-year tables by race for Lives Across the Decades: 2008–2012 stands for
 * the 2010s and 2019–2023 for the 2020s. Pure: the ingest script fetches Census API group metadata and
 * rows, and these functions turn them into observations that keep the published counts and their
 * margins, so the domain builder can sum states into regions.
 *
 * Variables are found by label, not position, because labels changed punctuation between vintages.
 * A table whose labels don't match fails loudly instead of loading the wrong column.
 * Method: docs/methodology/lives-across-decades.md.
 */
import { createHash } from 'node:crypto';
import {
  LIVES_NATIONAL,
  LIVES_SERIES,
  incomeBracketSeriesId,
  livesStateJurisdictionId,
} from '@repo/domain/statistics/lives';

export type LivesAcsVintage = {
  readonly year: number;
  readonly period: string;
  readonly boundaryYear: number;
};

export const LIVES_ACS_VINTAGES: readonly LivesAcsVintage[] = [
  { year: 2012, period: '2008-2012', boundaryYear: 2010 },
  { year: 2023, period: '2019-2023', boundaryYear: 2020 },
];

export type LivesAcsTableKind =
  'population' | 'tenure' | 'education' | 'employment' | 'income' | 'median';

export type LivesAcsTable = {
  readonly group: string;
  readonly kind: LivesAcsTableKind;
  /** Slice for a single-group table; null for B03002, which carries every group. */
  readonly slice: 'black_alone' | 'white_nh' | 'hispanic' | 'all' | null;
  readonly nationOnly: boolean;
};

const RACE_GROUPS = [
  { suffix: 'B', slice: 'black_alone' },
  { suffix: 'H', slice: 'white_nh' },
  { suffix: 'I', slice: 'hispanic' },
] as const;

export function livesAcsTables(): LivesAcsTable[] {
  const tables: LivesAcsTable[] = [
    { group: 'B03002', kind: 'population', slice: null, nationOnly: false },
    { group: 'B19013', kind: 'median', slice: 'all', nationOnly: true },
  ];
  const kinds = [
    ['B25003', 'tenure'],
    ['C15002', 'education'],
    ['C23002', 'employment'],
    ['B19001', 'income'],
  ] as const;
  for (const [prefix, kind] of kinds) {
    for (const race of RACE_GROUPS) {
      tables.push({ group: `${prefix}${race.suffix}`, kind, slice: race.slice, nationOnly: false });
    }
  }
  return tables;
}

export function normalizeAcsLabel(label: string): string {
  return label
    .replace(/^Estimate!!/, '')
    .replace(/:/g, '')
    .trim();
}

/** Estimate variable name to normalized label, from `groups/{group}.json`. */
export function readAcsLabels(groupJson: unknown): Map<string, string> {
  const variables = (groupJson as { variables?: Record<string, { label?: unknown }> } | null)
    ?.variables;
  if (!variables) throw new Error('group metadata has no variables');
  const labels = new Map<string, string>();
  for (const [name, spec] of Object.entries(variables)) {
    if (!/_\d{3}E$/.test(name) || typeof spec.label !== 'string') continue;
    labels.set(name, normalizeAcsLabel(spec.label));
  }
  return labels;
}

export type AcsRow = Readonly<Record<string, string | null>>;

/** Census API rows, whose first row is the header, as records. */
export function readAcsRows(json: unknown): AcsRow[] {
  if (!Array.isArray(json) || json.length === 0 || !Array.isArray(json[0])) {
    throw new Error('unexpected Census API response');
  }
  const [header, ...rows] = json as (string | null)[][];
  return rows.map((row) =>
    Object.fromEntries(header!.map((key, index) => [String(key), row[index] ?? null])),
  );
}

type Measure = { readonly value: number; readonly moe: number | null };

const CONTROLLED_MOE = -555555555;

/** A published estimate and its 90% margin. Annotation codes arrive as negative numbers. */
export function readMeasure(row: AcsRow, variable: string): Measure | null {
  const raw = row[variable];
  const value = raw === null || raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isFinite(value) || value < 0) return null;
  const rawMoe = row[variable.replace(/E$/, 'M')];
  const moeValue = rawMoe === null || rawMoe === undefined ? Number.NaN : Number(rawMoe);
  const moe = !Number.isFinite(moeValue)
    ? null
    : moeValue === CONTROLLED_MOE
      ? 0
      : moeValue >= 0
        ? moeValue
        : null;
  return { value, moe };
}

/** Sum and difference of published counts, with the Census approximation for the margin of a sum. */
export function combineMeasures(
  add: readonly Measure[],
  subtract: readonly Measure[] = [],
): Measure {
  const all = [...add, ...subtract];
  const value =
    add.reduce((sum, measure) => sum + measure.value, 0) -
    subtract.reduce((sum, measure) => sum + measure.value, 0);
  const moe = all.some((measure) => measure.moe === null)
    ? null
    : Math.sqrt(all.reduce((sum, measure) => sum + (measure.moe as number) ** 2, 0));
  return { value, moe };
}

export function acsJurisdictionId(row: AcsRow): string | null {
  if (row.us === '1') return LIVES_NATIONAL.id;
  const state = row.state;
  if (typeof state === 'string' && /^\d{2}$/.test(state) && state !== '72') {
    return livesStateJurisdictionId(state);
  }
  return null;
}

export function parseIncomeBracketLabel(
  label: string,
): { readonly lower: number; readonly upper: number | null } | null {
  const tail = label.split('!!').pop() ?? '';
  const money = (text: string) => Number(text.replace(/[$,]/g, ''));
  let match = /^Less than (\$[\d,]+)$/.exec(tail);
  if (match) return { lower: 0, upper: money(match[1]!) };
  match = /^(\$[\d,]+) to (\$[\d,]+)$/.exec(tail);
  if (match) return { lower: money(match[1]!), upper: money(match[2]!) + 1 };
  match = /^(\$[\d,]+) or more$/.exec(tail);
  if (match) return { lower: money(match[1]!), upper: null };
  return null;
}

export type LivesAcsObservation = {
  readonly id: string;
  readonly metricId: string;
  readonly jurisdictionId: string;
  readonly boundaryVersion: string;
  readonly referencePeriod: string;
  readonly datasetVintage: string;
  readonly estimate: number;
  readonly marginOfError: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly raceEthnicitySlice: string;
  readonly source: string;
  readonly sourceUrl: string;
  readonly contentHash: string;
  readonly metadata: {
    readonly table: string;
    /** NHGIS table code the figures were extracted under. */
    readonly nhgisTable?: string;
    readonly numeratorMoe?: number;
    readonly denominatorMoe?: number;
  };
};

/** The Census Bureau's page documenting a table's variables for a vintage. */
export function acsTableUrl(year: number, group: string): string {
  return `https://api.census.gov/data/${year}/acs/acs5/groups/${group}.html`;
}

function labelVariable(labels: ReadonlyMap<string, string>, label: string, group: string): string {
  for (const [name, value] of labels) if (value === label) return name;
  throw new Error(`${group}: no variable labeled "${label}"`);
}

function variablesEnding(labels: ReadonlyMap<string, string>, suffix: string): string[] {
  return [...labels].filter(([, value]) => value.endsWith(suffix)).map(([name]) => name);
}

export type BuildAcsObservationsInput = {
  readonly table: LivesAcsTable;
  readonly vintage: LivesAcsVintage;
  readonly labels: ReadonlyMap<string, string>;
  readonly rows: readonly AcsRow[];
  /** NHGIS table code, kept in provenance when the rows came from an NHGIS extract. */
  readonly nhgisCode?: string;
};

/** Observations for one table, vintage and geography level. Rows with a zero or unreadable base are skipped. */
export function buildAcsObservations(input: BuildAcsObservationsInput): LivesAcsObservation[] {
  const { table, vintage, labels } = input;
  const observations: LivesAcsObservation[] = [];

  const push = (
    row: AcsRow,
    metricId: string,
    slice: string,
    values: {
      estimate: number;
      marginOfError: number | null;
      numerator: Measure | null;
      denominator: Measure | null;
    },
  ) => {
    const jurisdictionId = acsJurisdictionId(row);
    if (!jurisdictionId) return;
    const nation = jurisdictionId === LIVES_NATIONAL.id;
    const metadata = {
      table: table.group,
      ...(input.nhgisCode ? { nhgisTable: input.nhgisCode } : {}),
      ...(values.numerator?.moe != null ? { numeratorMoe: values.numerator.moe } : {}),
      ...(values.denominator?.moe != null ? { denominatorMoe: values.denominator.moe } : {}),
    };
    const numerator = values.numerator?.value ?? null;
    const denominator = values.denominator?.value ?? null;
    observations.push({
      id: `obs:${metricId}:${jurisdictionId}:${vintage.period}:${slice}`,
      metricId,
      jurisdictionId,
      boundaryVersion: `${nation ? 'nation' : 'state'}-${vintage.boundaryYear}`,
      referencePeriod: vintage.period,
      datasetVintage: `ACS ${vintage.period} 5-year`,
      estimate: values.estimate,
      marginOfError: values.marginOfError,
      numerator,
      denominator,
      raceEthnicitySlice: slice,
      source: `Census Bureau, ACS ${vintage.period} 5-year estimates, table ${table.group}, via IPUMS NHGIS`,
      sourceUrl: acsTableUrl(vintage.year, table.group),
      contentHash: createHash('sha256')
        .update(
          JSON.stringify([values.estimate, values.marginOfError, numerator, denominator, metadata]),
        )
        .digest('hex'),
      metadata,
    });
  };

  const share = (
    row: AcsRow,
    metricId: string,
    slice: string,
    numerator: Measure | null,
    denominator: Measure | null,
  ) => {
    if (!numerator || !denominator || denominator.value <= 0) return;
    push(row, metricId, slice, {
      estimate: (100 * numerator.value) / denominator.value,
      marginOfError: null,
      numerator,
      denominator,
    });
  };

  const read = (row: AcsRow, variables: readonly string[]) => {
    const measures = variables.map((variable) => readMeasure(row, variable));
    return measures.every((measure): measure is Measure => measure !== null) ? measures : null;
  };

  for (const row of input.rows) {
    switch (table.kind) {
      case 'population': {
        const total = readMeasure(row, labelVariable(labels, 'Total', table.group));
        const groups = [
          ['black_nh', 'Total!!Not Hispanic or Latino!!Black or African American alone'],
          ['white_nh', 'Total!!Not Hispanic or Latino!!White alone'],
          ['hispanic', 'Total!!Hispanic or Latino'],
        ] as const;
        for (const [slice, label] of groups) {
          share(
            row,
            LIVES_SERIES.population,
            slice,
            readMeasure(row, labelVariable(labels, label, table.group)),
            total,
          );
        }
        break;
      }
      case 'tenure': {
        share(
          row,
          LIVES_SERIES.homeownership,
          table.slice!,
          readMeasure(row, labelVariable(labels, 'Total!!Owner occupied', table.group)),
          readMeasure(row, labelVariable(labels, 'Total', table.group)),
        );
        break;
      }
      case 'education': {
        const total = readMeasure(row, labelVariable(labels, 'Total', table.group));
        const below = variablesEnding(labels, '!!Less than high school diploma');
        if (below.length !== 2)
          throw new Error(
            `${table.group}: expected 2 less-than-high-school cells, found ${below.length}`,
          );
        const belowMeasures = read(row, below);
        if (!total || !belowMeasures) break;
        share(
          row,
          LIVES_SERIES.highSchool,
          table.slice!,
          combineMeasures([total], belowMeasures),
          total,
        );
        break;
      }
      case 'employment': {
        const unemployed = variablesEnding(labels, '!!Unemployed');
        const inLaborForce = variablesEnding(labels, '!!In labor force');
        if (unemployed.length === 0 || unemployed.length !== inLaborForce.length) {
          throw new Error(
            `${table.group}: ${unemployed.length} unemployed cells for ${inLaborForce.length} labor force cells`,
          );
        }
        const civilian = inLaborForce.map((variable) => {
          const civilianLabel = `${labels.get(variable)}!!Civilian`;
          for (const [name, value] of labels) if (value === civilianLabel) return name;
          return variable;
        });
        const unemployedMeasures = read(row, unemployed);
        const civilianMeasures = read(row, civilian);
        if (!unemployedMeasures || !civilianMeasures) break;
        share(
          row,
          LIVES_SERIES.unemployed,
          table.slice!,
          combineMeasures(unemployedMeasures),
          combineMeasures(civilianMeasures),
        );
        break;
      }
      case 'income': {
        const total = readMeasure(row, labelVariable(labels, 'Total', table.group));
        const brackets = [...labels]
          .map(([name, label]) => ({ name, edges: parseIncomeBracketLabel(label) }))
          .filter(
            (entry): entry is { name: string; edges: { lower: number; upper: number | null } } =>
              entry.edges !== null,
          )
          .sort((a, b) => a.edges.lower - b.edges.lower);
        if (
          brackets.length < 2 ||
          brackets[0]!.edges.lower !== 0 ||
          brackets.at(-1)!.edges.upper !== null
        ) {
          throw new Error(`${table.group}: income brackets do not run from zero to an open top`);
        }
        for (let index = 1; index < brackets.length; index += 1) {
          if (brackets[index - 1]!.edges.upper !== brackets[index]!.edges.lower) {
            throw new Error(`${table.group}: income brackets are not contiguous`);
          }
        }
        for (const bracket of brackets) {
          share(
            row,
            incomeBracketSeriesId(bracket.edges.lower, bracket.edges.upper),
            table.slice!,
            readMeasure(row, bracket.name),
            total,
          );
        }
        break;
      }
      case 'median': {
        if (acsJurisdictionId(row) !== LIVES_NATIONAL.id) break;
        const median = readMeasure(row, `${table.group}_001E`);
        if (!median || median.value <= 0) break;
        push(row, LIVES_SERIES.incomeMedian, 'all', {
          estimate: median.value,
          marginOfError: median.moe,
          numerator: null,
          denominator: null,
        });
        break;
      }
    }
  }
  return observations;
}

/** A table as one NHGIS dataset names it: its column prefix and its variables in order. */
export type NhgisTableMeta = {
  readonly group: string;
  readonly nhgisCode: string;
  readonly variables: readonly { readonly description: string; readonly nhgisCode: string }[];
};

/** Reads `metadata/datasets/{dataset}/data_tables/{table}` from the IPUMS API. */
export function readNhgisTableMeta(json: unknown): NhgisTableMeta {
  const meta = json as { name?: unknown; nhgisCode?: unknown; variables?: unknown } | null;
  if (
    !meta ||
    typeof meta.name !== 'string' ||
    typeof meta.nhgisCode !== 'string' ||
    !Array.isArray(meta.variables)
  ) {
    throw new Error('NHGIS table metadata is missing its name, code or variables');
  }
  const variables = meta.variables.map((variable) => {
    const { description, nhgisCode } = (variable ?? {}) as Record<string, unknown>;
    if (typeof description !== 'string' || typeof nhgisCode !== 'string') {
      throw new Error(`${meta.name}: NHGIS variable without a description or code`);
    }
    return { description, nhgisCode };
  });
  return { group: meta.name, nhgisCode: meta.nhgisCode, variables };
}

/** RFC 4180 CSV: quoted fields may hold commas, quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * One NHGIS table in the shape the table builder reads: Census-style variable names and labels
 * (`B25003B_002E`, `Total!!Owner occupied`) and rows keyed by them, with `state` or `us` set. Null
 * when the file does not carry the table.
 */
export function nhgisTableToAcs(
  meta: NhgisTableMeta,
  csv: readonly (readonly string[])[],
): { readonly labels: Map<string, string>; readonly rows: AcsRow[] } | null {
  const [header, ...rest] = csv;
  if (!header || !header.includes(`${meta.nhgisCode}E001`)) return null;
  const column = new Map(header.map((name, index) => [name, index]));
  const dataRows = rest.filter(
    (row) => row.length === header.length && row[0] !== 'GIS Join Match Code',
  );
  const variables = meta.variables.map((variable) => {
    const suffix = variable.nhgisCode.slice(meta.nhgisCode.length);
    if (!/^\d{3}$/.test(suffix))
      throw new Error(`${meta.group}: unexpected NHGIS variable ${variable.nhgisCode}`);
    const label =
      variable.description === 'Total'
        ? 'Total'
        : `Total!!${variable.description.split(': ').join('!!')}`;
    return { suffix, name: `${meta.group}_${suffix}`, label: normalizeAcsLabel(label) };
  });
  const labels = new Map(variables.map((variable) => [`${variable.name}E`, variable.label]));
  const valueAt = (row: readonly string[], name: string) => {
    const index = column.get(name);
    const value = index === undefined ? undefined : row[index];
    return value === undefined || value === '' ? null : value;
  };
  const rows = dataRows.map((row) => {
    const record: Record<string, string | null> = {};
    const state = valueAt(row, 'STATEA');
    if (state) record.state = state;
    else if (valueAt(row, 'NATIONA') === '1') record.us = '1';
    for (const variable of variables) {
      record[`${variable.name}E`] = valueAt(row, `${meta.nhgisCode}E${variable.suffix}`);
      record[`${variable.name}M`] = valueAt(row, `${meta.nhgisCode}M${variable.suffix}`);
    }
    return record;
  });
  return { labels, rows };
}

const NHGIS_BLOCK_GROUP_TABLES: ReadonlySet<string> = new Set([
  'B03002',
  'B19013',
  'B25003B',
  'B25003H',
  'B25003I',
]);

/** NHGIS splits each ACS vintage in two: block-group tables (`a`) and tract-only tables such as the race iterations of C15002 (`b`). */
export function livesNhgisDataset(vintage: LivesAcsVintage, table: LivesAcsTable): string {
  const suffix = NHGIS_BLOCK_GROUP_TABLES.has(table.group) ? 'a' : 'b';
  return `${vintage.period.replace('-', '_')}_ACS5${suffix}`;
}

/** The IPUMS extract request for every Lives ACS table, for the nation and states. */
export function livesNhgisExtractDefinition(): Record<string, unknown> {
  const datasets: Record<
    string,
    { dataTables: string[]; geogLevels: string[]; breakdownValues: string[] }
  > = {};
  for (const vintage of LIVES_ACS_VINTAGES) {
    for (const table of livesAcsTables()) {
      const name = livesNhgisDataset(vintage, table);
      datasets[name] ??= {
        dataTables: [],
        geogLevels: ['nation', 'state'],
        breakdownValues: ['bs32.ge00'],
      };
      datasets[name].dataTables.push(table.group);
    }
  }
  return {
    datasets,
    dataFormat: 'csv_header',
    breakdownAndDataTypeLayout: 'single_file',
    description: 'BlackStory Lives ACS 5-year race tables, states and nation',
  };
}
