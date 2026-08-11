import { useCallback, useEffect, useRef, useState } from 'react';
import { QrCode, Users, Radio, Wifi, WifiOff, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useRoom } from '@/hooks/useRoom';
import { useAudioPipelineContext } from '@/context/AudioPipelineContext';
import { SplitScreenMic } from './SplitScreenMic';
import { SubtitleOverlay } from './SubtitleOverlay';
import { QRCodeDisplay } from './QRCodeDisplay';
import { WaveformVisualizer } from '@/components/shared/WaveformVisualizer';
import { getLanguageOption } from '@/constants/languages';
import { blobToBase64 } from '@/utils/blob';
import type { RoomMessage, RoomParticipantRole } from '@/types';

const CONNECTION_BADGE = {
  connecting: { label: 'Conectando...', icon: Loader2, className: 'text-amber-400', spin: true },
  open: { label: 'Conectado', icon: Wifi, className: 'text-emerald-400', spin: false },
  closed: { label: 'Desconectado', icon: WifiOff, className: 'text-slate-500', spin: false },
  error: { label: 'Error de conexion', icon: WifiOff, className: 'text-rose-400', spin: false },
} as const;

interface RoomViewProps {
  roomId: string;
  role: RoomParticipantRole;
  hostLanguage: string;
  guestLanguage: string;
}

export function RoomView({ roomId, role, hostLanguage, guestLanguage }: RoomViewProps) {
  const { messages, sendMessage, connectionStatus, loading, error, guestJoined } = useRoom(roomId, role);
  const { service, status, volume } = useAudioPipelineContext();
  const [activeSide, setActiveSide] = useState<'own' | 'peer' | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Indicador visual de actividad del socket: se enciende brevemente cada vez
  // que llega un mensaje nuevo (texto + audio) desde el Durable Object, para
  // confirmar en pantalla que los paquetes efectivamente estan llegando.
  const [packetFlash, setPacketFlash] = useState(false);
  const previousMessageCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > previousMessageCount.current) {
      console.log('[RoomView] Paquete recibido via WebSocket. Total mensajes:', messages.length);
      setPacketFlash(true);
      const timeout = setTimeout(() => setPacketFlash(false), 1200);
      previousMessageCount.current = messages.length;
      return () => clearTimeout(timeout);
    }
    previousMessageCount.current = messages.length;
  }, [messages.length]);

  const ownLanguage = getLanguageOption(role === 'host' ? hostLanguage : guestLanguage);
  const peerLanguage = getLanguageOption(role === 'host' ? guestLanguage : hostLanguage);

  const handlePressStart = useCallback(
    async (side: 'own' | 'peer') => {
      setActiveSide(side);
      setPipelineError(null);
      await service.startRecording();
    },
    [service]
  );

  const handlePressEnd = useCallback(
    async (side: 'own' | 'peer') => {
      setActiveSide(null);
      try {
        const spokenLanguage = side === 'own' ? ownLanguage : peerLanguage;
        const targetLanguage = side === 'own' ? peerLanguage : ownLanguage;

        const blob = await service.stopRecording();
        const result = await service.runFullPipeline(blob, {
          sourceLanguage: spokenLanguage.code,
          targetLanguage: targetLanguage.code,
          voiceId: `voice_${targetLanguage.code}`,
          autoPlay: false,
        });

        const audioBase64 = await blobToBase64(result.synthesis.audioBlob);

        const message: RoomMessage = {
          id: crypto.randomUUID(),
          senderRole: side === 'own' ? role : role === 'host' ? 'guest' : 'host',
          originalText: result.transcription.transcript,
          translatedText: result.translation.translatedText,
          originalLanguage: spokenLanguage.code,
          translatedLanguage: targetLanguage.code,
          audioBase64,
          mimeType: result.synthesis.audioBlob.type || 'audio/mpeg',
          createdAt: new Date().toISOString(),
        };

        sendMessage(message);
      } catch (err) {
        setPipelineError(err instanceof Error ? err.message : 'Error procesando el audio');
      }
    },
    [service, ownLanguage, peerLanguage, role, sendMessage]
  );

  if (loading) {
    return <p className="p-6 text-center text-sm text-slate-500">Conectando a la sala...</p>;
  }

  if (error) {
    return <p className="p-6 text-center text-sm text-rose-400">{error.message}</p>;
  }

  const roomUrl = `${window.location.origin}/room/${roomId}?role=guest&hostLang=${hostLanguage}&guestLang=${guestLanguage}`;
  const roomCode = roomId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const connectionBadge = CONNECTION_BADGE[connectionStatus];
  const ConnectionIcon = connectionBadge.icon;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-50">Live Room</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
            <Users size={14} />
            {guestJoined ? 'Invitado conectado' : 'Esperando invitado...'}
          </p>
        </div>
        {role === 'host' && !guestJoined && <QrCode className="text-slate-600" size={28} />}
      </header>

      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 text-xs">
        <div className={clsx('flex items-center gap-1.5 font-medium', connectionBadge.className)}>
          <ConnectionIcon size={14} className={connectionBadge.spin ? 'animate-spin' : ''} />
          {connectionBadge.label}
        </div>
        <div
          className={clsx(
            'flex items-center gap-1.5 font-medium transition-opacity duration-300',
            packetFlash ? 'text-emerald-400 opacity-100' : 'text-slate-600 opacity-60'
          )}
        >
          <Radio size={14} className={packetFlash ? 'animate-pulse' : ''} />
          {packetFlash ? 'Paquete recibido' : 'Sin actividad'}
        </div>
      </div>

      {role === 'host' && !guestJoined && <QRCodeDisplay url={roomUrl} code={roomCode} />}

      <SplitScreenMic
        ownLanguage={ownLanguage}
        peerLanguage={peerLanguage}
        status={status}
        activeSide={activeSide}
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
      />

      {activeSide && (
        <WaveformVisualizer
          volume={volume}
          active={status === 'RECORDING'}
          barColor={activeSide === 'own' ? '#6366f1' : '#10b981'}
          className="mx-auto"
        />
      )}

      {pipelineError && (
        <p className="rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {pipelineError}
        </p>
      )}

      <SubtitleOverlay messages={messages} currentRole={role} />
    </div>
  );
}
