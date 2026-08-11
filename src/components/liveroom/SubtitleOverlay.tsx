import { useEffect, useRef } from 'react';
import { base64ToBlob } from '@/services/translateApi';
import { playAudioBlob } from '@/services/audioUnlock';
import type { RoomMessage, RoomParticipantRole } from '@/types';

interface SubtitleOverlayProps {
  messages: RoomMessage[];
  currentRole: RoomParticipantRole;
}

/**
 * Historial de subtitulos sincronizados de la sala en vivo.
 * Los mensajes del otro participante se resaltan y reproducen automaticamente
 * (audio relayado en base64 via el Durable Object, sin storage externo).
 */
export function SubtitleOverlay({ messages, currentRole }: SubtitleOverlayProps) {
  const playedIds = useRef<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

    const latest = messages[messages.length - 1];
    if (!latest) return;
    if (latest.senderRole === currentRole) return;
    if (!latest.audioBase64) return;
    if (playedIds.current.has(latest.id)) return;

    playedIds.current.add(latest.id);
    const blob = base64ToBlob(latest.audioBase64, latest.mimeType ?? 'audio/mpeg');
    console.log('[SubtitleOverlay] Reproduciendo audio entrante:', latest.id, blob.size, 'bytes');
    // Se reproduce via el AudioContext compartido ya desbloqueado (audioUnlock.ts)
    // en vez de `new Audio().play()`: este mensaje llega de forma asincrona por
    // WebSocket, sin gesto de usuario propio, y iOS Safari bloquearia el
    // autoplay directo de un <audio>/Audio() en ese contexto.
    playAudioBlob(blob).catch((err) => console.error('[SubtitleOverlay] Error reproduciendo audio entrante', err));
  }, [messages, currentRole]);

  if (messages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-800 text-sm text-slate-500">
        Aun no hay mensajes. Manten presionado un microfono para hablar.
      </div>
    );
  }

  return (
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      {messages.map((message) => {
        const isOwn = message.senderRole === currentRole;
        return (
          <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                isOwn ? 'bg-indigo-500/20 text-indigo-100' : 'bg-emerald-500/15 text-emerald-100'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide opacity-60">
                {message.originalLanguage} → {message.translatedLanguage}
              </p>
              <p className="opacity-70">{message.originalText}</p>
              <p className="font-semibold">{message.translatedText}</p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
