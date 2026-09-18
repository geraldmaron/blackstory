/**
 * Builds double-entry JSON for 1918 Negro Population Tables 8 and 9 (urban/rural by state).
 * Run: node --conditions development --import tsx packages/ops-data/scripts/build-lives-urban-transcription.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TranscribedFigure, TranscribedFigureFile } from '../src/lives/transcribed.ts';

const SOURCE =
  'U.S. Bureau of the Census, Negro Population 1790-1915 (1918), Chapter IX Urbanization';
const SOURCE_URL =
  'https://www.census.gov/library/publications/1918/dec/negro-population-1790-1915.html';

function figure(
  fips: string,
  year: string,
  slice: 'black' | 'white',
  urban: number,
  rural: number,
  printedPct: number,
): TranscribedFigure {
  const denominator = urban + rural;
  const computed = denominator > 0 ? Math.round((1000 * urban) / denominator) / 10 : 100;
  if (Math.abs(computed - printedPct) > 0.15) {
    throw new Error(
      `state:${fips} ${year} ${slice}: printed ${printedPct} vs computed ${computed} from ${urban}/${denominator}`,
    );
  }
  return {
    metricId: 'lives-urban',
    jurisdictionId: fips === 'US' ? 'nation:US' : `state:${fips}`,
    referencePeriod: year,
    raceEthnicitySlice: slice,
    estimate: printedPct,
    numerator: urban,
    denominator,
    universe: slice === 'black' ? 'Negro population' : 'White population',
  };
}

/** Table 8, 1910: Negro and white urban/rural. Printed percents from the table. */
const TABLE_8_1910: readonly {
  readonly fips: string;
  readonly black: readonly [number, number, number];
  readonly white: readonly [number, number, number];
}[] = [
  { fips: 'US', black: [2_689_229, 7_138_534, 27.4], white: [39_831_913, 41_900_044, 48.7] },
  { fips: '23', black: [924, 439, 67.8], white: [380_292, 359_703, 51.4] },
  { fips: '33', black: [356, 208, 63.1], white: [254_684, 175_242, 59.2] },
  { fips: '50', black: [1_341, 280, 82.7], white: [167_579, 187_481, 47.2] },
  { fips: '25', black: [35_243, 2_812, 92.6], white: [3_087_146, 237_780, 92.8] },
  { fips: '44', black: [9_535, 474, 95.3], white: [515_011, 17_181, 96.8] },
  { fips: '09', black: [13_526, 1_216, 91.8], white: [985_275, 113_322, 89.7] },
  { fips: '36', black: [117_493, 16_705, 87.6], white: [7_061_643, 1_905_802, 78.7] },
  { fips: '34', black: [65_427, 24_333, 72.9], white: [1_840_560, 665_634, 73.4] },
  { fips: '42', black: [156_333, 37_586, 80.6], white: [4_472_318, 2_995_395, 59.9] },
  { fips: '39', black: [82_282, 29_170, 73.8], white: [2_532_143, 2_072_754, 55.0] },
  { fips: '18', black: [48_425, 11_595, 80.7], white: [1_095_026, 1_544_595, 41.5] },
  { fips: '17', black: [85_538, 23_511, 78.4], white: [3_388_581, 2_153_091, 61.1] },
  { fips: '26', black: [12_156, 4_959, 71.0], white: [1_314_186, 1_471_081, 47.2] },
  { fips: '55', black: [2_141, 759, 73.8], white: [1_001_416, 1_319_139, 43.2] },
  { fips: '27', black: [6_513, 566, 92.0], white: [843_322, 1_215_905, 41.0] },
  { fips: '19', black: [9_786, 5_187, 65.4], white: [670_035, 1_538_158, 30.3] },
  { fips: '29', black: [104_462, 52_990, 66.3], white: [1_233_554, 1_841_378, 40.1] },
  { fips: '38', black: [306, 311, 49.6], white: [62_795, 510_690, 11.0] },
  { fips: '46', black: [412, 405, 50.4], white: [76_079, 457_704, 14.3] },
  { fips: '31', black: [6_621, 1_068, 86.1], white: [303_787, 875_626, 25.8] },
  { fips: '20', black: [36_196, 17_834, 67.0], white: [456_579, 1_177_773, 27.9] },
  { fips: '10', black: [11_157, 20_024, 35.8], white: [85_903, 85_199, 50.2] },
  { fips: '24', black: [99_230, 133_020, 42.7], white: [558_583, 133_050, 80.8] },
  { fips: '11', black: [94_446, 0, 100], white: [236_128, 0, 100] },
  { fips: '51', black: [158_218, 512_878, 23.6], white: [318_159, 1_071_850, 22.9] },
  { fips: '54', black: [15_380, 48_786, 24.0], white: [212_738, 944_034, 18.4] },
  { fips: '37', black: [115_975, 581_858, 16.6], white: [205_438, 1_288_073, 13.8] },
  { fips: '45', black: [101_702, 734_141, 12.2], white: [123_089, 559_072, 18.0] },
  { fips: '13', black: [224_326, 862_161, 20.6], white: [313_809, 1_118_196, 21.9] },
  { fips: '12', black: [88_586, 220_083, 28.7], white: [130_302, 313_332, 29.4] },
  { fips: '21', black: [106_631, 155_025, 40.7], white: [445_727, 1_579_224, 22.0] },
  { fips: '47', black: [150_506, 322_582, 31.8], white: [290_431, 1_421_001, 17.0] },
  { fips: '01', black: [156_635, 751_647, 17.2], white: [213_756, 1_015_076, 17.4] },
  { fips: '28', black: [95_357, 914_130, 9.4], white: [111_826, 674_285, 14.2] },
  { fips: '05', black: [59_147, 383_744, 13.4], white: [143_426, 987_700, 12.7] },
  { fips: '22', black: [160_845, 553_029, 22.5], white: [335_175, 605_911, 35.6] },
  { fips: '40', black: [36_982, 100_530, 26.9], white: [276_668, 1_165_837, 19.2] },
  { fips: '48', black: [178_564, 511_185, 25.9], white: [758_534, 2_446_314, 23.7] },
  { fips: '30', black: [1_455, 379, 79.3], white: [130_531, 230_046, 36.2] },
  { fips: '16', black: [426, 225, 65.4], white: [66_004, 250_617, 20.8] },
  { fips: '56', black: [1_041, 1_104, 48.6], white: [41_484, 98_874, 29.6] },
  { fips: '08', black: [6_359, 2_091, 75.3], white: [604_159, 338_259, 64.1] },
  { fips: '35', black: [795, 843, 48.5], white: [45_358, 299_006, 13.2] },
  { fips: '04', black: [1_310, 699, 65.2], white: [60_335, 111_113, 35.2] },
  { fips: '49', black: [959, 185, 83.8], white: [170_884, 135_620, 55.8] },
  { fips: '32', black: [101, 412, 19.7], white: [12_729, 61_847, 17.1] },
  { fips: '53', black: [4_609, 1_359, 77.2], white: [500_181, 518_930, 49.1] },
  { fips: '41', black: [1_264, 228, 84.7], white: [297_095, 357_995, 45.4] },
  { fips: '06', black: [15_396, 3_246, 82.6], white: [1_407_251, 852_421, 62.3] },
];

