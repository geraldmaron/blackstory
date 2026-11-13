'use client';

/**
 * Every image on the stories surfaces. The frame is reserved before the file arrives (the stored
 * aspect when there is one), it sits on a paper ground while loading, and a failed file says so
 * inside the same frame with a link to the original. A slow or refused Commons request used to
 * leave a black hole in the column: a lazy image with no size, no ground and no error state.
 */
import React, { useEffect, useRef, useState } from 'react';
import { cx } from '@repo/ui';

void React;

export type StoryImageProps = {
  readonly src: string;
  /** Tried once when `src` fails, before the error state: the original of a resized URL. */
  readonly fallbackSrc?: string;
  readonly alt: string;
  readonly width?: number;
  readonly height?: number;
  /** Above the fold: load now, at high priority. */
  readonly eager?: boolean;
  /** Inside a link (a list row, a cover): the failure note cannot carry a link of its own. */
  readonly inLink?: boolean;
  readonly className?: string;
};

type Status = 'loading' | 'loaded' | 'failed';

export function StoryImage({
  src,
  fallbackSrc,
  alt,
  width,
  height,
  eager = false,
  inLink = false,
  className,
}: StoryImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [current, setCurrent] = useState(src);
  const [status, setStatus] = useState<Status>('loading');

  // An image that finished before hydration fires no event React can hear.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setStatus(img.naturalWidth > 0 ? 'loaded' : 'failed');
  }, [current]);

  const onError = () => {
    if (fallbackSrc && current !== fallbackSrc) {
      setCurrent(fallbackSrc);
      setStatus('loading');
    } else {
      setStatus('failed');
    }
  };

  return (
    <span
      className={cx('ds-story-img', className)}
      data-state={status}
      style={width && height ? { aspectRatio: `${width} / ${height}` } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- published archival image, often external */}
      <img
        ref={imgRef}
        src={current}
        alt={alt}
        {...(width && height ? { width, height } : {})}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        {...(eager ? { fetchPriority: 'high' as const } : {})}
        onLoad={() => setStatus('loaded')}
        onError={onError}
      />
      {status === 'failed' ? (
        <span className="ds-story-img__failed">
          <span>Image unavailable.</span>
          {inLink ? null : (
            <a href={fallbackSrc ?? src} rel="noreferrer">
              Open the original
            </a>
          )}
        </span>
      ) : null}
    </span>
  );
}
