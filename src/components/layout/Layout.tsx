import type { ReactNode } from 'react';
import { Navbar } from './Navbar';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col text-slate-100">
      <Navbar />
      <main className="flex-1 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}
