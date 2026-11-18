/** Offline only: JSON input { rows: CandidateSnapshot[], corrections: ScanCorrection[] }. */
import { readFileSync } from 'node:fs';
import {
  preparePrimaryScanCorrection,
  type CandidateSnapshot,
  type ScanCorrection,
} from './lib/greenbook-primary-scan-plan.ts';
const filename = process.argv[2];
if (!filename || process.argv.length !== 3)
  throw new Error('Usage: prepare-greenbook-primary-scan-corrections.ts <packet.json>');
const packet = JSON.parse(readFileSync(filename, 'utf8')) as {
  rows: CandidateSnapshot[];
  corrections: ScanCorrection[];
};
if (!Array.isArray(packet.rows) || !Array.isArray(packet.corrections) || !packet.corrections.length)
  throw new Error('Nonempty rows and corrections are required');
const rows = new Map(packet.rows.map((row) => [row.id, row]));
if (
  rows.size !== packet.rows.length ||
  new Set(packet.corrections.map((item) => item.candidateId)).size !== packet.corrections.length
)
  throw new Error('Duplicate candidate IDs');
const plans = packet.corrections.map((correction) => {
  const row = rows.get(correction.candidateId);
  if (!row) throw new Error(`Missing candidate snapshot: ${correction.candidateId}`);
  return preparePrimaryScanCorrection(row, correction);
});
// Emit only after the entire packet validates. This is not executable SQL or an approval.
console.log(JSON.stringify({ mode: 'offline-proposal', plans }, null, 2));
