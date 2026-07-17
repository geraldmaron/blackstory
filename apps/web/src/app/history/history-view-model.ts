/**
 * Pure server-side view-model entry for the BB-093 `/history` page — thin re-export so tests can
 * import from the app route folder without pulling Next.js page types.
 */
export { buildHistoryViewModel, type HistoryViewModel } from '../../lib/history/history-view-model';
