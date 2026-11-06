import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

export default function Loading() {
  return (
    <CatalogLoading
      pathname="/data"
      label="Gathering the figures…"
      note="Every figure keeps its source beside it."
    />
  );
}
