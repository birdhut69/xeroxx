import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Users,
  FileText,
  Printer,
  Flame,
  Clock,
  RotateCw,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  FileCheck,
  Lock,
  X,
  FileSpreadsheet,
  CheckCheck,
  Maximize2,
  ZoomIn,
  ZoomOut
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

  // Stable Session & Cryptography State
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
  const [showQRModal, setShowQRModal] = useState(false);
  const [copiedQR, setCopiedQR] = useState(false);
  const [mobileTab, setMobileTab] = useState<'QUEUE' | 'WORKSPACE'>('QUEUE');

  // Editor State for currently viewed document
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isShredding, setIsShredding] = useState(false);

  // Stable Refs (never trigger re-renders)
  const ledgerRef = useRef<EphemeralLedger | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const sessionIdRef = useRef('');

  // Pairing URL for QR Code
  const customerUrl = sessionId
    ? `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`
    : '';

  // Initialize Terminal Master Session ONCE on mount
  const initTerminal = useCallback(async () => {
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
    setMobileTab('QUEUE');

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
        toast.info('Customer Connected', `${data.customerName || 'A customer'} joined queue.`);
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
      onDocPayload: async (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const docId = `DOC-${Math.random().toString(36).substring(2, 8)}`;
        const currentKey = sessionKeyRef.current;

        if (!currentKey) {
          console.error('[SafePrint] Missing session key for decryption');
          return;
        }

        try {
          // Decode Base64 ciphertext into Uint8Array
          const binary = atob(msg.ciphertextBase64);
          const ciphertextBytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            ciphertextBytes[i] = binary.charCodeAt(i);
          }

          const iv = new Uint8Array(msg.iv);
          const plaintextBuffer = await decryptDocument(
            ciphertextBytes.buffer as ArrayBuffer,
            iv,
            currentKey
          );

          sounds.playEncrypt();

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
              decryptedBuffer: plaintextBuffer,
              status: 'READY',
              receivedAt: Date.now(),
              copies: 1,
            });
            return next;
          });

          setSelectedCustomerId((prev) => prev || custId);
          setSelectedDocId((prev) => prev || docId);

          if (ledgerRef.current && msg.metadata) {
            await ledgerRef.current.recordIngest(
              msg.metadata.docHash || 'UNKNOWN',
              msg.metadata.filename || 'Document',
              1,
              msg.metadata.watermarkText
            );
          }

          toast.success('Document Ready in RAM', `"${msg.metadata?.filename}" ready to print.`);
        } catch (err) {
          console.error('[SafePrint] Decryption error:', err);
          toast.error('Decryption Error', 'Failed to decrypt document payload.');
        }
      },
    });
  }, [shopId, shopName, toast]);

  useEffect(() => {
    initTerminal();
    return () => {
      relayRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCustomer = selectedCustomerId ? customers.get(selectedCustomerId) : null;
  const selectedDoc = selectedCustomer?.documents.find((d) => d.id === selectedDocId) || null;

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

  // Shred single file from customer
  const handleDeleteDoc = (docId: string) => {
    if (!selectedCustomer) return;
    const doc = selectedCustomer.documents.find((d) => d.id === docId);
    if (doc?.decryptedBuffer) {
      zeroizeBuffer(doc.decryptedBuffer);
      doc.decryptedBuffer = null;
    }

    setCustomers((prev) => {
      const next = new Map(prev);
      const cust = next.get(selectedCustomer.customerId);
      if (cust) {
        cust.documents = cust.documents.filter((d) => d.id !== docId);
      }
      return next;
    });

    if (selectedDocId === docId) {
      setSelectedDocId(null);
    }
    toast.info('File Shredded', 'Document buffer wiped from RAM.');
  };

  // Shred customer memory
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

    toast.shield('RAM Zeroized', 'Customer documents permanently shredded.');
    setIsShredding(false);
  }, [customers, toast]);

  const handleCopyLink = () => {
    if (!customerUrl) return;
    navigator.clipboard.writeText(customerUrl);
    setCopiedQR(true);
    sounds.playSuccess();
    toast.success('Link Copied', 'Mobile pairing URL copied to clipboard.');
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
    <div className="flex-1 min-h-0 w-full p-3 sm:p-4 flex flex-col overflow-hidden bg-[#efeae2]">
      {/* ── 2-COLUMN BALANCED WHATSAPP WEB SHELL ── */}
      <div className="w-full h-full rounded-2xl bg-white border border-[#d1d7db] shadow-2xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* ── LEFT PANE: WHATSAPP CHATS & LARGE COUNTER QR (4 Cols on Desktop) ── */}
        <div
          className={`lg:col-span-4 bg-white border-r border-[#e9edef] flex flex-col no-print h-full overflow-hidden ${
            mobileTab === 'WORKSPACE' && selectedCustomerId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top WhatsApp Profile Bar */}
          <div className="bg-[#008069] text-white px-5 py-3.5 flex items-center justify-between shadow-sm shrink-0 h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 text-white flex items-center justify-center text-base font-bold shadow-inner">
                <Printer className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm sm:text-base font-bold truncate leading-tight">{shopName}</div>
                <div className="text-xs text-white/90 font-mono flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block shadow-sm" />
                  <span>Station: {shopId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowQRModal(true)}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Open Fullscreen Counter QR"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                onClick={initTerminal}
                className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Reset Session Keys"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 📸 LARGE SHOP COUNTER QR CODE CARD 📸 */}
          <div className="p-4 bg-[#f8fafc] border-b border-[#e9edef] text-center space-y-3 shrink-0">
            <div className="flex items-center justify-between text-xs font-bold text-[#008069]">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] animate-ping" />
                <span className="tracking-wide uppercase text-xs">Scan to Send Documents</span>
              </span>
              <span className="text-xs text-[#54656f] font-mono">No App Needed</span>
            </div>

            {/* Prominent QR Code */}
            <div
              onClick={() => setShowQRModal(true)}
              className="p-3 bg-white rounded-2xl border-2 border-[#00a884] shadow-sm inline-block mx-auto cursor-pointer hover:shadow-md transition-all group"
              title="Click to expand QR Code"
            >
              <QRCodeSVG
                value={customerUrl}
                size={155}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008069' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 30,
                  width: 30,
                  excavate: true,
                }}
              />
              <div className="text-xs font-bold text-[#008069] mt-1.5 group-hover:underline flex items-center justify-center gap-1">
                <span>🔍 Click to expand QR</span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-[#f0f2f5] text-[#111b21] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#d1d7db] shadow-sm"
              >
                {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                <span>{copiedQR ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => window.open(customerUrl, '_blank')}
                className="py-2 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <Smartphone className="w-4 h-4" />
                <span>Test Phone</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-3 bg-white border-b border-[#e9edef] space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#667781]" />
              <input
                type="text"
                placeholder="Search connected customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-[#f0f2f5] border-none rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00a884] text-[#111b21] placeholder-[#667781]"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'ALL'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                All ({customers.size})
              </button>
              <button
                onClick={() => setFilterTab('PENDING')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'PENDING'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Waiting Print
              </button>
              <button
                onClick={() => setFilterTab('PRINTED')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  filterTab === 'PRINTED'
                    ? 'bg-[#00a884] text-white shadow-sm'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Customer Chat Queue List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#f0f2f5]">
            {customerList.length === 0 ? (
              <div className="p-8 text-center text-[#667781] space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto text-[#00a884]">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-[#111b21]">Queue is Empty</div>
                <p className="text-xs text-[#54656f] leading-relaxed max-w-xs mx-auto">
                  Customers scan your counter QR code above to beam documents directly into this queue.
                </p>
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
                      setMobileTab('WORKSPACE');
                    }}
                    className={`p-3.5 sm:p-4 flex items-center gap-3.5 cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    {/* WhatsApp Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#dfe5e7] text-[#54656f] font-bold flex items-center justify-center text-base shadow-inner">
                        {cust.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          readyDocs.length > 0 ? 'bg-[#25d366]' : 'bg-[#8696a0]'
                        }`}
                      />
                    </div>

                    {/* Chat Line */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-[#111b21] truncate">
                          {cust.customerName}
                        </span>
                        <span className="text-xs text-[#667781] font-mono">
                          {new Date(cust.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-[#667781] truncate flex items-center gap-1.5 max-w-[170px]">
                          {lastDoc ? (
                            <>
                              <CheckCheck className="w-4 h-4 text-[#53bdeb] shrink-0" />
                              <span className="truncate">{lastDoc.filename}</span>
                            </>
                          ) : (
                            <span className="italic">Connected • Staging file</span>
                          )}
                        </div>

                        {readyDocs.length > 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#25d366] text-white text-xs font-bold flex items-center gap-1 shrink-0 shadow-sm">
                            {readyDocs.length} Ready
                          </span>
                        ) : cust.status === 'PRINTED' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#e7f8ff] text-[#0284c7] text-xs font-bold shrink-0">
                            Printed
                          </span>
                        ) : cust.status === 'COMPLETED' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626] text-xs font-bold shrink-0">
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

        {/* ── RIGHT PANE: WHATSAPP ACTIVE CHAT & DRM WORKSPACE (8 Cols) ── */}
        <div
          className={`lg:col-span-8 flex flex-col bg-[#efeae2] h-full overflow-hidden ${
            mobileTab === 'QUEUE' && !selectedCustomerId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {!selectedCustomer ? (
            /* WhatsApp Web Default Welcome Screen WITH LARGE QR STATION */
            <div className="flex-1 wa-chat-wallpaper flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
              <div className="max-w-lg w-full p-6 sm:p-8 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-[#d1d7db] space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#d9fdd3] text-[#008069] text-xs font-bold font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#25d366] animate-pulse" />
                  <span>XEROX COUNTER ACTIVE • READY FOR SCANS</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-[#111b21]">
                  Point Camera to Send Files
                </h3>

                {/* Big 200px Center QR Code */}
                <div className="p-4 bg-[#f8fafc] rounded-2xl border-2 border-[#00a884] shadow-lg inline-block mx-auto">
                  <QRCodeSVG
                    value={customerUrl}
                    size={200}
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

                <p className="text-xs sm:text-sm text-[#54656f] max-w-sm mx-auto leading-relaxed">
                  Customers scan this QR code with their mobile camera to open WhatsApp-style encrypted beaming directly into your RAM queue.
                </p>

                <div className="flex gap-2.5 justify-center pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="py-2.5 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors border border-[#d1d7db]"
                  >
                    {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                    <span>{copiedQR ? 'Link Copied!' : 'Copy Pairing Link'}</span>
                  </button>

                  <button
                    onClick={() => window.open(customerUrl, '_blank')}
                    className="py-2.5 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-md"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open Test Customer Tab</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Active Customer WhatsApp Conversation */
            <div className="flex-1 min-h-0 flex flex-col bg-[#efeae2] overflow-hidden">
              {/* WhatsApp Active Chat Top Header */}
              <div className="bg-[#f0f2f5] px-5 py-3 border-b border-[#e9edef] flex items-center justify-between shadow-sm shrink-0 h-16">
                <div className="flex items-center gap-3 text-left min-w-0">
                  {/* Mobile Back to Queue Button */}
                  <button
                    onClick={() => setMobileTab('QUEUE')}
                    className="lg:hidden p-2 rounded-full hover:bg-black/10 text-[#54656f] shrink-0"
                    title="Back to Queue"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-[#008069] text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0">
                    {selectedCustomer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold text-[#111b21] flex items-center gap-2 truncate">
                      <span>{selectedCustomer.customerName}</span>
                      <span className="text-xs font-mono text-[#667781]">({selectedCustomer.customerId})</span>
                    </div>
                    <div className="text-xs text-[#008069] font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block shrink-0 shadow-sm" />
                      <span className="truncate">Online • {selectedCustomer.documents.length} document(s) in RAM</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => handleShredCustomer(selectedCustomer.customerId)}
                    disabled={isShredding}
                    className="btn-wa-danger px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm"
                    title="Zeroize all RAM for this customer"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Shred Session</span>
                  </button>
                </div>
              </div>

              {/* Multi-document Selection Bar */}
              {selectedCustomer.documents.length > 0 && (
                <div className="bg-white px-5 py-2.5 border-b border-[#e9edef] flex items-center gap-2.5 overflow-x-auto shrink-0 shadow-sm">
                  <span className="text-xs font-bold text-[#667781] uppercase tracking-wider shrink-0">Files:</span>
                  {selectedCustomer.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 border ${
                        selectedDoc?.id === doc.id
                          ? 'bg-[#008069] text-white border-[#008069] shadow-sm'
                          : 'bg-[#f0f2f5] text-[#54656f] border-[#d1d7db] hover:bg-[#e9edef]'
                      }`}
                    >
                      <button
                        onClick={() => setSelectedDocId(doc.id)}
                        className="flex items-center gap-2 outline-none cursor-pointer"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="truncate max-w-[180px]">{doc.filename}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(doc.id);
                        }}
                        className="p-1 rounded hover:bg-black/20 text-white/80 hover:text-white transition-colors ml-1"
                        title="Delete file from RAM"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Workspace Feed */}
              <div className="flex-1 min-h-0 wa-chat-wallpaper overflow-y-auto p-4 sm:p-5 space-y-4 text-left">
                {/* WhatsApp System Encryption Notice */}
                <div className="wa-system-pill flex items-center justify-center gap-2 text-center text-xs sm:text-sm py-2 px-4 shadow-sm">
                  <Lock className="w-4 h-4 text-[#54656f] shrink-0" />
                  <span>
                    🔒 Documents sent in this chat are AES-256 encrypted and stored only in volatile RAM.
                  </span>
                </div>

                {!selectedDoc ? (
                  /* WhatsApp Document Selection Cards */
                  <div className="wa-panel p-8 rounded-3xl max-w-lg mx-auto my-6 space-y-5 text-center shadow-xl border border-[#d1d7db]">
                    <div className="w-14 h-14 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
                      <FileSpreadsheet className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-[#111b21]">Select a Document to Preview & Print</h4>
                      <p className="text-xs sm:text-sm text-[#667781] mt-1">Customer has sent {selectedCustomer.documents.length} document(s).</p>
                    </div>

                    <div className="space-y-2.5 text-left">
                      {selectedCustomer.documents.map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className="p-4 rounded-2xl bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#d1d7db] cursor-pointer flex items-center justify-between gap-3 transition-colors shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="w-6 h-6 text-[#008069] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[#111b21] truncate">{doc.filename}</div>
                              <div className="text-xs text-[#667781] font-mono mt-0.5">{(doc.fileSize / 1024).toFixed(1)} KB • In RAM</div>
                            </div>
                          </div>

                          <button className="btn-wa-primary px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 shadow-sm">
                            Open & Print
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : !selectedDoc.decryptedBuffer ? (
                  <div className="wa-panel p-10 rounded-3xl text-center max-w-sm mx-auto my-10 space-y-3 shadow-xl">
                    <Clock className="w-10 h-10 text-[#0284c7] mx-auto animate-pulse" />
                    <div className="text-sm font-bold text-[#111b21]">Decrypting Document...</div>
                    <p className="text-xs text-[#667781]">Loading AES-256 payload into RAM.</p>
                  </div>
                ) : (
                  <div className="space-y-4 flex flex-col">
                    {/* Unified Document Print & Adjustment Toolbar */}
                    <div className="wa-panel p-3.5 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md border border-[#d1d7db]">
                      {/* Left: Document Info & Page Navigator */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-[#f0f2f5] px-3 py-1.5 rounded-xl border border-[#d1d7db]">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f]"
                            title="Previous Page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs sm:text-sm font-mono font-bold text-[#111b21] px-2 whitespace-nowrap">
                            Page {currentPage} / {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f]"
                            title="Next Page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="hidden sm:block text-left">
                          <div className="text-sm font-bold text-[#111b21] truncate max-w-[200px]" title={selectedDoc.filename}>
                            {selectedDoc.filename}
                          </div>
                          <div className="text-xs text-[#667781] font-mono">{(selectedDoc.fileSize / 1024).toFixed(1)} KB in RAM</div>
                        </div>
                      </div>

                      {/* Center: Rotation, Photocopy Filters, Zoom */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          onClick={() => setRotation((r) => (r + 90) % 360)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#d1d7db] text-xs sm:text-sm font-bold text-[#111b21] transition-colors"
                          title="Rotate 90°"
                        >
                          <RotateCw className="w-4 h-4 text-[#008069]" />
                          <span>{rotation}°</span>
                        </button>

                        <div className="flex items-center bg-[#f0f2f5] p-1 rounded-xl border border-[#d1d7db] text-xs font-semibold">
                          <button
                            onClick={() => setFilterMode('NORMAL')}
                            className={`px-3 py-1 rounded-lg ${filterMode === 'NORMAL' ? 'bg-[#008069] text-white shadow-sm' : 'text-[#54656f]'}`}
                          >
                            Color
                          </button>
                          <button
                            onClick={() => setFilterMode('GRAYSCALE')}
                            className={`px-3 py-1 rounded-lg ${filterMode === 'GRAYSCALE' ? 'bg-[#008069] text-white shadow-sm' : 'text-[#54656f]'}`}
                          >
                            Grayscale
                          </button>
                          <button
                            onClick={() => setFilterMode('BW')}
                            className={`px-3 py-1 rounded-lg ${filterMode === 'BW' ? 'bg-[#008069] text-white shadow-sm' : 'text-[#54656f]'}`}
                          >
                            Photocopy B&W
                          </button>
                        </div>

                        <div className="flex items-center gap-1 bg-[#f0f2f5] px-2 py-1 rounded-xl border border-[#d1d7db]">
                          <button
                            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))}
                            className="p-1 text-[#54656f] hover:text-[#111b21]"
                            title="Zoom Out"
                          >
                            <ZoomOut className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-mono text-[#111b21] px-1 font-bold">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button
                            onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))}
                            className="p-1 text-[#54656f] hover:text-[#111b21]"
                            title="Zoom In"
                          >
                            <ZoomIn className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Right: Print Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handlePrint}
                          disabled={isPrinting}
                          className="btn-wa-primary px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md"
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
                          className="px-4 py-2.5 rounded-xl bg-[#008069] hover:bg-[#00705b] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md"
                          title="Print and switch immediately to next customer"
                        >
                          <ChevronRight className="w-4 h-4" />
                          <span>Print & Next</span>
                        </button>
                      </div>
                    </div>

                    {/* Sandboxed DRM Canvas Sandbox */}
                    <div className="flex-1 min-h-[460px] rounded-2xl overflow-hidden shadow-2xl border border-[#cbd5e1] bg-[#1e293b] flex items-center justify-center relative p-2">
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
                        onCloseDocument={() => setSelectedDocId(null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Counter QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl border border-[#d1d7db]">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9edef]">
              <div className="text-base font-bold text-[#111b21] flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#008069]" />
                <span>Xerox Counter Live QR</span>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 bg-[#f8fafc] rounded-2xl border-2 border-[#00a884] inline-block mx-auto shadow-inner">
              <QRCodeSVG
                value={customerUrl}
                size={260}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008069' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 48,
                  width: 48,
                  excavate: true,
                }}
              />
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#111b21]">Point Phone Camera to Connect</h4>
              <p className="text-xs text-[#667781]">
                No app installation required. Opens end-to-end encrypted RAM transfer.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#d1d7db]"
              >
                {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                <span>{copiedQR ? 'Copied!' : 'Copy Pairing Link'}</span>
              </button>

              <button
                onClick={() => window.open(customerUrl, '_blank')}
                className="py-2.5 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Test Phone</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
