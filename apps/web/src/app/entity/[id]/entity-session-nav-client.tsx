/**
 * Client session navigation for entity detail pages. Shares Back stack and Random
 * toggle with explore spotlight via sessionStorage.
 *
 * Back honours the browser's history: when the reader got here with Next, the previous record IS
 * the previous history entry, so Back is `router.back()`. Pushing a new entry instead (as this
 * used to) made the browser's own Back button then walk the reader *forward* again. When the
 * previous record is not the previous entry (they arrived from elsewhere), Back replaces the
 * current entry rather than growing history.
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
import {
  appendNextHop,
  nextHopInto,
  type NextHop,
} from '../../../lib/map-experience/next-hop-chain';

export type EntitySessionNavClientProps = {
  readonly currentId: string;
  /**
   * Catalog for Next / Random. On the entity page this is the public search-index
   * order (full catalog). Explore spotlight uses the live map list instead.
   */
  readonly orderedIds: readonly string[];
};

const ARRIVED_VIA_NEXT_KEY = 'ds-entity-session-arrived-via-next';

function readNextChain(): NextHop[] {
  try {
    const raw = window.sessionStorage.getItem(ARRIVED_VIA_NEXT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter(
      (hop): hop is NextHop =>
        typeof hop === 'object' &&
        hop !== null &&
        typeof (hop as NextHop).from === 'string' &&
        typeof (hop as NextHop).to === 'string',
    );
  } catch {
    return [];
  }
}

function writeNextChain(chain: readonly NextHop[]): void {
  try {
    window.sessionStorage.setItem(ARRIVED_VIA_NEXT_KEY, JSON.stringify(chain.slice(-50)));
  } catch {
    // Storage blocked: Back falls back to replace, which is still correct, just not history-aware.
  }
}

export function EntitySessionNavClient({ currentId, orderedIds }: EntitySessionNavClientProps) {
  const router = useRouter();
  const [stack, setStack] = useState<SessionStack>(() => readEntitySessionStack());
  const [randomEnabled, setRandomEnabled] = useState(() => readEntitySessionRandomEnabled());

  const canGoBack = canBack(stack);
  const canGoNext = useMemo(() => canPickNext({ currentId, orderedIds }), [currentId, orderedIds]);

  const handleBack = useCallback(() => {
    const result = back(stack);
    if (!result) {
      return;
    }
    setStack(result.stack);
    writeEntitySessionStack(result.stack);
    const chain = readNextChain();
    if (nextHopInto(chain, currentId) === result.entityId) {
      writeNextChain(chain.slice(0, -1));
      router.back();
      return;
    }
    router.replace(`/entity/${result.entityId}`);
  }, [currentId, router, stack]);

  const handleNext = useCallback(() => {
    const nextId = pickNext({ random: randomEnabled, currentId, orderedIds });
    if (!nextId) {
      return;
    }
    const nextStack = push(stack, currentId);
    setStack(nextStack);
    writeEntitySessionStack(nextStack);
    writeNextChain(appendNextHop(readNextChain(), { from: currentId, to: nextId }));
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
