import React, { useRef, useState, useEffect } from 'react';
import { Shield, PenTool, Eraser, Check, X, Calendar, Stamp, FileText } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../shared/ToastContext';
import { sounds } from '../../services/AudioEffects';

interface SelfAttestStampModalProps {
  imageBuffer: ArrayBuffer;
  onApplyAttestedImage: (newBuffer: ArrayBuffer) => void;
  onCancel: () => void;
}

type StampPreset = 'SELF_ATTEST' | 'KYC_ONLY' | 'OFFICIAL_ONLY' | 'CUSTOM';
type InkColor = '#1E3A8A' | '#000000' | '#6B21A8';

export const SelfAttestStampModal: React.FC<SelfAttestStampModalProps> = ({
  imageBuffer,
  onApplyAttestedImage,
  onCancel,
}) => {
  const { t } = useLanguage();
  const toast = useToast();

  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [stampPreset, setStampPreset] = useState<StampPreset>('SELF_ATTEST');
  const [customText, setCustomText] = useState('Self-Attested');
  const [inkColor, setInkColor] = useState<InkColor>('#1E3A8A');
  const [includeDate, setIncludeDate] = useState(true);
  const [stampPosition, setStampPosition] = useState<{ x: number; y: number }>({ x: 50, y: 75 }); // % coordinates

  // Drawing state for signature pad
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Load Base Image
  useEffect(() => {
    const blob = new Blob([imageBuffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [imageBuffer]);

  // Render Document with live Stamp Overlay
  useEffect(() => {
    if (!sourceImage || !baseCanvasRef.current) return;
    const canvas = baseCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = sourceImage.naturalWidth || 800;
    canvas.height = sourceImage.naturalHeight || 1000;

    // 1. Draw base document
    ctx.drawImage(sourceImage, 0, 0);

    // 2. Draw Stamp Box at stampPosition
    const posX = (canvas.width * stampPosition.x) / 100;
    const posY = (canvas.height * stampPosition.y) / 100;
    const stampW = canvas.width * 0.42;
    const stampH = canvas.height * 0.16;

    ctx.save();
    ctx.translate(posX, posY);

    // Stamp Border (Authentic Rubber Stamp Look)
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(-stampW / 2, -stampH / 2, stampW, stampH);

    ctx.lineWidth = 1;
    ctx.strokeRect(-stampW / 2 + 4, -stampH / 2 + 4, stampW - 8, stampH - 8);

    // Stamp Text
    ctx.fillStyle = inkColor;
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';

    let label = 'SELF-ATTESTED';
    if (stampPreset === 'KYC_ONLY') label = 'FOR KYC VERIFICATION ONLY';
    if (stampPreset === 'OFFICIAL_ONLY') label = 'FOR OFFICIAL USE ONLY';
    if (stampPreset === 'CUSTOM') label = customText.toUpperCase();

    ctx.fillText(label, 0, -stampH / 2 + 24);

    if (includeDate) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`DATE: ${currentDateStr}`, 0, -stampH / 2 + 44);
    }

    // Signature Area
    if (signatureCanvasRef.current && hasSignature) {
      ctx.drawImage(signatureCanvasRef.current, -stampW / 2 + 10, -stampH / 2 + 48, stampW - 20, stampH - 56);
    } else {
      ctx.font = 'italic 12px sans-serif';
      ctx.fillStyle = inkColor + '88';
      ctx.fillText('[ Signed in RAM ]', 0, stampH / 2 - 12);
    }

    ctx.restore();
  }, [sourceImage, stampPreset, customText, inkColor, includeDate, stampPosition, hasSignature]);

  // Touch / Pointer Signature Pad Handlers
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    lastPointRef.current = { x, y };
  };

  const drawSignature = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastPointRef.current = { x, y };
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSaveAndApply = () => {
    if (!baseCanvasRef.current) return;

    sounds.playEncrypt();
    baseCanvasRef.current.toBlob((blob) => {
      if (blob) {
        blob.arrayBuffer().then((buf) => {
          onApplyAttestedImage(buf);
          toast.shield('Attestation Stamp Applied', 'Signed & stamped copy generated in RAM.');
        });
      }
    }, 'image/png');
  };

  return (
    <div className="bg-white rounded-3xl max-w-xl w-full max-h-[94dvh] flex flex-col shadow-2xl border border-[#bec9c5] animate-in zoom-in-95 duration-150 overflow-hidden">
      {/* ── Fixed Header ── */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 pb-3 border-b border-[#bec9c5]/40 shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00453d] text-white flex items-center justify-center font-bold shadow-xs">
            <Stamp className="w-4 h-4 text-[#25D366]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm sm:text-base font-bold text-[#00453d]">
              KYC Self-Attestation & Signature Stamp
            </h3>
            <p className="text-[10.5px] sm:text-[11px] text-[#6f7976]">
              Sign and stamp documents before sending to print
            </p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="p-1 rounded-full text-[#6f7976] hover:bg-[#f0f2f5] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* ── Scrollable Body ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 overscroll-contain text-left">
        {/* Main Preview & Position Controls */}
        <div className="flex flex-col sm:flex-row gap-4 bg-[#f8fafc] p-3 rounded-2xl border border-[#bec9c5]/30">
          {/* Document Viewport with Stamp */}
          <div className="relative bg-[#1e293b] rounded-2xl overflow-hidden shadow-inner flex items-center justify-center min-h-[220px] max-h-[300px] w-full sm:w-1/2">
            <canvas
              ref={baseCanvasRef}
              className="max-w-full max-h-[280px] object-contain rounded-lg shadow-md"
            />
          </div>

          {/* Stamp Settings & Signature Pad */}
          <div className="flex-1 space-y-3 w-full text-xs text-left">
            {/* Stamp Preset Selector */}
            <div className="space-y-1.5">
              <label className="font-bold text-[#1d1c17] text-[11.5px]">Attestation Preset</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStampPreset('SELF_ATTEST')}
                  className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer transition-all ${
                    stampPreset === 'SELF_ATTEST'
                      ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                      : 'border-[#bec9c5] bg-white text-[#54656f]'
                  }`}
                >
                  Self-Attested
                </button>

                <button
                  type="button"
                  onClick={() => setStampPreset('KYC_ONLY')}
                  className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer transition-all ${
                    stampPreset === 'KYC_ONLY'
                      ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                      : 'border-[#bec9c5] bg-white text-[#54656f]'
                  }`}
                >
                  KYC Only
                </button>

                <button
                  type="button"
                  onClick={() => setStampPreset('OFFICIAL_ONLY')}
                  className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer transition-all ${
                    stampPreset === 'OFFICIAL_ONLY'
                      ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                      : 'border-[#bec9c5] bg-white text-[#54656f]'
                  }`}
                >
                  Official Use
                </button>

                <button
                  type="button"
                  onClick={() => setStampPreset('CUSTOM')}
                  className={`py-2 px-2 rounded-xl border font-bold text-[11px] cursor-pointer transition-all ${
                    stampPreset === 'CUSTOM'
                      ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                      : 'border-[#bec9c5] bg-white text-[#54656f]'
                  }`}
                >
                  Custom Text
                </button>
              </div>

              {stampPreset === 'CUSTOM' && (
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Enter custom stamp label..."
                  className="w-full mt-1.5 px-3 py-2 rounded-xl border border-[#bec9c5] text-xs font-semibold focus:ring-1 focus:ring-[#00a884]"
                />
              )}
            </div>

            {/* Interactive Touch Signature Pad */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-bold text-[#1d1c17] text-[11.5px] flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-[#00453d]" />
                  <span>Draw Signature (Touch/Mouse)</span>
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[10.5px] text-red-600 hover:text-red-700 font-bold flex items-center gap-0.5 cursor-pointer py-0.5 px-1.5 rounded hover:bg-red-50"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              <div className="bg-white rounded-xl border-2 border-dashed border-[#00a884]/50 overflow-hidden shadow-inner touch-none relative">
                <canvas
                  ref={signatureCanvasRef}
                  width={280}
                  height={80}
                  onPointerDown={startDrawing}
                  onPointerMove={drawSignature}
                  onPointerUp={stopDrawing}
                  className="w-full h-[80px] cursor-crosshair"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-[#9ca3af] pointer-events-none">
                    Sign with finger here...
                  </div>
                )}
              </div>
            </div>

            {/* Position & Ink Color Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="font-bold text-[#1d1c17] text-[11px]">Stamp Position</label>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setStampPosition({ x: 30, y: 80 })}
                    className={`py-1.5 rounded-lg border font-semibold transition-all ${
                      stampPosition.x === 30 ? 'bg-[#008069] text-white border-[#008069]' : 'bg-white text-[#54656f] border-[#bec9c5]'
                    }`}
                  >
                    Left
                  </button>
                  <button
                    type="button"
                    onClick={() => setStampPosition({ x: 50, y: 80 })}
                    className={`py-1.5 rounded-lg border font-semibold transition-all ${
                      stampPosition.x === 50 ? 'bg-[#008069] text-white border-[#008069]' : 'bg-white text-[#54656f] border-[#bec9c5]'
                    }`}
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setStampPosition({ x: 70, y: 80 })}
                    className={`py-1.5 rounded-lg border font-semibold transition-all ${
                      stampPosition.x === 70 ? 'bg-[#008069] text-white border-[#008069]' : 'bg-white text-[#54656f] border-[#bec9c5]'
                    }`}
                  >
                    Right
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-[#1d1c17] text-[11px]">Ink Color</label>
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setInkColor('#1E3A8A')}
                    className={`w-7 h-7 rounded-full bg-[#1E3A8A] cursor-pointer shadow-xs ${
                      inkColor === '#1E3A8A' ? 'ring-2 ring-offset-2 ring-[#1E3A8A]' : ''
                    }`}
                    title="Classic Blue"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#000000')}
                    className={`w-7 h-7 rounded-full bg-[#000000] cursor-pointer shadow-xs ${
                      inkColor === '#000000' ? 'ring-2 ring-offset-2 ring-black' : ''
                    }`}
                    title="Formal Black"
                  />
                  <button
                    type="button"
                    onClick={() => setInkColor('#6B21A8')}
                    className={`w-7 h-7 rounded-full bg-[#6B21A8] cursor-pointer shadow-xs ${
                      inkColor === '#6B21A8' ? 'ring-2 ring-offset-2 ring-purple-600' : ''
                    }`}
                    title="Stamp Purple"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Fixed Footer Action Bar ── */}
      <div className="p-3.5 sm:p-4 border-t border-[#bec9c5]/40 shrink-0 bg-white flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSaveAndApply}
          className="px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95 animate-pulse-glow"
        >
          <Check className="w-4 h-4" />
          <span>Apply Attestation Stamp</span>
        </button>
      </div>
    </div>
  );
};
