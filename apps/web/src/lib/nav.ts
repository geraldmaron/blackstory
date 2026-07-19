/**
 * Navigation data for the public BlackStory application shell.
 * Primary/overflow IA lives in @repo/config so admin can share the same navbar.
 */

import {
  FOOTER_NAV_COLUMNS as CONFIG_FOOTER,
  OVERFLOW_NAV,
  PRIMARY_NAV,
  isShellNavActive,
  type ShellNavItem,
} from '@repo/config';

export type NavItem = ShellNavItem;

export { PRIMARY_NAV, OVERFLOW_NAV };

export type FooterNavColumn = {
  readonly title: string;
  readonly items: readonly NavItem[];
};

/** Three mono-caps footer columns per the v3 shell contract. */
export const FOOTER_NAV_COLUMNS: readonly FooterNavColumn[] =
  CONFIG_FOOTER as readonly FooterNavColumn[];

export function isNavActive(pathname: string, href: string): boolean {
  return isShellNavActive(pathname, href);
}
