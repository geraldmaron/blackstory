/**
 * The three most-used narrowings on the map, always in view above the list (owner decision
 * 2026-11-16): kind, era and state. Native selects in the kit's secondary button dress, so each one
 * works by keyboard and screen reader exactly as the platform does. The Filters panel keeps the
 * rest (evidence, topic, order, layers).
 */
import React from 'react';
import { buttonClassName, cx } from '@repo/ui';
import type { MapKindFamily } from '../../lib/map-experience/kind-encoding';
import { MAP_KIND_FAMILY_ENCODING } from '../../lib/map-experience/kind-encoding';

void React;

export type QuickFiltersProps = {
  readonly kindCounts: Readonly<Partial<Record<MapKindFamily, number>>>;
  readonly kindFamily: MapKindFamily | null;
  readonly onKindFamilyChange: (family: MapKindFamily | null) => void;
  /** Documented decades, oldest first, each with its count under the other filters. */
  readonly decades: readonly { readonly decade: number; readonly count: number }[];
  /** The single brushed decade, when the brush holds exactly one; otherwise null. */
  readonly decade: number | null;
  readonly onDecadeChange: (decade: number | null) => void;
  readonly states: readonly { readonly value: string; readonly label: string }[];
  readonly stateCode: string;
  readonly onStateChange: (code: string) => void;
  readonly className?: string;
};

function Pill({
  label,
  value,
  onChange,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="ds-xquick__field" data-set={value !== '' || undefined}>
      <span className="ds-visually-hidden">{label}</span>
      <select
        className={buttonClassName('secondary', 'ds-xquick__select')}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {children}
      </select>
    </label>
  );
}

export function QuickFilters({
  kindCounts,
  kindFamily,
  onKindFamilyChange,
  decades,
  decade,
  onDecadeChange,
  states,
  stateCode,
  onStateChange,
  className,
}: QuickFiltersProps) {
  const families = Object.keys(MAP_KIND_FAMILY_ENCODING) as MapKindFamily[];
  return (
    <div className={cx('ds-xquick', className)} role="group" aria-label="Quick filters">
      <Pill
        label="Kind"
        value={kindFamily ?? ''}
        onChange={(value) => onKindFamilyChange(value === '' ? null : (value as MapKindFamily))}
      >
        <option value="">Kind</option>
        {families
          .filter((family) => (kindCounts[family] ?? 0) > 0 || family === kindFamily)
          .map((family) => (
            <option key={family} value={family}>
              {`${MAP_KIND_FAMILY_ENCODING[family].label} (${(kindCounts[family] ?? 0).toLocaleString('en-US')})`}
            </option>
          ))}
      </Pill>
      <Pill
        label="Era"
        value={decade === null ? '' : String(decade)}
        onChange={(value) => onDecadeChange(value === '' ? null : Number(value))}
      >
        <option value="">Era</option>
        {decades
          .filter((entry) => entry.count > 0 || entry.decade === decade)
          .map((entry) => (
            <option key={entry.decade} value={entry.decade}>
              {entry.decade}s ({entry.count.toLocaleString('en-US')})
            </option>
          ))}
      </Pill>
      <Pill label="State" value={stateCode} onChange={onStateChange}>
        <option value="">State</option>
        {states.map((state) => (
          <option key={state.value} value={state.value}>
            {/* The name alone: a count would push the chosen state past the pill's width. */}
            {state.label.replace(/\s*\([\d,]+\)$/, '')}
          </option>
        ))}
      </Pill>
    </div>
  );
}
