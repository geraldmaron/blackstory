/**
 * More tab index (MOB-015 — fills in the MOB-008 stub for the content rows; "Corrections" was
 * already wired by MOB-008/MOB-016 and is left untouched). About, Quick facts, Legal, Privacy,
 * and Errata now navigate into `/learn/[section]` (this bead's ownership covers Learn AND More
 * content paths — see `src/features/learn/sections.ts`). "Data" (web: `/data`, national rollups
 * built on cited public statistics) is NOT one of this bead's content areas and stays a
 * non-interactive placeholder pending its own bead.
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  LiftedSurface,
  ListRow,
  NavIcon,
  type NavIconName,
  ScreenCanvas,
  ScreenHeader,
  SectionHeader,
  screenScrollInsets,
  space,
} from '@/ui';
import { MORE_SECTIONS } from '@/features/learn';

const OUT_OF_SCOPE_SECTIONS = [{ title: 'Data', subtitle: 'National rollups — coming soon', icon: 'data' as const }] as const;

const ABOUT_SECTION_IDS = new Set(['about', 'facts']);
const LEGAL_SECTION_IDS = new Set(['legal', 'privacy', 'errata']);

const SECTION_ICONS: Record<string, NavIconName> = {
  about: 'about',
  facts: 'facts',
  legal: 'legal',
  privacy: 'privacy',
  errata: 'errata',
};

export default function MoreScreen() {
  const aboutRows = MORE_SECTIONS.filter((s) => ABOUT_SECTION_IDS.has(s.routeId));
  const legalRows = MORE_SECTIONS.filter((s) => LEGAL_SECTION_IDS.has(s.routeId));

  return (
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker="BlackStory"
          title="More"
          dek="About the project, legal reference, and ways to contribute."
          compact
        />

        <View style={styles.section}>
          <SectionHeader title="Contribute" meta="Community" headingScale="bodyEmphasis" />
          <LiftedSurface gradient="copperAccentEdge" shadow="md" paddingKey="4">
            <View style={styles.contributeRow}>
              <NavIcon name="corrections" size={24} />
              <Button
                label="Submit a correction"
                variant="accent"
                onPress={() => router.push('/corrections/submit')}
                accessibilityHint="Opens the correction submission form"
              />
            </View>
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="About BlackStory" meta="Overview" headingScale="bodyEmphasis" />
          <LiftedSurface gradient="panelAtmosphere" shadow="sm">
            {aboutRows.map((section, index) => (
              <ListRow
                key={section.routeId}
                density="compact"
                title={section.title}
                subtitle={section.subtitle}
                leading={<NavIcon name={SECTION_ICONS[section.routeId] ?? 'about'} />}
                showChevron
                onPress={() => router.push(`/learn/${section.routeId}` as never)}
                showDivider={index < aboutRows.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Reference" meta="Legal & errata" headingScale="bodyEmphasis" />
          <LiftedSurface gradient="panelAtmosphere" shadow="sm">
            {legalRows.map((section, index) => (
              <ListRow
                key={section.routeId}
                density="compact"
                title={section.title}
                subtitle={section.subtitle}
                leading={<NavIcon name={SECTION_ICONS[section.routeId] ?? 'legal'} />}
                showChevron
                onPress={() => router.push(`/learn/${section.routeId}` as never)}
                showDivider={index < legalRows.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Coming soon" meta="Data" headingScale="bodyEmphasis" />
          <LiftedSurface shadow="sm" tone="surface">
            {OUT_OF_SCOPE_SECTIONS.map((section, index) => (
              <ListRow
                key={section.title}
                density="compact"
                title={section.title}
                subtitle={section.subtitle}
                leading={<NavIcon name={section.icon} />}
                interactive={false}
                showDivider={index < OUT_OF_SCOPE_SECTIONS.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: screenScrollInsets.gap,
  },
  section: {
    gap: space['2'],
  },
  contributeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['3'],
  },
});
