import { useEffect, type ReactNode } from 'react';
import { Navbar } from './Navbar';
import { unlockAudioOnFirstInteraction } from '@/services/audioUnlock';

export function Layout({ children }: { children: ReactNode }) {
  // Desbloquea el AudioContext compartido en la primera interaccion del
  // usuario en cualquier parte de la PWA (no solo al presionar el microfono),
  // asi el audio entrante de una Live Room puede reproducirse en iOS Safari
  // aunque el usuario local aun no haya grabado nada.
  useEffect(() => unlockAudioOnFirstInteraction(), []);

  return (
    <div className="flex min-h-dvh flex-col text-slate-100">
      <Navbar />
      <main className="flex-1 pb-24 sm:pb-6">{children}</main>
    </div>
  );
}
