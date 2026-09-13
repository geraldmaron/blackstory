/**
 * Local barrel for the `/locate` UI components. `apps/web` has no package-level barrel
 * for `src/components/**` (each component is imported by its own relative path throughout this
 * app), so this file is purely a convenience for this directory's own callers; nothing outside
 * this depends on it existing.
 *
 * `LocateExperience` and the standalone `/locate` page it backed are deleted (repo-92n2.14 /
 * SP-14): the experience is now `../map-experience/PlaceFinder.tsx`, mounted in the Atlas Lens's
 * Where group, which imports `LocationConsentButton` and `LocationPrivacyNotice` directly rather
 * than through this barrel. `ManualPlaceSearchForm` and `LocationResolutionPanel` stay exported
 * here though nothing outside their own tests references them any more — `LocateExperience` was
 * their only caller; deleting them is a separate, out-of-scope cleanup (see the SP-14 report).
 */
export { LocationConsentButton, type LocationConsentButtonProps } from './LocationConsentButton';
export { LocationPrivacyNotice } from './LocationPrivacyNotice';
export {
  LocationResolutionPanel,
  type LocationResolutionPanelProps,
} from './LocationResolutionPanel';
export { ManualPlaceSearchForm, type ManualPlaceSearchFormProps } from './ManualPlaceSearchForm';
