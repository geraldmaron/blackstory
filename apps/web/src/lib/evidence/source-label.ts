/**
 * Plain names for source ids the archive stores (`wikipedia_api`, `wikimedia_commons`). A public
 * page never prints an internal id: the web display layer maps it here, and an id with no name
 * falls back to the source link's host, then to the id spelled as words.
 */
export const SOURCE_LABELS: Readonly<Record<string, string>> = {
  wikipedia_api: 'Wikipedia',
  wikidata_api: 'Wikidata',
  wikimedia_commons: 'Wikimedia Commons',
  nps: 'National Park Service',
  loc: 'Library of Congress',
  public_media: 'BlackStory public media',
};

const INTERNAL_ID = /^[a-z0-9]+(_[a-z0-9]+)+$/;

function hostOf(href: string | undefined): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href).hostname.replace(/^www\./i, '') || undefined;
  } catch {
    return undefined;
  }
}

export function sourceDisplayName(raw: string, href?: string): string {
  const text = raw.trim();
  const named = SOURCE_LABELS[text.toLowerCase()];
  if (named) return named;
  if (!INTERNAL_ID.test(text)) return text;
  return hostOf(href) ?? text.replace(/_/g, ' ');
}
