/**
 * Browser client bundle denial surface for @blap/data-access.
 * Any bundler that resolves the `browser` export condition loads this module.
 */
throw new Error(
  '@blap/data-access is server-only and must not be imported into browser bundles',
);

export {};
