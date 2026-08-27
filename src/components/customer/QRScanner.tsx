import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, QrCode, ArrowRight, ShieldCheck, Link2 } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface QRScannerProps {
  onSessionDecoded: (roomId: string, keyHex: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onSessionDecoded }) => {
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
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
          qrbox: { width: 240, height: 240 },
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
    } catch {
      setScanError('Camera unavailable or permission denied. Use manual link entry below.');
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
        setScanError('Invalid SafePrint QR code format.');
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
    <div className="wa-panel p-6 sm:p-8 rounded-2xl max-w-md mx-auto text-center relative overflow-hidden shadow-lg space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
        <Camera className="w-6 h-6" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-[#111b21]">Scan Xerox Shop QR Code</h2>
        <p className="text-xs text-[#667781] leading-relaxed">
          Point your camera at the shopkeeper's screen to open an encrypted in-memory chat.
        </p>
      </div>

      {/* HTML5 QR Camera Box */}
      <div className="relative bg-[#f0f2f5] rounded-xl overflow-hidden border-2 border-[#00a884]/30 min-h-[260px] flex items-center justify-center">
        <div id="qr-reader" className="w-full text-[#111b21]" />
      </div>

      {scanError && (
        <div className="p-2.5 rounded-lg bg-[#fee2e2] border border-[#fca5a5] text-[#dc2626] text-xs font-mono text-left">
          {scanError}
        </div>
      )}

      {/* Manual Link Input */}
      <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-[#e9edef] text-left">
        <div className="text-[11px] text-[#667781] font-medium">Or paste pairing link:</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="http://.../?room=...#key=..."
            className="flex-1 px-3 py-2 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] text-xs text-[#111b21] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884] font-mono"
          />
          <button
            type="submit"
            className="btn-wa-primary px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <span>Connect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
