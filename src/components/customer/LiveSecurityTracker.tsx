import React from 'react';
import { Lock, Radio, Cpu, Printer, Flame, CheckCircle2, ShieldCheck } from 'lucide-react';

interface LiveSecurityTrackerProps {
  status: 'IDLE' | 'ENCRYPTING' | 'STREAMING' | 'RECEIVED' | 'PRINTING' | 'PRINT_COMPLETED' | 'SHREDDED';
  uploadProgress: number;
}

export const LiveSecurityTracker: React.FC<LiveSecurityTrackerProps> = ({
  status,
  uploadProgress
}) => {
  const steps = [
    {
      id: 'ENCRYPT',
      title: 'Client-Side E2EE',
      desc: 'AES-256-GCM encrypted in browser RAM',
      icon: Lock,
      active: status === 'ENCRYPTING',
      done: ['STREAMING', 'RECEIVED', 'PRINTING', 'PRINT_COMPLETED', 'SHREDDED'].includes(status)
    },
    {
      id: 'STREAM',
      title: 'Zero-Disk Relay',
      desc: `Ephemeral streaming (${uploadProgress}%)`,
      icon: Radio,
      active: status === 'STREAMING',
      done: ['RECEIVED', 'PRINTING', 'PRINT_COMPLETED', 'SHREDDED'].includes(status)
    },
    {
      id: 'SANDBOX',
      title: 'DRM Sandbox',
      desc: 'Rendered in RAM with Anti-Save shield',
      icon: Cpu,
      active: status === 'RECEIVED',
      done: ['PRINTING', 'PRINT_COMPLETED', 'SHREDDED'].includes(status)
    },
    {
      id: 'PRINT',
      title: 'Physical Print',
      desc: status === 'PRINTING' ? 'Printing in progress...' : 'Print execution verified',
      icon: Printer,
      active: status === 'PRINTING',
      done: ['PRINT_COMPLETED', 'SHREDDED'].includes(status)
    },
    {
      id: 'SHRED',
      title: 'Ephemeral Shred',
      desc: 'RAM zeroized & hash committed',
      icon: Flame,
      active: status === 'PRINT_COMPLETED',
      done: status === 'SHREDDED'
    }
  ];

  return (
    <div className="glass-panel-glow p-5 rounded-2xl max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Zero-Trust Lifecycle Monitor
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
          LIVE TELEMETRY
        </span>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                step.active
                  ? 'bg-cyan-500/10 border-cyan-400 shadow-md shadow-cyan-500/10'
                  : step.done
                  ? 'bg-slate-900/60 border-emerald-500/30'
                  : 'bg-slate-900/30 border-slate-800 opacity-40'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 ${
                  step.active
                    ? 'bg-cyan-500 text-slate-950 animate-pulse'
                    : step.done
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {step.done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${step.active ? 'text-cyan-300' : step.done ? 'text-slate-200' : 'text-slate-500'}`}>
                    {step.title}
                  </span>
                  {step.active && (
                    <span className="text-[10px] font-mono font-semibold text-cyan-400 animate-pulse">
                      In Progress...
                    </span>
                  )}
                  {step.done && (
                    <span className="text-[10px] font-mono font-semibold text-emerald-400">
                      Verified ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
