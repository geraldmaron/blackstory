/**
 * Wraps all research-console routes in persistent landmark navigation.
 */
import type { ReactNode } from 'react';
import { ConsoleShell } from '../../console/components';
import './console.css';

export default function ConsoleLayout({ children }: { readonly children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
