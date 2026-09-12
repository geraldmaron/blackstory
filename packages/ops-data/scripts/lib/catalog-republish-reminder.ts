/**
 * repo-19mxs: a script that writes to `bb_public.release_entities` / `bb_public.search_index`
 * directly (not through a release activation) leaves the CDN catalog artifact (entities.json /
 * search-index.json) stale — the shared release-artifact fetcher's guard on the read side only
 * checks `releaseId` identity, which does not change on an in-place correction, so it cannot tell a
 * fresh artifact from a pre-correction one. The trigger-maintained watermark
 * (`bb_public.release_catalog_publish_watermark`, supabase/migrations/20260808020846_*)
 * already knows the write just happened; nothing told the person who just ran this script.
 *
 * This function is that reminder. Call it once, after a successful commit, from any script that
 * wrote to either table.
 *
 * The republish it asks for is a LOCAL run of publish-release-catalog-artifacts.ts, which is the
 * same script `.github/workflows/publish-release-catalog-artifacts.yml` runs. Both consume the
 * same watermark, so whichever goes first does the work and the other finds
 * `dirty_at <= published_at` and skips. Dispatching the workflow after publishing locally
 * therefore spends CI minutes to reach a no-op, which is why the local command is the one printed
 * here. The workflow stays the right entry point when there is no local environment to run it
 * from, and its daily cron remains forgetting-insurance — a ~24h worst-case bound, not the
 * freshness mechanism.
 */
export function remindToRepublishCatalogArtifacts(changedRowCount: number): void {
  if (changedRowCount <= 0) return;
  console.log('');
  console.log(
    'CDN CATALOG ARTIFACT IS NOW STALE. This run wrote to bb_public directly, and the published ' +
      'entities.json / search-index.json do not know about it yet — readers keep seeing ' +
      'pre-run data until the artifact is republished.',
  );
  console.log('Run this now, from the repo root:');
  console.log(
    '  cd apps/web && set -a && . ./.env.local && set +a \\\n' +
      '    && node --conditions development --import tsx \\\n' +
      '       ../../packages/ops-data/scripts/publish-release-catalog-artifacts.ts',
  );
  console.log(
    'Do NOT also dispatch publish-release-catalog-artifacts.yml afterwards — it runs this same ' +
      'script against the same watermark and will simply report "up to date — skipping".',
  );
  console.log(
    '(Left unrun, the daily forgetting-insurance cron picks it up within ~24h — see that ' +
      "workflow's own header comment.)",
  );
}
