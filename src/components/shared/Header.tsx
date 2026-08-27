import React from 'react';
import { ShieldCheck, Lock, Cpu, Volume2, VolumeX, Smartphone, Monitor, Sparkles } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface HeaderProps {
  currentMode: 'TERMINAL' | 'CUSTOMER' | 'SIMULATOR';
  onModeChange: (mode: 'TERMINAL' | 'CUSTOMER' | 'SIMULATOR') => void;
  serverOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, serverOnline = true }) => {
  const [audioEnabled, setAudioEnabled] = React.useState(sounds.enabled);

  const toggleAudio = () => {
    sounds.enabled = !sounds.enabled;
    setAudioEnabled(sounds.enabled);
    if (sounds.enabled) sounds.playSuccess();
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-cyan-500/20 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Security Guarantee */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-lg shadow-cyan-500/20">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                SafePrint
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                Zero-Trust E2EE
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
              <Lock className="w-3 h-3 text-emerald-400 inline" />
              100% In-Memory • Ephemeral Shredder
            </p>
          </div>
        </div>

        {/* Mode Navigation Tabs */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
          <button
            onClick={() => onModeChange('TERMINAL')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentMode === 'TERMINAL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Xerox Terminal</span>
          </button>

          <button
            onClick={() => onModeChange('CUSTOMER')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentMode === 'CUSTOMER'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Customer Mobile</span>
          </button>

          <button
            onClick={() => onModeChange('SIMULATOR')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              currentMode === 'SIMULATOR'
                ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/30'
                : 'text-indigo-400 hover:text-indigo-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Dual Live Demo</span>
          </button>
        </div>

        {/* Right Status Badges */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/50 text-xs font-mono text-slate-300">
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{serverOnline ? 'Relay Active' : 'Relay Offline'}</span>
          </div>

          <button
            onClick={toggleAudio}
            title={audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 transition-colors"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>
    </header>
  );
};
