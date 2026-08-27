import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, EyeOff, Lock, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set up pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DRMCanvasViewerProps {
  documentBuffer: ArrayBuffer | null;
  fileType: string;
  filename: string;
  shopId: string;
  sessionId: string;
  rotation: number; // 0, 90, 180, 270
  filterMode: 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST';
  zoomLevel: number;
  currentPage: number;
  onPageCountLoaded: (count: number) => void;
  onSafePrintTrigger: () => void;
}

export const DRMCanvasViewer: React.FC<DRMCanvasViewerProps> = ({
  documentBuffer,
  fileType,
  filename,
  shopId,
  sessionId,
  rotation,
  filterMode,
  zoomLevel,
  currentPage,
  onPageCountLoaded,
  onSafePrintTrigger
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Anti-Exfiltration & DRM Protections
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Intercept Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        alert('🔒 DRM Protected: Saving raw documents to disk is strictly prohibited on SafePrint.');
        return false;
      }

      // Intercept Ctrl+P / Cmd+P -> Route to SafePrint
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onSafePrintTrigger();
        return false;
      }

      // Intercept DevTools shortcuts
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) {
        e.preventDefault();
        return false;
      }
    };

    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleBlur = () => {
      setIsWindowBlurred(true);
    };

    const handleFocus = () => {
      setIsWindowBlurred(false);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [onSafePrintTrigger]);

  // Load Document (PDF or Image) into Memory Canvas
  useEffect(() => {
    if (!documentBuffer || documentBuffer.byteLength === 0) return;

    let isMounted = true;
    setLoading(true);

    const renderDocument = async () => {
      try {
        const isPdf = fileType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          // Clone the buffer slice to avoid worker detach issues
          const bufferCopy = documentBuffer.slice(0);
          const loadingTask = pdfjsLib.getDocument({ data: bufferCopy });
          const pdf = await loadingTask.promise;
          if (!isMounted) return;

          setPdfDoc(pdf);
          onPageCountLoaded(pdf.numPages);
          await renderPdfPage(pdf, currentPage);
        } else {
          // Image rendering (PNG/JPEG)
          onPageCountLoaded(1);
          await renderImageBuffer(documentBuffer);
        }
      } catch (err) {
        console.error('[SafePrint DRM Viewer] Render error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    renderDocument();

    return () => {
      isMounted = false;
    };
  }, [documentBuffer, fileType, filename]);

  // Re-render when page, rotation, filter or zoom changes
  useEffect(() => {
    if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPage);
    } else if (documentBuffer && !fileType.includes('pdf')) {
      renderImageBuffer(documentBuffer);
    }
  }, [currentPage, rotation, filterMode, zoomLevel, pdfDoc]);

  const renderPdfPage = async (pdf: any, pageNum: number) => {
    if (!canvasRef.current || !pdf) return;
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.5 * zoomLevel, rotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Apply Post-Process Filters (Grayscale / High Contrast B&W)
      applyCanvasFilter(canvas, ctx);
    } catch (err) {
      console.warn('[SafePrint DRM Viewer] Page render warning:', err);
    }
  };

  const renderImageBuffer = async (buffer: ArrayBuffer) => {
    if (!canvasRef.current) return;
    try {
      const blob = new Blob([buffer], { type: fileType || 'image/jpeg' });
      const imgUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const isRotated = rotation === 90 || rotation === 270;
        const width = (isRotated ? img.height : img.width) * zoomLevel;
        const height = (isRotated ? img.width : img.height) * zoomLevel;

        canvas.width = width;
        canvas.height = height;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(
          img,
          -((isRotated ? height : width) / 2),
          -((isRotated ? width : height) / 2),
          isRotated ? height : width,
          isRotated ? width : height
        );
        ctx.restore();

        applyCanvasFilter(canvas, ctx);
        URL.revokeObjectURL(imgUrl); // Immediate cleanup
      };

      img.src = imgUrl;
    } catch (err) {
      console.error('[SafePrint DRM Viewer] Image render error:', err);
    }
  };

  const applyCanvasFilter = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    if (filterMode === 'NORMAL') return;

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Luminance calculation
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filterMode === 'GRAYSCALE') {
          data[i] = gray;
          data[i + 1] = gray;
          data[i + 2] = gray;
        } else if (filterMode === 'BW' || filterMode === 'HIGH_CONTRAST') {
          // Binary threshold for sharp photocopy
          const threshold = filterMode === 'HIGH_CONTRAST' ? 140 : 128;
          const val = gray > threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('[SafePrint] Filter application error:', e);
    }
  };

  const formattedTime = new Date().toISOString().substring(0, 16).replace('T', ' ');

  return (
    <div
      ref={containerRef}
      className="drm-canvas-container relative w-full h-[600px] bg-slate-950 rounded-2xl border-2 border-cyan-500/30 overflow-auto flex items-center justify-center p-4 shadow-2xl select-none"
    >
      {/* Forensic Watermark Overlay Grid */}
      <div className="forensic-watermark-overlay">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="p-4 opacity-75">
            SAFEPRINT FORENSIC TRACE • {shopId} • {sessionId.substring(0, 8)} • {formattedTime}
          </div>
        ))}
      </div>

      {/* Screen Capture Deterrent / Blur on Inactive Window */}
      {isWindowBlurred && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 transition-all duration-300">
          <EyeOff className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
          <h3 className="text-lg font-bold text-white mb-1">Display Blurred for Security</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            SafePrint anti-exfiltration shield activated. Click inside this window to resume viewing.
          </p>
        </div>
      )}

      {/* Sandboxed Canvas */}
      <div id="print-area" className="relative z-10 max-w-full">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-cyan-400 font-mono text-xs">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Decrypted in RAM. Rendering canvas sandbox...</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="print-page-canvas shadow-2xl bg-white rounded transition-transform duration-200"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {/* DRM Active Floating Badge */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 shadow-lg no-print">
        <Lock className="w-3 h-3 text-emerald-400" />
        <span>Canvas Sandboxed • Anti-Save Active</span>
      </div>
    </div>
  );
};
