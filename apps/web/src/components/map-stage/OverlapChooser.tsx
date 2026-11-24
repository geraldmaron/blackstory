'use client';

/**
 * "Which one?" for a click on stacked lights, on the pages where a light opens its record (the
 * front page, an index at Country). Many records share a point (a city's center, one campus), so
 * the stage reports an `overlap` rather than guess (`MapStage.tsx`); this lists them as links by
 * the pointer. /explore answers the same event with its own list column.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ExploreMapFeature } from '../../lib/map-experience/build-explore-map-source';
import type { MapStageHandle } from './MapStage';
import './overlap-chooser.css';

void React;

/**
 * The box shows about five rows before it scrolls; past that, the map lists them better. The map
 * lists the whole place (a city holds more than the records on its center), so the link names the
 * place, not this count.
 */
const SEE_ALL_FROM = 6;

type Open = { readonly x: number; readonly y: number; readonly ids: readonly string[] };

export function OverlapChooser({
  stage,
  records,
}: {
  readonly stage: MapStageHandle | null;
  /** The lights on the map, for their names and links. */
  readonly records: readonly ExploreMapFeature[];
}) {
  const [open, setOpen] = useState<Open | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const byId = useMemo(
    () => new Map(records.map((record) => [record.properties.entityId, record.properties])),
    [records],
  );

  useEffect(() => {
    if (!stage) return undefined;
    const track = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (!boxRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const close = () => setOpen(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', track, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    const offs = [
      stage.subscribe('overlap', (ids) => setOpen({ ...pointer.current, ids })),
      stage.subscribe('select', close),
      stage.subscribe('interact', close),
    ];
    return () => {
      document.removeEventListener('pointerdown', track, true);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      offs.forEach((off) => off());
    };
  }, [stage]);

  const rows = open
    ? open.ids
        .flatMap((id) => {
          const record = byId.get(id);
          return record?.href && record.displayName ? [{ id, ...record }] : [];
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
    : [];

  useEffect(() => {
    if (rows.length > 0) boxRef.current?.querySelector('a')?.focus({ preventScroll: true });
  }, [open, rows.length]);

  if (!open || rows.length === 0) return null;
  return createPortal(
    <div
      ref={boxRef}
      className="ds-overlap-chooser"
      role="dialog"
      aria-label={`${rows.length} records here`}
      style={{ '--at-x': `${open.x}px`, '--at-y': `${open.y}px` } as React.CSSProperties}
    >
      <p className="ds-overlap-chooser__count">{rows.length} records here</p>
      <ul className="ds-overlap-chooser__list">
        {rows.map((row) => (
          <li key={row.id}>
            <a href={row.href}>{row.displayName}</a>
          </li>
        ))}
      </ul>
      {rows.length >= SEE_ALL_FROM ? (
        <a
          className="ds-overlap-chooser__all"
          href={`/door/pin/${encodeURIComponent(rows[0]!.id)}/map`}
        >
          See this place on the map
        </a>
      ) : null}
    </div>,
    document.body,
  );
}
