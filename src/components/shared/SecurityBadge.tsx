import React from 'react';
import { ShieldAlert, KeyRound, HardDrive, RefreshCw, Layers } from 'lucide-react';

export const SecurityBadge: React.FC = () => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
      <div className="glass-panel p-3 rounded-xl border border-cyan-500/20 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
          <KeyRound className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-300">AES-256-GCM E2EE</div>
          <div className="text-[10px] text-slate-400 font-mono">Zero-Knowledge Key</div>
        </div>
      </div>

      <div className="glass-panel p-3 rounded-xl border border-emerald-500/20 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
          <HardDrive className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-300">0 KB Disk Storage</div>
          <div className="text-[10px] text-emerald-400/90 font-mono">Pure RAM Relay</div>
        </div>
      </div>

      <div className="glass-panel p-3 rounded-xl border border-indigo-500/20 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-300">Sandboxed DRM</div>
          <div className="text-[10px] text-indigo-300/90 font-mono">Anti-Exfiltration Shield</div>
        </div>
      </div>

      <div className="glass-panel p-3 rounded-xl border border-rose-500/20 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
          <RefreshCw className="w-4 h-4" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-slate-300">RAM Zeroization</div>
          <div className="text-[10px] text-rose-300/90 font-mono">Cryptographic Shred</div>
        </div>
      </div>
    </div>
  );
};
