import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

export default function Loading() {
  return (
    <CatalogLoading
      pathname="/law"
      label="Pulling the law entries…"
      note="Each entry points to the text it rests on."
    />
  );
}
