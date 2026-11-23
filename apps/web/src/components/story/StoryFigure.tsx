/**
 * An archival image in a story, as an exhibit (docs/ui/DESIGN.md section 7.3): the whole frame at
 * its own aspect and in its own color (never cropped, toned or aged), a label that says what kind
 * of object it is and whether its date is on record, and its credit and rights as the receipt.
 * Harm-adjacent material takes the quiet frame. An image whose kind the story does not state (a
 * painting, say) takes the compact frame, which prints no kind.
 */
import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { StoryImageDoc } from '@repo/schemas';
import { cx, ExhibitFrame, Receipt } from '@repo/ui';
import { StoryImage } from './StoryImage';
import { storyImageSrc } from './story-image';
import {
  isQuietImage,
  RIGHTS_LABEL,
  storyImageBasis,
  storyImageId,
  storyImageKind,
} from './story-exhibit';

void React;

export function StoryFigure({
  image,
  caption,
  eager = false,
  width = 640,
  className,
}: {
  readonly image: Pick<
    StoryImageDoc,
    'url' | 'alt' | 'credit' | 'rightsStatus' | 'width' | 'height'
  >;
  readonly caption?: ReactNode;
  /** The masthead image: loaded at once rather than when scrolled near. */
  readonly eager?: boolean;
  /** CSS pixels the image is shown at, for the resized source. 640 asks Commons for its 1280 step. */
  readonly width?: number;
  readonly className?: string;
}) {
  // The stored size sets the figure's width in CSS, so the frame is reserved before the file
  // arrives and can never be wider than the track it sits on.
  const sized =
    image.width && image.height
      ? ({
          '--story-ratio': image.width / image.height,
          '--story-natural': `${image.width}px`,
        } as CSSProperties)
      : undefined;
  const kind = storyImageKind(image);
  return (
    <div className={cx('ds-story-figure', className)} style={sized}>
      <ExhibitFrame
        id={storyImageId(image)}
        kind={kind ?? 'photograph'}
        variant={isQuietImage(image) ? 'quiet' : kind ? 'full' : 'compact'}
        basis={storyImageBasis(image)}
        receipt={
          <>
            {caption ? <p className="ds-story-caption">{caption}</p> : null}
            <Receipt source={image.credit} detail={RIGHTS_LABEL[image.rightsStatus]} />
          </>
        }
      >
        <StoryImage
          src={storyImageSrc(image.url, width, image.width)}
          fallbackSrc={image.url}
          alt={image.alt}
          {...(image.width ? { width: image.width } : {})}
          {...(image.height ? { height: image.height } : {})}
          eager={eager}
        />
      </ExhibitFrame>
    </div>
  );
}
