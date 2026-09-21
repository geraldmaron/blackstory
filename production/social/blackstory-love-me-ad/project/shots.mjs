// The edit, expressed as capture specs.
//
// Every `in`/`out` below is a frame number on the 59.94fps timeline and comes
// from audio/markers.json. Nothing here is a round number by choice.
import * as E from './ease.mjs';
import { prep, cam, measure, centreOn } from './page-cam.mjs';
import { HIDE_CHROME } from './map-chrome.mjs';

export const BASE = 'http://localhost:3048';
export const TOTAL = 3264;

const lerp = E.lerp;
/** Map camera helper: jump to an exact frame state. */
const jump = (page, c) =>
  page.evaluate((cc) => {
    const m = window.__bpMapStage;
    m.jumpTo({ center: cc.center, zoom: cc.zoom, bearing: cc.bearing, pitch: cc.pitch });
  }, c);

/** Build a map step fn that eases between two camera states, optionally holding
 *  the last `holdFrames` frames dead still (used for the engineered silences). */
function mapMove(a, b, ease = E.inOutCubic, holdFrames = 0) {
  return async ({ page, i, frames }) => {
    const moving = frames - holdFrames;
    const p = holdFrames ? E.clamp01(i / (moving - 1)) : E.clamp01(i / (frames - 1));
    const k = ease(p);
    await jump(page, {
      center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
      zoom: lerp(a.zoom, b.zoom, k),
      bearing: lerp(a.bearing ?? 0, b.bearing ?? 0, k),
      pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, k),
    });
  };
}

const mapPrewarm =
  (a, b, n = 7) =>
  async ({ page }) => {
    for (let s = 0; s <= n; s++) {
      const k = s / n;
      await jump(page, {
        center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
        zoom: lerp(a.zoom, b.zoom, k),
        bearing: lerp(a.bearing ?? 0, b.bearing ?? 0, k),
        pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, k),
      });
      await page.waitForTimeout(700);
    }
  };

/** Page shot: ease the document camera between two (y, zoom) states. */
function pageMove(
  sel,
  nth,
  z0,
  z1,
  bias0,
  bias1,
  ease = E.inOutSine,
  holdFrames = 0,
  { anchor = 'centre', dx0 = 0, dx1 = 0 } = {},
) {
  return {
    setup: async ({ page }) => {
      await prep(page);
      page.__box = null;
    },
    step: async ({ page, i, frames }) => {
      if (!page.__box) page.__box = await measure(page, sel, nth);
      const b = page.__box;
      if (!b) throw new Error(`framing target not found: ${sel}`);
      const moving = holdFrames ? frames - holdFrames : frames;
      const k = ease(E.clamp01(i / (moving - 1)));
      const z = lerp(z0, z1, k);
      const off = lerp(bias0, bias1, k);
      // 'top' pins a doc offset from the element's top edge to the top of frame;
      // used for elements taller than the viewport (a reference list, a wall).
      const y = anchor === 'top' ? Math.round(b.top + off) : centreOn(b, z, 1920, off);
      await cam(page, y, z, lerp(dx0, dx1, k));
    },
  };
}

// ---------------------------------------------------------------------------
// Camera keyframes. Washington DC holds 1,192 records, the densest cluster in
// the archive, so the descent lands there and O Street Market (7th & O NW) is
// the pin it opens.
// ---------------------------------------------------------------------------
const NAT = { center: [-97.4, 38.95], zoom: 4.26, pitch: 0, bearing: 0 };
const NAT2 = { center: [-95.1, 38.8], zoom: 4.46, pitch: 0, bearing: 0 };
const MIDW = { center: [-88.0, 38.4], zoom: 5.05, pitch: 6, bearing: -2 };
const APPAL = { center: [-82.4, 38.1], zoom: 5.8, pitch: 18, bearing: -5 };
const MDVA = { center: [-79.0, 38.62], zoom: 6.7, pitch: 24, bearing: -3 };
const DCREG = { center: [-77.55, 38.88], zoom: 8.6, pitch: 34, bearing: 3 };
const DCMET = { center: [-77.2, 38.9], zoom: 9.9, pitch: 38, bearing: 2 };
const OST = { center: [-77.0216, 38.9086], zoom: 12.6, pitch: 48, bearing: 0 };