/** Table 9 Negro urban/rural 1900 and 1890 (1910 is Table 8). */
const TABLE_9_EARLIER: readonly {
  readonly fips: string;
  readonly y1900: readonly [number, number, number];
  readonly y1890: readonly [number, number, number];
}[] = [
  { fips: 'US', y1900: [2_005_972, 6_828_022, 22.7], y1890: [1_481_142, 6_007_534, 19.8] },
  { fips: '23', y1900: [815, 401, 67.0], y1890: [792, 388, 67.1] },
  { fips: '33', y1900: [419, 243, 63.3], y1890: [300, 248, 54.7] },
  { fips: '50', y1900: [444, 384, 53.6], y1890: [460, 273, 62.8] },
  { fips: '25', y1900: [29_897, 2_167, 93.2], y1890: [20_427, 1_717, 92.2] },
  { fips: '44', y1900: [8_565, 369, 95.9], y1890: [7_044, 275, 96.2] },
  { fips: '09', y1900: [13_459, 1_767, 88.4], y1890: [10_574, 1_728, 86.0] },
  { fips: '36', y1900: [81_356, 12_876, 86.3], y1890: [51_364, 9_228, 84.8] },
  { fips: '34', y1900: [46_128, 23_716, 66.1], y1890: [25_045, 22_936, 52.2] },
  { fips: '42', y1900: [120_285, 39_560, 75.3], y1890: [76_939, 30_857, 71.4] },
  { fips: '39', y1900: [64_986, 31_915, 67.1], y1890: [61_124, 35_989, 62.9] },
  { fips: '18', y1900: [42_274, 15_831, 72.8], y1890: [28_839, 16_378, 63.8] },
  { fips: '17', y1900: [60_993, 24_265, 71.5], y1890: [34_076, 22_052, 60.7] },
  { fips: '26', y1900: [10_009, 5_837, 63.2], y1890: [8_734, 6_489, 57.4] },
  { fips: '55', y1900: [1_859, 583, 76.1], y1890: [1_440, 1_004, 58.9] },
  { fips: '27', y1900: [4_495, 494, 90.1], y1890: [3_286, 397, 89.2] },
  { fips: '19', y1900: [8_097, 4_638, 63.6], y1890: [6_635, 4_050, 62.1] },
  { fips: '29', y1900: [89_247, 71_287, 55.6], y1890: [70_636, 79_548, 47.0] },
  { fips: '38', y1900: [125, 181, 40.8], y1890: [81, 311, 20.7] },
  { fips: '46', y1900: [195, 270, 41.9], y1890: [149, 405, 26.9] },
  { fips: '31', y1900: [5_441, 1_008, 84.4], y1890: [7_188, 1_225, 85.4] },
  { fips: '20', y1900: [31_763, 20_240, 61.1], y1890: [25_170, 21_540, 53.9] },
  { fips: '10', y1900: [11_537, 19_150, 37.6], y1890: [9_428, 18_958, 33.2] },
  { fips: '24', y1900: [93_349, 141_215, 39.8], y1890: [79_392, 136_285, 36.8] },
  { fips: '11', y1900: [86_702, 0, 100], y1890: [75_572, 0, 100] },
  { fips: '51', y1900: [124_799, 536_203, 18.9], y1890: [117_092, 518_346, 18.4] },
  { fips: '54', y1900: [8_761, 54_783, 13.8], y1890: [6_327, 57_151, 10.0] },
  { fips: '37', y1900: [76_169, 548_323, 12.2], y1890: [55_935, 505_823, 10.0] },
  { fips: '45', y1900: [84_358, 697_931, 10.8], y1890: [64_049, 624_388, 9.3] },
  { fips: '13', y1900: [161_061, 874_163, 15.5], y1890: [123_862, 734_085, 14.4] },
  { fips: '12', y1900: [49_136, 181_564, 21.3], y1890: [35_102, 131_078, 21.1] },
  { fips: '21', y1900: [100_145, 184_561, 35.2], y1890: [75_274, 192_797, 28.1] },
  { fips: '47', y1900: [131_144, 348_805, 27.3], y1890: [94_076, 336_730, 21.8] },
  { fips: '01', y1900: [98_154, 729_153, 11.9], y1890: [69_607, 608_882, 10.3] },
  { fips: '28', y1900: [56_825, 850_805, 6.3], y1890: [34_192, 708_367, 4.6] },
  { fips: '05', y1900: [37_171, 329_685, 10.1], y1890: [25_491, 283_629, 8.2] },
  { fips: '22', y1900: [116_954, 533_850, 18.0], y1890: [87_094, 472_099, 15.6] },
  { fips: '40', y1900: [8_702, 46_982, 15.6], y1890: [679, 20_930, 3.1] },
  { fips: '48', y1900: [119_329, 501_333, 19.2], y1890: [79_481, 408_590, 16.3] },
  { fips: '30', y1900: [931, 592, 61.1], y1890: [628, 802, 43.9] },
  { fips: '16', y1900: [71, 222, 24.2], y1890: [51, 201, 20.2] },
  { fips: '56', y1900: [489, 451, 52.0], y1890: [327, 225, 59.3] },
  { fips: '08', y1900: [7_052, 1_518, 82.3], y1890: [5_009, 1_226, 80.3] },
  { fips: '35', y1900: [581, 1_033, 36.0], y1890: [274, 1_263, 17.8] },
  { fips: '04', y1900: [330, 699, 32.1], y1890: [274, 1_052, 20.7] },
  { fips: '49', y1900: [343, 329, 51.0], y1890: [294, 185, 61.4] },
  { fips: '32', y1900: [37, 413, 8.2], y1890: [107, 155, 40.8] },
  { fips: '53', y1900: [1_606, 908, 63.9], y1890: [973, 624, 60.9] },
  { fips: '41', y1900: [878, 227, 79.5], y1890: [597, 589, 50.3] },
  { fips: '06', y1900: [8_075, 2_970, 73.1], y1890: [6_338, 4_094, 60.8] },
];

