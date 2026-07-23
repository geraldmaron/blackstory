/**
 * Reusable Explore filter panel. Used by the `/filters-sheet` modal (Apply/Clear footer)
 * and the in-map instruments chassis (auto-apply facet rows).
 *
 * v7 layout: mono-labeled facet rows with ghost chips in web filter order
 * (kind → tone → era → theme → status → confidence → where). Place find is a
 * History handoff until mobile geocoding ships (web parity gap documented in plan.md).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  KIND_FAMILIES,
  type KindFamily,
  type KindFilterValue,
  type FilterState,
  hasActiveFilters,
} from '@/lib/route-params';
import {
  EXPLORE_FACET_ROWS,
  type ExploreFacetOptions,
  type FacetOption,
} from '@/features/explore/explore-filter';
import {
  kindFamilyEncodingFor,
  isKnownMapKindFamily,
  kindEncodingFor,
} from '@/features/map/kind-encoding';
import { Button, Text, space, useThemeColors } from '@/ui';
import { ExploreFacetRow } from './explore-edition-chrome';

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

const KIND_LABELS: Record<KindFamily, string> = {
  people: kindFamilyEncodingFor('people').label,
  places: kindFamilyEncodingFor('places').label,
  organizations: kindFamilyEncodingFor('organizations').label,
  events: kindFamilyEncodingFor('events').label,
  sources: kindFamilyEncodingFor('sources').label,
};

const MIN_TOUCH = 44;

/** Curated decade chips for embedded facet row (full list remains in modal mode). */
export const EXPLORE_ERA_QUICK_OPTIONS = [
  '1860s',
  '1910s',
  '1950s',
  '1960s',
  '1970s',
  '1980s',
  '1990s',
  '2000s',
] as const;

export type ExploreFiltersPanelProps = {
  readonly filters: FilterState;
  readonly facetOptions: ExploreFacetOptions;
  readonly onFiltersChange: (filters: FilterState) => void;
  readonly onClear: () => void;
  readonly onApply: () => void;
  /** Opens History find-in-time for place-based search (mobile geocoder deferred). */
  readonly onOpenPlaceFind?: () => void;
  /** `embedded` = auto-apply facet rows; `modal` = collapsible groups + footer. */
  readonly mode?: 'embedded' | 'modal';
  /** Optional intro copy above the pickers. */
  readonly description?: string;
};

function FilterChip({
  label,
  selected,
  onPress,
  accentWhenSelected = false,
  ghost = false,
}: {
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly accentWhenSelected?: boolean;
  readonly ghost?: boolean;
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
        ghost ? styles.ghostChip : styles.chip,
        ghost
          ? {
              borderBottomColor: selected ? theme.accent : 'transparent',
              opacity: pressed ? 0.85 : 1,
            }
          : {
              backgroundColor: selected
                ? accentWhenSelected
                  ? theme.surfaceRaised
                  : theme.ink
                : theme.surfaceRaised,
              borderColor: selected
                ? accentWhenSelected
                  ? theme.accent
                  : theme.ink
                : theme.border,
              opacity: pressed ? 0.85 : 1,
            },
      ]}
    >
      <Text
        variant="bodySmall"
        style={{
          color: ghost
            ? selected
              ? theme.accent
              : theme.ink
            : selected
              ? accentWhenSelected
                ? theme.accent
                : theme.inverseInk
              : theme.ink,
        }}
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

function KindChipRow({
  kind,
  onKindChange,
  accentWhenSelected,
  ghost = false,
}: {
  readonly kind: KindFilterValue | undefined;
  readonly onKindChange: (kind: KindFilterValue | undefined) => void;
  readonly accentWhenSelected?: boolean;
  readonly ghost?: boolean;
}) {
  return (
    <View
      style={styles.chipRow}
      accessibilityRole="radiogroup"
      accessibilityLabel="Record kind"
    >
      <FilterChip
        label="Any kind"
        selected={!kind}
        accentWhenSelected={accentWhenSelected}
        ghost={ghost}
        onPress={() => onKindChange(undefined)}
      />
      {KIND_FAMILIES.map((candidate) => {
        const label = KIND_LABELS[candidate];
        const isSelected = candidate === kind;
        return (
          <FilterChip
            key={candidate}
            label={label}
            selected={isSelected}
            accentWhenSelected={accentWhenSelected}
            ghost={ghost}
            onPress={() => onKindChange(isSelected ? undefined : candidate)}
          />
        );
      })}
    </View>
  );
}

