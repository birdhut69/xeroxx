import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Shield, Eraser, Undo, Check, Sparkles, X, Crop, RotateCw, RefreshCw, Scissors, Move, Square } from 'lucide-react';
import { useToast } from '../shared/ToastContext';
import { sounds } from '../../services/AudioEffects';
import { useLanguage } from '../../context/LanguageContext';

interface RedactionStudioProps {
  imageBuffer: ArrayBuffer;
  onApplyRedaction: (newBuffer: ArrayBuffer) => void;
  onCancel: () => void;
}

type StudioMode = 'CROP' | 'REDACT';

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RedactionStudio: React.FC<RedactionStudioProps> = ({
  imageBuffer,
  onApplyRedaction,
  onCancel,
}) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeMode, setActiveMode] = useState<StudioMode>('CROP');
  const toast = useToast();

  // Canvas / Image state
  const [workingCanvas, setWorkingCanvas] = useState<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0);

  // Redaction state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [redactionBoxes, setRedactionBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Crop state
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [cropDragMode, setCropDragMode] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [originalCropRect, setOriginalCropRect] = useState<CropRect | null>(null);

  // Initialize Working Canvas from image buffer
  useEffect(() => {
    const blob = new Blob([imageBuffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth || 800;
      offscreen.height = img.naturalHeight || 1000;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
      }
      setWorkingCanvas(offscreen);

      // Default crop: 5% inset margin
      const marginX = offscreen.width * 0.05;
      const marginY = offscreen.height * 0.05;
      const initialCrop: CropRect = {
        x: marginX,
        y: marginY,
        w: offscreen.width - marginX * 2,
        h: offscreen.height - marginY * 2,
      };
      setCropRect(initialCrop);
      setOriginalCropRect(initialCrop);

      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [imageBuffer]);

  // Main Render Loop
  const renderDisplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !workingCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = workingCanvas.width;
    canvas.height = workingCanvas.height;

    // 1. Draw working image
    ctx.drawImage(workingCanvas, 0, 0);

    // 2. Draw black redaction boxes
    ctx.fillStyle = '#000000';
    for (const box of redactionBoxes) {
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }

    // 3. Draw in-progress redaction box
    if (activeMode === 'REDACT' && currentBox) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      ctx.strokeStyle = '#00a884';
      ctx.lineWidth = Math.max(2, Math.round(canvas.width / 300));
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
    }

    // 4. Draw Crop Overlay if in Crop mode
    if (activeMode === 'CROP' && cropRect) {
      // Darkened outside area
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      // Top
      ctx.fillRect(0, 0, canvas.width, cropRect.y);
      // Bottom
      ctx.fillRect(0, cropRect.y + cropRect.h, canvas.width, canvas.height - (cropRect.y + cropRect.h));
      // Left
      ctx.fillRect(0, cropRect.y, cropRect.x, cropRect.h);
      // Right
      ctx.fillRect(cropRect.x + cropRect.w, cropRect.y, canvas.width - (cropRect.x + cropRect.w), cropRect.h);

      // Crop Bounding Box Border
      ctx.strokeStyle = '#25D366';
      ctx.lineWidth = Math.max(3, Math.round(canvas.width / 250));
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

      // Rule of thirds grid inside crop
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      const thirdW = cropRect.w / 3;
      const thirdH = cropRect.h / 3;

      ctx.beginPath();
      // Verticals
      ctx.moveTo(cropRect.x + thirdW, cropRect.y);
      ctx.lineTo(cropRect.x + thirdW, cropRect.y + cropRect.h);
      ctx.moveTo(cropRect.x + thirdW * 2, cropRect.y);
      ctx.lineTo(cropRect.x + thirdW * 2, cropRect.y + cropRect.h);
      // Horizontals
      ctx.moveTo(cropRect.x, cropRect.y + thirdH);
      ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + thirdH);
      ctx.moveTo(cropRect.x, cropRect.y + thirdH * 2);
      ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + thirdH * 2);
      ctx.stroke();

      // Corner handles
      const handleSize = Math.max(14, Math.round(canvas.width / 45));
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#00453d';
      ctx.lineWidth = 2;

      const corners = [
        { x: cropRect.x, y: cropRect.y },
        { x: cropRect.x + cropRect.w, y: cropRect.y },
        { x: cropRect.x, y: cropRect.y + cropRect.h },
        { x: cropRect.x + cropRect.w, y: cropRect.y + cropRect.h },
      ];

      for (const c of corners) {
        ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
      }
    }
  }, [workingCanvas, redactionBoxes, currentBox, activeMode, cropRect]);

  useEffect(() => {
    renderDisplay();
  }, [renderDisplay]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // ── MOUSE / TOUCH INTERACTIONS ──
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);

    if (activeMode === 'REDACT') {
      setIsDrawing(true);
      setStartPos(pos);
      setCurrentBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
    } else if (activeMode === 'CROP' && cropRect && workingCanvas) {
      const handleTolerance = Math.max(30, workingCanvas.width * 0.08);

      // Check corners
      const isNW = Math.hypot(pos.x - cropRect.x, pos.y - cropRect.y) < handleTolerance;
      const isNE = Math.hypot(pos.x - (cropRect.x + cropRect.w), pos.y - cropRect.y) < handleTolerance;
      const isSW = Math.hypot(pos.x - cropRect.x, pos.y - (cropRect.y + cropRect.h)) < handleTolerance;
      const isSE = Math.hypot(pos.x - (cropRect.x + cropRect.w), pos.y - (cropRect.y + cropRect.h)) < handleTolerance;

      if (isNW) setCropDragMode('nw');
      else if (isNE) setCropDragMode('ne');
      else if (isSW) setCropDragMode('sw');
      else if (isSE) setCropDragMode('se');
      else if (
        pos.x >= cropRect.x &&
        pos.x <= cropRect.x + cropRect.w &&
        pos.y >= cropRect.y &&
        pos.y <= cropRect.y + cropRect.h
      ) {
        setCropDragMode('move');
      } else {
        // Start a new crop rectangle
        setCropRect({ x: pos.x, y: pos.y, w: 10, h: 10 });
        setCropDragMode('se');
      }

      setDragStart(pos);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const current = getCanvasCoords(e);

    if (activeMode === 'REDACT' && isDrawing && startPos) {
      const x = Math.min(startPos.x, current.x);
      const y = Math.min(startPos.y, current.y);
      const w = Math.abs(current.x - startPos.x);
      const h = Math.abs(current.y - startPos.y);
      setCurrentBox({ x, y, w, h });
    } else if (activeMode === 'CROP' && cropDragMode && dragStart && cropRect && workingCanvas) {
      const dx = current.x - dragStart.x;
      const dy = current.y - dragStart.y;
      const cw = workingCanvas.width;
      const ch = workingCanvas.height;

      let newX = cropRect.x;
      let newY = cropRect.y;
      let newW = cropRect.w;
      let newH = cropRect.h;

      if (cropDragMode === 'move') {
        newX = Math.max(0, Math.min(cw - newW, cropRect.x + dx));
        newY = Math.max(0, Math.min(ch - newH, cropRect.y + dy));
      } else if (cropDragMode === 'nw') {
        newX = Math.max(0, Math.min(cropRect.x + cropRect.w - 30, cropRect.x + dx));
        newY = Math.max(0, Math.min(cropRect.y + cropRect.h - 30, cropRect.y + dy));
        newW = cropRect.w - (newX - cropRect.x);
        newH = cropRect.h - (newY - cropRect.y);
      } else if (cropDragMode === 'ne') {
        newY = Math.max(0, Math.min(cropRect.y + cropRect.h - 30, cropRect.y + dy));
        newW = Math.max(30, Math.min(cw - cropRect.x, cropRect.w + dx));
        newH = cropRect.h - (newY - cropRect.y);
      } else if (cropDragMode === 'sw') {
        newX = Math.max(0, Math.min(cropRect.x + cropRect.w - 30, cropRect.x + dx));
        newW = cropRect.w - (newX - cropRect.x);
        newH = Math.max(30, Math.min(ch - cropRect.y, cropRect.h + dy));
      } else if (cropDragMode === 'se') {
        newW = Math.max(30, Math.min(cw - cropRect.x, cropRect.w + dx));
        newH = Math.max(30, Math.min(ch - cropRect.y, cropRect.h + dy));
      }

      setCropRect({ x: newX, y: newY, w: newW, h: newH });
      setDragStart(current);
    }
  };

  const handlePointerUp = () => {
    if (activeMode === 'REDACT') {
      if (currentBox && currentBox.w > 5 && currentBox.h > 5) {
        setRedactionBoxes((prev) => [...prev, currentBox]);
      }
      setIsDrawing(false);
      setStartPos(null);
      setCurrentBox(null);
    } else if (activeMode === 'CROP') {
      setCropDragMode(null);
      setDragStart(null);
    }
  };

  // ── CROP EXECUTION ──
  const handleApplyCrop = () => {
    if (!workingCanvas || !cropRect) return;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = Math.round(cropRect.w);
    croppedCanvas.height = Math.round(cropRect.h);
    const ctx = croppedCanvas.getContext('2d');
    if (!ctx) return;

    // Draw slice from working canvas
    ctx.drawImage(
      workingCanvas,
      cropRect.x,
      cropRect.y,
      cropRect.w,
      cropRect.h,
      0,
      0,
      cropRect.w,
      cropRect.h
    );

    // Adjust any existing redaction boxes that fall inside the crop
    const adjustedRedactions = redactionBoxes
      .map((b) => ({
        x: b.x - cropRect.x,
        y: b.y - cropRect.y,
        w: b.w,
        h: b.h,
      }))
      .filter((b) => b.x + b.w > 0 && b.y + b.h > 0 && b.x < cropRect.w && b.y < cropRect.h);

    setRedactionBoxes(adjustedRedactions);
    setWorkingCanvas(croppedCanvas);

    // Reset crop rect for the new cropped bounds
    const newCrop: CropRect = {
      x: 0,
      y: 0,
      w: croppedCanvas.width,
      h: croppedCanvas.height,
    };
    setCropRect(newCrop);

    sounds.playSuccess();
    toast.success('Document Cropped', 'Edges trimmed directly in RAM.');
    setActiveMode('REDACT');
  };

  // ── ROTATE 90° ──
  const handleRotate = () => {
    if (!workingCanvas) return;

    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = workingCanvas.height;
    rotatedCanvas.height = workingCanvas.width;
    const ctx = rotatedCanvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    ctx.rotate((90 * Math.PI) / 180);
    ctx.drawImage(workingCanvas, -workingCanvas.width / 2, -workingCanvas.height / 2);

    setWorkingCanvas(rotatedCanvas);
    setRotation((r) => (r + 90) % 360);

    // Adjust crop rect
    if (cropRect) {
      setCropRect({
        x: cropRect.y,
        y: rotatedCanvas.height - (cropRect.x + cropRect.w),
        w: cropRect.h,
        h: cropRect.w,
      });
    }

    // Reset redactions since coordinates flipped
    setRedactionBoxes([]);
    sounds.playConnect();
  };

  const handleUndo = () => {
    setRedactionBoxes((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setRedactionBoxes([]);
  };

  const handleAutoMask = () => {
    if (!workingCanvas) return;
    const w = workingCanvas.width;
    const h = workingCanvas.height;
    // Mask center bottom number zone typical on IDs
    setRedactionBoxes((prev) => [
      ...prev,
      { x: w * 0.15, y: h * 0.65, w: w * 0.7, h: h * 0.1 },
    ]);
  };

  const handleSaveAndApply = () => {
    if (!workingCanvas) return;

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = workingCanvas.width;
    finalCanvas.height = workingCanvas.height;
    const ctx = finalCanvas.getContext('2d');
    if (!ctx) return;

    // Draw base
    ctx.drawImage(workingCanvas, 0, 0);

    // Draw solid black redaction boxes
    ctx.fillStyle = '#000000';
    for (const box of redactionBoxes) {
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }

    finalCanvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buffer) => {
        onApplyRedaction(buffer);
      });
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="wa-panel p-4 sm:p-5 rounded-2xl max-w-xl w-full mx-auto space-y-3.5 shadow-2xl border border-[#d1d7db] text-left animate-in zoom-in-95 duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#bec9c5]/30 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#00a884]/15 text-[#00453d]">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#1d1c17]">{t('studioTitle')}</h3>
            <p className="text-[11px] text-[#6f7976]">{t('studioSubtitle')}</p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-[#f0f2f5] text-[#54656f] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center bg-[#f0f2f5] p-1 rounded-xl border border-[#bec9c5]/40 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode('CROP')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeMode === 'CROP'
                ? 'bg-white text-[#00453d] shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <Crop className="w-3.5 h-3.5" />
            <span>{t('tabCrop')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('REDACT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeMode === 'REDACT'
                ? 'bg-white text-[#00453d] shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>{t('tabMask')} ({redactionBoxes.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleRotate}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#bec9c5]/40 text-xs font-bold text-[#111b21] transition-colors cursor-pointer"
          title="Rotate Document 90°"
        >
          <RotateCw className="w-3.5 h-3.5 text-[#00453d]" />
          <span>{t('rotateBtn')}</span>
        </button>
      </div>

      {/* Mode-Specific Toolbar */}
      {activeMode === 'CROP' ? (
        <div className="flex items-center justify-between gap-2 p-2 bg-[#fef9f0] rounded-xl border border-[#bec9c5]/30 text-xs">
          <span className="text-[11.5px] text-[#6f7976] font-medium flex items-center gap-1">
            <Move className="w-3.5 h-3.5 text-[#00453d]" />
            <span>{t('dragCropTip')}</span>
          </span>

          <button
            type="button"
            onClick={handleApplyCrop}
            className="px-3 py-1.5 rounded-lg bg-[#00453d] hover:bg-[#075e54] text-white font-bold flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-xs"
          >
            <Crop className="w-3.5 h-3.5" />
            <span>{t('cutAndCropBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-[#fef9f0] rounded-xl border border-[#bec9c5]/30 text-xs">
          <button
            type="button"
            onClick={handleAutoMask}
            className="px-2.5 py-1 rounded-lg bg-[#e7f8ff] text-[#0284c7] hover:bg-[#d0f0fd] text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            <span>{t('quickMaskZone')}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleUndo}
              disabled={redactionBoxes.length === 0}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#f0f2f5] disabled:opacity-30 text-[#54656f] text-[11px] font-semibold flex items-center gap-1 border border-[#bec9c5]/30 cursor-pointer"
              title="Undo last box"
            >
              <Undo className="w-3 h-3" />
              <span>{t('undoBtn')}</span>
            </button>
            <button
              onClick={handleClearAll}
              disabled={redactionBoxes.length === 0}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-[#fee2e2] disabled:opacity-30 text-[#dc2626] text-[11px] font-semibold flex items-center gap-1 border border-[#bec9c5]/30 cursor-pointer"
              title="Clear all boxes"
            >
              <Eraser className="w-3 h-3" />
              <span>{t('clearAllBoxes')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative bg-[#2d3748] rounded-2xl overflow-hidden touch-none flex items-center justify-center min-h-[280px] max-h-[440px] shadow-inner p-2 select-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="max-w-full max-h-[420px] object-contain rounded-lg cursor-crosshair"
        />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#bec9c5]/30">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] text-xs font-semibold cursor-pointer"
        >
          {t('cancel')}
        </button>

        <button
          onClick={handleSaveAndApply}
          className="px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>{t('saveChangesToRam')}</span>
        </button>
      </div>
    </div>
  );
};
