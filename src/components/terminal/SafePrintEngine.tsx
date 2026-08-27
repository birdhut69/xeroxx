import React, { useState } from 'react';
import { Printer, ShieldAlert, CheckCircle2, Flame, AlertTriangle, Layers, FileText } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

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
  const [paperSize, setPaperSize] = useState<'A4' | 'LEGAL' | 'LETTER'>('A4');
  const toast = useToast();

  const handlePrint = () => {
    toast.info('Sending Direct to Printer', 'Routing canvas directly to system print driver...');
    onExecutePrint();
  };

  const handleShred = () => {
    toast.shield('Zeroizing Memory', 'Overwriting all image buffers and clearing RAM...');
    onManualShred();
  };

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-cyan-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 no-print shadow-xl">
      {/* File & Print Meta */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0 shadow-inner">
          <Printer className="w-6 h-6" />
        </div>
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-bold text-white truncate max-w-[200px] sm:max-w-xs" title={filename}>
              {filename}
            </h4>
            {printCompleted && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/40 flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Printed
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {totalPages} {totalPages === 1 ? 'Page' : 'Pages'} • {copies} {copies === 1 ? 'Copy' : 'Copies'} ({totalPages * copies} total print sheets)
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        {/* Paper Size selector */}
        <div className="hidden lg:flex items-center bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
          <span className="text-slate-500 mr-2">Paper:</span>
          <span className="font-bold text-cyan-400">{paperSize}</span>
        </div>

        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="btn-cyber-primary flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-cyan-500/25 active:scale-95 transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>{isPrinting ? 'Dispatching to Printer...' : 'Print via Safe Pipeline'}</span>
        </button>

        <button
          onClick={handleShred}
          className="btn-cyber-danger flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-500/25 active:scale-95 transition-all"
          title="Instantly Zeroize RAM & Commit Cryptographic Shred Block"
        >
          <Flame className="w-4 h-4" />
          <span>Shred Now</span>
        </button>
      </div>
    </div>
  );
};
