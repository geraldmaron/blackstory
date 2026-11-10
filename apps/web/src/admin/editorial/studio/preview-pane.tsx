'use client';
/** The saved revision rendered as readers will see it, beside the manuscript. */
import { useEffect, useRef, useState } from 'react';

export function PreviewPane({
  slug,
  revision,
  pending,
}: {
  slug: string;
  revision: number;
  /** True while the latest edit has not reached the saved revision yet. */
  pending: boolean;
}) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  // The revision the frame shows; it follows `revision` after the scroll position is read.
  const [shown, setShown] = useState(revision);
  const frame = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  useEffect(() => {
    if (revision === shown) return;
    try {
      scroll.current = frame.current?.contentWindow?.scrollY ?? 0;
    } catch {
      scroll.current = 0;
    }
    setShown(revision);
  }, [revision, shown]);

  if (!revision)
    return (
      <div className="studio-preview">
        <p className="studio-preview__label">Preview appears after the first save.</p>
      </div>
    );
  return (
    <div className="studio-preview">
      <div className="studio-preview__bar">
        <p className="studio-preview__label" role="status">
          Revision {revision}
          {pending ? ' · saving your latest change' : ''}
        </p>
        <div role="group" aria-label="Preview width">
          {(['desktop', 'phone'] as const).map((id) => (
            <button
              key={id}
              type="button"
              className="studio-btn studio-btn--small"
              aria-pressed={device === id}
              onClick={() => setDevice(id)}
            >
              {id === 'desktop' ? 'Desktop' : 'Phone'}
            </button>
          ))}
        </div>
      </div>
      <iframe
        ref={frame}
        title="Story preview"
        className="studio-preview__frame"
        data-device={device}
        src={`/admin/stories/${encodeURIComponent(slug)}/preview/embed?revision=${shown}`}
        onLoad={() => {
          try {
            frame.current?.contentWindow?.scrollTo(0, scroll.current);
          } catch {
            /* A cross-origin frame cannot be scrolled; the preview is same-origin. */
          }
        }}
      />
    </div>
  );
}
