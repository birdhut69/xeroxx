import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Search,
  Users,
  FileText,
  Printer,
  Flame,
  Clock,
  Shield,
  RotateCw,
  ChevronRight,
  X,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  FileCheck,
  Sparkles,
  Layers,
  Award
} from 'lucide-react';
import {
  generateSessionKey,
  exportKeyToHash,
  generateRandomSessionId,
  decryptDocument,
} from '../../crypto/e2ee';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { EphemeralLedger } from '../../crypto/ledger';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';
import { DRMCanvasViewer } from './DRMCanvasViewer';
import { DocEditor } from './DocEditor';
import { QRCodeSVG } from 'qrcode.react';

interface QueuedDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  docHash?: string;
  pageCount?: number;
  watermarkText?: string;
  maxCopies?: number;
  decryptedBuffer: ArrayBuffer | null;
  status: 'STREAMING' | 'READY' | 'PRINTING' | 'PRINTED' | 'SHREDDED';
  receivedAt: number;
  copies: number;
}

interface QueuedCustomer {
  customerId: string;
  customerName: string;
  joinedAt: number;
  lastActive: number;
  documents: QueuedDocument[];
  status: 'WAITING' | 'ACTIVE' | 'PRINTED' | 'COMPLETED';
}

type FilterMode = 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST';

