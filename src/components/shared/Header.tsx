import React, { useState } from 'react';
import { ShieldCheck, Lock, Cpu, Volume2, VolumeX, Smartphone, Monitor, Sparkles, HelpCircle, Menu, X } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { ComparisonModal } from './ComparisonModal';

interface HeaderProps {
  currentMode: 'TERMINAL' | 'CUSTOMER' | 'SIMULATOR';
  onModeChange: (mode: 'TERMINAL' | 'CUSTOMER' | 'SIMULATOR') => void;
  serverOnline?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, serverOnline = true }) => {
  const [audioEnabled, setAudioEnabled] = useState(sounds.enabled);
  const [showComparison, setShowComparison] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleAudio = () => {
    sounds.enabled = !sounds.enabled;
    setAudioEnabled(sounds.enabled);
    if (sounds.enabled) sounds.playSuccess();
  };

  const handleSelectMode = (mode: 'TERMINAL' | 'CUSTOMER' | 'SIMULATOR') => {
    onModeChange(mode);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-cyan-500/20 px-4 py-3 sm:px-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand & Security Guarantee */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-lg shadow-cyan-500/20 shrink-0">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                  SafePrint
                </span>
                <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  Zero-Trust E2EE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
                <Lock className="w-3 h-3 text-emerald-400 inline" />
                100% In-Memory • Ephemeral Shredder
              </p>
            </div>
          </div>

          {/* Desktop Mode Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-2xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => handleSelectMode('TERMINAL')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                currentMode === 'TERMINAL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Xerox Terminal</span>
            </button>

            <button
              onClick={() => handleSelectMode('CUSTOMER')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                currentMode === 'CUSTOMER'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer Mobile</span>
            </button>

            <button
              onClick={() => handleSelectMode('SIMULATOR')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                currentMode === 'SIMULATOR'
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-md shadow-indigo-500/30 font-bold'
                  : 'text-indigo-400 hover:text-indigo-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Dual Live Demo</span>
            </button>
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compare WhatsApp vs SafePrint Button */}
            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 text-xs font-medium transition-all hover:border-cyan-500/40 active:scale-95"
              title="See why SafePrint is safer than WhatsApp"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Why SafePrint?</span>
            </button>

            {/* Server Online Status Pill */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-700/50 text-xs font-mono text-slate-300">
              <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[11px]">{serverOnline ? 'Relay Active' : 'Relay Offline'}</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={toggleAudio}
              title={audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 text-slate-300 transition-colors active:scale-95"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-3 pb-2 space-y-2 border-t border-slate-800/80 mt-3 animate-in slide-in-from-top duration-200">
            <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => handleSelectMode('TERMINAL')}
                className={`py-2 px-2 rounded-lg text-xs font-bold text-center flex flex-col items-center gap-1 ${
                  currentMode === 'TERMINAL' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400'
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Terminal</span>
              </button>

              <button
                onClick={() => handleSelectMode('CUSTOMER')}
                className={`py-2 px-2 rounded-lg text-xs font-bold text-center flex flex-col items-center gap-1 ${
                  currentMode === 'CUSTOMER' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile</span>
              </button>

              <button
                onClick={() => handleSelectMode('SIMULATOR')}
                className={`py-2 px-2 rounded-lg text-xs font-bold text-center flex flex-col items-center gap-1 ${
                  currentMode === 'SIMULATOR' ? 'bg-indigo-500 text-white shadow-md' : 'text-indigo-400'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Dual Demo</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* WhatsApp vs SafePrint Comparison Modal */}
      <ComparisonModal
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
      />
    </>
  );
};
