/**
 * The phone's primary navigation: a tab bar along the bottom edge with the same four tabs on
 * every page, Map, Records, Stories and Collections. Shown below 48rem only (tab-bar.css); from
 * 48rem up the header carries the same tabs. Every tab is a plain link.
 */
'use client';

import React from 'react';
import Link from 'next/link';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { SHELL_TABS, currentTabFor, pathIsMapSurface } from './shell-tabs';
import './tab-bar.css';

void React;

export type PhoneTabBarProps = {
  readonly pathname: string;
  /** The Door's full-screen browse posture is on. */
  readonly browsing: boolean;
};

export function PhoneTabBar({ pathname, browsing }: PhoneTabBarProps) {
  const current = currentTabFor(pathname);

  return (
    <nav className="ds-tabbar" aria-label="Main" data-ground="ink">
      {SHELL_TABS.map((tab) => {
        const isCurrent = current === tab.id;
        const mark = (
          <>
            <DestinationIcon id={tab.icon} />
            <span className="ds-tabbar__label">{tab.label}</span>
          </>
        );
        // On the map, the current Map tab is inert: it never navigates (a link would drop the
        // map's filters) and never doubles as a way out. The header lockup is the way home.
        if (tab.id === '/explore' && pathIsMapSurface(pathname) && browsing) {
          return (
            <span key={tab.id} className="ds-tabbar__tab" aria-current="page">
              {mark}
            </span>
          );
        }
        return (
          <Link
            key={tab.id}
            className="ds-tabbar__tab"
            href={tab.href}
            {...(tab.id === '/explore' ? { prefetch: false } : {})}
            aria-current={isCurrent ? 'page' : undefined}
          >
            {mark}
          </Link>
        );
      })}
    </nav>
  );
}
