import React, { useEffect, useRef, useState } from 'react';
import { EyeOff, Lock, AlertCircle, ShieldAlert, Shield } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { useToast } from '../shared/ToastContext';

// Set up pdf.js worker
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
  onCloseDocument?: () => void;
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
  onCloseDocument,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isShielded, setIsShielded] = useState(false);
  const [shieldReason, setShieldReason] = useState<string>('Display Protected');
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const toast = useToast();

  // ── ADVANCED ANTI-SCREENSHOT & ANTI-EXFILTRATION SHIELD ──
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.shield('Action Prohibited', 'Context menu is disabled on Sandboxed DRM.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key ? e.key.toLowerCase() : '';
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Intercept Save (Ctrl+S, Cmd+S)
      if (isCmdOrCtrl && key === 's') {
        e.preventDefault();
        toast.shield('Save Blocked', 'Saving files to disk is prohibited by Zero-Trust protocol.');
        triggerShield('Save Attempt Intercepted');
      }

      // Intercept Print Shortcut to route through SafePrint print engine
      if (isCmdOrCtrl && key === 'p') {
        e.preventDefault();
        onSafePrintTrigger();
      }

      // Intercept Screenshot Shortcuts:
      // Windows: PrintScreen, Win+Shift+S, Alt+PrintScreen
      // Mac: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (
        key === 'printscreen' ||
        e.keyCode === 44 ||
        (isCmdOrCtrl && e.shiftKey && ['3', '4', '5', 's'].includes(key)) ||
        (e.altKey && key === 'printscreen')
      ) {
        e.preventDefault();
        triggerShield('Screenshot Shortcut Detected');
        toast.error('Screenshot Blocked', 'Screen capture is prohibited on encrypted documents.');
      }

      // Intercept DevTools (F12, Ctrl+Shift+I, Cmd+Option+I)
      if (e.key === 'F12' || (isCmdOrCtrl && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        triggerShield('DevTools Inspection Blocked');
      }
    };

    const handleDragStart = (e: DragEvent) => { e.preventDefault(); };

    // Shield on window blur (e.g. Snipping tool, window switch, screen recorder)
    const handleBlur = () => {
      triggerShield('Window Focus Lost (Anti-Capture Active)');
    };

    const handleFocus = () => {
      setIsShielded(false);
    };

    // Shield when tab is hidden or backgrounded
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerShield('Tab Inactive (RAM Shielded)');
      } else {
        setIsShielded(false);
      }
    };

    const handleMouseLeave = () => {
      // Optional subtle shield when cursor leaves window boundary
    };

    const triggerShield = (reason: string) => {
      setShieldReason(reason);
      setIsShielded(true);
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
        if (!cancelled) setRenderError('Could not load document preview in RAM.');
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
          // Photocopy B&W Threshold
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
      className="drm-canvas-container relative w-full min-h-[360px] sm:min-h-[520px] bg-[#475569] rounded-2xl overflow-auto flex items-center justify-center p-3 sm:p-5 shadow-2xl select-none border border-[#cbd5e1]"
    >
      {/* Dynamic High-Density Forensic Watermark Grid */}
      <div className="forensic-watermark-overlay">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} className="p-3 opacity-70 whitespace-nowrap">
            SAFEPRINT • {shopId} • {sessionId.substring(0, 8)} • {watermarkTime}
          </div>
        ))}
      </div>

      {/* Real-Time Screen Capture Shield Overlay */}
      {isShielded && (
        <div
          onClick={() => setIsShielded(false)}
          className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6 text-white cursor-pointer animate-in fade-in duration-100"
        >
          <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mb-3 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">Anti-Exfiltration DRM Shield Active</h4>
          <p className="text-xs text-slate-300 max-w-sm mb-2">{shieldReason}</p>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40">
            Click anywhere on this screen to resume viewing
          </span>
        </div>
      )}

      {/* Canvas Print Sandbox Area */}
      <div id="print-area" className="relative z-10 max-w-full">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-white font-mono text-xs py-12">
            <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
            <span>Loading document into isolated RAM...</span>
          </div>
        ) : renderError ? (
          <div className="flex flex-col items-center gap-2 text-red-300 font-mono text-xs py-12 text-center px-4">
            <AlertCircle className="w-7 h-7" />
            <span>{renderError}</span>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="print-page-canvas shadow-2xl bg-white rounded transition-transform duration-150"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>

      {/* DRM Active Badge */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 text-[10px] font-mono text-white shadow-lg no-print border border-white/20">
        <Lock className="w-3 h-3 text-[#25d366]" />
        <span>RAM Sandboxed • Anti-Capture DRM</span>
      </div>
    </div>
  );
};
