import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';
import { generateRoomId } from '@/services/websocketRoom';
import { LANGUAGE_OPTIONS } from '@/constants/languages';

export function CreateRoomView() {
  const navigate = useNavigate();
  const [hostLanguage, setHostLanguage] = useState('es');
  const [guestLanguage, setGuestLanguage] = useState('en');

  const handleCreate = () => {
    const roomId = generateRoomId();
    const params = new URLSearchParams({ role: 'host', hostLang: hostLanguage, guestLang: guestLanguage });
    navigate(`/room/${roomId}?${params.toString()}`);
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-50">Live Room</h1>
        <p className="mt-1 text-sm text-slate-400">
          Crea una sala y comparte el codigo QR para hablar en tiempo real con alguien que no
          habla tu idioma. Sin registro, sin base de datos: la sala vive solo mientras esta
          abierta.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
        <LanguagePicker label="Tu idioma" value={hostLanguage} onChange={setHostLanguage} />
        <LanguagePicker label="Idioma del invitado" value={guestLanguage} onChange={setGuestLanguage} />

        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3 font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400"
        >
          <Radio size={18} />
          Crear Sala Live
        </button>
      </section>
    </div>
  );
}

function LanguagePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {LANGUAGE_OPTIONS.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onChange(lang.code)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              value === lang.code
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600'
            }`}
          >
            {lang.flagEmoji} {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
