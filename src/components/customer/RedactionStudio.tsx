import React, { useRef, useState, useEffect } from 'react';
import { Shield, Eraser, Undo, Check, Sparkles, X } from 'lucide-react';
import { useToast } from '../shared/ToastContext';

interface RedactionStudioProps {
  imageBuffer: ArrayBuffer;
  onApplyRedaction: (newBuffer: ArrayBuffer) => void;
  onCancel: () => void;
}

export const RedactionStudio: React.FC<RedactionStudioProps> = ({
  imageBuffer,
  onApplyRedaction,
  onCancel,
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

    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 1000;

    // Draw base image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw solid black redaction bars
    ctx.fillStyle = '#000000';
    for (const box of redactionBoxes) {
      ctx.fillRect(box.x, box.y, box.w, box.h);
    }

    // Draw in-progress preview box
    if (currentBox) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      ctx.strokeStyle = '#00a884';
      ctx.lineWidth = 3;
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
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(pos);
    setCurrentBox({ x: pos.x, y: pos.y, w: 0, h: 0 });
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
    if (currentBox && currentBox.w > 5 && currentBox.h > 5) {
      setRedactionBoxes((prev) => [...prev, currentBox]);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleUndo = () => {
    setRedactionBoxes((prev) => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    setRedactionBoxes([]);
  };

  const handleAutoMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    // Mask center bottom zone
    setRedactionBoxes((prev) => [
      ...prev,
      { x: w * 0.2, y: h * 0.6, w: w * 0.6, h: h * 0.08 },
    ]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buffer) => {
        onApplyRedaction(buffer);
        toast.shield('Privacy Redactions Applied', 'Sensitive sections masked directly in RAM.');
      });
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="wa-panel p-5 sm:p-6 rounded-2xl max-w-xl w-full mx-auto space-y-4 shadow-2xl border border-[#d1d7db] text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#d9fdd3] text-[#008069]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111b21]">Mask Sensitive ID</h3>
            <p className="text-[11px] text-[#667781]">Drag to draw black privacy bars over private numbers</p>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-[#f0f2f5] text-[#54656f] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Preset Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#e9edef]">
        <button
          type="button"
          onClick={handleAutoMask}
          className="px-3 py-1.5 rounded-lg bg-[#e7f8ff] text-[#0284c7] hover:bg-[#d0f0fd] text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Quick Mask Number Zone</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={redactionBoxes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f] text-xs font-semibold flex items-center gap-1"
            title="Undo"
          >
            <Undo className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            onClick={handleClearAll}
            disabled={redactionBoxes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] disabled:opacity-30 text-[#dc2626] text-xs font-semibold flex items-center gap-1"
            title="Clear all"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative bg-[#54656f] rounded-xl overflow-hidden touch-none flex items-center justify-center max-h-[420px] shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="max-w-full max-h-[420px] object-contain cursor-crosshair select-none"
        />
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e9edef]">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] text-xs font-semibold"
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          className="btn-wa-primary px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <Check className="w-4 h-4" />
          <span>Apply & Stage File</span>
        </button>
      </div>
    </div>
  );
};
