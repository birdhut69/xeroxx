import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Send, Smartphone, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { QRScanner } from './QRScanner';
import { DocumentPicker } from './DocumentPicker';
import { RedactionStudio } from './RedactionStudio';
import { WatermarkTool } from './WatermarkTool';
import { LiveSecurityTracker } from './LiveSecurityTracker';
import { ShredCertificateModal } from './ShredCertificateModal';
import { importKeyFromHash, encryptDocument, computeSHA256 } from '../../crypto/e2ee';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { DestructionCertificate } from '../../crypto/ledger';

export const CustomerPortal: React.FC = () => {
  // Session pairing
  const [roomId, setRoomId] = useState<string | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [shopName, setShopName] = useState<string>('SafePrint Station');
  const [shopId, setShopId] = useState<string>('');

  // Selected file and redaction
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [showRedactionStudio, setShowRedactionStudio] = useState(false);

  // Security constraints
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [maxCopies, setMaxCopies] = useState<number>(1);

  // Transfer & Progress State
  const [status, setStatus] = useState<
    'IDLE' | 'ENCRYPTING' | 'STREAMING' | 'RECEIVED' | 'PRINTING' | 'PRINT_COMPLETED' | 'SHREDDED'
  >('IDLE');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [destructionCert, setDestructionCert] = useState<DestructionCertificate | null>(null);

  const relayRef = useRef<RelaySocket | null>(null);

  // Check URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const hash = window.location.hash;

    if (room && hash.includes('key=')) {
      const parsedKey = hash.split('key=')[1]?.split('&')[0];
      if (parsedKey) {
        handleSessionDecoded(room, parsedKey);
      }
    }
  }, []);

  const handleSessionDecoded = (decodedRoom: string, decodedKey: string) => {
    setRoomId(decodedRoom);
    setKeyHex(decodedKey);

    if (relayRef.current) {
      relayRef.current.close();
    }

    const relay = new RelaySocket();
    relayRef.current = relay;

    relay.connect({
      onOpen: () => {
        relay.send({
          type: 'JOIN_CUSTOMER',
          roomId: decodedRoom
        });
      },
      onConnectedToShop: (data) => {
        setShopName(data.shopName);
        setShopId(data.shopId);
        sounds.playConnect();
      },
      onPrintStatus: (data) => {
        if (data.status === 'PRINTING') {
          setStatus('PRINTING');
          sounds.playPrint();
        } else if (data.status === 'PRINT_COMPLETED') {
          setStatus('PRINT_COMPLETED');
        }
      },
      onShredConfirmed: (data) => {
        setStatus('SHREDDED');
        setDestructionCert(data.certificate);
      }
    });
  };

  const handleApplyRedaction = (newBuffer: ArrayBuffer) => {
    if (selectedFile) {
      setSelectedFile({
        ...selectedFile,
        buffer: newBuffer,
        size: newBuffer.byteLength
      });
    }
    setShowRedactionStudio(false);
    sounds.playSuccess();
  };

  // Perform Client-Side E2EE Encryption and Beam to Shop Terminal
  const handleSendDocument = async () => {
    if (!selectedFile || !roomId || !keyHex || !relayRef.current) return;

    try {
      setStatus('ENCRYPTING');
      sounds.playEncrypt();

      // 1. Import Key from Hash
      const cryptoKey = await importKeyFromHash(keyHex);

      // 2. Client-side AES-256-GCM Encryption
      const encrypted = await encryptDocument(selectedFile.buffer, cryptoKey);

      setStatus('STREAMING');

      // 3. Metadata packet
      const metadata = {
        filename: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
        watermarkText: watermarkText || undefined,
        maxCopies
      };

      // 4. Stream encrypted chunks
      await relayRef.current.sendEncryptedChunks(
        roomId,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.docHash,
        metadata,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setStatus('RECEIVED');
      sounds.playSuccess();
    } catch (err) {
      console.error('[SafePrint Customer] Encryption/Send error:', err);
      alert('Encryption or transmission failed.');
      setStatus('IDLE');
    }
  };

  const resetAll = () => {
    setRoomId(null);
    setKeyHex(null);
    setSelectedFile(null);
    setStatus('IDLE');
    setUploadProgress(0);
    setDestructionCert(null);
    setShowRedactionStudio(false);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      {/* 1. Step 1: No Session Paired -> QR Scanner */}
      {!roomId && (
        <QRScanner onSessionDecoded={handleSessionDecoded} />
      )}

      {/* Redaction Studio Modal Overlay */}
      {showRedactionStudio && selectedFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto flex items-center justify-center">
          <RedactionStudio
            imageBuffer={selectedFile.buffer}
            onApplyRedaction={handleApplyRedaction}
            onCancel={() => setShowRedactionStudio(false)}
          />
        </div>
      )}

      {/* 2. Step 2: Session Paired & Ready to Select File */}
      {roomId && status === 'IDLE' && (
        <div className="space-y-4">
          {/* Shop Session Banner */}
          <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Connected: {shopName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Station ID: {shopId || 'Auto-Detected'}
                </div>
              </div>
            </div>

            <button
              onClick={resetAll}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-mono transition-all"
              title="Disconnect"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Document Picker */}
          <DocumentPicker
            selectedFile={selectedFile}
            onFileSelected={setSelectedFile}
            onOpenRedactionStudio={() => setShowRedactionStudio(true)}
          />

          {/* Security & Watermark Customizer */}
          <WatermarkTool
            watermarkText={watermarkText}
            maxCopies={maxCopies}
            onWatermarkChange={setWatermarkText}
            onMaxCopiesChange={setMaxCopies}
          />

          {/* Send Button */}
          <button
            onClick={handleSendDocument}
            disabled={!selectedFile}
            className="btn-cyber-primary w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/30"
          >
            <Send className="w-4 h-4" />
            <span>Encrypt & Beam to Xerox Terminal</span>
          </button>
        </div>
      )}

      {/* 3. Step 3: In-Flight Real-Time Telemetry Tracker */}
      {roomId && status !== 'IDLE' && status !== 'SHREDDED' && (
        <div className="space-y-4 my-6">
          <LiveSecurityTracker
            status={status}
            uploadProgress={uploadProgress}
          />
        </div>
      )}

      {/* 4. Step 4: Shred Complete -> Cryptographic Proof of Destruction */}
      {status === 'SHREDDED' && destructionCert && (
        <ShredCertificateModal
          certificate={destructionCert}
          onNewSession={resetAll}
        />
      )}
    </div>
  );
};
