/**
 * The record page's chrome vocabulary: pills, fact tiles, meters, beat headings and apparatus
 * titles. One set of parts, one type scale (`record-chrome.css`), so the masthead, the strip, the
 * column and the band read as one instrument rather than five components that met on a page.
 *
 * Every icon here travels with a visible word (WCAG 1.4.1): a pill is icon plus label, a tile
 * is icon plus label plus value, a meter is bars plus the word it measures. Icons come from the
 * same Font Awesome sets the Atlas already uses (`kind-icons.ts`, `status-icons.ts`,
 * `confidence-icons.ts`), so a person carries the same icon here as on any labelled badge.
 *
 * The map itself, and the narrow chrome that sits beside it, deliberately do not use these icons.
 * A results row gives the kind an 18px column with no room for a word, so it draws the geometric
 * shape channel (`KindGlyph`) that the map markers paint, and a grade there is a dot whose fill
 * treatment carries the grade in greyscale (`GradeDot`). Those are the non-colour signal, not old
 * styling waiting to be replaced. See `docs/ui/patterns-map-entity-encoding.md`.
 *
 * Server-safe: no client state, no effects.
 *
 * The atoms' stylesheet travels with the component (`record-chrome.css`), so a surface that
 * renders a pill gets a styled pill without knowing which route it is on.
 */
import React, { type ReactNode } from 'react';
import Link from 'next/link';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBookOpen,
  faBoxArchive,
  faCalendarDay,
  faCircleQuestion,
  faClockRotateLeft,
  faDiagramProject,
  faFingerprint,
  faList,
  faLocationDot,
  faMagnifyingGlass,
  faNewspaper,
  faQuoteLeft,
  faScroll,
  faShieldHalved,
  faSignsPost,
  faTimeline,
} from '@fortawesome/free-solid-svg-icons';
import { cx } from '@repo/ui';
import type { ConfidenceTierKey } from '../../lib/map-experience/confidence-icons';
import { confidenceIconFor } from '../../lib/map-experience/confidence-icons';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../lib/map-experience/kind-icons';
import { statusIconFor } from '../../lib/map-experience/status-icons';
import './record-chrome.css';

void React;

/* —— icons by section ————————————————————————————————————————————————————————— */

export type RecordSectionIconKey =
  | 'context'
  | 'further'
  | 'claims'
  | 'archive'
  | 'status'
  | 'timeline'
  | 'related'
  | 'continue'
  | 'appears'
  | 'stories'
  | 'trust'
  | 'toc'
  | 'bibliography'
  | 'provenance'
  | 'why'
  | 'gaps'
  | 'cited'
  | 'where'
  | 'era';

const SECTION_ICONS: Readonly<Record<RecordSectionIconKey, IconDefinition>> = {
  context: faBookOpen,
  further: faScroll,
  claims: faQuoteLeft,
  archive: faBoxArchive,
  status: faClockRotateLeft,
  timeline: faTimeline,
  related: faDiagramProject,
  continue: faSignsPost,
  appears: faNewspaper,
  stories: faBookOpen,
  trust: faShieldHalved,
  toc: faList,
  bibliography: faBookOpen,
  provenance: faFingerprint,
  why: faCircleQuestion,
  gaps: faMagnifyingGlass,
  cited: faNewspaper,
  where: faLocationDot,
  era: faCalendarDay,
};

export function recordSectionIcon(key: RecordSectionIconKey): IconDefinition {
  return iconWithFallback(SECTION_ICONS[key]);
}

/* —— pill ————————————————————————————————————————————————————————————————————— */

export type RecordPillTone = 'kind' | 'status' | 'era' | 'grade' | 'plain';

export type RecordPillProps = {
  readonly icon: IconDefinition;
  readonly children: ReactNode;
  readonly tone?: RecordPillTone;
  /** Kind shade, applied to the icon only; the pill itself stays on the surface tokens. */
  readonly iconColor?: string;
  readonly href?: string;
  readonly title?: string;
  /** Data attribute carried for tone-specific CSS (status value, grade letter). */
  readonly variant?: string;
  readonly className?: string;
};

export function RecordPill({
  icon,
  children,
  tone = 'plain',
  iconColor,
  href,
  title,
  variant,
  className,
}: RecordPillProps) {
  const body = (
    <>
      <FontAwesomeIcon
        icon={icon}
        className="ds-rec-pill__icon"
        {...(iconColor ? { style: { color: iconColor } } : {})}
        aria-hidden="true"
      />
      <span className="ds-rec-pill__label">{children}</span>
    </>
  );
  const classes = cx('ds-rec-pill', `ds-rec-pill--${tone}`, className);
  const data = variant ? { 'data-variant': variant } : {};
  if (href) {
    return (
      <Link
        className={classes}
        href={href}
        prefetch={false}
        {...(title ? { title } : {})}
        {...data}
      >
        {body}
      </Link>
    );
  }
  return (
    <span className={classes} {...(title ? { title } : {})} {...data}>
      {body}
    </span>
  );
}

/** The kind pill: the record's kind icon in its map shade, plus the kind's name. */
export function RecordKindPill({
  kind,
  mapTone,
  href,
}: {
  readonly kind: string;
  readonly mapTone?: string;
  readonly href?: string;
}) {
  const encoding = displayEncodingFor(kind, mapTone);
  return (
    <RecordPill
      tone="kind"
      icon={iconWithFallback(kindIconFor(kind, mapTone))}
      iconColor={encoding.shade}
      variant={kind}
      {...(href ? { href } : {})}
    >
      {encoding.label}
    </RecordPill>
  );
}

