import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ShieldCheck, RefreshCw, Key, ExternalLink, Sun, Sparkles } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

interface QRDisplayProps {
  sessionId: string;
  sessionKeyHex: string;
  shopId: string;
  shopName: string;
  onRefreshSession: () => void;
  onOpenCustomerView?: (url: string) => void;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({
  sessionId,
  sessionKeyHex,
  shopId,
  shopName,
  onRefreshSession,
  onOpenCustomerView
}) => {
  const [copied, setCopied] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const toast = useToast();

  // Full pairing URL including the hash fragment containing the AES key
  const customerUrl = `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(customerUrl);
    setCopied(true);
    sounds.playSuccess();
    toast.success('Pairing Link Copied!', 'Share or open in your mobile browser to pair instantly.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleManualRefresh = () => {
    onRefreshSession();
    toast.shield('New Ephemeral Key Generated', 'Old session keys discarded from memory.');
  };

  return (
    <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl flex flex-col items-center text-center relative overflow-hidden max-w-md mx-auto shadow-2xl transition-all duration-300">
      <div className="scanline-effect" />

      {/* Holographic Glowing Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
          <QrCode className="w-5 h-5" />
        </span>
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
          Scan to Send Document
        </h2>
      </div>

      <p className="text-xs sm:text-sm text-slate-300 mb-6 max-w-xs leading-relaxed">
        Point any smartphone camera at this QR code to beam documents over an encrypted in-memory stream.
      </p>

      {/* QR Code Frame with Cyberpunk Corner Accents */}
      <div className="relative p-5 bg-white rounded-3xl shadow-2xl shadow-cyan-500/30 border-4 border-cyan-400/80 mb-6 group transition-transform duration-300 hover:scale-[1.02]">
        {/* Holographic corner markers */}
        <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-cyan-300 rounded-tl-xl" />
        <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-cyan-300 rounded-tr-xl" />
        <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-cyan-300 rounded-bl-xl" />
        <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-cyan-300 rounded-br-xl" />

        <QRCodeSVG
          value={customerUrl}
          size={220}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23080c14' stroke='%2300ffcc' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='M12 8v4'/><path d='M12 16h.01'/></svg>",
            x: undefined,
            y: undefined,
            height: 44,
            width: 44,
            excavate: true,
          }}
        />

        <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 bg-slate-950 px-3.5 py-1 rounded-full border border-cyan-400 text-[10px] font-mono font-black text-cyan-300 shadow-xl flex items-center gap-1.5 whitespace-nowrap">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>AES-256 E2EE READY</span>
        </div>
      </div>

      {/* Terminal & Session Info Card */}
      <div className="w-full space-y-2 bg-slate-900/95 p-4 rounded-2xl border border-slate-800 text-left font-mono text-xs mb-5 shadow-inner">
        <div className="flex justify-between items-center text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Station:
          </span>
          <span className="text-slate-100 font-bold">{shopName}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Terminal ID:</span>
          <span className="text-cyan-400 font-bold">{shopId}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Session Hash:</span>
          <span className="text-emerald-400 font-semibold truncate max-w-[150px]" title={sessionId}>
            {sessionId.substring(0, 12)}...
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 w-full">
        <button
          onClick={handleCopy}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95 shadow-md"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
          <span>{copied ? 'Link Copied!' : 'Copy Pairing Link'}</span>
        </button>

        {onOpenCustomerView && (
          <button
            onClick={() => onOpenCustomerView(customerUrl)}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-all active:scale-95 shadow-md"
            title="Open customer view in new tab or frame"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Test Client</span>
          </button>
        )}

        <button
          onClick={handleManualRefresh}
          title="Regenerate Session Keys & New QR"
          className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Zero-Knowledge Security Notice */}
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-mono">
        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Keys stay in URL hash (#) — Server never sees keys.</span>
      </div>
    </div>
  );
};
