import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { exportDubbedClip } from '@/services/FFmpegService';
import { buildSrtFromWords } from '@/utils/subtitles';
import type { WordTimestamp } from '@/types';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/types/clipstudio';

interface ExportPanelProps {
  videoFile: File;
  dubbedAudioBlob: Blob;
  wordCues: WordTimestamp[];
  burnSubtitles: boolean;
  onBurnSubtitlesChange: (value: boolean) => void;
  subtitleStyle?: SubtitleStyle;
}

export function ExportPanel({
  videoFile,
  dubbedAudioBlob,
  wordCues,
  burnSubtitles,
  onBurnSubtitlesChange,
  subtitleStyle = DEFAULT_SUBTITLE_STYLE,
}: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);
    setDownloadUrl(null);

    try {
      const srtContent = burnSubtitles ? buildSrtFromWords(wordCues) : undefined;
      const outputBlob = await exportDubbedClip({
        videoFile,
        dubbedAudioBlob,
        srtContent,
        subtitleStyle,
        onProgress: setProgress,
      });
      setDownloadUrl(URL.createObjectURL(outputBlob));
    } catch (err) {
      console.error('[ExportPanel] Error exportando clip', err);
      setError(err instanceof Error ? err.message : 'Error exportando el clip');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={burnSubtitles}
          onChange={(e) => onBurnSubtitlesChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-emerald-500"
        />
        Quemar subtitulos en el video exportado
      </label>

      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {isExporting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Exportando... {Math.round(progress * 100)}%
          </>
        ) : (
          <>
            <Download size={18} />
            Exportar clip doblado (.mp4)
          </>
        )}
      </button>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {downloadUrl && (
        <a
          href={downloadUrl}
          download="voxlingo-doblaje.mp4"
          className="text-center text-sm font-medium text-emerald-400 underline underline-offset-2"
        >
          Descargar video listo
        </a>
      )}
    </div>
  );
}
