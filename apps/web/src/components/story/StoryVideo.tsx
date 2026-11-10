'use client';

/**
 * Click-to-load video. Nothing from the provider is requested until the reader presses play:
 * the plate is typography only. Without JavaScript the plate still carries a plain link to the
 * provider's own watch page. Props are plain data (no @repo/schemas import) so zod stays out of
 * the client bundle; the server resolves the source with `storyVideoSource`.
 */
import React, { useState } from 'react';
import { faPlay } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

void React;

export type StoryVideoProps = {
  readonly title: string;
  readonly providerLabel: string;
  readonly credit: string;
  readonly rights: string;
  readonly watchUrl: string;
  readonly source: { readonly kind: 'iframe' | 'file'; readonly src: string };
  readonly caption?: React.ReactNode;
};

export function StoryVideo({
  title,
  providerLabel,
  credit,
  rights,
  watchUrl,
  source,
  caption,
}: StoryVideoProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <figure className="ds-reading-video">
      {loaded ? (
        <div className="ds-reading-video__frame">
          {source.kind === 'file' ? (
            <video controls preload="none" autoPlay title={title} src={source.src} />
          ) : (
            <iframe
              src={source.src}
              title={title}
              allow="fullscreen"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>
      ) : (
        <div className="ds-reading-video__plate">
          <p className="ds-reading-video__title">{title}</p>
          <p className="ds-reading-video__meta">
            {providerLabel}. {credit}. {rights}.
          </p>
          <div className="ds-reading-video__actions">
            <button
              type="button"
              className="ds-reading-video__play"
              aria-label={`Play video: ${title}`}
              onClick={() => setLoaded(true)}
            >
              <FontAwesomeIcon icon={faPlay} aria-hidden="true" />
              <span>Play video</span>
            </button>
            <a
              className="ds-reading-video__watch"
              href={watchUrl}
              rel="noopener noreferrer external"
              target="_blank"
            >
              Watch on {providerLabel}
              <span className="ds-visually-hidden"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}
      {caption ? <figcaption className="ds-reading__figcaption">{caption}</figcaption> : null}
    </figure>
  );
}
