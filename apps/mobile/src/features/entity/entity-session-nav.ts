/**
 * Pure session stack and next-entity selection for entity detail navigation.
 * Port of web `apps/web/src/lib/map-experience/entity-session-nav.ts`.
 * Previous walks an explicit stack (not router history); Next advances a stable
 * ordered catalog or picks at random when the random toggle is on.
 */

export type SessionStack = readonly string[];

export function createSessionStack(): SessionStack {
  return [];
}

export function push(stack: SessionStack, entityId: string): SessionStack {
  return [...stack, entityId];
}

export function back(
  stack: SessionStack,
): { readonly stack: SessionStack; readonly entityId: string } | undefined {
  if (stack.length === 0) {
    return undefined;
  }
  const entityId = stack[stack.length - 1]!;
  return { stack: stack.slice(0, -1), entityId };
}

export function canBack(stack: SessionStack): boolean {
  return stack.length > 0;
}

export type PickNextInput = {
  readonly random: boolean;
  readonly currentId: string;
  readonly orderedIds: readonly string[];
  /** Test seam for deterministic random picks. Defaults to `Math.floor(Math.random() * n)`. */
  readonly randomIndex?: (candidateCount: number) => number;
};

export function pickNext(input: PickNextInput): string | undefined {
  const { random, currentId, orderedIds } = input;
  const candidates = orderedIds.filter((id) => id !== currentId);
  if (candidates.length === 0) {
    return undefined;
  }

  if (random) {
    const pick =
      input.randomIndex !== undefined
        ? input.randomIndex(candidates.length)
        : Math.floor(Math.random() * candidates.length);
    return candidates[pick]!;
  }

  const currentIndex = orderedIds.indexOf(currentId);
  if (currentIndex === -1) {
    return candidates[0];
  }

  for (let offset = 1; offset <= orderedIds.length; offset += 1) {
    const nextId = orderedIds[(currentIndex + offset) % orderedIds.length]!;
    if (nextId !== currentId) {
      return nextId;
    }
  }

  return undefined;
}

export function canPickNext(input: Omit<PickNextInput, 'random'>): boolean {
  return pickNext({ ...input, random: false }) !== undefined;
}

/**
 * Catalog previous when the session stack is empty (deep-link / cold open).
 * Prefer `back(stack)` when the stack has entries.
 */
export function pickPrevious(input: Omit<PickNextInput, 'random'>): string | undefined {
  const { currentId, orderedIds } = input;
  const candidates = orderedIds.filter((id) => id !== currentId);
  if (candidates.length === 0) return undefined;

  const currentIndex = orderedIds.indexOf(currentId);
  if (currentIndex === -1) {
    return candidates[candidates.length - 1];
  }

  for (let offset = 1; offset <= orderedIds.length; offset += 1) {
    const prevId = orderedIds[(currentIndex - offset + orderedIds.length) % orderedIds.length]!;
    if (prevId !== currentId) {
      return prevId;
    }
  }

  return undefined;
}

/** Ordered entity ids from a release map feature collection. */
export function orderedEntityIdsFromMapSource(source: {
  readonly features: readonly { readonly properties: { readonly entityId?: string } }[];
}): readonly string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const feature of source.features) {
    const id = feature.properties.entityId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}
