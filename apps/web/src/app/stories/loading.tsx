import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

export default function Loading() {
  return (
    <CatalogLoading
      pathname="/stories"
      label="Laying out the stories…"
      note="Every chapter cites what it rests on."
    />
  );
}