export const TerminalDashboard: React.FC = () => {
  const toast = useToast();

  // Session & Cryptography
  const [sessionId, setSessionId] = useState('');
  const [sessionKeyHex, setSessionKeyHex] = useState('');
  const [shopId] = useState(() => `XEROX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [shopName] = useState('SafePrint Express Terminal');

  // Customer Queue State
  const [customers, setCustomers] = useState<Map<string, QueuedCustomer>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'PRINTED'>('ALL');
  const [copiedQR, setCopiedQR] = useState(false);

  // Editor State for currently viewed document
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isShredding, setIsShredding] = useState(false);

  // Refs
  const ledgerRef = useRef<EphemeralLedger | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const chunkBuffersRef = useRef<Map<string, Uint8Array[]>>(new Map());
  const incomingMetasRef = useRef<Map<string, { meta: any; iv: Uint8Array }>>(new Map());
  const sessionIdRef = useRef('');

  // Pairing URL for QR Code
  const customerUrl = sessionId
    ? `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`
    : '';

  // Initialize Terminal Master Session
  const initTerminal = useCallback(async () => {
    for (const cust of customers.values()) {
      for (const doc of cust.documents) {
        if (doc.decryptedBuffer) zeroizeBuffer(doc.decryptedBuffer);
      }
    }

    const newSessionId = generateRandomSessionId();
    const newKey = await generateSessionKey();
    const newKeyHex = await exportKeyToHash(newKey);

    sessionKeyRef.current = newKey;
    sessionIdRef.current = newSessionId;

    setSessionId(newSessionId);
    setSessionKeyHex(newKeyHex);
    setCustomers(new Map());
    setSelectedCustomerId(null);
    setSelectedDocId(null);
    chunkBuffersRef.current.clear();
    incomingMetasRef.current.clear();

    const ledger = new EphemeralLedger(newSessionId, shopId, shopName);
    await ledger.initGenesis();
    ledgerRef.current = ledger;

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
      onCustomerConnected: (data) => {
        sounds.playConnect();
        setCustomers((prev) => {
          const next = new Map(prev);
          if (!next.has(data.customerId)) {
            next.set(data.customerId, {
              customerId: data.customerId,
              customerName: data.customerName || `Customer #${next.size + 1}`,
              joinedAt: data.timestamp || Date.now(),
              lastActive: Date.now(),
              documents: [],
              status: 'WAITING',
            });
          }
          return next;
        });
        toast.info('Customer Connected', `${data.customerName || 'A customer'} joined the queue.`);
      },
      onCustomerLeft: (data) => {
        setCustomers((prev) => {
          const next = new Map(prev);
          const cust = next.get(data.customerId);
          if (cust && cust.documents.length === 0) {
            next.delete(data.customerId);
          }
          return next;
        });
      },
      onDocMeta: (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const docId = `DOC-${Math.random().toString(36).substring(2, 8)}`;

        incomingMetasRef.current.set(custId, {
          meta: { ...msg.metadata, docId },
          iv: new Uint8Array(msg.iv),
        });
        chunkBuffersRef.current.set(custId, []);

        setCustomers((prev) => {
          const next = new Map(prev);
          let cust = next.get(custId);
          if (!cust) {
            cust = {
              customerId: custId,
              customerName: msg.customerName || `Customer #${next.size + 1}`,
              joinedAt: Date.now(),
              lastActive: Date.now(),
              documents: [],
              status: 'ACTIVE',
            };
            next.set(custId, cust);
          }
          cust.status = 'ACTIVE';
          cust.lastActive = Date.now();
          cust.documents.push({
            id: docId,
            filename: msg.metadata?.filename || 'Document',
            fileType: msg.metadata?.fileType || 'application/pdf',
            fileSize: msg.metadata?.fileSize || 0,
            docHash: msg.metadata?.docHash,
            watermarkText: msg.metadata?.watermarkText,
            maxCopies: msg.metadata?.maxCopies || 5,
            decryptedBuffer: null,
            status: 'STREAMING',
            receivedAt: Date.now(),
            copies: 1,
          });
          return next;
        });

        setSelectedCustomerId((prev) => prev || custId);
        setSelectedDocId((prev) => prev || docId);
        toast.info('Receiving Document', `Streaming "${msg.metadata?.filename}"...`);
      },
      onDocChunk: (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const chunks = chunkBuffersRef.current.get(custId) || [];
        try {
          const binary = atob(msg.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          chunks.push(bytes);
          chunkBuffersRef.current.set(custId, chunks);
        } catch (err) {
          console.error('[SafePrint] Chunk error:', err);
        }
      },
      onDocComplete: async (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const incoming = incomingMetasRef.current.get(custId);
        const chunks = chunkBuffersRef.current.get(custId) || [];
        const currentKey = sessionKeyRef.current;

        if (!incoming || !currentKey || chunks.length === 0) return;

        try {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combinedCiphertext = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            combinedCiphertext.set(c, offset);
            offset += c.length;
          }
          chunkBuffersRef.current.delete(custId);

          const plaintextBuffer = await decryptDocument(
            combinedCiphertext.buffer as ArrayBuffer,
            incoming.iv,
            currentKey
          );

          sounds.playEncrypt();

          setCustomers((prev) => {
            const next = new Map(prev);
            const cust = next.get(custId);
            if (cust) {
              const doc = cust.documents.find((d) => d.id === incoming.meta.docId) || cust.documents[cust.documents.length - 1];
              if (doc) {
                doc.decryptedBuffer = plaintextBuffer;
                doc.status = 'READY';
              }
              cust.lastActive = Date.now();
            }
            return next;
          });

          if (ledgerRef.current && incoming.meta) {
            await ledgerRef.current.recordIngest(
              incoming.meta.docHash || 'UNKNOWN',
              incoming.meta.filename || 'Document',
              1,
              incoming.meta.watermarkText
            );
          }

          toast.success('Document Ingested in RAM', `"${incoming.meta.filename}" ready to print.`);
        } catch (err) {
          console.error('[SafePrint] Decryption failed:', err);
          toast.error('Decryption Error', 'Failed to decrypt incoming document.');
        }
      },
    });
  }, [shopId, shopName, customers, toast]);

  useEffect(() => {
    initTerminal();
    return () => {
      relayRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCustomer = selectedCustomerId ? customers.get(selectedCustomerId) : null;
  const selectedDoc = selectedCustomer?.documents.find((d) => d.id === selectedDocId) || selectedCustomer?.documents[0] || null;

  // Print execution
  const handlePrint = useCallback(async () => {
    if (!selectedCustomer || !selectedDoc || !selectedDoc.decryptedBuffer) return;

    setIsPrinting(true);
    sounds.playPrint();

    const custId = selectedCustomer.customerId;

    relayRef.current?.send({
      type: 'PRINT_STATUS_UPDATE',
      roomId: sessionIdRef.current,
      customerId: custId,
      status: 'PRINTING',
      pagesPrinted: totalPages,
      copies,
    });

    setTimeout(() => {
      window.print();
      setIsPrinting(false);

      setCustomers((prev) => {
        const next = new Map(prev);
        const cust = next.get(custId);
        if (cust) {
          const doc = cust.documents.find((d) => d.id === selectedDoc.id);
          if (doc) doc.status = 'PRINTED';
          cust.status = cust.documents.every((d) => d.status === 'PRINTED' || d.status === 'SHREDDED') ? 'PRINTED' : cust.status;
        }
        return next;
      });

      ledgerRef.current?.recordPrint(totalPages, copies);

      relayRef.current?.send({
        type: 'PRINT_STATUS_UPDATE',
        roomId: sessionIdRef.current,
        customerId: custId,
        status: 'PRINT_COMPLETED',
        pagesPrinted: totalPages,
        copies,
      });

      toast.success('Print Dispatched', `${totalPages} page(s) × ${copies} copies sent to printer.`);
    }, 300);
  }, [selectedCustomer, selectedDoc, totalPages, copies, toast]);

  // Shred customer
  const handleShredCustomer = useCallback(async (custId: string) => {
    setIsShredding(true);
    sounds.playShred();

    const cust = customers.get(custId);
    if (cust) {
      for (const doc of cust.documents) {
        if (doc.decryptedBuffer) {
          zeroizeBuffer(doc.decryptedBuffer);
          doc.decryptedBuffer = null;
          doc.status = 'SHREDDED';
        }
      }
    }

    const zeroizeNonce = crypto.getRandomValues(new Uint8Array(8)).join('');
    if (ledgerRef.current) {
      const { block, certificate } = await ledgerRef.current.recordShred(zeroizeNonce);

      relayRef.current?.send({
        type: 'SHRED_CONFIRMED',
        roomId: sessionIdRef.current,
        customerId: custId,
        certificate,
        ledgerBlock: block,
      });
    }

    setCustomers((prev) => {
      const next = new Map(prev);
      const target = next.get(custId);
      if (target) target.status = 'COMPLETED';
      return next;
    });

    toast.shield('RAM Buffers Zeroized', 'Cryptographic shred confirmed.');
    setIsShredding(false);
  }, [customers, toast]);

  const handleCopyLink = () => {
    if (!customerUrl) return;
    navigator.clipboard.writeText(customerUrl);
    setCopiedQR(true);
    sounds.playSuccess();
    toast.success('Link Copied', 'Mobile URL copied to clipboard.');
    setTimeout(() => setCopiedQR(false), 2000);
  };

  const customerList = Array.from(customers.values())
    .filter((c) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = c.customerName.toLowerCase().includes(query);
        const matchesDoc = c.documents.some((d) => d.filename.toLowerCase().includes(query));
        if (!matchesName && !matchesDoc) return false;
      }
      if (filterTab === 'PENDING') return c.documents.some((d) => d.status === 'READY' || d.status === 'STREAMING');
      if (filterTab === 'PRINTED') return c.status === 'PRINTED' || c.status === 'COMPLETED';
      return true;
    })
    .sort((a, b) => b.lastActive - a.lastActive);

  return (
    <div className="max-w-[1720px] mx-auto px-2 sm:px-4 py-3 sm:py-4">
      {/* ── 3-COLUMN RESPONSIVE LAYOUT (Always-On Counter QR + Live Queue + DRM Workspace) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* ── COL 1: ALWAYS-ON COUNTER QR STATION (3 Cols on Desktop) ── */}
        <div className="lg:col-span-3 space-y-3 no-print">
          <div className="wa-panel p-4 sm:p-5 rounded-2xl text-center space-y-3 border-2 border-[#00a884]/30 shadow-md">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d9fdd3] text-[#008069] text-xs font-bold font-mono">
              <span className="w-2 h-2 rounded-full bg-[#25d366] animate-pulse" />
              <span>SHOP COUNTER QR LIVE</span>
            </div>

            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-[#111b21]">Scan to Send Files</h3>
              <p className="text-[11px] text-[#667781] leading-tight">
                Customers scan this QR code to beam documents into your queue.
              </p>
            </div>

            {/* Always-On QR Code Frame */}
            <div className="p-3.5 bg-white rounded-2xl border-2 border-[#00a884]/50 shadow-lg inline-block mx-auto">
              <QRCodeSVG
                value={customerUrl}
                size={185}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008069' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            </div>

            {/* Quick Action Buttons for Counter Display */}
            <div className="space-y-2 pt-1">
              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-3 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-[#d1d7db]"
              >
                {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                <span>{copiedQR ? 'Link Copied!' : 'Copy Pairing Link'}</span>
              </button>

              <button
                onClick={() => window.open(customerUrl, '_blank')}
                className="w-full py-2 px-3 rounded-xl bg-[#00a884]/15 hover:bg-[#00a884]/25 text-[#008069] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#00a884]/30"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Mobile Test Tab</span>
              </button>
            </div>

            {/* Station Status Info Card */}
            <div className="bg-[#f0f2f5] p-3 rounded-xl text-left font-mono text-[11px] space-y-1 border border-[#e9edef]">
              <div className="flex justify-between text-[#667781]">
                <span>Terminal ID:</span>
                <span className="font-bold text-[#111b21]">{shopId}</span>
              </div>
              <div className="flex justify-between text-[#667781]">
                <span>Queue Count:</span>
                <span className="font-bold text-[#008069]">{customers.size} Customer(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── COL 2 & 3: WHATSAPP WEB LIVE QUEUE & DRM WORKSPACE (9 Cols on Desktop) ── */}
        <div className="lg:col-span-9">
          <div className="wa-panel-elevated rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[calc(100vh-140px)] border border-[#d1d7db]">
            {/* ── MIDDLE SIDEBAR: Customer Queue List (5 Cols) ── */}
            <div className="md:col-span-5 bg-white border-r border-[#e9edef] flex flex-col no-print">
              {/* Queue Header */}
              <div className="bg-[#f0f2f5] p-3 sm:p-3.5 flex items-center justify-between border-b border-[#e9edef]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#008069] text-white flex items-center justify-center text-xs font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs sm:text-sm font-bold text-[#111b21]">Live Customer Queue</div>
                    <div className="text-[10px] text-[#667781] font-mono">{customers.size} connected in real-time</div>
                  </div>
                </div>

                <button
                  onClick={initTerminal}
                  className="p-1.5 rounded-lg hover:bg-[#e9edef] text-[#54656f] transition-colors"
                  title="Reset Terminal Session"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              {/* Search & Tabs */}
              <div className="p-2.5 bg-white border-b border-[#e9edef] space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#667781]" />
                  <input
                    type="text"
                    placeholder="Search by customer name or document..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f0f2f5] border-none rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00a884] text-[#111b21] placeholder-[#667781]"
                  />
                </div>

                <div className="flex items-center gap-1 text-xs">
                  <button
                    onClick={() => setFilterTab('ALL')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      filterTab === 'ALL'
                        ? 'bg-[#00a884] text-white shadow-sm'
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                    }`}
                  >
                    All ({customers.size})
                  </button>
                  <button
                    onClick={() => setFilterTab('PENDING')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      filterTab === 'PENDING'
                        ? 'bg-[#00a884] text-white shadow-sm'
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                    }`}
                  >
                    Waiting Print
                  </button>
                  <button
                    onClick={() => setFilterTab('PRINTED')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      filterTab === 'PRINTED'
                        ? 'bg-[#00a884] text-white shadow-sm'
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Customer Queue List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
                {customerList.length === 0 ? (
                  <div className="p-8 text-center text-[#667781] space-y-2">
                    <div className="w-10 h-10 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto text-[#00a884]">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-[#111b21]">Queue is Empty</div>
                    <p className="text-[11px] leading-relaxed">
                      Customers at your shop counter scan the QR code on the left to appear here.
                    </p>
                  </div>
                ) : (
                  customerList.map((cust, idx) => {
                    const isSelected = cust.customerId === selectedCustomerId;
                    const readyDocs = cust.documents.filter((d) => d.status === 'READY');
                    const lastDoc = cust.documents[cust.documents.length - 1];

                    return (
                      <div
                        key={cust.customerId}
                        onClick={() => {
                          setSelectedCustomerId(cust.customerId);
                          if (cust.documents.length > 0) {
                            setSelectedDocId(cust.documents[0].id);
                          }
                        }}
                        className={`p-3 flex items-center gap-3 cursor-pointer transition-colors text-left ${
                          isSelected
                            ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                            : 'hover:bg-[#f5f6f6]'
                        }`}
                      >
                        {/* Queue Position Pill & Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-full bg-[#dfe5e7] text-[#54656f] font-bold flex items-center justify-center text-xs shadow-inner">
                            #{idx + 1}
                          </div>
                          <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                              readyDocs.length > 0 ? 'bg-[#25d366]' : 'bg-[#8696a0]'
                            }`}
                          />
                        </div>

                        {/* Customer Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs sm:text-sm font-bold text-[#111b21] truncate">
                              {cust.customerName}
                            </span>
                            <span className="text-[10px] text-[#667781] font-mono">
                              {new Date(cust.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-0.5">
                            <div className="text-[11px] text-[#667781] truncate flex items-center gap-1 max-w-[160px]">
                              {lastDoc ? (
                                <>
                                  <FileText className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                                  <span className="truncate">{lastDoc.filename}</span>
                                </>
                              ) : (
                                <span className="italic">Connected • Selecting file</span>
                              )}
                            </div>

                            {readyDocs.length > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] text-[10px] font-bold border border-[#00a884]/30 flex items-center gap-0.5 shrink-0">
                                <Check className="w-3 h-3" />
                                <span>{readyDocs.length} Ready</span>
                              </span>
                            ) : cust.status === 'PRINTED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#e7f8ff] text-[#0284c7] text-[10px] font-bold shrink-0">
                                Printed
                              </span>
                            ) : cust.status === 'COMPLETED' ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626] text-[10px] font-bold shrink-0">
                                Shredded
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT MAIN WORKSPACE: Sandboxed DRM Document Viewer & Print Actions (7 Cols) ── */}
            <div className="md:col-span-7 flex flex-col bg-white">
              {!selectedCustomer ? (
                /* Default Splash */
                <div className="flex-1 wa-chat-wallpaper flex flex-col items-center justify-center p-6 text-center">
                  <div className="max-w-md p-6 sm:p-8 bg-white/95 rounded-2xl shadow-lg border border-[#d1d7db] space-y-3">
                    <div className="w-14 h-14 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto">
                      <Shield className="w-7 h-7" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-[#111b21]">SafePrint Shop Terminal</h3>
                    <p className="text-xs text-[#667781] leading-relaxed">
                      Select any customer from the queue to decrypt their document directly in RAM and dispatch prints.
                    </p>
                    <div className="text-[11px] text-[#667781] font-mono flex items-center justify-center gap-1 pt-1">
                      <span className="w-2 h-2 rounded-full bg-[#25d366]" />
                      <span>Zero Disk Writes • 100% Ephemeral</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Active Customer Workspace */
                <div className="flex-1 flex flex-col min-h-0 bg-[#f0f2f5]">
                  {/* Workspace Header */}
                  <div className="bg-[#f0f2f5] px-4 py-3 border-b border-[#e9edef] flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2.5 text-left">
                      <div className="w-9 h-9 rounded-full bg-[#008069] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                        {selectedCustomer.customerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-[#111b21] flex items-center gap-1.5">
                          <span>{selectedCustomer.customerName}</span>
                          <span className="text-[10px] font-mono text-[#667781]">({selectedCustomer.customerId})</span>
                        </div>
                        <div className="text-[10px] text-[#008069] font-medium">
                          {selectedCustomer.documents.length} File(s) • Staged in RAM
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleShredCustomer(selectedCustomer.customerId)}
                      disabled={isShredding}
                      className="btn-wa-danger px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                      title="Wipe RAM for this customer"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Shred Customer</span>
                    </button>
                  </div>

                  {/* Multi-document tabs */}
                  {selectedCustomer.documents.length > 1 && (
                    <div className="bg-white px-3 py-1.5 border-b border-[#e9edef] flex items-center gap-1.5 overflow-x-auto">
                      <span className="text-xs text-[#667781] font-semibold shrink-0">Files:</span>
                      {selectedCustomer.documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shrink-0 ${
                            selectedDoc?.id === doc.id
                              ? 'bg-[#00a884] text-white shadow-sm'
                              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>{doc.filename}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Workspace Canvas & Print Controls */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 text-left">
                    {!selectedDoc || !selectedDoc.decryptedBuffer ? (
                      <div className="wa-panel p-8 rounded-2xl text-center max-w-sm mx-auto my-8 space-y-2">
                        <Clock className="w-8 h-8 text-[#0284c7] mx-auto animate-pulse" />
                        <div className="text-xs font-bold text-[#111b21]">Streaming Encrypted Payload...</div>
                        <p className="text-[11px] text-[#667781]">Piping AES-256 chunks into RAM buffer.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Print Engine Toolbar */}
                        <div className="wa-panel p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-[#d9fdd3] text-[#008069]">
                              <FileCheck className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="text-xs sm:text-sm font-bold text-[#111b21] truncate max-w-[200px]" title={selectedDoc.filename}>
                                {selectedDoc.filename}
                              </div>
                              <div className="text-[10px] text-[#667781] font-mono">
                                {totalPages} Page(s) • {(selectedDoc.fileSize / 1024).toFixed(1)} KB • In RAM
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={handlePrint}
                              disabled={isPrinting}
                              className="btn-wa-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#00a884]/20"
                            >
                              <Printer className="w-4 h-4" />
                              <span>{isPrinting ? 'Printing...' : 'Print This'}</span>
                            </button>

                            <button
                              onClick={async () => {
                                await handlePrint();
                                const list = Array.from(customers.values());
                                const currentIndex = list.findIndex((c) => c.customerId === selectedCustomerId);
                                const nextCust = list.find((c, idx) => idx !== currentIndex && c.documents.some((d) => d.status === 'READY'));
                                if (nextCust) {
                                  setSelectedCustomerId(nextCust.customerId);
                                  if (nextCust.documents.length > 0) {
                                    setSelectedDocId(nextCust.documents[0].id);
                                  }
                                  toast.info('Next Customer', `Viewing ${nextCust.customerName}`);
                                }
                              }}
                              disabled={isPrinting}
                              className="px-4 py-2 rounded-xl bg-[#008069] hover:bg-[#00705b] text-white text-xs font-bold flex items-center gap-1 shadow-md"
                              title="Print and switch immediately to next customer"
                            >
                              <ChevronRight className="w-4 h-4" />
                              <span>Print & Next</span>
                            </button>
                          </div>
                        </div>

                        {/* Document Filter & Rotation Toolbar */}
                        <DocEditor
                          currentPage={currentPage}
                          totalPages={totalPages}
                          rotation={rotation}
                          filterMode={filterMode}
                          zoomLevel={zoomLevel}
                          copies={copies}
                          maxAllowedCopies={selectedDoc.maxCopies || 5}
                          onPageChange={setCurrentPage}
                          onRotate={() => setRotation((prev) => (prev + 90) % 360)}
                          onFilterChange={setFilterMode}
                          onZoomChange={(delta) => setZoomLevel((prev) => Math.min(2.5, Math.max(0.5, prev + delta)))}
                          onResetZoom={() => setZoomLevel(1.0)}
                          onCopiesChange={setCopies}
                        />

                        {/* DRM Sandboxed Canvas Viewer */}
                        <DRMCanvasViewer
                          documentBuffer={selectedDoc.decryptedBuffer}
                          fileType={selectedDoc.fileType}
                          filename={selectedDoc.filename}
                          shopId={shopId}
                          sessionId={sessionId}
                          rotation={rotation}
                          filterMode={filterMode}
                          zoomLevel={zoomLevel}
                          currentPage={currentPage}
                          onPageCountLoaded={setTotalPages}
                          onSafePrintTrigger={handlePrint}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
