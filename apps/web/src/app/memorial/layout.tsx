/**
 * Memorial route layout loads open-source handwriting faces for the wall atmosphere.
 * Edition body copy still uses the site display/sans/editorial stack from the root layout.
 */
import type { ReactNode } from 'react';
import {
  Architects_Daughter,
  Caveat,
  Homemade_Apple,
  Indie_Flower,
  Patrick_Hand,
  Shadows_Into_Light,
} from 'next/font/google';

const handCaveat = Caveat({
  subsets: ['latin'],
  variable: '--ds-font-hand-caveat',
  display: 'swap',
});

const handPatrick = Patrick_Hand({
  weight: '400',
  subsets: ['latin'],
  variable: '--ds-font-hand-patrick',
  display: 'swap',
});

const handShadows = Shadows_Into_Light({
  weight: '400',
  subsets: ['latin'],
  variable: '--ds-font-hand-shadows',
  display: 'swap',
});

const handIndie = Indie_Flower({
  weight: '400',
  subsets: ['latin'],
  variable: '--ds-font-hand-indie',
  display: 'swap',
});

const handArchitects = Architects_Daughter({
  weight: '400',
  subsets: ['latin'],
  variable: '--ds-font-hand-architects',
  display: 'swap',
});

const handHomemade = Homemade_Apple({
  weight: '400',
  subsets: ['latin'],
  variable: '--ds-font-hand-homemade',
  display: 'swap',
});

const handFontClassName = [
  handCaveat.variable,
  handPatrick.variable,
  handShadows.variable,
  handIndie.variable,
  handArchitects.variable,
  handHomemade.variable,
].join(' ');

export default function MemorialLayout({ children }: { readonly children: ReactNode }) {
  return <div className={handFontClassName}>{children}</div>;
}
