/**
 * Brand font loading via `expo-font` + `@expo-google-fonts/*`.
 *
 * brand/tokens/typography.json specifies Outfit, the wordmark's own face (display, with
 * weight as the contrast axis: 800 display, 700 headline, 650 title; mobile
 * uses the static 800/700/600 files), Geist (UI/body), Newsreader (editorial), and Geist Mono
 * (data/citations) — see tokens/generated/typography.generated.ts. This
 * matches apps/web/src/app/layout.tsx's next/font/google set; web loads
 * these as variable faces, mobile needs one static file per weight since
 * @expo-google-fonts ships static-only. All four are Google Fonts
 * distributed under the SIL Open Font License 1.1:
 *   - Outfit: OFL 1.1 (The Outfit Project Authors)
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
import { Outfit_600SemiBold, Outfit_700Bold, Outfit_800ExtraBold } from '@expo-google-fonts/outfit';
import { Newsreader_400Regular, Newsreader_400Regular_Italic } from '@expo-google-fonts/newsreader';
import { GeistMono_500Medium } from '@expo-google-fonts/geist-mono';

/**
 * Registered font-loading keys. Google Fonts ship one static file per
 * weight, so — unlike a variable font — each (family, weight) pair used by
 * tokens/generated/typography.generated.ts's `typeScale` needs its own
 * registered key; `resolveFontFamily` below maps a type-scale entry to the
 * matching key. `fontFamilies` (the generated brand-name strings, e.g.
 * "Outfit") is documentation of what the brand calls
 * each role, not literally the RN `fontFamily` value — RN needs the
 * registered key.
 */
const REGISTERED_FONTS = {
  'Outfit-SemiBold': Outfit_600SemiBold,
  'Outfit-Bold': Outfit_700Bold,
  'Outfit-ExtraBold': Outfit_800ExtraBold,
  'Geist-Regular': Geist_400Regular,
  'Geist-Medium': Geist_500Medium,
  'Geist-SemiBold': Geist_600SemiBold,
  'Newsreader-Regular': Newsreader_400Regular,
  'Newsreader-Italic': Newsreader_400Regular_Italic,
  'GeistMono-Medium': GeistMono_500Medium,
} as const;

/**
 * Loads the brand's four type families (eight weight-specific files). Returns
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
  const numericWeight = Number(weight);
  // Display weight is a contrast axis on web (800 display, 700 headline); static files per weight.
  if (familyRole === 'display') {
    if (numericWeight >= 800) return 'Outfit-ExtraBold';
    if (numericWeight >= 700) return 'Outfit-Bold';
    return 'Outfit-SemiBold';
  }
  if (familyRole === 'editorial') return 'Newsreader-Regular';
  if (familyRole === 'dataMono') return 'GeistMono-Medium';
  // uiBody (Geist): pick the closest loaded static weight.
  if (numericWeight >= 600) return 'Geist-SemiBold';
  if (numericWeight >= 500) return 'Geist-Medium';
  return 'Geist-Regular';
}
