/**
 * repo-n7p6.3 (WS3) — street-address redaction for address-restricted properties.
 *
 * The National Register withholds locations for properties vulnerable to vandalism, looting or
 * trespass (archaeological sites, burial grounds, some rural churches and homesteads). 63 rows
 * in the nrhp-black-heritage lane carry `restrictedAddress: true`, and NPS's own published
 * dataset omits their addresses for that reason.
 *
 * The nomination PDF, however, is the full submitted form and states the address in plain text.
 * So capturing nomination narrative verbatim would put back exactly what the Register withheld,
 * in our database, for a model to later quote into public prose. Redaction happens here, at
 * capture time, rather than at publish time: evidence that was never stored cannot leak through
 * a later bug in a downstream gate.
 *
 * This is deliberately over-broad. Losing a sentence of description on 63 records is a cheap
 * mistake; publishing the location of an unprotected Black burial ground is not.
 */

/** Street types seen in nomination prose, including the abbreviations OCR tends to produce. */
const STREET_TYPES = [
  'street',
  'st',
  'avenue',
  'ave',
  'road',
  'rd',
  'drive',
  'dr',
  'lane',
  'ln',
  'boulevard',
  'blvd',
  'highway',
  'hwy',
  'route',
  'rte',
  'court',
  'ct',
  'place',
  'pl',
  'terrace',
  'trail',
  'parkway',
  'pkwy',
  'circle',
  'cir',
  'way',
  'pike',
  'row',
].join('|');

export const REDACTION_MARKER = '[address restricted]';

/**
 * "511 West South Street", "1121 Martin Luther King Jr. Drive", "N. 9th St."
 * A leading house number is required, so "South Street" as a bare place name survives while
 * anything that could route someone to the door does not.
 */
const STREET_ADDRESS_RE = new RegExp(
  String.raw`\b\d{1,6}[A-Za-z]?\s+(?:[NSEW]\.?|North|South|East|West|Northeast|Northwest|Southeast|Southwest\s+)?(?:[A-Z][A-Za-z.'-]*\s+){0,4}(?:${STREET_TYPES})\b\.?`,
  'giu',
);

/** Rural routes and box numbers, the usual form for restricted rural properties. */
const RURAL_ROUTE_RE =
  /\b(?:R\.?R\.?|Rural Route|H\.?C\.?R\.?|P\.?O\.?\s*Box|Box)\s*#?\s*\d+(?:\s*,?\s*Box\s*\d+)?/giu;

/** UTM / lat-long coordinate pairs printed in the nomination's geographical data section. */
const COORDINATE_RE =
  /\b(?:UTM|Zone|Easting|Northing|Latitude|Longitude)\b[^.\n]{0,60}?\d{2,7}[^.\n]{0,40}/giu;

/**
 * A bare decimal coordinate pair with no keyword in front of it — "34.052235, -118.243683".
 * COORDINATE_RE only fires on a labelled coordinate, so this shape leaked straight through.
 */
const BARE_COORDINATE_PAIR_RE = /-?\b\d{1,3}\.\d{4,8}\s*,\s*-?\d{1,3}\.\d{4,8}\b/gu;

/**
 * Distance-and-direction locators: "3 miles east of Whitesboro", "approximately 1.5 miles north
 * of the junction". This is how nominations describe exactly the properties whose addresses are
 * restricted — rural churches, isolated homesteads and burial grounds have no street address, so
 * the form locates them by bearing from a named landmark. Redacting street addresses while
 * leaving these in place would protect the properties that need it least.
 */
const DIRECTIONAL_LOCATOR_RE =
  /\b(?:approximately|about|roughly|some)?\s*\d+(?:\.\d+)?\s*(?:\/\d)?\s*(?:miles?|mi\.?|kilometers?|km|feet|ft\.?|yards?|blocks?)\s+(?:north|south|east|west|northeast|northwest|southeast|southwest|N|S|E|W|NE|NW|SE|SW)(?:east|west)?\s+of\s+[^.,;\n]{2,60}/giu;

/**
 * Plat legal descriptions — "Lot 14, Block 3 of the Smithfield Addition". A lot-and-block
 * reference locates a parcel as precisely as a street address does in any county recorder's
 * office, and it is the standard form on urban nominations.
 */
const LOT_BLOCK_RE =
  /\bLots?\.?\s*\d+[A-Za-z]?(?:\s*(?:-|through|and|,)\s*\d+[A-Za-z]?)*\s*,?\s*(?:Block|Blk\.?)\s*\d+[A-Za-z]?(?:\s*,?\s*of\s+(?:the\s+)?[^.,;\n]{2,50})?/giu;

/** Township-range-section legal descriptions, which locate a parcel precisely. */
const LEGAL_DESCRIPTION_RE =
  /\bT(?:ownship)?\.?\s*\d{1,3}\s*[NS]\.?,?\s*R(?:ange)?\.?\s*\d{1,3}\s*[EW]\.?(?:,?\s*(?:Sec(?:tion)?\.?\s*\d{1,2}))?/giu;

export type RedactionResult = {
  readonly text: string;
  readonly redactionCount: number;
};

/**
 * Replace anything that could locate the property with a marker. Returns the count so the
 * sweep can record on the evidence row how much was removed — a row showing zero redactions on
 * a restricted property is a signal the patterns missed something, not a clean bill of health.
 */
export function redactStreetAddresses(text: string): RedactionResult {
  let count = 0;
  const replace = (input: string, pattern: RegExp): string =>
    input.replace(pattern, () => {
      count += 1;
      return REDACTION_MARKER;
    });

  let out = text;
  out = replace(out, STREET_ADDRESS_RE);
  out = replace(out, RURAL_ROUTE_RE);
  out = replace(out, LOT_BLOCK_RE);
  out = replace(out, LEGAL_DESCRIPTION_RE);
  out = replace(out, COORDINATE_RE);
  out = replace(out, BARE_COORDINATE_PAIR_RE);
  // Last: a directional locator often trails a landmark that earlier patterns already masked,
  // and running it after them keeps the marker from being swallowed into this match.
  out = replace(out, DIRECTIONAL_LOCATOR_RE);

  return { text: out, redactionCount: count };
}
