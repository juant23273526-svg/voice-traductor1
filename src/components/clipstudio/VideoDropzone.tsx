import { useCallback, useRef, useState } from 'react';
import { UploadCloud, Film } from 'lucide-react';
import clsx from 'clsx';

const MAX_DURATION_SECONDS = 60;
const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime'];

interface VideoDropzoneProps {
  onFileAccepted: (file: File) => void;
}

export function VideoDropzone({ onFileAccepted }: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndAccept = useCallback(
    (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Formato no soportado. Usa .mp4 o .mov');
        return;
      }

      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        if (video.duration > MAX_DURATION_SECONDS) {
          setError(`El video debe durar ${MAX_DURATION_SECONDS}s o menos (duracion: ${Math.round(video.duration)}s)`);
          return;
        }
        onFileAccepted(file);
      };
      video.src = URL.createObjectURL(file);
    },
    [onFileAccepted]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) validateAndAccept(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-10 text-center transition-colors',
          isDragging
            ? 'border-indigo-400 bg-indigo-500/10'
            : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
        )}
      >
        <div className="rounded-full bg-slate-800 p-4">
          {isDragging ? <Film size={28} className="text-indigo-300" /> : <UploadCloud size={28} className="text-slate-400" />}
        </div>
        <div>
          <p className="font-medium text-slate-200">Arrastra tu clip aqui o toca para elegir</p>
          <p className="mt-1 text-xs text-slate-500">.mp4 o .mov · maximo {MAX_DURATION_SECONDS}s</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) validateAndAccept(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
