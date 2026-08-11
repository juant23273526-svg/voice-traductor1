import { useState } from 'react';
import { useAudioPipeline } from '@/hooks/useAudioPipeline';
import { useSimulatedVolume } from '@/hooks/useSimulatedVolume';
import { PresetSelector } from './PresetSelector';
import { HoldToTalkButton } from './HoldToTalkButton';
import { TranslationCard } from './TranslationCard';
import { WaveformVisualizer } from '@/components/shared/WaveformVisualizer';
import { StatusIndicator } from '@/components/shared/StatusIndicator';
import { ProcessingStages } from '@/components/shared/ProcessingStages';
import { CULTURAL_PRESETS, DEFAULT_PRESET_ID, getPresetById } from '@/constants/culturalPresets';

const SIMPLE_STATUSES = new Set(['IDLE', 'RECORDING', 'ERROR', 'PLAYING']);

export function SlangMode() {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET_ID);
  const {
    status,
    volume,
    isHolding,
    result,
    lastError,
    startHold,
    endHold,
    cancelHold,
  } = useAudioPipeline();

  const preset = getPresetById(presetId);

  // Mientras se espera la respuesta de /api/translate (STT->LLM->TTS en el
  // edge, una sola llamada de red) no hay señal real de microfono — se
  // alimenta el mismo Canvas con una onda simulada para que la interfaz se
  // sienta viva en vez de mostrar un spinner estatico.
  const isProcessing = !SIMPLE_STATUSES.has(status);
  const simulatedVolume = useSimulatedVolume(isProcessing);
  const waveformVolume = isHolding ? volume : simulatedVolume;
  const waveformActive = isHolding || isProcessing;

  const handleHoldEnd = async () => {
    try {
      await endHold({
        sourceLanguage: 'auto',
        targetLanguage: preset.languageCode,
        systemPrompt: preset.systemPrompt,
        presetId: preset.id,
        voiceId: preset.voiceId,
        pitchShift: preset.pitchShift,
        speedMultiplier: preset.speedMultiplier,
      });
    } catch {
      // el error ya se refleja via lastError desde el contexto del pipeline
    }
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Slang & Personality</h1>
        <p className="mt-1 text-sm text-slate-400">
          Habla y tu voz se adapta a la jerga y el tono de la region que elijas.
        </p>
      </header>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Preset cultural
        </p>
        <PresetSelector selectedId={presetId} onSelect={setPresetId} />
      </section>

      <section className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
        <WaveformVisualizer
          volume={waveformVolume}
          active={waveformActive}
          barColor={preset.accentColor}
          className="w-full"
        />

        <HoldToTalkButton
          isHolding={isHolding}
          disabled={status !== 'IDLE' && !isHolding}
          onHoldStart={startHold}
          onHoldEnd={handleHoldEnd}
          onHoldCancel={cancelHold}
        />

        {isProcessing ? (
          <ProcessingStages status={status} className="w-full max-w-xs" />
        ) : (
          <StatusIndicator status={status} />
        )}
        <p className="text-center text-xs text-slate-500">
          Manten presionado para hablar, suelta para traducir
        </p>
      </section>

      {lastError && (
        <p className="rounded-xl border border-rose-900 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          {lastError.message}
        </p>
      )}

      {result && (
        <TranslationCard
          transcription={result.transcription}
          translation={result.translation}
          audioUrl={result.synthesis.audioUrl}
        />
      )}

      <p className="text-center text-[11px] text-slate-600">
        {CULTURAL_PRESETS.length} presets culturales disponibles · voces generativas via ElevenLabs/Cartesia
      </p>
    </div>
  );
}
