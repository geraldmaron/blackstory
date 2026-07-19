/**
 * Browser-only Firebase app init for the admin portal.
 * Uses the default app name so Auth handlers stay reliable.
 */
'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from 'firebase/auth';

function readPublicConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_ADMIN_APP_ID;
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    throw new Error(
      'Missing NEXT_PUBLIC_FIREBASE_* admin client config. Copy apps/admin/.env.example to .env.local.',
    );
  }
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

function getOrInitApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(readPublicConfig());
}

let authSingleton: Auth | undefined;

export function getAdminClientAuth(): Auth {
  if (authSingleton) return authSingleton;

  const app = getOrInitApp();
  try {
    authSingleton = initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } catch {
    // Already initialized (HMR / duplicate call).
    authSingleton = getAuth(app);
  }
  return authSingleton;
}
