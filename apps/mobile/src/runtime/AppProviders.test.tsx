/**
 * Composition-root smoke tests (repo-8b5h).
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient } from '@tanstack/react-query';

import { AppProviders, useAppRuntime } from './AppProviders';
import type { AppRuntime } from './create-app-runtime';

function Probe() {
  const runtime = useAppRuntime();
  return <Text testID="stamp">{runtime ? 'ready' : 'missing'}</Text>;
}

function makeFakeRuntime(): AppRuntime {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    store: {
      getMeta: async () => undefined,
      setMeta: async () => {},
      delete: async () => {},
      // minimal stubs — not exercised by this smoke
    } as unknown as AppRuntime['store'],
    queryClient,
    persister: {
      persistClient: async () => {},
      restoreClient: async () => undefined,
      removeClient: async () => {},
    },
    transport: { readJson: async () => ({ kind: 'ok', status: 200, data: {} }) } as unknown as AppRuntime['transport'],
    releaseCache: {
      getActiveStamp: async () => 'rel',
      applyReleaseStamp: async () => 0,
      read: async () => undefined,
      write: async () => {},
    } as unknown as AppRuntime['releaseCache'],
    bootstrapSync: { sync: async () => ({ status: 'unchanged', stamp: 'rel' }) },
    connectivity: {
      getState: () => 'online',
      isOnline: () => true,
      subscribe: () => () => {},
    },
    run: async (fn) => fn(new AbortController().signal),
  };
}

describe('AppProviders', () => {
  it('provides the injected runtime to children', async () => {
    const runtime = makeFakeRuntime();
    render(
      <AppProviders runtime={runtime}>
        <Probe />
      </AppProviders>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('stamp').props.children).toBe('ready');
    });
  });
});
