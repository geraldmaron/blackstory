/**
 * Wraps research-console routes: auth gate + console landmark navigation.
 */
import type { ReactNode } from 'react';
import { RequireAdminAuth } from '../../components/RequireAdminAuth';
import { ConsoleShell } from '../../console/components';
import './console.css';

export default function ConsoleLayout({ children }: { readonly children: ReactNode }) {
  return (
    <RequireAdminAuth>
      <ConsoleShell>{children}</ConsoleShell>
    </RequireAdminAuth>
  );
}
