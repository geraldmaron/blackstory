/**
 * Typed catalog of rights-cleared archive collage tiles used by atmosphere planes.
 * Paths are local copies under /brand/collage/tiles — sourced from Commons promotions
 * (see packages/firebase/scripts/build-archive-collage-tiles.ts).
 */
export type AtmosphereTileCredit = {
  readonly index: string;
  readonly entityId: string;
  /** Local static path served by the web app. */
  readonly path: string;
  /** Original GCS URL recorded in the collage manifest (attribution / rebuild). */
  readonly sourceUrl: string;
};

/** 24-tile pool — index order matches public/brand/collage/tiles/manifest.json. */
export const ATMOSPHERE_TILE_CREDITS: readonly AtmosphereTileCredit[] = [
  {
    index: '01',
    entityId: 'ent_maggie_l_walker_001',
    path: '/brand/collage/tiles/01.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_maggie_l_walker_001/primary.jpg',
  },
  {
    index: '02',
    entityId: 'ent_ursula_burns_001',
    path: '/brand/collage/tiles/02.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_ursula_burns_001/primary.jpg',
  },
  {
    index: '03',
    entityId: 'ent_kenneth_chenault_001',
    path: '/brand/collage/tiles/03.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_kenneth_chenault_001/primary.jpg',
  },
  {
    index: '04',
    entityId: 'ent_robert_l_johnson_001',
    path: '/brand/collage/tiles/04.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_robert_l_johnson_001/primary.jpg',
  },
  {
    index: '05',
    entityId: 'ent_john_h_johnson_001',
    path: '/brand/collage/tiles/05.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_john_h_johnson_001/primary.jpg',
  },
  {
    index: '06',
    entityId: 'ent_bessie_coleman_001',
    path: '/brand/collage/tiles/06.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_bessie_coleman_001/primary.jpg',
  },
  {
    index: '07',
    entityId: 'ent_eugene_bullard_001',
    path: '/brand/collage/tiles/07.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_eugene_bullard_001/primary.jpg',
  },
  {
    index: '08',
    entityId: 'ent_willa_brown_001',
    path: '/brand/collage/tiles/08.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_willa_brown_001/primary.jpg',
  },
  {
    index: '09',
    entityId: 'ent_guion_bluford_001',
    path: '/brand/collage/tiles/09.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_guion_bluford_001/primary.jpg',
  },
  {
    index: '10',
    entityId: 'ent_mae_jemison_001',
    path: '/brand/collage/tiles/10.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_mae_jemison_001/primary.jpg',
  },
  {
    index: '11',
    entityId: 'ent_ronald_mcnair_001',
    path: '/brand/collage/tiles/11.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_ronald_mcnair_001/primary.jpg',
  },
  {
    index: '12',
    entityId: 'ent_charles_bolden_001',
    path: '/brand/collage/tiles/12.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_charles_bolden_001/primary.jpg',
  },
  {
    index: '13',
    entityId: 'ent_robert_h_lawrence_001',
    path: '/brand/collage/tiles/13.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_robert_h_lawrence_001/primary.jpg',
  },
  {
    index: '14',
    entityId: 'ent_katherine_johnson_001',
    path: '/brand/collage/tiles/14.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_katherine_johnson_001/primary.jpg',
  },
  {
    index: '15',
    entityId: 'ent_dorothy_vaughan_001',
    path: '/brand/collage/tiles/15.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_dorothy_vaughan_001/primary.jpg',
  },
  {
    index: '16',
    entityId: 'ent_patricia_bath_001',
    path: '/brand/collage/tiles/16.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_patricia_bath_001/primary.jpg',
  },
  {
    index: '17',
    entityId: 'ent_ernest_everett_just_001',
    path: '/brand/collage/tiles/17.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_ernest_everett_just_001/primary.jpg',
  },
  {
    index: '18',
    entityId: 'ent_marie_maynard_daly_001',
    path: '/brand/collage/tiles/18.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_marie_maynard_daly_001/primary.jpg',
  },
  {
    index: '19',
    entityId: 'ent_james_mccune_smith_001',
    path: '/brand/collage/tiles/19.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_james_mccune_smith_001/primary.jpg',
  },
  {
    index: '20',
    entityId: 'ent_alexa_canady_001',
    path: '/brand/collage/tiles/20.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_alexa_canady_001/primary.jpg',
  },
  {
    index: '21',
    entityId: 'ent_garrett_morgan_001',
    path: '/brand/collage/tiles/21.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_garrett_morgan_001/primary.jpg',
  },
  {
    index: '22',
    entityId: 'ent_frederick_mckinley_jones_001',
    path: '/brand/collage/tiles/22.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_frederick_mckinley_jones_001/primary.jpg',
  },
  {
    index: '23',
    entityId: 'ent_granville_woods_001',
    path: '/brand/collage/tiles/23.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_granville_woods_001/primary.jpg',
  },
  {
    index: '24',
    entityId: 'ent_elijah_mccoy_001',
    path: '/brand/collage/tiles/24.jpg',
    sourceUrl:
      'https://storage.googleapis.com/black-book-efaaf-public-media/public/entities/ent_elijah_mccoy_001/primary.jpg',
  },
] as const;

export const ATMOSPHERE_ATTRIBUTION_HREF = '/stories/mosaic-credits';
