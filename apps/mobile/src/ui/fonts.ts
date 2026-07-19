/**
 * Brand font loading via `expo-font` + `@expo-google-fonts/*`.
 *
 * Font/license finding (MOB-007): brand/tokens/typography.json specifies
 * Sora SemiBold (display), Inter (UI/body), Source Serif 4 (editorial), and
 * IBM Plex Mono (data/citations) — see tokens/generated/typography.generated.ts.
 * All four are Google Fonts distributed under the SIL Open Font License 1.1:
 *   - Inter: OFL 1.1 (Rasmus Andersson / The Inter Project Authors)
 *   - Sora: OFL 1.1 (Ferdy Sandhyaguna / Sora Project Authors, via Cyreal)
 *   - Source Serif 4: OFL 1.1 (Adobe)
 *   - IBM Plex Mono: OFL 1.1 (IBM)
 * The OFL explicitly permits bundling, embedding, and redistributing the
 * font files with an application (it only restricts selling the font by
 * itself under its own name, and requires the license text travel with the
 * font) — this repo does neither of those, so bundling all four via
 * @expo-google-fonts is license-safe. The `@expo-google-fonts/*` packages
 * ship each font's own OFL.txt under their installed package directory
 * (node_modules/@expo-google-fonts/<family>/OFL.txt) — verify that file is
 * present for a given family if this claim ever needs re-checking against a
 * new font/package.
 *
 * (Note: an earlier iteration of this brand's design system used "Inter
 * Display" for the display role — see brand-source.ts's docblock — but the
 * current, live brand/tokens files use plain Sora SemiBold for display and
 * plain Inter for UI/body, so only those four families are loaded here.)
 */
import { useFonts } from 'expo-font';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Sora_600SemiBold } from '@expo-google-fonts/sora';
import { SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';

/**
 * Registered font-loading keys. Google Fonts ship one static file per
 * weight, so — unlike a variable font — each (family, weight) pair used by
 * tokens/generated/typography.generated.ts's `typeScale` needs its own
 * registered key; `resolveFontFamily` below maps a type-scale entry to the
 * matching key. `fontFamilies` (the generated brand-name strings, e.g.
 * "Sora SemiBold") is documentation of what the brand calls each role, not
 * literally the RN `fontFamily` value — RN needs the registered key.
 */
const REGISTERED_FONTS = {
  'Sora-SemiBold': Sora_600SemiBold,
  'Inter-Regular': Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'SourceSerif4-Regular': SourceSerif4_400Regular,
  'IBMPlexMono-Medium': IBMPlexMono_500Medium,
} as const;

/**
 * Loads the brand's four type families (six weight-specific files). Returns
 * `[fontsLoaded, error]` exactly like the underlying `useFonts` — render a
 * loading state (or simply defer rendering brand-typeset screens) until
 * `fontsLoaded` is true, per Expo's documented pattern.
 */
export function useBrandFonts() {
  return useFonts(REGISTERED_FONTS);
}

/** Maps a typeScale entry's (family role, weight) to a registered font key. */
export function resolveFontFamily(
  familyRole: 'display' | 'uiBody' | 'editorial' | 'dataMono',
  weight: string,
): keyof typeof REGISTERED_FONTS {
  if (familyRole === 'display') return 'Sora-SemiBold';
  if (familyRole === 'editorial') return 'SourceSerif4-Regular';
  if (familyRole === 'dataMono') return 'IBMPlexMono-Medium';
  // uiBody (Inter): pick the closest loaded static weight.
  const numericWeight = Number(weight);
  if (numericWeight >= 600) return 'Inter-SemiBold';
  if (numericWeight >= 500) return 'Inter-Medium';
  return 'Inter-Regular';
}
