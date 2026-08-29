import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Shield, Check, Copy, Download, RefreshCw, X, Flame, ArrowDown, FileText, Printer, CheckCircle } from 'lucide-react';
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

  const handleDownloadProof = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Certificate Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 600);

    // Green Guilloche-Style Border
    ctx.strokeStyle = '#00453d';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 760, 560);
    ctx.strokeStyle = '#3de273';
    ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, 744, 544);

    // Header
    ctx.fillStyle = '#00453d';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CIPHERPRINT • CERTIFICATE OF RAM ZEROIZATION', 400, 70);

    ctx.fillStyle = '#6f7976';
    ctx.font = '13px sans-serif';
    ctx.fillText('Verifiable Zero-Disk Merkle Audit Proof', 400, 100);

    // Details Grid Box
    ctx.fillStyle = '#f8f3eb';
    ctx.fillRect(50, 130, 700, 310);

    ctx.fillStyle = '#1d1c17';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Cert ID: ${certificate.certificateId}`, 80, 175);
    ctx.fillText(`Terminal: ${certificate.shopName}`, 80, 215);
    ctx.fillText(`Standard: DoD 5220.22-M Multi-Pass RAM Wipe`, 80, 255);
    ctx.fillText(`Document: ${certificate.filename}`, 80, 295);
    ctx.fillText(`Pages / Copies: ${certificate.pagesPrinted} Page(s) • ${certificate.copiesPrinted} Copy`, 80, 335);
    ctx.fillText(`Purged At: ${new Date(certificate.destructionTimestamp).toLocaleString()}`, 80, 375);

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#006d2f';
    ctx.fillText(`SHA-256 Hash: ${certificate.rootProofHash}`, 80, 415);

    // Verified Stamp
    ctx.save();
    ctx.translate(620, 480);
    ctx.rotate((-5 * Math.PI) / 180);
    ctx.strokeStyle = '#006d2f';
    ctx.lineWidth = 4;
    ctx.strokeRect(-120, -35, 240, 70);
    ctx.fillStyle = '#006d2f';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRYPTOGRAPHICALLY', 0, -10);
    ctx.fillText('VERIFIED', 0, 10);
    ctx.font = '9px monospace';
    ctx.fillText('ZERO BYTES PERSISTED', 0, 25);
    ctx.restore();

    // Footer
    ctx.fillStyle = '#6f7976';
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100% In-Memory Architecture • Zero Server Disk I/O', 400, 550);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CipherPrint_Certificate_${certificate.certificateId}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Certificate Downloaded', 'Saved digital receipt to your device.');
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center animate-in fade-in duration-200">
      <div className="max-w-[480px] w-full bg-white rounded-2xl p-5 sm:p-6 relative border border-[#bec9c5] shadow-2xl space-y-4 text-left guilloche-border">
        {/* Close Button */}
        <button
          onClick={onNewSession}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#6f7976] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Certificate Emblem Header */}
        <div className="flex flex-col items-center pt-2 pb-1 text-center">
          <div className="relative w-16 h-16 flex items-center justify-center mb-3">
            <Shield className="w-16 h-16 text-[#00453d] fill-current" />
            <CheckCircle className="w-8 h-8 text-white absolute fill-emerald-500" />
          </div>
          <h1 className="text-base font-extrabold text-[#00453d] uppercase tracking-wide">
            Certificate of RAM Zeroization
          </h1>
          <p className="text-xs text-[#3f4946] mt-0.5">Verifiable Zero-Disk Merkle Audit Proof</p>
        </div>

        {/* Details Grid Box */}
        <div className="bg-[#f8f3eb] rounded-xl p-3.5 border border-[#bec9c5]/50 text-xs font-mono">
          <div className="grid grid-cols-[85px_1fr] gap-y-2 gap-x-2 items-center">
            <div className="text-[#6f7976] uppercase text-right text-[11px] font-bold">Cert ID</div>
            <div className="text-[#1d1c17] font-bold tracking-wider">{certificate.certificateId}</div>

            <div className="text-[#6f7976] uppercase text-right text-[11px] font-bold">Terminal</div>
            <div className="text-[#1d1c17] font-bold truncate">{certificate.shopName}</div>

            <div className="text-[#6f7976] uppercase text-right text-[11px] font-bold">Standard</div>
            <div className="text-[#006d2f] font-bold">DoD 5220.22-M Wipe</div>

            <div className="text-[#6f7976] uppercase text-right text-[11px] font-bold self-start pt-0.5">SHA256 Hash</div>
            <div className="flex items-center justify-between gap-1 bg-white p-1.5 rounded border border-[#bec9c5]/60">
              <span className="text-[#00453d] font-bold truncate text-[11px] max-w-[220px]">
                {certificate.rootProofHash}
              </span>
              <button
                onClick={handleCopyHash}
                className="p-0.5 text-[#6f7976] hover:text-[#00453d] cursor-pointer"
                title="Copy hash"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#006d2f]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Cryptographic Chain of Custody */}
        <div className="px-2">
          <h3 className="text-[11px] font-bold text-[#6f7976] uppercase tracking-widest text-center mb-2.5">
            Cryptographic Chain of Custody
          </h3>
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#e7e2da] flex items-center justify-center text-[#3f4946] font-bold text-[10px] shrink-0">
                1
              </div>
              <div>
                <div className="font-bold text-[#1d1c17]">Genesis Block Verified</div>
                <div className="text-[10px] text-[#6f7976]">Parent root: 0x0000000000000000</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#e7e2da] flex items-center justify-center text-[#3f4946] font-bold text-[10px] shrink-0">
                2
              </div>
              <div>
                <div className="font-bold text-[#1d1c17]">RAM Ingest Verified</div>
                <div className="text-[10px] text-[#6f7976]">AES-256-GCM Volatile Memory Only</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#e7e2da] flex items-center justify-center text-[#3f4946] font-bold text-[10px] shrink-0">
                3
              </div>
              <div>
                <div className="font-bold text-[#1d1c17]">Hardware Spool Executed</div>
                <div className="text-[10px] text-[#6f7976]">{certificate.pagesPrinted} page(s) spooled</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-[#3de273] flex items-center justify-center text-[#002109] font-bold text-[10px] shrink-0">
                4
              </div>
              <div>
                <div className="font-bold text-[#006d2f]">Cryptographically Purged</div>
                <div className="text-[10px] text-[#006d2f]">Zero Bytes Persisted</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rotated Verified Stamp */}
        <div className="flex justify-center my-1">
          <div className="cert-stamp border-4 border-[#006d2f] px-4 py-2 inline-block text-center rounded">
            <p className="text-sm font-extrabold text-[#006d2f] uppercase tracking-widest leading-tight">
              Cryptographically<br />Verified
            </p>
            <p className="text-[9px] text-[#006d2f] uppercase tracking-[0.2em] font-bold mt-0.5">
              Zero Bytes Persisted
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={handleDownloadProof}
            className="w-full bg-[#f2ede5] border border-[#bec9c5] text-[#00453d] text-xs font-bold rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 hover:bg-[#e7e2da] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Save Digital Receipt (PNG)</span>
          </button>

          <button
            onClick={onNewSession}
            className="w-full bg-[#00453d] hover:bg-[#075e54] text-white text-xs font-bold rounded-full py-2.5 px-4 flex items-center justify-center gap-1.5 shadow-md transition-transform active:scale-98 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>End Session & Start New</span>
          </button>
        </div>
      </div>
    </div>
  );
};
