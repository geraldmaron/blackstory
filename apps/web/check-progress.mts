import { queryPostgres } from './src/lib/public-data/postgres-client';
const r = await queryPostgres<any>(
  `SELECT projection->>'status' AS status, count(*)::int AS n
     FROM bb_public.release_entities
    WHERE release_id=(SELECT release_id FROM bb_public.active_release WHERE id='active')
    GROUP BY 1 ORDER BY n DESC`);
console.log('current published status distribution:'); r.forEach((x: any) => console.log(String(x.n).padStart(6), x.status));
const d = await queryPostgres<any>(
  `SELECT count(*)::int AS n FROM bb_public.release_entities a
     JOIN bb_public.release_entities_backup_prerepub b USING (entity_id)
    WHERE a.release_id=(SELECT release_id FROM bb_public.active_release WHERE id='active')
      AND a.projection IS DISTINCT FROM b.projection`);
console.log('\nrows already differing from the pre-republish backup:', d[0].n);
process.exit(0);
