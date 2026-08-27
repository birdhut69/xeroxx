import React, { useRef, useState, useEffect } from 'react';
import { Shield, Eraser, Undo, Check, Eye, Lock } from 'lucide-react';

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

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buffer) => {
        onApplyRedaction(buffer);
      });
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="glass-panel-glow p-5 rounded-2xl max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Client-Side Redaction Studio</h3>
            <p className="text-[11px] text-slate-300">Drag black privacy boxes over Aadhaar/PAN/Card numbers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={redactionBoxes.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-xs font-semibold flex items-center gap-1"
            title="Undo last redaction"
          >
            <Undo className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClearAll}
            disabled={redactionBoxes.length === 0}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-rose-400 text-xs font-semibold flex items-center gap-1"
            title="Clear all redactions"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Redaction Canvas */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-cyan-500/30 touch-none flex items-center justify-center max-h-[420px]">
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="max-w-full max-h-[420px] object-contain cursor-crosshair"
        />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="btn-cyber-primary px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>Apply Redactions & Encrypt</span>
        </button>
      </div>
    </div>
  );
};
