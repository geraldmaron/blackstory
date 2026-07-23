/**
 * Client session navigation for entity detail pages. Shares Back stack and Random
 * toggle with explore spotlight via sessionStorage; navigates via Next router
 * (not browser history for Back).
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntitySessionNav } from '../../../components/map-experience';
import '../../../components/map-experience/entity-session-nav.css';
import {
  back,
  canBack,
  canPickNext,
  pickNext,
  push,
  type SessionStack,
} from '../../../lib/map-experience/entity-session-nav';
import {
  readEntitySessionRandomEnabled,
  readEntitySessionStack,
  writeEntitySessionRandomEnabled,
  writeEntitySessionStack,
} from '../../../lib/map-experience/entity-session-storage';

export type EntitySessionNavClientProps = {
  readonly currentId: string;
  /**
   * Catalog for Next / Random. On the entity page this is the public search-index
   * order (full catalog). Explore spotlight uses the live map list instead.
   */
  readonly orderedIds: readonly string[];
};

export function EntitySessionNavClient({ currentId, orderedIds }: EntitySessionNavClientProps) {
  const router = useRouter();
  const [stack, setStack] = useState<SessionStack>(() => readEntitySessionStack());
  const [randomEnabled, setRandomEnabled] = useState(() => readEntitySessionRandomEnabled());

  const canGoBack = canBack(stack);
  const canGoNext = useMemo(
    () => canPickNext({ currentId, orderedIds }),
    [currentId, orderedIds],
  );

  const handleBack = useCallback(() => {
    const result = back(stack);
    if (!result) {
      return;
    }
    setStack(result.stack);
    writeEntitySessionStack(result.stack);
    router.push(`/entity/${result.entityId}`);
  }, [router, stack]);

  const handleNext = useCallback(() => {
    const nextId = pickNext({ random: randomEnabled, currentId, orderedIds });
    if (!nextId) {
      return;
    }
    const nextStack = push(stack, currentId);
    setStack(nextStack);
    writeEntitySessionStack(nextStack);
    router.push(`/entity/${nextId}`);
  }, [currentId, orderedIds, randomEnabled, router, stack]);

  const handleRandomToggle = useCallback(() => {
    setRandomEnabled((previous) => {
      const next = !previous;
      writeEntitySessionRandomEnabled(next);
      return next;
    });
  }, []);

  return (
    <EntitySessionNav
      className="ds-entity-edition__session-nav"
      canBack={canGoBack}
      canNext={canGoNext}
      randomEnabled={randomEnabled}
      onBack={handleBack}
      onNext={handleNext}
      onRandomToggle={handleRandomToggle}
    />
  );
}
