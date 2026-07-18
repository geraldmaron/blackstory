/**
 * Root layout for the private Black Book administration console.
 */
import type { ReactNode } from 'react';
import '@blap/ui/styles.css';

export const metadata = {
  title: 'Black Book Admin',
  description: 'Administration and research console',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
