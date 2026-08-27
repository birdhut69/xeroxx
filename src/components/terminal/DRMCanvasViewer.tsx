import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EyeOff, Lock } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from '../shared/ToastContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface DRMCanvasViewerProps {
  documentBuffer: ArrayBuffer | null;
  fileType: string;
  filename: string;
  shopId: string;
  sessionId: string;
  rotation: number;
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
  onSafePrintTrigger,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isWindowBlurred, setIsWindowBlurred] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const toast = useToast();

  // Anti-Exfiltration DRM Protections
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        toast.shield('Download Blocked', 'Saving documents to disk is prohibited on SafePrint.');
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onSafePrintTrigger();
      }
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase()))) {
        e.preventDefault();
      }
    };

    const handleDragStart = (e: DragEvent) => { e.preventDefault(); };
    const handleBlur = () => setIsWindowBlurred(true);
    const handleFocus = () => setIsWindowBlurred(false);

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
  }, [onSafePrintTrigger, toast]);

  // Load Document (PDF or Image) into Memory Canvas
  useEffect(() => {
    if (!documentBuffer || documentBuffer.byteLength === 0) return;

    let cancelled = false;
    setLoading(true);
    setRenderError(null);

    const loadDocument = async () => {
      try {
        const isPdf = fileType.includes('pdf') || filename.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          const bufferCopy = documentBuffer.slice(0);
          const pdf = await pdfjsLib.getDocument({ data: bufferCopy }).promise;
          if (cancelled) return;
          setPdfDoc(pdf);
          onPageCountLoaded(pdf.numPages);
        } else {
          onPageCountLoaded(1);
          setPdfDoc(null);
        }
      } catch (err) {
        console.error('[SafePrint DRM Viewer] Load error:', err);
        if (!cancelled) setRenderError('Failed to load document. The file may be corrupted or unsupported.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDocument();
    return () => { cancelled = true; };
  }, [documentBuffer, fileType, filename, onPageCountLoaded]);

  // Re-render when page, rotation, filter or zoom changes
  useEffect(() => {
    if (pdfDoc) {
      renderPdfPage(pdfDoc, currentPage);
    } else if (documentBuffer && !fileType.includes('pdf')) {
      renderImageBuffer(documentBuffer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, rotation, filterMode, zoomLevel, pdfDoc]);

  const renderPdfPage = async (pdf: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
    if (!canvasRef.current) return;
    try {
      const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1.5 * zoomLevel, rotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;
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
        if (!canvas) { URL.revokeObjectURL(imgUrl); return; }
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(imgUrl); return; }

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
        URL.revokeObjectURL(imgUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        setRenderError('Failed to render image. The file may be corrupted.');
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
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (filterMode === 'GRAYSCALE') {
          data[i] = data[i + 1] = data[i + 2] = gray;
        } else {
          const threshold = filterMode === 'HIGH_CONTRAST' ? 140 : 128;
          const val = gray > threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = val;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('[SafePrint] Filter error:', e);
    }
  };

  const now = new Date();
  const watermarkTime = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div
      ref={containerRef}
      className="drm-canvas-container relative w-full min-h-[300px] sm:min-h-[500px] bg-slate-950 rounded-3xl border-2 border-cyan-500/30 overflow-auto flex items-center justify-center p-3 sm:p-4 shadow-2xl select-none"
    >
      {/* Forensic Watermark Overlay */}
      <div className="forensic-watermark-overlay">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="p-3 sm:p-4 opacity-75 whitespace-nowrap">
            SAFEPRINT • {shopId} • {sessionId.substring(0, 8)} • {watermarkTime}
          </div>
        ))}
      </div>

      {/* Window Blur Security Overlay */}
      {isWindowBlurred && (
        <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 transition-all duration-300">
          <EyeOff className="w-12 h-12 text-rose-500 mb-3 animate-bounce" />
          <h3 className="text-lg font-bold text-white mb-1">Display Blurred for Security</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            Anti-exfiltration shield active. Click this window to resume viewing.
          </p>
        </div>
      )}

      {/* Canvas Render Area */}
      <div id="print-area" className="relative z-10 max-w-full">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-cyan-400 font-mono text-xs py-12">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Decrypting and rendering in sandbox...</span>
          </div>
        ) : renderError ? (
          <div className="flex flex-col items-center gap-3 text-rose-400 font-mono text-xs py-12 text-center px-4">
            <span className="text-lg">⚠️</span>
            <span>{renderError}</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="print-page-canvas shadow-2xl bg-white rounded transition-transform duration-200"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {/* DRM Active Badge */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/95 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 shadow-lg no-print">
        <Lock className="w-3 h-3 text-emerald-400" />
        <span>Canvas Sandboxed • DRM Active</span>
      </div>
    </div>
  );
};
