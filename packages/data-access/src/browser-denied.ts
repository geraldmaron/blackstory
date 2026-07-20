/**
 * Browser client bundle denial surface for @repo/data-access.
 * Any bundler that resolves the `browser` export condition loads this module.
 */
throw new Error('@repo/data-access is server-only and must not be imported into browser bundles');

export {};
