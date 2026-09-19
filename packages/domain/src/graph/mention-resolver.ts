/** Resolve stored entity references by exact catalog id. Names and aliases are research leads. */
export type MentionResolvableEntity = {
  readonly id: string;
  readonly displayName?: string;
  readonly aliases?: readonly string[];
};
export type MentionResolverIndex = { readonly byId: ReadonlyMap<string, MentionResolvableEntity> };

export function buildMentionResolverIndex(
  entities: readonly MentionResolvableEntity[],
): MentionResolverIndex {
  return { byId: new Map(entities.map((entity) => [entity.id, entity])) };
}

/** A public relationship cannot be inferred from a legacy tag, acronym, or same-name match. */
export function resolveMentionToken(
  token: string,
  index: MentionResolverIndex,
): string | undefined {
  return index.byId.has(token) ? token : undefined;
}
