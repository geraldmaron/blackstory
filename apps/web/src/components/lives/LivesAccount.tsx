import React from 'react';
import { livesWorldMediationLine, type LivesWorldBeat } from '@repo/domain/statistics/lives';

void React;

/**
 * One first-person account: the speaker's own words, who they were, how the words reached the
 * page, and the recording when an archive holds one.
 *
 * The recording streams from the holding archive and is never rehosted. `preload="none"` means a
 * visitor's browser contacts the archive only when they press play. The quote, the transcript link
 * and the archive link always render, so the account is complete for a reader who cannot or does
 * not play audio, and still works if the archive's media server is down.
 * Sources and the rights reading: docs/research/lives-audio-sources.md.
 */
export function LivesAccount({ beat }: { readonly beat: LivesWorldBeat }) {
  const { speaker, quote, recording } = beat;
  if (!speaker || !quote) return null;
  return (
    <figure className="lives-account">
      <blockquote className="lives-account__quote">
        <p>“{quote}”</p>
      </blockquote>
      <figcaption className="lives-account__who">
        <span className="lives-account__name">{speaker.name}</span>
        <span className="lives-account__meta">
          {speaker.place}, {speaker.year}
          {speaker.classNote ? ` · ${speaker.classNote}` : ''}
        </span>
        <span className="lives-account__mediation">{livesWorldMediationLine(speaker)}</span>
      </figcaption>
      <p className="lives-account__body">{beat.body}</p>
      {recording ? (
        <div className="lives-account__recording">
          {recording.contentNote ? (
            <p className="lives-account__content-note">{recording.contentNote}</p>
          ) : null}
          <audio
            className="lives-account__audio"
            controls
            preload="none"
            src={recording.mediaUrl}
            aria-label={`Recording of ${speaker.name}, ${recording.recordedOn}`}
          >
            Your browser can’t play this recording here.{' '}
            <a href={recording.itemUrl}>Listen at {recording.holdingInstitution}</a>.
          </audio>
          <p className="lives-account__links">
            Recorded {recording.recordedOn}.{' '}
            {recording.transcriptUrl ? (
              <>
                <a href={recording.transcriptUrl} rel="noopener noreferrer">
                  Read the transcript
                </a>{' '}
                ·{' '}
              </>
            ) : null}
            <a href={recording.itemUrl} rel="noopener noreferrer">
              Listen at {recording.holdingInstitution}
            </a>
          </p>
          <p className="lives-account__credit">
            {recording.creditLine}. {recording.rightsNote}
          </p>
        </div>
      ) : null}
      {beat.citations.length > 0 ? (
        <ul className="lives-milestone__sources" aria-label="Sources for this account">
          {beat.citations.map((source) => (
            <li key={`${source.url}|${source.label}`}>
              <a href={source.url} rel="noopener noreferrer">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}
