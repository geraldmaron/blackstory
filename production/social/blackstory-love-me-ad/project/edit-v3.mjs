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

// v005 cut points. Every boundary is a measured event (audio/kicks.json,
// audio/bass.json): a kick where there is one, a vocal phrase entrance in the
// 16.6-27s stretch where the bass is sustained and has no attacks. Each card
// carries a summary clause taken from its record.
const S = (story, extra = {}) => ({ story, ...extra });
const QUICK = { typeAt: 0, typeDur: 6, typeGap: 1, wordEvery: 1 };

export const TIMELINE = [
  // ---- HER (kicks 1.845*, 3.317, 4.063) ------------------------------------
  {
    name: 'c01-tubman',
    in: 0,
    out: 111,
    audio: 'vocal intro; bass enters 1.845 (flux 3.14)',
    card: {
      image: img('ent_harriet_tubman_001'),
      focus: '50% 22%',
      move: PUSH(1.03, 1.12),
      place: 'Dorchester County, Maryland',
      year: '1822',
      name: 'Harriet Tubman',
      typeAt: 18,
      ...S('guiding about seventy people out of slavery', { wordEvery: 2 }),
    },
  },
  {
    name: 'c02-wheatley',
    in: 111,
    out: 199,
    audio: 'kick 1.845* (first bass)',
    card: {
      image: img('ent_phillis_wheatley_001'),
      focus: '50% 38%',
      move: PUSH(1.1, 1.17),
      place: 'Boston, Massachusetts',
      year: '1761',
      name: 'Phillis Wheatley',
      typeAt: 2,
      ...S('the first African American to publish a book of poetry', { wordEvery: 2 }),
    },
  },
  {
    name: 'c03-wells',
    in: 199,
    out: 244,
    audio: 'kick 3.317 (level .80)',
    card: {
      image: img('ent_ida_b_wells_001'),
      focus: '50% 24%',
      move: PUSH(1.12, 1.17),
      place: 'Memphis, Tennessee',
      year: '1892',
      name: 'Ida B. Wells',
      ...QUICK,
      ...S('a pioneering investigative journalist'),
    },
  },
  {
    name: 'c04-jacobs',
    in: 244,
    out: 338,
    audio: 'kick 4.063',
    card: {
      image: img('ent_harriet_jacobs_001'),
      focus: '50% 26%',
      move: PUSH(1.08, 1.16),
      place: 'Edenton, North Carolina',
      year: '1842',
      name: 'Harriet Jacobs',
      ...QUICK,
      ...S('hid for nearly seven years in a cramped garret', { wordEvery: 2 }),
    },
  },
  {
    name: 'l1-her',
    in: 338,
    out: 378,
    audio: 'GAP 5.637 (silence) until the drop',
    card: line('Her'),
  },

  // ---- HIS (drop 6.309*, kick 7.221) ---------------------------------------
  {
    name: 'c06-smalls',
    in: 378,
    out: 433,
    audio: 'DROP 6.309 (flux 5.23)',
    card: {
      image: img('ent_robert_smalls_001'),
      focus: '50% 22%',
      move: PUSH(1.14, 1.08, 'outCubic'),
      place: 'Beaufort, South Carolina',
      year: '1862',
      name: 'Robert Smalls',
      ...QUICK,
      ...S('commandeered the Confederate steamer CSS Planter'),
    },
  },
  {
    name: 'c07-revels',
    in: 433,
    out: 516,
    audio: 'kick 7.221',
    card: {
      image: img('ent_hiram_revels_001'),
      focus: '50% 20%',
      move: PUSH(1.08, 1.15),
      place: 'Mississippi',
      year: '1870',
      name: 'Hiram Revels',
      ...QUICK,
      ...S('the first African American to serve in the U.S. Senate', { wordEvery: 2 }),
    },
  },
  {
    name: 'l2-his',
    in: 516,
    out: 557,
    audio: 'GAP 8.613 (silence) until the drop',
    card: line('His'),
  },

  // ---- THEIR (drop 9.291*, kick 10.21) -------------------------------------
  {
    name: 'c09-seneca',
    in: 557,
    out: 612,
    audio: 'DROP 9.291 (flux 4.44)',
    card: {
      image: img('ent_seneca_village_001'),
      frame: { w: 900, top: 230 },
      move: PUSH(1.0, 1.06),
      place: 'Manhattan, New York',
      year: '1825',
      name: 'Seneca Village',
      ...QUICK,
      ...S('a community of roughly 225 residents'),
    },
  },
  {
    name: 'c10-onajudge',
    in: 612,
    out: 695,
    audio: 'kick 10.21',
    card: {
      image: img('ent_ona_judge_001'),
      frame: { w: 880, top: 220 },
      move: PUSH(1.03, 1.09),
      place: 'Philadelphia',
      year: '1796',
      name: 'Ona Judge',
      ...QUICK,
      ...S('slipped out of the presidential mansion in Philadelphia', { wordEvery: 2 }),
    },
  },
  {
    name: 'l3-their',
    in: 695,
    out: 736,
    audio: 'GAP 11.595 (silence) until the drop',
    card: line('Their'),
  },

  // ---- PLACE (drop 12.277*, kicks 13.62, 15.30) ---------------------------
  {
    name: 'map-reveal',
    in: 736,
    out: 817,
    capture: 'map-reveal',
    audio: 'DROP 12.277 (flux 4.05)',
  },
  {
    name: 'c12-still',
    in: 817,
    out: 917,
    audio: 'kick 13.62',
    card: {
      image: img('ent_william_still_001'),
      focus: '50% 22%',
      move: PUSH(1.05, 1.11),
      place: 'Philadelphia',
      year: '1872',
      name: 'William Still',
      typeAt: 2,
      ...S('kept detailed written records of their journeys', { wordEvery: 2 }),
    },
  },
  {
    name: 'c13-dubois',
    in: 917,
    out: 995,
    audio: 'kick 15.299 (level .78)',
    card: {
      image: img('ent_web_du_bois_001'),
      focus: '50% 22%',
      move: PUSH(1.12, 1.07, 'outCubic'),
      place: 'Great Barrington, Massachusetts',
      year: '1868',
      name: 'W. E. B. Du Bois',
      ...QUICK,
      ...S('co-founded the NAACP in 1909'),
    },
  },

  // ---- EVIDENCE / EXPANSION: no kicks here; cut on vocal phrase entrances --
  {
    name: 'c17-cites',
    in: 995,
    out: 1141,
    audio: 'kick 16.60 -> VOX 16.853',
    card: {
      grain: true,
      cites: {
        heading: 'About this chapter · every numbered mark resolves here',
        items: [1, 3, 8, 9, 11, 13, 14, 16].map(cite),
        y0: 360,
        y1: -420,
        every: 4,
        ease: 'inOutSine',
      },
    },
  },
  {
    name: 'c18-rainey',
    in: 1141,
    out: 1257,
    audio: 'VOX 19.040',
    card: {
      image: img('ent_joseph_rainey_001'),
      focus: '50% 22%',
      move: PUSH(1.04, 1.11),
      place: 'Georgetown, South Carolina',
      year: '1870',
      name: 'Joseph Rainey',
      typeAt: 4,
      wordEvery: 2,
      story: 'the first African American to serve in the U.S. House of Representatives',
    },
  },
  {
    name: 'c16-woods',
    in: 1257,
    out: 1370,
    audio: 'VOX 20.976',
    card: {
      image: img('ent_granville_woods_001'),
      frame: { w: 820, top: 230 },
      move: PUSH(1.0, 1.05),
      place: 'Cincinnati, Ohio',
      year: '1887',
      name: 'Granville Woods',
      typeAt: 3,
      ...S('patented the multiplex telegraph', { wordEvery: 2 }),
    },
  },
  {
    name: 'c19-tulsa',
    in: 1370,
    out: 1500,
    audio: 'VOX 22.848 (sustain 1.95)',
    card: {
      image: img('doc_tulsa_1921'),
      frame: { w: 940, top: 250 },
      move: PUSH(1.0, 1.08),
      place: 'Tulsa, Oklahoma',
      year: '1921',
      name: 'Tulsa Race Massacre',
      typeAt: 6,
      ...S('Postcard caption: “Little Africa on fire.”', { wordEvery: 3 }),
    },
  },
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
      ...QUICK,
      ...S('“Value of land owned by Georgia Negroes”'),
    },
  },
  { name: 'lives', in: 1545, out: 1631, capture: 'lives', audio: 'VOX 25.776' },
  { name: 'map-wide', in: 1631, out: 1681, capture: 'map-wide', audio: 'kick 27.205 (level .83)' },

  // ---- MEMORIAL ------------------------------------------------------------
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
    out: 2524,
    capture: 'memorial-b',
    audio: 'VOX 35.416; bass returns 39.125',
  },

  // ---- THE DROP (42.109*, 42.99, 44.96, 45.90, 47.10) ---------------------
  {
    name: 'c21-coleman',
    in: 2524,
    out: 2573,
    audio: 'DROP 42.109 (level .91)',
    card: {
      image: img('ent_bessie_coleman_001'),
      focus: '50% 20%',
      move: PUSH(1.16, 1.08, 'outExpo'),
      place: 'France',
      year: '1921',
      name: 'Bessie Coleman',
      ...QUICK,
      ...S('the first Black woman to hold a pilot’s license'),
    },
  },
  {
    name: 'c22-woodson',
    in: 2573,
    out: 2695,
    audio: 'kick 42.93',
    card: {
      image: img('ent_carter_g_woodson_001'),
      frame: { w: 800, top: 200 },
      move: PUSH(1.0, 1.06),
      place: 'Washington, D.C.',
      year: '1926',
      name: 'Carter G. Woodson',
      typeAt: 2,
      wordEvery: 2,
      story: 'Negro History Week — the seed of Black History Month.',
    },
  },
  {
    name: 'c23-bruce',
    in: 2695,
    out: 2751,
    audio: 'kick 44.96 (level .88)',
    card: {
      image: img('ent_blanche_k_bruce_001'),
      focus: '50% 22%',
      move: PUSH(1.08, 1.15),
      place: 'Mississippi',
      year: '1875',
      name: 'Blanche K. Bruce',
      ...QUICK,
      ...S('a full six-year term in the U.S. Senate'),
    },
  },
  {
    name: 'c14-drew',
    in: 2751,
    out: 2823,
    audio: 'kick 45.90',
    card: {
      image: img('ent_charles_drew_001'),
      focus: '50% 20%',
      move: PUSH(1.1, 1.16),
      place: 'Washington, D.C.',
      year: '1940',
      name: 'Charles Drew',
      ...QUICK,
      ...S('directed the “Blood for Britain” program'),
    },
  },
  {
    name: 'c24-turner',
    in: 2823,
    out: 2881,
    audio: 'kick 47.10',
    card: {
      image: img('ent_charles_henry_turner_001'),
      focus: '50% 22%',
      move: PUSH(1.08, 1.15),
      place: 'St. Louis, Missouri',
      year: '1907',
      name: 'Charles Henry Turner',
      ...QUICK,
      ...S('proving insects can hear, learn, and modify behavior'),
    },
  },
  { name: 'map-out3', in: 2881, out: 2932, capture: 'map-out3', audio: 'DROP 48.072 (flux 1.01)' },
  { name: 'map-out4', in: 2932, out: 2973, capture: 'map-out4', audio: 'kick 48.91' },
  { name: 'map-out5', in: 2973, out: 3017, capture: 'map-out5', audio: 'kick 49.59' },
  { name: 'map-out6', in: 3017, out: 3062, capture: 'map-out6', audio: 'kick 50.34' },
  {
    name: 'brand-bg',
    in: 3062,
    out: 3264,
    capture: 'brand-bg',
    overlay: 'brand-fg',
    audio: 'kick 51.085 (level 1.00 — loudest bass in the track)',
  },
];
for (const s of TIMELINE) s.frames = s.out - s.in;
