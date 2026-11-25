/**
 * The opening: six pages, one per word, swiped with the platform's own paging scroll
 * (docs/ui/DESIGN.md sections 9.7 and 11). Five stand on ink; the last turns to paper and hands
 * off to the archive. "Skip to the archive" is on screen throughout, nothing is timed, and each
 * page scrolls on its own so the system's largest text size never traps content off screen.
 *
 * Router-free: the route file supplies where Skip, a record link and a contents row go.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { semanticDestinationById } from '@repo/public-contracts/destinations';

import { CitationLink } from '@/features/entity/CitationLink';
import { createRuntimeEntityDataDeps, type EntityDataDeps } from '@/features/entity/dataClient';
import {
  buildEntityAnatomyInputs,
  buildEntityAnatomyPlace,
} from '@/features/entity/entity-anatomy-facts';
import { isQuietRecord } from '@/features/entity/entity-view-model';
import { humanizeToken } from '@/features/entity/format';
import type { Entity } from '@/features/entity/types';
import { useEntityDetail } from '@/features/entity/useEntityDetail';
import { MAP_ACCENT, MAP_INK, MAP_INK_MUTED } from '@/features/map/map-plate-ink';
import {
  Accent,
  Button,
  CHROME_MAX_FONT_SCALE,
  EvidenceGrade,
  ExhibitFrame,
  Image,
  LedgerRow,
  Link,
  Logo,
  MIN_TOUCH_TARGET,
  NavIcon,
  Receipt,
  Text,
  brandCore,
  radius,
  space,
  typeScale,
  useAnnounceOnChange,
  useReduceMotion,
  useThemeColors,
  type NavIconName,
} from '@/ui';
import {
  OPENING_ARCHIVE_SENTENCE,
  OPENING_SCENES,
  OPENING_SKIP_LABEL,
  OPENING_TAGLINE,
  OPENING_TOWN_PROMPT,
  type OpeningScene,
} from './opening-scenes';
import {
  lookUpTown,
  normalizeTown,
  TOWN_MAX_LENGTH,
  type TownAnswer,
  type TownTransport,
} from './town-lookup';

export type OpeningScreenProps = {
  /** Skip, or the last page's way in. */
  readonly onDone: () => void;
  readonly onOpenRecord: (entityId: string) => void;
  /** A contents row on the last page. */
  readonly onOpenRoute: (route: `/${string}`) => void;
  /** The last page has been reached: the opening counts as seen. */
  readonly onReachedEnd?: () => void;
};

/**
 * A record may stand for a scene only when it is photographed, evidenced better than thinly, not
 * harm-adjacent and not a person (the archive treats a person with no recorded death as living).
 * The web applies the same rules to its picks; a record that fails shows the word and the
 * sentence with no exhibit.
 */
export function isOpeningEligible(entity: Entity): boolean {
  return (
    entity.kind !== 'person' &&
    entity.primaryImage !== undefined &&
    !isQuietRecord(entity) &&
    buildEntityAnatomyInputs(entity).evidenceTier !== 'low'
  );
}

function SceneWord({ scene }: { readonly scene: OpeningScene }) {
  return (
    <Text variant="display" isHeading accessibilityLabel={scene.heading} style={styles.onInk}>
      {scene.prefix ? (
        <>
          <Accent onInk>{scene.prefix}</Accent>
          {scene.heading.slice(scene.prefix.length)}
        </>
      ) : (
        scene.heading
      )}
    </Text>
  );
}

