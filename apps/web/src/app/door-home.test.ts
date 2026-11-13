/**
 * The Door: the map uncovered, a headline column, the spotlight as a callout on its pin, and a
 * guided walk whose chapters are one docked card that flies the shared map plate.
 * It is not the Explore instrument (no lens, no rail, no sheet) and it has one map, not two:
 * the plate it drives is the one `MapStage`, handed the same national-field patch Explore rests on.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listPublicEntities } from '../data/public-seed';
import { buildExploreMapSource } from '../lib/map-experience/build-explore-map-source';
import { toDoorLinkPins } from '../lib/map-experience/first-paint-pins';
import { atlasWalkHref } from '../lib/place/public-place-path';

const page = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');
const door = readFileSync(fileURLToPath(new URL('./door-home.tsx', import.meta.url)), 'utf8');
const immersive = readFileSync(
  fileURLToPath(new URL('./door-immersive.tsx', import.meta.url)),
  'utf8',
);
const css = readFileSync(fileURLToPath(new URL('./door-home.css', import.meta.url)), 'utf8');
const walk = readFileSync(fileURLToPath(new URL('./door-walk.tsx', import.meta.url)), 'utf8');

test('`/` mounts DoorImmersive over the shared plate, not the Explore instrument', () => {
  assert.match(page, /DoorHome/);
  assert.doesNotMatch(page, /AtlasHome|AtlasLoader|AtlasExperience/);
  assert.match(door, /DoorImmersive/);
  assert.match(door, /loadDoorPinPlate/);
  assert.match(door, /resolveDoorFocusPinId/);
  assert.match(door, /spotlightPinId/);
  assert.doesNotMatch(door, /catalogFeatures/);
  assert.match(door, /pickStoryChapters/);
  assert.match(door, /pickStoryRecord/);
  assert.doesNotMatch(door, /toDoorLinkPins/);
  assert.doesNotMatch(door, /LivingAtmosphereMosaic|useStoryRunner|AtlasExperience/);
  assert.doesNotMatch(door, /['"`]\/banned-books|['"`]\/journey/);
});

test('the opening is the map, one headline column, one primary action and one quiet link', () => {
  assert.match(immersive, /'use client'/);
  assert.match(immersive, /HeroHeadlineMorph/);
  assert.match(immersive, />\s*Start the walk\s*</);
  assert.match(immersive, /buttonClassName\('primary', 'ds-door-open__start'\)/);
  assert.match(immersive, /buttonClassName\('quiet'\)\}\s*href="\/records"/);
  assert.match(immersive, />\s*Browse all records\s*</);
  // The header carries the one search; the hero form, its button and the extra browse doors go.
  assert.doesNotMatch(immersive, /<form|Search records|Search names/);
  assert.doesNotMatch(immersive, /Browse the map|Browse the list|ds-door__filters/);
  assert.doesNotMatch(immersive, /openLedger|ds-door-open__ledger|records on the map/);
  assert.doesNotMatch(door, /buildOpenLedger|KIND_FAMILY_ENTRIES|placeCount/);
  // The UI does not explain itself: no gesture hints, no invite that describes the buttons.
  assert.doesNotMatch(immersive, /click a pin|shift \+ drag|Begin takes|DOOR_OPEN_INVITE/);
  // The one persistent plate, never a second MapLibre instance and never the map's story runner.
  assert.match(immersive, /useMapStage\(\)/);
  assert.match(
    immersive,
    /stage\.patchData\(\s*nationalFieldPatch\(sweptPins, \{ densityLevels \}\)/,
  );
  assert.match(immersive, /focus\.camera/);
  assert.doesNotMatch(immersive, /useStoryRunner|from 'maplibre-gl'|new maplibregl/);
  assert.match(immersive, /AtlasLoader/);
  assert.match(immersive, /browseShell/);
});

test('the walk is one docked card with progress, Back, Next and a way to the map', () => {
  // A stepper, not a scroll story: no observer, no viewport-height chapters, no snap.
  assert.doesNotMatch(immersive, /IntersectionObserver|useChapterObserver|scrollIntoView/);
  assert.match(immersive, /const goToStep = useCallback/);
  assert.match(immersive, /showChapter\(chapters\[clamped\]!\)/);
  assert.match(immersive, /<DoorWalkCard/);
  assert.match(immersive, /onSkip=\{enterBrowse\}/);
  assert.match(walk, /Skip to the map/);
  assert.match(walk, />\s*Next\s*</);
  assert.match(walk, />\s*Back\s*</);
  // Step 1 has nothing to go back to: Next stands alone and "Skip to the map" is the one exit.
  assert.match(walk, /\{position > 1 \? \(\s*<Button variant="secondary"/);
  // The cite slot carries real citations only, never a note about the interface.
  assert.doesNotMatch(walk, /Drawn from the active release|precision its sources support/);
  assert.match(walk, /\{position\} of \{total\}/);
  assert.match(walk, /aria-current|data-state=\{state\}/);
  // Keyboard: arrows step, Escape returns to the opening.
  assert.match(walk, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Escape/);
  // The closing block links Records, Stories and Data, and hands over the map once.
  assert.match(walk, /href: '\/records'[\s\S]*href: '\/stories'[\s\S]*href: '\/data'/);
  assert.match(walk, /Explore the map/);
  // No kickers, no 01-04 numerals, no copper accent word in the heading.
  assert.doesNotMatch(walk, /kicker|padStart|<em>/);
  // The record chapter shows the record, not a 200-word summary in the prose.
  assert.doesNotMatch(walk, /recordSpotlight\.summary\} It is one pin/);
  assert.match(walk, /ds-door-walk__record-line/);
  assert.match(css, /\.ds-door-walk__record-line\s*\{[^}]*-webkit-line-clamp:\s*3/);
  // The UI never tells the reader to scrub a control the card does not have.
  assert.doesNotMatch(walk, /Scrub/);
  // Focus follows the step the reader chose.
  assert.match(immersive, /walkHeadingRef\.current\)\?\.focus/);
});

test('the spotlight is a callout on its pin, kept inside the uncovered map window', () => {
  assert.match(immersive, /<DoorSpotlightCallout/);
  assert.match(immersive, /frameRef=\{windowRef\}/);
  assert.match(immersive, /active=\{step === 0 && plateState === 'live' && !browseMode\}/);
  // The mark follows the record's stored precision, never sharper (P-03).
  assert.match(immersive, /mark=\{recordMarkFor\(spotlight\.precision\)\}/);
  // The window excludes the dock on every layout, so the callout cannot cover the headline.
  assert.match(
    css,
    /\.ds-door__window\s*\{[^}]*inset:\s*0 0 0 calc\(var\(--ds-door-edge\) \+ var\(--ds-door-dock-w\)/,
  );
  assert.match(css, /\.ds-door__window\s*\{\s*inset:\s*0 0 calc\(var\(--ds-door-dock-h/);
});

test('Door browse morphs in place rather than hard-linking Filter CTAs to /explore', () => {
  assert.match(immersive, /setDoorBrowseLive/);
  assert.match(immersive, /ds-door-journey--browse/);
  assert.match(immersive, /initialBrowse/);
  assert.match(css, /ds-door-journey--browse/);
  assert.match(css, /--ds-door-browse-ms/);
  assert.match(door, /buildAtlasShell/);
  assert.match(door, /browseShell/);
  assert.match(door, /initialBrowse/);
  // No "Back to the walk" pill over the map: the header's Map tab and the browser's Back return.
  assert.doesNotMatch(immersive, /ds-door__browse-exit|Back to home|Back to the walk|canReturn/);
  assert.doesNotMatch(css, /ds-door__browse-exit/);
  // Entering browse moves focus to the map's heading once the instruments mount.
  assert.match(immersive, /browseHeadingRef\.current\?\.focus/);
});

test('clicking a map entity during the journey exits smoothly into browse, not a navigation', () => {
  // repo-vl155.3: the entity 'select' handler used to call `openDoorPin`, which never toggled
  // journey mode off and, for `/door/pin/*` targets, did a hard `window.location.assign` — the
  // most jarring possible exit, and the reported bug ("clicking a map entity should auto toggle
  // journey mode off, smoothly"). It now hands off to the same smooth transition "Browse the
  // map" already gets, carrying the clicked pin's continuity so Explore's own restore effect
  // opens that entity's record sheet once it mounts (see `pin-continuity.ts`), instead of
  // leaving the Door tree entirely.
  assert.doesNotMatch(immersive, /function openDoorPin/);
  assert.doesNotMatch(immersive, /window\.location\.assign\(href\)/);
  assert.match(
    immersive,
    /stage\.subscribe\('select', \(entityId\) => \{[\s\S]*?savePinContinuity\(\{[\s\S]*?enterBrowse\(\);/,
  );
});

test('cold `/explore` mounts the same Door browse shell, not a second instrument', () => {
  const explorePage = readFileSync(
    fileURLToPath(new URL('./explore/page.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(explorePage, /DoorHome/);
  assert.match(explorePage, /initialBrowse/);
  assert.doesNotMatch(explorePage, /AtlasHome/);
  assert.match(immersive, /data-cold=\{initialBrowse/);
  // Cold browse never runs journey framing; still flip `framed` so the field canvas clears.
  assert.match(immersive, /if \(browseModeRef\.current\) \{[\s\S]*?setFramed\(true\)/);
});
test('the Door has one map: no static board, no layout zoom, no pin plate', () => {
  assert.doesNotMatch(immersive, /FirstPaintPinPlate|usePinPhotoHoverAnchor|locatorPinPercent/);
  assert.doesNotMatch(immersive, /ds-door__board|ds-door__ground|focus\.scale|is-zoomed/);
  assert.doesNotMatch(css, /ds-door__board|ds-door__ground|us-locator\.svg|ds-first-paint/);
  assert.doesNotMatch(css, /container-type|aspect-ratio:\s*960/);
  assert.doesNotMatch(immersive, /data-page-ready/);
  assert.doesNotMatch(css, /data-page-ready/);
});

test('the plate is framed against the Door window and re-framed on resize', () => {
  assert.match(immersive, /ds-door__window/);
  assert.match(immersive, /doorFramePadding\(windowBox, plateBox\)/);
  assert.match(immersive, /doorFrameOffset\(windowBox, plateBox\)/);
  // The introduction overlays the map, rather than shrinking it into a strip above the copy.
  assert.doesNotMatch(immersive, /bottomChrome|openSheetRef/);
  // The canvas box comes from MapLibre's own container through the stage handle, never from a
  // class-name query into another component's DOM.
  assert.match(immersive, /boxOf\(map\.getContainer\(\)\)/);
  assert.doesNotMatch(immersive, /querySelector[^\n]*ds-map-stage/);
  // A national chapter is the Atlas's own national preset, fitted inside the window.
  assert.match(immersive, /stage\.flyPreset\(\s*'national',\s*\{ bounds: US_CONUS_BOUNDS \}/);
  assert.match(immersive, /mode: cut \? 'cut' : 'ease'/);
  assert.match(immersive, /pitch: camera\.pitch,\s*bearing: camera\.bearing/);
  // The phone strip is shorter than the country at the Instrument's floor; the fit may sink it.
  assert.match(immersive, /zoomFloor: 'fit'/);
  // The first frame after mount is a cut, so a warm plate is never seen arriving from elsewhere.
  assert.match(immersive, /firstFrameRef = useRef\(true\)/);
  assert.match(immersive, /applyCamera\(firstFrameRef\.current\)/);
  // Resize follows the layout: observe the window, one refit per frame, a cut at rest. A camera
  // already moving is re-aimed, not cut: a phone's toolbar fires `resize` on the same swipe that
  // starts a chapter flight, and cutting there jumped the map to the flight's end.
  assert.match(immersive, /new ResizeObserver\(refit\)/);
  assert.match(immersive, /window\.addEventListener\('resize', refit\)/);
  assert.match(immersive, /requestAnimationFrame/);
  assert.match(
    immersive,
    // Each skipped comment line must end at its own newline, so the match has one parse
    // (an open `[^\n]*` repeated would let a run of `//` split exponentially many ways).
    /stage\.resize\(\);(?:\s*\/\/[^\n]*\n)*\s*applyCamera\(!map\.isMoving\(\)\)/,
  );
  assert.match(immersive, /sameDoorFrameBox/);
  // Re-showing the chapter already on the plate must not restart its flight.
  assert.match(immersive, /if \(chapter\.id === lastChapterIdRef\.current\) return;/);
});

test('the reveal waits for both the plate and this mount, and never gates on a stale attribute', () => {
  // This mount's own signal, stamped only after its first frame has landed.
  assert.match(immersive, /data-plate=\{plateState\}/);
  assert.match(immersive, /plateUnavailable \? 'unavailable' : framed \? 'live' : 'pending'/);
  assert.match(
    css,
    /body:has\(\.ds-map-stage\[data-plate-ready\]\) \.ds-door__field\[data-plate='live'\]\s*\{[^}]*background:\s*transparent/,
  );
  assert.match(css, /\.ds-door__field\s*\{[^}]*background:\s*var\(--ds-canvas\)/);
  assert.match(
    css,
    /\.ds-door__field\s*\{[^}]*transition:\s*background-color var\(--ds-duration-base\)/,
  );
});

test('the sweep chapter clears the plate first, then fills it cumulatively', () => {
  // Chapter 5 is "watch the record fill": an empty country, held, then four centuries arriving
  // on it. A sweep that opened on the first decade with every other pin still up would be a
  // histogram scrub, not a fill.
  assert.match(immersive, /onClear: \(\) => setSweepDecade\(decadeRange\.from - 10\)/);
  assert.match(immersive, /clearHoldMs:/);
  assert.match(immersive, /onDecade: setSweepDecade/);
  // Cumulative, not a one-decade window: a record enters at its earliest decade and stays.
  assert.match(immersive, /decade !== null && decade <= sweepDecade/);
  // The whole archive comes back when the sweep lands, undated records included.
  assert.match(immersive, /onDone: \(\) => setSweepDecade\(null\)/);
  // The clearing frame crossdissolves; removing pins from the source is otherwise instant.
  assert.match(immersive, /clearingPlateRef\.current \? \{ fade: true \} : undefined/);
});

test('the Door and Explore rest on one national-field patch', () => {
  const field = readFileSync(
    fileURLToPath(new URL('../lib/map-experience/national-field.ts', import.meta.url)),
    'utf8',
  );
  const mapSync = readFileSync(
    fileURLToPath(new URL('./explore/hooks/use-map-sync.ts', import.meta.url)),
    'utf8',
  );
  const atlas = readFileSync(
    fileURLToPath(new URL('./explore/AtlasExperience.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(field, /clusteringEnabled: true,/);
  // The Door hands the plate the patch directly; Explore through its one map-sync hook.
  assert.match(immersive, /nationalFieldPatch\(/);
  assert.match(mapSync, /nationalFieldPatch\(/);
  assert.match(atlas, /useMapSync\(/);
  assert.doesNotMatch(atlas, /patchData\(/);
});

test('door CSS keeps one fixed full-bleed plate under a fixed dock, with no page scroll', () => {
  assert.doesNotMatch(css, /scroll-snap/);
  assert.match(css, /\.ds-door__field[\s\S]*position:\s*fixed/);
  assert.match(css, /\.ds-door__dock\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*pointer-events:\s*none/);
  // No viewport-height chapters: the dead space between cards is gone.
  assert.doesNotMatch(css, /ds-door-journey__chapter|ds-door-journey__card/);
  assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
  // Flat material: the contact shadow on floating layers only, no glass or glow. The only
  // gradients are the scrim under the headline column and the fade on a walk body with more below.
  const scrimFree = css
    .replace(/\.ds-door-journey::before\s*\{[^}]*\}/g, '')
    .replace(/\.ds-door-walk__body\[data-more='true'\]\s*\{[^}]*\}/g, '');
  assert.doesNotMatch(
    scrimFree.replace(/box-shadow:\s*var\(--ds-contact-[a-z]+\);/g, ''),
    /radial-gradient|linear-gradient|box-shadow:\s*0 0 [1-9]|backdrop-filter/,
  );
  // The scrim is opaque under the text, so no group ghosts through the headline.
  assert.match(
    css,
    /\.ds-door-journey::before\s*\{[^}]*linear-gradient\(to right, var\(--ds-canvas\) 55%, transparent\)/,
  );
  // Radii are 8 / 14 only here: no pills, and uppercase mono stays on data.
  assert.doesNotMatch(css, /--ds-radius-full|999px|text-transform:\s*uppercase(?![^}]*ds-hero)/);
  // The column shares the header's left edge (the wide container) and sits 48px off the bottom.
  assert.match(
    css,
    /--ds-door-edge:\s*max\(var\(--ds-gutter\), calc\(\(100vw - var\(--ds-width-wide\)\) \/ 2\)\)/,
  );
  assert.match(css, /--ds-door-bottom:\s*var\(--ds-space-12\)/);
  // A long chapter scrolls inside the card's body; progress and controls stay pinned.
  assert.match(css, /\.ds-door-walk__body\s*\{[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto/);
  assert.match(walk, /className="ds-door-walk__body"/);
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix\s*\{[^}]*overflow:\s*clip;[^}]*padding-inline:\s*var\(--ds-hero-glyph-bleed\);[^}]*margin-inline:\s*calc\(var\(--ds-hero-glyph-bleed\) \* -1\)/s,
  );
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix-out\s*\{[^}]*left:\s*var\(--ds-hero-glyph-bleed\)/s,
  );
  assert.doesNotMatch(css, /\.ds-hero-headline-morph__prefix\s*\{[^}]*min-width:\s*max-content/);
  assert.match(
    css,
    /body:has\(\.ds-door\)\s+\.ds-shell\s*>\s*\.ds-bar[\s\S]*pointer-events:\s*auto/,
  );
  // Stacked (phone or portrait): the dock sits above the tab bar and the window above the dock.
  assert.match(
    css,
    /@media \(max-width: 47\.9375rem\), \(max-aspect-ratio: 1\/1\)[\s\S]*\.ds-door__dock\s*\{[^}]*bottom:\s*calc\(var\(--ds-tabbar-h\)/,
  );
  // The attribution, a license obligation, is one collapsed 44px "i" in the window's
  // bottom-right corner, not a box of links on the map.
  assert.doesNotMatch(css, /--ds-map-attrib-left:|--ds-map-attrib-bottom:/);
  assert.match(css, /\.maplibregl-ctrl-bottom-left\s*\{[^}]*right:\s*var\(--ds-space-4\)/);
  assert.match(css, /\.maplibregl-ctrl-attrib-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/);
  // Labels, tags and groups come from the shared style only: no private label layer set.
  assert.doesNotMatch(immersive, /door-plate-labels|addLayer\(/);
});

test('door-home CSS steps the headline down on a phone', () => {
  assert.match(css, /ds-door-open__headline[\s\S]*clamp\(/);
  assert.match(
    css,
    /@media \(max-width: 47\.9375rem\)[\s\S]*\.ds-door-open__headline\s*\{\s*font-size:\s*clamp\(/,
  );
});

test('DoorImmersive hands every record to the plate', () => {
  assert.match(immersive, /spotlightPinId/);
  assert.doesNotMatch(immersive, /catalogFeatures/);
  assert.doesNotMatch(immersive, /resolveDoorFocusPinId/);
  assert.doesNotMatch(immersive, /thinDoorNationalPins/);
  assert.doesNotMatch(immersive, /ds-first-paint-plate--door-mobile/);
});

test('Door pins carry a public href for every record, and never an entity id', () => {
  const features = buildExploreMapSource(listPublicEntities()).featureCollection.features;
  const pins = toDoorLinkPins(features);
  // A marker click on the plate opens `hrefByPinId`; every pin has somewhere to go.
  const linkPins = pins.features.filter((feature) => feature.properties.href.length > 0);
  assert.equal(linkPins.length, pins.features.length);
  assert.ok(pins.features.every((feature) => !feature.properties.href.startsWith('/entity/')));
  assert.ok(pins.features.some((feature) => feature.properties.holdingWalk === true));
  assert.equal(
    atlasWalkHref({
      displayName: 'Dillard High School, Old',
      kind: 'place',
      entityId: 'nrhp-black-heritage-91000107',
    }),
    '/place/dillard-high-school-old',
  );
});

test('a reader without a plate is told so, where the map would be, and sent to the index', () => {
  // No WebGL: the field says so instead of captioning pins that are not there.
  assert.match(
    immersive,
    /plateUnavailable \? \([\s\S]*ds-door__field-note[\s\S]*href="\/records"/,
  );
  assert.doesNotMatch(immersive, /ds-door__field-fallback/);
  // The server-rendered fallback remains useful when JavaScript is unavailable.
  assert.match(door, /<DoorNoscript view=\{noscriptView\}/);
  const noscript = readFileSync(
    fileURLToPath(new URL('./door-noscript.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(
    noscript,
    /<noscript>[\s\S]*ds-door__noscript[\s\S]*href="\/records"[\s\S]*<\/noscript>/,
  );
  assert.match(css, /\.ds-door__field-note,\s*\.ds-door__noscript\s*\{/);
});
