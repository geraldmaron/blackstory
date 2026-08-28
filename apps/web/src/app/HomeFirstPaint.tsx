/**
 * Server-rendered front door: the place is the page.
 *
 * Not a record card on black, and not the Atlas board. Voice is stolen from `/about`.
 * No schema fields, no
 * confidence grade, no source count, no precision-affordance leak. The map is an
 * OffRamp, not the boot.
 */
import React from 'react';
import Link from 'next/link';
import { ATLAS_INSTRUMENT_HREF } from '../lib/nav/atlas-door';
import { destinationFor } from '../lib/nav/destination-registry';
import { OffRamp, Prose, Room } from '../components/room';
import { ABOUT_LINE, ABOUT_ON_THE_GROUND, ABOUT_WALK_PAST } from './about/about-copy';
import { isInternalRecordLabel, type HomeFirstPaintModel } from './home-first-paint';
import './reading-room.css';
import './home-first-paint.css';

const ATLAS_LINE = destinationFor('/explore')?.description ?? 'The Atlas answers where and when.';

export function HomeFirstPaint({ model }: { readonly model: HomeFirstPaintModel }) {
  const lead =
    model.lead && !isInternalRecordLabel(model.lead.displayName) ? model.lead : undefined;
  const story = model.story && !isInternalRecordLabel(model.story.title) ? model.story : undefined;
  const title = lead?.displayName ?? story?.title;
  const recordHref = lead ? `/entity/${lead.id}` : undefined;
  const storyHref = !lead && story ? `/stories/${story.slug}` : undefined;

  return (
    <Room
      className="ds-home-first-paint"
      masthead={
        <div className="ds-home-place">
          <h1 className="ds-home-place__title">
            {recordHref ? (
              <Link className="ds-home-place__title-link" href={recordHref}>
                {title}
              </Link>
            ) : storyHref ? (
              <Link className="ds-home-place__title-link" href={storyHref}>
                {title}
              </Link>
            ) : (
              (title ?? 'BlackStory')
            )}
          </h1>
          <p className="ds-home-place__walk">{ABOUT_WALK_PAST}</p>
          <p className="ds-home-place__ground">{ABOUT_ON_THE_GROUND}</p>
        </div>
      }
    >
      {lead ? (
        <Prose>
          <p>{lead.summary}</p>
          <p>{lead.historicalContext}</p>
          <p>{ABOUT_LINE}</p>
        </Prose>
      ) : null}

      {!lead && story ? (
        <Prose>
          <p>{story.summary}</p>
          <p>{ABOUT_LINE}</p>
        </Prose>
      ) : null}

      {!lead && !story ? (
        <Prose>
          <p>{ABOUT_LINE}</p>
        </Prose>
      ) : null}

      <OffRamp
        title="Where to begin"
        actions={[
          {
            href: ATLAS_INSTRUMENT_HREF,
            label: 'Open the Atlas',
            ...(lead ? {} : { emphasis: 'copper' as const }),
          },
          { href: '/records', label: 'Search the records' },
          { href: '/stories', label: 'Stories' },
        ]}
      >
        {ATLAS_LINE}
      </OffRamp>
    </Room>
  );
}
