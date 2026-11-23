/**
 * `/data/[figure]`: one registry figure on its own citable page: its finding, its views, its
 * sources and limits, Cite, and a link back to its place on `/data` (docs/ui/DESIGN.md section
 * 9.5). The id is the address and does not change. An id the registry does not hold, or a figure
 * with nothing to draw in this release, answers a real 404, which is why no `loading.tsx` sits on
 * or above this route.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@repo/ui';
import { Room } from '../../../components/room';
import { TrustMast, TrustSheet } from '../../../components/trust';
import { Figure } from '../../../components/data/figures/Figure';
import {
  FIGURES,
  figurePagePath,
  isFigureId,
  parseFigureViews,
} from '../../../components/data/figures/registry';
import { buildStaticPageMetadata } from '../../../lib/seo/metadata-builders';
import '../../reading-room.css';
import '../data-page.css';

void React;

type FigurePageProps = {
  readonly params: Promise<{ readonly figure: string }>;
  readonly searchParams: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>;
};

/** The id as the registry spells it: `d-09` and `D-09` are one figure. */
async function loadFigure(raw: string) {
  const id = decodeURIComponent(raw).toUpperCase();
  if (!isFigureId(id)) return undefined;
  const data = await FIGURES[id].load();
  return data ? { id, data } : undefined;
}

export async function generateMetadata({ params }: FigurePageProps): Promise<Metadata> {
  const found = await loadFigure((await params).figure);
  if (!found) return { title: 'Figure not found', robots: { index: false, follow: false } };
  return buildStaticPageMetadata({
    path: figurePagePath(found.id),
    title: `${found.data.title} (figure ${found.id})`,
    description: `${found.data.headline}. ${found.data.limits}`,
  });
}

export default async function FigurePage({ params, searchParams }: FigurePageProps) {
  const found = await loadFigure((await params).figure);
  if (!found) notFound();
  const { id, data } = found;
  const path = figurePagePath(id);

  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast>
          <PageHeader
            display
            crumb={{ href: `/data#${id}`, label: 'Data' }}
            linkAs={Link}
            title={`Figure ${id}`}
            dek={data.title}
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <Figure
          id={id}
          views={parseFigureViews((await searchParams).view)}
          path={path}
          solo
          headingLevel={2}
          elsewhere={{ href: `/data#${id}`, label: 'See this figure in its place on Data' }}
        />
      </TrustSheet>
    </Room>
  );
}
