/**
 * Jest config for apps/mobile (MOB-007). Uses Expo's own maintained preset
 * (`jest-expo`), matching the SDK 56 pin, per the same "use Expo's own
 * tooling, not the monorepo's Next.js-tuned config" rationale as
 * eslint.config.js.
 */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
};
