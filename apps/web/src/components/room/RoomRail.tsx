/**
 * The shape of a grouping link the stories index still builds (era, place, tag). The RailGroup
 * component that drew it is gone; this type goes with the last builder that returns it.
 */
import type React from 'react';

export type RailEntry = {
  readonly label: string;
  readonly href: string;
  readonly count?: number;
  /** Leading decorative mark. */
  readonly glyph?: React.ReactNode;
};
