import { useEffect, useState } from 'react';

/**
 * Genera un valor de "volumen" 0-1 oscilante (suma de un par de senoidales
 * con distinta frecuencia, para que no se vea perfectamente periodico) via
 * requestAnimationFrame. Se usa para alimentar WaveformVisualizer durante
 * etapas de procesamiento (transcribiendo/traduciendo/sintetizando) donde
 * no hay señal real de microfono, pero igual queremos un Canvas vivo en vez
 * de un spinner estatico.
 */
export function useSimulatedVolume(active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    let rafId: number;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const wave = 0.35 + 0.25 * Math.sin(elapsed * 4) + 0.15 * Math.sin(elapsed * 9.3);
      setValue(Math.max(0.05, Math.min(1, wave)));
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  return value;
}
