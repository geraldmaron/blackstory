import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

export default function Loading() {
  return (
    <CatalogLoading
      label="Taking the books off the shelf…"
      note="Each entry points to its source."
    />
  );
}
