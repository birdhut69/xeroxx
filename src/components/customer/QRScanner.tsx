import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Shield, Lock, Cpu, QrCode, ArrowRight, Image as ImageIcon, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useLanguage } from '../../context/LanguageContext';

interface QRScannerProps {
  onSessionDecoded: (roomId: string, keyHex: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onSessionDecoded }) => {
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);

  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useLanguage();

  const handleDecodedUrl = useCallback((text: string) => {
    try {
      sounds.playConnect();

      let url: URL;
      if (text.startsWith('http://') || text.startsWith('https://')) {
        url = new URL(text);
      } else {
        url = new URL(text, window.location.origin);
      }

      const room = url.searchParams.get('room');
      const hash = url.hash;
      const keyHex = hash.includes('key=') ? hash.split('key=')[1]?.split('&')[0] : '';

      if (room && keyHex) {
        // Stop scanner before moving to chat
        if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
          scannerInstanceRef.current.stop().catch(() => {});
        }
        onSessionDecoded(room, keyHex);
      } else {
        setScanError('Invalid CipherPrint QR format. Make sure it contains room & #key=');
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

      await scannerInstanceRef.current.start(
        { facingMode: { ideal: facing } },
        {
          fps: 15,
          qrbox: { width: 230, height: 230 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleDecodedUrl(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
      setCameraLoading(false);
    } catch (err: any) {
      console.warn('[CipherPrint QR] Scanner start error:', err);
      // If ideal facingMode failed, try starting with generic constraint
      try {
        if (scannerInstanceRef.current) {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0) {
            const cameraId = cameras[cameras.length - 1].id;
            await scannerInstanceRef.current.start(
              cameraId,
              { fps: 15, qrbox: { width: 230, height: 230 } },
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

      let errorMsg = 'Camera access unavailable.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Allow camera in browser settings or upload a QR image below.';
      }
      setScanError(errorMsg);
      setIsScanning(false);
      setCameraLoading(false);
    }
  }, [stopCamera, handleDecodedUrl]);

  useEffect(() => {
    // Check if current URL already has room and key in hash
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const hash = window.location.hash;

    if (room && hash.includes('key=')) {
      const keyHex = hash.split('key=')[1]?.split('&')[0];
      if (keyHex) {
        onSessionDecoded(room, keyHex);
        return;
      }
    }

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
      setScanError('No valid QR code found in this image.');
      setCameraLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedUrl(manualInput.trim());
  };

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col items-center justify-start gap-4 p-3 sm:p-4 text-center animate-in fade-in duration-200">
      {/* Title */}
      <div className="text-center w-full px-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D9FDD3] text-[#00453d] text-xs font-bold font-mono mb-2 border border-[#3de273]/30">
          <Sparkles className="w-3.5 h-3.5 text-[#006d2f]" />
          <span>{t('zeroTraceHandshake')}</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#1d1c17]">{t('scanTitle')}</h2>
        <p className="text-xs sm:text-sm text-[#6f7976] mt-1 leading-relaxed">
          {t('scanSubtitle')}
        </p>
      </div>

      {/* Viewfinder Area */}
      <div className="relative w-[280px] h-[280px] sm:w-[300px] sm:h-[300px] bg-[#1d1c17] rounded-[28px] shadow-2xl overflow-hidden flex items-center justify-center border-2 border-[#00453d]/30">
        {/* Hardware scan animation */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#25D366] shadow-[0_0_16px_4px_rgba(37,211,102,0.7)] animate-scan z-20 pointer-events-none" />

        {/* 4 Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-[3.5px] border-l-[3.5px] border-[#25D366] rounded-tl-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-[3.5px] border-r-[3.5px] border-[#25D366] rounded-tr-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3.5px] border-l-[3.5px] border-[#25D366] rounded-bl-[16px] m-4 z-20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3.5px] border-r-[3.5px] border-[#25D366] rounded-br-[16px] m-4 z-20 pointer-events-none" />

        {/* Live Camera HTML5 Mount */}
        <div
          id="cipherprint-qr-video"
          className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_button]:hidden [&_#cipherprint-qr-video__dashboard]:hidden"
        />

        {/* Loading Spinner */}
        {cameraLoading && (
          <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center gap-2 text-white text-xs font-mono">
            <div className="w-8 h-8 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
            <span>{t('initCamera')}</span>
          </div>
        )}

        {/* Camera Flip and Image Picker Quick Floating Buttons */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCameraFacing}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-90 cursor-pointer"
            title={t('switchCamera')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-90 cursor-pointer"
            title={t('uploadScreenshot')}
          >
            <ImageIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {scanError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3.5 py-2 rounded-xl max-w-sm flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      {/* Alternative Action: Scan from Photo or Retry */}
      <div className="w-full flex gap-2 justify-center">
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
          onClick={() => startCamera(cameraFacing)}
          className="py-2 px-3 rounded-xl bg-[#f2ede5] hover:bg-[#e7e2da] text-[#1d1c17] font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('refresh')}</span>
        </button>
      </div>

      {/* Security Telemetry Card */}
      <div className="w-full bg-white rounded-2xl p-3.5 border border-[#bec9c5]/30 shadow-xs text-left">
        <div className="grid grid-cols-3 gap-2 text-center divide-x divide-[#bec9c5]/30">
          <div className="px-1 flex flex-col items-center">
            <Lock className="w-4 h-4 text-[#00453d] mb-1" />
            <span className="text-[10px] text-[#6f7976] font-bold uppercase">{t('encryptionBadge')}</span>
            <span className="text-[11px] font-mono font-bold text-[#1d1c17]">AES-GCM-256</span>
          </div>

          <div className="px-1 flex flex-col items-center">
            <Shield className="w-4 h-4 text-[#006d2f] mb-1" />
            <span className="text-[10px] text-[#6f7976] font-bold uppercase">{t('keyExchangeBadge')}</span>
            <span className="text-[11px] font-mono font-bold text-[#1d1c17]">{t('urlFragment')}</span>
          </div>

          <div className="px-1 flex flex-col items-center">
            <Cpu className="w-4 h-4 text-[#ba1a1a] mb-1" />
            <span className="text-[10px] text-[#6f7976] font-bold uppercase">{t('storageBadge')}</span>
            <span className="text-[11px] font-mono font-bold text-[#ba1a1a]">{t('zeroDiskRam')}</span>
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
          className="flex-1 px-3.5 py-2.5 bg-white border border-[#bec9c5] rounded-xl text-xs text-[#1d1c17] placeholder:text-[#6f7976] focus:outline-none focus:ring-1 focus:ring-[#00453d]"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-[#00453d] text-white rounded-xl text-xs font-bold hover:bg-[#075e54] flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-sm"
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
