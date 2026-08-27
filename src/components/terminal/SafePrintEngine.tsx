import React, { useState } from 'react';
import { Printer, ShieldAlert, CheckCircle2, Flame, AlertTriangle } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface SafePrintEngineProps {
  filename: string;
  totalPages: number;
  copies: number;
  isPrinting: boolean;
  printCompleted: boolean;
  onExecutePrint: () => void;
  onManualShred: () => void;
}

export const SafePrintEngine: React.FC<SafePrintEngineProps> = ({
  filename,
  totalPages,
  copies,
  isPrinting,
  printCompleted,
  onExecutePrint,
  onManualShred
}) => {
  return (
    <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
      {/* File & Print Meta */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Printer className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{filename}</span>
            {printCompleted && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono border border-emerald-500/40 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Printed
              </span>
            )}
          </h4>
          <p className="text-xs text-slate-400 font-mono">
            {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} • {copies} {copies === 1 ? 'Copy' : 'Copies'} ({totalPages * copies} total prints)
          </p>
        </div>
      </div>

      {/* Print & Shred Buttons */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <button
          onClick={onExecutePrint}
          disabled={isPrinting}
          className="btn-cyber-primary flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20"
        >
          <Printer className="w-4 h-4" />
          <span>{isPrinting ? 'Printing Document...' : 'Print via Safe Pipeline'}</span>
        </button>

        <button
          onClick={onManualShred}
          className="btn-cyber-danger flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20"
          title="Instantly Zeroize RAM & Commit Cryptographic Shred Block"
        >
          <Flame className="w-4 h-4" />
          <span>Shred Now</span>
        </button>
      </div>
    </div>
  );
};
