import React, { useEffect, useRef, useState } from 'react';
import { EyeOff, Lock, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from '../shared/ToastContext';

// Set up pdf.js worker with unpkg fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
} catch {
  // worker fallback
}

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
        if (!cancelled) setRenderError('Could not load document preview.');
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

        const naturalW = img.naturalWidth || 800;
        const naturalH = img.naturalHeight || 1000;
        const isRotated = rotation === 90 || rotation === 270;

        const canvasW = (isRotated ? naturalH : naturalW) * zoomLevel;
        const canvasH = (isRotated ? naturalW : naturalH) * zoomLevel;

        canvas.width = canvasW;
        canvas.height = canvasH;

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);

        const drawW = naturalW * zoomLevel;
        const drawH = naturalH * zoomLevel;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();

        applyCanvasFilter(canvas, ctx);
        URL.revokeObjectURL(imgUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(imgUrl);
        setRenderError('Failed to render image.');
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
          // Photocopy B&W threshold
          const threshold = filterMode === 'HIGH_CONTRAST' ? 145 : 128;
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
      className="drm-canvas-container relative w-full min-h-[300px] sm:min-h-[480px] bg-[#54656f] rounded-2xl overflow-auto flex items-center justify-center p-3 sm:p-4 shadow-xl select-none border border-[#d1d7db]"
    >
      {/* Forensic Watermark Overlay */}
      <div className="forensic-watermark-overlay">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="p-3 opacity-60 whitespace-nowrap">
            SAFEPRINT • {shopId} • {sessionId.substring(0, 8)} • {watermarkTime}
          </div>
        ))}
      </div>

      {/* Window Blur Shield */}
      {isWindowBlurred && (
        <div className="absolute inset-0 z-30 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 text-white">
          <EyeOff className="w-10 h-10 text-red-400 mb-2 animate-bounce" />
          <h4 className="text-sm font-bold">Display Shielded</h4>
          <p className="text-xs text-slate-300">Click window to resume document viewing.</p>
        </div>
      )}

      {/* Canvas Print Sandbox Area */}
      <div id="print-area" className="relative z-10 max-w-full">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-white font-mono text-xs py-10">
            <div className="w-7 h-7 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <span>Rendering in RAM sandbox...</span>
          </div>
        ) : renderError ? (
          <div className="flex flex-col items-center gap-2 text-red-300 font-mono text-xs py-10 text-center px-4">
            <AlertCircle className="w-6 h-6" />
            <span>{renderError}</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="print-page-canvas shadow-xl bg-white rounded transition-transform duration-150"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {/* DRM Active Badge */}
      <div className="absolute bottom-2.5 right-2.5 z-20 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 text-[10px] font-mono text-white shadow-md no-print">
        <Lock className="w-3 h-3 text-[#25d366]" />
        <span>DRM Sandboxed • Anti-Save</span>
      </div>
    </div>
  );
};
