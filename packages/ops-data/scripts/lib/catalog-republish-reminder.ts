/**
 * repo-19mxs: a script that writes to `bb_public.release_entities` / `bb_public.search_index`
 * directly (not through a release activation) leaves the CDN catalog artifact (entities.json /
 * search-index.json) stale — the shared release-artifact fetcher's guard on the read side only
 * checks `releaseId` identity, which does not change on an in-place correction, so it cannot tell a
 * fresh artifact from a pre-correction one. The trigger-maintained watermark
 * (`bb_public.release_catalog_publish_watermark`, supabase/migrations/20260808020846_*)
 * already knows the write just happened; nothing told the person who just ran this script.
 *
 * The intended primary path (see `.github/workflows/publish-release-catalog-artifacts.yml`'s own
 * header) is a manual `workflow_dispatch` right after a write like this one — the daily cron is
 * explicitly "forgetting-insurance", a ~24h worst-case bound, not the freshness mechanism. This
 * function is that reminder: call it once, after a successful commit, from any script that wrote
 * to either table, so the daily cron isn't the only thing standing between a correction and the
 * live site actually showing it.
 */
export function remindToRepublishCatalogArtifacts(changedRowCount: number): void {
  if (changedRowCount <= 0) return;
  console.log('');
  console.log(
    'CDN CATALOG ARTIFACT IS NOW STALE. This run wrote to bb_public directly, and the published ' +
      'entities.json / search-index.json do not know about it yet — readers keep seeing ' +
      'pre-run data until the artifact is republished.',
  );
  console.log('Run this now:');
  console.log('  gh workflow run publish-release-catalog-artifacts.yml');
  console.log(
    '(Left unrun, the daily forgetting-insurance cron picks it up within ~24h — see that ' +
      "workflow's own header comment.)",
  );
}
