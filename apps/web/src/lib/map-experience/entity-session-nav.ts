/**
 * Pure session stack and next-entity selection for explore spotlight and entity detail
 * navigation. Back walks an explicit stack (not browser history); Next advances in a stable
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
