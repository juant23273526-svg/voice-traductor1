// Modulo compartido para desbloquear y reutilizar un unico AudioContext en
// toda la PWA. iOS Safari solo permite reproducir audio programaticamente
// (TTS del pipeline, audio relayado en Live Room, etc.) si el AudioContext
// fue "desbloqueado" en algun momento por un gesto de usuario real
// (touch/click); una vez desbloqueado, se mantiene asi por el resto de la
// sesion y puede reutilizarse para reproducir audio que llega de forma
// completamente asincrona (ej. un mensaje de WebSocket de la sala en vivo).

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    sharedAudioContext = new Ctor();
  }
  return sharedAudioContext;
}

/**
 * Debe llamarse de forma sincrona dentro de un gesto de usuario (pointerdown,
 * click, touchend), antes de cualquier `await`, para que iOS Safari asocie
 * el desbloqueo con la interaccion.
 */
export function unlockAudioPlayback(): void {
  try {
    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume().then(
        () => console.log('[AudioUnlock] AudioContext resumido'),
        (err) => console.error('[AudioUnlock] No se pudo resumir AudioContext', err)
      );
    }
    const silentBuffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = silentBuffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (err) {
    console.error('[AudioUnlock] Fallo al desbloquear audio (iOS)', err);
  }
}

/** Reproduce un blob de audio via Web Audio API usando el contexto ya desbloqueado. */
export async function playAudioBlob(blob: Blob): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume().catch((err) => console.error('[AudioUnlock] No se pudo resumir AudioContext antes de reproducir', err));
  }

  let audioBuffer: AudioBuffer;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  } catch (err) {
    console.error('[AudioUnlock] Error decodificando audio', err);
    throw err instanceof Error ? err : new Error('Error decodificando audio');
  }

  return new Promise((resolve, reject) => {
    try {
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => resolve();
      source.start(0);
    } catch (err) {
      console.error('[AudioUnlock] Error reproduciendo audio', err);
      reject(err instanceof Error ? err : new Error('Error reproduciendo audio'));
    }
  });
}

/**
 * Registra un listener de "primera interaccion" (pointerdown/touchend/click) a
 * nivel de documento que desbloquea el audio una sola vez. Cubre el caso de
 * un invitado que entra a una Live Room y recibe audio del host antes de
 * haber presionado el microfono el mismo.
 */
export function unlockAudioOnFirstInteraction(): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = () => {
    unlockAudioPlayback();
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('touchend', handler);
    document.removeEventListener('click', handler);
  };

  document.addEventListener('pointerdown', handler, { once: true });
  document.addEventListener('touchend', handler, { once: true });
  document.addEventListener('click', handler, { once: true });

  return () => {
    document.removeEventListener('pointerdown', handler);
    document.removeEventListener('touchend', handler);
    document.removeEventListener('click', handler);
  };
}
