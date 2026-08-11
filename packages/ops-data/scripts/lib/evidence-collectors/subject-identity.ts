/**
 * repo-ppeu — the identity gate shared by every collector that finds a document by SEARCH.
 *
 * Background, measured rather than assumed. In the 2026-08-10 enrichment round, 9 of 24 subjects
 * (37.5%) had been given evidence documenting a different subject entirely: a house matched to an
 * article about a gubernatorial election, a Virginia church matched to Covington KENTUCKY, a
 * clinic matched to the town it sits in, a Rosenwald teacherage matched to a dictionary definition
 * of the word "teacherage". Every one was caught only because a human-in-the-loop drafter read the
 * evidence and refused to write from it. Nothing downstream can catch this: the citation validator
 * checks that a quote is a verbatim substring of the captured document, and it is — the document
 * is simply about something else. So the gate has to be here, at capture.
 *
 * Why the old gates let those through:
 *
 *   - `articleCorroboratesPlace` (wikipedia) accepted if ANY ONE of city/county/state appeared.
 *     State alone passes for every article about anything in Virginia; city alone passes for the
 *     same-named city in the wrong state. Neither says anything about the SUBJECT.
 *   - the reference-hop capture check accepted if any one subject token appeared anywhere in the
 *     page, and `subjectTokens` folds place words in — so, again, "Virginia" was enough.
 *
 * `checkNominationIdentity` was already stricter (state AND locality) because it was written after
 * the same failure showed up in nomination forms. This module lifts that rule out of the
 * nomination collector so there is ONE implementation, and adds the two tests a searched document
 * needs that a refnum-addressed one does not:
 *
 *   1. NAME. A nomination form is fetched by refnum, so the document is about the right property
 *      by construction and a name check is only a tie-breaker. A searched document has no such
 *      anchor: the name is the only thing tying the text to the row, so a majority of the row's
 *      distinctive name tokens must actually appear.
 *   2. FOCUS. "Mentions the subject" is not "is about the subject". A county listings table names
 *      Blandome once in a row of a table; an article about Blandome names it in its first
 *      sentence. So a distinctive name token must appear in the document's opening, or often
 *      enough overall that the document is plainly discussing it.
 *
 * Plus an explicit reject for the two document KINDS that pass every content test by accident:
 * disambiguation pages and index/list pages ("National Register of Historic Places listings in
 * Lexington, Virginia" corroborates place perfectly and contains the name — it is still a table
 * of contents, not history).
 *
 * Everything here is pure string work so the rules are unit-testable and can be backtested
 * against already-captured evidence without refetching anything.
 */

/** A distinctive name token must appear within this many leading characters to count as focus. */
export const LEAD_WINDOW_CHARS = 1_200;

/**
 * ...or this many times anywhere in the document. The lead window is the primary signal, but page
 * text extracted from HTML often carries navigation chrome ahead of the article body, which would
 * push a genuine lead sentence out of the window. Repeated naming is the fallback evidence that a
 * document is discussing the subject rather than listing it once.
 */
export const MIN_FOCUS_MENTIONS = 3;

/**
 * Descriptors shared by so many entries in these rosters that matching one says nothing about
 * identity. Kept in sync in spirit with reference-hops' GENERIC_TOKENS, but this list stays
 * narrower: it is filtering a NAME, where "Baptist" and "Rosenwald" are the signal and only the
 * structural nouns are noise.
 */
const GENERIC_NAME_TOKENS = new Set([
  'house',
  'home',
  'historic',
  'district',
  'building',
  'site',
  'school',
  'church',
  // Structural nouns that name a building TYPE. Kept out of the token set because the focus test
  // picks the longest token as the subject's most specific word, and "cemetery" winning that role
  // let an article about the Forks of Cypress mansion stand in for the Forks of Cypress Cemetery.
  'cemetery',
  'chapel',
  'hotel',
  'hospital',
  'library',
  'lodge',
  'museum',
  'memorial',
  'theatre',
  'theater',
  'college',
  'university',
  'the',
  'and',
  'for',
]);

/**
 * Place names disagree between the roster and a document in ways that are purely orthographic:
 * the roster files DeKalb County as "De Kalb", documents print "DeKalb", and either may carry
 * punctuation ("St. Louis" / "St Louis"). Comparing on letters alone stops those from reading as
 * a genuine identity failure — which they did: both nomination quarantines in the first batch were
 * real documents about the right property, refused over a space.
 */
export function normalizePlace(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/gu, '');
}

