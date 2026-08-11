import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Square, SwitchCamera } from 'lucide-react';
import clsx from 'clsx';

const MAX_DURATION_SECONDS = 60;

// Orden de preferencia para MediaRecorder de video. Safari iOS no soporta
// video/webm; usa video/mp4 (H.264/AAC) nativamente.
const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=h264,aac',
  'video/mp4',
];

function pickSupportedVideoMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  return VIDEO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionForVideoMimeType(mimeType: string): string {
  return mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

interface VideoRecorderProps {
  onFileRecorded: (file: File) => void;
}

/**
 * Graba un clip corto directamente desde la camara (getUserMedia video+audio)
 * como alternativa a subir un archivo. Compatible con iOS Safari: usa
 * video/mp4 cuando video/webm no esta soportado.
 */
export function VideoRecorder({ onFileRecorded }: VideoRecorderProps) {
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  const startPreview = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      console.log('[VideoRecorder] Camara capturada', stream.getVideoTracks()[0]?.getSettings());
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        await videoPreviewRef.current.play().catch((err) => console.error('[VideoRecorder] Error reproduciendo preview', err));
      }
      setIsPreviewing(true);
    } catch (err) {
      console.error('[VideoRecorder] getUserMedia (camara) fallo', err);
      setError('No se pudo acceder a la camara/microfono. Revisa los permisos.');
    }
  }, [facingMode]);

  const switchCamera = useCallback(async () => {
    stopStream();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  }, [stopStream]);

  useEffect(() => {
    if (isPreviewing && !isRecording) {
      void startPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const mimeType = pickSupportedVideoMimeType();
    console.log('[VideoRecorder] mimeType elegido:', mimeType ?? '(default del navegador)');
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = (e) => console.error('[VideoRecorder] MediaRecorder error', e);
    recorder.onstop = () => {
      const finalMimeType = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: finalMimeType });
      console.log('[VideoRecorder] Grabacion detenida:', blob.size, 'bytes,', finalMimeType);
      const file = new File([blob], `clip-${Date.now()}.${extensionForVideoMimeType(finalMimeType)}`, {
        type: finalMimeType,
      });
      stopStream();
      setIsPreviewing(false);
      setIsRecording(false);
      onFileRecorded(file);
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setIsRecording(true);
    setElapsedSeconds(0);

    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS) {
          recorder.stop();
        }
        return next;
      });
    }, 1000);
  }, [onFileRecorded, stopStream]);

  const stopRecording = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
  }, []);

  if (!isPreviewing) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={startPreview}
          className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-medium text-slate-200 hover:border-slate-600"
        >
          <Circle size={16} className="text-rose-500" />
          Grabar clip con la camara
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
        <video ref={videoPreviewRef} muted playsInline autoPlay className="w-full" />
        {isRecording && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-rose-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            {elapsedSeconds}s / {MAX_DURATION_SECONDS}s
          </div>
        )}
        {!isRecording && (
          <button
            type="button"
            onClick={switchCamera}
            className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-slate-200"
          >
            <SwitchCamera size={18} />
          </button>
        )}
      </div>

      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <button
            type="button"
            onClick={startRecording}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/30"
          >
            <Circle size={26} className="fill-white text-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className={clsx(
              'flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 shadow-lg',
              'active:scale-95'
            )}
          >
            <Square size={22} className="fill-rose-600 text-rose-600" />
          </button>
        )}
      </div>

      {!isRecording && (
        <button
          type="button"
          onClick={() => {
            stopStream();
            setIsPreviewing(false);
          }}
          className="text-center text-xs text-slate-500 underline underline-offset-2"
        >
          Cancelar
        </button>
      )}

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}
    </div>
  );
}
