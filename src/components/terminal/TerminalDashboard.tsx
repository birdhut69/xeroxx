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
  Lock,
  X,
  FileSpreadsheet,
  CheckCheck,
  Maximize2,
  ZoomIn,
  ZoomOut,
  QrCode,
  Send,
  Sparkles,
  Paperclip,
  Smile,
  ShieldCheck,
  Eye,
  Trash2,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  generateSessionKey,
  exportKeyToHash,
  generateRandomSessionId,
  decryptDocument,
  encryptDocument
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

interface ChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'SHOP' | 'SYSTEM';
  text?: string;
  docId?: string;
  timestamp: number;
}

interface QueuedCustomer {
  customerId: string;
  customerName: string;
  joinedAt: number;
  lastActive: number;
  documents: QueuedDocument[];
  messages: ChatMessage[];
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
  const [replyText, setReplyText] = useState('');
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Editor State for currently viewed document
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('NORMAL');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isShredding, setIsShredding] = useState(false);

  // Stable Refs
  const ledgerRef = useRef<EphemeralLedger | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const sessionKeyRef = useRef<CryptoKey | null>(null);
  const sessionIdRef = useRef('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Pairing URL for QR Code
  const customerUrl = sessionId
    ? `${window.location.origin}/?room=${sessionId}#key=${sessionKeyHex}`
    : '';

  // Auto-scroll chat when messages change
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [customers, selectedCustomerId]);

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
              messages: [
                {
                  id: `MSG-${Date.now()}`,
                  sender: 'SYSTEM',
                  text: '🔒 End-to-end encrypted session established. Documents sent will be stored strictly in printer volatile RAM.',
                  timestamp: Date.now(),
                }
              ],
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
      onChatMessage: (msg) => {
        sounds.playSuccess();
        setCustomers((prev) => {
          const next = new Map(prev);
          const cust = next.get(msg.customerId);
          if (cust) {
            cust.lastActive = Date.now();
            cust.messages.push({
              id: msg.id || `MSG-${Date.now()}`,
              sender: msg.sender,
              text: msg.text,
              timestamp: msg.timestamp || Date.now(),
            });
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
                messages: [],
                status: 'ACTIVE',
              };
              next.set(custId, cust);
            }
            // Deduplicate: check if document already exists by docHash or filename & size
            const existingDocIndex = cust.documents.findIndex(
              (d) => (msg.metadata?.docHash && d.docHash === msg.metadata.docHash) ||
                     (d.filename === (msg.metadata?.filename || 'Document') && d.fileSize === (msg.metadata?.fileSize || 0))
            );

            if (existingDocIndex >= 0) {
              cust.documents[existingDocIndex].decryptedBuffer = plaintextBuffer;
              cust.documents[existingDocIndex].status = 'READY';
              return next;
            }

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

            // Prevent duplicate DOC-MSG
            if (!cust.messages.some((m) => m.docId === docId)) {
              cust.messages.push({
                id: `DOC-MSG-${docId}`,
                sender: 'CUSTOMER',
                docId,
                timestamp: Date.now(),
              });
            }

            return next;
          });

          setSelectedCustomerId((prev) => prev || custId);
          setSelectedDocId(docId);
          setIsViewerOpen(true);

          if (ledgerRef.current && msg.metadata) {
            await ledgerRef.current.recordIngest(
              msg.metadata.docHash || 'UNKNOWN',
              msg.metadata.filename || 'Document',
              1,
              msg.metadata.watermarkText
            );
          }

          toast.success('Document Received in RAM', `"${msg.metadata?.filename}" ready to print.`);
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

  // Send WhatsApp reply to customer
  const handleSendReply = (textToSend?: string) => {
    const text = textToSend || replyText.trim();
    if (!text || !selectedCustomer) return;

    const msgId = `MSG-${Date.now()}`;
    const timestamp = Date.now();

    // Append to local state
    setCustomers((prev) => {
      const next = new Map(prev);
      const cust = next.get(selectedCustomer.customerId);
      if (cust) {
        cust.lastActive = timestamp;
        cust.messages.push({
          id: msgId,
          sender: 'SHOP',
          text,
          timestamp,
        });
      }
      return next;
    });

    // Send over WebRTC / Relay
    relayRef.current?.send({
      type: 'CHAT_MESSAGE',
      roomId: sessionIdRef.current,
      customerId: selectedCustomer.customerId,
      id: msgId,
      sender: 'SHOP',
      text,
      timestamp,
    });

    sounds.playSuccess();
    if (!textToSend) setReplyText('');
  };

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
          cust.messages.push({
            id: `PRINT-${Date.now()}`,
            sender: 'SYSTEM',
            text: `🖨️ Document "${selectedDoc.filename}" successfully printed (${totalPages} page(s) × ${copies} copies).`,
            timestamp: Date.now(),
          });
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
        cust.messages.push({
          id: `SHRED-DOC-${Date.now()}`,
          sender: 'SYSTEM',
          text: `🔥 Document "${doc?.filename || 'File'}" zeroized from RAM.`,
          timestamp: Date.now(),
        });
      }
      return next;
    });

    if (selectedDocId === docId) {
      setSelectedDocId(null);
      setIsViewerOpen(false);
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
      if (target) {
        target.status = 'COMPLETED';
        target.messages.push({
          id: `SHRED-${Date.now()}`,
          sender: 'SYSTEM',
          text: `🔥 Session terminated. All plaintext buffers wiped and Certificate of Destruction issued.`,
          timestamp: Date.now(),
        });
      }
      return next;
    });

    toast.shield('RAM Zeroized', 'Customer documents permanently shredded.');
    setIsShredding(false);
  }, [customers, toast]);

  // ✨ Interactive Live Customer Simulator ✨
  const handleSimulateCustomer = async () => {
    sounds.playConnect();
    const mockNames = ['Rahul Sharma', 'Priya Patel', 'Ananya Iyer', 'Vikram Singh', 'Dr. Meera Nair'];
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const mockCustId = `CUST-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Create synthetic demo image buffer
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 900, 600);
    ctx.fillStyle = '#008069';
    ctx.fillRect(0, 0, 900, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SAFEPRINT SECURE DEMO DOCUMENT', 30, 45);

    ctx.fillStyle = '#111b21';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`SAMPLE IDENTITY CARD — ${randomName.toUpperCase()}`, 30, 120);

    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(30, 150, 160, 200);
    ctx.fillStyle = '#667781';
    ctx.font = '14px monospace';
    ctx.fillText('SECURE PHOTO', 55, 255);

    ctx.fillStyle = '#111b21';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Name: ${randomName}`, 220, 180);
    ctx.fillText('DOB: 15/08/1996', 220, 215);
    ctx.fillText('Gender: Verified', 220, 250);
    ctx.fillText('UID: 8921 • 4490 • 7712', 220, 285);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(30, 480, 840, 50);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('CONFIDENTIAL DOCUMENT — IN-MEMORY DRM PROTECTED', 50, 512);

    const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), 'image/png'));
    const docBuffer = await blob.arrayBuffer();
    const docId = `DOC-${Math.random().toString(36).substring(2, 8)}`;

    const newCust: QueuedCustomer = {
      customerId: mockCustId,
      customerName: randomName,
      joinedAt: Date.now(),
      lastActive: Date.now(),
      documents: [
        {
          id: docId,
          filename: `Aadhaar_${randomName.replace(' ', '_')}.png`,
          fileType: 'image/png',
          fileSize: docBuffer.byteLength,
          docHash: 'SHA256-SIMULATED-VERIFIED',
          watermarkText: 'OFFICIAL PHOTOCOPY ONLY',
          maxCopies: 2,
          decryptedBuffer: docBuffer,
          status: 'READY',
          receivedAt: Date.now(),
          copies: 2,
        }
      ],
      messages: [
        {
          id: `MSG-1`,
          sender: 'SYSTEM',
          text: '🔒 End-to-end encrypted session established. Documents sent will be stored strictly in printer volatile RAM.',
          timestamp: Date.now() - 4000,
        },
        {
          id: `DOC-MSG-1`,
          sender: 'CUSTOMER',
          docId,
          timestamp: Date.now() - 2000,
        },
        {
          id: `MSG-2`,
          sender: 'CUSTOMER',
          text: `Hi bhaiya, please print 2 copies in Photocopy B&W mode for passport application.`,
          timestamp: Date.now(),
        }
      ],
      status: 'ACTIVE',
    };

    setCustomers((prev) => {
      const next = new Map(prev);
      next.set(mockCustId, newCust);
      return next;
    });

    setSelectedCustomerId(mockCustId);
    setSelectedDocId(docId);
    setMobileTab('WORKSPACE');
    toast.success('Customer Simulated', `${randomName} sent Aadhaar Card with print instructions.`);
  };

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
    <div className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden">
      {/* ── AUTHENTIC WHATSAPP WEB SHELL ── */}
      <div className="w-full h-full bg-white rounded-none lg:rounded-[10px] shadow-[0_6px_18px_rgba(11,20,26,0.05)] border border-[#d1d7db] flex overflow-hidden">
        {/* ── LEFT PANE: WHATSAPP CHAT LIST (380px Desktop) ── */}
        <div
          className={`w-full lg:w-[380px] xl:w-[410px] shrink-0 bg-white border-r border-[#d1d7db] flex flex-col no-print h-full overflow-hidden ${
            mobileTab === 'WORKSPACE' && selectedCustomerId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top WhatsApp Web Header */}
          <div className="bg-[#f0f2f5] px-4 py-2.5 flex items-center justify-between border-b border-[#d1d7db] shrink-0 h-[60px]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold text-base shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <div className="text-left leading-tight">
                <div className="text-[15px] font-semibold text-[#111b21] truncate max-w-[160px]">{shopName}</div>
                <div className="text-[12px] text-[#00a884] font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block" />
                  <span>{shopId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[#54656f]">
              <button
                onClick={handleSimulateCustomer}
                className="px-2.5 py-1 rounded-lg bg-[#d9fdd3] hover:bg-[#cbf7c3] text-[#008069] text-xs font-bold flex items-center gap-1 transition-colors border border-[#00a884]/30 shadow-xs"
                title="Simulate incoming customer with documents and instructions"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate</span>
              </button>

              <button
                onClick={() => setShowQRModal(true)}
                className="p-2 rounded-full hover:bg-black/5 transition-colors"
                title="Show Fullscreen Counter QR"
              >
                <QrCode className="w-5 h-5" />
              </button>

              <button
                onClick={initTerminal}
                className="p-2 rounded-full hover:bg-black/5 transition-colors"
                title="Refresh Session Keys"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 📲 WhatsApp "Get Connected" Banner Card 📲 */}
          <div className="bg-[#e7f8ff] p-3.5 border-b border-[#d1d7db] flex items-center gap-3 shrink-0">
            <div
              onClick={() => setShowQRModal(true)}
              className="p-1 bg-white rounded-lg border border-[#00a884]/40 shadow-sm cursor-pointer shrink-0 hover:scale-105 transition-transform"
              title="Click to expand QR Code"
            >
              <QRCodeSVG
                value={customerUrl}
                size={54}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="text-[13px] font-bold text-[#111b21] flex items-center justify-between">
                <span>Scan to Send Files</span>
                <span className="text-[11px] font-mono text-[#0284c7] bg-white px-1.5 py-0.5 rounded border border-[#0284c7]/20">No App</span>
              </div>
              <p className="text-[11px] text-[#54656f] mt-0.5 truncate">Point camera to transfer in RAM</p>

              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={handleCopyLink}
                  className="px-2 py-0.5 rounded bg-white hover:bg-[#f0f2f5] text-[#111b21] text-[11px] font-semibold flex items-center gap-1 border border-[#d1d7db] shadow-xs"
                >
                  {copiedQR ? <Check className="w-3 h-3 text-[#00a884]" /> : <Copy className="w-3 h-3 text-[#54656f]" />}
                  <span>{copiedQR ? 'Copied' : 'Copy'}</span>
                </button>

                <button
                  onClick={() => window.open(customerUrl, '_blank')}
                  className="px-2.5 py-0.5 rounded bg-[#00a884] hover:bg-[#008f6f] text-white text-[11px] font-semibold flex items-center gap-1 shadow-xs"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Test Mobile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-2.5 border-b border-[#e9edef] space-y-2 shrink-0">
            <div className="bg-[#f0f2f5] rounded-lg h-9 flex items-center px-3 gap-2.5">
              <Search className="w-4 h-4 text-[#54656f] shrink-0" />
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[13px] bg-transparent border-none focus:outline-none text-[#111b21] placeholder-[#667781]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
                  filterTab === 'ALL'
                    ? 'bg-[#d9fdd3] text-[#008069] border border-[#00a884]/30'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                All ({customers.size})
              </button>
              <button
                onClick={() => setFilterTab('PENDING')}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
                  filterTab === 'PENDING'
                    ? 'bg-[#d9fdd3] text-[#008069] border border-[#00a884]/30'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Waiting Print
              </button>
              <button
                onClick={() => setFilterTab('PRINTED')}
                className={`px-3 py-1 rounded-full text-[12px] font-semibold transition-all ${
                  filterTab === 'PRINTED'
                    ? 'bg-[#d9fdd3] text-[#008069] border border-[#00a884]/30'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Completed
              </button>
            </div>
          </div>

          {/* Customer Chat Rows List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#f0f2f5]">
            {customerList.length === 0 ? (
              <div className="p-8 text-center text-[#667781] space-y-3 my-auto">
                <div className="w-12 h-12 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto text-[#00a884]">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-[15px] font-bold text-[#111b21]">No Customers in Queue</div>
                <p className="text-[13px] text-[#667781] leading-relaxed max-w-xs mx-auto">
                  Scan the counter QR code with a phone or click Simulate above to test live printing.
                </p>
                <button
                  onClick={handleSimulateCustomer}
                  className="btn-wa-primary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Simulate Demo Customer</span>
                </button>
              </div>
            ) : (
              customerList.map((cust) => {
                const isSelected = cust.customerId === selectedCustomerId;
                const readyDocs = cust.documents.filter((d) => d.status === 'READY');
                const lastMsg = cust.messages[cust.messages.length - 1];
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
                    className={`h-[72px] px-4 flex items-center gap-3.5 cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    {/* WhatsApp Circular Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#dfe5e7] text-[#54656f] font-bold flex items-center justify-center text-base shadow-xs">
                        {cust.customerName.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          readyDocs.length > 0 ? 'bg-[#25d366]' : 'bg-[#8696a0]'
                        }`}
                      />
                    </div>

                    {/* Middle Chat Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[16px] font-normal text-[#111b21] truncate leading-5">
                          {cust.customerName}
                        </span>
                        <span className="text-[12px] text-[#667781]">
                          {new Date(cust.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[13px] text-[#667781] truncate flex items-center gap-1 max-w-[170px]">
                          {lastMsg?.text ? (
                            <>
                              {lastMsg.sender === 'SHOP' && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />}
                              <span className="truncate">{lastMsg.text}</span>
                            </>
                          ) : lastDoc ? (
                            <>
                              <FileText className="w-3.5 h-3.5 text-[#008069] shrink-0" />
                              <span className="truncate">{lastDoc.filename}</span>
                            </>
                          ) : (
                            <span className="italic">Connected</span>
                          )}
                        </div>

                        {readyDocs.length > 0 ? (
                          <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                            {readyDocs.length}
                          </span>
                        ) : cust.status === 'PRINTED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#e7f8ff] text-[#0284c7] text-[11px] font-semibold shrink-0">
                            Printed
                          </span>
                        ) : cust.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626] text-[11px] font-semibold shrink-0">
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

        {/* ── RIGHT PANE: WHATSAPP ACTIVE CHAT & DRM WORKSPACE ── */}
        <div
          className={`flex-1 min-w-0 flex flex-col bg-[#efeae2] h-full overflow-hidden ${
            mobileTab === 'QUEUE' && !selectedCustomerId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {!selectedCustomer ? (
            /* 🖥️ WHATSAPP WEB SIGNATURE WELCOME SCREEN 🖥️ */
            <div className="flex-1 min-h-0 wa-chat-wallpaper flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
              <div className="max-w-md w-full p-8 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#d1d7db] space-y-4 my-auto">
                <div className="w-16 h-16 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
                  <Printer className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#111b21]">SafePrint for Xerox & Print Shops</h3>
                  <p className="text-[13px] text-[#667781] mt-1 leading-relaxed">
                    Zero-disk ephemeral transmission. Print documents directly from RAM without saving customer files to your desktop or downloads.
                  </p>
                </div>

                {/* Big Center QR Code */}
                <div className="p-4 bg-[#f8fafc] rounded-2xl border-2 border-[#00a884] shadow-md inline-block mx-auto">
                  <QRCodeSVG
                    value={customerUrl}
                    size={180}
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

                <div className="flex flex-wrap gap-2.5 justify-center pt-2">
                  <button
                    onClick={handleSimulateCustomer}
                    className="py-2.5 px-4 rounded-xl bg-[#008069] hover:bg-[#00705b] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Simulate Customer Chat</span>
                  </button>

                  <button
                    onClick={() => window.open(customerUrl, '_blank')}
                    className="py-2.5 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors border border-[#d1d7db]"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open Test Mobile</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-[#e9edef] flex items-center justify-center gap-1.5 text-[12px] text-[#667781]">
                  <Lock className="w-3.5 h-3.5 text-[#54656f]" />
                  <span>End-to-end encrypted • Zero disk storage</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Customer WhatsApp Conversation */
            <div className="flex-1 min-h-0 flex flex-col bg-[#efeae2] overflow-hidden">
              {/* WhatsApp Active Chat Top Header */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-[#d1d7db] flex items-center justify-between shadow-xs shrink-0 h-[60px]">
                <div className="flex items-center gap-3 text-left min-w-0">
                  <button
                    onClick={() => setMobileTab('QUEUE')}
                    className="lg:hidden p-1.5 rounded-full hover:bg-black/10 text-[#54656f] shrink-0"
                    title="Back to Queue"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-[#008069] text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {selectedCustomer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-medium text-[#111b21] flex items-center gap-2 truncate">
                      <span>{selectedCustomer.customerName}</span>
                      <span className="text-[11px] font-mono text-[#667781]">({selectedCustomer.customerId})</span>
                    </div>
                    <div className="text-[12px] text-[#008069] font-normal flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#25d366] inline-block shrink-0" />
                      <span className="truncate">online • {selectedCustomer.documents.length} document(s) in RAM</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedDoc && (
                    <button
                      onClick={() => setIsViewerOpen(true)}
                      className="btn-wa-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Document Viewer</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleShredCustomer(selectedCustomer.customerId)}
                    disabled={isShredding}
                    className="btn-wa-danger px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                    title="Zeroize all RAM for this customer"
                  >
                    <Flame className="w-4 h-4" />
                    <span>Shred Session</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Chat Conversation Timeline */}
              <div className="flex-1 min-h-0 wa-chat-wallpaper overflow-y-auto p-4 space-y-3.5 text-left">
                {/* Security encryption pill */}
                <div className="wa-system-pill flex items-center justify-center gap-2 text-center text-xs py-2 px-4 shadow-xs">
                  <Lock className="w-3.5 h-3.5 text-[#54656f] shrink-0" />
                  <span>
                    🔒 Documents sent in this chat are AES-256 encrypted directly in printer RAM.
                  </span>
                </div>

                {/* Messages & Document Cards */}
                {selectedCustomer.messages.map((msg) => {
                  if (msg.sender === 'SYSTEM') {
                    return (
                      <div key={msg.id} className="wa-system-pill text-center my-2">
                        {msg.text}
                      </div>
                    );
                  }

                  if (msg.docId) {
                    const doc = selectedCustomer.documents.find((d) => d.id === msg.docId);
                    if (!doc) return null;

                    return (
                      <div key={msg.id} className="flex justify-start animate-in fade-in duration-150">
                        <div className="wa-bubble-in max-w-[94%] sm:max-w-md p-3.5 space-y-2.5 border border-[#d1d7db]/40 shadow-xs">
                          <div className="flex items-center justify-between pb-1 border-b border-[#e9edef] text-[11px] font-bold text-[#008069]">
                            <span>ENCRYPTED DOCUMENT RECEIVED</span>
                            <span className="font-mono text-[#667781]">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          </div>

                          <div className="p-3 rounded-xl bg-[#f0f2f5] flex items-center gap-3 border border-[#d1d7db]">
                            <div className="p-2.5 rounded-xl bg-[#00a884]/15 text-[#008069] shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-[#111b21] truncate" title={doc.filename}>
                                {doc.filename}
                              </div>
                              <div className="text-xs text-[#667781] font-mono mt-0.5">
                                Status: {doc.status === 'READY' ? '🟢 In RAM Ready' : doc.status}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => {
                                setSelectedDocId(doc.id);
                                setIsViewerOpen(true);
                              }}
                              className="flex-1 py-2 px-3 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Preview & Print Document</span>
                            </button>

                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
                              title="Shred this file"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-[11px] text-[#667781] text-right font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const isShop = msg.sender === 'SHOP';

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isShop ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
                    >
                      <div
                        className={`${
                          isShop ? 'wa-bubble-out' : 'wa-bubble-in'
                        } max-w-[85%] sm:max-w-md p-3 space-y-1 shadow-xs`}
                      >
                        <div className="text-[14px] text-[#111b21] leading-relaxed break-words">{msg.text}</div>
                        <div className="flex items-center justify-end gap-1 text-[11px] text-[#667781] font-mono">
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {isShop && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={chatScrollRef} />
              </div>

              {/* Quick Reply Actions for Shopkeeper */}
              <div className="bg-[#f0f2f5] px-4 py-2 border-t border-[#e9edef] flex items-center gap-2 overflow-x-auto shrink-0">
                <span className="text-[11px] font-bold text-[#667781] uppercase tracking-wider shrink-0">Quick Reply:</span>
                <button
                  onClick={() => handleSendReply('🖨️ Printing your document right now...')}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-[#e9edef] text-[#111b21] text-xs font-medium border border-[#d1d7db] shrink-0"
                >
                  🖨️ Printing now
                </button>
                <button
                  onClick={() => handleSendReply('✅ Printed & ready for pickup! Total: ₹10')}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-[#e9edef] text-[#111b21] text-xs font-medium border border-[#d1d7db] shrink-0"
                >
                  ✅ Ready for pickup (₹10)
                </button>
                <button
                  onClick={() => handleSendReply('⚠️ Please re-upload with higher resolution or clear lighting.')}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-[#e9edef] text-[#111b21] text-xs font-medium border border-[#d1d7db] shrink-0"
                >
                  ⚠️ Resend clearer copy
                </button>
              </div>

              {/* Bottom WhatsApp Chat Input Bar */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 border-t border-[#d1d7db] flex items-center gap-3 shrink-0">
                <div className="flex-1 bg-white rounded-lg h-10 px-3 flex items-center border border-[#d1d7db] focus-within:border-[#00a884]">
                  <input
                    type="text"
                    placeholder="Type a message to customer..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    className="w-full text-[14px] bg-transparent border-none focus:outline-none text-[#111b21] placeholder-[#667781]"
                  />
                </div>

                <button
                  onClick={() => handleSendReply()}
                  disabled={!replyText.trim()}
                  className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md disabled:opacity-40 transition-transform active:scale-95 shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📄 Interactive WhatsApp Document Viewer Modal / Drawer 📄 */}
      {isViewerOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-2 sm:p-4 flex items-center justify-center animate-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#d1d7db]">
            {/* Modal Header */}
            <div className="bg-[#008069] text-white px-5 py-3.5 flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-white" />
                <div className="text-left">
                  <div className="text-sm sm:text-base font-bold truncate max-w-md">{selectedDoc.filename}</div>
                  <div className="text-xs text-white/80 font-mono">
                    Customer: {selectedCustomer?.customerName} • {(selectedDoc.fileSize / 1024).toFixed(1)} KB in RAM
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="px-4 py-2 rounded-xl bg-[#25d366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Printing...' : 'Print Document'}</span>
                </button>

                <button
                  onClick={() => setIsViewerOpen(false)}
                  className="p-2 rounded-full hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Adjustment Toolbar */}
            <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-[#d1d7db] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded bg-white border border-[#d1d7db] text-[#54656f] disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-[#111b21]">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded bg-white border border-[#d1d7db] text-[#54656f] disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-[#d1d7db] text-xs font-bold text-[#111b21]"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#008069]" />
                  <span>{rotation}°</span>
                </button>

                <div className="flex items-center bg-white p-0.5 rounded-lg border border-[#d1d7db] text-xs font-semibold">
                  <button
                    onClick={() => setFilterMode('NORMAL')}
                    className={`px-2.5 py-0.5 rounded-md ${filterMode === 'NORMAL' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f]'}`}
                  >
                    Color
                  </button>
                  <button
                    onClick={() => setFilterMode('BW')}
                    className={`px-2.5 py-0.5 rounded-md ${filterMode === 'BW' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f]'}`}
                  >
                    Photocopy B&W
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#d1d7db]">
                  <button onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))} className="p-0.5 text-[#54656f]">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono font-bold px-1">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))} className="p-0.5 text-[#54656f]">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDeleteDoc(selectedDoc.id)}
                  className="px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete File</span>
                </button>
              </div>
            </div>

            {/* Modal Canvas Viewer Area */}
            <div className="flex-1 min-h-0 bg-[#1e293b] p-4 flex items-center justify-center overflow-auto">
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
                onCloseDocument={() => setIsViewerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

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
