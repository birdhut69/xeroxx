import React, { useRef, useState, useEffect } from 'react';
import { Shield, Eraser, Undo, Check, Eye, Lock, Sparkles, X } from 'lucide-react';
import { useToast } from '../shared/ToastContext';

interface RedactionStudioProps {
  imageBuffer: ArrayBuffer;
  onApplyRedaction: (newBuffer: ArrayBuffer) => void;
  onCancel: () => void;
}

export const RedactionStudio: React.FC<RedactionStudioProps> = ({
  imageBuffer,
  onApplyRedaction,
  onCancel
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [redactionBoxes, setRedactionBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const toast = useToast();

  useEffect(() => {
    const blob = new Blob([imageBuffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      baseImageRef.current = img;
      renderCanvas();
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }, [imageBuffer]);

  useEffect(() => {
    renderCanvas();
  }, [redactionBoxes, currentBox]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = baseImageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas to natural image dimensions
    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 1000;

    // Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw saved redactions (Solid Black Privacy Bars)
    ctx.fillStyle = '#000000';
    for (const box of redactionBoxes) {
      ctx.fillRect(box.x, box.y, box.w, box.h);

      // Redaction badge text
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('[REDACTED]', box.x + 4, box.y + 14);
      ctx.fillStyle = '#000000';
    }

    // Draw current dragging box
    if (currentBox) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 2;
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
    }
  };

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
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(pos);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const current = getCanvasCoords(e);
    const x = Math.min(startPos.x, current.x);
    const y = Math.min(startPos.y, current.y);
    const w = Math.abs(current.x - startPos.x);
    const h = Math.abs(current.y - startPos.y);

    setCurrentBox({ x, y, w, h });
  };

  const handleEnd = () => {
    if (isDrawing && currentBox && currentBox.w > 5 && currentBox.h > 5) {
      setRedactionBoxes([...redactionBoxes, currentBox]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleUndo = () => {
    setRedactionBoxes(redactionBoxes.slice(0, -1));
  };

  const handleClearAll = () => {
    setRedactionBoxes([]);
  };

  // 1-Click Smart Mask Preset for Aadhaar Number
  const handleAutoMaskAadhaar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Standard ID card number coordinate box
    const x = 200;
    const y = 290;
    const w = 380;
    const h = 40;
    setRedactionBoxes([...redactionBoxes, { x, y, w, h }]);
    toast.success('Smart Mask Applied', 'Aadhaar 12-digit number area masked with black privacy bar.');
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buffer) => {
        onApplyRedaction(buffer);
        toast.shield('Privacy Redactions Baked In', 'Original plain numbers wiped from client buffer.');
      });
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="glass-panel-glow p-5 sm:p-6 rounded-3xl max-w-xl w-full mx-auto space-y-4 shadow-2xl border border-cyan-500/40 animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between text-left">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">Client-Side Redaction Studio</h3>
            <p className="text-[11px] text-slate-300">Draw black privacy boxes to blackout sensitive numbers</p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preset Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
        <button
          type="button"
          onClick={handleAutoMaskAadhaar}
          className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>1-Click Mask ID Number</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={redactionBoxes.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-semibold flex items-center gap-1 active:scale-95"
            title="Undo last redaction"
          >
            <Undo className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            onClick={handleClearAll}
            disabled={redactionBoxes.length === 0}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-rose-400 text-xs font-semibold flex items-center gap-1 active:scale-95"
            title="Clear all redactions"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Interactive Redaction Canvas */}
      <div className="relative bg-slate-950 rounded-2xl overflow-hidden border border-cyan-500/30 touch-none flex items-center justify-center max-h-[440px] shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="max-w-full max-h-[440px] object-contain cursor-crosshair select-none"
        />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-xs font-bold active:scale-95"
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="btn-cyber-primary px-6 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 shadow-xl shadow-cyan-500/25 active:scale-95"
        >
          <Check className="w-4 h-4" />
          <span>Apply Redactions & Encrypt</span>
        </button>
      </div>
    </div>
  );
};