/**
 * Fold internal punctuation without destroying word boundaries: "Wells'Built" and "Well'sbuilt"
 * both become "wellsbuilt", "St. Mary's" becomes "st marys". Splitting on punctuation instead
 * (the earlier approach) turned "Well'sbuilt Hotel" into the tokens "well" and "sbuilt", neither
 * of which appears in an article titled "Wells'Built Museum" — a real capture refused over an
 * apostrophe. Spaces survive so tokens still match at word boundaries.
 */
export function foldPunctuation(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Roster names are inverted for filing ("Jude, George, House"); compare on the bare tokens. Run
 * the document through `foldPunctuation` too, or these will not match it.
 */
export function significantNameTokens(displayName: string): readonly string[] {
  return [
    ...new Set(
      foldPunctuation(displayName)
        .split(' ')
        .filter((token) => token.length > 3 && !GENERIC_NAME_TOKENS.has(token)),
    ),
  ];
}

/**
 * Documents name states the way people write addresses, not the way the roster stores them: an
 * article about the Whitelaw Hotel says "Washington, D.C." and never "District of Columbia", and a
 * county history says "Selma, Ala." A full-name-only comparison reads those as a state MISMATCH
 * and refuses a document that is plainly about the right place — the false negative that would
 * make this gate cost more research than the mismatches it prevents.
 *
 * Both the postal code and the traditional (AP) abbreviation are listed. Short aliases are matched
 * case-SENSITIVELY at a word boundary (see `mentionsState`) so that "IN" for Indiana and "OR" for
 * Oregon cannot match the English words.
 */
const STATE_ALIASES: ReadonlyMap<string, readonly string[]> = new Map([
  ['alabama', ['AL', 'Ala.']],
  ['alaska', ['AK']],
  ['arizona', ['AZ', 'Ariz.']],
  ['arkansas', ['AR', 'Ark.']],
  ['california', ['CA', 'Calif.']],
  ['colorado', ['CO', 'Colo.']],
  ['connecticut', ['CT', 'Conn.']],
  ['delaware', ['DE', 'Del.']],
  ['district of columbia', ['DC', 'D.C.']],
  ['florida', ['FL', 'Fla.']],
  ['georgia', ['GA', 'Ga.']],
  ['hawaii', ['HI']],
  ['idaho', ['ID']],
  ['illinois', ['IL', 'Ill.']],
  ['indiana', ['IN', 'Ind.']],
  ['iowa', ['IA']],
  ['kansas', ['KS', 'Kan.']],
  ['kentucky', ['KY', 'Ky.']],
  ['louisiana', ['LA', 'La.']],
  ['maine', ['ME']],
  ['maryland', ['MD', 'Md.']],
  ['massachusetts', ['MA', 'Mass.']],
  ['michigan', ['MI', 'Mich.']],
  ['minnesota', ['MN', 'Minn.']],
  ['mississippi', ['MS', 'Miss.']],
  ['missouri', ['MO', 'Mo.']],
  ['montana', ['MT', 'Mont.']],
  ['nebraska', ['NE', 'Neb.']],
  ['nevada', ['NV', 'Nev.']],
  ['new hampshire', ['NH', 'N.H.']],
  ['new jersey', ['NJ', 'N.J.']],
  ['new mexico', ['NM', 'N.M.']],
  ['new york', ['NY', 'N.Y.']],
  ['north carolina', ['NC', 'N.C.']],
  ['north dakota', ['ND', 'N.D.']],
  ['ohio', ['OH']],
  ['oklahoma', ['OK', 'Okla.']],
  ['oregon', ['OR', 'Ore.']],
  ['pennsylvania', ['PA', 'Pa.']],
  ['rhode island', ['RI', 'R.I.']],
  ['south carolina', ['SC', 'S.C.']],
  ['south dakota', ['SD', 'S.D.']],
  ['tennessee', ['TN', 'Tenn.']],
  ['texas', ['TX', 'Tex.']],
  ['utah', ['UT']],
  ['vermont', ['VT', 'Vt.']],
  ['virginia', ['VA', 'Va.']],
  ['washington', ['WA', 'Wash.']],
  ['west virginia', ['WV', 'W.Va.', 'W. Va.']],
  ['wisconsin', ['WI', 'Wis.']],
  ['wyoming', ['WY', 'Wyo.']],
  ['puerto rico', ['PR', 'P.R.']],
  ['virgin islands', ['VI', 'V.I.']],
]);

/** Does the document name this state, by full name or by a conventional abbreviation? */
export function mentionsState(documentText: string, state: string): boolean {
  const wanted = state.trim().toLowerCase();
  if (wanted.length === 0) return false;
  if (documentText.toLowerCase().includes(wanted)) return true;
  if (normalizePlace(documentText).includes(normalizePlace(wanted))) return true;
  for (const alias of STATE_ALIASES.get(wanted) ?? []) {
    // Case-sensitive and boundary-anchored: "IN", "OR", "ME" and "OK" are all English words in
    // lower case, and an abbreviation in running text is always capitalized.
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (new RegExp(String.raw`(?<![A-Za-z])${escaped}(?![A-Za-z])`, 'u').test(documentText)) {
      return true;
    }
  }
  return false;
}

export type SubjectExpectation = {
  readonly displayName: string;
  readonly state?: string | undefined;
  readonly county?: string | undefined;
  readonly city?: string | undefined;
};

export type PlaceIdentity = {
  readonly stateMatch: boolean;
  readonly countyMatch: boolean;
  readonly cityMatch: boolean;
  /**
   * Whether the ROSTER row offered any place to check against. Person-kind rows carry none, so for
   * them `placeCorroborated` is false for want of a question, not for a failed answer — the two
   * must be distinguishable or every biography's evidence is condemned. (Measured: the first audit
   * run rejected the NPS biography of Eliza Ann Gardner as evidence for Eliza Ann Gardner.)
   */
  readonly placeKnown: boolean;
  /** False when place does not corroborate — caller must quarantine rather than store. */
  readonly placeCorroborated: boolean;
};

/**
 * Does the document's text agree with the row's place?
 *
 * State plus a locality. City counts as well as county — urban records routinely name the city and
 * never the county, and a city match is the stronger signal of the two anyway. When the roster gave
 * no state, any locality agreement is all that is available; when it gave no locality, the state
 * alone has to do. The AND is the whole point: "Covington" alone matched Covington, Kentucky.
 */
export function checkPlaceIdentity(documentText: string, expected: SubjectExpectation): PlaceIdentity {
  const haystack = documentText.toLowerCase();
  const packed = normalizePlace(documentText);
  const present = (value: string | undefined): boolean => {
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed.length === 0) return false;
    return haystack.includes(trimmed.toLowerCase()) || packed.includes(normalizePlace(trimmed));
  };

  const stateMatch =
    expected.state !== undefined && expected.state.trim().length > 0
      ? mentionsState(documentText, expected.state)
      : false;
  const countyMatch = present(expected.county);
  const cityMatch = present(expected.city);

  const hasState = (expected.state?.trim().length ?? 0) > 0;
  const localityMatch = countyMatch || cityMatch;
  const hasLocality =
    (expected.county?.trim().length ?? 0) > 0 || (expected.city?.trim().length ?? 0) > 0;
  const placeCorroborated = hasState
    ? hasLocality
      ? stateMatch && localityMatch
      : stateMatch
    : localityMatch;

  return {
    stateMatch,
    countyMatch,
    cityMatch,
    placeKnown: hasState || hasLocality,
    placeCorroborated,
  };
}

