/**
 * Brand font loading via `expo-font` + `@expo-google-fonts/*`.
 *
 * brand/tokens/typography.json specifies Schibsted Grotesk SemiBold
 * (display), Geist (UI/body), Newsreader (editorial), and Geist Mono
 * (data/citations) — see tokens/generated/typography.generated.ts. This
 * matches apps/web/src/app/layout.tsx's next/font/google set; web loads
 * these as variable faces, mobile needs one static file per weight since
 * @expo-google-fonts ships static-only. All four are Google Fonts
 * distributed under the SIL Open Font License 1.1:
 *   - Schibsted Grotesk: OFL 1.1 (Schibsted Media Group)
 *   - Geist: OFL 1.1 (Vercel)
 *   - Newsreader: OFL 1.1 (Production Type)
 *   - Geist Mono: OFL 1.1 (Vercel)
 * The OFL explicitly permits bundling, embedding, and redistributing the
 * font files with an application (it only restricts selling the font by
 * itself under its own name, and requires the license text travel with the
 * font) — this repo does neither of those, so bundling all four via
 * @expo-google-fonts is license-safe. The `@expo-google-fonts/*` packages
 * ship each font's own OFL.txt under their installed package directory
 * (node_modules/@expo-google-fonts/<family>/OFL.txt) — verify that file is
 * present for a given family if this claim ever needs re-checking against a
 * new font/package.
 */
import { useFonts } from 'expo-font';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { SchibstedGrotesk_600SemiBold } from '@expo-google-fonts/schibsted-grotesk';
import { Newsreader_400Regular } from '@expo-google-fonts/newsreader';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';

/**
 * Registered font-loading keys. Google Fonts ship one static file per
 * weight, so — unlike a variable font — each (family, weight) pair used by
 * tokens/generated/typography.generated.ts's `typeScale` needs its own
 * registered key; `resolveFontFamily` below maps a type-scale entry to the
 * matching key. `fontFamilies` (the generated brand-name strings, e.g.
 * "Schibsted Grotesk SemiBold") is documentation of what the brand calls
 * each role, not literally the RN `fontFamily` value — RN needs the
 * registered key.
 */
const REGISTERED_FONTS = {
  'SchibstedGrotesk-SemiBold': SchibstedGrotesk_600SemiBold,
  'Geist-Regular': Geist_400Regular,
  'Geist-Medium': Geist_500Medium,
  'Geist-SemiBold': Geist_600SemiBold,
  'Newsreader-Regular': Newsreader_400Regular,
  'GeistMono-Medium': GeistMono_500Medium,
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
  if (familyRole === 'display') return 'SchibstedGrotesk-SemiBold';
  if (familyRole === 'editorial') return 'Newsreader-Regular';
  if (familyRole === 'dataMono') return 'GeistMono-Medium';
  // uiBody (Geist): pick the closest loaded static weight.
  const numericWeight = Number(weight);
  if (numericWeight >= 600) return 'Geist-SemiBold';
  if (numericWeight >= 500) return 'Geist-Medium';
  return 'Geist-Regular';
}
