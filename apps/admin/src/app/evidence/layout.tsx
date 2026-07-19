/**
 * Auth gate for evidence attach.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../components/RequireAdminAuth';

export default function EvidenceLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
