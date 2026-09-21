// v003 edit. Photographs and type from real BlackStory records carry the piece;
// product captures (map, Lives, Data, Memorial) are kept where the product itself
// is the image. Frame numbers are on the 59.94fps timeline and come from
// audio/markers.json -- the same cut points as v002.
//
// Copy rule: every line on screen is either the product's own copy (the Door's
// "His Story happened here.", the lockup) or taken verbatim from the record the
// image comes from (place label, year stated in the record's story, a clause of
// its one-line story). Nothing is paraphrased into a new claim.
import path from 'node:path';
import fs from 'node:fs';

const MEDIA = path.resolve('../assets/media/jpg');
const img = (id) => 'file://' + path.join(MEDIA, id + '.jpg');
const cites = JSON.parse(fs.readFileSync(path.resolve('../assets/cites-the-count.json')));
const cite = (n) => ({
  n: String(n).padStart(2, '0'),
  t: cites.items[n - 1].replace(/^\d+\./, '').replace(/ · .*$/, ''),
});

// Portrait push: face sits in the upper third, type in the lower third.
const PUSH = (s0 = 1.05, s1 = 1.13, ease = 'linear', y0 = 0, y1 = -18) => ({
  s0,
  s1,
  ease,
  y0,
  y1,
});
const FAST = { typeAt: 0, typeDur: 6, typeGap: 1 }; // for 14-30 frame cuts
const line = (who) => ({
  line: [`${who} Story`, 'happened <em>here</em>.'],
  lineAt: 4,
  grain: true,
});

