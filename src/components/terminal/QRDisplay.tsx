import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, ShieldCheck, RefreshCw, Key, ExternalLink } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

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

  // The complete pairing URL including the hash fragment containing the AES key
  const customerUrl = `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(customerUrl);
    setCopied(true);
    sounds.playSuccess();
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="glass-panel-glow p-6 sm:p-8 rounded-2xl flex flex-col items-center text-center relative overflow-hidden max-w-md mx-auto">
      <div className="scanline-effect" />

      {/* Holographic Glowing Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
          <QrCode className="w-5 h-5" />
        </span>
        <h2 className="text-xl font-extrabold tracking-tight text-white">
          Scan to Send Document
        </h2>
      </div>

      <p className="text-xs text-slate-300 mb-6 max-w-xs leading-relaxed">
        Point your phone camera to securely beam files directly to this print station.
      </p>

      {/* QR Code Container with Glowing Frame */}
      <div className="relative p-4 bg-white rounded-2xl shadow-2xl shadow-cyan-500/30 border-4 border-cyan-400/80 mb-6 group transition-transform duration-300 hover:scale-[1.02]">
        <QRCodeSVG
          value={customerUrl}
          size={230}
          level="H"
          includeMargin={false}
          imageSettings={{
            src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23080c14' stroke='%2300ffcc' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='M12 8v4'/><path d='M12 16h.01'/></svg>",
            x: undefined,
            y: undefined,
            height: 42,
            width: 42,
            excavate: true,
          }}
        />
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-950 px-3 py-0.5 rounded-full border border-cyan-400 text-[10px] font-mono font-bold text-cyan-300 shadow-md">
          AES-256 E2EE ACTIVE
        </div>
      </div>

      {/* Terminal & Session Info */}
      <div className="w-full space-y-2 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 text-left font-mono text-xs mb-5">
        <div className="flex justify-between items-center text-slate-400">
          <span>Station:</span>
          <span className="text-slate-200 font-bold">{shopName}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Shop ID:</span>
          <span className="text-cyan-400">{shopId}</span>
        </div>
        <div className="flex justify-between items-center text-slate-400">
          <span>Session Hash:</span>
          <span className="text-emerald-400 truncate max-w-[140px]" title={sessionId}>
            {sessionId.substring(0, 10)}...
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-semibold transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
          <span>{copied ? 'Link Copied!' : 'Copy Pairing Link'}</span>
        </button>

        {onOpenCustomerView && (
          <button
            onClick={() => onOpenCustomerView(customerUrl)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-all"
            title="Open customer view in new tab for testing"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Test Client</span>
          </button>
        )}

        <button
          onClick={onRefreshSession}
          title="Regenerate Session Keys & New QR"
          className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Zero-Knowledge Security Notice */}
      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Keys live only in URL hash (#) — Server never sees keys.</span>
      </div>
    </div>
  );
};
