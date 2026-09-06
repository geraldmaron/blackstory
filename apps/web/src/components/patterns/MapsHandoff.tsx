/**
 * Maps handoff: the archive's exits into a reader's own maps app.
 *
 * The old shape was five underlined text links in one wrapping run, separated by middots. Four of
 * them said nearly the same thing ("Apple Maps", "Google Maps", "Directions (Apple)", "Directions
 * (Google)"), so the row read as one blurred line with no provider identity; the separator was an
 * `::after` on each link, which stranded a middot at the end of a line whenever the run wrapped;
 * and every one of them carried the same accessible name, "Open <place> in maps".
 *
 * The shape here is one segmented control per provider: the brand mark and the provider's name
 * open the place, and a second segment gets directions to it. Two segments, one hairline, so a
 * provider reads as a single object and the two providers cannot blur into each other. The group
 * is a grid of `auto-fit` tracks, so it stacks rather than overflowing on a narrow card.
 *
 * Weight: segments use the shared quiet pill (`.ds-cta--quiet`, `.ds-cta--sm`), never copper.
 * An external handoff is not the primary action of any view it appears on — the record page's
 * "See it on the map" and the sheet's "Fly to place" are — and §8 allows one filled action per
 * composition. That constraint is what the previous text links were protecting; it survives here.
 *
 * Brand marks are Font Awesome's `apple` and `google` glyphs, and each always travels with the
 * provider's name in text (WCAG 1.4.1, and the house rule that an icon is never the only signal).
 * They identify the destination service; they are not a claim of endorsement by either company.
 */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faApple, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { faDiamondTurnRight } from '@fortawesome/free-solid-svg-icons';
import { iconWithFallback } from '../../lib/map-experience/icon-fallback';
import { MapsExternalLink } from '../map-experience/MapsExternalLink';
import './maps-handoff.css';

void React;

export type MapsProviderKey = 'apple' | 'google';

export type MapsHandoffProvider = {
  readonly key: MapsProviderKey;
  /** Opens the place itself. Omitted when the record has no searchable address. */
  readonly placeHref?: string | undefined;
  /** Routes the reader from where they are. Omitted when the record has no coordinate. */
  readonly directionsHref?: string | undefined;
};

export type MapsHandoffProps = {
  /** The place as a reader would say it; used in every accessible name. */
  readonly placeLabel: string;
  readonly providers: readonly MapsHandoffProvider[];
  readonly className?: string;
};

const PROVIDER_NAME: Record<MapsProviderKey, string> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
};

const PROVIDER_MARK: Record<MapsProviderKey, IconDefinition> = {
  apple: faApple,
  google: faGoogle,
};

/** True when a provider has at least one exit worth drawing a control for. */
function hasAnyExit(provider: MapsHandoffProvider): boolean {
  return Boolean(provider.placeHref) || Boolean(provider.directionsHref);
}

function ProviderControl({
  provider,
  placeLabel,
}: {
  readonly provider: MapsHandoffProvider;
  readonly placeLabel: string;
}) {
  const name = PROVIDER_NAME[provider.key];

  /*
   * The pair is a visual grouping, not a semantic one: both links already name their provider and
   * their action, so a nested `role="group"` labelled "Apple Maps" only made a screen reader say
   * the provider three times before the reader reached a link.
   */
  return (
    <div className="ds-maps-handoff__provider">
      {provider.placeHref ? (
        <MapsExternalLink
          className="ds-cta ds-cta--quiet ds-cta--sm ds-maps-handoff__seg ds-maps-handoff__seg--place"
          href={provider.placeHref}
          placeLabel={placeLabel}
          ariaLabel={`Open ${placeLabel} in ${name}`}
          title={`Open ${placeLabel} in ${name}.`}
        >
          <FontAwesomeIcon
            icon={iconWithFallback(PROVIDER_MARK[provider.key])}
            className="ds-maps-handoff__mark"
            aria-hidden="true"
          />
          <span className="ds-maps-handoff__name">{name}</span>
        </MapsExternalLink>
      ) : null}
      {provider.directionsHref ? (
        <MapsExternalLink
          className="ds-cta ds-cta--quiet ds-cta--sm ds-maps-handoff__seg ds-maps-handoff__seg--directions"
          href={provider.directionsHref}
          placeLabel={placeLabel}
          ariaLabel={`Get directions to ${placeLabel} in ${name}`}
          title={`Directions to ${placeLabel} in ${name}.`}
        >
          <FontAwesomeIcon
            icon={iconWithFallback(faDiamondTurnRight)}
            className="ds-maps-handoff__mark"
            aria-hidden="true"
          />
          <span className="ds-maps-handoff__name">Directions</span>
        </MapsExternalLink>
      ) : null}
    </div>
  );
}

export function MapsHandoff({ placeLabel, providers, className }: MapsHandoffProps) {
  const drawable = providers.filter(hasAnyExit);
  if (drawable.length === 0) {
    return null;
  }

  const rootClass = ['ds-maps-handoff', className ?? '']
    .filter((part) => part.length > 0)
    .join(' ');

  return (
    <div className={rootClass} role="group" aria-label="Open this place in a maps app">
      {drawable.map((provider) => (
        <ProviderControl key={provider.key} provider={provider} placeLabel={placeLabel} />
      ))}
    </div>
  );
}
