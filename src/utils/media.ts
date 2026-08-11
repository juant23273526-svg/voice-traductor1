/**
 * Decodifica un blob de audio para obtener su duracion real en ms. Se usa en
 * Clip Studio para sincronizar los subtitulos con el audio doblado real
 * (en vez de la estimacion heuristica que devuelve el edge function).
 */
export async function getAudioDurationMs(blob: Blob): Promise<number> {
  if (blob.size === 0) return 0;
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    void ctx.close();
    return buffer.duration * 1000;
  } catch (err) {
    console.error('[media] No se pudo decodificar el audio para obtener su duracion real', err);
    return 0;
  }
}
