export type ConnectorKind = 'nps_network_to_freedom' | 'dpla' | 'wikidata';

export interface HarnessRawSubject {
  readonly id: string;
  readonly connectorKind: ConnectorKind;
  readonly title: string;
  readonly description: string;
  readonly coordinates?: { readonly latitude: number; readonly longitude: number } | undefined;
  readonly locationName?: string | undefined;
  readonly county?: string | undefined;
  readonly state?: string | undefined;
  readonly cites: readonly string[];
  readonly rawRecord: Record<string, unknown>;
}

export interface ConnectorFetchOptions {
  readonly query?: string;
  readonly limit?: number;
  readonly state?: string;
  readonly county?: string;
}

/** Stateful CSV line splitter that respects quoted fields containing commas. */
export function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/** Parses a simulated NPS Network to Freedom CSV record row. */
export function parseNpsNetworkToFreedomRow(
  row: Record<string, string>,
): HarnessRawSubject {
  const latitude = row.latitude ? parseFloat(row.latitude) : undefined;
  const longitude = row.longitude ? parseFloat(row.longitude) : undefined;
  const coords = latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)
    ? { latitude, longitude }
    : undefined;

  return {
    id: `nps-ntf:${row.id || row.name}`,
    connectorKind: 'nps_network_to_freedom',
    title: row.name || 'Untitled NTF Site',
    description: row.abstract || row.description || '',
    ...(coords ? { coordinates: coords } : {}),
    ...(row.address || row.city ? { locationName: row.address || row.city } : {}),
    ...(row.county ? { county: row.county } : {}),
    ...(row.state ? { state: row.state } : {}),
    cites: row.source_url ? [row.source_url] : [],
    rawRecord: row as unknown as Record<string, unknown>,
  };
}

/** Ingests Network to Freedom items from CSV data. */
export function fetchNpsNetworkToFreedom(
  csvData: string,
  options: ConnectorFetchOptions = {},
): readonly HarnessRawSubject[] {
  const lines = csvData.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];
  const headers = splitCsvLine(firstLine).map((h) => h.replace(/^"|"$/g, '').trim());
  const subjects: HarnessRawSubject[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const values = splitCsvLine(rawLine).map((v) => v.replace(/^"|"$/g, '').trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header) {
        row[header] = values[idx] || '';
      }
    });

    if (options.state && row.state?.toLowerCase() !== options.state.toLowerCase()) continue;
    if (options.county && row.county?.toLowerCase() !== options.county.toLowerCase()) continue;

    subjects.push(parseNpsNetworkToFreedomRow(row));
    if (options.limit && subjects.length >= options.limit) break;
  }

  return subjects;
}

/** Queries DPLA API items (simulated search query mapping to standard shapes). */
export function fetchDplaItems(
  results: readonly Record<string, unknown>[],
  options: ConnectorFetchOptions = {},
): readonly HarnessRawSubject[] {
  return results
    .map((item) => {
      const sourceResource = (item.sourceResource || {}) as Record<string, unknown>;
      const title = Array.isArray(sourceResource.title)
        ? sourceResource.title[0]
        : sourceResource.title || 'Untitled DPLA Record';
      const description = Array.isArray(sourceResource.description)
        ? sourceResource.description.join(' ')
        : sourceResource.description || '';
      
      const isShownAt = item.isShownAt ? [String(item.isShownAt)] : [];
      
      return {
        id: `dpla:${item.id || item.ingestDate || Math.random().toString()}`,
        connectorKind: 'dpla' as const,
        title: String(title),
        description: String(description),
        cites: isShownAt,
        rawRecord: item,
      };
    })
    .filter((subject) => {
      if (options.query) {
        const needle = options.query.toLowerCase();
        return (
          subject.title.toLowerCase().includes(needle) ||
          subject.description.toLowerCase().includes(needle)
        );
      }
      return true;
    });
}
