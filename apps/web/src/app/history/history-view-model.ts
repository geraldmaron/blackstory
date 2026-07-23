/**
 * Pure server-side view-model entry for the `/history` page thin re-export so tests can
 * import from the app route folder without pulling Next.js page types.
 */
export { buildHistoryViewModel } from '../../lib/history/history-view-model';
export type { HistoryViewModel } from '../../lib/history/history-view-model.types';