function file(
  table: string,
  page: string,
  figures: readonly TranscribedFigure[],
): TranscribedFigureFile {
  return {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    table,
    page,
    boundaryVersion: 'us-states-1910',
    datasetVintage: '1918 printed bulletin',
    figures,
  };
}

function writeBoth(name: string, payload: TranscribedFigureFile): void {
  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../fixtures/lives/transcriptions',
  );
  mkdirSync(dir, { recursive: true });
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(path.join(dir, `${name}.pass-a.json`), json);
  writeFileSync(path.join(dir, `${name}.pass-b.json`), json);
  console.log(name, payload.figures.length, 'figures');
}

const table8: TranscribedFigure[] = [];
for (const row of TABLE_8_1910) {
  if (row.fips === 'US') continue;
  table8.push(figure(row.fips, '1910', 'black', ...row.black));
  table8.push(figure(row.fips, '1910', 'white', ...row.white));
}

const table9: TranscribedFigure[] = [];
for (const row of TABLE_9_EARLIER) {
  if (row.fips === 'US') continue;
  table9.push(figure(row.fips, '1900', 'black', ...row.y1900));
  table9.push(figure(row.fips, '1890', 'black', ...row.y1890));
}

writeBoth('1918-table-8-urban-1910-states', file('Table 8', '91', table8));
writeBoth('1918-table-9-urban-negro-1890-1900-states', file('Table 9', '92', table9));
