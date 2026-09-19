/**
 * After in-place release or search writes, remind the operator to regenerate catalog artifacts.
 * The release id alone cannot detect stale content. Local publication and manual workflow
 * dispatch share the dirty watermark; running both wastes CI time. No scheduled run repairs a
 * forgotten publication.
 */
export function remindToRepublishCatalogArtifacts(changedRowCount: number): void {
  if (changedRowCount <= 0) return;
  console.log('');
  console.log(
    'CDN CATALOG ARTIFACT IS NOW STALE. This run wrote to published directly, and the published ' +
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
