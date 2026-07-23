/**
 * Dev-only banner when bootstrap sync is offline — explains why Search/Entity lack live Postgres
 * data and how to point the dev client at a local api-public instance.
 */
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useReduceMotion } from '@/features/explore/useReduceMotion';
import { useAppRuntimeOptional } from '@/runtime';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '@/security';

import { Notice } from './Notice';
import { duration, space } from './tokens';

export type ApiStatusBannerProps = {
  /** Tighter strip for tab browse surfaces (History, Stories). */
  readonly compact?: boolean;
};

export function ApiStatusBanner({ compact = true }: ApiStatusBannerProps) {
  const runtime = useAppRuntimeOptional();
  const reduceMotion = useReduceMotion();

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }
  const sync = runtime?.lastBootstrapSync;
  if (!sync || sync.status !== 'offline') {
    return null;
  }

  const baseUrl = resolveApiBaseUrl();
  const usingProdDefault = baseUrl === DEFAULT_API_BASE_URL;
  const waitingForLocalApi = !usingProdDefault;

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(duration.durationFast)}
      style={[compact ? styles.wrapCompact : styles.wrap, styles.wrapBase]}
    >
      <Notice
        tone="warning"
        compact={compact}
        title={waitingForLocalApi ? 'Waiting for local API' : 'Live data unavailable'}
        description={
          usingProdDefault
            ? `Cannot reach ${baseUrl} yet. Set API_BASE_URL in .env.local, then run pnpm dev:mobile from the repo root. Explore uses demo fixtures until then.`
            : `Connecting to ${baseUrl}. Run pnpm dev:mobile from the repo root if the API is not starting, or wait a moment while api-public comes up.`
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapBase: {
    paddingHorizontal: 0,
  },
  /** Default density — roomier stack spacing for non-browse hosts. */
  wrap: {
    paddingBottom: space['4'],
  },
  /** Compact density — tighter strip under History / Stories / Search masts. */
  wrapCompact: {
    paddingBottom: space['2'],
  },
});
