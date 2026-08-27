import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode,
  Search,
  Users,
  FileText,
  Printer,
  Flame,
  CheckCircle2,
  Clock,
  Shield,
  RotateCw,
  Sparkles,
  ChevronRight,
  Eye,
  X,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Layers,
  FileCheck
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
import { SafePrintEngine } from './SafePrintEngine';
import { ShredAnimation } from './ShredAnimation';
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

  // QR Modal State
  const [showQRModal, setShowQRModal] = useState(false);
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

  // Pairing URL for QR
  const customerUrl = sessionId
    ? `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`
    : '';

  // Initialize Terminal Master Session
  const initTerminal = useCallback(async () => {
    // Zeroize all existing buffers
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
        toast.info('New Customer Connected', `${data.customerName || 'A customer'} joined the queue.`);
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

        // Auto select if none selected
        setSelectedCustomerId((prev) => prev || custId);
        setSelectedDocId((prev) => prev || docId);
        toast.info('Incoming Document', `Receiving "${msg.metadata?.filename}"...`);
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
          console.error('[SafePrint] Chunk decode error:', err);
        }
      },
      onDocComplete: async (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const incoming = incomingMetasRef.current.get(custId);
        const chunks = chunkBuffersRef.current.get(custId) || [];
        const currentKey = sessionKeyRef.current;

        if (!incoming || !currentKey || chunks.length === 0) {
          console.error('[SafePrint] Missing decryption payload for customer:', custId);
          return;
        }

        try {
          // Reassemble ciphertext in RAM
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combinedCiphertext = new Uint8Array(totalLength);
          let offset = 0;
          for (const c of chunks) {
            combinedCiphertext.set(c, offset);
            offset += c.length;
          }
          chunkBuffersRef.current.delete(custId);

          // Decrypt into RAM
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

          // Log in Merkle ledger
          if (ledgerRef.current && incoming.meta) {
            await ledgerRef.current.recordIngest(
              incoming.meta.docHash || 'UNKNOWN',
              incoming.meta.filename || 'Document',
              1,
              incoming.meta.watermarkText
            );
          }

          toast.success('Document Ready in RAM', `"${incoming.meta.filename}" decrypted & ready to print.`);
        } catch (err) {
          console.error('[SafePrint] Decryption failed:', err);
          toast.error('Decryption Error', 'Failed to decrypt document.');
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

  // Selected customer & document resolution
  const selectedCustomer = selectedCustomerId ? customers.get(selectedCustomerId) : null;
  const selectedDoc = selectedCustomer?.documents.find((d) => d.id === selectedDocId) || selectedCustomer?.documents[0] || null;

  // Print Execution
  const handlePrint = useCallback(async () => {
    if (!selectedCustomer || !selectedDoc || !selectedDoc.decryptedBuffer) return;

    setIsPrinting(true);
    sounds.playPrint();

    const custId = selectedCustomer.customerId;

    // Send print update to this specific customer
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

      // Record in ledger
      ledgerRef.current?.recordPrint(totalPages, copies);

      // Notify customer
      relayRef.current?.send({
        type: 'PRINT_STATUS_UPDATE',
        roomId: sessionIdRef.current,
        customerId: custId,
        status: 'PRINT_COMPLETED',
        pagesPrinted: totalPages,
        copies,
      });

      toast.success('Printed Successfully', `Sent ${totalPages} page(s) × ${copies} copies to physical printer.`);
    }, 300);
  }, [selectedCustomer, selectedDoc, totalPages, copies, toast]);

  // Shred Single Customer / Document
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
      if (target) {
        target.status = 'COMPLETED';
      }
      return next;
    });

    toast.shield('Customer Memory Shredded', 'All document buffers zeroized and Merkle block committed.');
    setIsShredding(false);
  }, [customers, toast]);

  // Copy link
  const handleCopyLink = () => {
    if (!customerUrl) return;
    navigator.clipboard.writeText(customerUrl);
    setCopiedQR(true);
    sounds.playSuccess();
    toast.success('Pairing Link Copied!', 'Share link with customers.');
    setTimeout(() => setCopiedQR(false), 2000);
  };

  // Filtered customer list
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
    <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-3 sm:py-4">
      {/* WhatsApp Web Split Layout Container */}
      <div className="wa-panel-elevated rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[calc(100vh-140px)] border border-[#d1d7db]">
        {/* ── LEFT SIDEBAR: WhatsApp Chat List & Queue (4 Cols) ── */}
        <div className="md:col-span-4 bg-white border-r border-[#e9edef] flex flex-col no-print">
          {/* Sidebar Top Header */}
          <div className="bg-[#f0f2f5] p-3 sm:p-3.5 flex items-center justify-between border-b border-[#e9edef]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-[#00a884] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-[#111b21] flex items-center gap-1.5">
                  <span>{shopName}</span>
                </div>
                <div className="text-[11px] text-[#667781] font-mono flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block" />
                  <span>ID: {shopId}</span>
                </div>
              </div>
            </div>

            {/* Header Actions: QR Button & Refresh */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowQRModal(true)}
                className="btn-wa-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                title="Show Shop QR Code for Customers"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">Show QR</span>
              </button>

              <button
                onClick={initTerminal}
                className="p-2 rounded-lg hover:bg-[#e9edef] text-[#54656f] transition-colors"
                title="Reset Session Keys"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-2.5 bg-white border-b border-[#e9edef] space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#667781]" />
              <input
                type="text"
                placeholder="Search customers or document names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#f0f2f5] border-none rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00a884] text-[#111b21] placeholder-[#667781]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  filterTab === 'ALL'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                All ({customers.size})
              </button>
              <button
                onClick={() => setFilterTab('PENDING')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  filterTab === 'PENDING'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Waiting Print
              </button>
              <button
                onClick={() => setFilterTab('PRINTED')}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  filterTab === 'PRINTED'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Customer Chat List Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
            {customerList.length === 0 ? (
              <div className="p-8 text-center text-[#667781] space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto text-[#00a884]">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-[#111b21]">No Customers in Queue</div>
                <p className="text-xs max-w-xs mx-auto leading-relaxed">
                  Customers scan your shop QR code to appear here in real-time.
                </p>
                <button
                  onClick={() => setShowQRModal(true)}
                  className="btn-wa-primary px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Display QR Code</span>
                </button>
              </div>
            ) : (
              customerList.map((cust) => {
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
                    className={`p-3 sm:p-3.5 flex items-center gap-3 cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    {/* Customer Avatar with Status Dot */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full bg-[#dfe5e7] text-[#54656f] font-bold flex items-center justify-center text-sm shadow-inner">
                        {cust.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                          cust.status === 'ACTIVE' || readyDocs.length > 0
                            ? 'bg-[#25d366]'
                            : cust.status === 'PRINTED'
                            ? 'bg-[#53bdeb]'
                            : 'bg-[#8696a0]'
                        }`}
                      />
                    </div>

                    {/* Customer Info & Message Preview */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#111b21] truncate">
                          {cust.customerName}
                        </span>
                        <span className="text-[10px] text-[#667781] font-mono">
                          {new Date(cust.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <div className="text-xs text-[#667781] truncate flex items-center gap-1 max-w-[180px]">
                          {lastDoc ? (
                            <>
                              <FileText className="w-3.5 h-3.5 text-[#00a884] shrink-0" />
                              <span className="truncate">{lastDoc.filename}</span>
                            </>
                          ) : (
                            <span className="italic">Connected • Selecting file...</span>
                          )}
                        </div>

                        {/* Status Badges */}
                        {readyDocs.length > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] text-[10px] font-bold border border-[#00a884]/30 flex items-center gap-0.5">
                            <Check className="w-3 h-3" />
                            <span>{readyDocs.length} Ready</span>
                          </span>
                        ) : cust.status === 'PRINTED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#e7f8ff] text-[#0284c7] text-[10px] font-bold">
                            Printed
                          </span>
                        ) : cust.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#fef2f2] text-[#dc2626] text-[10px] font-bold">
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

        {/* ── RIGHT MAIN PANE: WhatsApp Style Conversation & DRM Sandbox (8 Cols) ── */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {!selectedCustomer ? (
            /* WhatsApp Web Default Welcome Screen */
            <div className="flex-1 wa-chat-wallpaper flex flex-col items-center justify-center p-6 text-center">
              <div className="max-w-md p-8 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-[#d1d7db] space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#d9fdd3] text-[#00a884] flex items-center justify-center mx-auto shadow-sm">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-bold text-[#111b21]">SafePrint Xerox Terminal</h2>
                <p className="text-xs text-[#667781] leading-relaxed">
                  Zero-Trust E2EE Document Delivery. Select a customer from the left sidebar to preview and print documents directly from RAM.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="btn-wa-primary w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Display Counter QR Code</span>
                  </button>
                </div>
                <div className="text-[11px] text-[#8696a0] font-mono flex items-center justify-center gap-1.5 pt-2">
                  <span className="w-2 h-2 rounded-full bg-[#25d366]" />
                  <span>AES-256 E2EE • RAM Zero-Retention</span>
                </div>
              </div>
            </div>
          ) : (
            /* Selected Customer Active Chat & Print Stage */
            <div className="flex-1 flex flex-col min-h-0 bg-[#f0f2f5]">
              {/* Customer Chat Header */}
              <div className="bg-[#f0f2f5] px-4 py-3 border-b border-[#e9edef] flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full bg-[#00a884] text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    {selectedCustomer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#111b21] flex items-center gap-2">
                      <span>{selectedCustomer.customerName}</span>
                      <span className="text-[10px] font-normal text-[#667781] font-mono">
                        ({selectedCustomer.customerId})
                      </span>
                    </h3>
                    <div className="text-[11px] text-[#667781] flex items-center gap-2">
                      <span>{selectedCustomer.documents.length} document(s) sent</span>
                      <span>•</span>
                      <span className="text-[#00a884] font-medium">Session Active in RAM</span>
                    </div>
                  </div>
                </div>

                {/* Header Actions: Shred Customer Session */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleShredCustomer(selectedCustomer.customerId)}
                    disabled={isShredding}
                    className="btn-wa-danger px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                    title="Zeroize all RAM buffers for this customer and send certificate"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Shred Session</span>
                  </button>
                </div>
              </div>

              {/* Document Tabs (if user sent multiple documents) */}
              {selectedCustomer.documents.length > 1 && (
                <div className="bg-white px-4 py-2 border-b border-[#e9edef] flex items-center gap-2 overflow-x-auto">
                  <span className="text-xs text-[#667781] font-medium shrink-0">Documents:</span>
                  {selectedCustomer.documents.map((doc, idx) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
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

              {/* Chat & Document Workspace Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!selectedDoc || !selectedDoc.decryptedBuffer ? (
                  <div className="wa-panel p-8 rounded-2xl text-center max-w-md mx-auto my-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#e7f8ff] text-[#0284c7] flex items-center justify-center mx-auto animate-pulse">
                      <Clock className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-bold text-[#111b21]">Waiting for Document Stream...</h4>
                    <p className="text-xs text-[#667781]">
                      Customer is selecting or streaming AES-256 encrypted chunks to this terminal.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Safe Print Controls Toolbar */}
                    <div className="wa-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-2.5 rounded-xl bg-[#d9fdd3] text-[#008069]">
                          <FileCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#111b21] flex items-center gap-2">
                            <span className="truncate max-w-[220px]" title={selectedDoc.filename}>
                              {selectedDoc.filename}
                            </span>
                            {selectedDoc.status === 'PRINTED' && (
                              <span className="px-2 py-0.5 rounded-full bg-[#d9fdd3] text-[#008069] text-[10px] font-bold border border-[#00a884]/30">
                                Printed
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#667781] font-mono">
                            {totalPages} Page(s) • {(selectedDoc.fileSize / 1024).toFixed(1)} KB • In RAM
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Print Button */}
                        <button
                          onClick={handlePrint}
                          disabled={isPrinting}
                          className="btn-wa-primary px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-[#00a884]/20"
                        >
                          <Printer className="w-4 h-4" />
                          <span>{isPrinting ? 'Printing...' : 'Print Document'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Document Editor Toolbar */}
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

      {/* ── SHOP QR CODE MODAL ── */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="wa-panel p-6 sm:p-8 rounded-2xl max-w-md w-full text-center relative shadow-2xl space-y-4">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#111b21]">Scan to Send Documents</h3>
            <p className="text-xs text-[#667781] max-w-xs mx-auto">
              Customers scan this QR code with any mobile camera to send documents directly into your queue.
            </p>

            {/* QR Code Container */}
            <div className="p-4 bg-white rounded-2xl border-2 border-[#00a884]/40 inline-block shadow-lg my-2">
              <QRCodeSVG
                value={customerUrl}
                size={220}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008069' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 38,
                  width: 38,
                  excavate: true,
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                <span>{copiedQR ? 'Link Copied!' : 'Copy Mobile Link'}</span>
              </button>

              <button
                onClick={() => window.open(customerUrl, '_blank')}
                className="btn-wa-primary py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Mobile Tab</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
