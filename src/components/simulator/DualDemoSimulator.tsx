import React, { useState } from 'react';
import { Monitor, Smartphone, Sparkles, ArrowRight, ShieldCheck, Zap, Play, HelpCircle, CheckCircle2 } from 'lucide-react';
import { TerminalDashboard } from '../terminal/TerminalDashboard';
import { CustomerPortal } from '../customer/CustomerPortal';
import { useToast } from '../shared/ToastContext';

export const DualDemoSimulator: React.FC = () => {
  const [customerKeyUrl, setCustomerKeyUrl] = useState<string | null>(null);
  const toast = useToast();

  const handleOpenCustomerView = (url: string) => {
    setCustomerKeyUrl(url);
    const params = new URL(url);
    window.history.replaceState({}, '', `/?room=${params.searchParams.get('room')}${params.hash}`);
    toast.success('Mobile Client Paired!', 'Loaded session and AES-256 key into mobile frame.');
  };

  return (
    <div className="max-w-[1680px] mx-auto px-3 sm:px-6 py-4 space-y-5">
      {/* Interactive Simulator Banner */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-indigo-500/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xl">
        <div className="flex items-center gap-3.5 text-left">
          <div className="p-3 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 shadow-inner">
            <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-black text-white flex items-center gap-2">
              <span>Dual Interactive Live Simulator</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/40">
                End-to-End E2EE Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Experience both the <strong>Shopkeeper Safe Terminal</strong> (left) and <strong>Customer Phone PWA</strong> (right) operating in real-time.
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-xs font-mono text-cyan-300">
            <Zap className="w-4 h-4 text-cyan-400 animate-bounce" />
            <span>Live Ephemeral Relay Active</span>
          </div>
        </div>
      </div>

      {/* Split Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Half: Xerox Terminal View (7 Cols) */}
        <div className="lg:col-span-7 space-y-2.5 text-left">
          <div className="flex items-center justify-between px-2 text-xs font-black text-slate-300 uppercase font-mono">
            <span className="flex items-center gap-2 text-cyan-400">
              <Monitor className="w-4 h-4" />
              Shopkeeper Safe Terminal (Desktop View)
            </span>
            <span className="text-slate-400 text-[11px]">100% In-Memory DRM</span>
          </div>

          <div className="glass-panel rounded-3xl border border-cyan-500/30 p-2 sm:p-3 overflow-hidden shadow-2xl">
            <TerminalDashboard onOpenCustomerView={handleOpenCustomerView} />
          </div>
        </div>

        {/* Right Half: Customer Smartphone Simulator (5 Cols) */}
        <div className="lg:col-span-5 space-y-2.5 text-left">
          <div className="flex items-center justify-between px-2 text-xs font-black text-slate-300 uppercase font-mono">
            <span className="flex items-center gap-2 text-indigo-400">
              <Smartphone className="w-4 h-4" />
              Customer Mobile Experience (PWA)
            </span>
            <span className="text-slate-400 text-[11px]">Client-Side AES-256</span>
          </div>

          {/* Smartphone Frame Simulation */}
          <div className="relative mx-auto max-w-sm rounded-[46px] p-3 sm:p-3.5 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-[7px] border-slate-700 shadow-2xl shadow-indigo-500/25">
            {/* Phone Speaker & Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center gap-2 z-30 shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
              <div className="w-9 h-1.5 rounded-full bg-slate-800" />
            </div>

            {/* Screen Content Container */}
            <div className="pt-7 pb-4 min-h-[660px] max-h-[760px] overflow-y-auto rounded-[36px] bg-slate-950 border border-slate-800 shadow-inner">
              <CustomerPortal />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
