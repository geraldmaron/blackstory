/**
 * Auth gate for citation health.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../components/RequireAdminAuth';

export default function CitationHealthLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
