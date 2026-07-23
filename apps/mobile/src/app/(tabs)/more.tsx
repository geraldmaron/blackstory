/**
 * More tab index — v6 Surface edition stack with indexed section panels and compact
 * LedgerRow links driven by `MOBILE_MORE_SECTIONS`.
 */
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import {
  EditionPanelHeader,
  EditionSurfacePanel,
  EditionSurfaceStack,
  LedgerRow,
  NavIcon,
  ScreenCanvas,
  screenScrollInsets,
} from '@/ui';
import { MOBILE_MORE_SECTIONS, type MobileMoreRow } from '@/shell/mobile-nav';

function openMoreRow(row: MobileMoreRow) {
  if (row.destination.kind === 'web') {
    void Linking.openURL(row.destination.href);
    return;
  }
  router.push(row.destination.route as never);
}

export default function MoreScreen() {
  return (
    <ScreenCanvas>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Bare header, not a bordered panel — a whole card spent on just the
            screen title pushed the first actionable row ~110pt down. */}
        <EditionPanelHeader
          index="00"
          kicker="BlackStory"
          title="More"
          dek="About the project, extended catalog, and ways to contribute."
        />

        <EditionSurfaceStack>
          {MOBILE_MORE_SECTIONS.map((section, sectionIndex) => (
            <EditionSurfacePanel
              key={section.id}
              index={String(sectionIndex + 1).padStart(2, '0')}
              kicker={section.meta ?? 'Browse'}
              title={section.title}
            >
              {/* No inner LiftedSurface — the panel is already a bordered surface,
                  so a nested one only added a second concentric border. */}
              <View>
                {section.rows.map((row, index) => (
                  <LedgerRow
                    key={row.id}
                    title={row.title}
                    summary={row.subtitle}
                    leading={<NavIcon name={row.icon} size={20} />}
                    showChevron
                    onPress={() => openMoreRow(row)}
                    showDivider={index < section.rows.length - 1}
                  />
                ))}
              </View>
            </EditionSurfacePanel>
          ))}
        </EditionSurfaceStack>
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
});
