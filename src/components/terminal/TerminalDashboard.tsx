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
  CheckCheck,
  ZoomIn,
  ZoomOut,
  QrCode,
  Send,
  Eye,
  Trash2,
  Paperclip,
  Smile,
  ShieldCheck,
  Mic,
  Square,
  SlidersHorizontal,
  Store,
  Settings
} from 'lucide-react';
import {
  generateSessionKey,
  exportKeyToHash,
  generateRandomSessionId,
  decryptDocument,
} from '../../crypto/e2ee';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { EphemeralLedger } from '../../crypto/ledger';
import { SecurityGuards } from '../../crypto/securityGuards';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';
import { DRMCanvasViewer } from './DRMCanvasViewer';
import { VoiceNotePlayer } from '../shared/VoiceNotePlayer';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../context/LanguageContext';
import { StandeePrintModal } from './StandeePrintModal';
import { ShopSettingsModal } from './ShopSettingsModal';

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
  voiceBase64?: string;
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

type FilterMode = 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST' | 'CAMSCAN';

export const TerminalDashboard: React.FC = () => {
  const toast = useToast();
  const { t } = useLanguage();

  // Stable Session & Cryptography State
  const [sessionId, setSessionId] = useState('');
  const [sessionKeyHex, setSessionKeyHex] = useState('');
  const [shopId] = useState(() => `XEROX-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [shopName, setShopName] = useState(() => localStorage.getItem('cipherprint_shop_name') || 'SafePrint Express Terminal');
  const [upiId, setUpiId] = useState(() => localStorage.getItem('cipherprint_upi_id') || 'shopkeeper@upi');
  const [bwRate, setBwRate] = useState(() => parseFloat(localStorage.getItem('cipherprint_bw_rate') || '2'));
  const [colorRate, setColorRate] = useState(() => parseFloat(localStorage.getItem('cipherprint_color_rate') || '10'));

  // Customer Queue State
  const [customers, setCustomers] = useState<Map<string, QueuedCustomer>>(new Map());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'PRINTED'>('ALL');
  const [showQRModal, setShowQRModal] = useState(false);
  const [showStandeeModal, setShowStandeeModal] = useState(false);
  const [showShopSettingsModal, setShowShopSettingsModal] = useState(false);
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

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
          upiId,
          bwRate,
          colorRate,
        });
      },
      onCustomerConnected: (data) => {
        sounds.playConnect();
        setCustomers((prev) => {
          const next = new Map(prev);
          const cName = data.customerName || `Customer #${next.size + 1}`;
          if (!next.has(data.customerId)) {
            next.set(data.customerId, {
              customerId: data.customerId,
              customerName: cName,
              joinedAt: data.timestamp || Date.now(),
              lastActive: Date.now(),
              documents: [],
              messages: [],
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
        const safeText = SecurityGuards.sanitizeText(msg.text || '');
        const safeName = SecurityGuards.sanitizeText(msg.customerName || '');

        setCustomers((prev) => {
          const next = new Map(prev);
          let cust = next.get(msg.customerId);
          const displayName = safeName || `Customer #${next.size + 1}`;

          if (!cust) {
            cust = {
              customerId: msg.customerId,
              customerName: displayName,
              joinedAt: Date.now(),
              lastActive: Date.now(),
              documents: [],
              messages: [],
              status: 'ACTIVE',
            };
            next.set(msg.customerId, cust);
          } else if (safeName) {
            cust.customerName = safeName;
          }

          cust.lastActive = Date.now();

          // Deduplicate message by ID and content
          const isDuplicate = cust.messages.some(
            (m) =>
              (msg.id && m.id === msg.id) ||
              (m.sender === msg.sender &&
                ((m.text && m.text === safeText) || (m.voiceBase64 && m.voiceBase64 === msg.voiceBase64)) &&
                Math.abs(m.timestamp - (msg.timestamp || 0)) < 3000)
          );

          if (!isDuplicate) {
            cust.messages.push({
              id: msg.id || `MSG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              sender: msg.sender,
              text: safeText,
              voiceBase64: msg.voiceBase64,
              timestamp: msg.timestamp || Date.now(),
            });
          }

          return next;
        });

        setSelectedCustomerId((prev) => prev || msg.customerId);
      },
      onDocPayload: async (msg) => {
        const custId = msg.customerId || 'UNKNOWN';
        const docId = `DOC-${Math.random().toString(36).substring(2, 8)}`;
        const currentKey = sessionKeyRef.current;
        const safeFilename = SecurityGuards.sanitizeFilename(msg.metadata?.filename || 'Document');
        const safeCustomerName = SecurityGuards.sanitizeText(msg.customerName || '');

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
            const displayName = safeCustomerName || `Customer #${next.size + 1}`;
            if (!cust) {
              cust = {
                customerId: custId,
                customerName: displayName,
                joinedAt: Date.now(),
                lastActive: Date.now(),
                documents: [],
                messages: [],
                status: 'ACTIVE',
              };
              next.set(custId, cust);
            } else if (safeCustomerName) {
              cust.customerName = safeCustomerName;
            }

            cust.status = 'ACTIVE';
            cust.lastActive = Date.now();

            // Deduplicate: check if document already exists
            const existingDocIndex = cust.documents.findIndex(
              (d) => (msg.docHash && d.docHash === msg.docHash) ||
                     (d.filename === safeFilename && d.fileSize === (msg.metadata?.fileSize || 0))
            );

            if (existingDocIndex >= 0) {
              cust.documents[existingDocIndex].decryptedBuffer = plaintextBuffer;
              cust.documents[existingDocIndex].status = 'READY';
              return next;
            }

            cust.documents.push({
              id: docId,
              filename: safeFilename,
              fileType: msg.metadata?.fileType || 'application/pdf',
              fileSize: msg.metadata?.fileSize || 0,
              docHash: msg.docHash,
              watermarkText: SecurityGuards.sanitizeText(msg.metadata?.watermarkText || ''),
              maxCopies: msg.metadata?.maxCopies || 5,
              decryptedBuffer: plaintextBuffer,
              status: 'READY',
              receivedAt: Date.now(),
              copies: 1,
            });

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
              msg.docHash || 'UNKNOWN',
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

    relay.initShopTerminal(newSessionId, shopId, shopName);
  }, [shopId, shopName, toast, upiId, bwRate, colorRate]);

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

  // Voice Note Recording
  const startVoiceRecording = async () => {
    if (!selectedCustomer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result as string;
          const msgId = `VOICE-${Date.now()}`;
          const timestamp = Date.now();

          setCustomers((prev) => {
            const next = new Map(prev);
            const cust = next.get(selectedCustomer.customerId);
            if (cust) {
              cust.lastActive = timestamp;
              cust.messages.push({
                id: msgId,
                sender: 'SHOP',
                voiceBase64: b64,
                timestamp,
              });
            }
            return next;
          });

          relayRef.current?.send({
            type: 'CHAT_MESSAGE',
            roomId: sessionIdRef.current,
            customerId: selectedCustomer.customerId,
            id: msgId,
            sender: 'SHOP',
            voiceBase64: b64,
            timestamp,
          });

          sounds.playSuccess();
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
      setVoiceSeconds(0);
      voiceTimerRef.current = setInterval(() => setVoiceSeconds((s) => s + 1), 1000);
      sounds.playConnect();
    } catch (err) {
      toast.error('Microphone Access', 'Please allow microphone access to record voice note.');
    }
  };

  const stopVoiceRecording = (cancel = false) => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      if (cancel) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } else {
        mediaRecorderRef.current.stop();
      }
    }
    setIsRecordingVoice(false);
    setVoiceSeconds(0);
  };

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (voiceTimerRef.current) {
        clearInterval(voiceTimerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        } catch {}
      }
    };
  }, []);

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
            text: `🖨️ Document "${selectedDoc.filename}" sent to printer (${totalPages} page(s) × ${copies} copies).`,
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
          text: `🔥 Session terminated. All RAM zeroized and Certificate of Destruction issued.`,
          timestamp: Date.now(),
        });
      }
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
    <div className="flex-1 min-h-0 w-full h-full flex flex-col overflow-hidden">
      {/* ── AUTHENTIC WHATSAPP WEB SHELL ── */}
      <div className="w-full h-full bg-white rounded-none lg:rounded-[12px] shadow-[0_6px_24px_rgba(11,20,26,0.08)] border border-[#d1d7db] flex overflow-hidden">
        {/* ── LEFT PANE: WHATSAPP CHAT LIST (400px Desktop) ── */}
        <div
          className={`w-full lg:w-[400px] xl:w-[430px] shrink-0 bg-white border-r border-[#d1d7db] flex flex-col no-print h-full overflow-hidden ${
            mobileTab === 'WORKSPACE' && selectedCustomerId ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Top Terminal Header */}
          <div className="bg-[#075E54] px-4 py-3 flex items-center justify-between border-b border-[#bec9c5]/30 shrink-0 h-[64px]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                <Printer className="w-5 h-5" />
              </div>
              <div className="text-left leading-tight min-w-0">
                <div className="text-[15px] font-bold text-white truncate" title={shopName}>{shopName}</div>
                <div className="text-[12px] text-white/80 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-[#25D366] inline-block shrink-0 animate-pulse" />
                  <span className="truncate">Connected • RAM Only • 0 Disk</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-white/80 shrink-0">
              <button
                onClick={() => setShowShopSettingsModal(true)}
                className="p-2 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Shop Profile & Pricing Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowQRModal(true)}
                className="p-2 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Show Fullscreen Counter QR"
              >
                <QrCode className="w-5 h-5" />
              </button>

              <button
                onClick={initTerminal}
                className="p-2 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Refresh Session Keys"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 📲 Secure Transfer QR Card 📲 */}
          <div className="bg-[#fef9f0] p-3.5 border-b border-[#bec9c5]/30 flex flex-col items-center text-center shrink-0 space-y-2.5">
            <div className="w-full flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#00453d] uppercase tracking-wider">
                {t('secureTransferCardTitle')}
              </span>
              <span className="text-[10px] font-bold text-[#006d2f] bg-[#D9FDD3] px-2 py-0.5 rounded-full border border-[#3de273]/30 uppercase">
                {t('encryptedRamBadge')}
              </span>
            </div>

            {/* Counter QR Code */}
            <div
              onClick={() => setShowQRModal(true)}
              className="p-2.5 bg-white rounded-2xl border-2 border-[#00453d]/20 shadow-md cursor-pointer hover:scale-[1.02] transition-transform relative group"
              title="Click to view Fullscreen QR"
            >
              <QRCodeSVG
                value={customerUrl}
                size={140}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300453d' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                  x: undefined,
                  y: undefined,
                  height: 32,
                  width: 32,
                  excavate: true,
                }}
              />
              <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition-opacity">
                <span className="bg-black/75 text-white text-[10px] font-bold px-2 py-1 rounded-md">Click to Expand</span>
              </div>
            </div>

            <p className="text-[11.5px] text-[#6f7976] font-medium leading-tight">
              {t('pointPhoneTip')}
            </p>

            <div className="flex gap-2 w-full">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-1.5 px-2 rounded-xl bg-white hover:bg-[#f2ede5] text-[#00453d] text-[11.5px] font-bold flex items-center justify-center gap-1 border border-[#bec9c5]/50 shadow-xs cursor-pointer transition-colors"
              >
                {copiedQR ? <Check className="w-3.5 h-3.5 text-[#006d2f]" /> : <Copy className="w-3.5 h-3.5 text-[#6f7976]" />}
                <span>{copiedQR ? t('copied') : t('copyLink')}</span>
              </button>

              <button
                onClick={() => setShowStandeeModal(true)}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#00453d] hover:bg-[#075e54] text-white text-[11.5px] font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer transition-colors"
                title="Print Acrylic Counter Standee"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{t('standeeBtn')}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-[#fef9f0] p-3 border-b border-[#bec9c5]/30 space-y-2.5 shrink-0">
            <div className="bg-white rounded-xl h-10 flex items-center px-3.5 gap-2.5 border border-[#bec9c5]/40">
              <Search className="w-4 h-4 text-[#6f7976] shrink-0" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[13.5px] bg-transparent border-none focus:outline-none text-[#1d1c17] placeholder-[#6f7976]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterTab('ALL')}
                className={`px-3.5 py-1 rounded-full text-[12px] font-bold transition-all cursor-pointer ${
                  filterTab === 'ALL'
                    ? 'bg-[#008069] text-white shadow-xs'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                All ({customers.size})
              </button>
              <button
                onClick={() => setFilterTab('PENDING')}
                className={`px-3.5 py-1 rounded-full text-[12px] font-bold transition-all cursor-pointer ${
                  filterTab === 'PENDING'
                    ? 'bg-[#008069] text-white shadow-xs'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Waiting Print
              </button>
              <button
                onClick={() => setFilterTab('PRINTED')}
                className={`px-3.5 py-1 rounded-full text-[12px] font-bold transition-all cursor-pointer ${
                  filterTab === 'PRINTED'
                    ? 'bg-[#008069] text-white shadow-xs'
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
                <div className="w-14 h-14 rounded-full bg-[#f0f2f5] flex items-center justify-center mx-auto text-[#008069]">
                  <Users className="w-7 h-7" />
                </div>
                <div className="text-[16px] font-bold text-[#111b21]">{t('noCustomersActive')}</div>
                <p className="text-[13px] text-[#667781] leading-relaxed max-w-xs mx-auto">
                  {t('welcomeTerminalDesc')}
                </p>
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
                    className={`h-[76px] px-4 flex items-center gap-3.5 cursor-pointer transition-colors text-left ${
                      isSelected
                        ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                        : 'hover:bg-[#f5f6f6]'
                    }`}
                  >
                    {/* WhatsApp Circular Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#dfe5e7] text-[#54656f] font-bold flex items-center justify-center text-lg shadow-xs">
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
                        <span className="text-[15.5px] font-semibold text-[#111b21] truncate leading-5">
                          {cust.customerName}
                        </span>
                        <span className="text-[11.5px] text-[#667781] font-mono">
                          {new Date(cust.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <div className="text-[13px] text-[#667781] truncate flex items-center gap-1.5 max-w-[200px]">
                          {lastMsg?.text ? (
                            <>
                              {lastMsg.sender === 'SHOP' && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />}
                              <span className="truncate">{lastMsg.text}</span>
                            </>
                          ) : lastMsg?.voiceBase64 ? (
                            <>
                              <Mic className="w-3.5 h-3.5 text-[#008069] shrink-0" />
                              <span className="italic">Voice note</span>
                            </>
                          ) : lastDoc ? (
                            <>
                              <FileText className="w-3.5 h-3.5 text-[#008069] shrink-0" />
                              <span className="truncate">{lastDoc.filename}</span>
                            </>
                          ) : (
                            <span className="italic">Connected to RAM</span>
                          )}
                        </div>

                        {readyDocs.length > 0 ? (
                          <span className="w-5 h-5 rounded-full bg-[#25d366] text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-xs">
                            {readyDocs.length}
                          </span>
                        ) : cust.status === 'PRINTED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#e7f8ff] text-[#0284c7] text-[11px] font-bold shrink-0">
                            Printed
                          </span>
                        ) : cust.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#dc2626] text-[11px] font-bold shrink-0">
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
              <div className="max-w-md w-full p-8 bg-white/95 backdrop-blur-md rounded-3xl shadow-xl border border-[#d1d7db] space-y-4 my-auto">
                <div className="w-16 h-16 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
                  <Printer className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#00453d]">{t('welcomeTerminalTitle')}</h3>
                  <p className="text-[13.5px] text-[#6f7976] mt-1.5 leading-relaxed">
                    {t('welcomeTerminalDesc')}
                  </p>
                </div>

                {/* Big Center QR Code */}
                <div className="p-4 bg-[#f8fafc] rounded-2xl border-2 border-[#00a884] shadow-md inline-block mx-auto">
                  <QRCodeSVG
                    value={customerUrl}
                    size={190}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23008069' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="py-2.5 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors border border-[#d1d7db] cursor-pointer"
                  >
                    {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                    <span>{copiedQR ? t('copied') : t('copyLink')}</span>
                  </button>

                  <button
                    onClick={() => window.open(customerUrl, '_blank')}
                    className="py-2.5 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors shadow-md cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Open Test Customer Tab</span>
                  </button>
                </div>

                <div className="pt-3 border-t border-[#e9edef] flex items-center justify-center gap-1.5 text-[12px] text-[#667781] font-medium">
                  <Lock className="w-3.5 h-3.5 text-[#008069]" />
                  <span>End-to-end encrypted • Zero disk storage</span>
                </div>
              </div>
            </div>
          ) : (
            /* Active Customer WhatsApp Conversation */
            <div className="flex-1 min-h-0 flex flex-col bg-[#efeae2] overflow-hidden">
              {/* WhatsApp Active Chat Top Header */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-[#d1d7db] flex items-center justify-between shadow-xs shrink-0 h-[64px]">
                <div className="flex items-center gap-3 text-left min-w-0">
                  <button
                    onClick={() => setMobileTab('QUEUE')}
                    className="lg:hidden p-1.5 rounded-full hover:bg-black/10 text-[#54656f] shrink-0 cursor-pointer"
                    title="Back to Queue"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-[#008069] text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0">
                    {selectedCustomer.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[16px] font-bold text-[#111b21] flex items-center gap-2 truncate">
                      <span>{selectedCustomer.customerName}</span>
                      <span className="text-[11px] font-mono text-[#667781] font-normal">({selectedCustomer.customerId})</span>
                    </div>
                    <div className="text-[12px] text-[#008069] font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#25d366] inline-block shrink-0" />
                      <span className="truncate">online • {selectedCustomer.documents.length} document(s) in RAM</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {selectedDoc && (
                    <button
                      onClick={() => setIsViewerOpen(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Viewer</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleShredCustomer(selectedCustomer.customerId)}
                    disabled={isShredding}
                    className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center gap-1 border border-red-200 shadow-xs cursor-pointer"
                    title="Zeroize all RAM for this customer"
                  >
                    <Flame className="w-3.5 h-3.5 text-red-500" />
                    <span>Shred</span>
                  </button>
                </div>
              </div>

              {/* WhatsApp Chat Conversation Timeline */}
              <div className="flex-1 min-h-0 wa-chat-wallpaper overflow-y-auto p-4 sm:p-6 space-y-4 text-left">
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
                        <div className="wa-bubble-in max-w-[94%] sm:max-w-md p-4 space-y-3 border border-[#d1d7db]/50 shadow-sm">
                          <div className="flex items-center justify-between pb-1.5 border-b border-[#e9edef] text-[11.5px] font-bold text-[#008069]">
                            <span>ENCRYPTED FILE FROM {selectedCustomer.customerName.toUpperCase()}</span>
                            <span className="font-mono text-[#667781]">{(doc.fileSize / 1024).toFixed(1)} KB</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-[#f0f2f5] flex items-center gap-3.5 border border-[#d1d7db]">
                            <div className="p-3 rounded-xl bg-[#00a884]/15 text-[#008069] shrink-0">
                              <FileText className="w-6 h-6" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[14.5px] font-bold text-[#111b21] truncate" title={doc.filename}>
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
                              className="flex-1 py-2.5 px-3.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                              <span>Preview & Print Document</span>
                            </button>

                            <button
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
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
                        } max-w-[85%] sm:max-w-md px-4 py-2.5 space-y-1 shadow-sm border border-[#d1d7db]/40`}
                      >
                        {/* Voice Note Player */}
                        {msg.voiceBase64 && (
                          <VoiceNotePlayer
                            audioBase64={msg.voiceBase64}
                            timestamp={msg.timestamp}
                            isMe={isShop}
                          />
                        )}

                        {/* Text */}
                        {msg.text && (
                          <div className="text-[14.5px] text-[#111b21] leading-relaxed break-words font-normal">
                            {msg.text}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 text-[11px] text-[#667781] font-mono mt-0.5">
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
                <span className="text-[11px] font-bold text-[#667781] uppercase tracking-wider shrink-0">Quick Replies:</span>
                <button
                  onClick={() => handleSendReply('🖨️ Printing your document right now...')}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-[#d9fdd3] text-[#111b21] text-xs font-semibold border border-[#d1d7db] shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  🖨️ Printing now
                </button>
                <button
                  onClick={() => handleSendReply('✅ Printed & ready for pickup!')}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-[#d9fdd3] text-[#111b21] text-xs font-semibold border border-[#d1d7db] shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  ✅ Ready for pickup
                </button>
                <button
                  onClick={() => handleSendReply('⚠️ Please resend with clearer lighting.')}
                  className="px-3 py-1.5 rounded-full bg-white hover:bg-[#d9fdd3] text-[#111b21] text-xs font-semibold border border-[#d1d7db] shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  ⚠️ Resend clearer copy
                </button>
              </div>

              {/* Bottom WhatsApp Chat Input Bar */}
              <div className="bg-[#f0f2f5] px-3 sm:px-4 py-2.5 border-t border-[#d1d7db] flex items-center gap-2 sm:gap-3 shrink-0 safe-bottom">
                {isRecordingVoice ? (
                  <div className="flex-1 bg-red-50 px-4 h-11 rounded-2xl border border-red-200 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                      <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                      <span>Recording Voice Instruction ({voiceSeconds}s)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopVoiceRecording(true)}
                      className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 bg-white rounded-2xl h-11 px-4 flex items-center border border-[#d1d7db] focus-within:border-[#00a884] shadow-xs">
                    <input
                      type="text"
                      placeholder={`Type message to ${selectedCustomer.customerName}...`}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                      className="w-full text-[14.5px] bg-transparent border-none focus:outline-none text-[#111b21] placeholder-[#667781]"
                    />
                  </div>
                )}

                {replyText.trim() ? (
                  <button
                    onClick={() => handleSendReply()}
                    className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                  >
                    <Send className="w-5 h-5 ml-0.5" />
                  </button>
                ) : isRecordingVoice ? (
                  <button
                    onClick={() => stopVoiceRecording(false)}
                    className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                    title="Send voice note"
                  >
                    <Square className="w-4 h-4 fill-white" />
                  </button>
                ) : (
                  <button
                    onClick={startVoiceRecording}
                    className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                    title="Record voice instruction"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📄 Interactive WhatsApp Document Viewer Modal / Drawer 📄 */}
      {isViewerOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-2 sm:p-4 flex items-center justify-center animate-in zoom-in-95 duration-150 print:static print:p-0 print:m-0 print:bg-transparent print:backdrop-blur-none print:block">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-[#d1d7db] print:rounded-none print:border-none print:shadow-none print:w-full print:h-auto print:max-w-none print:p-0 print:m-0 print:bg-transparent">
            {/* Modal Header */}
            <div className="bg-[#008069] text-white px-5 py-3.5 flex items-center justify-between shadow-sm shrink-0 no-print">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-white" />
                <div className="text-left">
                  <div className="text-sm sm:text-base font-bold truncate max-w-md">{selectedDoc.filename}</div>
                  <div className="text-xs text-white/80 font-mono">
                    Sent by: {selectedCustomer?.customerName} • {(selectedDoc.fileSize / 1024).toFixed(1)} KB in RAM
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="px-4 py-2 rounded-xl bg-[#25d366] hover:bg-[#20ba5a] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Printing...' : t('printDocBtn')}</span>
                </button>

                <button
                  onClick={() => setIsViewerOpen(false)}
                  className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Adjustment Toolbar */}
            <div className="bg-[#f0f2f5] px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[#d1d7db] flex flex-wrap items-center justify-between gap-2 shrink-0 no-print">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg bg-white border border-[#d1d7db] text-[#54656f] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-[#111b21]">
                  {t('pageCounter')} {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg bg-white border border-[#d1d7db] text-[#54656f] disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-[#d1d7db] text-xs font-bold text-[#111b21] cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-[#008069]" />
                  <span>{rotation}°</span>
                </button>

                <div className="flex items-center bg-white p-0.5 rounded-lg border border-[#d1d7db] text-xs font-semibold">
                  <button
                    onClick={() => setFilterMode('NORMAL')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${filterMode === 'NORMAL' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f] hover:text-[#111b21]'}`}
                  >
                    {t('filterColor')}
                  </button>
                  <button
                    onClick={() => setFilterMode('GRAYSCALE')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${filterMode === 'GRAYSCALE' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f] hover:text-[#111b21]'}`}
                  >
                    {t('filterGrayscale')}
                  </button>
                  <button
                    onClick={() => setFilterMode('BW')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${filterMode === 'BW' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f] hover:text-[#111b21]'}`}
                  >
                    {t('filterPhotocopy')}
                  </button>
                  <button
                    onClick={() => setFilterMode('CAMSCAN')}
                    className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${filterMode === 'CAMSCAN' ? 'bg-[#008069] text-white shadow-xs' : 'text-[#54656f] hover:text-[#111b21]'}`}
                  >
                    {t('camScanEnhanced')}
                  </button>
                </div>

                {/* Copies Selector */}
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-[#d1d7db] text-xs">
                  <span className="text-[#54656f] font-medium">{t('copiesLabel')}</span>
                  <select
                    value={copies}
                    onChange={(e) => setCopies(parseInt(e.target.value, 10))}
                    className="bg-[#f0f2f5] text-[#008069] font-bold font-mono px-1.5 py-0.5 rounded border border-[#d1d7db] outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 10, 20].map((num) => (
                      <option key={num} value={num}>
                        {num} {num === 1 ? 'copy' : 'copies'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#d1d7db]">
                  <button onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.2))} className="p-0.5 text-[#54656f] hover:text-[#111b21] cursor-pointer" title="Zoom Out">
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono font-bold px-1 select-none">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.2))} className="p-0.5 text-[#54656f] hover:text-[#111b21] cursor-pointer" title="Zoom In">
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleDeleteDoc(selectedDoc.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold border border-red-200 flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('deleteFromRamBtn')}</span>
                </button>
              </div>
            </div>

            {/* Modal Canvas Viewer Area */}
            <div className="flex-1 min-h-0 bg-[#1e293b] p-4 flex items-center justify-center overflow-auto print:bg-transparent print:p-0 print:m-0 print:overflow-visible">
              <DRMCanvasViewer
                documentBuffer={selectedDoc.decryptedBuffer}
                fileType={selectedDoc.fileType}
                filename={selectedDoc.filename}
                watermarkText={selectedDoc.watermarkText}
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
                className="p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f] cursor-pointer"
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
                className="flex-1 py-2.5 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#d1d7db] cursor-pointer"
              >
                {copiedQR ? <Check className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4 text-[#54656f]" />}
                <span>{copiedQR ? 'Copied!' : 'Copy Pairing Link'}</span>
              </button>

              <button
                onClick={() => window.open(customerUrl, '_blank')}
                className="py-2.5 px-5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Test Mobile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Counter Standee Printable Sign Modal */}
      {showStandeeModal && (
        <StandeePrintModal
          isOpen={showStandeeModal}
          onClose={() => setShowStandeeModal(false)}
          customerUrl={customerUrl}
          shopName={shopName}
          shopId={shopId}
        />
      )}

      {/* Shop Profile & Pricing Settings Modal */}
      {showShopSettingsModal && (
        <ShopSettingsModal
          isOpen={showShopSettingsModal}
          onClose={() => setShowShopSettingsModal(false)}
          shopName={shopName}
          onSaveShopName={(name) => {
            setShopName(name);
            localStorage.setItem('cipherprint_shop_name', name);
          }}
          upiId={upiId}
          onSaveUpiId={(upi) => {
            setUpiId(upi);
            localStorage.setItem('cipherprint_upi_id', upi);
          }}
          bwRate={bwRate}
          onSaveBwRate={(rate) => {
            setBwRate(rate);
            localStorage.setItem('cipherprint_bw_rate', rate.toString());
          }}
          colorRate={colorRate}
          onSaveColorRate={(rate) => {
            setColorRate(rate);
            localStorage.setItem('cipherprint_color_rate', rate.toString());
          }}
          onRegenerateSession={initTerminal}
        />
      )}
    </div>
  );
};
