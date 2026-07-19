/**
 * Connect Firebase JS Admin SDK instances to local emulators when configured.
 */
import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';
import type { App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import type { EnvironmentLike } from './guard.js';
import { isEmulatorHost } from './guard.js';

export type EmulatorHosts = {
  readonly auth?: string;
  readonly firestore?: string;
  readonly storage?: string;
};

export function readEmulatorHosts(environment: EnvironmentLike = process.env): EmulatorHosts {
  const auth = environment.FIREBASE_AUTH_EMULATOR_HOST;
  const firestore = environment.FIRESTORE_EMULATOR_HOST;
  const storage = environment.FIREBASE_STORAGE_EMULATOR_HOST;
  const hosts: EmulatorHosts = {
    ...(auth && isEmulatorHost(auth) ? { auth } : {}),
    ...(firestore && isEmulatorHost(firestore) ? { firestore } : {}),
    ...(storage && isEmulatorHost(storage) ? { storage } : {}),
  };
  return hosts;
}

function hostPort(hostPortValue: string): { host: string; port: number } {
  const normalized = hostPortValue.includes('://') ? hostPortValue : `http://${hostPortValue}`;
  const url = new URL(normalized);
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  if (!url.hostname || !Number.isFinite(port)) {
    throw new Error(`Invalid emulator host: ${hostPortValue}`);
  }
  return { host: url.hostname, port };
}

/**
 * Wire Auth/Firestore/Storage emulators onto a client FirebaseApp (idempotent-ish).
 */
export function connectClientEmulators(
  app: FirebaseApp,
  environment: EnvironmentLike = process.env,
): { auth: Auth; firestore: Firestore; storage: FirebaseStorage } {
  const hosts = readEmulatorHosts(environment);
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const storage = getStorage(app);

  if (hosts.auth) {
    connectAuthEmulator(auth, `http://${hosts.auth}`, { disableWarnings: true });
  }
  if (hosts.firestore) {
    const { host, port } = hostPort(hosts.firestore);
    connectFirestoreEmulator(firestore, host, port);
  }
  if (hosts.storage) {
    const { host, port } = hostPort(hosts.storage);
    connectStorageEmulator(storage, host, port);
  }

  return { auth, firestore, storage };
}

/**
 * Point the Admin SDK at emulators via process env (Admin SDK convention).
 */
export function applyAdminEmulatorEnvironment(
  environment: EnvironmentLike = process.env,
): EmulatorHosts {
  const hosts = readEmulatorHosts(environment);
  if (hosts.auth && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = hosts.auth;
  }
  if (hosts.firestore && !process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = hosts.firestore;
  }
  if (hosts.storage && !process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = hosts.storage;
  }
  return hosts;
}

export function getAdminEmulatorServices(app: AdminApp): {
  auth: ReturnType<typeof getAdminAuth>;
  firestore: ReturnType<typeof getAdminFirestore>;
} {
  applyAdminEmulatorEnvironment();
  return {
    auth: getAdminAuth(app),
    firestore: getAdminFirestore(app),
  };
}
