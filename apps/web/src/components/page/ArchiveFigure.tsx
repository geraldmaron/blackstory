/** A documentary image with its caption, credit and source link. Styles: lives.css and page-kit.css. */

import React from 'react';
import type { ReactNode } from 'react';
import { DestinationIcon } from '../patterns/DestinationIcon';

void React;

/** Documentary images keep their complete frame and provenance, never a decorative crop. */
export function ArchiveFigure({
  image,
  caption,
  href,
  rights,
  children,
}: {
  readonly image: { readonly url: string; readonly alt: string; readonly credit: string };
  readonly caption?: ReactNode;
  readonly href?: string;
  readonly rights?: string;
  readonly children?: ReactNode;
}) {
  return (
    <figure className="ds-archive-figure">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
      <figcaption>
        {caption ? <p>{caption}</p> : null}
        <p className="ds-archive-figure__credit">{image.credit}</p>
        {rights ? <p className="ds-archive-figure__credit">{rights}</p> : null}
        {href ? (
          <a className="ds-archive-figure__source" href={href} rel="noreferrer">
            <DestinationIcon id="external" /> Inspect the original and source record
          </a>
        ) : null}
        {children}
      </figcaption>
    </figure>
  );
}
