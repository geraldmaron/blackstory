/**
 * Native Themes detail — theme intro, method stance, and researched packet stacks.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  Button,
  EmptyState,
  LedgerSectionLabel,
  Notice,
  RecordFactStrip,
  EditionBrandHeader,
  ScreenCanvas,
  Text,
  screenScrollInsets,
  space,
} from '@/ui';
import {
  THEMES_DETAIL,
  THEMES_GAP_COPY,
  THEMES_METHOD_STANCE,
} from './themes-copy';
import {
  getThemeById,
  listPacketsForTheme,
  plainDashCopy,
  toCatalogRow,
} from './catalog';
import type { ThemePacketView } from './types';

export type ThemesDetailScreenProps = {
  readonly themeId: string;
};

function PacketBlock({ packet }: { readonly packet: ThemePacketView }) {
  const stance =
    THEMES_METHOD_STANCE[packet.methodStance] ?? THEMES_METHOD_STANCE.juxtaposition;
  const eras =
    packet.policyEras.length > 0
      ? packet.policyEras.map((era) => era.label).join(', ')
      : 'None listed';
  const gapNotices = packet.gapStates.map((gap) => THEMES_GAP_COPY[gap]).filter(Boolean);

  return (
    <View style={styles.section}>
      <LedgerSectionLabel ruleAbove meta={packet.questionId}>
        Packet
      </LedgerSectionLabel>
      <Text variant="rowTitle" colorRole="ink">
        {plainDashCopy(packet.question)}
      </Text>
      <Text variant="caption" colorRole="accent">
        {stance}
      </Text>
      <Text variant="body" colorRole="ink">
        {plainDashCopy(packet.observationsSummary)}
      </Text>
      <Text variant="caption" colorRole="inkMuted">
        {plainDashCopy(packet.methodNote)}
      </Text>

      <RecordFactStrip
        facts={[
          {
            key: 'geo',
            label: THEMES_DETAIL.geographyLabel,
            value: plainDashCopy(packet.geography.label),
          },
          {
            key: 'eras',
            label: THEMES_DETAIL.erasLabel,
            value: plainDashCopy(eras),
          },
          {
            key: 'obs',
            label: THEMES_DETAIL.observationsTitle,
            value: String(packet.observations.length),
          },
          {
            key: 'art',
            label: THEMES_DETAIL.artifactsTitle,
            value: String(packet.artifacts.length),
          },
        ]}
      />

      {gapNotices.map((copy) => (
        <Notice key={copy.title} tone="warning" title={copy.title} description={copy.body} />
      ))}

      {packet.observations.length > 0 ? (
        <View style={styles.stack}>
          <Text variant="sectionLabel" colorRole="inkMuted">
            {THEMES_DETAIL.observationsTitle}
          </Text>
          {packet.observations.map((obs) => (
            <View key={obs.id} style={styles.factRow}>
              <Text variant="caption" colorRole="inkMuted">
                {plainDashCopy(obs.label)}
                {obs.referencePeriod ? ` · ${obs.referencePeriod}` : ''}
              </Text>
              <Text variant="body" colorRole="ink">
                {plainDashCopy(obs.value)}
              </Text>
              <Text variant="caption" colorRole="inkMuted">
                {plainDashCopy(obs.provenance.humanCitation)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {packet.derived.length > 0 ? (
        <View style={styles.stack}>
          <Text variant="sectionLabel" colorRole="inkMuted">
            {THEMES_DETAIL.derivedTitle}
          </Text>
          {packet.derived.map((row) => (
            <View key={row.id} style={styles.factRow}>
              <Text variant="caption" colorRole="inkMuted">
                {plainDashCopy(row.label)}
              </Text>
              <Text variant="body" colorRole="ink">
                {plainDashCopy(row.value)}
              </Text>
              <Text variant="caption" colorRole="inkMuted">
                {plainDashCopy(row.provenance.humanCitation)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {packet.artifacts.length > 0 ? (
        <View style={styles.stack}>
          <Text variant="sectionLabel" colorRole="inkMuted">
            {THEMES_DETAIL.artifactsTitle}
          </Text>
          {packet.artifacts.map((art) => (
            <View key={art.id} style={styles.factRow}>
              <Text variant="rowTitle" colorRole="ink">
                {plainDashCopy(art.title)}
              </Text>
              {art.dateLabel ? (
                <Text variant="caption" colorRole="inkMuted">
                  {plainDashCopy(art.dateLabel)}
                </Text>
              ) : null}
              <Text variant="body" colorRole="ink">
                {plainDashCopy(art.summary)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ThemesDetailScreen({ themeId }: ThemesDetailScreenProps) {
  const entry = useMemo(() => getThemeById(themeId), [themeId]);
  const packets = useMemo(() => listPacketsForTheme(themeId), [themeId]);

  if (!entry) {
    return (
      <ScreenCanvas edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <EmptyState title={THEMES_DETAIL.missingTitle} description={THEMES_DETAIL.missingBody} />
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label={THEMES_DETAIL.backCta}
              variant="secondary"
              density="compact"
              onPress={() => router.replace('/themes' as never)}
            />
          </View>
        </ScrollView>
      </ScreenCanvas>
    );
  }

  const row = toCatalogRow(entry);

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <EditionBrandHeader
          kicker={`${THEMES_DETAIL.introKicker} · ${row.priorityLabel}`}
          title={row.title}
          dek={row.lede}
          compact
          dense
        />

        <View style={styles.section}>
          <LedgerSectionLabel>{THEMES_DETAIL.methodTitle}</LedgerSectionLabel>
          <Text variant="caption" colorRole="accent">
            {THEMES_METHOD_STANCE.juxtaposition}
          </Text>
          <Text variant="body" colorRole="ink">
            Packets below keep geography, eras, and evidentiary limits visible. Co-movement is not
            treated as proof of cause.
          </Text>
          <View style={{ alignItems: 'flex-start' }}>
            <Button
              label={THEMES_DETAIL.methodologyCta}
              variant="ghost"
              density="compact"
              onPress={() => router.push('/learn/methodology' as never)}
            />
          </View>
        </View>

        {packets.length === 0 ? (
          <EmptyState
            compact
            title="No packets in this release"
            description="This theme is listed but researched packets are not embedded yet."
          />
        ) : (
          <>
            <Text variant="caption" colorRole="inkMuted">
              {THEMES_DETAIL.packetsLede}
            </Text>
            {packets.map((packet) => (
              <PacketBlock key={`${packet.themeId}-${packet.questionId}`} packet={packet} />
            ))}
          </>
        )}
      </ScrollView>
    </ScreenCanvas>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: screenScrollInsets.paddingHorizontal,
    paddingTop: screenScrollInsets.paddingTop,
    paddingBottom: screenScrollInsets.paddingBottom,
    gap: space['3'],
  },
  section: {
    gap: space['2'],
  },
  stack: {
    gap: space['2'],
  },
  factRow: {
    gap: space['1'],
  },
});