/** The status pill: lifecycle icon plus the standing, in the record's own vocabulary. */
export function RecordStatusPill({
  status,
  label,
}: {
  readonly status: string;
  readonly label: string;
}) {
  return (
    <RecordPill tone="status" icon={statusIconFor(status)} variant={status}>
      {label}
    </RecordPill>
  );
}

/** Evidence grade as a pill: the tier icon, the letter, and the word. */
export function RecordGradePill({
  tier,
  children,
  href,
}: {
  readonly tier: ConfidenceTierKey;
  readonly children: ReactNode;
  readonly href?: string;
}) {
  return (
    <RecordPill
      tone="grade"
      icon={confidenceIconFor(tier)}
      variant={tier}
      {...(href ? { href } : {})}
    >
      {children}
    </RecordPill>
  );
}

/* —— meter ————————————————————————————————————————————————————————————————————— */

export type RecordMeterProps = {
  /** Filled segments, 0 to `of`. */
  readonly level: number;
  readonly of?: number;
  readonly tone: ConfidenceTierKey | 'coverage';
  /** Screen-reader sentence; the bars alone say nothing. */
  readonly label: string;
  readonly className?: string;
};

export function RecordMeter({ level, of = 3, tone, label, className }: RecordMeterProps) {
  return (
    <span
      className={cx('ds-rec-meter', `ds-rec-meter--${tone}`, className)}
      role="img"
      aria-label={label}
    >
      {Array.from({ length: of }, (_, index) => (
        <i
          key={index}
          className={cx('ds-rec-meter__seg', index < level && 'ds-rec-meter__seg--on')}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Filled segments for a confidence tier. Unrated is honestly empty, never a fourth colour. */
export function meterLevelForTier(tier: ConfidenceTierKey): number {
  switch (tier) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}

export function meterLevelForCoverage(level: 'minimal' | 'partial' | 'substantial'): number {
  switch (level) {
    case 'substantial':
      return 3;
    case 'partial':
      return 2;
    default:
      return 1;
  }
}

/* —— fact tile ————————————————————————————————————————————————————————————————— */

export type RecordFactTileProps = {
  readonly icon: IconDefinition;
  readonly label: string;
  readonly value: ReactNode;
  /** One supporting line under the value: precision, decade span, source count. */
  readonly support?: ReactNode;
  /** Icon colour (kind shade, confidence tone). Defaults to the muted ink. */
  readonly iconColor?: string;
  readonly meter?: RecordMeterProps;
  readonly className?: string;
};

export function RecordFactTile({
  icon,
  label,
  value,
  support,
  iconColor,
  meter,
  className,
}: RecordFactTileProps) {
  return (
    <div className={cx('ds-rec-tile', className)}>
      <span className="ds-rec-tile__plate" aria-hidden="true">
        <FontAwesomeIcon
          icon={icon}
          className="ds-rec-tile__icon"
          {...(iconColor ? { style: { color: iconColor } } : {})}
        />
      </span>
      <div className="ds-rec-tile__text">
        <dt className="ds-rec-tile__label">{label}</dt>
        <dd className="ds-rec-tile__value">{value}</dd>
        {support !== undefined || meter ? (
          <dd className="ds-rec-tile__support">
            {meter ? <RecordMeter {...meter} /> : null}
            {support !== undefined ? <span>{support}</span> : null}
          </dd>
        ) : null}
      </div>
    </div>
  );
}

/* —— beat heading ————————————————————————————————————————————————————————————————— */

export type RecordBeatHeadProps = {
  readonly id: string;
  /** Running index in the column, `01`, `02`... */
  readonly index: string;
  readonly icon: RecordSectionIconKey;
  readonly title: ReactNode;
  readonly count?: number;
  readonly standfirst?: ReactNode;
};

export function RecordBeatHead({ id, index, icon, title, count, standfirst }: RecordBeatHeadProps) {
  return (
    <header className="ds-rec-beat-head">
      <span className="ds-rec-beat-head__index" aria-hidden="true">
        {index}
      </span>
      <span className="ds-rec-beat-head__plate" aria-hidden="true">
        <FontAwesomeIcon icon={recordSectionIcon(icon)} className="ds-rec-beat-head__icon" />
      </span>
      <h2 className="ds-record-beat__heading" id={id}>
        {title}
        {count !== undefined ? (
          <span className="ds-rec-count" aria-label={`${count} entries`}>
            {count}
          </span>
        ) : null}
      </h2>
      {standfirst !== undefined ? <p className="ds-record-beat__standfirst">{standfirst}</p> : null}
    </header>
  );
}

/* —— apparatus and rail titles ———————————————————————————————————————————————————— */

export function RecordSmallTitle({
  id,
  icon,
  children,
  as: Component = 'h3',
  className,
}: {
  readonly id?: string;
  readonly icon: RecordSectionIconKey;
  readonly children: ReactNode;
  readonly as?: 'h2' | 'h3' | 'span';
  readonly className?: string;
}) {
  return (
    <Component className={cx('ds-rec-small-title', className)} {...(id ? { id } : {})}>
      <FontAwesomeIcon
        icon={recordSectionIcon(icon)}
        className="ds-rec-small-title__icon"
        aria-hidden="true"
      />
      <span>{children}</span>
    </Component>
  );
}