/** One record on a paper slip: its photograph, its name, where it is, and one claim. */
function RecordSlip({
  recordId,
  deps,
  onOpenRecord,
}: {
  readonly recordId: string;
  readonly deps: EntityDataDeps | undefined;
  readonly onOpenRecord: (entityId: string) => void;
}) {
  const theme = useThemeColors();
  const { state } = useEntityDetail(recordId, deps);
  const entity = deps && state.kind === 'ready' ? state.result.entity : undefined;
  if (!entity || !isOpeningEligible(entity)) return null;

  const image = entity.primaryImage!;
  const place = buildEntityAnatomyPlace(entity);
  const claim = entity.claims[0];

  return (
    <View style={[styles.slip, { backgroundColor: theme.canvas }]} testID="opening-record-slip">
      <ExhibitFrame
        kind="photograph"
        basis="date not on record"
        receipt={image.credit ? <Receipt source={image.credit} /> : undefined}
      >
        <Image
          source={image.url}
          alt={image.alt ?? entity.displayName}
          aspectRatio={3 / 2}
          fallback={{ entityName: entity.displayName, reason: 'pending-rights-review' }}
        />
      </ExhibitFrame>
      <Link
        href={`/entity/${entity.id}`}
        textRole="title"
        onPress={() => onOpenRecord(entity.id)}
        accessibilityHint="Opens the record"
      >
        {entity.displayName}
      </Link>
      {place ? (
        <Text variant="bodySmall" colorRole="inkMuted">
          {entity.jurisdictionLabel.trim() || place.label}, shown at {place.precision ?? 'city'}{' '}
          precision.
        </Text>
      ) : null}
      {claim ? (
        <View style={styles.claim}>
          <Text
            variant="caption"
            colorRole="inkMuted"
            style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {humanizeToken(claim.predicate)}
          </Text>
          <Text variant="editorial">{claim.object}</Text>
          <Receipt
            {...(claim.citation
              ? { link: <CitationLink citation={claim.citation} isOnline /> }
              : { source: 'No source citation is available for this claim.' })}
            grade={<EvidenceGrade tier={claim.confidenceLevel} />}
          />
        </View>
      ) : null}
    </View>
  );
}

/** The town field: typed text only, looked up once, kept nowhere (see town-lookup.ts). */
function TownSlip({
  transport,
  onOpenRecord,
}: {
  readonly transport: TownTransport | undefined;
  readonly onOpenRecord: (entityId: string) => void;
}) {
  const theme = useThemeColors();
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<string | undefined>(undefined);
  const [answer, setAnswer] = useState<TownAnswer | 'loading' | undefined>(undefined);
  // The latest question wins; an answer to an earlier one, or to a page that has gone, is dropped.
  const latest = useRef(0);
  useEffect(
    () => () => {
      latest.current = -1;
    },
    [],
  );

  function submit() {
    const town = normalizeTown(draft);
    if (!town || !transport) return;
    Keyboard.dismiss();
    const ticket = (latest.current += 1);
    setAsked(town);
    setAnswer('loading');
    void lookUpTown(transport, town).then((next) => {
      if (latest.current === ticket) setAnswer(next);
    });
  }

  // iOS ignores the live region below, so the settled answer is also announced.
  const settled = answer && answer !== 'loading' ? answer : undefined;
  useAnnounceOnChange(
    settled?.kind === 'found'
      ? `${settled.records.length} ${settled.records.length === 1 ? 'record names' : 'records name'} ${asked}`
      : settled?.kind === 'none'
        ? `No record names ${asked} yet. That means it isn’t researched yet, not that nothing happened there.`
        : settled?.kind === 'failed'
          ? 'The archive didn’t answer. Check the connection and try again.'
          : null,
  );

  return (
    <View style={[styles.slip, { backgroundColor: theme.canvas }]} testID="opening-town-slip">
      <Text variant="bodyEmphasis" nativeID="opening-town-label">
        {OPENING_TOWN_PROMPT}
      </Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        returnKeyType="search"
        placeholder="A town or city"
        placeholderTextColor={theme.inkMuted}
        accessibilityLabel="Town"
        accessibilityLabelledBy="opening-town-label"
        maxLength={TOWN_MAX_LENGTH}
        autoCorrect={false}
        autoCapitalize="words"
        // No autofill, no suggestions, no location: what is typed is the whole input.
        autoComplete="off"
        textContentType="none"
        spellCheck={false}
        style={[styles.input, { color: theme.ink, borderColor: theme.borderControl }]}
        testID="opening-town-input"
      />
      <View style={styles.start}>
        <Button
          label="Look it up"
          variant="primary"
          density="compact"
          disabled={!normalizeTown(draft) || !transport}
          loading={answer === 'loading'}
          onPress={submit}
        />
      </View>
      <Text variant="caption" colorRole="inkMuted">
        What you type goes to the archive’s search once and isn’t kept. This doesn’t use your
        location.
      </Text>

      <View accessibilityLiveRegion="polite" style={styles.answer}>
        {answer && answer !== 'loading' && answer.kind === 'found' ? (
          <>
            <Text variant="bodyEmphasis">Records that name {asked}</Text>
            {answer.records.map((record) => (
              <Link
                key={record.id}
                href={`/entity/${record.id}`}
                textRole="body"
                onPress={() => onOpenRecord(record.id)}
                accessibilityHint="Opens the record"
              >
                {record.name}
              </Link>
            ))}
          </>
        ) : null}
        {answer && answer !== 'loading' && answer.kind === 'none' ? (
          <Text variant="body">
            No record names {asked} yet. That means it isn’t researched yet, not that nothing
            happened there.
          </Text>
        ) : null}
        {answer && answer !== 'loading' && answer.kind === 'failed' ? (
          <Text variant="body">The archive didn’t answer. Check the connection and try again.</Text>
        ) : null}
      </View>
    </View>
  );
}

