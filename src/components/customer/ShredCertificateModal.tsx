import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { ShieldCheck, Award, CheckCircle2, Copy, Check, Share2, Layers, RefreshCw, FileCheck } from 'lucide-react';
import { DestructionCertificate } from '../../crypto/ledger';
import { sounds } from '../../services/AudioEffects';

interface ShredCertificateModalProps {
  certificate: DestructionCertificate;
  onNewSession: () => void;
}

export const ShredCertificateModal: React.FC<ShredCertificateModalProps> = ({
  certificate,
  onNewSession
}) => {
  const [copied, setCopied] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    sounds.playSuccess();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {}
  }, []);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(certificate.rootProofHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = new Date(certificate.destructionTimestamp).toLocaleString();

  return (
    <div className="glass-panel-glow p-6 sm:p-8 rounded-2xl max-w-lg mx-auto text-center relative overflow-hidden border-2 border-emerald-500/40 space-y-5">
      <div className="scanline-effect" />

      {/* Certificate Emblem */}
      <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/60 shadow-xl shadow-emerald-500/30 mb-1">
        <Award className="w-9 h-9" />
        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-950 border border-emerald-400 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>

      <div>
        <span className="text-[10px] font-mono uppercase font-bold tracking-widest px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          IMMUTABLE PROOF OF DESTRUCTION
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
          Document Shredded & Zeroized
        </h2>
        <p className="text-xs text-slate-300 mt-1">
          Your document was physically printed and completely purged from the Xerox terminal's RAM.
        </p>
      </div>

      {/* Certificate Card Content */}
      <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 text-left font-mono text-xs space-y-2.5">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <span className="text-slate-400">Certificate ID:</span>
          <span className="text-cyan-400 font-bold">{certificate.certificateId}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Station Name:</span>
          <span className="text-slate-200">{certificate.shopName}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Pages / Copies:</span>
          <span className="text-slate-200">{certificate.pagesPrinted} Pages ({certificate.copiesPrinted} copies)</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Wiped At:</span>
          <span className="text-slate-300">{formattedDate}</span>
        </div>

        <div className="pt-2 border-t border-slate-800">
          <div className="text-slate-400 text-[11px] mb-1">Root Proof Hash (SHA-256):</div>
          <div className="flex items-center justify-between bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <span className="text-emerald-400 font-bold truncate max-w-[280px]">
              {certificate.rootProofHash}
            </span>
            <button onClick={handleCopyHash} className="p-1 hover:text-white text-slate-400 transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Blockchain Ledger Blocks */}
      <div>
        <button
          onClick={() => setShowLedger(!showLedger)}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 mx-auto font-mono"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showLedger ? 'Hide Blockchain Ledger Chain' : 'Inspect Merkle Proof Ledger Chain (4 Blocks)'}</span>
        </button>

        {showLedger && (
          <div className="mt-3 p-3 bg-slate-950/90 rounded-xl border border-indigo-500/30 text-left font-mono text-[11px] space-y-2 max-h-48 overflow-y-auto">
            {certificate.ledgerProofChain.map((block) => (
              <div key={block.index} className="p-2 rounded bg-slate-900 border border-slate-800">
                <div className="flex justify-between text-indigo-300 font-bold">
                  <span>Block #{block.index}: {block.eventType}</span>
                  <span className="text-slate-500 text-[10px]">{new Date(block.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-400 truncate text-[10px] mt-0.5">Hash: {block.blockHash}</div>
                <div className="text-slate-500 truncate text-[10px]">Prev: {block.prevHash}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-2">
        <button
          onClick={onNewSession}
          className="btn-cyber-primary w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Send Another Document</span>
        </button>
      </div>
    </div>
  );
};
