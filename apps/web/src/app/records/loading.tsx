import React from 'react';
import { CatalogLoading } from '../../components/room/catalog-loading';

void React;

export default function Loading() {
  return (
    <CatalogLoading
      pathname="/records"
      label="Pulling the records together…"
      note="Each record shows where it came from."
    />
  );
}
