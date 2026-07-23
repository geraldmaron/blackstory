/**
 * Barrel exports for the utility v6 edition pattern. Import CSS once per route:
 * `import '@/components/patterns/utility-edition/utility-edition.css'` (or relative equivalent).
 */
export {
  UTILITY_EDITION_ROOT_CLASS,
  UTILITY_EDITION_PANEL_CLASS,
  utilityEditionRootClassName,
  utilityEditionStackClassName,
  utilityEditionPanelClassName,
  type UtilityEditionPanelVariant,
} from './utility-edition-chrome';
export { UtilityEditionShell, type UtilityEditionShellProps } from './UtilityEditionShell';
export { UtilityEditionIntro, type UtilityEditionIntroProps } from './UtilityEditionIntro';
export {
  UtilityEditionBodyPanel,
  type UtilityEditionBodyPanelProps,
} from './UtilityEditionBodyPanel';
export {
  UtilityEditionErrorView,
  type UtilityEditionErrorViewProps,
} from './UtilityEditionErrorView';
