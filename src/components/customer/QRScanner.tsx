import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Shield, Lock, Cpu, QrCode, ArrowRight, FolderOpen } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface QRScannerProps {
  onSessionDecoded: (roomId: string, keyHex: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onSessionDecoded }) => {
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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

    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          rememberLastUsedCamera: true,
        },
        false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          handleDecodedUrl(decodedText);
        },
        () => {}
      );
      setCameraActive(true);
    } catch {
      setScanError('Camera unavailable or permission denied. Use link or file picker below.');
    }

    return () => {
      try {
        scannerRef.current?.clear();
      } catch {}
    };
  }, []);

  const handleDecodedUrl = (text: string) => {
    try {
      sounds.playConnect();
      try {
        scannerRef.current?.clear();
      } catch {}

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
        onSessionDecoded(room, keyHex);
      } else {
        setScanError('Invalid CipherPrint QR code format.');
      }
    } catch {
      setScanError('Failed to parse QR code link.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedUrl(manualInput.trim());
  };

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col items-center justify-start gap-4 p-2 sm:p-4 text-center animate-in fade-in duration-200">
      {/* Text Guide */}
      <div className="text-center w-full px-2">
        <h2 className="text-xl font-bold text-[#1d1c17]">Scan Xerox Counter Standee QR</h2>
        <p className="text-sm text-[#3f4946] mt-1.5 leading-relaxed">
          Align the dynamic code within the frame to authenticate a secure, zero-trace session.
        </p>
      </div>

      {/* Viewfinder Area */}
      <div className="relative w-[280px] h-[280px] bg-[#2d3130] rounded-[24px] shadow-xl overflow-hidden flex items-center justify-center border border-[#bec9c5]/40">
        {/* Hardware scan animation */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-[#3de273] shadow-[0_0_12px_3px_rgba(61,226,115,0.6)] animate-scan z-20 pointer-events-none" />

        {/* 4 Corner Brackets */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-[#3de273] rounded-tl-[16px] m-3.5 z-20 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-[#3de273] rounded-tr-[16px] m-3.5 z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-[#3de273] rounded-bl-[16px] m-3.5 z-20 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-[#3de273] rounded-br-[16px] m-3.5 z-20 pointer-events-none" />

        {/* Live Camera HTML5 Mount */}
        <div id="qr-reader" className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_button]:hidden [&_#qr-reader__dashboard]:hidden" />
      </div>

      {scanError && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl max-w-sm">
          {scanError}
        </div>
      )}

      {/* Security Telemetry Card */}
      <div className="w-full glass-card border border-[#e7e2da] rounded-[20px] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-left bg-white/90">
        <div className="flex flex-col gap-2.5">
          {/* Telemetry Item 1 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#fef9f0] flex items-center justify-center border border-[#bec9c5]/30 text-[#3f4946] shrink-0 shadow-xs">
              <Lock className="w-4 h-4 text-[#00453d]" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-[#6f7976] uppercase tracking-wider">Ephemeral Cipher</span>
              <span className="text-xs font-mono font-bold text-[#1d1c17]">AES-GCM-256</span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-[#bec9c5]/30" />

          {/* Telemetry Item 2 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#fef9f0] flex items-center justify-center border border-[#bec9c5]/30 text-[#3f4946] shrink-0 shadow-xs">
              <Shield className="w-4 h-4 text-[#00453d]" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-[#6f7976] uppercase tracking-wider">Key Exchange</span>
              <span className="text-xs font-mono font-bold text-[#1d1c17]">RFC 3986 URL Hash</span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-[#bec9c5]/30" />

          {/* Telemetry Item 3 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFF9ED] border border-[#FED7AA] flex items-center justify-center text-[#935200] shrink-0">
              <Cpu className="w-4 h-4 text-[#935200]" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <span className="text-[11px] font-bold text-[#6f7976] uppercase tracking-wider">Volatile Memory Buffer</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#1d1c17]">Active (Zero-Disk)</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3de273] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3de273]" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual URL Link Input Form */}
      <form onSubmit={handleManualSubmit} className="w-full flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Or paste counter session link..."
          className="flex-1 px-4 py-2.5 bg-white border border-[#bec9c5] rounded-xl text-xs text-[#1d1c17] placeholder:text-[#6f7976] focus:outline-none focus:ring-1 focus:ring-[#00453d]"
        />
        <button
          type="submit"
          className="px-4 py-2.5 bg-[#00453d] text-white rounded-xl text-xs font-bold hover:bg-[#075e54] flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-sm"
        >
          <span>Connect</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