export type DocumentKind = 'subject' | 'disambiguation' | 'index';

/**
 * True for a MediaWiki disambiguation page ("Maplewood may refer to: ..."). These pass a place
 * check for free: a disambiguation page enumerating many same-named places will very often happen
 * to mention the target city/county/state somewhere in its list. Disambiguation pages open with
 * this phrase as their first sentence by MediaWiki convention, so a prefix check is reliable
 * without an extra API call.
 */
export function isDisambiguationExtract(extract: string): boolean {
  return /^\s*\S[^.]{0,80}\bmay refer to\b/iu.test(extract);
}

/**
 * True for an index: a list, a listings table, an outline, a category roll-up. These are the
 * hardest false positives because they are legitimately ABOUT the right county in the right state
 * and they do contain the subject's name — once, in a row. Publishing from one produces prose that
 * says a building is on a list, which is precisely the registry-restatement problem this whole
 * enrichment effort exists to fix.
 */
export function isIndexDocument(title: string | null | undefined, text: string): boolean {
  const head = (title ?? '').trim().toLowerCase();
  if (
    /^(?:lists? of|index of|outline of|category:|national register of historic places listings)/u.test(
      head,
    )
  ) {
    return true;
  }
  const opening = text.slice(0, 400).toLowerCase();
  // The document must ANNOUNCE itself as a list. A bare "list of" anywhere in the opening also
  // matches navigation chrome ("List of parks" in an NPS site menu), which wrongly condemned real
  // biography pages in the first audit run — so the copular form is required, or the very start.
  return (
    /^\s*(?:lists?|index) of\b/u.test(opening) ||
    /\b(?:is|are) a (?:complete |partial |sortable )?(?:list|index) of\b/u.test(opening)
  );
}

