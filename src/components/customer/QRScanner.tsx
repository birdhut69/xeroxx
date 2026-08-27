import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Camera, QrCode, ArrowRight, ShieldCheck, Link2 } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface QRScannerProps {
  onSessionDecoded: (roomId: string, keyHex: string) => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onSessionDecoded }) => {
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
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

    // Initialize in-browser QR camera scanner
    try {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          rememberLastUsedCamera: true
        },
        /* verbose= */ false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          handleDecodedUrl(decodedText);
        },
        (error) => {
          // quiet continuous frame errors
        }
      );
      setScanning(true);
    } catch (err: any) {
      console.warn('[SafePrint QR Scanner] Camera init note:', err);
      setScanError('Camera access not permitted or unavailable. Use manual link entry below.');
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {}
      }
    };
  }, []);

  const handleDecodedUrl = (text: string) => {
    try {
      sounds.playConnect();
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch {}
      }

      // Parse room and key
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
    } catch (e: any) {
      setScanError('Failed to parse QR code link.');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDecodedUrl(manualInput.trim());
  };

  return (
    <div className="glass-panel-glow p-6 sm:p-8 rounded-2xl max-w-md mx-auto text-center relative overflow-hidden">
      <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto mb-3">
        <Camera className="w-6 h-6" />
      </div>

      <h2 className="text-xl font-bold text-white mb-1">Scan Shop QR Code</h2>
      <p className="text-xs text-slate-300 mb-5">
        Scan the QR code displayed on the Xerox shop screen to establish an encrypted zero-trust connection.
      </p>

      {/* HTML5 QR Camera Container */}
      <div className="relative bg-slate-950 rounded-xl overflow-hidden border-2 border-cyan-500/40 mb-5 min-h-[260px] flex items-center justify-center">
        <div id="qr-reader" className="w-full text-slate-200" />
      </div>

      {scanError && (
        <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono">
          {scanError}
        </div>
      )}

      {/* Manual Paste Form */}
      <form onSubmit={handleManualSubmit} className="space-y-3 pt-2 border-t border-slate-800">
        <div className="text-left text-[11px] text-slate-400 font-medium">Or paste pairing link:</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="http://.../?room=...#key=..."
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="submit"
            className="btn-cyber-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            <span>Connect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
