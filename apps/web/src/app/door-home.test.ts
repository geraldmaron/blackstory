/**
 * The door is an immersive Journey: scroll snaps chapters and flies the shared map plate.
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

test('DoorImmersive scrolls chapters and drives the shared plate', () => {
  assert.match(immersive, /'use client'/);
  assert.match(immersive, /IntersectionObserver/);
  assert.match(immersive, /resolveDoorFocus/);
  assert.match(immersive, /scrollIntoView/);
  assert.match(immersive, />\s*Begin\s*</);
  assert.match(immersive, /Browse the map/);
  assert.doesNotMatch(immersive, /Filter the map|Enter the map/);
  assert.match(immersive, /How this archive works/);
  assert.match(immersive, /enterBrowse|MAP_BROWSE_ENTER_EVENT/);
  assert.match(immersive, /ds-door__filters/);
  assert.match(immersive, /AtlasLoader/);
  assert.match(immersive, /browseShell/);
  assert.doesNotMatch(immersive, /Stay with the map/);
  // The one persistent plate, never a second MapLibre instance and never the map's story runner.
  assert.match(immersive, /useMapStage\(\)/);
  assert.match(
    immersive,
    /stage\.patchData\(\s*nationalFieldPatch\(sweptPins, \{ densityLevels \}\)/,
  );
  assert.match(immersive, /focus\.camera/);
  assert.doesNotMatch(immersive, /useStoryRunner|from 'maplibre-gl'|new maplibregl/);
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
  // Exit lives on the Door, outside the atlas pointer-events:none stack.
  assert.match(immersive, /ds-door__browse-exit/);
  assert.match(immersive, /Back to journey/);
  assert.match(immersive, /data-browse-chrome/);
  assert.match(css, /\.ds-door__browse-exit/);
  assert.match(css, /z-index:\s*calc\(var\(--ds-z-atlas-instruments\) - 1\)/);
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
  assert.match(immersive, /doorFramePadding\(windowBox, plateBox, chromeBox, bottomChrome\)/);
  assert.match(immersive, /doorFrameOffset\(windowBox, plateBox\)/);
  assert.match(immersive, /openSheetRef/);
  assert.match(immersive, /bottomChrome: onOpen \? boxOf\(openSheetRef\.current\) : null/);
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
  // Resize follows the layout: observe the window, one refit per frame, cut not flight.
  assert.match(immersive, /new ResizeObserver\(refit\)/);
  assert.match(immersive, /window\.addEventListener\('resize', refit\)/);
  assert.match(immersive, /requestAnimationFrame/);
  assert.match(immersive, /stage\.resize\(\);\s*applyCamera\(true\)/);
  assert.match(immersive, /sameDoorFrameBox/);
  // The observer re-firing for the chapter already in view must not restart its flight.
  assert.match(immersive, /if \(chapter\.id === lastChapterIdRef\.current\) return;/);
  // A reload scrolled to a later chapter frames that chapter first, as a cut, not a flight.
  assert.match(
    immersive,
    /useLayoutEffect\(\(\) => \{[\s\S]*chapterInViewFromRects\(rects, window\.innerHeight\)/,
  );
  assert.match(
    immersive,
    /if \(!chapter \|\| chapter\.sweep \|\| chapter\.id === lastChapterIdRef\.current\) return;/,
  );
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
  assert.match(field, /NATIONAL_FIELD_GROUPING = true/);
  assert.match(mapSync, /nationalFieldPatch\(/);
  assert.match(atlas, /nationalFieldPatch\(/);
});

test('immersive CSS uses document snap over a fixed full-bleed plate', () => {
  assert.match(css, /html:has\(\.ds-door\)[\s\S]*scroll-snap-type:\s*y\s+proximity/);
  assert.match(css, /\.ds-door__field[\s\S]*position:\s*fixed/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*pointer-events:\s*none/);
  // Page Sand / copper wash behind the map was the distracting orange field.
  assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
  // Archive material law permits `--ds-contact-*` where a layer overlaps; ban decorative stacks.
  assert.doesNotMatch(
    css.replace(/box-shadow:\s*var\(--ds-contact-[a-z]+\);/g, ''),
    /radial-gradient|linear-gradient|box-shadow|backdrop-filter/,
  );
  // Nested overflow scrollport was the bug: wheel only hit cards. Document scrolls instead.
  assert.doesNotMatch(css, /\.ds-door-journey\s*\{[^}]*overflow-y:\s*auto/);
  // Opening masthead is edge-anchored (ds-door-open), not a centered dialog card.
  assert.match(css, /\.ds-door-open\s*\{/);
  assert.match(css, /ds-door-journey__chapter--rest/);
  // The measured morph slot stays clipped, but display-font ink may paint outside its fractional
  // layout bounds. Cross-browser padding preserves that ink while its negative margin keeps the
  // animated slot's footprint unchanged.
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix\s*\{[^}]*overflow:\s*clip;[^}]*padding-inline:\s*var\(--ds-hero-glyph-bleed\);[^}]*margin-inline:\s*calc\(var\(--ds-hero-glyph-bleed\) \* -1\)/s,
  );
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix-out\s*\{[^}]*left:\s*var\(--ds-hero-glyph-bleed\)/s,
  );
  assert.match(css, /\.ds-door-journey__card[\s\S]*max-height/);
  assert.match(css, /@media \(max-height: 52rem\)/);
  assert.match(css, /\.ds-door__field-chrome[\s\S]*top:\s*var\(--ds-space-4\)/);
  assert.match(css, /\.ds-door__filters[\s\S]*min-height:\s*44px/);
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*\.ds-door__filters[\s\S]*margin-left:\s*0/);
  assert.match(
    css,
    /body:has\(\.ds-door\)\s+\.ds-shell\s*>\s*\.ds-bar[\s\S]*pointer-events:\s*auto/,
  );
  // Mobile chapters are in document flow; nested card scroll would steal the page wheel.
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*max-height:\s*none/);
  // On a phone the window is a band under the bar, sized to the country, that the chapters
  // scroll over; the plate stays fixed full-bleed rather than a sticky strip cards cover.
  assert.match(
    css,
    /@media \(max-width: 899px\)[\s\S]*\.ds-door__window\s*\{[^}]*height:\s*var\(--ds-door-band\)/,
  );
  assert.doesNotMatch(css, /position:\s*sticky/);
  // Every later chapter opens with a band-high gap, so the flown map is seen before its card.
  assert.match(css, /\.ds-door-journey__chapter\s*\{[^}]*padding:\s*var\(--ds-door-band\)/);
  // Below 900px every card is one centered column at a reading width: full width on a phone,
  // centered under the country on a tablet rather than a 480px card against the left edge.
  assert.match(
    css,
    /@media \(max-width: 899px\)[\s\S]*\.ds-door-journey__chapter--center\s*\{\s*justify-items:\s*center/,
  );
  assert.match(css, /\.ds-door-journey__card[\s\S]*width:\s*min\(36rem/);
  // The morph slot stays shrinkable so its animated width directly positions Story.
  assert.doesNotMatch(css, /\.ds-hero-headline-morph__prefix\s*\{[^}]*min-width:\s*max-content/);
  // Opening masthead is edge-anchored low so the map reads as the stage.
  assert.match(css, /\.ds-door-journey__chapter--rest\s*\{[^}]*align-content:\s*end/);
});

test('door-home CSS switches mobile typography and gutters', () => {
  assert.match(css, /ds-door-open__headline[\s\S]*clamp\(/);
  assert.match(css, /var\(--ds-gutter\)/);
});

test('the phone opening card never scrolls inside itself', () => {
  // A capped height with an inner scroller clipped the headline on a 320x568 screen.
  const start = css.indexOf('@media (max-width: 559px) {');
  assert.ok(start >= 0, 'the phone block exists');
  const next = css.indexOf('@media', start + 1);
  const phone = css.slice(start, next === -1 ? undefined : next);
  assert.doesNotMatch(phone, /overflow-y:\s*auto/);
  assert.doesNotMatch(phone, /max-height:\s*calc\(100dvh/);
});

test('the opening masthead names a place through the public pin href', () => {
  assert.match(immersive, /ds-door-open/);
  assert.match(immersive, /ds-door-open__place/);
  // The same pin table a marker click opens, so the link is the canonical place URL.
  assert.match(immersive, /hrefByPinId\.get\(spotlightPinId\)/);
});

test('the opening masthead densifies with invite, kind ledger, and morphing headline', () => {
  assert.match(immersive, /HeroHeadlineMorph/);
  assert.match(immersive, /DOOR_OPEN_INVITE/);
  assert.match(immersive, /ds-door-open__invite/);
  assert.match(immersive, /ds-door-open__ledger/);
  assert.match(immersive, /ds-door-open__ledger-row/);
  assert.match(immersive, /openLedger/);
  assert.match(immersive, /ref=\{openSheetRef\}/);
  assert.match(door, /openLedger=\{openLedger\}/);
  assert.match(door, /KIND_FAMILY_ENTRIES/);
  assert.match(door, /buildOpenLedger/);
  assert.match(css, /\.ds-door-open__invite\s*\{/);
  assert.match(css, /\.ds-door-open__ledger\s*\{/);
  assert.match(css, /\.ds-door-open__ledger-count\s*\{/);
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
  // On a phone the captions hide, but the note must not.
  assert.match(
    css,
    /@media \(max-width: 899px\)[\s\S]*\.ds-door__field-caption\s*\{\s*display:\s*none/,
  );
  assert.doesNotMatch(css, /\.ds-door__field-chrome\s*\{\s*display:\s*none/);
});
