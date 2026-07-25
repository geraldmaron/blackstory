/**
 * Client-safe History view-model types for `/history`. Kept separate from
 * `history-view-model.ts` so client components can type props without pulling
 * server-only search/graph builders into the browser bundle.
 */
import type { HistoryEdgeView, HistoryNodeView } from './build-history-graph';
import type { HistoryFacetOption } from './filters';
import type { HistoryOverview } from './overview';
import type { HistoryViewState } from './url-state';

export type HistoryViewModel = {
  readonly viewState: HistoryViewState;
  readonly availableDecades: readonly string[];
  readonly activeDecade?: string;
  readonly sparseDecade: boolean;
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly facetOptions: {
    /** Consolidated high-level type categories (primary chips). */
    readonly kind: readonly HistoryFacetOption[];
    /** Full raw entity-kind vocabulary for the advanced "all record types" disclosure. */
    readonly kindDetail: readonly HistoryFacetOption[];
    readonly status: readonly HistoryFacetOption[];
    readonly era: readonly HistoryFacetOption[];
    readonly topic: readonly HistoryFacetOption[];
  };
  readonly overview: HistoryOverview;
  readonly totalMatched: number;
  /**
   * True when an active text query broadened the result set from the selected decade to the
   * full dataset (search is never scoped to a single decade). Drives the "spanning all
   * decades" hint in the result bar.
   */
  readonly searchSpansAllTime: boolean;
  readonly releaseId: string;
  readonly contentHash: string;
  readonly selectedNode?: HistoryNodeView;
  readonly selectedEdge?: HistoryEdgeView;
};
