import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Flame, Clock, ShieldCheck } from 'lucide-react';

interface ShredAnimationProps {
  countdownSeconds: number;
  onShredTriggered: () => void;
  isShredding: boolean;
}

export const ShredAnimation: React.FC<ShredAnimationProps> = ({
  countdownSeconds,
  onShredTriggered,
  isShredding,
}) => {
  const [timeLeft, setTimeLeft] = useState(countdownSeconds);
  const onShredRef = useRef(onShredTriggered);
  const hasTriggeredRef = useRef(false);

  // Keep the callback ref up to date without re-triggering effects
  useEffect(() => {
    onShredRef.current = onShredTriggered;
  }, [onShredTriggered]);

  // Reset when countdownSeconds changes
  useEffect(() => {
    setTimeLeft(countdownSeconds);
    hasTriggeredRef.current = false;
  }, [countdownSeconds]);

  // Stable countdown timer — no dependency on onShredTriggered
  useEffect(() => {
    if (timeLeft <= 0 || hasTriggeredRef.current) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (!hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            // Use setTimeout to avoid calling setState during render
            setTimeout(() => onShredRef.current(), 0);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft <= 0]); // Only restart if we go from >0 to 0

  const percentage = Math.max(0, (timeLeft / countdownSeconds) * 100);

  const handleShredNow = useCallback(() => {
    if (!hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      onShredRef.current();
    }
  }, []);

  return (
    <div className="glass-panel-danger p-4 rounded-2xl border border-rose-500/40 relative overflow-hidden my-3 no-print">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
            <Flame className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">Auto-Destruct & Memory Purge</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                Zero-Retention
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Document buffers will be overwritten with cryptographic entropy in{' '}
              <strong className="text-rose-400 font-mono">{timeLeft}s</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-lg border border-rose-500/40">
            <Clock className="w-4 h-4" />
            <span>
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <button
            onClick={handleShredNow}
            disabled={isShredding}
            className="btn-cyber-danger px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/30 disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{isShredding ? 'Zeroizing...' : 'Shred Now'}</span>
          </button>
        </div>
      </div>

      <div className="w-full bg-slate-900/90 h-1.5 rounded-full mt-3 overflow-hidden border border-rose-500/20">
        <div
          className="h-full bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 transition-all duration-1000 ease-linear"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
