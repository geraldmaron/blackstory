'use client';

/**
 * Client-only App Check token acquisition for the public `/locate` geocode UI. Mirrors
 * `apps/web/src/app/submit/app-check-client.ts` exactly same vendor `firebase` client SDK call,
 * same graceful degrade to `{}` when App Check isn't configured for this build environment (so
 * local dev without a real Firebase project still works, and the server-side guard falls back to
 * its default `monitor` mode instead of hard-failing the request).
 *
 * Does NOT import `@repo/firebase` for the same reason the submit client doesn't: that
 * package's entry point statically imports Admin SDK (Node-only) modules, which must never reach
 * a Client Component's browser bundle.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getToken,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

let cachedAppCheck: AppCheck | undefined;

type FirebaseWebConfig = {
  readonly apiKey: string;
  readonly authDomain: string;
  readonly projectId: string;
  readonly storageBucket: string;
  readonly messagingSenderId: string;
  readonly appId: string;
};

function readConfig(): { readonly firebase: FirebaseWebConfig; readonly siteKey: string } | undefined {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const siteKey = process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY;
  if (
    !apiKey ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId ||
    !siteKey
  ) {
    return undefined;
  }
  return {
    firebase: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId },
    siteKey,
  };
}

function getOrInitAppCheck(): AppCheck | undefined {
  if (cachedAppCheck) return cachedAppCheck;
  const config = readConfig();
  if (!config) return undefined;
  try {
    const app: FirebaseApp = initializeApp(config.firebase);
    cachedAppCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return cachedAppCheck;
  } catch {
    return undefined;
  }
}

/** Resolves to App Check request headers, or `{}` when App Check isn't configured for this build.  */
export async function getLocateAppCheckHeaders(): Promise<Readonly<Record<string, string>>> {
  const appCheck = getOrInitAppCheck();
  if (!appCheck) return {};
  try {
    const result = await getToken(appCheck);
    return { 'X-Firebase-AppCheck': result.token };
  } catch {
    return {};
  }
}
