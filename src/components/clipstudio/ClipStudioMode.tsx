import { useRef, useState } from 'react';
import { VideoDropzone } from './VideoDropzone';
import { DubbingProcessor, type DubbingOutput } from './DubbingProcessor';
import { SubtitleCanvas } from './SubtitleCanvas';
import { ExportPanel } from './ExportPanel';
import { LANGUAGE_OPTIONS } from '@/constants/languages';

export function ClipStudioMode() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isDubbing, setIsDubbing] = useState(false);
  const [dubbingOutput, setDubbingOutput] = useState<DubbingOutput | null>(null);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleFileAccepted = (file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setDubbingOutput(null);
    setError(null);
  };

  const handleStartDubbing = () => {
    setError(null);
    setDubbingOutput(null);
    setIsDubbing(true);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Clip Studio & Doblaje Express</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sube un clip corto, dóblalo con voz sintetica clonada y exporta con subtitulos
          animados estilo CapCut.
        </p>
      </header>

      {!videoFile && <VideoDropzone onFileAccepted={handleFileAccepted} />}

      {videoFile && videoUrl && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
          <video ref={videoRef} src={videoUrl} controls className="w-full" />
          {dubbingOutput && (
            <SubtitleCanvas videoRef={videoRef} words={dubbingOutput.wordCues} />
          )}
        </div>
      )}

      {videoFile && !dubbingOutput && !isDubbing && (
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Idioma de doblaje
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setTargetLanguage(lang.code)}
                className={`rounded-xl border px-3 py-2 text-sm transition ${
                  targetLanguage === lang.code
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
                }`}
              >
                {lang.flagEmoji} {lang.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleStartDubbing}
            className="mt-2 rounded-2xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-400"
          >
            Doblar video
          </button>
        </div>
      )}

      {isDubbing && videoFile && (
        <DubbingProcessor
          videoFile={videoFile}
          sourceLanguageCode="auto"
          targetLanguageCode={targetLanguage}
          voiceId={`voice_${targetLanguage}`}
          onComplete={(output) => {
            setDubbingOutput(output);
            setIsDubbing(false);
          }}
          onError={(err) => {
            setError(err.message);
            setIsDubbing(false);
          }}
        />
      )}

      {error && (
        <p className="rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {dubbingOutput && videoFile && (
        <ExportPanel
          videoFile={videoFile}
          dubbedAudioBlob={dubbingOutput.synthesis.audioBlob}
          wordCues={dubbingOutput.wordCues}
          burnSubtitles={burnSubtitles}
          onBurnSubtitlesChange={setBurnSubtitles}
        />
      )}

      {videoFile && (
        <button
          type="button"
          onClick={() => {
            setVideoFile(null);
            setVideoUrl(null);
            setDubbingOutput(null);
            setError(null);
          }}
          className="text-center text-xs text-slate-500 underline underline-offset-2"
        >
          Empezar con otro clip
        </button>
      )}
    </div>
  );
}
