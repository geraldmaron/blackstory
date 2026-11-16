// The National Register files "Women's Building, The"; readers say "The Women's Building".
const TRAILING_ARTICLE = /^(.+?),\s*(the|a|an)$/iu;

export function uninvertLeadingArticle(name: string): string {
  const m = TRAILING_ARTICLE.exec(name.trim());
  return m ? `${m[2]![0]!.toUpperCase()}${m[2]!.slice(1).toLowerCase()} ${m[1]}` : name;
}
