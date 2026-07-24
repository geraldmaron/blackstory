/**
 * Client session navigation for entity detail screens. Shares Previous stack and
 * Random toggle via in-memory session store; navigates via Expo Router.
 */
import { useCallback, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { EntitySessionNav } from './EntitySessionNav';
import {
  back,
  canBack,
  canPickNext,
  pickNext,
  pickPrevious,
  push,
  type SessionStack,
} from './entity-session-nav';
import {
  readEntitySessionRandomEnabled,
  readEntitySessionStack,
  writeEntitySessionRandomEnabled,
  writeEntitySessionStack,
} from './entity-session-store';

export type EntitySessionNavHostProps = {
  readonly currentId: string;
  readonly orderedIds: readonly string[];
};

export function EntitySessionNavHost({ currentId, orderedIds }: EntitySessionNavHostProps) {
  const [stack, setStack] = useState<SessionStack>(() => readEntitySessionStack());
  const [randomEnabled, setRandomEnabled] = useState(() => readEntitySessionRandomEnabled());

  const canGoPrevious = canBack(stack) || canPickNext({ currentId, orderedIds });
  const canGoNext = useMemo(
    () => canPickNext({ currentId, orderedIds }),
    [currentId, orderedIds],
  );

  const handlePrevious = useCallback(() => {
    const stackResult = back(stack);
    if (stackResult) {
      setStack(stackResult.stack);
      writeEntitySessionStack(stackResult.stack);
      router.push(`/entity/${stackResult.entityId}`);
      return;
    }
    const prevId = pickPrevious({ currentId, orderedIds });
    if (!prevId) return;
    router.push(`/entity/${prevId}`);
  }, [currentId, orderedIds, stack]);

  const handleNext = useCallback(() => {
    const nextId = pickNext({ random: randomEnabled, currentId, orderedIds });
    if (!nextId) return;
    const nextStack = push(stack, currentId);
    setStack(nextStack);
    writeEntitySessionStack(nextStack);
    router.push(`/entity/${nextId}`);
  }, [currentId, orderedIds, randomEnabled, stack]);

  const handleRandomToggle = useCallback(() => {
    setRandomEnabled((previous) => {
      const next = !previous;
      writeEntitySessionRandomEnabled(next);
      return next;
    });
  }, []);

  if (orderedIds.length <= 1) {
    return null;
  }

  return (
    <EntitySessionNav
      canPrevious={canGoPrevious}
      canNext={canGoNext}
      randomEnabled={randomEnabled}
      onPrevious={handlePrevious}
      onNext={handleNext}
      onRandomToggle={handleRandomToggle}
    />
  );
}
