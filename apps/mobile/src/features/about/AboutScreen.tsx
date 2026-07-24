/**
 * Mobile About storytelling screen — Ledger Line adaptation of web about v6.
 * Compact pillars with icons, numbered mission beats, publish posture, and
 * destination rows. Copper reserved for one primary CTA per fold.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import {
  Button,
  LedgerRow,
  LedgerSectionLabel,
  NavIcon,
  Notice,
  ScreenCanvas,
  ScreenHeader,
  Text,
  screenScrollInsets,
  space,
  useThemeColors,
} from '@/ui';
import {
  ABOUT_CLOSE,
  ABOUT_DESTINATIONS,
  ABOUT_INTRO,
  ABOUT_MISSION_BEATS,
  ABOUT_PILLARS,
  ABOUT_PUBLISH,
} from './about-copy';

export function AboutScreen() {
  const navigation = useNavigation();
  const theme = useThemeColors();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'About',
      headerTitle: 'About',
      headerBackTitle: 'More',
      headerLargeTitle: false,
      headerBackButtonDisplayMode: 'minimal',
    });
  }, [navigation]);

  return (
    <ScreenCanvas edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          kicker={ABOUT_INTRO.kicker}
          title={ABOUT_INTRO.title}
          dek={ABOUT_INTRO.lede}
          compact
          dense
        />

        <View style={styles.ctaRow}>
          <Button
            label="Open the map"
            variant="accent"
            density="compact"
            onPress={() => router.push('/explore')}
            accessibilityHint="Opens the Explore map tab"
          />
          <Button
            label="Methodology"
            variant="ghost"
            density="compact"
            onPress={() => router.push('/learn/methodology' as never)}
            accessibilityHint="Opens how records are researched"
          />
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel>What holds</LedgerSectionLabel>
          <Text variant="rowTitle" isHeading>
            Presence. Evidence. Dignity.
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            Three commitments travel with every record: place first, receipts attached, and
            protections that are rules rather than tone.
          </Text>
          <View
            style={styles.pillarGrid}
            accessibilityRole="summary"
            accessibilityLabel="What the archive stands on"
          >
            {ABOUT_PILLARS.map((pillar) => (
              <View
                key={pillar.kicker}
                style={[
                  styles.pillar,
                  { borderColor: theme.border, backgroundColor: theme.surface },
                ]}
                accessibilityRole="text"
                accessibilityLabel={`${pillar.kicker}. ${pillar.title}. ${pillar.body}`}
              >
                <View style={styles.pillarHead}>
                  <View
                    style={[styles.pillarTick, { backgroundColor: theme.accentGraphic }]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                  <NavIcon name={pillar.icon} size={20} />
                  <Text variant="sectionLabel" colorRole="accent" style={styles.pillarKicker}>
                    {pillar.kicker}
                  </Text>
                </View>
                <Text variant="rowTitle">{pillar.title}</Text>
                <Text variant="caption" colorRole="inkMuted">
                  {pillar.body}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>Why this exists</LedgerSectionLabel>
          <Text variant="rowTitle" isHeading>
            Mission beats
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            Three reasons the archive stays public, place-first, and evidence-backed.
          </Text>
          <View style={styles.beats}>
            {ABOUT_MISSION_BEATS.map((beat, index) => (
              <View
                key={beat.index}
                style={[
                  styles.beat,
                  index < ABOUT_MISSION_BEATS.length - 1
                    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }
                    : null,
                ]}
                accessibilityRole="text"
                accessibilityLabel={`${beat.index}. ${beat.title}. ${beat.body}`}
              >
                <Text variant="code" colorRole="accent" style={styles.beatIndex}>
                  {beat.index}
                </Text>
                <View style={styles.beatBody}>
                  <Text variant="rowTitle">{beat.title}</Text>
                  <Text variant="caption" colorRole="inkMuted">
                    {beat.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>Publish bar</LedgerSectionLabel>
          <Notice tone="info" title={ABOUT_PUBLISH.title} description={ABOUT_PUBLISH.body} />
          <View style={styles.publishActions}>
            <LedgerRow
              title="Read the methodology"
              summary="How records are researched and verified"
              leading={<NavIcon name="methodology" size={20} />}
              showChevron
              onPress={() => router.push('/learn/methodology' as never)}
              accessibilityLabel="Read the methodology"
              showDivider
            />
            <LedgerRow
              title="Corrections"
              summary="Challenge a claim that looks wrong"
              leading={<NavIcon name="corrections" size={20} />}
              showChevron
              onPress={() => router.push('/corrections/submit' as never)}
              accessibilityLabel="Corrections"
              showDivider
            />
            <LedgerRow
              title="Errata"
              summary="Published corrections and change log"
              leading={<NavIcon name="errata" size={20} />}
              showChevron
              onPress={() => router.push('/learn/errata' as never)}
              accessibilityLabel="Errata"
              showDivider={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>Where to begin</LedgerSectionLabel>
          <Text variant="caption" colorRole="inkMuted">
            Same destinations as the web archive, opened as native screens.
          </Text>
          <View>
            {ABOUT_DESTINATIONS.map((item, index) => (
              <LedgerRow
                key={`${item.href}-${item.label}`}
                title={item.label}
                summary={item.detail}
                leading={<NavIcon name={item.icon} size={20} />}
                showChevron
                onPress={() => router.push(item.href as never)}
                accessibilityLabel={`${item.label}. ${item.detail}`}
                showDivider={index < ABOUT_DESTINATIONS.length - 1}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <LedgerSectionLabel ruleAbove>Close</LedgerSectionLabel>
          <Text variant="rowTitle" isHeading>
            {ABOUT_CLOSE.title}
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            {ABOUT_CLOSE.body}
          </Text>
          <View style={styles.ctaRow}>
            <Button
              label="Explore the map"
              variant="accent"
              density="compact"
              onPress={() => router.push('/explore')}
              accessibilityHint="Opens the Explore map tab"
            />
            <Button
              label="Read stories"
              variant="ghost"
              density="compact"
              onPress={() => router.push('/learn' as never)}
              accessibilityHint="Opens the Stories tab"
            />
          </View>
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
    gap: space['3'],
  },
  section: {
    gap: space['2'],
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space['2'],
  },
  pillarGrid: {
    gap: space['2'],
  },
  pillar: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: space['2'],
    padding: space['3'],
    gap: space['1'],
  },
  pillarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['2'],
    marginBottom: space['1'],
  },
  pillarTick: {
    width: 3,
    height: 18,
    borderRadius: 1,
  },
  pillarKicker: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  beats: {
    gap: 0,
  },
  beat: {
    flexDirection: 'row',
    gap: space['3'],
    paddingVertical: space['3'],
  },
  beatIndex: {
    minWidth: 28,
    letterSpacing: 0.5,
  },
  beatBody: {
    flex: 1,
    gap: space['1'],
  },
  publishActions: {
    gap: 0,
  },
});
