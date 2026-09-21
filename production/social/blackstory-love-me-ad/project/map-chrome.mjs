// Chrome suppression for map shots on the Door.
//
// The OpenStreetMap / OpenFreeMap attribution is deliberately NOT hidden: the
// tiles are ODbL-licensed and attribution is an obligation, not decoration. It
// is left at reduced opacity, bottom-left, clear of TikTok's furniture.
//
// Everything else removed here is application furniture (nav bar, rooms menu,
// gesture hints, the Door's hero card and its scroll chapters). The hero card
// also runs a pronoun morph animation on its own clock, which would not be
// deterministic under frame stepping.
export const HIDE_CHROME = `
  header.ds-bar,
  .ds-roomsmenu, .ds-roomsmenu__panel,
  .ds-door__field-chrome,
  .ds-door-open,
  .ds-door-journey,
  .ds-door__filters,
  nextjs-portal, [data-next-badge-root] { display: none !important; }
  .ds-door__field { pointer-events: none !important; }
  .maplibregl-ctrl-bottom-left { opacity: .62 !important; }
  html, body { overflow: hidden !important; background: #131110 !important; }
`;
