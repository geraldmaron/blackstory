/**
 * Learn tab index (MOB-015 — fills in the MOB-008 stub). Lists the learning-oriented content
 * sections (History, Topics, Myths, Methodology); each row navigates into `/learn/[section]`,
 * which either lists that section's pages or — for a single-page section like Methodology —
 * renders the page directly. See `src/features/learn/sections.ts` for the registry this list is
 * generated from and `docs/mobile/mobile-app-epic.md` for why Learn/More consolidate web's
 * learning + overflow nav into two mobile tabs.
 */
import { router } from 'expo-router';
import { LEARN_SECTIONS, SectionListScreen } from '@/features/learn';

export default function LearnScreen() {
  return (
    <SectionListScreen
      title="Learn"
      intro="History, stories, myths, and methodology — offline-readable once opened."
      rows={LEARN_SECTIONS.map((section) => ({
        key: section.routeId,
        title: section.title,
        subtitle: section.subtitle,
        onPress: () => router.push(`/learn/${section.routeId}` as never),
      }))}
    />
  );
}
