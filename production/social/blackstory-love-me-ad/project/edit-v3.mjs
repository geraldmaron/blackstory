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

// v006. Cut points are measured events (audio/kicks.json, audio/markers.json).
// Captions passed the ringer review in RINGER-REVIEW.md; each is a clause of
// its record, compressed without changing what it claims.
const S = (story, extra = {}) => ({ story, ...extra });
const QUICK = { typeAt: 0, typeDur: 6, typeGap: 1, wordEvery: 1 };
const card = (id, focus, move, place, year, name, story, extra = {}) => ({
  image: img(id),
  focus,
  move,
  place,
  year,
  name,
  story,
  ...extra,
});

export const TIMELINE = [
  // ---- HER -----------------------------------------------------------------
  {
    name: 'c01-tubman',
    in: 0,
    out: 111,
    audio: 'vocal intro; bass enters 1.845',
    card: card(
      'ent_harriet_tubman_001',
      '50% 22%',
      PUSH(1.03, 1.12),
      'Dorchester County, Maryland',
      '1822',
      'Harriet Tubman',
      'born into slavery here; guided about seventy people out',
      { typeAt: 18, wordEvery: 2 },
    ),
  },
  {
    name: 'c02-wheatley',
    in: 111,
    out: 199,
    audio: 'kick 1.845 (first bass)',
    card: card(
      'ent_phillis_wheatley_001',
      '50% 38%',
      PUSH(1.1, 1.17),
      'Boston, Massachusetts',
      '1773',
      'Phillis Wheatley',
      'the first African American to publish a book of poetry',
      { typeAt: 2, wordEvery: 2 },
    ),
  },
  {
    name: 'c03-wells',
    in: 199,
    out: 244,
    audio: 'kick 3.317',
    card: card(
      'ent_ida_b_wells_001',
      '50% 24%',
      PUSH(1.12, 1.17),
      'Memphis, Tennessee',
      '1892',
      'Ida B. Wells',
      'a pioneering investigative journalist',
      QUICK,
    ),
  },
  {
    name: 'c04-jacobs',
    in: 244,
    out: 338,
    audio: 'kick 4.063',
    card: card(
      'ent_harriet_jacobs_001',
      '50% 26%',
      PUSH(1.08, 1.16),
      'Edenton, North Carolina',
      '1842',
      'Harriet Jacobs',
      'hid for nearly seven years in a cramped garret',
      { ...QUICK, wordEvery: 2 },
    ),
  },
  { name: 'l1-her', in: 338, out: 378, audio: 'GAP 5.637 until drop 6.309', card: line('Her') },

  // ---- HIS -----------------------------------------------------------------
  {
    name: 'c06-smalls',
    in: 378,
    out: 433,
    audio: 'DROP 6.309',
    card: card(
      'ent_robert_smalls_001',
      '50% 22%',
      PUSH(1.14, 1.08, 'outCubic'),
      'Beaufort, South Carolina',
      '1862',
      'Robert Smalls',
      'born enslaved here; commandeered the Confederate steamer CSS Planter',
      QUICK,
    ),
  },
  {
    name: 'c07-revels',
    in: 433,
    out: 516,
    audio: 'kick 7.221',
    card: card(
      'ent_hiram_revels_001',
      '50% 20%',
      PUSH(1.08, 1.15),
      'Mississippi',
      '1870',
      'Hiram Revels',
      'the first African American to serve in the U.S. Senate',
      { ...QUICK, wordEvery: 2 },
    ),
  },
  { name: 'l2-his', in: 516, out: 557, audio: 'GAP 8.613 until drop 9.291', card: line('His') },

  // ---- THEIR ---------------------------------------------------------------
  {
    name: 'c09-seneca',
    in: 557,
    out: 612,
    audio: 'DROP 9.291',
    card: card(
      'ent_seneca_village_001',
      null,
      PUSH(1.0, 1.06),
      'Manhattan, New York',
      '1825',
      'Seneca Village',
      'cleared by the city in 1857 to build Central Park',
      { ...QUICK, frame: { w: 900 } },
    ),
  },
  {
    name: 'c10-onajudge',
    in: 612,
    out: 695,
    audio: 'kick 10.21',
    card: card(
      'ent_ona_judge_001',
      null,
      PUSH(1.03, 1.09),
      'Philadelphia',
      '1796',
      'Ona Judge',
      'enslaved to Martha Washington, she escaped — and died free',
      { ...QUICK, wordEvery: 2, frame: { w: 880 } },
    ),
  },
  {
    name: 'l3-their',
    in: 695,
    out: 736,
    audio: 'GAP 11.595 until drop 12.277',
    card: line('Their'),
  },

  // ---- PLACE ---------------------------------------------------------------
  { name: 'map-reveal', in: 736, out: 817, capture: 'map-reveal', audio: 'DROP 12.277' },
  {
    name: 'c12-still',
    in: 817,
    out: 917,
    audio: 'kick 13.62',
    card: card(
      'ent_william_still_001',
      '50% 22%',
      PUSH(1.05, 1.11),
      'Philadelphia',
      '1872',
      'William Still',
      'aided about 800 freedom seekers and published their records',
      { typeAt: 2, wordEvery: 2 },
    ),
  },
  {
    name: 'c13-dubois',
    in: 917,
    out: 995,
    audio: 'kick 15.299',
    card: card(
      'ent_web_du_bois_001',
      '50% 22%',
      PUSH(1.12, 1.07, 'outCubic'),
      'Great Barrington, Massachusetts',
      '1868',
      'W. E. B. Du Bois',
      'born here; co-founded the NAACP in 1909',
      QUICK,
    ),
  },

  // ---- EVIDENCE / EXPANSION (sustained bass: cuts on vocal entrances) -----
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
    card: card(
      'ent_joseph_rainey_001',
      '50% 22%',
      PUSH(1.04, 1.11),
      'Georgetown, South Carolina',
      '1870',
      'Joseph Rainey',
      'the first African American to serve in the U.S. House of Representatives',
      { typeAt: 4, wordEvery: 2 },
    ),
  },
  {
    name: 'c16-woods',
    in: 1257,
    out: 1370,
    audio: 'VOX 20.976',
    card: card(
      'ent_granville_woods_001',
      null,
      PUSH(1.0, 1.05),
      'Cincinnati, Ohio',
      '1887',
      'Granville Woods',
      'patented the induction telegraph',
      { typeAt: 3, wordEvery: 2, frame: { w: 820 } },
    ),
  },
  {
    name: 'c19-tulsa',
    in: 1370,
    out: 1500,
    audio: 'VOX 22.848',
    card: card(
      'doc_tulsa_1921',
      null,
      PUSH(1.0, 1.08),
      'Tulsa, Oklahoma',
      '1921',
      'Tulsa Race Massacre',
      'white mobs burned and looted more than 35 square blocks of Greenwood',
      { typeAt: 6, wordEvery: 2, frame: { w: 940 } },
    ),
  },
  {
    name: 'c20-plate',
    in: 1500,
    out: 1545,
    audio: 'VOX 25.024',
    card: card(
      'doc_dubois_plate_1900',
      null,
      PUSH(1.0, 1.05),
      'Georgia',
      'c. 1900',
      'W. E. B. Du Bois',
      'a hand-lettered exhibit charting Black land ownership in Georgia',
      { ...QUICK, frame: { w: 760 } },
    ),
  },
  { name: 'lives', in: 1545, out: 1631, capture: 'lives', audio: 'VOX 25.776' },
  { name: 'map-wide', in: 1631, out: 1681, capture: 'map-wide', audio: 'kick 27.205' },

  // ---- MEMORIAL: one phrase, 6.6s (was 14.1s) -----------------------------
  {
    name: 'memorial',
    in: 1681,
    out: 2079,
    capture: 'memorial-a',
    audio: 'VOX 28.051 (6.13s phrase) until VOX 34.685',
  },

  // ---- RETURN: four lives through the second phrase and the riser ---------
  {
    name: 'c25-douglass',
    in: 2079,
    out: 2170,
    audio: 'VOX 34.685 -> kick 36.20',
    card: card(
      'ent_frederick_douglass_gov_001',
      '50% 24%',
      PUSH(1.04, 1.11),
      'Washington, D.C.',
      '1877',
      'Frederick Douglass',
      'U.S. Marshal for D.C., the first African American to hold the post',
      { typeAt: 3, wordEvery: 2 },
    ),
  },
  {
    name: 'c26-cjwalker',
    in: 2170,
    out: 2345,
    audio: 'kick 36.20 -> bass returns 39.125',
    card: card(
      'ent_madam_cj_walker_001',
      '50% 22%',
      PUSH(1.04, 1.13),
      'Irvington, New York',
      null,
      'Madam C. J. Walker',
      'built a business that trained tens of thousands of Black sales agents',
      { typeAt: 4, wordEvery: 3 },
    ),
  },
  {
    name: 'c27-carney',
    in: 2345,
    out: 2404,
    audio: 'BASS RETURNS 39.125',
    card: card(
      'ent_william_harvey_carney_001',
      '50% 24%',
      PUSH(1.14, 1.08, 'outCubic'),
      'Fort Wagner',
      '1863',
      'William Harvey Carney',
      'carried the regimental colors despite severe wounds',
      QUICK,
    ),
  },
  {
    name: 'c28-btw',
    in: 2404,
    out: 2524,
    audio: 'kick 40.10 through the riser',
    card: card(
      'ent_booker_t_washington_001',
      '50% 22%',
      PUSH(1.05, 1.14, 'inCubic'),
      'Tuskegee, Alabama',
      '1881',
      'Booker T. Washington',
      'founded and led Tuskegee Institute',
      { typeAt: 2, wordEvery: 2 },
    ),
  },

  // ---- THE DROP -------------------------------------------------------------
  {
    name: 'c21-coleman',
    in: 2524,
    out: 2573,
    audio: 'DROP 42.109',
    card: card(
      'ent_bessie_coleman_001',
      '50% 20%',
      PUSH(1.16, 1.08, 'outExpo'),
      'France',
      '1921',
      'Bessie Coleman',
      'the first Black woman to hold a pilot’s license',
      QUICK,
    ),
  },
  {
    name: 'c22-woodson',
    in: 2573,
    out: 2695,
    audio: 'kick 42.93',
    card: card(
      'ent_carter_g_woodson_001',
      null,
      PUSH(1.0, 1.06),
      'Washington, D.C.',
      '1926',
      'Carter G. Woodson',
      'Negro History Week — the seed of Black History Month.',
      { typeAt: 2, wordEvery: 2, frame: { w: 800 } },
    ),
  },
  {
    name: 'c23-bruce',
    in: 2695,
    out: 2751,
    audio: 'kick 44.96',
    card: card(
      'ent_blanche_k_bruce_001',
      '50% 22%',
      PUSH(1.08, 1.15),
      'Mississippi',
      '1875',
      'Blanche K. Bruce',
      'the first African American to serve a full Senate term',
      QUICK,
    ),
  },
  {
    name: 'c14-drew',
    in: 2751,
    out: 2823,
    audio: 'kick 45.90',
    card: card(
      'ent_charles_drew_001',
      '50% 20%',
      PUSH(1.1, 1.16),
      'Washington, D.C.',
      null,
      'Charles Drew',
      'trained a generation of Black surgeons at Howard',
      QUICK,
    ),
  },
  {
    name: 'c24-turner',
    in: 2823,
    out: 2881,
    audio: 'kick 47.10',
    card: card(
      'ent_charles_henry_turner_001',
      '50% 22%',
      PUSH(1.08, 1.15),
      'St. Louis, Missouri',
      null,
      'Charles Henry Turner',
      'showed insects can hear, learn, and change behavior',
      QUICK,
    ),
  },
  { name: 'map-out3', in: 2881, out: 2932, capture: 'map-out3', audio: 'DROP 48.072' },
  { name: 'map-out4', in: 2932, out: 2973, capture: 'map-out4', audio: 'kick 48.91' },
  { name: 'map-out5', in: 2973, out: 3017, capture: 'map-out5', audio: 'kick 49.59' },
  { name: 'map-out6', in: 3017, out: 3062, capture: 'map-out6', audio: 'kick 50.34' },
  {
    name: 'brand-bg',
    in: 3062,
    out: 3264,
    capture: 'brand-bg',
    overlay: 'brand-fg',
    audio: 'kick 51.085 (loudest bass)',
  },
];
for (const s of TIMELINE) s.frames = s.out - s.in;
