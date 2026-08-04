/**
 * The one place a published contact address is decided.
 *
 * Two surfaces publish a mailbox to the open internet: `/support` and `/.well-known/security.txt`.
 * They were separately hardcoded to the same personal address, which is the drift this module
 * exists to remove: changing one and forgetting the other publishes two different answers to
 * "who do I tell", and the one that rots is the one nobody reads.
 *
 * Both values are env-overridable so the owner can move to role mailboxes without a code change.
 * Until `SUPPORT_CONTACT` and `SECURITY_TXT_CONTACT` are set in the deployed environment the
 * fallback is still a personal address — see repo-92n2.13, which cannot close on that criterion
 * until role mailboxes exist and DNS for them is live.
 */

/** Role mailbox for general support, privacy and accessibility contact. Published on /support. */
export const SUPPORT_CONTACT: string = process.env.SUPPORT_CONTACT?.trim() || 'me@geralddagher.com';

/** RFC 9116 security contact. Published in /.well-known/security.txt. */
export const SECURITY_CONTACT: string =
  process.env.SECURITY_TXT_CONTACT?.trim() || 'me@geralddagher.com';

/**
 * True when a published contact is still the personal fallback rather than a role mailbox.
 * Asserted in tests so that shipping the fallback stays a deliberate, visible choice.
 */
export function isPersonalContactFallback(address: string): boolean {
  return address.endsWith('@geralddagher.com');
}
