import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface QRCodeDisplayProps {
  url: string;
  code: string;
}

export function QRCodeDisplay({ url, code }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
      <div className="rounded-2xl bg-white p-4 shadow-lg">
        <QRCodeSVG value={url} size={220} level="M" />
      </div>

      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-slate-500">Codigo de sala</p>
        <p className="text-3xl font-bold tracking-[0.2em] text-emerald-400">{code}</p>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm text-slate-300 hover:border-slate-600 hover:bg-slate-800"
      >
        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
        {copied ? 'Enlace copiado' : 'Copiar enlace'}
      </button>

      <p className="max-w-xs text-center text-xs text-slate-500">
        Tu invitado escanea el codigo y entra directo, sin instalar nada ni registrarse.
      </p>
    </div>
  );
}
