import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, Copy, Check, Share2, Layers, RefreshCw, Download, X } from 'lucide-react';
import type { DestructionCertificate } from '../../crypto/ledger';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

interface ShredCertificateModalProps {
  certificate: DestructionCertificate;
  onNewSession: () => void;
}

export const ShredCertificateModal: React.FC<ShredCertificateModalProps> = ({
  certificate,
  onNewSession,
}) => {
  const [copied, setCopied] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const toast = useToast();

  useEffect(() => {
    sounds.playSuccess();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}
  }, []);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(certificate.rootProofHash);
    setCopied(true);
    toast.success('SHA-256 Hash Copied', certificate.rootProofHash.substring(0, 20) + '...');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `SafePrint Certificate - ${certificate.certificateId}`,
          text: `Document "${certificate.filename}" was safely printed and shredded at ${certificate.shopName}. Root Hash: ${certificate.rootProofHash}`,
          url: window.location.href,
        });
      } catch {}
    } else {
      handleCopyHash();
    }
  };

  const handleDownloadProof = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Certificate Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 500);

    // Green Border
    ctx.strokeStyle = '#008069';
    ctx.lineWidth = 6;
    ctx.strokeRect(15, 15, 770, 470);

    // Header
    ctx.fillStyle = '#008069';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAFEPRINT • CRYPTOGRAPHIC PROOF OF DESTRUCTION', 400, 65);

    ctx.fillStyle = '#667781';
    ctx.font = '13px sans-serif';
    ctx.fillText('Zero-Retention Physical Memory Purge Certificate', 400, 95);

    // Details Box
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(40, 120, 720, 260);

    ctx.fillStyle = '#111b21';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Certificate ID: ${certificate.certificateId}`, 60, 160);
    ctx.fillText(`Station: ${certificate.shopName}`, 60, 195);
    ctx.fillText(`Document: ${certificate.filename}`, 60, 230);
    ctx.fillText(`Pages Printed: ${certificate.pagesPrinted} (Copies: ${certificate.copiesPrinted})`, 60, 265);
    ctx.fillText(`Purged At: ${new Date(certificate.destructionTimestamp).toLocaleString()}`, 60, 300);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#008069';
    ctx.fillText(`SHA-256 Root Hash: ${certificate.rootProofHash}`, 60, 345);

    // Footer
    ctx.fillStyle = '#667781';
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Verified with SHA-256 Merkle Chain • Zero Disk Storage Confirmed', 400, 430);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SafePrint_Proof_${certificate.certificateId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate Downloaded', 'Saved proof image to your device.');
    });
  };

  const formattedDate = new Date(certificate.destructionTimestamp).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center animate-in fade-in duration-200">
      <div className="wa-panel max-w-lg w-full rounded-2xl p-6 sm:p-7 relative border border-[#d1d7db] shadow-2xl space-y-4 text-left">
        <button
          onClick={onNewSession}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f]"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Badge */}
        <div className="w-14 h-14 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
          <Award className="w-7 h-7" />
        </div>

        <div className="text-center space-y-1">
          <span className="inline-block text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] border border-[#00a884]/30">
            PROOF OF DESTRUCTION
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-[#111b21]">
            Document Shredded & Zeroized
          </h2>
          <p className="text-xs text-[#667781]">
            Your document was printed and completely purged from the Xerox terminal's RAM buffers.
          </p>
        </div>

        {/* Certificate Card Content */}
        <div className="bg-[#f0f2f5] p-4 rounded-xl border border-[#e9edef] text-left font-mono text-xs space-y-2.5">
          <div className="flex justify-between items-center pb-2 border-b border-[#e9edef]">
            <span className="text-[#667781]">Certificate ID:</span>
            <span className="text-[#008069] font-bold">{certificate.certificateId}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#667781]">Station Name:</span>
            <span className="text-[#111b21] font-bold truncate max-w-[200px]">{certificate.shopName}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#667781]">Pages / Copies:</span>
            <span className="text-[#111b21]">{certificate.pagesPrinted} Page(s) • {certificate.copiesPrinted} Copy</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[#667781]">Purged At:</span>
            <span className="text-[#54656f]">{formattedDate}</span>
          </div>

          <div className="pt-2 border-t border-[#e9edef]">
            <div className="text-[#667781] text-[10px] mb-1 flex items-center justify-between">
              <span>SHA-256 Proof Hash:</span>
              <span className="text-[10px] text-[#008069] font-bold">MERKLE VERIFIED ✓</span>
            </div>
            <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-[#d1d7db]">
              <span className="text-[#008069] font-bold truncate max-w-[260px] text-[11px]">
                {certificate.rootProofHash}
              </span>
              <button
                onClick={handleCopyHash}
                className="p-1 text-[#54656f] hover:text-[#111b21]"
                title="Copy hash"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#008069]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadProof}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold transition-colors border border-[#d1d7db]"
          >
            <Download className="w-4 h-4 text-[#008069]" />
            <span>Download Image</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold transition-colors border border-[#d1d7db]"
          >
            <Share2 className="w-4 h-4 text-[#008069]" />
            <span>Share Receipt</span>
          </button>
        </div>

        {/* Start New Print Button */}
        <button
          onClick={onNewSession}
          className="btn-wa-primary w-full py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Send Another Document</span>
        </button>
      </div>
    </div>
  );
};