function FacetChipRow({
  facetKey,
  value,
  options,
  onChange,
  accentWhenSelected,
  ghost = false,
}: {
  readonly facetKey: keyof ExploreFacetOptions;
  readonly value: string | undefined;
  readonly options: readonly FacetOption[];
  readonly onChange: (next: string | undefined) => void;
  readonly accentWhenSelected?: boolean;
  readonly ghost?: boolean;
}) {
  const selectable = options.filter((option) => option.value !== 'all');
  const anyLabel =
    facetKey === 'era'
      ? 'Any decade'
      : facetKey === 'state'
        ? 'Any state'
        : `Any ${facetKey}`;

  return (
    <View
      style={styles.chipRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={facetKey}
    >
      <FilterChip
        label={anyLabel}
        selected={!value}
        accentWhenSelected={accentWhenSelected}
        ghost={ghost}
        onPress={() => onChange(undefined)}
      />
      {selectable.map((option) => {
        const isSelected = option.value === value;
        const chipLabel = option.label.replace(/\s\(\d+\)$/, '');
        return (
          <FilterChip
            key={option.value}
            label={chipLabel}
            selected={isSelected}
            accentWhenSelected={accentWhenSelected}
            ghost={ghost}
            onPress={() => onChange(isSelected ? undefined : option.value)}
          />
        );
      })}
    </View>
  );
}

function PlaceFindHandoff({ onOpenPlaceFind }: { readonly onOpenPlaceFind?: () => void }) {
  const theme = useThemeColors();
  return (
    <View style={[styles.placeFind, { borderColor: theme.border }]} testID="explore-place-find-handoff">
      <Text variant="code" colorRole="inkMuted" style={styles.placeFindKicker}>
        Place find
      </Text>
      <Text variant="bodySmall" colorRole="inkMuted">
        Named-place search and radius chips are on History until mobile geocoding ships.
      </Text>
      {onOpenPlaceFind ? (
        <View style={styles.placeFindAction}>
          <Button
            label="Open History search"
            variant="ghost"
            onPress={onOpenPlaceFind}
            accessibilityLabel="Open History search for place find"
          />
        </View>
      ) : null}
    </View>
  );
}

function facetSummary(
  facetKey: keyof ExploreFacetOptions,
  filters: FilterState,
  options: ExploreFacetOptions,
): string {
  switch (facetKey) {
    case 'kind': {
      const kind = filters.kind;
      if (!kind) return 'Any kind';
      if (isKnownMapKindFamily(kind)) return KIND_LABELS[kind];
      return kindEncodingFor(kind).label;
    }
    case 'era':
      return filters.era ?? 'Any decade';
    case 'tone':
    case 'theme':
    case 'status':
    case 'confidence':
    case 'state': {
      const value = filters[facetKey];
      if (!value) {
        return options[facetKey].find((option) => option.value === 'all')?.label ?? 'All';
      }
      return options[facetKey].find((option) => option.value === value)?.label.replace(/\s\(\d+\)$/, '') ?? value;
    }
    default:
      return 'All';
  }
}

function updateFilter(
  filters: FilterState,
  key: keyof FilterState,
  value: FilterState[keyof FilterState] | undefined,
): FilterState {
  if (value === undefined) {
    const next = { ...filters };
    delete (next as Record<string, unknown>)[key];
    return next;
  }
  return { ...filters, [key]: value };
}

export function ExploreFiltersPanel({
  filters,
  facetOptions,
  onFiltersChange,
  onClear,
  onApply,
  onOpenPlaceFind,
  mode = 'modal',
  description = 'Narrow the map and list by kind family and decade. Apply returns to Explore with shareable URL params.',
}: ExploreFiltersPanelProps) {
  const theme = useThemeColors();
  const [kindOpen, setKindOpen] = useState(true);
  const [eraOpen, setEraOpen] = useState(Boolean(filters.era) || !filters.kind);
  const [extraOpen, setExtraOpen] = useState<Record<string, boolean>>({});
  const active = hasActiveFilters(filters);

  const visibleFacetRows = EXPLORE_FACET_ROWS.filter(({ key }) => {
    if (key === 'state') return facetOptions.state.length > 1;
    return facetOptions[key].length > 1;
  });

  if (mode === 'embedded') {
    return (
      <View style={styles.root} testID="explore-filters-panel">
        <Text variant="body" colorRole="inkMuted">
          {description}
        </Text>

        <PlaceFindHandoff onOpenPlaceFind={onOpenPlaceFind} />

        {visibleFacetRows.map(({ key, label }) => (
          <ExploreFacetRow
            key={key}
            label={label}
            summary={facetSummary(key, filters, facetOptions)}
            testID={`facet-${key}`}
          >
            {key === 'kind' ? (
              <KindChipRow
                kind={filters.kind}
                onKindChange={(kind) => onFiltersChange(updateFilter(filters, 'kind', kind))}
                accentWhenSelected
                ghost
              />
            ) : key === 'era' ? (
              <FacetChipRow
                facetKey="era"
                value={filters.era}
                options={facetOptions.era.filter((option) =>
                  option.value === 'all' || EXPLORE_ERA_QUICK_OPTIONS.includes(option.value as never),
                )}
                onChange={(era) => onFiltersChange(updateFilter(filters, 'era', era))}
                accentWhenSelected
                ghost
              />
            ) : (
              <FacetChipRow
                facetKey={key}
                value={filters[key]}
                options={facetOptions[key]}
                onChange={(next) =>
                  onFiltersChange(updateFilter(filters, key, next as FilterState[typeof key]))
                }
                accentWhenSelected
                ghost
              />
            )}
          </ExploreFacetRow>
        ))}

        {active ? (
          <View style={styles.embeddedClear}>
            <Button
              label="Clear filters"
              variant="ghost"
              onPress={onClear}
              accessibilityLabel="Clear all filters"
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root} testID="explore-filters-panel">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="body" colorRole="inkMuted">
          {description}
        </Text>

        <PlaceFindHandoff onOpenPlaceFind={onOpenPlaceFind} />

        <FilterGroup
          title="Kind"
          summary={facetSummary('kind', filters, facetOptions)}
          expanded={kindOpen}
          onToggle={() => setKindOpen((open) => !open)}
          accessibilityLabel="Kind filters"
        >
          <KindChipRow
            kind={filters.kind}
            onKindChange={(kind) => onFiltersChange(updateFilter(filters, 'kind', kind))}
          />
        </FilterGroup>

        <FilterGroup
          title="Era"
          summary={facetSummary('era', filters, facetOptions)}
          expanded={eraOpen}
          onToggle={() => setEraOpen((open) => !open)}
          accessibilityLabel="Era filters"
        >
          <FacetChipRow
            facetKey="era"
            value={filters.era}
            options={EXPLORE_ERA_OPTIONS.map((era) => ({ value: era, label: era }))}
            onChange={(era) => onFiltersChange(updateFilter(filters, 'era', era))}
          />
        </FilterGroup>

        {visibleFacetRows
          .filter(({ key }) => key !== 'kind' && key !== 'era')
          .map(({ key, label }) => {
            const expanded = extraOpen[key] ?? Boolean(filters[key]);
            return (
              <FilterGroup
                key={key}
                title={label}
                summary={facetSummary(key, filters, facetOptions)}
                expanded={expanded}
                onToggle={() =>
                  setExtraOpen((current) => ({ ...current, [key]: !(current[key] ?? Boolean(filters[key])) }))
                }
                accessibilityLabel={`${label} filters`}
              >
                <FacetChipRow
                  facetKey={key}
                  value={filters[key]}
                  options={facetOptions[key]}
                  onChange={(next) =>
                    onFiltersChange(updateFilter(filters, key, next as FilterState[typeof key]))
                  }
                />
              </FilterGroup>
            );
          })}
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
              disabled={!active}
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
export function filterStateFromPanel(filters: FilterState): FilterState {
  return {
    ...(filters.kind !== undefined ? { kind: filters.kind } : {}),
    ...(filters.era !== undefined ? { era: filters.era } : {}),
    ...(filters.tone !== undefined ? { tone: filters.tone } : {}),
    ...(filters.theme !== undefined ? { theme: filters.theme } : {}),
    ...(filters.status !== undefined ? { status: filters.status } : {}),
    ...(filters.confidence !== undefined ? { confidence: filters.confidence } : {}),
    ...(filters.state !== undefined ? { state: filters.state } : {}),
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
  placeFind: {
    gap: space['2'],
    paddingBottom: space['3'],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeFindKicker: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  placeFindAction: {
    alignSelf: 'flex-start',
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
  ghostChip: {
    minHeight: 32,
    paddingHorizontal: space['2'],
    paddingVertical: space['1'],
    borderBottomWidth: 2,
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
  embeddedClear: {
    marginTop: space['2'],
  },
});
