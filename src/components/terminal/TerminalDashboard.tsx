import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Lock, RefreshCw, Smartphone, CheckCircle2, Flame, Layers, AlertTriangle } from 'lucide-react';
import { generateSessionKey, exportKeyToHash, generateRandomSessionId, decryptDocument, base64UrlToUint8Array } from '../../crypto/e2ee';
import { zeroizeBuffer, scrubObjectUrls } from '../../crypto/zeroize';
import { EphemeralLedger } from '../../crypto/ledger';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { QRDisplay } from './QRDisplay';
import { DRMCanvasViewer } from './DRMCanvasViewer';
import { DocEditor } from './DocEditor';
import { SafePrintEngine } from './SafePrintEngine';
import { ShredAnimation } from './ShredAnimation';
import { SecurityBadge } from '../shared/SecurityBadge';

interface TerminalDashboardProps {
  onOpenCustomerView?: (url: string) => void;
}

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({ onOpenCustomerView }) => {
  // Session Identity & Cryptography
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [sessionKeyHex, setSessionKeyHex] = useState<string>('');
  const [shopId] = useState<string>(() => `XEROX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [shopName] = useState<string>('SafePrint Express Terminal #1');

  // Connection & Document State
  const [connectedUser, setConnectedUser] = useState<boolean>(false);
  const [sessionState, setSessionState] = useState<'IDLE' | 'RECEIVING' | 'VIEWING' | 'PRINTING' | 'SHREDDING'>('IDLE');
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [docMeta, setDocMeta] = useState<any>(null);
  const [iv, setIv] = useState<Uint8Array | null>(null);

  // Editor State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST'>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [copies, setCopies] = useState<number>(1);
  const [maxAllowedCopies, setMaxAllowedCopies] = useState<number>(5);

  // Print & Shred Lifecycle
  const [printCompleted, setPrintCompleted] = useState<boolean>(false);
  const [autoDestructSeconds, setAutoDestructSeconds] = useState<number>(45);
  const [isShredding, setIsShredding] = useState<boolean>(false);

  // Blockchain Ledger
  const ledgerRef = useRef<EphemeralLedger | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const chunkBufferRef = useRef<Uint8Array[]>([]);

  // Initialize or Reset Session
  const initSession = useCallback(async () => {
    // 1. Zeroize any previous buffer before resetting
    if (documentBuffer) {
      zeroizeBuffer(documentBuffer);
      setDocumentBuffer(null);
    }

    const newSessionId = generateRandomSessionId();
    const newKey = await generateSessionKey();
    const newKeyHex = await exportKeyToHash(newKey);

    setSessionId(newSessionId);
    setSessionKey(newKey);
    setSessionKeyHex(newKeyHex);
    setConnectedUser(false);
    setSessionState('IDLE');
    setDocMeta(null);
    setIv(null);
    chunkBufferRef.current = [];
    setCurrentPage(1);
    setTotalPages(1);
    setRotation(0);
    setFilterMode('NORMAL');
    setZoomLevel(1.0);
    setCopies(1);
    setPrintCompleted(false);

    // Initialize Cryptographic Ledger
    const ledger = new EphemeralLedger(newSessionId, shopId, shopName);
    await ledger.initGenesis();
    ledgerRef.current = ledger;

    // Connect to Ephemeral Relay Server
    if (relayRef.current) {
      relayRef.current.close();
    }

    const relay = new RelaySocket();
    relayRef.current = relay;

    relay.connect({
      onOpen: () => {
        relay.send({
          type: 'INIT_TERMINAL',
          roomId: newSessionId,
          shopId,
          shopName
        });
      },
      onCustomerConnected: () => {
        setConnectedUser(true);
        sounds.playConnect();
      },
      onDocMeta: (msg) => {
        setDocMeta(msg.metadata);
        setIv(new Uint8Array(msg.iv));
        if (msg.metadata?.maxCopies) {
          setMaxAllowedCopies(msg.metadata.maxCopies);
        }
        chunkBufferRef.current = [];
        setSessionState('RECEIVING');
        setStreamProgress(0);
      },
      onDocChunk: (msg) => {
        // Decode base64 chunk to binary in RAM
        const binary = atob(msg.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        chunkBufferRef.current.push(bytes);
        setStreamProgress(Math.round(((msg.chunkIndex + 1) / msg.totalChunks) * 100));
      },
      onDocComplete: async () => {
        try {
          // Combine chunks in RAM
          const totalLength = chunkBufferRef.current.reduce((acc, c) => acc + c.length, 0);
          const combinedCiphertext = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunkBufferRef.current) {
            combinedCiphertext.set(chunk, offset);
            offset += chunk.length;
          }

          // Clear chunk array reference
          chunkBufferRef.current = [];

          if (!newKey || !iv) {
            console.error('[SafePrint Terminal] Missing key or IV for decryption');
            return;
          }

          // Decrypt strictly into RAM ArrayBuffer
          const plaintextBuffer = await decryptDocument(combinedCiphertext.buffer as ArrayBuffer, iv, newKey);
          setDocumentBuffer(plaintextBuffer);
          setSessionState('VIEWING');
          sounds.playEncrypt();

          // Log Ingest Block on Ephemeral Ledger
          if (ledgerRef.current && docMeta) {
            await ledgerRef.current.recordIngest(
              docMeta.docHash || 'UNKNOWN',
              docMeta.filename || 'Document',
              docMeta.pageCount || 1,
              docMeta.watermarkText
            );
          }
        } catch (err) {
          console.error('[SafePrint Terminal] Decryption error:', err);
          alert('Failed to decrypt document. Integrity check or key mismatch.');
        }
      }
    });
  }, [shopId, shopName, docMeta, iv]);

  useEffect(() => {
    initSession();
    return () => {
      if (relayRef.current) {
        relayRef.current.close();
      }
    };
  }, []);

  // Handle Safe Print Pipeline
  const handleExecutePrint = async () => {
    setSessionState('PRINTING');
    sounds.playPrint();

    // Inform customer
    if (relayRef.current && sessionId) {
      relayRef.current.send({
        type: 'PRINT_STATUS_UPDATE',
        roomId: sessionId,
        status: 'PRINTING',
        pagesPrinted: totalPages,
        copies
      });
    }

    // Invoke Safe Print
    setTimeout(() => {
      window.print();
      setPrintCompleted(true);
      setSessionState('VIEWING');

      // Record Print in Ledger
      if (ledgerRef.current) {
        ledgerRef.current.recordPrint(totalPages, copies);
      }

      if (relayRef.current && sessionId) {
        relayRef.current.send({
          type: 'PRINT_STATUS_UPDATE',
          roomId: sessionId,
          status: 'PRINT_COMPLETED',
          pagesPrinted: totalPages,
          copies
        });
      }
    }, 300);
  };

  // Handle Memory Zeroization & Ephemeral Shredding
  const handleShred = async () => {
    if (isShredding) return;
    setIsShredding(true);
    sounds.playShred();

    // 1. RAM Hardware Zeroization
    if (documentBuffer) {
      zeroizeBuffer(documentBuffer);
      setDocumentBuffer(null);
    }

    // 2. Commit Final Shred Block to Ephemeral Blockchain Ledger
    const zeroizeNonce = Math.random().toString(36).substring(2, 15);
    if (ledgerRef.current) {
      const { block, certificate } = await ledgerRef.current.recordShred(zeroizeNonce);

      // Send verifiable certificate back to customer
      if (relayRef.current && sessionId) {
        relayRef.current.send({
          type: 'SHRED_CONFIRMED',
          roomId: sessionId,
          certificate,
          ledgerBlock: block
        });
      }
    }

    // 3. Reset terminal to fresh session
    setTimeout(() => {
      setIsShredding(false);
      initSession();
    }, 1800);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Top Security Banner */}
      <SecurityBadge />

      {/* Main Terminal Stage */}
      {sessionState === 'IDLE' && (
        <div className="flex flex-col items-center justify-center my-6">
          <QRDisplay
            sessionId={sessionId}
            sessionKeyHex={sessionKeyHex}
            shopId={shopId}
            shopName={shopName}
            onRefreshSession={initSession}
            onOpenCustomerView={onOpenCustomerView}
          />
        </div>
      )}

      {/* In-Memory Receiving Progress */}
      {sessionState === 'RECEIVING' && (
        <div className="glass-panel-glow p-8 rounded-2xl max-w-lg mx-auto text-center my-12 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Streaming Encrypted Document...</h3>
          <p className="text-xs text-slate-300 font-mono mb-6">
            Piping AES-256 chunks directly into RAM buffers ({streamProgress}% complete)
          </p>

          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
              style={{ width: `${streamProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Document Loaded into Sandboxed DRM Workspace */}
      {(sessionState === 'VIEWING' || sessionState === 'PRINTING') && documentBuffer && (
        <div className="space-y-4">
          {/* Print Status & Shred Toolbar */}
          <SafePrintEngine
            filename={docMeta?.filename || 'Document'}
            totalPages={totalPages}
            copies={copies}
            isPrinting={sessionState === 'PRINTING'}
            printCompleted={printCompleted}
            onExecutePrint={handleExecutePrint}
            onManualShred={handleShred}
          />

          {/* Auto-Destruct Countdown Timer */}
          {printCompleted && (
            <ShredAnimation
              countdownSeconds={autoDestructSeconds}
              onShredTriggered={handleShred}
              isShredding={isShredding}
            />
          )}

          {/* Document In-Memory Editor Toolbar */}
          <DocEditor
            currentPage={currentPage}
            totalPages={totalPages}
            rotation={rotation}
            filterMode={filterMode}
            zoomLevel={zoomLevel}
            copies={copies}
            maxAllowedCopies={maxAllowedCopies}
            onPageChange={setCurrentPage}
            onRotate={() => setRotation((prev) => (prev + 90) % 360)}
            onFilterChange={setFilterMode}
            onZoomChange={(delta) => setZoomLevel((prev) => Math.min(2.5, Math.max(0.6, prev + delta)))}
            onResetZoom={() => setZoomLevel(1.0)}
            onCopiesChange={setCopies}
          />

          {/* Sandboxed DRM Canvas Container */}
          <DRMCanvasViewer
            documentBuffer={documentBuffer}
            fileType={docMeta?.fileType || 'application/pdf'}
            filename={docMeta?.filename || 'Document.pdf'}
            shopId={shopId}
            sessionId={sessionId}
            rotation={rotation}
            filterMode={filterMode}
            zoomLevel={zoomLevel}
            currentPage={currentPage}
            onPageCountLoaded={setTotalPages}
            onSafePrintTrigger={handleExecutePrint}
          />
        </div>
      )}
    </div>
  );
};
