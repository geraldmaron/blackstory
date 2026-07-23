/**
 * Dev-only banner when bootstrap sync is offline — explains why Search/Entity lack live Postgres
 * data and how to point the dev client at a local api-public instance.
 */
import { StyleSheet, View } from 'react-native';

import { useAppRuntimeOptional } from '@/runtime';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '@/security';

import { Notice } from './Notice';
import { space } from './tokens';

export type ApiStatusBannerProps = {
  /** Tighter strip for tab browse surfaces (History, Stories). */
  readonly compact?: boolean;
};

export function ApiStatusBanner({ compact = true }: ApiStatusBannerProps) {
  const runtime = useAppRuntimeOptional();

  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }
  const sync = runtime?.lastBootstrapSync;
  if (!sync || sync.status !== 'offline') {
    return null;
  }

  const baseUrl = resolveApiBaseUrl();
  const usingProdDefault = baseUrl === DEFAULT_API_BASE_URL;

  return (
    <View style={[compact ? styles.wrapCompact : styles.wrap, styles.wrapBase]}>
      <Notice
        tone="warning"
        compact={compact}
        title="Live data unavailable"
        description={
          usingProdDefault
            ? `Cannot reach ${baseUrl} yet. Set API_BASE_URL in .env.local, start api-public, and restart Metro. Explore uses demo fixtures until then.`
            : `Cannot reach ${baseUrl} yet. Start api-public, confirm API_BASE_URL, and restart Metro.`
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapBase: {
    paddingHorizontal: 0,
  },
  wrap: {
    paddingBottom: space['2'],
  },
  wrapCompact: {
    paddingBottom: space['2'],
  },
});
