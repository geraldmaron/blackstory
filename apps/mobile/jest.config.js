const path = require('path');
const publicContractsSrc = path.resolve(__dirname, '../../packages/public-contracts/src');

module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/', '/ios/', '/android/'],
  moduleNameMapper: {
    '^@repo/public-contracts/version$': path.join(publicContractsSrc, 'version.ts'),
    '^@repo/public-contracts/errors$': path.join(publicContractsSrc, 'errors.ts'),
    '^@repo/public-contracts/v1/(.*)$': path.join(publicContractsSrc, 'v1', '$1.ts'),
  },
  // Resolve NodeNext-style `.js` specifiers inside public-contracts source to `.ts`.
  resolver: path.join(__dirname, 'jest.resolver.cjs'),
};
