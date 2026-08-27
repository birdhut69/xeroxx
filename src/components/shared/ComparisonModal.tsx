import React from 'react';
import { X, ShieldCheck, ShieldAlert, Check, Ban, HardDrive, Key, Lock, EyeOff, Flame } from 'lucide-react';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const comparisonRows = [
    {
      feature: 'Document Storage on Shop PC',
      whatsapp: 'Saved permanently to Downloads / WhatsApp Media folder',
      safeprint: '100% In-Memory RAM buffer (0 KB written to disk)',
      safe: true
    },
    {
      feature: 'Data Resale / Exfiltration Risk',
      whatsapp: 'High (Shopkeeper / malware has permanent file access)',
      safeprint: 'Eliminated (Encrypted stream & Sandboxed DRM Canvas)',
      safe: true
    },
    {
      feature: 'Document Redaction (Masking Aadhaar/PAN)',
      whatsapp: 'None (Full sensitive ID numbers exposed)',
      safeprint: 'Built-in client-side privacy blackout brush before encryption',
      safe: true
    },
    {
      feature: 'Unauthorized Extra Copies',
      whatsapp: 'Unrestricted (Shopkeeper can print unlimited copies)',
      safeprint: 'Restricted by cryptographic session permission limits',
      safe: true
    },
    {
      feature: 'Screenshot / Camera Scraping',
      whatsapp: 'Unprotected',
      safeprint: 'Dynamic Forensic Watermark Grid + Blur heuristics',
      safe: true
    },
    {
      feature: 'Proof of Document Deletion',
      whatsapp: 'None (Trust-based)',
      safeprint: 'Cryptographic SHA-256 Merkle Destruction Certificate',
      safe: true
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto flex items-center justify-center animate-in fade-in duration-200">
      <div className="glass-panel-glow max-w-2xl w-full rounded-3xl p-6 sm:p-8 relative border border-cyan-500/40 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-left space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            SECURITY ARCHITECTURE BRIEF
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Why WhatsApp Fails for Print Shops
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Every year, millions of personal documents are leaked or sold from print shop computers. Here is how SafePrint solves it at the protocol level.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="space-y-3">
          {comparisonRows.map((row, idx) => (
            <div
              key={idx}
              className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-left"
            >
              <div className="text-xs font-bold text-slate-200">{row.feature}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-start gap-2">
                  <Ban className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-rose-300 block text-[10px] uppercase font-mono">
                      WhatsApp / Email
                    </span>
                    <span className="text-slate-300 text-[11px] leading-snug">{row.whatsapp}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-2">
                  <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-cyan-300 block text-[10px] uppercase font-mono">
                      SafePrint Zero-Trust
                    </span>
                    <span className="text-slate-200 text-[11px] leading-snug">{row.safeprint}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-left border-t border-slate-800">
          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>RFC 3986 URL Hash Key Exchange • 100% Zero Storage</span>
          </div>

          <button
            onClick={onClose}
            className="btn-cyber-primary w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold"
          >
            Got it, Let's Print Securely!
          </button>
        </div>
      </div>
    </div>
  );
};
