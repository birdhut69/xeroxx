import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Shield,
  Lock,
  Cpu,
  QrCode,
  ArrowRight,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Camera,
  Play
} from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useLanguage } from '../../context/LanguageContext';
import { parseSessionUrl } from '../../utils/qrParser';

interface QRScannerProps {
  onSessionDecoded: (roomId: string, keyHex: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onSessionDecoded }) => {
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [hasRequestedCamera, setHasRequestedCamera] = useState(false);

  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useLanguage();

  const handleDecodedUrl = useCallback((text: string) => {
    try {
      const parsed = parseSessionUrl(text);

      if (parsed && parsed.roomId && parsed.keyHex) {
        sounds.playConnect();
        // Stop scanner before moving to chat
        if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
          scannerInstanceRef.current.stop().catch(() => {});
        }
        onSessionDecoded(parsed.roomId, parsed.keyHex);
      } else {
        setScanError('Scanned QR code does not contain a valid CipherPrint session. Please scan the shop standee QR.');
      }
    } catch {
      setScanError('Failed to parse QR code link.');
    }
  }, [onSessionDecoded]);

  const stopCamera = useCallback(async () => {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop();
        }
      } catch {}
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraLoading(true);
    setScanError(null);
    setHasRequestedCamera(true);

    await stopCamera();

    const qrElementId = 'cipherprint-qr-video';
    const qrElement = document.getElementById(qrElementId);
    if (!qrElement) {
      setCameraLoading(false);
      return;
    }

    try {
      if (!scannerInstanceRef.current) {
        scannerInstanceRef.current = new Html5Qrcode(qrElementId, {
          verbose: false,
        });
      }

      const qrConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.floor(minEdge * 0.82);
          return { width: Math.max(180, Math.min(size, 320)), height: Math.max(180, Math.min(size, 320)) };
        },
        aspectRatio: 1.0,
      };

      // Try environment camera first
      await scannerInstanceRef.current.start(
        { facingMode: facing },
        qrConfig,
        (decodedText) => {
          handleDecodedUrl(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
      setCameraLoading(false);
    } catch (err: any) {
      console.warn('[CipherPrint QR] Scanner start error:', err);

      // Fallback 1: Try getting available video device IDs
      try {
        if (scannerInstanceRef.current) {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const backCamera = cameras.find((c) => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear')) || cameras[cameras.length - 1];
            await scannerInstanceRef.current.start(
              backCamera.id,
              { fps: 20, qrbox: { width: 220, height: 220 } },
              (decodedText) => handleDecodedUrl(decodedText),
              () => {}
            );
            setIsScanning(true);
            setCameraLoading(false);
            return;
          }
        }
      } catch (fallbackErr) {
        console.warn('[CipherPrint QR] Fallback camera error:', fallbackErr);
      }

      let errorMsg = 'Camera access unavailable. Tap below to retry or upload QR screenshot.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Allow camera in browser settings or upload a QR image.';
      }
      setScanError(errorMsg);
      setIsScanning(false);
      setCameraLoading(false);
    }
  }, [stopCamera, handleDecodedUrl]);

  useEffect(() => {
    // Check if current URL already has room and key
    const parsed = parseSessionUrl(window.location.href);
    if (parsed && parsed.roomId && parsed.keyHex) {
      onSessionDecoded(parsed.roomId, parsed.keyHex);
      return;
    }

    // Auto-attempt camera start on mount
    startCamera(cameraFacing);

    return () => {
      stopCamera();
    };
  }, [cameraFacing, onSessionDecoded, startCamera, stopCamera]);

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraLoading(true);
      setScanError(null);
      let html5QrCode = scannerInstanceRef.current;
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode('cipherprint-qr-video', false);
        scannerInstanceRef.current = html5QrCode;
      }

      const decodedText = await html5QrCode.scanFile(file, true);
      handleDecodedUrl(decodedText);
    } catch {
      setScanError('No valid QR code found in this image. Make sure the QR is clear.');
      setCameraLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedUrl(manualInput.trim());
  };

  // Launch a 1-tap demo test session for instant mobile preview
  const handleLaunchDemoSession = () => {
    sounds.playConnect();
    const demoRoom = `ROOM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const demoKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    onSessionDecoded(demoRoom, demoKey);
  };

  return (
    <div className="w-full max-w-[440px] mx-auto flex flex-col items-center justify-start gap-3.5 p-2 sm:p-4 text-center animate-in fade-in duration-200">
      {/* Title */}
      <div className="text-center w-full px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D9FDD3] text-[#00453d] text-xs font-bold font-mono mb-2 border border-[#3de273]/30">
          <Sparkles className="w-3.5 h-3.5 text-[#006d2f]" />
          <span>{t('zeroTraceHandshake')}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#1d1c17]">{t('scanTitle')}</h2>
        <p className="text-xs sm:text-sm text-[#6f7976] mt-0.5 leading-relaxed">
          {t('scanSubtitle')}
        </p>
      </div>

      {/* Viewfinder Area */}
      <div
        onClick={() => !isScanning && !cameraLoading && startCamera(cameraFacing)}
        className="relative w-[260px] h-[260px] sm:w-[290px] sm:h-[290px] bg-[#111b21] rounded-[28px] shadow-2xl overflow-hidden flex items-center justify-center border-2 border-[#00453d]/40 group cursor-pointer"
      >
        {/* Hardware scan laser animation if active */}
        {isScanning && (
          <div className="absolute top-0 left-0 w-full h-[2.5px] bg-[#25D366] shadow-[0_0_16px_4px_rgba(37,211,102,0.8)] animate-scan z-20 pointer-events-none" />
        )}

        {/* 4 Corner Reticle Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-[3.5px] border-l-[3.5px] border-[#25D366] rounded-tl-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-[3.5px] border-r-[3.5px] border-[#25D366] rounded-tr-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3.5px] border-l-[3.5px] border-[#25D366] rounded-bl-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3.5px] border-r-[3.5px] border-[#25D366] rounded-br-[16px] m-4 z-20 pointer-events-none" />

        {/* Live Camera HTML5 Mount */}
        <div
          id="cipherprint-qr-video"
          className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>#cipherprint-qr-video__dashboard]:hidden [&>img]:hidden"
        />

        {/* Loading Spinner */}
        {cameraLoading && (
          <div className="absolute inset-0 z-30 bg-[#111b21]/90 flex flex-col items-center justify-center gap-2 text-white text-xs font-mono">
            <div className="w-9 h-9 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
            <span>{t('initCamera')}</span>
          </div>
        )}

        {/* Friendly Interactive Camera Activation Fallback */}
        {!isScanning && !cameraLoading && (
          <div className="absolute inset-0 z-[25] bg-[#111b21]/95 flex flex-col items-center justify-center p-4 text-center text-white space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#00a884]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366] shadow-lg animate-pulse-glow">
              <Camera className="w-7 h-7" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Tap to Enable Camera</div>
              <p className="text-[11px] text-[#8cd4c7] mt-0.5">Allows instant QR standee scanning</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                startCamera(cameraFacing);
              }}
              className="py-2 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-transform cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Start Camera Scanner</span>
            </button>
          </div>
        )}

        {/* Camera Flip and Image Picker Floating Controls */}
        {isScanning && (
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCameraFacing();
              }}
              className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-90 cursor-pointer"
              title={t('switchCamera')}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="p-2 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-90 cursor-pointer"
              title={t('uploadScreenshot')}
            >
              <ImageIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {scanError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl max-w-sm flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Alternative Action: Scan from Photo & 1-Tap Demo Test */}
      <div className="w-full flex gap-2 justify-center max-w-[360px]">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-[#f2ede5] border border-[#bec9c5]/60 text-[#00453d] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
        >
          <ImageIcon className="w-4 h-4 text-[#00453d]" />
          <span>{t('uploadScreenshot')}</span>
        </button>

        <button
          type="button"
          onClick={handleLaunchDemoSession}
          className="py-2 px-3.5 rounded-xl bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#00453d] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-[#00a884]/30"
          title="Try live test session without second device"
        >
          <Play className="w-3.5 h-3.5 fill-current text-[#006d2f]" />
          <span>Test Demo</span>
        </button>
      </div>

      {/* Security Telemetry Card */}
      <div className="w-full bg-white rounded-2xl p-3 border border-[#bec9c5]/30 shadow-xs text-left">
        <div className="grid grid-cols-3 gap-1 text-center divide-x divide-[#bec9c5]/30">
          <div className="px-1 flex flex-col items-center">
            <Lock className="w-3.5 h-3.5 text-[#00453d] mb-1" />
            <span className="text-[9.5px] text-[#6f7976] font-bold uppercase">{t('encryptionBadge')}</span>
            <span className="text-[10.5px] font-mono font-bold text-[#1d1c17]">AES-GCM-256</span>
          </div>

          <div className="px-1 flex flex-col items-center">
            <Shield className="w-3.5 h-3.5 text-[#006d2f] mb-1" />
            <span className="text-[9.5px] text-[#6f7976] font-bold uppercase">{t('keyExchangeBadge')}</span>
            <span className="text-[10.5px] font-mono font-bold text-[#1d1c17]">{t('urlFragment')}</span>
          </div>

          <div className="px-1 flex flex-col items-center">
            <Cpu className="w-3.5 h-3.5 text-[#ba1a1a] mb-1" />
            <span className="text-[9.5px] text-[#6f7976] font-bold uppercase">{t('storageBadge')}</span>
            <span className="text-[10.5px] font-mono font-bold text-[#ba1a1a]">{t('zeroDiskRam')}</span>
          </div>
        </div>
      </div>

      {/* Manual URL Link Input Form */}
      <form onSubmit={handleManualSubmit} className="w-full flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder={t('pasteLinkPlaceholder')}
          className="flex-1 px-3 py-2 bg-white border border-[#bec9c5] rounded-xl text-xs text-[#1d1c17] placeholder:text-[#6f7976] focus:outline-none focus:ring-1 focus:ring-[#00453d]"
        />
        <button
          type="submit"
          className="px-3.5 py-2 bg-[#00453d] text-white rounded-xl text-xs font-bold hover:bg-[#075e54] flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-sm shrink-0 min-w-[70px] justify-center"
        >
          <span>{t('joinBtn')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Hidden File Picker for QR Scan from Image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
};
