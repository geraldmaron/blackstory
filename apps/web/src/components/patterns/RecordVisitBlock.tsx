/**
 * Shared visit block: public address, standing, precision, contact, and maps handoff CTAs.
 * Address and phone (when present) pair with standard flat icons; icons are never the only signal.
 */
import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { MapsExternalLink } from '../map-experience/MapsExternalLink';
import {
  externalMapsDirectionsLabel,
  externalMapsLinkLabel,
} from '../../lib/geography/external-maps-url';
import { buildVisitHandoff, type VisitHandoffInput } from '../../lib/geography/visit-handoff';
import type { PublicVisitContactField } from '../../lib/geography/public-visit-contact';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import { Precision } from '../room';
import { RecordPlacePreview } from './RecordPlacePreview';
import { visitFactIconFor, type VisitFactIconKey } from './edition-fact-icon';
import './record-visit.css';
import './record-archive.css';

void React;

export type RecordVisitBlockProps = VisitHandoffInput & {
  readonly className?: string;
  readonly showLocator?: boolean;
  readonly atlasHref?: string;
  readonly locatorLabel?: string;
  readonly compact?: boolean;
};

function formatWebsiteHref(value: string): string {
  if (/^https?:\/\//iu.test(value)) {
    return value;
  }
  return `https://${value}`;
}

function formatPhoneHref(value: string): string {
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length > 0 ? `tel:${digits}` : `tel:${value.trim()}`;
}

function VisitIcon({ fact }: { readonly fact: VisitFactIconKey }) {
  return (
    <FontAwesomeIcon
      icon={iconWithFallback(visitFactIconFor(fact))}
      className="ds-record-visit__icon"
      aria-hidden="true"
    />
  );
}

function VisitorField({
  label,
  icon,
  field,
  href,
}: {
  readonly label: string;
  readonly icon: VisitFactIconKey;
  readonly field: PublicVisitContactField;
  readonly href?: string;
}) {
  return (
    <div className="ds-record-visit__visitor-row">
      <dt>
        <VisitIcon fact={icon} />
        <span>{label}</span>
      </dt>
      <dd>
        {href ? (
          <a href={href} rel={href.startsWith('http') ? 'noreferrer' : undefined}>
            {field.value}
          </a>
        ) : (
          field.value
        )}
        <span className="ds-record-visit__visitor-source">Source: {field.citationLabel}</span>
      </dd>
    </div>
  );
}

export function RecordVisitBlock({
  className,
  showLocator = false,
  atlasHref,
  locatorLabel,
  compact = false,
  ...input
}: RecordVisitBlockProps) {
  const visit = buildVisitHandoff(input);
  const rootClass = ['ds-record-visit', compact ? 'ds-record-visit--compact' : '', className ?? '']
    .filter((part) => part.length > 0)
    .join(' ');
  const mapsLabel = visit.addressLine;
  const contact = visit.contact;

  return (
    <section className={rootClass} aria-labelledby="record-visit-heading">
      <h2 className="ds-record-visit__heading" id="record-visit-heading">
        Visit
      </h2>
      <p className="ds-record-visit__address">
        <VisitIcon fact="address" />
        <span className="ds-record-visit__address-text">{visit.addressLine}</span>
      </p>
      {visit.visitStanding ? (
        <p className="ds-record-visit__standing">{visit.visitStanding}</p>
      ) : null}
      {showLocator && input.lat !== undefined && input.lng !== undefined ? (
        <RecordPlacePreview
          lat={input.lat}
          lng={input.lng}
          label={locatorLabel ?? visit.addressLine}
        />
      ) : null}
      {contact ? (
        <div className="ds-record-visit__visitor">
          <h3 className="ds-record-visit__visitor-title">Visitor information</h3>
          <dl className="ds-record-visit__visitor-list">
            {contact.website ? (
              <VisitorField
                label="Website"
                icon="website"
                field={contact.website}
                href={formatWebsiteHref(contact.website.value)}
              />
            ) : null}
            {contact.phone ? (
              <VisitorField
                label="Phone"
                icon="phone"
                field={contact.phone}
                href={formatPhoneHref(contact.phone.value)}
              />
            ) : null}
            {contact.hours ? (
              <VisitorField label="Hours" icon="hours" field={contact.hours} />
            ) : null}
          </dl>
        </div>
      ) : null}
      {!compact ? (
        <Precision
          resolution={visit.precisionLabel}
          caveat="The archive never draws a point sharper than the source supports."
        />
      ) : null}
      {/*
       * Maps exits are quiet text links, never copper pills. External handoff and in-app
       * "Fly to place" (sheet) are different jobs; twin primary CTAs for "go to place" compete.
       */}
      <div className="ds-record-visit__actions" role="group" aria-label="Maps handoff">
        {visit.mapsSearchHref ? (
          <MapsExternalLink
            className="ds-record-visit__link"
            href={visit.mapsSearchHref}
            placeLabel={mapsLabel}
            title={externalMapsLinkLabel(mapsLabel)}
          >
            Open in maps
          </MapsExternalLink>
        ) : null}
        {visit.mapsDirectionsHref ? (
          <MapsExternalLink
            className="ds-record-visit__link"
            href={visit.mapsDirectionsHref}
            placeLabel={mapsLabel}
            title={externalMapsDirectionsLabel(mapsLabel)}
          >
            Get directions
          </MapsExternalLink>
        ) : null}
        {atlasHref ? (
          <Link className="ds-record-visit__link" href={atlasHref} scroll={false}>
            See on map
          </Link>
        ) : null}
      </div>
    </section>
  );
}
