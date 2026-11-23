/**
 * The Door: the map uncovered, a column that leads with one real record (name, plate, one claim),
 * a callout on its pin, and a walk that is the decade histogram, one docked card over the shared
 * map plate.
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
const shellCss = readFileSync(fileURLToPath(new URL('./shell.css', import.meta.url)), 'utf8');
const walk = readFileSync(fileURLToPath(new URL('./door-walk.tsx', import.meta.url)), 'utf8');
const tourSection = readFileSync(
  fileURLToPath(new URL('./door-tour-section.tsx', import.meta.url)),
  'utf8',
);
const tourScroll = readFileSync(
  fileURLToPath(new URL('./door-tour-scroll.tsx', import.meta.url)),
  'utf8',
);
const tourCss = readFileSync(fileURLToPath(new URL('./door-tour.css', import.meta.url)), 'utf8');
const records = readFileSync(
  fileURLToPath(new URL('./door-decade-walk.ts', import.meta.url)),
  'utf8',
);
const block = readFileSync(
  fileURLToPath(new URL('./door-record-block.tsx', import.meta.url)),
  'utf8',
);
const chaptersTsx = readFileSync(
  fileURLToPath(new URL('./door-chapters.tsx', import.meta.url)),
  'utf8',
);

test('`/` mounts DoorImmersive over the shared plate, not the Explore instrument', () => {
  assert.match(page, /home\/home-page/);
  assert.doesNotMatch(page, /AtlasHome|AtlasLoader|AtlasExperience/);
  assert.match(door, /DoorImmersive/);
  assert.match(door, /loadDoorPinPlate/);
  assert.match(door, /resolveDoorFocusPinId/);
  assert.doesNotMatch(door, /catalogFeatures/);
  assert.match(door, /doorRecords\(features, entities\)/);
  assert.match(door, /pickDoorOpening/);
  assert.match(door, /pickDecadeStops/);
  assert.doesNotMatch(door, /toDoorLinkPins/);
  assert.doesNotMatch(door, /LivingAtmosphereMosaic|useStoryRunner|AtlasExperience/);
  assert.doesNotMatch(door, /['"`]\/banned-books|['"`]\/journey/);
});

test('the opening is the map, one headline column, one primary action and one secondary', () => {
  assert.match(immersive, /'use client'/);
  assert.match(immersive, /HeroHeadlineMorph/);
  assert.match(immersive, />\s*Walk the decades\s*</);
  // The one primary action reads the lead story; the walk is the secondary one.
  assert.match(immersive, /buttonClassName\('primary', 'ds-door-open__story'\)/);
  // Sentence case, a normal-size button; the story is named in the meta line above it.
  assert.match(immersive, />\s*Read the chapter\s*</);
  assert.match(immersive, /className="ds-door-open__lead"/);
  assert.match(css, /\.ds-door-open__cta > \*\s*\{[^}]*width:\s*auto/);
  assert.match(immersive, /buttonClassName\('secondary', 'ds-door-open__start'\)/);
  // One scene: the header's Records tab is the way to the list, and the tour's cue is the way
  // down, so the opening carries neither a browse link nor a "below the map" link.
  assert.doesNotMatch(immersive, /Browse all records|ds-door-open__(browse-link|next|actions)/);
  assert.doesNotMatch(css, /ds-door-open__(browse-link|next|actions|spotlight|another)/);
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
    /stage\.patchData\(\s*nationalFieldPatch\(sweptPins, \{ densityLevels, satellite: tourImagery \}\)/,
  );
  assert.doesNotMatch(immersive, /useStoryRunner|from 'maplibre-gl'|new maplibregl/);
  assert.match(immersive, /AtlasLoader/);
  assert.match(immersive, /browseShell/);
});

test('the walk is the decade histogram: one docked card with Back, Next and a way to the map', () => {
  // A stepper, not a scroll story: no observer, no viewport-height chapters, no snap.
  assert.doesNotMatch(immersive, /IntersectionObserver|useChapterObserver|scrollIntoView/);
  assert.match(immersive, /const goToStep = useCallback/);
  assert.match(immersive, /<DoorWalkCard/);
  assert.match(immersive, /onSkip=\{enterBrowse\}/);
  assert.match(walk, /Skip to the map/);
  assert.match(walk, />\s*Next decade\s*</);
  assert.match(walk, />\s*Back\s*</);
  assert.match(walk, /\{position\} of \{total\}/);
  // The histogram is the progress: walked decades, the current one, the ones ahead.
  assert.match(walk, /'current'\s*: bar\.year < record\.decade\s*\? 'walked'\s*: 'ahead'/);
  // ...and the control: a native range input over the bars, named, with the decade as its value.
  assert.match(
    walk,
    /type="range"[\s\S]*step=\{10\}[\s\S]*aria-label="Decade"[\s\S]*aria-valuetext=/,
  );
  assert.match(css, /\.ds-door-walk__scrub\s*\{[^}]*height:\s*max\(44px/);
  // The histogram keeps its prose caption.
  assert.match(walk, /<figcaption className="ds-door-walk__caption">\{caption\}<\/figcaption>/);
  // Each decade shows one record the way its record page does.
  assert.match(walk, /<DoorRecordBlock record=\{record\}/);
  // Keyboard: arrows step, Escape returns to the opening; the slider keeps its own arrows.
  assert.match(walk, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Escape/);
  assert.match(walk, /event\.target instanceof HTMLInputElement/);
  assert.match(walk, /Explore the map/);
  // No kickers, no 01-04 numerals, no copper accent word in the heading.
  assert.doesNotMatch(walk, /kicker|padStart|<em>/);
  // Focus follows the step the reader chose.
  assert.match(immersive, /walkHeadingRef\.current\)\?\.focus/);
});

test('the spotlight is a callout on its pin, kept inside the uncovered map window', () => {
  assert.match(immersive, /<DoorSpotlightCallout/);
  assert.match(immersive, /frameRef=\{windowRef\}/);
  // The callout follows the record on screen: the opening's, then each decade's.
  assert.match(immersive, /active=\{plateState === 'live' && !browseMode\}/);
  assert.match(immersive, /lngLat=\{current\.lngLat\}/);
  // The mark follows the record's stored precision, never sharper (P-03).
  assert.match(immersive, /mark=\{recordMarkFor\(current\.precision\)\}/);
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
  // The introduction overlays the map, rather than shrinking it into a strip above the copy.
  assert.doesNotMatch(immersive, /bottomChrome|openSheetRef/);
  // The canvas box comes from MapLibre's own container through the stage handle, never from a
  // class-name query into another component's DOM.
  assert.match(immersive, /boxOf\(map\.getContainer\(\)\)/);
  assert.doesNotMatch(immersive, /querySelector[^\n]*ds-map-stage/);
  // The walk holds the country: the Atlas's own national preset, fitted inside the window.
  assert.match(immersive, /stage\.flyPreset\(\s*'national',\s*\{ bounds: US_CONUS_BOUNDS \}/);
  assert.match(immersive, /mode: cut \? 'cut' : 'ease'/);
  assert.match(immersive, /pitch: 0,\s*bearing: 0/);
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

test('the walk fills the map cumulatively, decade by decade', () => {
  // A record enters at its earliest decade and stays; the opening shows the whole archive.
  assert.match(immersive, /const shownDecade = step === 0 \? null/);
  assert.match(immersive, /decade !== null && decade <= shownDecade/);
  // The map never flies between decades: it fills.
  assert.doesNotMatch(immersive, /map\.flyTo|CHAPTER_FLIGHT_MS|sweep\(/);
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

test('door CSS keeps one fixed full-bleed plate under a fixed dock; the chapters scroll over it', () => {
  assert.doesNotMatch(css, /scroll-snap/);
  assert.match(css, /\.ds-door__field[\s\S]*position:\s*fixed/);
  assert.match(css, /\.ds-door__dock\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*position:\s*absolute/);
  assert.match(css, /\.ds-door__window\s*\{[^}]*pointer-events:\s*none/);
  // No viewport-height chapters: the dead space between cards is gone.
  assert.doesNotMatch(css, /ds-door-journey__chapter|ds-door-journey__card/);
  assert.doesNotMatch(css, /mix-blend-mode:\s*multiply/);
  // Living archive (owner lifted the flat-material bans, 2026-11-15): depth comes from offset
  // shadows and lamplight, never a zero-offset halo.
  assert.doesNotMatch(css, /box-shadow:\s*0 0 [1-9]/);
  // No generated imagery anywhere (owner decision 2026-11-15): the drawn street and its scene
  // layer are gone, and the only image on the opening is a record's own photograph as a plate.
  assert.doesNotMatch(css + immersive, /ds-door__scene|hero-places|components\/art/);
  // The opening is a solid column in the table's ground beside the map, not glass over it, so
  // nothing ghosts through the headline.
  assert.doesNotMatch(css, /\.ds-door-journey::before/);
  assert.doesNotMatch(immersive, /ds-door-open ds-float/);
  assert.match(
    css,
    /\.ds-door-open,\s*\.ds-door-walk \{[^}]*padding:[^}]*border-radius: var\(--ds-radius-md\);[^}]*background: var\(--ds-canvas\)/,
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
  // The headline morph keeps its letter-slot animation (owner, binding): the prefix rolls in a
  // clipped slot. Reduced motion shows the settled words, and only then.
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix\s*\{[^}]*overflow:\s*clip;[^}]*padding-inline:\s*var\(--ds-hero-glyph-bleed\);[^}]*margin-inline:\s*calc\(var\(--ds-hero-glyph-bleed\) \* -1\)/s,
  );
  assert.match(
    css,
    /\.ds-hero-headline-morph__prefix-out\s*\{[^}]*left:\s*var\(--ds-hero-glyph-bleed\)/s,
  );
  assert.match(css, /\.ds-hero-headline-morph__static\s*\{\s*display:\s*none/);
  assert.match(
    css,
    /prefers-reduced-motion: reduce\)\s*\{\s*\.ds-hero-headline-morph__static\s*\{\s*display:\s*inline/,
  );
  // A phone leads with the headline and one story; the map window is below the column.
  assert.match(
    css,
    /\.ds-door__dock\[data-step='open'\]\s*\{[^}]*top:\s*calc\(var\(--ds-island-clearance\)/,
  );
  // Something on the opening screen says the page goes on: the tour's cue, a link to its first
  // stop, at the foot of the first screen.
  assert.match(tourSection, /className="ds-door-tour__cue" href=\{`#\$\{steps\[0\]!\.id\}`\}/);
  assert.match(tourCss, /\.ds-door-tour__cue\s*\{[^}]*bottom:\s*100%/);
  assert.doesNotMatch(css, /\.ds-hero-headline-morph__prefix\s*\{[^}]*min-width:\s*max-content/);
  assert.match(css, /\.ds-map-callout__card,[\s\S]*visibility:\s*hidden !important/);
  assert.match(
    css,
    /body:has\(\.ds-door\)\s+\.ds-shell\s*>\s*\.ds-bar[\s\S]*pointer-events:\s*auto/,
  );
  // Stacked (phone or portrait): the dock sits above the tab bar and the window above the dock.
  assert.match(
    css,
    /@media \(max-width: 47\.9375rem\), \(max-width: 63\.9375rem\) and \(max-aspect-ratio: 1\/1\)[\s\S]*\.ds-door__dock\s*\{[^}]*bottom:\s*calc\(var\(--ds-tabbar-h\)/,
  );
  // The attribution, a license obligation, is one collapsed 44px "i" in the window's
  // bottom-right corner, not a box of links on the map.
  assert.doesNotMatch(css, /--ds-map-attrib-left:|--ds-map-attrib-bottom:/);
  assert.match(css, /\.maplibregl-ctrl-bottom-left\s*\{[^}]*right:\s*var\(--ds-space-4\)/);
  // The 44px "i" is the shared chip's rule (shell.css), not a Door override.
  assert.match(
    shellCss,
    /\.maplibregl-ctrl-attrib-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/,
  );
  // Labels, tags and groups come from the shared style only: no private label layer set.
  assert.doesNotMatch(immersive, /door-plate-labels|addLayer\(/);
});

test('the opening is Orbit: the ways in and what the lights mean, no record block', () => {
  // v11: the opening is the headline and its actions over the globe. The record the plate points
  // at is named by the callout on the map, not shown as a block in the column.
  assert.doesNotMatch(immersive, /<DoorRecordBlock/);
  assert.doesNotMatch(immersive, />\s*Another record\s*</);
  assert.ok(immersive.indexOf('<HeroHeadlineMorph') < immersive.indexOf('ds-door-open__coverage'));
  // Unlit ground reads as "nothing happened there", so the legend says what a light is.
  assert.match(
    immersive,
    /Every light is a record that’s made it in so far\. Where the country’s dark,\s+nobody’s\s+gotten there yet\./,
  );
  // A globe shows every continent dark; the legend and the opening line say the map is the country.
  assert.match(immersive, /Outside the United States, almost nothing is on this\s+map\./);
  assert.match(immersive, /DOOR_OPEN_LINE =\s+'[^']*across the United States/);
  // The record is still pinned for the browser session, guarded.
  assert.match(immersive, /sessionStorage\.getItem\(OPENING_STORAGE_KEY\)/);
  // The record block itself is unchanged where the tour uses it.
  assert.match(block, /<RecordImage[\s\S]*image=\{record\.plate\}[\s\S]*plate/);
  assert.match(block, /<EvidenceList items=\{\[record\.claim\]\} \/>/);
  // Quiet records never come up on home, and a rendering is never shown as a plate.
  assert.match(records, /if \(!entity \|\| isQuietRecord\(entity\)\) continue;/);
  assert.match(records, /!isRenderedImage\(entity\.primaryImage\)/);
  // A disputed or retracted claim stays on the record page, beside its note.
  assert.match(records, /!card\.dispute\?\.hasDispute && !card\.retraction/);
});

test('below the fold: no count-up, no card rows, no grade letters in boxes, no lamplight', () => {
  assert.doesNotMatch(chaptersTsx + door, /CountUp|ds-sheet--lift|ds-door-ch__sheets|ds-field/);
  assert.doesNotMatch(css, /ds-door-ch__grade-mark|ds-door-ch__sheet|ds-door-ch__bar/);
  // The grades are one ruled row: glyph and word, as the claims block prints a grade.
  assert.match(chaptersTsx, /confidenceTierPhrase\(level\)/);
  assert.match(
    css,
    /\.ds-door-ch__grades \{[^}]*border-top: var\(--ds-border-width-strong\) solid/,
  );
  // The first band after the map is the table's ground: dark in the dark theme, never paper.
  assert.match(chaptersTsx, /tone="ink"\s+className="ds-door-ch ds-door-ch--evidence"/);
});

test('door-home CSS steps the headline down on a phone', () => {
  assert.match(css, /ds-door-open__headline[\s\S]*clamp\(/);
  assert.match(
    css,
    /@media \(max-width: 47\.9375rem\)[\s\S]*\.ds-door-open__headline\s*\{\s*font-size:\s*clamp\(/,
  );
});

test('DoorImmersive hands every record to the plate', () => {
  assert.match(immersive, /const selectedPinId = current\?\.pinId \?\? null/);
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

test('the tour is one pinned scene scrubbed by the page scroll, one stop showing', () => {
  // Native scroll only, never captured. A stop is two screens tall and draws nothing; its words
  // are pinned and shown by `data-current` while the camera is landed on its record.
  assert.doesNotMatch(tourCss + tourScroll, /scroll-snap|preventDefault|addEventListener\('wheel'/);
  assert.match(tourScroll, /addEventListener\('scroll', schedule, \{ passive: true \}\)/);
  assert.match(immersive, /addEventListener\('scroll', schedule, \{ passive: true \}\)/);
  assert.match(tourCss, /\.ds-door-tour__step\s*\{\s*min-height:\s*200dvh/);
  // One more screen after the last stop, for the pull-out back to the globe.
  assert.match(
    tourCss,
    /\.ds-door-tour__item:last-child \.ds-door-tour__step\s*\{\s*min-height:\s*300dvh/,
  );
  assert.match(tourCss, /\.ds-door-tour__card\s*\{[^}]*position:\s*fixed;[^}]*opacity:\s*0/s);
  assert.match(
    tourCss,
    /\[data-active='true'\] \.ds-door-tour__step\[data-current\] \.ds-door-tour__card,\s*\.ds-door-tour__card:focus-within\s*\{[^}]*opacity:\s*1/s,
  );
  // The words and the camera read one path, so they cannot disagree about where the tour is.
  assert.match(tourScroll, /tourPhase\(window\.scrollY, layout\)/);
  assert.match(immersive, /tourPhase\(window\.scrollY, scrub\.layout\)/);
  assert.match(immersive, /tourCameraAt\(phase, scrub\.cameras\)/);
  assert.match(tourScroll, /toggleAttribute\('data-current', at === shown\)/);
  // A reader who asked the map to hold still gets cuts between stops, never the scrub.
  assert.match(immersive, /const still = prefersReducedMotion\(\) \|\| holdStill\(\)/);
  // A landing uses the frame its stored precision allows, the record page's own rule.
  assert.match(immersive, /groundFrameFor\(record\.precision, false\)/);
  // Imagery is asked for only once the scroll rests on a stop. Its credit and date caveat ride
  // in the map's own attribution, not in a caption over the map.
  assert.match(immersive, /TOUR_REST_MS/);
  assert.doesNotMatch(immersive, /ds-door__imagery/);
  // The stop's frame is measured from its own element, not from a window CSS moves mid-tour.
  assert.match(immersive, /className="ds-door__tour-window" ref=\{tourWindowRef\}/);
  assert.doesNotMatch(tourCss, /\[data-active='true'\]\) \.ds-door__window\s*\{/);
  // A stop that is not showing stays in the document and the tab order (never `visibility` or
  // `display`), and a link reached by keyboard brings its stop in.
  assert.doesNotMatch(tourCss, /\.ds-door-tour__card\s*\{[^}]*(visibility|display:\s*none)/s);
  assert.match(tourScroll, /addEventListener\('focusin'/);
  assert.match(tourScroll, /scrollIntoView\(\{ block: 'start' \}\)/);
  // One headline, one sourced claim and one action per stop; the rail links every stop.
  assert.match(tourSection, /<h3 className="ds-door-tour__name"/);
  assert.match(tourSection, /buttonClassName\('primary', 'ds-door-tour__open'\)/);
  assert.match(tourScroll, /<nav className="ds-door-tour__rail"[^>]*aria-label="Tour stops"/);
  assert.match(tourScroll, /aria-current=\{current === at \? 'step' : undefined\}/);
  // Without scripting the stops are a stacked list: the stage is behind `scripting: enabled`.
  assert.ok(
    tourCss.indexOf('@media (scripting: enabled)') <
      tourCss.indexOf('.ds-door-tour__step {\n    min-height: 200dvh'),
  );
});
