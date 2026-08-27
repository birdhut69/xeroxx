import React from 'react';
import { X, ShieldCheck, Check, Ban, Lock } from 'lucide-react';

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
    },
    {
      feature: 'Data Resale / Exfiltration Risk',
      whatsapp: 'High (Shopkeeper & malware have permanent file access)',
      safeprint: 'Eliminated (Encrypted stream & Sandboxed DRM Canvas)',
    },
    {
      feature: 'Document Redaction (Masking Aadhaar/PAN)',
      whatsapp: 'None (Full sensitive ID numbers exposed)',
      safeprint: 'Built-in client-side privacy blackout brush before encryption',
    },
    {
      feature: 'Unauthorized Extra Copies',
      whatsapp: 'Unrestricted (Shopkeeper can print unlimited copies)',
      safeprint: 'Restricted by cryptographic session permission limits',
    },
    {
      feature: 'Screenshot / Camera Scraping',
      whatsapp: 'Unprotected',
      safeprint: 'Dynamic Forensic Watermark Grid + Blur heuristics',
    },
    {
      feature: 'Proof of Document Deletion',
      whatsapp: 'None (Trust-based)',
      safeprint: 'Cryptographic SHA-256 Merkle Destruction Certificate',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center animate-in fade-in duration-200">
      <div className="wa-panel max-w-2xl w-full rounded-2xl p-6 sm:p-8 relative border border-[#d1d7db] shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1 pr-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] text-xs font-bold font-mono border border-[#00a884]/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SECURITY ARCHITECTURE</span>
          </div>
          <h2 className="text-xl font-bold text-[#111b21]">
            Why WhatsApp Fails for Print Shops
          </h2>
          <p className="text-xs text-[#667781] leading-relaxed">
            Every year, millions of Aadhaar cards, marksheets, and legal documents are leaked from print shop computers. Here is how SafePrint fixes it.
          </p>
        </div>

        {/* Comparison Table */}
        <div className="space-y-2.5">
          {comparisonRows.map((row, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-[#f0f2f5] border border-[#e9edef] space-y-1.5"
            >
              <div className="text-xs font-bold text-[#111b21]">{row.feature}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-[#fee2e2] border border-[#fca5a5] flex items-start gap-2">
                  <Ban className="w-4 h-4 text-[#dc2626] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#dc2626] block text-[10px] uppercase font-mono">
                      WhatsApp / Email
                    </span>
                    <span className="text-[#7f1d1d] text-[11px] leading-snug">{row.whatsapp}</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#d9fdd3] border border-[#86efac] flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#008069] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#008069] block text-[10px] uppercase font-mono">
                      SafePrint Zero-Trust
                    </span>
                    <span className="text-[#14532d] text-[11px] leading-snug">{row.safeprint}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#e9edef]">
          <div className="text-[11px] text-[#667781] font-mono flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#008069]" />
            <span>RFC 3986 URL Hash Key Exchange • 100% Zero Storage</span>
          </div>

          <button
            onClick={onClose}
            className="btn-wa-primary w-full sm:w-auto px-6 py-2 rounded-xl text-xs font-bold"
          >
            Got it, Let's Print!
          </button>
        </div>
      </div>
    </div>
  );
};
