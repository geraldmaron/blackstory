/**
 * Reusable Explore kind + era filter panel. Used by the `/filters-sheet` modal
 * and available for in-map embedding (same state model as `parseFilterState`).
 *
 * Layout: collapsible Kind / Era groups with dense wrap chips (not a stack of
 * full-width primary buttons), plus a sticky Clear / Apply footer. Era options
 * are decade bucket literals (`1860s`, `1910s`, …) that match `parseEraParam` /
 * entity `eraBuckets`. Kind options use the closed ENTITY_KINDS allow-list with
 * literal display labels (no tracker ids in copy).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  ENTITY_KINDS,
  type EntityKind,
  type FilterState,
} from '@/app/_lib/route-params';
import { Button, Text, space, useThemeColors } from '@/ui';

/** Decade buckets offered in the filter UI (parseEraParam-compatible literals). */
export const EXPLORE_ERA_OPTIONS = [
  '1600s',
  '1610s',
  '1620s',
  '1630s',
  '1640s',
  '1650s',
  '1660s',
  '1670s',
  '1680s',
  '1690s',
  '1700s',
  '1710s',
  '1720s',
  '1730s',
  '1740s',
  '1750s',
  '1760s',
  '1770s',
  '1780s',
  '1790s',
  '1800s',
  '1810s',
  '1820s',
  '1830s',
  '1840s',
  '1850s',
  '1860s',
  '1870s',
  '1880s',
  '1890s',
  '1900s',
  '1910s',
  '1920s',
  '1930s',
  '1940s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
  '2010s',
  '2020s',
] as const;

export type ExploreEraOption = (typeof EXPLORE_ERA_OPTIONS)[number];

const KIND_LABELS: Record<EntityKind, string> = {
  person: 'Person',
  place: 'Place',
  school: 'School',
  organization: 'Organization',
  institution: 'Institution',
  event: 'Event',
  law: 'Law',
  case: 'Case',
  publication: 'Publication',
  artifact: 'Artifact',
  movement: 'Movement',
  other: 'Other',
};

const MIN_TOUCH = 44;

export type ExploreFiltersPanelProps = {
  readonly kind: EntityKind | undefined;
  readonly era: string | undefined;
  readonly onKindChange: (kind: EntityKind | undefined) => void;
  readonly onEraChange: (era: string | undefined) => void;
  readonly onClear: () => void;
  readonly onApply: () => void;
  /** Optional intro copy above the pickers. */
  readonly description?: string;
};

function FilterChip({
  label,
  selected,
  onPress,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
}) {
  const theme = useThemeColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.ink : theme.surfaceRaised,
          borderColor: selected ? theme.ink : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text
        variant="bodySmall"
        style={{ color: selected ? theme.inverseInk : theme.ink }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FilterGroup({
  title,
  summary,
  expanded,
  onToggle,
  accessibilityLabel,
  children,
}: {
  readonly title: string;
  readonly summary: string;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly accessibilityLabel: string;
  readonly children: ReactNode;
}) {
  const theme = useThemeColors();
  return (
    <View style={[styles.group, { borderColor: theme.border }]} testID={`filter-group-${title.toLowerCase()}`}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
        style={styles.groupHeader}
      >
        <View style={styles.groupHeaderText}>
          <Text variant="bodyEmphasis" isHeading accessibilityRole="header">
            {title}
          </Text>
          <Text variant="caption" colorRole="inkMuted">
            {summary}
          </Text>
        </View>
        <Text variant="bodySmall" colorRole="inkMuted" accessibilityElementsHidden>
          {expanded ? 'Hide' : 'Show'}
        </Text>
      </Pressable>
      {expanded ? children : null}
    </View>
  );
}

export function ExploreFiltersPanel({
  kind,
  era,
  onKindChange,
  onEraChange,
  onClear,
  onApply,
  description = 'Narrow the map and list by record kind and decade. Apply returns to Explore with shareable URL params.',
}: ExploreFiltersPanelProps) {
  const theme = useThemeColors();
  const [kindOpen, setKindOpen] = useState(true);
  const [eraOpen, setEraOpen] = useState(Boolean(era) || !kind);

  const kindSummary = kind ? KIND_LABELS[kind] : 'Any kind';
  const eraSummary = era ?? 'Any decade';
  const hasActive = Boolean(kind || era);

  return (
    <View style={styles.root} testID="explore-filters-panel">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="body" colorRole="inkMuted">
          {description}
        </Text>

        <FilterGroup
          title="Kind"
          summary={kindSummary}
          expanded={kindOpen}
          onToggle={() => setKindOpen((open) => !open)}
          accessibilityLabel="Kind filters"
        >
          <View
            style={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Record kind"
          >
            {ENTITY_KINDS.map((candidate) => {
              const label = KIND_LABELS[candidate];
              const isSelected = candidate === kind;
              return (
                <FilterChip
                  key={candidate}
                  label={label}
                  selected={isSelected}
                  onPress={() => onKindChange(isSelected ? undefined : candidate)}
                />
              );
            })}
          </View>
        </FilterGroup>

        <FilterGroup
          title="Era"
          summary={eraSummary}
          expanded={eraOpen}
          onToggle={() => setEraOpen((open) => !open)}
          accessibilityLabel="Era filters"
        >
          <View
            style={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel="Era decade"
          >
            {EXPLORE_ERA_OPTIONS.map((candidate) => {
              const isSelected = candidate === era;
              return (
                <FilterChip
                  key={candidate}
                  label={candidate}
                  selected={isSelected}
                  onPress={() => onEraChange(isSelected ? undefined : candidate)}
                />
              );
            })}
          </View>
        </FilterGroup>
      </ScrollView>

      <View
        style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.surface }]}
        testID="explore-filters-actions"
      >
        <View style={styles.footerButtons}>
          <View style={styles.footerButton}>
            <Button
              label="Clear"
              variant="ghost"
              onPress={onClear}
              disabled={!hasActive}
              accessibilityLabel="Clear filters"
            />
          </View>
          <View style={styles.footerButton}>
            <Button label="Apply" variant="primary" onPress={onApply} accessibilityLabel="Apply filters" />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Builds a FilterState from panel selections (drops unset fields). */
export function filterStateFromPanel(
  kind: EntityKind | undefined,
  era: string | undefined,
): FilterState {
  return {
    ...(kind !== undefined ? { kind } : {}),
    ...(era !== undefined ? { era } : {}),
  };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: space['4'],
    gap: space['4'],
    paddingBottom: space['6'],
  },
  group: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupHeader: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['3'],
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
  },
  groupHeaderText: {
    flex: 1,
    gap: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['2'],
    paddingHorizontal: space['3'],
    paddingBottom: space['3'],
  },
  chip: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: space['3'],
    paddingVertical: space['2'],
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space['4'],
    paddingVertical: space['3'],
  },
  footerButtons: {
    flexDirection: 'row',
    gap: space['3'],
  },
  footerButton: {
    flex: 1,
  },
});
