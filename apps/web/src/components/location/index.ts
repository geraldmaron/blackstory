/**
 * Local barrel for the `/locate` UI components. `apps/web` has no package-level barrel
 * for `src/components/**` (each component is imported by its own relative path throughout this
 * app see `../SiteHeader.tsx`'s importers), so this file is purely a convenience for this
 * directory's own callers (`../../app/locate/page.tsx`); nothing outside this depends on it
 * existing.
 */
export { LocateExperience } from './LocateExperience';
export { LocationConsentButton, type LocationConsentButtonProps } from './LocationConsentButton';
export { LocationPrivacyNotice } from './LocationPrivacyNotice';
export { LocationResolutionPanel, type LocationResolutionPanelProps } from './LocationResolutionPanel';
export { ManualPlaceSearchForm, type ManualPlaceSearchFormProps } from './ManualPlaceSearchForm';
