import React, { useRef, useState, useEffect } from 'react';
import { Shield, Sparkles, X, Check, Crop, Sliders, Scissors, Image as ImageIcon, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../shared/ToastContext';
import { sounds } from '../../services/AudioEffects';

interface PassportPhotoStudioProps {
  imageBuffer: ArrayBuffer;
  onApplyPassportSheet: (newBuffer: ArrayBuffer, sheetName: string) => void;
  onCancel: () => void;
}

type BgColorOption = 'WHITE' | 'BLUE' | 'GRAY' | 'ORIGINAL';
type SheetLayoutOption = '8_ON_4X6' | '16_ON_A4' | 'SINGLE';

export const PassportPhotoStudio: React.FC<PassportPhotoStudioProps> = ({
  imageBuffer,
  onApplyPassportSheet,
  onCancel,
}) => {
  const { t } = useLanguage();
  const toast = useToast();

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);

  // Studio Adjustments
  const [bgColor, setBgColor] = useState<BgColorOption>('WHITE');
  const [sheetLayout, setSheetLayout] = useState<SheetLayoutOption>('8_ON_4X6');
  const [showCutLines, setShowCutLines] = useState(true);
  const [brightness, setBrightness] = useState(105); // %
  const [contrast, setContrast] = useState(110); // %
  const [zoom, setZoom] = useState(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Load Source Image from buffer
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

  // Render Single Passport Cutout (35mm x 45mm at 300 DPI = 413 x 531 px)
  const renderSinglePassportPhoto = (
    w: number = 413,
    h: number = 531
  ): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx || !sourceImage) return canvas;

    // 1. Background Fill
    if (bgColor === 'WHITE') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    } else if (bgColor === 'BLUE') {
      ctx.fillStyle = '#4B9CD3';
      ctx.fillRect(0, 0, w, h);
    } else if (bgColor === 'GRAY') {
      ctx.fillStyle = '#E5E7EB';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Draw Adjusted Image
    ctx.save();
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    const imgRatio = sourceImage.width / sourceImage.height;
    const targetRatio = w / h;
    let drawW = w * zoom;
    let drawH = h * zoom;

    if (imgRatio > targetRatio) {
      drawW = drawH * imgRatio;
    } else {
      drawH = drawW / imgRatio;
    }

    const drawX = (w - drawW) / 2 + panOffset.x;
    const drawY = (h - drawH) / 2 + panOffset.y;

    ctx.drawImage(sourceImage, drawX, drawY, drawW, drawH);
    ctx.restore();

    // 3. Subtle Border
    ctx.strokeStyle = '#D1D5DB';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    return canvas;
  };

  // Render Live Preview
  useEffect(() => {
    if (!sourceImage || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const singlePhoto = renderSinglePassportPhoto(280, 360);
    canvas.width = 280;
    canvas.height = 360;

    ctx.drawImage(singlePhoto, 0, 0);

    // Draw Biometric Oval Face Guide
    ctx.strokeStyle = 'rgba(37, 211, 102, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    // Head oval
    ctx.ellipse(140, 150, 65, 85, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eye line
    ctx.beginPath();
    ctx.moveTo(85, 140);
    ctx.lineTo(195, 140);
    ctx.stroke();

    // Chin line
    ctx.beginPath();
    ctx.moveTo(110, 235);
    ctx.lineTo(170, 235);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [sourceImage, bgColor, brightness, contrast, zoom, panOffset]);

  // Pan Gestures
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Export High-Res Printable Grid Sheet to RAM
  const handleGeneratePrintableSheet = () => {
    if (!sourceImage) return;

    sounds.playEncrypt();

    const singlePhoto = renderSinglePassportPhoto(413, 531); // 35x45mm at 300 DPI

    let sheetCanvas = document.createElement('canvas');
    let sheetName = 'Passport_Photos_8_on_4x6.png';

    if (sheetLayout === '8_ON_4X6') {
      // 4x6" Sheet (1200 x 1800 px at 300 DPI) - 2 cols x 4 rows
      sheetCanvas.width = 1800; // Landscape 6x4"
      sheetCanvas.height = 1200;
      const ctx = sheetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

      const marginX = 60;
      const marginY = 60;
      const gapX = 20;
      const gapY = 20;

      // 4 columns x 2 rows = 8 photos
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          const posX = marginX + col * (413 + gapX);
          const posY = marginY + row * (531 + gapY);

          ctx.drawImage(singlePhoto, posX, posY, 413, 531);

          if (showCutLines) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 1.5;
            ctx.strokeRect(posX, posY, 413, 531);
          }
        }
      }

      // Sheet Header Metadata
      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 20px sans-serif';
      ctx.setLineDash([]);
      ctx.fillText('CipherPrint Studio • 35x45mm Passport Grid (8 Photos)', 60, 1170);
    } else if (sheetLayout === '16_ON_A4') {
      // A4 Sheet (2480 x 3508 px at 300 DPI) - 4 cols x 4 rows = 16 photos
      sheetCanvas.width = 2480;
      sheetCanvas.height = 3508;
      sheetName = 'Passport_Photos_16_on_A4.png';
      const ctx = sheetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

      const marginX = 140;
      const marginY = 160;
      const gapX = 30;
      const gapY = 30;

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const posX = marginX + col * (413 + gapX);
          const posY = marginY + row * (531 + gapY);

          ctx.drawImage(singlePhoto, posX, posY, 413, 531);

          if (showCutLines) {
            ctx.strokeStyle = '#9CA3AF';
            ctx.setLineDash([8, 8]);
            ctx.lineWidth = 2;
            ctx.strokeRect(posX, posY, 413, 531);
          }
        }
      }

      ctx.fillStyle = '#6B7280';
      ctx.font = 'bold 28px sans-serif';
      ctx.setLineDash([]);
      ctx.fillText('CipherPrint Studio • 35x45mm Passport Photos (16 Copies on A4)', 140, 3450);
    } else {
      // Single Cutout
      sheetCanvas = singlePhoto;
      sheetName = 'Passport_Photo_Single_35x45mm.png';
    }

    sheetCanvas.toBlob((blob) => {
      if (blob) {
        blob.arrayBuffer().then((buf) => {
          onApplyPassportSheet(buf, sheetName);
          toast.success('Passport Grid Ready', `Created ${sheetLayout === '8_ON_4X6' ? '8 Photos on 4x6"' : '16 Photos on A4'} in RAM.`);
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
            <Sparkles className="w-4 h-4 text-[#25D366]" />
          </div>
          <div className="text-left">
            <h3 className="text-sm sm:text-base font-bold text-[#00453d]">
              Passport Photo Studio (35x45 mm)
            </h3>
            <p className="text-[10.5px] sm:text-[11px] text-[#6f7976]">
              Instant 8 or 16 photo grid with background selection & cutting lines
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
        {/* Main Viewport & Face Alignment Guide */}
        <div className="flex flex-col items-center gap-3 bg-[#f8fafc] p-3 rounded-2xl border border-[#bec9c5]/30">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative bg-[#1e293b] rounded-2xl overflow-hidden shadow-inner cursor-move touch-none shrink-0"
            style={{ width: '240px', height: '300px' }}
          >
            <canvas
              ref={previewCanvasRef}
              className="w-full h-full object-contain"
            />
            <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-xs px-2 py-1 rounded-lg text-[10px] text-white text-center pointer-events-none">
              Drag to center face in oval
            </div>
          </div>

          {/* Quick Zoom & Reset Stepper */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-[#54656f] text-[11px]">Zoom:</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}
              className="w-7 h-7 rounded-lg bg-white border border-[#bec9c5] font-bold text-xs flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-2xs"
            >
              -
            </button>
            <span className="font-mono font-bold text-[#00453d] min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(1)))}
              className="w-7 h-7 rounded-lg bg-white border border-[#bec9c5] font-bold text-xs flex items-center justify-center hover:bg-gray-100 cursor-pointer shadow-2xs"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => { setZoom(1.0); setPanOffset({ x: 0, y: 0 }); }}
              className="px-2 py-1 bg-white border border-[#bec9c5] rounded-lg text-[10.5px] font-bold text-[#54656f] hover:bg-gray-50 ml-1 cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Adjustments Panel */}
        <div className="space-y-3 w-full text-xs">
          {/* Background Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#1d1c17] text-[11.5px]">Background Color</label>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setBgColor('WHITE')}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-[11px] cursor-pointer transition-all ${
                  bgColor === 'WHITE'
                    ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-white border border-gray-300 inline-block" />
                <span>White</span>
              </button>

              <button
                type="button"
                onClick={() => setBgColor('BLUE')}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-[11px] cursor-pointer transition-all ${
                  bgColor === 'BLUE'
                    ? 'border-[#00a884] bg-blue-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-[#4B9CD3] inline-block" />
                <span>Blue</span>
              </button>

              <button
                type="button"
                onClick={() => setBgColor('GRAY')}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-[11px] cursor-pointer transition-all ${
                  bgColor === 'GRAY'
                    ? 'border-[#00a884] bg-gray-100 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span className="w-3 h-3 rounded-full bg-[#E5E7EB] border border-gray-300 inline-block" />
                <span>Gray</span>
              </button>

              <button
                type="button"
                onClick={() => setBgColor('ORIGINAL')}
                className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1 font-bold text-[11px] cursor-pointer transition-all ${
                  bgColor === 'ORIGINAL'
                    ? 'border-[#00a884] bg-emerald-50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span>Original</span>
              </button>
            </div>
          </div>

          {/* Sheet Layout Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-[#1d1c17] text-[11.5px]">Grid Output Layout</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSheetLayout('8_ON_4X6')}
                className={`py-2.5 px-3 rounded-xl border flex flex-col text-left cursor-pointer transition-all ${
                  sheetLayout === '8_ON_4X6'
                    ? 'border-[#00a884] bg-[#D9FDD3]/50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span className="font-bold text-[12px]">8 Photos (4x6" Sheet)</span>
                <span className="text-[10px] text-[#6f7976]">Standard Photo Paper</span>
              </button>

              <button
                type="button"
                onClick={() => setSheetLayout('16_ON_A4')}
                className={`py-2.5 px-3 rounded-xl border flex flex-col text-left cursor-pointer transition-all ${
                  sheetLayout === '16_ON_A4'
                    ? 'border-[#00a884] bg-[#D9FDD3]/50 text-[#00453d] ring-2 ring-[#00a884]/30 shadow-xs'
                    : 'border-[#bec9c5] bg-white text-[#54656f]'
                }`}
              >
                <span className="font-bold text-[12px]">16 Photos (A4 Sheet)</span>
                <span className="text-[10px] text-[#6f7976]">Full Page Layout</span>
              </button>
            </div>
          </div>

          {/* Sliders: Brightness & Contrast */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-[#1d1c17]">
                <span>Brightness</span>
                <span className="font-mono text-[#008069]">{brightness}%</span>
              </div>
              <input
                type="range"
                min="80"
                max="140"
                value={brightness}
                onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                className="w-full accent-[#00a884] cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-[#1d1c17]">
                <span>Contrast</span>
                <span className="font-mono text-[#008069]">{contrast}%</span>
              </div>
              <input
                type="range"
                min="80"
                max="140"
                value={contrast}
                onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                className="w-full accent-[#00a884] cursor-pointer h-2 bg-gray-200 rounded-lg"
              />
            </div>
          </div>

          {/* Micro Cutting Guides Toggle */}
          <label className="flex items-center justify-between bg-[#f8fafc] p-2.5 rounded-xl border border-[#bec9c5]/30 cursor-pointer">
            <span className="text-[11.5px] font-bold text-[#1d1c17] flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-[#00453d]" />
              <span>Include Cutting Guides (Dashed Lines)</span>
            </span>
            <input
              type="checkbox"
              checked={showCutLines}
              onChange={(e) => setShowCutLines(e.target.checked)}
              className="accent-[#00a884] w-4 h-4 rounded cursor-pointer"
            />
          </label>
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
          onClick={handleGeneratePrintableSheet}
          className="px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95 animate-pulse-glow"
        >
          <Check className="w-4 h-4" />
          <span>Add Passport Grid to RAM</span>
        </button>
      </div>
    </div>
  );
};
