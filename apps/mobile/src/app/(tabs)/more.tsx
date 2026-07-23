/**
 * More tab index — sectioned ledger lists, one contribute CTA, honest
 * coming-soon Data row, and a web handoff for Banned books.
 */
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

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
import { CANONICAL_WEB_ORIGIN } from '@/features/entity/share';

const OUT_OF_SCOPE_SECTIONS = [
  { title: 'Data', subtitle: 'National rollups — coming soon', icon: 'data' as const },
] as const;

const WEB_HANDOFF_SECTIONS = [
  {
    title: 'Banned books',
    subtitle: 'Challenged titles with cited reports (opens web)',
    icon: 'books' as const,
    href: `${CANONICAL_WEB_ORIGIN}/books`,
  },
] as const;

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
          <LiftedSurface tone="surface" shadow="none" paddingKey="3">
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
          <LiftedSurface tone="surface" shadow="none">
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
          <LiftedSurface tone="surface" shadow="none">
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
          <SectionHeader title="On the web" meta="Full catalog" headingScale="bodyEmphasis" />
          <LiftedSurface tone="surface" shadow="none">
            {WEB_HANDOFF_SECTIONS.map((section, index) => (
              <ListRow
                key={section.title}
                density="compact"
                title={section.title}
                subtitle={section.subtitle}
                leading={<NavIcon name={section.icon} />}
                showChevron
                onPress={() => {
                  void Linking.openURL(section.href);
                }}
                showDivider={index < WEB_HANDOFF_SECTIONS.length - 1}
              />
            ))}
          </LiftedSurface>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Coming soon" meta="Data" headingScale="bodyEmphasis" />
          <LiftedSurface tone="surface" shadow="none">
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
