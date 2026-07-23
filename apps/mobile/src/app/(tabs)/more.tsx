/**
 * More tab index — Ledger Line: one masthead + mono section labels + LedgerRows
 * on Archive Paper. No per-section bordered panels or indexed headers.
 */
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { BrowseScreenShell, LedgerRow, LedgerSectionLabel, NavIcon } from '@/ui';
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
    <BrowseScreenShell
      kicker="BlackStory"
      title="More"
      dek="About the project, extended catalog, and ways to contribute."
    >
      {MOBILE_MORE_SECTIONS.map((section, sectionIndex) => (
        <View key={section.id} style={styles.section}>
          <LedgerSectionLabel ruleAbove={sectionIndex > 0}>{section.title}</LedgerSectionLabel>
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
        </View>
      ))}
    </BrowseScreenShell>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 4,
  },
});
