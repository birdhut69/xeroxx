import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Lock, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import {
  generateSessionKey,
  exportKeyToHash,
  generateRandomSessionId,
  decryptDocument,
} from '../../crypto/e2ee';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { EphemeralLedger, type DestructionCertificate } from '../../crypto/ledger';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';
import { QRDisplay } from './QRDisplay';
import { DRMCanvasViewer } from './DRMCanvasViewer';
import { DocEditor } from './DocEditor';
import { SafePrintEngine } from './SafePrintEngine';
import { ShredAnimation } from './ShredAnimation';
import { SecurityBadge } from '../shared/SecurityBadge';

interface TerminalDashboardProps {
  onOpenCustomerView?: (url: string) => void;
}

interface DocMetadata {
  filename: string;
  fileType: string;
  fileSize: number;
  docHash?: string;
  pageCount?: number;
  watermarkText?: string;
  maxCopies?: number;
}

type SessionState = 'IDLE' | 'RECEIVING' | 'VIEWING' | 'PRINTING' | 'SHREDDING';
type FilterMode = 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST';

export const TerminalDashboard: React.FC<TerminalDashboardProps> = ({ onOpenCustomerView }) => {
  const toast = useToast();

  // Session Identity & Cryptography
  const [sessionId, setSessionId] = useState('');
  const [sessionKeyHex, setSessionKeyHex] = useState('');
  const [shopId] = useState(() => `XEROX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [shopName] = useState('SafePrint Terminal');

  // Connection & Document State
  const [connectedUser, setConnectedUser] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('IDLE');
  const [streamProgress, setStreamProgress] = useState(0);
  const [documentBuffer, setDocumentBuffer] = useState<ArrayBuffer | null>(null);
  const [docMeta, setDocMeta] = useState<DocMetadata | null>(null);

  // Editor State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [copies, setCopies] = useState(1);
  const [maxAllowedCopies, setMaxAllowedCopies] = useState(5);

  // Print & Shred Lifecycle
  const [printCompleted, setPrintCompleted] = useState(false);
  const [isShredding, setIsShredding] = useState(false);

  // Refs for stable callback access
  const ledgerRef = useRef<EphemeralLedger | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const chunkBufferRef = useRef<Uint8Array[]>([]);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const ivRef = useRef<Uint8Array | null>(null);
  const docMetaRef = useRef<DocMetadata | null>(null);
  const sessionIdRef = useRef('');

  // Keep refs in sync with state
  useEffect(() => { docMetaRef.current = docMeta; }, [docMeta]);

  // Initialize or Reset Session
  const initSession = useCallback(async () => {
    // 1. Zeroize any previous buffer
    if (documentBuffer) {
      zeroizeBuffer(documentBuffer);
    }

    const newSessionId = generateRandomSessionId();
    const newKey = await generateSessionKey();
    const newKeyHex = await exportKeyToHash(newKey);

    sessionKeyRef.current = newKey;
    ivRef.current = null;
    sessionIdRef.current = newSessionId;

    setSessionId(newSessionId);
    setSessionKeyHex(newKeyHex);
    setConnectedUser(false);
    setSessionState('IDLE');
    setDocumentBuffer(null);
    setDocMeta(null);
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

    await relay.connect({
      onOpen: () => {
        relay.send({
          type: 'INIT_TERMINAL',
          roomId: newSessionId,
          shopId,
          shopName,
        });
      },
      onCustomerConnected: () => {
        setConnectedUser(true);
        sounds.playConnect();
        toast.shield('Customer Connected', 'A mobile device has paired to this terminal securely.');
      },
      onDocMeta: (msg) => {
        const meta: DocMetadata = {
          filename: msg.metadata?.filename || 'Document',
          fileType: msg.metadata?.fileType || 'application/octet-stream',
          fileSize: msg.metadata?.fileSize || 0,
          docHash: msg.metadata?.docHash,
          pageCount: msg.metadata?.pageCount,
          watermarkText: msg.metadata?.watermarkText,
          maxCopies: msg.metadata?.maxCopies,
        };
        setDocMeta(meta);
        docMetaRef.current = meta;
        ivRef.current = new Uint8Array(msg.iv);
        if (meta.maxCopies) {
          setMaxAllowedCopies(meta.maxCopies);
        }
        chunkBufferRef.current = [];
        setSessionState('RECEIVING');
        setStreamProgress(0);
        toast.info('Incoming Document', `Receiving encrypted "${meta.filename}"...`);
      },
      onDocChunk: (msg) => {
        try {
          const binary = atob(msg.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          chunkBufferRef.current.push(bytes);
          setStreamProgress(Math.round(((msg.chunkIndex + 1) / msg.totalChunks) * 100));
        } catch (err) {
          console.error('[SafePrint] Chunk decode error:', err);
        }
      },
      onDocComplete: async () => {
        // Read key and IV from refs (not stale closure)
        const currentKey = sessionKeyRef.current;
        const currentIv = ivRef.current;
        const currentMeta = docMetaRef.current;

        if (!currentKey || !currentIv) {
          toast.error('Decryption Failed', 'Missing encryption key or IV. Ask customer to re-scan QR.');
          setSessionState('IDLE');
          return;
        }

        try {
          // Combine all chunks in RAM
          const totalLength = chunkBufferRef.current.reduce((acc, c) => acc + c.length, 0);
          const combinedCiphertext = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunkBufferRef.current) {
            combinedCiphertext.set(chunk, offset);
            offset += chunk.length;
          }
          chunkBufferRef.current = [];

          // Decrypt strictly into RAM ArrayBuffer
          const plaintextBuffer = await decryptDocument(
            combinedCiphertext.buffer as ArrayBuffer,
            currentIv,
            currentKey
          );
          setDocumentBuffer(plaintextBuffer);
          setSessionState('VIEWING');
          sounds.playEncrypt();
          toast.success('Document Decrypted', `"${currentMeta?.filename}" loaded into secure DRM canvas.`);

          // Record Ingest Block on Ledger
          if (ledgerRef.current && currentMeta) {
            await ledgerRef.current.recordIngest(
              currentMeta.docHash || 'UNKNOWN',
              currentMeta.filename,
              currentMeta.pageCount || 1,
              currentMeta.watermarkText
            );
          }
        } catch (err) {
          console.error('[SafePrint Terminal] Decryption error:', err);
          toast.error('Decryption Failed', 'Document integrity check failed or key mismatch. Ask customer to re-send.');
          setSessionState('IDLE');
        }
      },
    });
  }, [shopId, shopName, toast]);

  useEffect(() => {
    initSession();
    return () => {
      if (relayRef.current) {
        relayRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Safe Print Pipeline
  const handleExecutePrint = useCallback(async () => {
    setSessionState('PRINTING');
    sounds.playPrint();

    const currentSessionId = sessionIdRef.current;

    // Inform customer
    if (relayRef.current && currentSessionId) {
      relayRef.current.send({
        type: 'PRINT_STATUS_UPDATE',
        roomId: currentSessionId,
        status: 'PRINTING',
        pagesPrinted: totalPages,
        copies,
      });
    }

    // Invoke browser print after a short delay for state update
    setTimeout(() => {
      window.print();
      setPrintCompleted(true);
      setSessionState('VIEWING');

      // Record Print in Ledger
      if (ledgerRef.current) {
        ledgerRef.current.recordPrint(totalPages, copies);
      }

      if (relayRef.current && currentSessionId) {
        relayRef.current.send({
          type: 'PRINT_STATUS_UPDATE',
          roomId: currentSessionId,
          status: 'PRINT_COMPLETED',
          pagesPrinted: totalPages,
          copies,
        });
      }

      toast.success('Print Dispatched', `${totalPages} page(s) × ${copies} copies sent to printer.`);
    }, 300);
  }, [totalPages, copies, toast]);

  // Handle Memory Zeroization & Ephemeral Shredding
  const handleShred = useCallback(async () => {
    if (isShredding) return;
    setIsShredding(true);
    setSessionState('SHREDDING');
    sounds.playShred();

    const currentSessionId = sessionIdRef.current;

    // 1. RAM Zeroization
    if (documentBuffer) {
      zeroizeBuffer(documentBuffer);
      setDocumentBuffer(null);
    }

    // 2. Commit Final Shred Block to Ledger
    const zeroizeNonce = crypto.getRandomValues(new Uint8Array(8)).join('');
    if (ledgerRef.current) {
      const { block, certificate } = await ledgerRef.current.recordShred(zeroizeNonce);

      // Send verifiable certificate back to customer
      if (relayRef.current && currentSessionId) {
        relayRef.current.send({
          type: 'SHRED_CONFIRMED',
          roomId: currentSessionId,
          certificate,
          ledgerBlock: block,
        });
      }
    }

    toast.shield('Memory Shredded', 'All document buffers overwritten with cryptographic noise and zeroed.');

    // 3. Reset terminal to fresh session after visual feedback
    setTimeout(() => {
      setIsShredding(false);
      initSession();
    }, 2000);
  }, [documentBuffer, isShredding, initSession, toast]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 text-left">
      {/* Top Security Banner */}
      <SecurityBadge />

      {/* Connection Status Bar */}
      {connectedUser && sessionState === 'IDLE' && (
        <div className="glass-panel p-3 rounded-2xl border border-emerald-500/30 flex items-center gap-3 mb-4">
          <Wifi className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
          <span className="text-xs font-bold text-emerald-300">Customer connected and ready to send documents.</span>
        </div>
      )}

      {/* Main Terminal Stage — QR Display */}
      {sessionState === 'IDLE' && (
        <div className="flex flex-col items-center justify-center my-4 sm:my-6">
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
        <div className="glass-panel-glow p-6 sm:p-8 rounded-3xl max-w-lg mx-auto text-center my-8 sm:my-12">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 animate-bounce" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Streaming Encrypted Document...</h3>
          <p className="text-xs text-slate-300 font-mono mb-6">
            Piping AES-256-GCM chunks directly into RAM ({streamProgress}%)
          </p>
          <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-200"
              style={{ width: `${streamProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Document Loaded — Secure Workspace */}
      {(sessionState === 'VIEWING' || sessionState === 'PRINTING') && documentBuffer && (
        <div className="space-y-4">
          <SafePrintEngine
            filename={docMeta?.filename || 'Document'}
            totalPages={totalPages}
            copies={copies}
            isPrinting={sessionState === 'PRINTING'}
            printCompleted={printCompleted}
            onExecutePrint={handleExecutePrint}
            onManualShred={handleShred}
          />

          {printCompleted && (
            <ShredAnimation
              countdownSeconds={60}
              onShredTriggered={handleShred}
              isShredding={isShredding}
            />
          )}

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
            onZoomChange={(delta) => setZoomLevel((prev) => Math.min(2.5, Math.max(0.5, prev + delta)))}
            onResetZoom={() => setZoomLevel(1.0)}
            onCopiesChange={setCopies}
          />

          <DRMCanvasViewer
            documentBuffer={documentBuffer}
            fileType={docMeta?.fileType || 'application/pdf'}
            filename={docMeta?.filename || 'Document'}
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

      {/* Shredding in Progress */}
      {sessionState === 'SHREDDING' && (
        <div className="glass-panel-danger p-8 rounded-3xl max-w-lg mx-auto text-center my-12">
          <div className="w-16 h-16 rounded-full bg-rose-500/30 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto mb-4 animate-spin">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Zeroizing Memory...</h3>
          <p className="text-xs text-slate-300 font-mono">
            Overwriting document buffers with cryptographic noise and zeros.
          </p>
        </div>
      )}
    </div>
  );
};
