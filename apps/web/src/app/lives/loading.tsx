import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

/** Also the wait for `/lives/explorer`, which awaits the same snapshot read. */
export default function Loading() {
  return <CatalogLoading pathname="/lives" label="Opening lives…" />;
}
