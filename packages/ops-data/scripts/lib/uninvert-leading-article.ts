// The National Register files "Women's Building, The"; readers say "The Women's Building".
const TRAILING_ARTICLE = /^(.+?),\s*(the|a|an)$/iu;

export function uninvertLeadingArticle(name: string): string {
  const m = TRAILING_ARTICLE.exec(name.trim());
  return m ? `${m[2]![0]!.toUpperCase()}${m[2]!.slice(1).toLowerCase()} ${m[1]}` : name;
}

const GENERATION = /^(?:jr|sr|ii|iii|iv)\.?$/iu;
const TRAILING_GENERATION = /^(.+?)\s+((?:jr|sr)\.?|ii|iii|iv)$/iu;
const balanced = (part: string) =>
  (part.match(/"/gu)?.length ?? 0) % 2 === 0 &&
  (part.match(/\(/gu)?.length ?? 0) === (part.match(/\)/gu)?.length ?? 0);

/**
 * The Register also files a person's property surname first ("Evers, Medgar, House"); readers say
 * "Medgar Evers House". Anything that is not plainly surname, given name, property type (a list of
 * places, a quoted nickname split by its comma, a fourth part) comes back unchanged.
 * shortcut: a list of surnames ("Young, Browne, Phelps and Springarn ... Campus") has the same
 * shape and is reordered wrongly, so new roster names still need a reader's eye.
 */
export function uninvertFiledName(name: string): string {
  const article = uninvertLeadingArticle(name);
  if (article !== name) return article;
  const parts = name.split(',').map((part) => part.trim());
  const surname = parts[0] ?? '';
  let given = parts[1] ?? '';
  const rest = parts.slice(2);
  // "King, Martin Luther, Jr., Historic District" files the generation as its own part.
  let generation = rest.length === 2 && GENERATION.test(rest[0]!) ? rest.shift()! : '';
  const type = rest[0] ?? '';
  if (rest.length !== 1 || !surname || !given || !type) return name;
  if (name.includes(';') || !parts.every(balanced)) return name;
  if (surname.split(/\s+/u).length > 2 || /\band\b/iu.test(surname) || /^(?:and\b|&)/iu.test(type))
    return name;
  // "Gardner, Isaac Sr., House": the generation follows the surname once the name is in order.
  const tail = generation ? null : TRAILING_GENERATION.exec(given);
  if (tail) [, given, generation] = tail as unknown as [string, string, string];
  return [given, surname, generation, type].filter(Boolean).join(' ');
}
