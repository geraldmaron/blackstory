/**
 * The door is an immersive Journey: scroll snaps chapters and flies the shared map plate.
 * It is not the Explore instrument (no lens, no rail, no sheet) and it has one map, not two:
 * the plate it drives is the one `MapStage`, handed the same national-field patch Explore rests
 * on. The static Albers board that used to sit under the plate is gone (repo-18ma2).
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
  assert.match(immersive, /Open Explore/);
  // The one persistent plate, never a second MapLibre instance and never the map's story runner.
  assert.match(immersive, /useMapStage\(\)/);
  assert.match(
    immersive,
    /stage\.patchData\(\s*nationalFieldPatch\(sweptPins, \{ densityLevels \}\)/,
  );
  assert.match(immersive, /focus\.camera/);
  assert.doesNotMatch(immersive, /useStoryRunner|from 'maplibre-gl'|new maplibregl/);
});

test('the Door has one map: no static board, no layout zoom, no pin plate (repo-18ma2)', () => {
  assert.doesNotMatch(immersive, /FirstPaintPinPlate|usePinPhotoHoverAnchor|locatorPinPercent/);
  assert.doesNotMatch(immersive, /ds-door__board|ds-door__ground|focus\.scale|is-zoomed/);
  assert.doesNotMatch(css, /ds-door__board|ds-door__ground|us-locator\.svg|ds-first-paint/);
  assert.doesNotMatch(css, /container-type|aspect-ratio:\s*960/);
  assert.doesNotMatch(immersive, /data-page-ready/);
  assert.doesNotMatch(css, /data-page-ready/);
});

test('the plate is framed against the Door window and re-framed on resize', () => {
  assert.match(immersive, /ds-door__window/);
  assert.match(immersive, /doorFramePadding\(windowBox, plateBox, chromeBox\)/);
  assert.match(immersive, /doorFrameOffset\(windowBox, plateBox\)/);
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
  assert.doesNotMatch(css, /radial-gradient|linear-gradient|box-shadow|backdrop-filter/);
  // Nested overflow scrollport was the bug: wheel only hit cards. Document scrolls instead.
  assert.doesNotMatch(css, /\.ds-door-journey\s*\{[^}]*overflow-y:\s*auto/);
  // Opening invitation card stays vertically centered in the viewport chapter.
  assert.match(
    css,
    /\.ds-door-journey__chapter--center\.ds-door-journey__chapter--rest[\s\S]*align-content:\s*center/,
  );
  assert.match(css, /ds-door-journey__chapter--rest/);
  assert.match(
    css,
    /\.ds-door-journey__chapter--rest \.ds-door-journey__card[\s\S]*max-height:\s*min\(31rem/,
  );
  assert.match(css, /@media \(max-height: 52rem\)/);
  assert.match(css, /\.ds-door__field-chrome[\s\S]*top:\s*var\(--ds-space-4\)/);
  assert.match(
    css,
    /body:has\(\.ds-door\)\s+\.ds-shell\s*>\s*\.ds-bar[\s\S]*pointer-events:\s*auto/,
  );
  // Mobile chapters are in document flow; nested card scroll would steal the page wheel.
  assert.match(css, /@media \(max-width: 899px\)[\s\S]*max-height:\s*none/);
  // On a phone the strip is the window; the camera frames the country inside its padding.
  assert.match(
    css,
    /@media \(max-width: 899px\)[\s\S]*\.ds-door__window\s*\{[^}]*position:\s*relative/,
  );
});

test('door-home CSS switches mobile typography and gutters', () => {
  assert.match(css, /ds-door-journey__cold[\s\S]*clamp\(/);
  assert.match(css, /var\(--ds-gutter\)/);
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
  // No JavaScript: the server component says so above the chapters.
  assert.match(
    door,
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
