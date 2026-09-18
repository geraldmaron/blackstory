import { parseCsvRows } from './csv.js';
import type { HarnessSourceRecord } from '@repo/research-kernel';

export type HarnessRawSubject = HarnessSourceRecord;

export interface ConnectorFetchOptions {
  readonly query?: string;
  readonly limit?: number;
  readonly state?: string;
  readonly county?: string;
}

/** Normalizes a supplied NPS Network to Freedom record. */
export function parseNpsNetworkToFreedomRow(row: Record<string, string>): HarnessRawSubject {
  const latitude = row.latitude ? Number(row.latitude) : undefined;
  const longitude = row.longitude ? Number(row.longitude) : undefined;
  const coords =
    latitude !== undefined &&
    longitude !== undefined &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
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
  const lines = parseCsvRows(csvData);
  const headers = lines[0]?.map((header) => header.trim());
  if (!headers) return [];
  const subjects: HarnessRawSubject[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const values = rawLine;
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

/** Normalizes supplied DPLA API records; this function does not fetch them. */
export function fetchDplaItems(
  results: readonly Record<string, unknown>[],
  options: ConnectorFetchOptions = {},
): readonly HarnessRawSubject[] {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('DPLA limit must be a positive integer');
  return results
    .map((item) => {
      if (typeof item.id !== 'string' || !item.id.trim())
        throw new Error('DPLA record requires a stable id');
      const sourceResource = (item.sourceResource || {}) as Record<string, unknown>;
      const title = Array.isArray(sourceResource.title)
        ? sourceResource.title[0]
        : sourceResource.title || 'Untitled DPLA Record';
      const description = Array.isArray(sourceResource.description)
        ? sourceResource.description.join(' ')
        : sourceResource.description || '';

      const isShownAt = item.isShownAt ? [String(item.isShownAt)] : [];

      return {
        id: `dpla:${item.id}`,
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
    })
    .slice(0, limit);
}
