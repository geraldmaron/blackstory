/**
 * Client session navigation for entity detail pages. Persists the back stack and random
 * toggle in sessionStorage; navigates via Next router (not browser history for Back).
 */
'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { EntitySessionNav } from '../../../components/map-experience/EntitySessionNav';
import '../../../components/map-experience/entity-session-nav.css';
import {
  back,
  canBack,
  canPickNext,
  createSessionStack,
  pickNext,
  push,
  type SessionStack,
} from '../../../lib/map-experience/entity-session-nav';

const STACK_STORAGE_KEY = 'blackstory.entity-session.stack';
const RANDOM_STORAGE_KEY = 'blackstory.entity-session.random';

function readStack(): SessionStack {
  if (typeof sessionStorage === 'undefined') {
    return createSessionStack();
  }
  try {
    const raw = sessionStorage.getItem(STACK_STORAGE_KEY);
    if (!raw) {
      return createSessionStack();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      return createSessionStack();
    }
    return parsed;
  } catch {
    return createSessionStack();
  }
}

function writeStack(stack: SessionStack): void {
  sessionStorage.setItem(STACK_STORAGE_KEY, JSON.stringify(stack));
}

function readRandomEnabled(): boolean {
  if (typeof sessionStorage === 'undefined') {
    return false;
  }
  return sessionStorage.getItem(RANDOM_STORAGE_KEY) === '1';
}

function writeRandomEnabled(enabled: boolean): void {
  sessionStorage.setItem(RANDOM_STORAGE_KEY, enabled ? '1' : '0');
}

export type EntitySessionNavClientProps = {
  readonly currentId: string;
  readonly orderedIds: readonly string[];
};

export function EntitySessionNavClient({ currentId, orderedIds }: EntitySessionNavClientProps) {
  const router = useRouter();
  const [stack, setStack] = useState<SessionStack>(() => readStack());
  const [randomEnabled, setRandomEnabled] = useState(() => readRandomEnabled());

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
    writeStack(result.stack);
    router.push(`/entity/${result.entityId}`);
  }, [router, stack]);

  const handleNext = useCallback(() => {
    const nextId = pickNext({ random: randomEnabled, currentId, orderedIds });
    if (!nextId) {
      return;
    }
    const nextStack = push(stack, currentId);
    setStack(nextStack);
    writeStack(nextStack);
    router.push(`/entity/${nextId}`);
  }, [currentId, orderedIds, randomEnabled, router, stack]);

  const handleRandomToggle = useCallback(() => {
    setRandomEnabled((previous) => {
      const next = !previous;
      writeRandomEnabled(next);
      return next;
    });
  }, []);

  return (
    <EntitySessionNav
      className="ds-entity-page__session-nav"
      canBack={canGoBack}
      canNext={canGoNext}
      randomEnabled={randomEnabled}
      onBack={handleBack}
      onNext={handleNext}
      onRandomToggle={handleRandomToggle}
    />
  );
}
