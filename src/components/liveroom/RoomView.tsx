import { useCallback, useState } from 'react';
import { QrCode, Users } from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useAudioPipelineContext } from '@/context/AudioPipelineContext';
import { SplitScreenMic } from './SplitScreenMic';
import { SubtitleOverlay } from './SubtitleOverlay';
import { QRCodeDisplay } from './QRCodeDisplay';
import { getLanguageOption } from '@/constants/languages';
import { blobToBase64 } from '@/utils/blob';
import type { RoomMessage, RoomParticipantRole } from '@/types';

interface RoomViewProps {
  roomId: string;
  role: RoomParticipantRole;
  hostLanguage: string;
  guestLanguage: string;
}

export function RoomView({ roomId, role, hostLanguage, guestLanguage }: RoomViewProps) {
  const { messages, sendMessage, loading, error, guestJoined } = useRoom(roomId, role);
  const { service, status } = useAudioPipelineContext();
  const [activeSide, setActiveSide] = useState<'own' | 'peer' | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

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

      {role === 'host' && !guestJoined && <QRCodeDisplay url={roomUrl} code={roomCode} />}

      <SplitScreenMic
        ownLanguage={ownLanguage}
        peerLanguage={peerLanguage}
        status={status}
        activeSide={activeSide}
        onPressStart={handlePressStart}
        onPressEnd={handlePressEnd}
      />

      {pipelineError && (
        <p className="rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {pipelineError}
        </p>
      )}

      <SubtitleOverlay messages={messages} currentRole={role} />
    </div>
  );
}
