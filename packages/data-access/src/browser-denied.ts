/**
 * Browser / client bundle denial surface for @black-book/data-access.
 * Any bundler that resolves the `browser` export condition loads this module.
 */
throw new Error(
  '@black-book/data-access is server-only and must not be imported into browser bundles',
);

export {};
