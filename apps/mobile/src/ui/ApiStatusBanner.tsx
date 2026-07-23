/**
 * Dev-only banner when bootstrap sync is offline — explains why Search/Entity lack live Postgres
 * data and how to point the dev client at a local api-public instance.
 */
import { StyleSheet, View } from 'react-native';

import { useAppRuntimeOptional } from '@/runtime';
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '@/security';

import { Notice } from './Notice';
import { space } from './tokens';

export function ApiStatusBanner() {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return null;
  }

  const runtime = useAppRuntimeOptional();
  const sync = runtime?.lastBootstrapSync;
  if (!sync || sync.status !== 'offline') {
    return null;
  }

  const baseUrl = resolveApiBaseUrl();
  const usingProdDefault = baseUrl === DEFAULT_API_BASE_URL;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Notice
        tone="warning"
        title="Live data unavailable"
        description={
          usingProdDefault
            ? `Could not reach ${baseUrl}. Search and entity records need a running api-public with PUBLIC_DATA_SOURCE=postgres. Copy apps/mobile/.env.example to .env.local, set API_BASE_URL to http://127.0.0.1:8080 (simulator) or your Mac LAN IP, restart Metro. Explore map still uses bundled demo fixtures until a live GeoJSON route ships.`
            : `Could not reach ${baseUrl}/v1/bootstrap. Confirm api-public is running and reachable from this device, then restart Metro.`
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: space['3'],
    paddingBottom: space['2'],
  },
});
