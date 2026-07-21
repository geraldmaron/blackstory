/**
 * Unit tests for entity sessionStorage helpers (stack + random toggle keys).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ENTITY_SESSION_RANDOM_STORAGE_KEY,
  ENTITY_SESSION_STACK_STORAGE_KEY,
  readEntitySessionRandomEnabled,
  readEntitySessionStack,
  writeEntitySessionRandomEnabled,
  writeEntitySessionStack,
} from './entity-session-storage';
import { createSessionStack, push } from './entity-session-nav';

const memory = new Map<string, string>();

function installSessionStorageMock(): void {
  const store = {
    getItem(key: string): string | null {
      return memory.has(key) ? memory.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      memory.set(key, value);
    },
    removeItem(key: string): void {
      memory.delete(key);
    },
    clear(): void {
      memory.clear();
    },
    key(): string | null {
      return null;
    },
    get length(): number {
      return memory.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: store,
  });
}

test('stack round-trips through sessionStorage', () => {
  memory.clear();
  installSessionStorageMock();
  const stack = push(push(createSessionStack(), 'a'), 'b');
  writeEntitySessionStack(stack);
  assert.deepEqual(readEntitySessionStack(), ['a', 'b']);
  assert.ok(memory.get(ENTITY_SESSION_STACK_STORAGE_KEY));
});

test('malformed stack falls back to empty', () => {
  memory.clear();
  installSessionStorageMock();
  memory.set(ENTITY_SESSION_STACK_STORAGE_KEY, '{not-json');
  assert.deepEqual(readEntitySessionStack(), []);
  memory.set(ENTITY_SESSION_STACK_STORAGE_KEY, JSON.stringify([1, 2]));
  assert.deepEqual(readEntitySessionStack(), []);
});

test('random toggle round-trips as boolean', () => {
  memory.clear();
  installSessionStorageMock();
  assert.equal(readEntitySessionRandomEnabled(), false);
  writeEntitySessionRandomEnabled(true);
  assert.equal(readEntitySessionRandomEnabled(), true);
  assert.equal(memory.get(ENTITY_SESSION_RANDOM_STORAGE_KEY), '1');
  writeEntitySessionRandomEnabled(false);
  assert.equal(readEntitySessionRandomEnabled(), false);
});
