/**
 * More tab index — v6 Surface edition stack with indexed section panels and compact
 * LedgerRow links driven by `MOBILE_MORE_SECTIONS`.
 */
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';

import {
  EditionSurfacePanel,
  EditionSurfaceStack,
  LedgerRow,
  LiftedSurface,
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
        <EditionSurfaceStack>
          <EditionSurfacePanel
            index="00"
            kicker="BlackStory"
            title="More"
            dek="About the project, extended catalog, and ways to contribute."
            compact
          />

          {MOBILE_MORE_SECTIONS.map((section, sectionIndex) => (
            <EditionSurfacePanel
              key={section.id}
              index={String(sectionIndex + 1).padStart(2, '0')}
              kicker={section.meta ?? 'Browse'}
              title={section.title}
            >
              <LiftedSurface tone="surfaceRaised" shadow="none">
                {section.rows.map((row, index) => (
                  <LedgerRow
                    key={row.id}
                    title={row.title}
                    summary={row.subtitle}
                    indexLabel={String(index + 1).padStart(2, '0')}
                    leading={<NavIcon name={row.icon} size={20} />}
                    showChevron
                    onPress={() => openMoreRow(row)}
                    showDivider={index < section.rows.length - 1}
                  />
                ))}
              </LiftedSurface>
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
  },
});
