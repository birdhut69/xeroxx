import React from 'react';
import { Stamp, ShieldCheck, Calendar, Lock } from 'lucide-react';

interface WatermarkToolProps {
  watermarkText: string;
  maxCopies: number;
  onWatermarkChange: (text: string) => void;
  onMaxCopiesChange: (copies: number) => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({
  watermarkText,
  maxCopies,
  onWatermarkChange,
  onMaxCopiesChange
}) => {
  const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const presets = [
    `Valid ONLY for Xerox on ${currentDate}`,
    'Single Copy Authorized • Not for Banking',
    'Identity Verification Only • Do Not Duplicate'
  ];

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-700/80 space-y-3">
      <div className="flex items-center gap-2">
        <Stamp className="w-4 h-4 text-cyan-400" />
        <h4 className="text-xs font-bold text-slate-200">Security Watermark & Print Permissions</h4>
      </div>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onWatermarkChange(p)}
            className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all text-left ${
              watermarkText === p
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Custom Watermark Input */}
      <div>
        <input
          type="text"
          value={watermarkText}
          onChange={(e) => onWatermarkChange(e.target.value)}
          placeholder="Custom watermark text (e.g. Valid only for Xerox on 27-Aug)..."
          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
        />
      </div>

      {/* Permission Limits */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
        <span className="text-slate-400 flex items-center gap-1.5 font-mono">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          Max Print Copies Allowed:
        </span>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onMaxCopiesChange(num)}
              className={`w-7 h-7 rounded-lg text-xs font-bold font-mono transition-all ${
                maxCopies === num
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
