'use client';

/**
 * The reader's "Hold still" switch over the world (design-direction-v11.md §4.1): it stops camera
 * motion. The "Read as documents" switch was removed; documents mode still applies where WebGL is
 * missing (map-libre-lifecycle.ts).
 */
import React, { useEffect, useState } from 'react';
import {
  HOLD_STILL_KEY,
  READ_AS_DOCUMENTS_KEY,
  holdStill,
  readAsDocuments,
  setWorldPref,
} from '../../lib/map-experience/world-prefs';
import './world-controls.css';

void React;

export function WorldControls() {
  const [still, setStill] = useState(false);
  const [documents, setDocuments] = useState(false);
  useEffect(() => {
    setStill(holdStill());
    setDocuments(readAsDocuments());
    // The "Read as documents" switch is gone. Clear a choice saved before it was removed, so the
    // next load has the map again instead of leaving the reader with no way out.
    setWorldPref(READ_AS_DOCUMENTS_KEY, false);
  }, []);

  return (
    <section
      className="ds-world-controls"
      aria-label="Map display"
      data-documents={documents ? '' : undefined}
    >
      {documents ? null : (
        <button
          type="button"
          className="ds-world-controls__button"
          aria-pressed={still}
          onClick={() => {
            setWorldPref(HOLD_STILL_KEY, !still);
            setStill(!still);
          }}
        >
          Hold still
        </button>
      )}
    </section>
  );
}
