'use client';

/**
 * The reader's two switches over the world (design-direction-v11.md §4.1, §4.3): "Hold still"
 * stops camera motion, "Read as documents" removes the map from every page. Shown on the
 * surfaces that paint the world, and wherever documents mode is on, so it can be turned off.
 *
 * Documents mode reloads: the plate is built once per page load, and tearing down a WebGL
 * context in place is a path nothing else exercises.
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
      <button
        type="button"
        className="ds-world-controls__button"
        aria-pressed={documents}
        onClick={() => {
          setWorldPref(READ_AS_DOCUMENTS_KEY, !documents);
          window.location.reload();
        }}
      >
        Read as documents
      </button>
    </section>
  );
}
