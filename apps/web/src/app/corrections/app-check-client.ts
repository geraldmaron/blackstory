'use client';

/**
 * Client-only App Check token acquisition for BB-055 correction, appeal, and abuse forms.
 * Does not import `@black-book/firebase` — see `apps/web/src/app/submit/app-check-client.ts`.
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

export async function getCorrectionAppCheckHeaders(): Promise<Readonly<Record<string, string>>> {
  const appCheck = getOrInitAppCheck();
  if (!appCheck) return {};
  try {
    const result = await getToken(appCheck);
    return { 'X-Firebase-AppCheck': result.token };
  } catch {
    return {};
  }
}
