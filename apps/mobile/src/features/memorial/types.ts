/**
 * Memorial catalog types for native mobile — names-forward remembrance list.
 */
export type MemorialNameEntry = {
  readonly name: string;
  readonly entityId?: string;
  readonly locationLabel?: string;
  readonly placeLabel?: string;
  readonly lat?: number;
  readonly lng?: number;
  readonly locationPrecision?: string;
};

export type MemorialCatalogSnapshot = {
  readonly version: string;
  readonly generatedAt: string;
  readonly incompleteByDesign: boolean;
  readonly names: readonly MemorialNameEntry[];
};
