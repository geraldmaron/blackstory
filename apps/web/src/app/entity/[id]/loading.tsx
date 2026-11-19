/** Every record family waits behind the same record-page skeleton. */
import React from 'react';
import { RecordPageLoading } from '../../../components/patterns/RecordPage';
import '../../../components/patterns/skeleton.css';

void React;

export default function EntityLoading() {
  return <RecordPageLoading />;
}