// Every located record in the release as its own point: no clustering. The
// client wanted the closing map to show the sheer volume of the archive, and the
// product's cluster bubbles ("481") compress 4,206 places into a few dozen
// numbers. Points use the product's pin ink and accent.
import fs from 'node:fs';
const ALL_RECORDS = JSON.parse(
  fs.readFileSync(new URL('../assets/all-records.geojson', import.meta.url)),
);
export async function showEveryRecord({ page }) {
  await page.evaluate((data) => {
    const m = window.__bpMapStage;
    for (const l of m.getStyle().layers)
      if (
        /^explore-(clusters|cluster-count|point|point-halo|point-event-glyph)(-incoming)?$/.test(
          l.id,
        )
      )
        m.setLayoutProperty(l.id, 'visibility', 'none');
    // Quiet the state shading so the records, not the choropleth, carry the frame.
    for (const id of [
      'explore-state-density-fill',
      'explore-state-density-fill-incoming',
      'explore-county-choropleth-fill',
    ])
      if (m.getLayer(id)) m.setPaintProperty(id, 'fill-opacity', 0.28);
    if (!m.getSource('bs-all')) m.addSource('bs-all', { type: 'geojson', data, cluster: false });
    const r = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], 4, a, 12, b];
    m.addLayer({
      id: 'bs-all-glow',
      type: 'circle',
      source: 'bs-all',
      paint: {
        'circle-radius': r(7, 18),
        'circle-color': '#f0a060',
        'circle-opacity': 0.3,
        'circle-blur': 1,
      },
    });
    m.addLayer({
      id: 'bs-all-dot',
      type: 'circle',
      source: 'bs-all',
      paint: {
        'circle-radius': r(2.2, 6),
        'circle-color': '#fff1dc',
        'circle-opacity': 0.95,
        'circle-stroke-color': '#e08a3c',
        'circle-stroke-width': r(0.8, 1.6),
      },
    });
  }, ALL_RECORDS);
  await page.evaluate(
    () =>
      new Promise((r) => {
        const m = window.__bpMapStage;
        m.once('idle', r);
        m.triggerRepaint();
        setTimeout(r, 6000);
      }),
  );
}

