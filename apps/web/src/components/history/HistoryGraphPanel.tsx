/**
 * Progressive-disclosure history panel for `/history`. Delegates to HistoryDataPanel —
 * kind composition, connection inventory, and cited archive framings — instead of the
 * former relationship-graph SVG.
 */
import React from 'react';
import type { HistoryEdgeView, HistoryNodeView } from '../../lib/history/build-history-graph';
import { HistoryDataPanel } from './HistoryDataPanel';

void React;

export type HistoryGraphPanelProps = {
  readonly nodes: readonly HistoryNodeView[];
  readonly edges: readonly HistoryEdgeView[];
  readonly selectedId?: string;
  readonly selectedEdgeId?: string;
  readonly sparseDecade: boolean;
  readonly onSelectNode?: (entityId: string) => void;
  readonly onSelectEdge?: (edgeId: string) => void;
  readonly onSelectKind?: (kind: string) => void;
  readonly activeKind?: string;
  readonly labelledBy?: string;
  readonly className?: string;
};

/** @deprecated Prefer HistoryDataPanel — kept as a stable import for page/experience wiring. */
export function HistoryGraphPanel(props: HistoryGraphPanelProps) {
  return <HistoryDataPanel {...props} />;
}
