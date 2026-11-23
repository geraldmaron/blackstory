/**
 * The phone's primary navigation: a tab bar along the bottom edge with the same four tabs on
 * every page, Archive, Stories, Data and Memorial. Shown below 48rem only (tab-bar.css); from
 * 48rem up the header carries the same tabs. Every tab is a plain link.
 */
'use client';

import React from 'react';
import Link from 'next/link';
import { DestinationIcon } from '../patterns/DestinationIcon';
import { SHELL_TABS, currentTabFor } from './shell-tabs';
import './tab-bar.css';

void React;

export type PhoneTabBarProps = {
  readonly pathname: string;
};

export function PhoneTabBar({ pathname }: PhoneTabBarProps) {
  const current = currentTabFor(pathname);

  return (
    <nav className="ds-tabbar" aria-label="Main" data-ground="ink">
      {SHELL_TABS.map((tab) => (
        <Link
          key={tab.id}
          className="ds-tabbar__tab"
          href={tab.href}
          aria-current={current === tab.id ? 'page' : undefined}
        >
          <DestinationIcon id={tab.icon} />
          <span className="ds-tabbar__label">{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
