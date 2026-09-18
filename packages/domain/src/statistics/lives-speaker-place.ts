/**
 * Whether a testimony speaker’s named place sits outside the selected Lives area’s states.
 */
import { LIVES_NATIONAL, type LivesAreaConfig } from './lives-regions.js';

const STATE_NAME_TO_FIPS: Readonly<Record<string, string>> = {
  alabama: '01',
  alaska: '02',
  arizona: '04',
  arkansas: '05',
  california: '06',
  colorado: '08',
  connecticut: '09',
  delaware: '10',
  'district of columbia': '11',
  florida: '12',
  georgia: '13',
  hawaii: '15',
  idaho: '16',
  illinois: '17',
  indiana: '18',
  iowa: '19',
  kansas: '20',
  kentucky: '21',
  louisiana: '22',
  maine: '23',
  maryland: '24',
  massachusetts: '25',
  michigan: '26',
  minnesota: '27',
  mississippi: '28',
  missouri: '29',
  montana: '30',
  nebraska: '31',
  nevada: '32',
  'new hampshire': '33',
  'new jersey': '34',
  'new mexico': '35',
  'new york': '36',
  'north carolina': '37',
  'north dakota': '38',
  ohio: '39',
  oklahoma: '40',
  oregon: '41',
  pennsylvania: '42',
  'rhode island': '44',
  'south carolina': '45',
  'south dakota': '46',
  tennessee: '47',
  texas: '48',
  utah: '49',
  vermont: '50',
  virginia: '51',
  washington: '53',
  'west virginia': '54',
  wisconsin: '55',
  wyoming: '56',
};

/** FIPS codes named in a free-text place string, or empty when none match. */
export function livesFipsMentionedInPlace(place: string): readonly string[] {
  const lower = place.toLowerCase();
  const hits: string[] = [];
  for (const [name, fips] of Object.entries(STATE_NAME_TO_FIPS)) {
    if (lower.includes(name)) hits.push(fips);
  }
  return hits;
}

/**
 * True when the speaker names at least one state and none of those states are in the area.
 * National baseline never mismatches. Unknown places (no state name) stay unmarked.
 */
export function livesSpeakerPlaceMismatch(
  place: string | undefined,
  area: Pick<LivesAreaConfig, 'id' | 'kind' | 'memberStateFips'>,
): boolean {
  if (!place || area.kind === 'nation' || area.id === LIVES_NATIONAL.id) return false;
  const mentioned = livesFipsMentionedInPlace(place);
  if (mentioned.length === 0) return false;
  const members = new Set(area.memberStateFips);
  return mentioned.every((fips) => !members.has(fips));
}
