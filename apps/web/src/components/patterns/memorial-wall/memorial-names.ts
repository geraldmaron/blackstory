/**
 * Curated memorial name roll for the /memorial edition wall and readable list.
 *
 * Sourced from the shared verified archive at
 * `apps/web/src/components/atmosphere/memorial-names.json` (built from
 * docs/research/police-violence-memorial-names.json and
 * docs/research/racial-terror-memorial-names.json — see
 * docs/research/memorial-names-wall.sources.json), merged with a small set of
 * names curated for this wall before the shared archive existed and not yet
 * present there. Spellings are passed through verbatim; only the plate
 * eligibility filter is applied. Incomplete by design.
 */
import {
  MEMORIAL_NAMES as MEMORIAL_ARCHIVE_ENTRIES,
  MEMORIAL_NAMES_REQUIRED,
  isMemorialNamePlateEligible,
  type MemorialNameEntry,
} from '../../atmosphere/memorial-names';

export { MEMORIAL_NAMES_REQUIRED, isMemorialNamePlateEligible };
export type { MemorialNameEntry };

export const MEMORIAL_HANDWRITING_FONT_VARS = [
  'var(--ds-font-hand-caveat)',
  'var(--ds-font-hand-patrick)',
  'var(--ds-font-hand-shadows)',
  'var(--ds-font-hand-indie)',
  'var(--ds-font-hand-architects)',
  'var(--ds-font-hand-homemade)',
] as const;

/**
 * Names curated for this wall before the shared archive existed. Verified
 * previously; kept verbatim since they are not yet present in the archive
 * dataset. Follow-up: fold these into docs/research/*.json with sourcing so
 * every memorial name lives in one place.
 */
const LEGACY_SUPPLEMENTAL_NAMES: readonly string[] = Object.freeze([
  'Andrew Goodman',
  'Andrew Joseph III',
  'Antwon Rose II',
  'Clementa Pinckney',
  'Cynthia Hurd',
  'Daniel Simmons',
  'Depayne Middleton Doctor',
  'Ethel Lance',
  'Jordan Davis',
  'Michael Schwerner',
  'Renisha McBride',
  'Rodney King',
  'Sharonda Coleman Singleton',
  'Viola Liuzzo',
  'Keith Scott',
]);

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mergeUniqueNames(...lists: readonly (readonly string[])[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const name of list) {
      const key = normalizeNameKey(name);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      out.push(name);
    }
  }
  return Object.freeze(out);
}

const archiveEligibleNames = MEMORIAL_ARCHIVE_ENTRIES.filter(isMemorialNamePlateEligible).map(
  (entry) => entry.name,
);

/** Full memorial name list (unique, plate-eligible). Display list is alphabetical; wall placement is packed randomly. */
export const MEMORIAL_NAMES: readonly string[] = mergeUniqueNames(
  archiveEligibleNames,
  LEGACY_SUPPLEMENTAL_NAMES,
  MEMORIAL_NAMES_REQUIRED,
);

export function memorialNamesAlphabetical(): readonly string[] {
  return [...MEMORIAL_NAMES].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
}

/**
 * Index letter for a name: its first actual letter, ignoring leading punctuation
 * and stripping diacritics so `"General" Lee` files under G rather than under a
 * quote mark, and an accented initial files with its base letter. Names with no
 * letter at all (none today) fall back to `#` so the grouping is total.
 */
export function memorialNameInitial(name: string): string {
  const letter = /\p{L}/u.exec(name)?.[0];
  if (letter === undefined) {
    return '#';
  }
  return letter.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

export type MemorialNameGroup = {
  /** Single index character, `A`–`Z` or `#`. */
  readonly letter: string;
  readonly names: readonly string[];
};

/**
 * The alphabetical list split into one group per index letter.
 *
 * The memorial list runs to well over a thousand names, which as one flat `<ul>`
 * is tens of screens of undifferentiated scrolling with no way to tell where you
 * are or to reach a particular name. Grouping gives the list headings to scroll
 * against and anchors to jump to, without paginating it — the names are the
 * point, and they stay on one page, together.
 *
 * Ordering is by index letter first, then by name within the letter, so the
 * groups read in the same order as the flat list did apart from the handful of
 * quote-prefixed names, which now sit with their letter instead of ahead of A.
 */
export function memorialNamesByInitial(): readonly MemorialNameGroup[] {
  const groups = new Map<string, string[]>();
  for (const name of MEMORIAL_NAMES) {
    const letter = memorialNameInitial(name);
    const bucket = groups.get(letter);
    if (bucket) {
      bucket.push(name);
    } else {
      groups.set(letter, [name]);
    }
  }
  return (
    [...groups.entries()]
      .map(([letter, names]) => ({
        letter,
        names: names.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
      }))
      // `#` last: it is the catch-all, not a letter, so it belongs after Z.
      .sort((a, b) =>
        a.letter === '#' ? 1 : b.letter === '#' ? -1 : a.letter.localeCompare(b.letter, 'en'),
      )
  );
}

/**
 * Years for the 15 legacy supplemental names (not yet in the shared archive,
 * so they carry no `.year` field there). Well-documented public record dates
 * for the underlying event: 1964 Freedom Summer murders, 1965 Selma-related
 * killing, 2015 Charleston church shooting, and individually reported cases.
 */
const LEGACY_SUPPLEMENTAL_YEARS: ReadonlyMap<string, number> = new Map([
  ['Andrew Goodman', 1964],
  ['Andrew Joseph III', 2014],
  ['Antwon Rose II', 2018],
  ['Clementa Pinckney', 2015],
  ['Cynthia Hurd', 2015],
  ['Daniel Simmons', 2015],
  ['Depayne Middleton Doctor', 2015],
  ['Ethel Lance', 2015],
  ['Jordan Davis', 2012],
  ['Michael Schwerner', 1964],
  ['Renisha McBride', 2013],
  ['Rodney King', 1991],
  ['Sharonda Coleman Singleton', 2015],
  ['Viola Liuzzo', 1965],
  ['Keith Scott', 2016],
]);

const nameYearByKey: ReadonlyMap<string, number> = (() => {
  const map = new Map<string, number>();
  for (const entry of MEMORIAL_ARCHIVE_ENTRIES) {
    const key = normalizeNameKey(entry.name);
    if (!map.has(key)) {
      map.set(key, entry.year);
    }
  }
  for (const [name, year] of LEGACY_SUPPLEMENTAL_YEARS) {
    const key = normalizeNameKey(name);
    if (!map.has(key)) {
      map.set(key, year);
    }
  }
  return map;
})();

/** Year of record for a memorial name, when known (undefined for a handful without one). */
export function memorialNameYear(name: string): number | undefined {
  return nameYearByKey.get(normalizeNameKey(name));
}
