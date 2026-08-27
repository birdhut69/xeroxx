import React, { useState } from 'react';
import { Monitor, Smartphone, Sparkles, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { TerminalDashboard } from '../terminal/TerminalDashboard';
import { CustomerPortal } from '../customer/CustomerPortal';

export const DualDemoSimulator: React.FC = () => {
  const [customerKeyUrl, setCustomerKeyUrl] = useState<string | null>(null);

  const handleOpenCustomerView = (url: string) => {
    // When test client is clicked from terminal, auto load into customer frame
    setCustomerKeyUrl(url);
    const params = new URL(url);
    window.history.replaceState({}, '', `/?room=${params.searchParams.get('room')}${params.hash}`);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-4 space-y-4">
      {/* Simulator Banner */}
      <div className="glass-panel p-3.5 rounded-xl border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>Dual Interactive Live Simulator Mode</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/40">
                End-to-End Sandbox
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Test both the Shopkeeper Terminal and Customer Mobile Phone side-by-side in real time.
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-cyan-300 flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <span>Live WebSocket Relay Active</span>
        </div>
      </div>

      {/* Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Xerox Terminal View (7 Cols) */}
        <div className="lg:col-span-7 space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-300 uppercase font-mono">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Monitor className="w-4 h-4" />
              Shopkeeper Safe Terminal (Desktop View)
            </span>
            <span className="text-slate-500">In-Memory DRM Sandbox</span>
          </div>

          <div className="glass-panel rounded-2xl border border-cyan-500/30 p-2 overflow-hidden shadow-2xl">
            <TerminalDashboard onOpenCustomerView={handleOpenCustomerView} />
          </div>
        </div>

        {/* Right: Customer Mobile Phone Bezel (5 Cols) */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-300 uppercase font-mono">
            <span className="flex items-center gap-1.5 text-indigo-400">
              <Smartphone className="w-4 h-4" />
              Customer Mobile Experience (Zero-Install PWA)
            </span>
            <span className="text-slate-500">Client-Side E2EE</span>
          </div>

          {/* Smartphone Frame Simulation */}
          <div className="relative mx-auto max-w-sm rounded-[42px] p-3 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-[6px] border-slate-700 shadow-2xl shadow-indigo-500/20">
            {/* Phone Speaker & Camera Notch */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full border border-slate-800 flex items-center justify-center gap-2 z-20">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
              <div className="w-8 h-1 rounded-full bg-slate-800" />
            </div>

            {/* Screen Content Container */}
            <div className="pt-7 pb-4 min-h-[640px] max-h-[720px] overflow-y-auto rounded-[32px] bg-slate-950 border border-slate-800">
              <CustomerPortal />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
