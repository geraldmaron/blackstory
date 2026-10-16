// Writes the real /records page-1 model (100 rows) to data/records-model.json for the spike.
// data/ is gitignored: entity data stays out of git. Run from apps/web with its .env.local sourced:
//   set -a && . ./.env.local && set +a && NODE_ENV=development PUBLIC_DATA_SOURCE=postgres \
//   node --conditions development --import ../../docs/ui/spikes/expo-web-methodology/preload.mjs \
//        --import tsx ../../docs/ui/spikes/expo-web-methodology/export-records.mts <out.json>
import { writeFileSync } from 'node:fs';

const { loadRecordsIndex, recordsQueryCacheKey } = await import(
  new URL('../../../../apps/web/src/app/records/load-records-index.ts', import.meta.url).href
);
const { model, catalogSource } = await loadRecordsIndex(recordsQueryCacheKey({}));
writeFileSync(process.argv[2], JSON.stringify({ model, catalogSource }));
console.log('rows', model.rows.length, 'total', model.totalAll, 'source', catalogSource);
