import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ShieldCheck, Award, CheckCircle2, Copy, Check, Share2, Layers, RefreshCw, Download, FileCheck } from 'lucide-react';
import { DestructionCertificate } from '../../crypto/ledger';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

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
  const certificateCardRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    sounds.playSuccess();
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 }
      });
    } catch {}
  }, []);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(certificate.rootProofHash);
    setCopied(true);
    toast.success('SHA-256 Hash Copied', certificate.rootProofHash.substring(0, 20) + '...');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SafePrint Certificate - ${certificate.certificateId}`,
          text: `Document ${certificate.filename} was safely printed and cryptographically shredded at ${certificate.shopName}. Root Hash: ${certificate.rootProofHash}`,
          url: window.location.href
        });
      } catch {}
    } else {
      handleCopyHash();
    }
  };

  const handleDownloadProof = () => {
    // Generate styled Proof Certificate image on Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 650;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 900, 650);
    bgGrad.addColorStop(0, '#080c14');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 900, 650);

    // Glowing border
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 860, 610);

    // Header Emblem
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('🛡️ SAFEPRINT ZERO-TRUST CERTIFICATE', 60, 80);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('IMMUTABLE PROOF OF DOCUMENT DESTRUCTION', 60, 115);

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 140);
    ctx.lineTo(840, 140);
    ctx.stroke();

    // Body details
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';

    ctx.fillText(`Certificate ID: ${certificate.certificateId}`, 60, 185);
    ctx.fillText(`Document Name:  ${certificate.filename}`, 60, 225);
    ctx.fillText(`Xerox Station:  ${certificate.shopName} (${certificate.shopId})`, 60, 265);
    ctx.fillText(`Prints Printed: ${certificate.pagesPrinted} pages (${certificate.copiesPrinted} copies)`, 60, 305);
    ctx.fillText(`Destruction At: ${new Date(certificate.destructionTimestamp).toLocaleString()}`, 60, 345);

    // Root Hash Card
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(60, 385, 780, 100);
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(60, 385, 780, 100);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ROOT PROOF SHA-256 HASH:', 80, 420);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(certificate.rootProofHash, 80, 455);

    // Verification Seal
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'italic 14px sans-serif';
    ctx.fillText('Verified: Zero Server Storage • RAM Scrambled & Zeroized • Merkle Ledger Audited', 60, 540);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText(`Session UUID: ${certificate.sessionId}`, 60, 585);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SafePrint-Proof-${certificate.certificateId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate Downloaded!', 'Saved high-resolution proof image to your device.');
    }, 'image/png');
  };

  const formattedDate = new Date(certificate.destructionTimestamp).toLocaleString();

  return (
    <div
      ref={certificateCardRef}
      className="glass-panel-glow p-6 sm:p-8 rounded-3xl max-w-lg mx-auto text-center relative overflow-hidden border-2 border-emerald-500/40 space-y-5 shadow-2xl animate-in zoom-in-95 duration-300"
    >
      <div className="scanline-effect" />

      {/* Certificate Emblem */}
      <div className="relative inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/30 text-emerald-400 border-2 border-emerald-400/60 shadow-2xl shadow-emerald-500/30 mb-1">
        <Award className="w-10 h-10" />
        <div className="absolute -bottom-1.5 -right-1.5 p-1.5 rounded-full bg-slate-950 border border-emerald-400 text-emerald-400 shadow-md">
          <CheckCircle2 className="w-4 h-4" />
        </div>
      </div>

      <div className="text-left sm:text-center space-y-1">
        <span className="inline-block text-[10px] font-mono uppercase font-black tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          IMMUTABLE PROOF OF DESTRUCTION
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
          Document Shredded & Zeroized
        </h2>
        <p className="text-xs text-slate-300">
          Your document was physically printed and completely purged from the Xerox terminal's RAM buffers.
        </p>
      </div>

      {/* Certificate Card Content */}
      <div className="bg-slate-950/95 p-4 sm:p-5 rounded-2xl border border-slate-800 text-left font-mono text-xs space-y-3 shadow-inner">
        <div className="flex justify-between items-center pb-2.5 border-b border-slate-800">
          <span className="text-slate-400">Certificate ID:</span>
          <span className="text-cyan-400 font-bold">{certificate.certificateId}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Station Name:</span>
          <span className="text-slate-100 font-bold truncate max-w-[200px]">{certificate.shopName}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Pages / Copies:</span>
          <span className="text-slate-200">{certificate.pagesPrinted} Pages ({certificate.copiesPrinted} copies)</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-400">Purged At:</span>
          <span className="text-slate-300">{formattedDate}</span>
        </div>

        <div className="pt-2.5 border-t border-slate-800">
          <div className="text-slate-400 text-[11px] mb-1.5 flex items-center justify-between">
            <span>Root Proof Hash (SHA-256):</span>
            <span className="text-[10px] text-emerald-400 font-bold">MERKLE VERIFIED ✓</span>
          </div>
          <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-800">
            <span className="text-emerald-400 font-bold truncate max-w-[260px] text-[11px]">
              {certificate.rootProofHash}
            </span>
            <button
              onClick={handleCopyHash}
              className="p-1 hover:text-white text-slate-400 transition-colors active:scale-95"
              title="Copy hash"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons: Save Proof / Share */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleDownloadProof}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95 shadow-md"
        >
          <Download className="w-4 h-4 text-cyan-400" />
          <span>Save Proof Image</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95 shadow-md"
        >
          <Share2 className="w-4 h-4 text-emerald-400" />
          <span>Share Receipt</span>
        </button>
      </div>

      {/* Inspect Blockchain Ledger Blocks */}
      <div>
        <button
          onClick={() => setShowLedger(!showLedger)}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1.5 mx-auto font-mono py-1"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{showLedger ? 'Hide Blockchain Ledger Chain' : 'Inspect Merkle Proof Ledger Chain (4 Blocks)'}</span>
        </button>

        {showLedger && (
          <div className="mt-3 p-3.5 bg-slate-950/95 rounded-2xl border border-indigo-500/30 text-left font-mono text-[11px] space-y-2.5 max-h-52 overflow-y-auto shadow-inner animate-in fade-in duration-200">
            {certificate.ledgerProofChain.map((block) => (
              <div key={block.index} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="flex justify-between text-indigo-300 font-bold">
                  <span>Block #{block.index}: {block.eventType}</span>
                  <span className="text-slate-500 text-[10px]">{new Date(block.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="text-slate-400 truncate text-[10px]">Hash: {block.blockHash}</div>
                <div className="text-slate-500 truncate text-[10px]">Prev: {block.prevHash}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Start New Print Button */}
      <div className="pt-1">
        <button
          onClick={onNewSession}
          className="btn-cyber-primary w-full py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Send Another Document</span>
        </button>
      </div>
    </div>
  );
};