export const SHOTS = [
  // ---- I. curiosity: the country, already moving -------------------------
  {
    name: 'map-a',
    in: 0,
    out: 206,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — national map',
    action: 'National frame drifting east, accelerating into the first hit',
    audio: 'cold open; first vocal 0.368; HIT 1.997',
    prewarm: mapPrewarm(NAT, NAT2),
    step: mapMove(NAT, NAT2, E.inQuad),
  },

  // ---- II. discovery: descend, and stop dead in each engineered silence ---
  {
    name: 'map-b',
    in: 206,
    out: 384,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — national to Appalachian region',
    action: 'Hard descent on the 3.440 hit, holding still through the 5.637 silence',
    audio: 'HIT 3.440 (0.749); GAP 5.637-6.330 held',
    prewarm: mapPrewarm(NAT2, APPAL),
    step: mapMove(NAT2, APPAL, E.outQuart, 46),
  },

  {
    name: 'map-c',
    in: 384,
    out: 567,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — region to DC approach',
    action: 'Second descent, tilting in; holds through the 8.613 silence',
    audio: 'HIT 6.405 (0.788); GAP 8.613-9.296 held',
    prewarm: mapPrewarm(APPAL, DCREG),
    step: mapMove(APPAL, DCREG, E.outQuart, 51),
  },

  {
    name: 'map-d',
    in: 567,
    out: 741,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — DC metro to O Street Market',
    action: 'Final descent onto the pin; holds through the 11.595 silence',
    audio: 'HIT 9.459 (0.793); GAP 11.595-12.272 held',
    prewarm: mapPrewarm(DCMET, OST),
    step: mapMove(DCREG, OST, E.outQuart, 46),
  },

  {
    name: 'map-reveal',
    in: 736,
    out: 817,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Door — national to DC',
    action: 'Every pin in the country, then a hard sweep down onto Washington',
    audio: 'HIT 12.368 (0.801)',
    v3only: true,
    prewarm: mapPrewarm(
      { center: [-96.6, 38.8], zoom: 4.24, pitch: 0 },
      { center: [-77.03, 38.9], zoom: 9.6, pitch: 40 },
      6,
    ),
    step: mapMove(
      { center: [-96.6, 38.8], zoom: 4.24, pitch: 0, bearing: 0 },
      { center: [-77.03, 38.9], zoom: 9.6, pitch: 40, bearing: -6 },
      E.inOutExpo,
    ),
  },

  // ---- III. the record ----------------------------------------------------
  {
    name: 'place-title',
    in: 741,
    out: 850,
    url: BASE + '/place/o-street-market',
    surface: 'Place — O Street Market',
    action: 'Record arrives on the hit; easing out of a push',
    audio: 'HIT 12.368 (0.801) — cut from map to record out of silence',
    ...pageMove('text:o street market', 0, 1.085, 1.005, 300, 340, E.outCubic),
  },

  {
    name: 'place-hist',
    in: 850,
    out: 922,
    url: BASE + '/place/o-street-market',
    surface: 'Place — O Street Market',
    action: '"The history here" rising into frame',
    audio: 'VOX 14.184 (sustain 0.94)',
    ...pageMove('text:the history here', 0, 1.0, 1.055, 430, 400, E.inOutSine),
  },

  // ---- IV. four hits in 0.79s: place, place, place -- then what happened ---
  // Three map punches to three different parts of the country, then a match cut
  // from the Tulsa frame to the 1921 postcard of Tulsa burning. Images that need
  // reading cannot survive a 14-frame cut; a map can be read instantly, and the
  // flurry hammers the one idea the product is built on.
  ...[
    [
      'punch-ms',
      922,
      936,
      [-90.18, 32.3],
      9.35,
      10.55,
      -14,
      'HIT 15.379 (0.768) — Jackson, Mississippi',
    ],
    ['punch-atl', 936, 954, [-84.39, 33.75], 9.75, 11.0, 10, 'HIT 15.611 (0.641) — Atlanta'],
    [
      'punch-tulsa',
      954,
      969,
      [-95.99, 36.16],
      9.6,
      10.85,
      -6,
      'HIT 15.915 (0.641) — Tulsa; sets up the match cut',
    ],
  ].map(([name, i0, i1, c, z0, z1, brg, audio]) => ({
    name,
    in: i0,
    out: i1,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Door — city frame',
    action: `Hard punch to ${name.slice(6)}`,
    audio,
    handle: 8,
    // A punch is a fast zoom that brakes hard: outExpo over ~1.2 zoom levels.
    prewarm: mapPrewarm(
      { center: c, zoom: z0, pitch: 34, bearing: brg },
      { center: c, zoom: z1, pitch: 40, bearing: brg },
      3,
    ),
    step: mapMove(
      { center: c, zoom: z0, pitch: 34, bearing: brg },
      { center: c, zoom: z1, pitch: 40, bearing: brg },
      E.outExpo,
    ),
  })),

  {
    requireAlt: 'little africa',
    name: 'tulsa-1921',
    in: 969,
    out: 1010,
    url: BASE + '/stories/the-gap-that-never-closed',
    surface: 'Story — The Gap That Never Closed',
    action:
      'Match cut off the Tulsa map frame: postcard hero, handwritten "TULSA RACE RIOT 6-1-1921"',
    audio: 'HIT 16.173 (0.651) — held 0.68s, long enough to read',
    ...pageMove('alt:little africa', 0, 1.0, 1.065, 28, 58, E.outQuad, 0, { anchor: 'top' }),
  },

  // ---- V. evidence --------------------------------------------------------
  // O Street Market's own evidence block reads "coverage: minimal / not linked
  // yet". True, and on-brand, but it cannot carry the credibility beat. The
  // Count's numbered reference list can: every mark in the text resolves to a
  // primary source (the 1790 census return, Art. I §2, Dred Scott v. Sandford).
  {
    name: 'evidence',
    in: 1010,
    out: 1141,
    url: BASE + '/stories/the-count',
    surface: 'Story — The Count, reference list',
    action: '"Every numbered mark in the text resolves here" — primary-source citations moving up',
    audio: 'VOX 16.853 (1.73s, sustain 0.88)',
    ...pageMove('ol.ds-article-references', 0, 1.3, 1.3, -150, 420, E.inOutSine, 0, {
      anchor: 'top',
      dx0: 38,
      dx1: 38,
    }),
  },

  {
    name: 'trust',
    in: 1141,
    out: 1257,
    url: BASE + '/stories/the-count',
    surface: 'Story — The Count, reference list',
    action: 'Closer on the citations: census, Constitution, Supreme Court',
    audio: 'VOX 19.040 + 19.744',
    ...pageMove('ol.ds-article-references', 0, 1.52, 1.64, 560, 700, E.inOutSine, 0, {
      anchor: 'top',
      dx0: 60,
      dx1: 64,
    }),
  },

  {
    name: 'entity',
    in: 1257,
    out: 1370,
    url: BASE + '/entity/civil-rights-leaders-nathan-mossell',
    surface: 'Entity — Nathan Francis Mossell',
    action: 'Person record: status, history, record file',
    audio: 'VOX 20.976',
    ...pageMove('text:nathan francis mossell', 0, 1.06, 1.0, 300, 620, E.inOutSine),
  },

  // ---- VI. expansion ------------------------------------------------------
  {
    name: 'lives',
    in: 1370,
    out: 1500,
    url: BASE + '/lives',
    surface: 'Lives across the decades',
    action: 'Sweeping down through the decades: 1900s–1930s into 1940s–1960s',
    audio: 'VOX 22.848 (1.93s, sustain 1.95)',
    ...pageMove('text:lives across the decades', 0, 1.0, 1.0, 2700, 5820, E.inOutSine, 0, {
      anchor: 'top',
    }),
  },

  {
    name: 'lives-plate',
    in: 1500,
    out: 1545,
    url: BASE + '/lives',
    surface: 'Lives',
    action: '"Land was something to hold on to"',
    audio: 'VOX 25.024 (0.74 strength — strongest short phrase)',
    requireAlt: 'du bois',
    ...pageMove('alt:du bois', 0, 1.12, 1.2, 0, -10, E.outCubic),
  },

  {
    name: 'data',
    in: 1545,
    out: 1646,
    url: BASE + '/data',
    surface: 'Data',
    action: 'Counted — figures and the decade chart',
    audio: 'VOX 25.776 (1.17s)',
    ...pageMove('text:counted', 0, 1.0, 1.0, 380, 1500, E.inOutSine),
  },

  // ---- VII. scale ---------------------------------------------------------
  {
    name: 'map-wide',
    in: 1631,
    out: 1681,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — national',
    action: 'Snap back to the whole country on the biggest sub of the track',
    audio: 'HIT 27.461 (0.812) + 27.760 (0.831) — largest sub energy in the piece',
    prewarm: mapPrewarm(NAT, { ...NAT, zoom: 4.42 }, 3),
    step: mapMove({ ...NAT, zoom: 4.3 }, { ...NAT, zoom: 4.42 }, E.outQuad),
  },

  // ---- VIII. the Memorial: 14.1s, the breath ------------------------------
  {
    name: 'memorial-a',
    in: 1681,
    out: 2123,
    // The wall layer is placed from scroll position; the document camera leaves
    // scrollY at 0, so it would paint over the list. Excluded from these shots.
    css: '.ds-memorial-wall{display:none!important}',
    url: BASE + '/memorial',
    surface: 'Memorial',
    action: 'Slow drift down the wall of names. No transition, no push.',
    audio: 'VOX 28.051 — 6.13s phrase, 4.18s steady hold, sub absent',
    ...pageMove('text:every name on this memorial', 0, 1.02, 1.02, 380, 2380, E.inOutSine),
  },

  {
    name: 'memorial-b',
    in: 2123,
    out: 2524,
    // The wall layer is placed from scroll position; the document camera leaves
    // scrollY at 0, so it would paint over the list. Excluded from these shots.
    css: '.ds-memorial-wall{display:none!important}',
    url: BASE + '/memorial',
    surface: 'Memorial',
    action: 'A later stretch of the wall; near-imperceptible push-in',
    audio: 'VOX 35.416 — second 6.90s phrase; riser from 39.272',
    ...pageMove('text:j230', 0, 1.015, 1.075, 240, 1540, E.inOutSine),
  },

  // ---- IX. the drop, and back outward -------------------------------------
  {
    requireAlt: 'voting rights act',
    name: 'lbj',
    in: 2529,
    out: 2573,
    url: BASE + '/stories/the-count',
    surface: 'Story — The Count',
    action: 'Voting Rights Act, 6 August 1965',
    audio: 'HIT 42.184 (0.895) — the strongest transient in the track',
    ...pageMove('alt:voting rights act', 0, 1.34, 1.46, 0, 0, E.outQuart),
  },

  {
    name: 'entity-out',
    in: 2573,
    out: 2660,
    url: BASE + '/entity/civil-rights-leaders-nathan-mossell',
    surface: 'Entity — Nathan Francis Mossell',
    action: 'Back to the person, pulling out',
    audio: 'VOX 42.925',
    ...pageMove('text:nathan francis mossell', 0, 1.14, 1.02, 240, 300, E.outCubic),
  },

  {
    name: 'place-out',
    in: 2660,
    out: 2713,
    url: BASE + '/place/o-street-market',
    surface: 'Place — O Street Market',
    action: 'Back to the place',
    audio: 'VOX 44.373 (1.08s, sustain 1.04)',
    ...pageMove('text:o street market', 0, 1.12, 1.02, 300, 320, E.outCubic),
  },

  // Six cuts, each further out than the last: place -> city -> region -> nation.
  ...[
    [
      'map-out1',
      2713,
      2764,
      { center: [-77.03, 38.91], zoom: 11.6, pitch: 44, bearing: -4 },
      { center: [-77.06, 38.92], zoom: 10.7, pitch: 38, bearing: -3 },
      'HIT 45.267 (0.813)',
    ],
    [
      'map-out2',
      2764,
      2793,
      { center: [-77.15, 38.93], zoom: 9.7, pitch: 34, bearing: -2 },
      { center: [-77.25, 38.94], zoom: 9.0, pitch: 30, bearing: -2 },
      'VOX 46.112',
    ],
    [
      'map-out3',
      2793,
      2838,
      { center: [-77.9, 38.85], zoom: 8.0, pitch: 26, bearing: -1 },
      { center: [-78.6, 38.8], zoom: 7.1, pitch: 20, bearing: -1 },
      'VOX 46.600',
    ],
    [
      'map-out4',
      2838,
      2932,
      { center: [-80.5, 38.5], zoom: 6.2, pitch: 15, bearing: 0 },
      { center: [-84.0, 38.2], zoom: 5.3, pitch: 8, bearing: 0 },
      'VOX 47.344 (3.35s)',
    ],
    [
      'map-out5',
      2932,
      3021,
      { center: [-88.5, 38.4], zoom: 4.9, pitch: 4, bearing: 0 },
      { center: [-93.0, 38.7], zoom: 4.52, pitch: 0, bearing: 0 },
      'HIT 48.915 (0.720)',
    ],
    [
      'map-out6',
      3021,
      3074,
      { center: [-96.4, 38.9], zoom: 4.34, pitch: 0, bearing: 0 },
      { center: [-97.4, 38.95], zoom: 4.2, pitch: 0, bearing: 0 },
      'HIT 50.397 (0.842)',
    ],
  ].map(([name, i0, i1, a, b, audio]) => ({
    name,
    in: i0,
    out: i1,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Explore — pulling outward',
    action: `Outward cut ${name.slice(-1)} of 6`,
    audio,
    setup: showEveryRecord,
    prewarm: mapPrewarm(a, b, 3),
    step: mapMove(a, b, E.linear),
  })),

  // ---- X. brand -----------------------------------------------------------
  {
    name: 'brand-bg',
    in: 3062,
    out: 3264,
    url: BASE + '/',
    needsMap: true,
    css: HIDE_CHROME,
    surface: 'Door — national',
    action: 'Map keeps settling while a scrim quiets it under the lockup',
    audio: 'HIT 51.283 (0.886) -> decay to silence at 54.381',
    prewarm: mapPrewarm(
      { center: [-97.4, 38.95], zoom: 4.2 },
      { center: [-97.9, 38.98], zoom: 4.06 },
      3,
    ),
    setup: async ({ page }) => {
      // Scrim in the product's own surface colour (--ds-surface-sunken), so the
      // map recedes into the application's black rather than into a new grey.
      await page.evaluate(() => {
        const d = document.createElement('div');
        d.id = '__scrim';
        d.style.cssText =
          'position:fixed;inset:0;z-index:9999;pointer-events:none;' +
          'background:radial-gradient(ellipse 80% 55% at 50% 47%, rgba(12,11,10,.80) 0%, rgba(12,11,10,.60) 60%, rgba(12,11,10,.72) 100%);opacity:0';
        document.body.appendChild(d);
      });
    },
    step: (() => {
      const move = mapMove(
        { center: [-97.4, 38.95], zoom: 4.2, pitch: 0, bearing: 0 },
        { center: [-97.9, 38.98], zoom: 4.06, pitch: 0, bearing: 0 },
        E.outCubic,
      );
      return async (ctx) => {
        await move(ctx);
        // Scrim lands with the mark (~0.4s), and is fully down by the time the
        // line of type is readable.
        const o = E.outCubic(E.clamp01(ctx.i / 26));
        await ctx.page.evaluate((v) => {
          const d = document.getElementById('__scrim');
          if (d) d.style.opacity = v;
        }, o);
      };
    })(),
  },

  {
    name: 'brand-fg',
    in: 3062,
    out: 3264,
    url: 'file://' + process.cwd() + '/../assets/brand-card.html',
    surface: 'Brand lockup',
    action: 'BlackStory / History, pinned to place. / blackstory.app',
    audio: 'lands on HIT 51.283, settles through the final decay',
    alpha: true,
    handle: 0,
    settleMs: 2500,
    setup: async ({ page }) => {
      await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    },
    step: async ({ page, i, frames }) => {
      const p = E.clamp01(i / (frames - 1));
      // Mark fades up over ~0.42s, rule draws slightly behind it, whole card
      // settles out of a 1.5% push. Nothing moves after ~1.6s: the end is still.
      const fade = E.outCubic(E.clamp01(p / 0.14));
      const rule = E.outQuart(E.clamp01((p - 0.06) / 0.2));
      const settle = E.outQuart(E.clamp01(p / 0.3));
      await page.evaluate(
        ([f, r, s]) => window.__brand(f, r, 1.015 - 0.015 * s, 14 * (1 - s)),
        [fade, rule, settle],
      );
    },
  },
];

export const byName = Object.fromEntries(SHOTS.map((s) => [s.name, s]));
for (const s of SHOTS) s.frames = s.out - s.in;
