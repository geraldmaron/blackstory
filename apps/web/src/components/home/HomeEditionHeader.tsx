/**
 * Shared index + kicker + title + lede header for numbered homepage scroll beats.
 */

import React from 'react';

void React;

export type HomeEditionHeaderProps = {
  readonly index: string;
  readonly kicker: string;
  readonly title: string;
  readonly lede: string;
  readonly id?: string;
};

export function HomeEditionHeader({ index, kicker, title, lede, id }: HomeEditionHeaderProps) {
  return (
    <header className="ds-home-edition__header" {...(id ? { id } : {})}>
      <span className="ds-home-edition__index" aria-hidden="true">
        {index}
      </span>
      <div>
        <p className="ds-home-edition__kicker">{kicker}</p>
        <h2 className="ds-home-edition__title">{title}</h2>
        <p className="ds-home-edition__lede">{lede}</p>
      </div>
    </header>
  );
}
