/**
 * Auth gate for research case routes.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../components/RequireAdminAuth';

export default function CasesLayout({ children }: { children: ReactNode }) {
  return <RequireAdminAuth>{children}</RequireAdminAuth>;
}
