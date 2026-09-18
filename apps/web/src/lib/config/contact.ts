/**
 * The one place a published contact address is decided.
 *
 * Two surfaces publish a mailbox to the open internet: `/support` and `/.well-known/security.txt`.
 * They were separately hardcoded to the same personal address, which is the drift this module
 * exists to remove: changing one and forgetting the other publishes two different answers to
 * "who do I tell", and the one that rots is the one nobody reads.
 *
 * `me@geralddagher.com` is the published default, not a placeholder. Both values remain
 * environment-overridable through `SUPPORT_CONTACT` and `SECURITY_TXT_CONTACT`.
 */

/** General support, privacy and accessibility contact. Published on /support and /privacy. */
export const SUPPORT_CONTACT: string = process.env.SUPPORT_CONTACT?.trim() || 'me@geralddagher.com';

/** RFC 9116 security contact. Published in /.well-known/security.txt. */
export const SECURITY_CONTACT: string =
  process.env.SECURITY_TXT_CONTACT?.trim() || 'me@geralddagher.com';
