/**
 * An archival image in a story: the whole frame at its own aspect (never cropped), in a reserved
 * frame with a ground, then one caption line with the credit after it in muted ink.
 */
import React from 'react';
import type { ReactNode } from 'react';
import type { StoryImageDoc } from '@repo/schemas';
import { cx } from '@repo/ui';
import { StoryImage } from './StoryImage';
import { storyImageSrc } from './story-image';

void React;

export function StoryFigure({
  image,
  caption,
  eager = false,
  className,
}: {
  readonly image: Pick<StoryImageDoc, 'url' | 'alt' | 'credit' | 'width' | 'height'>;
  readonly caption?: ReactNode;
  /** The masthead image: loaded at once rather than when scrolled near. */
  readonly eager?: boolean;
  readonly className?: string;
}) {
  return (
    <figure className={cx('ds-story-figure', className)}>
      <StoryImage
        className="ds-story-figure__frame"
        // 640 CSS px asks Commons for its 1280 step: sharp on the 964 track at 1.3x, and a thumbnail,
        // which Commons rate-limits far less than the original.
        src={storyImageSrc(image.url, 640, image.width)}
        fallbackSrc={image.url}
        alt={image.alt}
        {...(image.width ? { width: image.width } : {})}
        {...(image.height ? { height: image.height } : {})}
        eager={eager}
      />
      <figcaption className="ds-story-caption">
        {caption ? <>{caption} </> : null}
        <span className="ds-story-caption__credit">{image.credit}</span>
      </figcaption>
    </figure>
  );
}
