/**
 * Bounded/virtualized "related records" list (MOB-015 requirement #2/#9 — the RN accessible
 * equivalent of a data table for `relatedEntityIds`/`relatedFactIds`). React Native has no native
 * `<table>`; the accessible equivalent used here is a labeled header (`accessibilityRole="header"`)
 * followed by a `FlatList` of pressable rows (`ListRow`, MOB-007), each individually
 * screen-reader-navigable — this is the same pattern iOS/Android accessibility guidance
 * recommends over a manually-drawn grid.
 *
 * Bounded by construction: `content-blocks.ts` already caps `relatedEntityIds`/`relatedFactIds`
 * at parse time (`MAX_RELATED_IDS`), and `FlatList` itself only mounts a small window of rows
 * regardless of array length — so a huge id list (the "huge table" adversarial case) renders a
 * fixed amount of work per frame rather than hanging on a synchronous full-list layout pass.
 *
 * Row titles are always human labels (display name + kind/place) — never raw `ent_*` ids.
 */
import { router } from 'expo-router';
import { FlatList, View } from 'react-native';
import { ListRow, Surface, Text, space } from '@/ui';
import { relatedEntitySubtitle, resolveRelatedEntityLabel } from './related-entity-labels';

const RENDER_WINDOW = 20;

export function RelatedEntityList({ entityIds }: { readonly entityIds: readonly string[] }) {
  if (entityIds.length === 0) return null;
  return (
    <View accessible={false}>
      <Text variant="subtitle" isHeading accessibilityRole="header">
        Related records ({entityIds.length})
      </Text>
      <FlatList
        data={entityIds}
        keyExtractor={(id) => id}
        scrollEnabled={false}
        initialNumToRender={RENDER_WINDOW}
        maxToRenderPerBatch={RENDER_WINDOW}
        windowSize={3}
        renderItem={({ item, index }) => {
          const label = resolveRelatedEntityLabel(item);
          const subtitle = relatedEntitySubtitle(label);
          return (
            <ListRow
              title={label.displayName}
              subtitle={subtitle.length > 0 ? subtitle : 'View record'}
              onPress={() => router.push(`/entity/${item}` as never)}
              showDivider={index < entityIds.length - 1}
              accessibilityLabel={`${label.displayName}. ${subtitle || 'Archive record'}`}
            />
          );
        }}
      />
    </View>
  );
}

/** Fact ids render as non-interactive badges: no `/facts/[id]` mobile detail route exists yet
 * (out of this bead's scope — see MOB-015 report), so these are deliberately not dead links. */
export function RelatedFactBadges({ factIds }: { readonly factIds: readonly string[] }) {
  if (factIds.length === 0) return null;
  return (
    <View accessible={false}>
      <Text variant="subtitle" isHeading accessibilityRole="header">
        Cited facts ({factIds.length})
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space['2'], marginTop: space['2'] }}>
        {factIds.slice(0, RENDER_WINDOW).map((id) => (
          <Surface key={id} bordered paddingKey="2" radiusKey="full">
            <Text variant="caption">{id}</Text>
          </Surface>
        ))}
        {factIds.length > RENDER_WINDOW ? (
          <Text variant="bodySmall" colorRole="inkMuted">
            +{factIds.length - RENDER_WINDOW} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}
