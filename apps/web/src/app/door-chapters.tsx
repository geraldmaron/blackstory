/**
 * The Door below the fold, scrolling up over the fixed map (docs/ui/patterns-living-archive.md):
 *
 *   ink     how evidence is graded: one ruled row in the claims block's own language (the grade's
 *           glyph and word, the records holding it), on the table's ground, so the dark map
 *           never hands off to a bright sheet in the dark theme
 *   copper  the lead chapter's cover, edge to edge, as a toned plate beside its title when it has one
 *
 * The decade histogram is not here: it is the walk itself, in the dock beside the map.
 * Every number comes from the same records index `/records` builds (`loadRecordsIndex`), so the
 * Door and the register cannot disagree. Server-rendered; no client code.
 */
import React from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Block, buttonClassName, type ConfidenceLevel } from '@repo/ui';
import type { PublicStoryListItemDoc } from '@repo/schemas';
import type { RecordsFacet } from '../lib/records/build-records-index';
import { coverDek } from '../components/story/story-text';
import { confidenceIconFor } from '../lib/map-experience/confidence-icons';
import { confidenceTierPhrase } from '../lib/evidence/confidence-language';
import { CoverImage } from './stories/StoriesIndexParts';

void React;

export type DoorChaptersProps = {
  readonly lead: PublicStoryListItemDoc | undefined;
  /** Records per evidence grade (the register's Evidence facet). */
  readonly grades: readonly RecordsFacet[];
};

/** The register's floors (A only, B and up, C and up) read back as one count per grade. */
const FLOOR_LEVELS = [
  ['A', 'high'],
  ['B', 'medium'],
  ['C', 'low'],
] as const;

export type DoorGradeCount = { readonly level: ConfidenceLevel; readonly count: number };

/**
 * Records holding each grade exactly. The Evidence facet counts floors ("B and up" includes every
 * A), so each grade is its floor less the floor above it.
 */
export function gradeCounts(floors: readonly RecordsFacet[]): readonly DoorGradeCount[] {
  const at = (id: string) => floors.find((floor) => floor.id === id)?.count;
  let above = 0;
  const counts: DoorGradeCount[] = [];
  for (const [floor, level] of FLOOR_LEVELS) {
    const reached = at(floor);
    if (reached === undefined) continue;
    counts.push({ level, count: Math.max(0, reached - above) });
    above = reached;
  }
  return counts;
}

export function DoorChapters({ lead, grades }: DoorChaptersProps) {
  return (
    <div className="ds-door-chapters">
      <Block
        tone="ink"
        className="ds-door-ch ds-door-ch--evidence"
        id="door-ch-evidence-band"
        aria-labelledby="door-ch-evidence"
      >
        <div className="ds-wrap ds-door-ch__inner">
          <h2 className="ds-door-ch__title" id="door-ch-evidence">
            Every record carries its grade
          </h2>
          <p className="ds-door-ch__line">
            A grade says how well the sources hold a record up: how many independent publishers
            stand behind it, and how directly they say it.
          </p>
          {/* The claims block's grade language: the tier's glyph and word, never a letter in a
              box, and color never the only signal. */}
          <ul className="ds-door-ch__grades">
            {gradeCounts(grades).map(({ level, count }) => (
              <li key={level} className={`ds-door-ch__grade ds-grade-tag--${level}`}>
                <FontAwesomeIcon
                  icon={confidenceIconFor(level)}
                  className="ds-grade-tag__glyph"
                  aria-hidden="true"
                />
                <span className="ds-door-ch__grade-label">{confidenceTierPhrase(level)}</span>
                <span className="ds-door-ch__grade-count">
                  <span className="ds-door-ch__grade-numeral">{count.toLocaleString('en-US')}</span>{' '}
                  records
                </span>
              </li>
            ))}
          </ul>
          <Link className="ds-door-ch__link" href="/methodology">
            How a record is graded
          </Link>
        </div>
      </Block>

      {lead ? (
        <Block
          tone="copper"
          className="ds-door-ch ds-door-ch--story"
          aria-labelledby="door-ch-story"
        >
          <div className="ds-wrap ds-door-ch__inner" data-media={lead.heroImage ? 'plate' : 'none'}>
            <div className="ds-door-ch__text">
              {/* The years are the cover: the numeral role, in ink on the copper band. */}
              <p className="ds-door-ch__years">{lead.eraLabel}</p>
              <h2 className="ds-door-ch__story-title" id="door-ch-story">
                <Link href={`/stories/${lead.slug}`}>{lead.title}</Link>
              </h2>
              <p className="ds-door-ch__dek">{coverDek(lead.summary)}</p>
              <div className="ds-door-ch__actions">
                <Link className={buttonClassName('primary')} href={`/stories/${lead.slug}`}>
                  Read the chapter
                </Link>
                <Link className={buttonClassName('quiet')} href="/stories">
                  All stories
                </Link>
              </div>
            </div>
            {/* A real cover image stands beside the text as a toned plate with its credit; a
                chapter without one has no picture and no empty space where one would be. */}
            {lead.heroImage ? (
              <figure className="ds-plate ds-door-ch__plate">
                <span className="ds-plate__tone" aria-hidden="true">
                  <CoverImage item={lead} width={720} className="ds-plate__img" />
                </span>
                <figcaption className="ds-plate__credit">{lead.heroImage.credit}</figcaption>
              </figure>
            ) : null}
          </div>
        </Block>
      ) : null}
    </div>
  );
}