const CONTENTS: readonly {
  readonly title: string;
  readonly route: `/${string}`;
  readonly icon: NavIconName;
  readonly line: string;
}[] = [
  {
    title: 'Archive',
    route: '/archive',
    icon: 'explore',
    line: [
      semanticDestinationById('explore')?.description,
      semanticDestinationById('records')?.description,
    ]
      .filter(Boolean)
      .join(' '),
  },
  ...(['stories', 'data', 'memorial'] as const).map((id) => {
    const destination = semanticDestinationById(id)!;
    return {
      title: destination.label,
      route: destination.path as `/${string}`,
      icon: destination.icon as NavIconName,
      line: destination.description ?? '',
    };
  }),
];

export function OpeningScreen({
  onDone,
  onOpenRecord,
  onOpenRoute,
  onReachedEnd,
}: OpeningScreenProps) {
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const [deps, setDeps] = useState<EntityDataDeps | undefined>(undefined);
  useEffect(() => {
    let live = true;
    createRuntimeEntityDataDeps().then(
      (resolved) => live && setDeps(resolved),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  const lastIndex = OPENING_SCENES.length - 1;
  const onInk = page < lastIndex;
  const scene = OPENING_SCENES[page]!;
  useEffect(() => {
    if (page === lastIndex) onReachedEnd?.();
  }, [page, lastIndex, onReachedEnd]);

  function goTo(index: number) {
    const next = Math.min(lastIndex, Math.max(0, index));
    // Reduce motion: the page is simply there, with no slide.
    pager.current?.scrollTo({ x: next * width, animated: !reduceMotion });
    // Unconditional: a programmatic scroll is not guaranteed a momentum event, and pages other
    // than `page` are hidden from assistive tech.
    setPage(next);
  }
  function handleSettle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)));
  }

  return (
    <View style={[styles.root, { backgroundColor: brandCore.ebonyInk }]}>
      <StatusBar style={onInk ? 'light' : 'auto'} />
      <View
        style={[
          styles.top,
          { paddingTop: insets.top + space['2'] },
          onInk ? undefined : { backgroundColor: theme.canvas },
        ]}
      >
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Scene ${page + 1} of ${OPENING_SCENES.length}: ${scene.heading}`}
          style={styles.ticks}
          testID="opening-position"
        >
          {OPENING_SCENES.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.tick,
                {
                  backgroundColor:
                    index === page ? MAP_ACCENT : onInk ? MAP_INK_MUTED : theme.borderControl,
                },
              ]}
            />
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={OPENING_SKIP_LABEL}
          onPress={onDone}
          style={styles.skip}
          testID="opening-skip"
        >
          <Text
            variant="bodySmall"
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            style={{ color: onInk ? MAP_INK : theme.accent }}
          >
            {OPENING_SKIP_LABEL}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onMomentumScrollEnd={handleSettle}
        testID="opening-pager"
      >
        {OPENING_SCENES.map((item, index) => (
          <ScrollView
            key={item.id}
            style={[{ width }, index === lastIndex ? { backgroundColor: theme.canvas } : undefined]}
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            // The town field sits low on its page; without this the keyboard covers it on iOS.
            automaticallyAdjustKeyboardInsets
            // Only the page on screen is read; the others are a swipe away, not in the way.
            accessibilityElementsHidden={index !== page}
            importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}
          >
            {item.kind === 'country' ? (
              <>
                <Logo variant="lockup" size={220} />
                <Text variant="headline" isHeading>
                  {OPENING_TAGLINE}
                </Text>
                <Text variant="editorial">{OPENING_ARCHIVE_SENTENCE}</Text>
                <View>
                  {CONTENTS.map((row, rowIndex) => (
                    <LedgerRow
                      key={row.route}
                      title={row.title}
                      summary={row.line}
                      leading={<NavIcon name={row.icon} size={20} />}
                      showChevron
                      showDivider={rowIndex < CONTENTS.length - 1}
                      onPress={() => onOpenRoute(row.route)}
                    />
                  ))}
                </View>
              </>
            ) : (
              <>
                <SceneWord scene={item} />
                {item.sentence ? (
                  <Text variant="editorial" style={styles.onInk}>
                    {item.sentence}
                  </Text>
                ) : null}
                {item.kind === 'record' && item.recordId ? (
                  <RecordSlip recordId={item.recordId} deps={deps} onOpenRecord={onOpenRecord} />
                ) : null}
                {item.kind === 'town' ? (
                  <TownSlip transport={deps?.transport} onOpenRecord={onOpenRecord} />
                ) : null}
              </>
            )}
          </ScrollView>
        ))}
      </ScrollView>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: insets.bottom + space['2'],
            backgroundColor: theme.canvas,
            borderTopColor: theme.border,
          },
        ]}
      >
        {page > 0 ? (
          <Button
            label="Back"
            variant="ghost"
            density="compact"
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            accessibilityLabel={`Back to ${OPENING_SCENES[page - 1]!.heading}`}
            onPress={() => goTo(page - 1)}
          />
        ) : (
          <View />
        )}
        {page < lastIndex ? (
          <Button
            label="Next"
            variant="primary"
            density="compact"
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            accessibilityLabel={`Next: ${OPENING_SCENES[page + 1]!.heading}`}
            onPress={() => goTo(page + 1)}
            testID="opening-next"
          />
        ) : (
          <Button
            label="Enter the archive"
            variant="primary"
            density="compact"
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            onPress={onDone}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  onInk: { color: MAP_INK },
  top: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['2'],
    paddingHorizontal: space['4'],
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['1'],
    minHeight: MIN_TOUCH_TARGET,
  },
  tick: { width: space['6'], height: 2 },
  skip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  page: {
    gap: space['4'],
    paddingHorizontal: space['4'],
    paddingTop: space['6'],
    paddingBottom: space['8'],
  },
  slip: {
    gap: space['3'],
    padding: space['3'],
  },
  claim: {
    gap: space['2'],
  },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space['3'],
    fontSize: typeScale.body.size,
  },
  start: { alignItems: 'flex-start' },
  answer: { gap: space['1'] },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space['4'],
    paddingTop: space['2'],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
