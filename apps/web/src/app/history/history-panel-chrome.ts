/**
 * Pure class-name helpers for History v6 edition panels: Surface card stack, beat
 * variants, and shared explore decade scrubber hooks. Keeps page/experience JSX
 * readable and gives tests a stable contract for CSS and a11y.
 */

/** Root wrapper on `/history` main content — pairs with history-edition.css. */
export const HISTORY_EDITION_ROOT_CLASS = 'ds-history-edition';

/** Default Surface edition panel. */
export const HISTORY_EDITION_PANEL_CLASS = 'ds-history-edition__panel';

/** Mono copper slug above panel body (home/explore edition kicker register). */
export const HISTORY_EDITION_KICKER_CLASS = 'ds-history-edition__kicker';

/** Decade scrubber — shared visual register with explore map settings (explore-edition.css). */
export const HISTORY_DECADE_STEPPER_CLASS = 'ds-explore-edition__decade-stepper';

export const HISTORY_DECADE_LIST_CLASS = 'ds-explore-edition__decade-list';

export const HISTORY_DECADE_TAB_CLASS = 'ds-explore-edition__decade-tab';

export type HistoryEditionPanelVariant = 'intro' | 'timeline' | 'instruments' | 'composition' | 'records';

export function historyEditionRootClassName(): string {
  return HISTORY_EDITION_ROOT_CLASS;
}

export function historyEditionPanelClassName(variant?: HistoryEditionPanelVariant): string {
  if (!variant) {
    return HISTORY_EDITION_PANEL_CLASS;
  }
  return `${HISTORY_EDITION_PANEL_CLASS} ds-history-edition__panel--${variant}`;
}

export function historyEditionKickerClassName(): string {
  return HISTORY_EDITION_KICKER_CLASS;
}

export function historyDecadeStepperClassName(): string {
  return HISTORY_DECADE_STEPPER_CLASS;
}

export function historyDecadeListClassName(): string {
  return HISTORY_DECADE_LIST_CLASS;
}

export function historyDecadeTabClassName(options?: { readonly active?: boolean }): string {
  const parts = [HISTORY_DECADE_TAB_CLASS];
  if (options?.active) {
    parts.push(`${HISTORY_DECADE_TAB_CLASS}--active`);
  }
  return parts.join(' ');
}
