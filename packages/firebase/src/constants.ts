
/**
 * Shared Firebase project constants and registered production app identifiers.
 * Client apiKey values are Firebase identifiers, not server secrets.
 */
export const PRODUCTION_PROJECT_ID = 'black-book-efaaf' as const;
export const PRODUCTION_PROJECT_NUMBER = '332234323945' as const;
export const DEMO_PROJECT_ID = 'demo-black-book' as const;

export const PRODUCTION_HOSTING_SITE = 'https://black-book-efaaf.web.app' as const;

export const PRODUCTION_AUTH_DOMAIN = 'black-book-efaaf.firebaseapp.com' as const;
export const PRODUCTION_STORAGE_BUCKET = 'black-book-efaaf.firebasestorage.app' as const;
export const PRODUCTION_MESSAGING_SENDER_ID = '332234323945' as const;
export const PRODUCTION_API_KEY = 'AIzaSyCS6qbiHo3KYAkMOhVbuORCwNa9PNbChFU' as const;

export const WEB_APP_ID = '1:332234323945:web:17be349ebc9c029b3bfd78' as const;
export const ADMIN_APP_ID = '1:332234323945:web:e1b31c78e32d95943bfd78' as const;

export const FIREBASE_PACKAGE = '@black-book/firebase' as const;

export const PRODUCTION_BREAK_GLASS_ENV = 'BLACK_BOOK_FIREBASE_ALLOW_PRODUCTION' as const;

export type FirebaseSurface = 'web' | 'admin' | 'server';

export type RegisteredWebApp = {
  readonly displayName: string;
  readonly appId: string;
  readonly surface: 'apps/web' | 'apps/admin';
};

export const REGISTERED_APPS = {
  web: {
    displayName: 'Black Book Web',
    appId: WEB_APP_ID,
    surface: 'apps/web',
  },
  admin: {
    displayName: 'Black Book Admin',
    appId: ADMIN_APP_ID,
    surface: 'apps/admin',
  },
} as const satisfies Record<'web' | 'admin', RegisteredWebApp>;
