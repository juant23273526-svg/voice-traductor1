import { useEffect, useRef, useState } from 'react';
import { Upload, Video as VideoIcon } from 'lucide-react';
import clsx from 'clsx';
import { VideoDropzone } from './VideoDropzone';
import { VideoRecorder } from './VideoRecorder';
import { DubbingProcessor, type DubbingOutput } from './DubbingProcessor';
import { SubtitleCanvas } from './SubtitleCanvas';
import { SubtitleStyleSelector } from './SubtitleStyleSelector';
import { ExportPanel } from './ExportPanel';
import { LANGUAGE_OPTIONS } from '@/constants/languages';
import { DEFAULT_SUBTITLE_STYLE, type SubtitleStyle } from '@/types/clipstudio';

type SourceMode = 'upload' | 'record';

function tabButtonClass(active: boolean): string {
  return clsx(
    'flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition',
    active ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
  );
}

export function ClipStudioMode() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [isDubbing, setIsDubbing] = useState(false);
  const [dubbingOutput, setDubbingOutput] = useState<DubbingOutput | null>(null);
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(DEFAULT_SUBTITLE_STYLE);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dubbedAudioRef = useRef<HTMLAudioElement>(null);

  const handleFileAccepted = (file: File) => {
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setDubbingOutput(null);
    setIsChangingLanguage(false);
    setError(null);
  };

  const handleStartDubbing = () => {
    setError(null);
    setDubbingOutput(null);
    setIsChangingLanguage(false);
    setIsDubbing(true);
  };

  const resetClip = () => {
    setVideoFile(null);
    setVideoUrl(null);
    setDubbingOutput(null);
    setIsChangingLanguage(false);
    setError(null);
  };

  // Previsualizador multicapa: silencia el audio original del <video> y
  // mantiene el <audio> con el doblaje sincronizado (play/pause/seek).
  useEffect(() => {
    const video = videoRef.current;
    const audio = dubbedAudioRef.current;
    if (!video || !audio || !dubbingOutput) return;

    video.muted = true;
    audio.currentTime = video.currentTime;

    const handlePlay = () => {
      audio.currentTime = video.currentTime;
      void audio.play().catch((err) => console.error('[ClipStudio] Error reproduciendo audio doblado sincronizado', err));
    };
    const handlePause = () => audio.pause();
    const handleSeeked = () => {
      audio.currentTime = video.currentTime;
    };
    const handleTimeUpdate = () => {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.3) {
        audio.currentTime = video.currentTime;
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.muted = false;
      audio.pause();
    };
  }, [dubbingOutput]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Clip Studio & Doblaje Express</h1>
        <p className="mt-1 text-sm text-slate-400">
          Sube o graba un clip corto, dóblalo con voz sintetica clonada y exporta con subtitulos
          animados estilo CapCut.
        </p>
      </header>

      {!videoFile && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900/40 p-1">
            <button type="button" onClick={() => setSourceMode('upload')} className={tabButtonClass(sourceMode === 'upload')}>
              <Upload size={16} /> Subir
            </button>
            <button type="button" onClick={() => setSourceMode('record')} className={tabButtonClass(sourceMode === 'record')}>
              <VideoIcon size={16} /> Grabar
            </button>
          </div>

          {sourceMode === 'upload' ? (
            <VideoDropzone onFileAccepted={handleFileAccepted} />
          ) : (
            <VideoRecorder onFileRecorded={handleFileAccepted} />
          )}
        </div>
      )}

      {videoFile && videoUrl && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-black">
          <video ref={videoRef} src={videoUrl} controls playsInline className="w-full" />
          {dubbingOutput && (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={dubbedAudioRef} src={dubbingOutput.synthesis.audioUrl} preload="auto" />
              <SubtitleCanvas videoRef={videoRef} words={dubbingOutput.wordCues} style={subtitleStyle} />
            </>
          )}
        </div>
      )}

      {videoFile && (!dubbingOutput || isChangingLanguage) && !isDubbing && (
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
            {isChangingLanguage ? 'Volver a doblar' : 'Doblar video'}
          </button>

          {isChangingLanguage && (
            <button
              type="button"
              onClick={() => setIsChangingLanguage(false)}
              className="text-center text-xs text-slate-500 underline underline-offset-2"
            >
              Cancelar
            </button>
          )}
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

      {dubbingOutput && videoFile && !isChangingLanguage && (
        <>
          <SubtitleStyleSelector value={subtitleStyle} onChange={setSubtitleStyle} />

          <button
            type="button"
            onClick={() => setIsChangingLanguage(true)}
            className="rounded-2xl border border-slate-700 bg-slate-900/40 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600"
          >
            Cambiar idioma / volver a doblar
          </button>

          <ExportPanel
            videoFile={videoFile}
            dubbedAudioBlob={dubbingOutput.synthesis.audioBlob}
            wordCues={dubbingOutput.wordCues}
            burnSubtitles={burnSubtitles}
            onBurnSubtitlesChange={setBurnSubtitles}
            subtitleStyle={subtitleStyle}
          />
        </>
      )}

      {videoFile && (
        <button
          type="button"
          onClick={resetClip}
          className="text-center text-xs text-slate-500 underline underline-offset-2"
        >
          Empezar con otro clip
        </button>
      )}
    </div>
  );
}