export type SubjectIdentity = PlaceIdentity & {
  readonly documentKind: DocumentKind;
  readonly nameTokens: readonly string[];
  readonly nameHits: number;
  /** A majority of the row's distinctive name tokens appear in the document. */
  readonly nameCorroborated: boolean;
  /** Name tokens that are not simply the row's own city/county/state. */
  readonly distinctiveTokens: readonly string[];
  /** The document opens on the subject, or names it repeatedly — it is ABOUT the subject. */
  readonly focusCorroborated: boolean;
  /** All gates passed; safe to store as evidence for this entity. */
  readonly corroborated: boolean;
  /** Why it failed, for the evidence row's quarantineReason. Undefined when corroborated. */
  readonly reason?: string;
};

/**
 * The full gate for a document found by search. Fails closed: a row whose displayName yields no
 * distinctive tokens at all cannot be corroborated by this route, because there would be nothing
 * left tying the text to the row but the place — which is the exact failure being fixed.
 */
export function checkSubjectIdentity(
  documentText: string,
  expected: SubjectExpectation,
  options: { readonly title?: string | null } = {},
): SubjectIdentity {
  const place = checkPlaceIdentity(documentText, expected);
  const haystack = foldPunctuation(documentText);
  const lead = haystack.slice(0, LEAD_WINDOW_CHARS);

  const documentKind: DocumentKind = isDisambiguationExtract(documentText)
    ? 'disambiguation'
    : isIndexDocument(options.title, documentText)
      ? 'index'
      : 'subject';

  const nameTokens = significantNameTokens(expected.displayName);
  const nameHits = nameTokens.filter((token) => haystack.includes(token)).length;
  // Majority of distinctive name tokens present. A document genuinely about the subject names it
  // repeatedly, so a real match is never marginal.
  const nameCorroborated = nameTokens.length > 0 && nameHits / nameTokens.length >= 0.5;

  /**
   * Name tokens that are not simply the row's own place. "Wilmington Historic District" in
   * Wilmington offers the single token "wilmington", which every page about the city satisfies —
   * a National Weather Service page titled "Wilmington's Race to 100 inches!" cleared the name and
   * place gates on exactly that basis. A name that only repeats its location carries no
   * independent identity, so it cannot be the thing that ties a searched document to the row.
   */
  const placeWords = new Set(
    [expected.city, expected.county, expected.state]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .flatMap((value) => foldPunctuation(value).split(' ')),
  );
  const distinctiveTokens = nameTokens.filter((token) => !placeWords.has(token));

  // Focus is measured on the token most specific to this subject — the longest DISTINCTIVE one —
  // rather than on any token, so that neither a place word nor a common surname carried by an
  // unrelated article can supply it.
  const focusToken = [...distinctiveTokens].sort((a, b) => b.length - a.length)[0];
  const mentions = focusToken === undefined ? 0 : haystack.split(focusToken).length - 1;
  const focusCorroborated =
    focusToken !== undefined && (lead.includes(focusToken) || mentions >= MIN_FOCUS_MENTIONS);

  // A row with no place on it (person-kind rows, chiefly) is carried by name and focus alone.
  // That is weaker, and it is also the only signal that exists — refusing every such document
  // would not make the corpus more honest, it would empty it.
  const reason =
    documentKind !== 'subject'
      ? `document is a ${documentKind} page, not a source about the subject`
      : place.placeKnown && !place.placeCorroborated
        ? 'identity not corroborated by place (state and locality must both agree)'
        : !nameCorroborated
          ? `identity not corroborated by name (${nameHits}/${nameTokens.length} distinctive tokens)`
          : distinctiveTokens.length === 0
            ? 'name carries no identity independent of its place'
            : !focusCorroborated
              ? 'document mentions the subject but is not about it'
              : undefined;

  return {
    ...place,
    documentKind,
    nameTokens,
    nameHits,
    nameCorroborated,
    distinctiveTokens,
    focusCorroborated,
    corroborated: reason === undefined,
    reason,
  };
}
