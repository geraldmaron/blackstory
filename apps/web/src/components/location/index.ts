/**
 * Local barrel for the `/locate` UI components. `apps/web` has no package-level barrel
 * for `src/components/**` (each component is imported by its own relative path throughout this
 * app), so this file is purely a convenience for this directory's own callers; nothing outside
 * this depends on it existing.
 *
 * The active place-finding experience is `../map-experience/PlaceFinder.tsx`, mounted in the
 * Atlas Lens's Where group. It imports `LocationConsentButton` and `LocationPrivacyNotice`
 * directly. `ManualPlaceSearchForm` and `LocationResolutionPanel` remain available here for their
 * focused tests but have no production callers.
 */
export { LocationConsentButton, type LocationConsentButtonProps } from './LocationConsentButton';
export { LocationPrivacyNotice } from './LocationPrivacyNotice';
export {
  LocationResolutionPanel,
  type LocationResolutionPanelProps,
} from './LocationResolutionPanel';
export { ManualPlaceSearchForm, type ManualPlaceSearchFormProps } from './ManualPlaceSearchForm';