export const TIMELINE = [
  // ---- HER ---------------------------------------------------------------
  {
    name: 'c01-tubman',
    in: 0,
    out: 120,
    audio: 'cold open; VOX 0.368',
    card: {
      image: img('ent_harriet_tubman_001'),
      focus: '50% 22%',
      move: PUSH(1.03, 1.14, 'linear'),
      place: 'Dorchester County, Maryland',
      year: '1822',
      name: 'Harriet Tubman',
      typeAt: 22,
    },
  },
  {
    name: 'c02-wheatley',
    in: 120,
    out: 206,
    audio: 'HIT 1.997',
    card: {
      image: img('ent_phillis_wheatley_001'),
      focus: '50% 38%',
      move: PUSH(1.1, 1.18),
      place: 'Boston, Massachusetts',
      year: '1761',
      name: 'Phillis Wheatley',
      typeAt: 3,
    },
  },
  {
    name: 'c03-wells',
    in: 206,
    out: 231,
    audio: 'HIT 3.440 (0.749)',
    card: {
      image: img('ent_ida_b_wells_001'),
      focus: '50% 24%',
      move: PUSH(1.12, 1.17),
      place: 'Memphis, Tennessee',
      year: '1892',
      name: 'Ida B. Wells',
      ...FAST,
    },
  },
  {
    name: 'c04-jacobs',
    in: 231,
    out: 293,
    audio: 'HIT 3.861',
    card: {
      image: img('ent_harriet_jacobs_001'),
      focus: '50% 26%',
      move: PUSH(1.08, 1.16),
      place: 'Edenton, North Carolina',
      year: '1842',
      name: 'Harriet Jacobs',
      ...FAST,
    },
  },
  {
    name: 'c05-cjwalker',
    in: 293,
    out: 338,
    audio: 'HIT 4.885 / 5.373',
    card: {
      image: img('ent_madam_cj_walker_001'),
      focus: '50% 22%',
      move: PUSH(1.08, 1.15),
      place: 'Irvington, New York',
      name: 'Madam C. J. Walker',
      ...FAST,
    },
  },
  { name: 'l1-her', in: 338, out: 384, audio: 'GAP 5.637-6.330 (silence)', card: line('Her') },

  // ---- HIS ---------------------------------------------------------------
  {
    name: 'c06-smalls',
    in: 384,
    out: 425,
    audio: 'HIT 6.405 (0.788)',
    card: {
      image: img('ent_robert_smalls_001'),
      focus: '50% 22%',
      move: PUSH(1.14, 1.08, 'outCubic'),
      place: 'Beaufort, South Carolina',
      year: '1862',
      name: 'Robert Smalls',
      ...FAST,
    },
  },
  {
    name: 'c07-revels',
    in: 425,
    out: 455,
    audio: 'VOX 7.091',
    card: {
      image: img('ent_hiram_revels_001'),
      focus: '50% 20%',
      move: PUSH(1.08, 1.15),
      place: 'Mississippi',
      year: '1870',
      name: 'Hiram Revels',
      ...FAST,
    },
  },
  {
    name: 'c08-carney',
    in: 455,
    out: 516,
    audio: 'HIT 7.592',
    card: {
      image: img('ent_william_harvey_carney_001'),
      focus: '50% 24%',
      move: PUSH(1.08, 1.16),
      place: 'Fort Wagner',
      year: '1863',
      name: 'William Harvey Carney',
      ...FAST,
    },
  },
  { name: 'l2-his', in: 516, out: 567, audio: 'GAP 8.613-9.296 (silence)', card: line('His') },

  // ---- THEIR -------------------------------------------------------------
  {
    name: 'c09-seneca',
    in: 567,
    out: 647,
    audio: 'HIT 9.459 (0.793); 9.925',
    card: {
      image: img('ent_seneca_village_001'),
      frame: { w: 900, top: 230 },
      move: PUSH(1.0, 1.07),
      place: 'Manhattan, New York',
      year: '1825',
      name: 'Seneca Village',
      typeAt: 4,
      grain: true,
    },
  },
  {
    name: 'c10-onajudge',
    in: 647,
    out: 677,
    audio: 'HIT 10.787 / 11.088',
    card: {
      image: img('ent_ona_judge_001'),
      frame: { w: 880, top: 220 },
      move: PUSH(1.04, 1.1),
      place: 'Philadelphia',
      year: '1796',
      name: 'Ona Judge',
      ...FAST,
    },
  },
  {
    name: 'c11-coffin',
    in: 677,
    out: 695,
    audio: 'HIT 11.296',
    card: {
      image: img('ent_levi_coffin_house_001'),
      focus: '50% 50%',
      move: PUSH(1.1, 1.16),
      place: 'Fountain City, Indiana',
      year: '1826',
      name: 'The Coffin House',
      ...FAST,
    },
  },
  {
    name: 'l3-their',
    in: 695,
    out: 741,
    audio: 'GAP 11.595-12.272 (silence)',
    card: line('Their'),
  },

  // ---- PLACE: the map is the connective tissue ---------------------------
  { name: 'map-reveal', in: 741, out: 850, capture: 'map-reveal', audio: 'HIT 12.368 (0.801)' },
  {
    name: 'c12-still',
    in: 850,
    out: 922,
    audio: 'VOX 14.184 (sustain 0.94)',
    card: {
      image: img('ent_william_still_001'),
      focus: '50% 22%',
      move: PUSH(1.05, 1.11),
      place: 'Philadelphia',
      year: '1872',
      name: 'William Still',
      story: 'kept detailed written records of their journeys',
      typeAt: 2,
      wordEvery: 3,
    },
  },
  {
    name: 'c13-dubois',
    in: 922,
    out: 936,
    audio: 'HIT 15.379',
    card: {
      image: img('ent_web_du_bois_001'),
      focus: '50% 22%',
      move: PUSH(1.14, 1.1, 'outCubic'),
      place: 'Great Barrington, Massachusetts',
      year: '1868',
      ...FAST,
    },
  },
  {
    name: 'c14-drew',
    in: 936,
    out: 954,
    audio: 'HIT 15.611',
    card: {
      image: img('ent_charles_drew_001'),
      focus: '50% 20%',
      move: PUSH(1.14, 1.1, 'outCubic'),
      place: 'Washington, D.C.',
      year: '1940',
      ...FAST,
    },
  },
  {
    name: 'c15-btw',
    in: 954,
    out: 969,
    audio: 'HIT 15.915',
    card: {
      image: img('ent_booker_t_washington_001'),
      focus: '50% 22%',
      move: PUSH(1.14, 1.1, 'outCubic'),
      place: 'Tuskegee, Alabama',
      year: '1881',
      ...FAST,
    },
  },
  {
    name: 'c16-woods',
    in: 969,
    out: 1010,
    audio: 'HIT 16.173',
    card: {
      image: img('ent_granville_woods_001'),
      frame: { w: 820, top: 230 },
      move: PUSH(1.0, 1.05),
      place: 'Cincinnati, Ohio',
      year: '1887',
      name: 'Granville Woods',
      ...FAST,
    },
  },

  // ---- EVIDENCE: the chapter's own citations, set, not screenshotted ------
  {
    name: 'c17-cites',
    in: 1010,
    out: 1141,
    audio: 'VOX 16.853 (1.73s)',
    card: {
      grain: true,
      cites: {
        heading: 'About this chapter · every numbered mark resolves here',
        items: [1, 3, 8, 9, 11, 13, 14, 16].map(cite),
        y0: 360,
        y1: -330,
        every: 4,
        ease: 'inOutSine',
      },
    },
  },
  {
    name: 'c18-rainey',
    in: 1141,
    out: 1257,
    audio: 'VOX 19.040 + 19.744',
    card: {
      image: img('ent_joseph_rainey_001'),
      focus: '50% 22%',
      move: PUSH(1.04, 1.11),
      place: 'Georgetown, South Carolina',
      year: '1870',
      name: 'Joseph Rainey',
      story: 'the first African American to serve in the U.S. House of Representatives',
      typeAt: 4,
      wordEvery: 3,
    },
  },

  // ---- EXPANSION ---------------------------------------------------------
  {
    name: 'c19-tulsa',
    in: 1257,
    out: 1370,
    audio: 'VOX 20.976',
    card: {
      image: img('doc_tulsa_1921'),
      frame: { w: 940, top: 250 },
      move: PUSH(1.0, 1.08),
      place: 'Tulsa, Oklahoma',
      year: '1921',
      name: 'Tulsa Race Massacre',
      typeAt: 6,
    },
  },
  { name: 'lives', in: 1370, out: 1500, capture: 'lives', audio: 'VOX 22.848 (sustain 1.95)' },
  {
    name: 'c20-plate',
    in: 1500,
    out: 1545,
    audio: 'VOX 25.024',
    card: {
      image: img('doc_dubois_plate_1900'),
      frame: { w: 760, top: 200, maxH: 980 },
      move: PUSH(1.0, 1.05),
      place: 'Georgia',
      year: 'c. 1900',
      name: 'W. E. B. Du Bois',
      ...FAST,
    },
  },
  { name: 'data', in: 1545, out: 1646, capture: 'data', audio: 'VOX 25.776' },

  // ---- SCALE, MEMORIAL (unchanged from v002) ------------------------------
  { name: 'map-wide', in: 1646, out: 1681, capture: 'map-wide', audio: 'HIT 27.461 / 27.760' },
  {
    name: 'memorial-a',
    in: 1681,
    out: 2123,
    capture: 'memorial-a',
    audio: 'VOX 28.051 (sustain 4.18)',
  },
  {
    name: 'memorial-b',
    in: 2123,
    out: 2529,
    capture: 'memorial-b',
    audio: 'VOX 35.416; riser 39.272',
  },

  // ---- THE DROP: faces, then outward -------------------------------------
  {
    name: 'c21-coleman',
    in: 2529,
    out: 2573,
    audio: 'HIT 42.184 (0.895) — the drop',
    card: {
      image: img('ent_bessie_coleman_001'),
      focus: '50% 20%',
      move: PUSH(1.16, 1.08, 'outExpo'),
      place: 'France',
      year: '1921',
      name: 'Bessie Coleman',
      ...FAST,
    },
  },
  {
    name: 'c22-woodson',
    in: 2573,
    out: 2660,
    audio: 'VOX 42.925',
    card: {
      image: img('ent_carter_g_woodson_001'),
      frame: { w: 800, top: 200 },
      move: PUSH(1.0, 1.06),
      place: 'Washington, D.C.',
      year: '1926',
      name: 'Carter G. Woodson',
      story: 'Negro History Week — the seed of Black History Month.',
      typeAt: 2,
      wordEvery: 3,
    },
  },
  {
    name: 'c23-bruce',
    in: 2660,
    out: 2713,
    audio: 'VOX 44.373',
    card: {
      image: img('ent_blanche_k_bruce_001'),
      focus: '50% 22%',
      move: PUSH(1.08, 1.15),
      place: 'Mississippi',
      year: '1875',
      name: 'Blanche K. Bruce',
      ...FAST,
    },
  },
  {
    name: 'c24-turner',
    in: 2713,
    out: 2764,
    audio: 'HIT 45.267 (0.813)',
    card: {
      image: img('ent_charles_henry_turner_001'),
      focus: '50% 22%',
      move: PUSH(1.08, 1.15),
      place: 'St. Louis, Missouri',
      year: '1907',
      name: 'Charles Henry Turner',
      ...FAST,
    },
  },
  { name: 'map-out2', in: 2764, out: 2793, capture: 'map-out2', audio: 'VOX 46.112' },
  { name: 'map-out3', in: 2793, out: 2838, capture: 'map-out3', audio: 'VOX 46.600' },
  { name: 'map-out4', in: 2838, out: 2932, capture: 'map-out4', audio: 'VOX 47.344' },
  { name: 'map-out5', in: 2932, out: 3021, capture: 'map-out5', audio: 'HIT 48.915' },
  { name: 'map-out6', in: 3021, out: 3074, capture: 'map-out6', audio: 'HIT 50.397' },
  {
    name: 'brand-bg',
    in: 3074,
    out: 3264,
    capture: 'brand-bg',
    overlay: 'brand-fg',
    audio: 'HIT 51.283 -> decay',
  },
];
for (const s of TIMELINE) s.frames = s.out - s.in;
