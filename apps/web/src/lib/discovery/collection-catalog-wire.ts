/** Lossless catalog transport only. Matching always receives ordinary string haystacks. */
import type { AtlasCatalogPayload } from '../../app/explore/explore-view-model-wire';
import type { CollectionFacts } from '../records/records-matching';

type StoryTextReference = readonly [featureIndex: number, before: string, after: string];
type CollectionFactWire = Omit<CollectionFacts, 'haystack'> & {
  readonly haystack: string | StoryTextReference;
};
export type CollectionCatalogWire = Omit<AtlasCatalogPayload, 'collectionFacts'> & {
  readonly collectionTextEncoding: 'story-v1';
  readonly collectionFacts: readonly CollectionFactWire[];
};

export function encodeCollectionCatalog(payload: AtlasCatalogPayload): CollectionCatalogWire {
  if (!payload.collectionFacts) throw new Error('atlas catalog: missing collection facts');
  const features = payload.source.featureCollection.features;
  const byEntity = new Map(features.map((feature, index) => [feature.properties.entityId, index]));
  const collectionFacts = payload.collectionFacts.map((fact): CollectionFactWire => {
    const featureIndex = byEntity.get(fact.row.id);
    if (featureIndex === undefined) return fact;
    const story = features[featureIndex]!.properties.oneLineStory.toLowerCase();
    if (!story) return fact;
    const offset = fact.haystack.indexOf(story);
    if (offset < 0) return fact;
    const reference: StoryTextReference = [
      featureIndex,
      fact.haystack.slice(0, offset),
      fact.haystack.slice(offset + story.length),
    ];
    if (JSON.stringify(reference).length >= JSON.stringify(fact.haystack).length) return fact;
    return { ...fact, haystack: reference };
  });
  return { ...payload, collectionTextEncoding: 'story-v1', collectionFacts };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reject malformed references before caching the catalog or running any match predicate. */
export function decodeCollectionCatalog(input: unknown): AtlasCatalogPayload {
  const fail = (): never => {
    throw new Error('atlas catalog: unexpected collection transport');
  };
  if (
    !isObject(input) ||
    input.schemaVersion !== 1 ||
    !isObject(input.source) ||
    !isObject(input.source.featureCollection) ||
    !Array.isArray(input.source.featureCollection.features) ||
    !Array.isArray(input.collectionFacts)
  )
    return fail();
  const encoding = input.collectionTextEncoding;
  if (encoding !== undefined && encoding !== 'story-v1') return fail();
  const features = input.source.featureCollection.features;
  const collectionFacts = input.collectionFacts.map((fact): CollectionFacts => {
    if (
      !isObject(fact) ||
      !isObject(fact.row) ||
      typeof fact.row.id !== 'string' ||
      typeof fact.mappable !== 'boolean'
    )
      return fail();
    if (typeof fact.haystack === 'string') return fact as CollectionFacts;
    const reference = fact.haystack;
    if (
      encoding !== 'story-v1' ||
      !Array.isArray(reference) ||
      reference.length !== 3 ||
      !Number.isSafeInteger(reference[0]) ||
      reference[0] < 0 ||
      reference[0] >= features.length ||
      typeof reference[1] !== 'string' ||
      typeof reference[2] !== 'string'
    )
      return fail();
    const feature = features[reference[0]];
    if (
      !isObject(feature) ||
      !isObject(feature.properties) ||
      feature.properties.entityId !== fact.row.id ||
      typeof feature.properties.oneLineStory !== 'string' ||
      feature.properties.oneLineStory.length === 0
    )
      return fail();
    return {
      ...fact,
      haystack: reference[1] + feature.properties.oneLineStory.toLowerCase() + reference[2],
    } as CollectionFacts;
  });
  const { collectionTextEncoding: _encoding, ...payload } = input;
  return { ...(payload as unknown as AtlasCatalogPayload), collectionFacts };
}
