import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  Send,
  Plus,
  FileText,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Clock,
  Printer,
  Flame,
  Award,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  Eye,
  ShieldAlert,
  Camera
} from 'lucide-react';
import { QRScanner } from './QRScanner';
import { RedactionStudio } from './RedactionStudio';
import { WatermarkTool } from './WatermarkTool';
import { ShredCertificateModal } from './ShredCertificateModal';
import { importKeyFromHash, encryptDocument } from '../../crypto/e2ee';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';
import type { DestructionCertificate } from '../../crypto/ledger';

interface SentDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
  status: 'ENCRYPTING' | 'STREAMING' | 'DELIVERED' | 'PRINTING' | 'PRINTED' | 'SHREDDED';
  uploadProgress: number;
  timestamp: number;
  watermark?: string;
  copies: number;
  destructionCert?: DestructionCertificate | null;
}

export const CustomerPortal: React.FC = () => {
  const toast = useToast();

  // Session & Connection
  const [roomId, setRoomId] = useState<string | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [shopName, setShopName] = useState('SafePrint Station');
  const [shopId, setShopId] = useState('');
  const [customerId] = useState(() => `CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [customerName, setCustomerName] = useState('My Phone');

  // Attachment & Document State
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [sentDocs, setSentDocs] = useState<SentDocument[]>([]);
  const [watermarkText, setWatermarkText] = useState('');
  const [maxCopies, setMaxCopies] = useState(1);

  // Modals & Panels
  const [showSettings, setShowSettings] = useState(false);
  const [showRedactionStudio, setShowRedactionStudio] = useState(false);
  const [activeCert, setActiveCert] = useState<DestructionCertificate | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Parse URL on mount
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

    return () => {
      relayRef.current?.close();
    };
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sentDocs, selectedFile]);

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
          roomId: decodedRoom,
          customerId,
          customerName,
        });
      },
      onConnectedToShop: (data) => {
        setShopName(data.shopName);
        setShopId(data.shopId);
        sounds.playConnect();
        toast.shield('Connected to Xerox Shop', `Encrypted channel open with ${data.shopName}`);
      },
      onPrintStatus: (data) => {
        setSentDocs((prev) =>
          prev.map((doc) => {
            if (data.status === 'PRINTING') {
              sounds.playPrint();
              return { ...doc, status: 'PRINTING' };
            }
            if (data.status === 'PRINT_COMPLETED') {
              sounds.playSuccess();
              return { ...doc, status: 'PRINTED' };
            }
            return doc;
          })
        );
      },
      onShredConfirmed: (data) => {
        sounds.playShred();
        setSentDocs((prev) =>
          prev.map((doc) => ({
            ...doc,
            status: 'SHREDDED',
            destructionCert: data.certificate,
          }))
        );
        toast.shield('Document Shredded', 'Shopkeeper RAM zeroized. Proof generated.');
      },
    });
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File Too Large', 'Maximum file size is 25 MB.');
      return;
    }

    const buffer = await file.arrayBuffer();
    setSelectedFile({
      name: file.name,
      type: file.type || 'application/pdf',
      size: file.size,
      buffer,
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyRedaction = (newBuffer: ArrayBuffer) => {
    if (selectedFile) {
      setSelectedFile({
        ...selectedFile,
        buffer: newBuffer,
        size: newBuffer.byteLength,
      });
    }
    setShowRedactionStudio(false);
    sounds.playSuccess();
    toast.success('Redaction Applied', 'Sensitive ID masked in RAM.');
  };

  // Send document over E2EE relay stream
  const handleSendDocument = async () => {
    if (!selectedFile || !roomId || !keyHex || !relayRef.current) return;

    const docId = `DOC-${Date.now()}`;
    const newDoc: SentDocument = {
      id: docId,
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size,
      buffer: selectedFile.buffer,
      status: 'ENCRYPTING',
      uploadProgress: 0,
      timestamp: Date.now(),
      watermark: watermarkText || undefined,
      copies: maxCopies,
    };

    setSentDocs((prev) => [...prev, newDoc]);
    const fileToSend = selectedFile;
    setSelectedFile(null);

    try {
      sounds.playEncrypt();
      const cryptoKey = await importKeyFromHash(keyHex);
      const encrypted = await encryptDocument(fileToSend.buffer, cryptoKey);

      setSentDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'STREAMING' } : d))
      );

      const metadata = {
        filename: fileToSend.name,
        fileType: fileToSend.type,
        fileSize: fileToSend.size,
        docHash: encrypted.docHash,
        watermarkText: watermarkText || undefined,
        maxCopies,
      };

      await relayRef.current.sendEncryptedChunks(
        roomId,
        customerId,
        customerName,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.docHash,
        metadata,
        (progress) => {
          setSentDocs((prev) =>
            prev.map((d) => (d.id === docId ? { ...d, uploadProgress: progress } : d))
          );
        }
      );

      setSentDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: 'DELIVERED', uploadProgress: 100 } : d))
      );
      sounds.playSuccess();
    } catch (err) {
      console.error('[SafePrint Customer] Send error:', err);
      toast.error('Send Failed', 'Could not stream encrypted document.');
    }
  };

  const handleReset = () => {
    relayRef.current?.close();
    setRoomId(null);
    setKeyHex(null);
    setSentDocs([]);
    setSelectedFile(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <div className="max-w-xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
      {/* ── STEP 1: Not Paired -> Scan QR ── */}
      {!roomId ? (
        <QRScanner onSessionDecoded={handleSessionDecoded} />
      ) : (
        /* ── STEP 2: WhatsApp Chat Interface ── */
        <div className="wa-panel-elevated rounded-2xl overflow-hidden flex flex-col h-[calc(100vh-120px)] sm:h-[680px] border border-[#d1d7db] shadow-xl">
          {/* WhatsApp Chat Top Header */}
          <div className="bg-[#008069] text-white p-3 sm:p-3.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Disconnect & Exit Chat"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-white text-sm">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25d366] border border-white" />
              </div>

              <div className="text-left">
                <div className="text-sm font-bold flex items-center gap-1.5 leading-tight">
                  <span>{shopName}</span>
                </div>
                <div className="text-[11px] text-white/80 font-mono flex items-center gap-1">
                  <span>🟢 Connected • 0 KB Disk Storage</span>
                </div>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-white/30 text-white' : 'hover:bg-white/20 text-white/90'}`}
                title="Print Copies & Watermark Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Settings Sheet (Dropdown) */}
          {showSettings && (
            <div className="bg-white p-3 border-b border-[#e9edef] shadow-inner text-left animate-in slide-in-from-top duration-200 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#54656f] block">
                  Your Name / Token (Shows on Shopkeeper Screen):
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-1.5 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] text-xs text-[#111b21] focus:outline-none focus:border-[#00a884]"
                />
              </div>

              <WatermarkTool
                watermarkText={watermarkText}
                maxCopies={maxCopies}
                onWatermarkChange={setWatermarkText}
                onMaxCopiesChange={setMaxCopies}
              />
            </div>
          )}

          {/* ── CHAT MESSAGES FEED (WhatsApp Wallpaper) ── */}
          <div className="flex-1 wa-chat-wallpaper overflow-y-auto p-4 space-y-3 text-left">
            {/* WhatsApp System Encryption Pill */}
            <div className="wa-system-pill flex items-center justify-center gap-1.5 text-center">
              <Lock className="w-3 h-3 text-[#54656f] shrink-0" />
              <span>
                Documents sent in this chat are end-to-end encrypted. Held strictly in printer RAM.
              </span>
            </div>

            {/* Sent Documents List as WhatsApp Document Message Bubbles */}
            {sentDocs.map((doc) => {
              const isPdf = doc.type.includes('pdf') || doc.name.toLowerCase().endsWith('.pdf');

              return (
                <div key={doc.id} className="flex justify-end">
                  <div className="wa-bubble-out max-w-[85%] sm:max-w-sm p-3 space-y-2 border border-[#d1d7db]/40">
                    {/* Document Icon & Details Box */}
                    <div className="p-2.5 rounded-lg bg-[#ffffff]/90 flex items-center gap-3 border border-[#00a884]/20 shadow-sm">
                      <div className="p-2.5 rounded-lg bg-[#00a884]/15 text-[#008069] shrink-0">
                        {isPdf ? <FileText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#111b21] truncate" title={doc.name}>
                          {doc.name}
                        </div>
                        <div className="text-[10px] text-[#667781] font-mono mt-0.5">
                          {(doc.size / 1024).toFixed(1)} KB • {doc.copies} {doc.copies === 1 ? 'copy' : 'copies'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar (if streaming) */}
                    {doc.status === 'STREAMING' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-[#54656f] font-mono">
                          <span>Streaming AES-256 chunks...</span>
                          <span>{doc.uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#00a884] h-full transition-all duration-150"
                            style={{ width: `${doc.uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Watermark Tag (if applied) */}
                    {doc.watermark && (
                      <div className="text-[10px] text-[#008069] font-mono bg-[#d9fdd3] px-2 py-0.5 rounded border border-[#00a884]/30 inline-block">
                        Watermark: {doc.watermark}
                      </div>
                    )}

                    {/* Message Bubble Footer: Time & Status Ticks */}
                    <div className="flex items-center justify-between pt-1 border-t border-[#00a884]/10 text-[10px]">
                      <span className="text-[#667781] font-mono">
                        {new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1">
                        {doc.status === 'ENCRYPTING' && (
                          <span className="text-[#54656f] flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" /> Encrypting
                          </span>
                        )}

                        {doc.status === 'STREAMING' && (
                          <span className="text-[#008069] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Streaming
                          </span>
                        )}

                        {doc.status === 'DELIVERED' && (
                          <span className="text-[#54656f] flex items-center gap-1 font-semibold">
                            <CheckCheck className="w-3.5 h-3.5 text-[#54656f]" /> In Shop RAM
                          </span>
                        )}

                        {doc.status === 'PRINTING' && (
                          <span className="text-[#0284c7] font-bold flex items-center gap-1 animate-pulse">
                            <Printer className="w-3.5 h-3.5" /> Printing...
                          </span>
                        )}

                        {doc.status === 'PRINTED' && (
                          <span className="text-[#53bdeb] font-bold flex items-center gap-1">
                            <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /> Printed
                          </span>
                        )}

                        {doc.status === 'SHREDDED' && (
                          <button
                            onClick={() => doc.destructionCert && setActiveCert(doc.destructionCert)}
                            className="text-[#dc2626] font-bold flex items-center gap-1 hover:underline"
                          >
                            <Flame className="w-3 h-3 text-[#dc2626]" /> Shredded Proof
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Selected Staged File Preview Bubble */}
            {selectedFile && (
              <div className="flex justify-end">
                <div className="wa-bubble-out max-w-[85%] sm:max-w-sm p-3 space-y-2.5 border-2 border-[#00a884] shadow-md animate-in fade-in duration-200">
                  <div className="text-[11px] font-bold text-[#008069] flex items-center justify-between">
                    <span>Ready to Encrypt & Send</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-[#667781] hover:text-red-500 text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white flex items-center gap-3 border border-[#d1d7db]">
                    <div className="p-2 rounded bg-[#00a884]/15 text-[#008069]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[#111b21] truncate">{selectedFile.name}</div>
                      <div className="text-[10px] text-[#667781] font-mono">
                        {(selectedFile.size / 1024).toFixed(1)} KB • In RAM
                      </div>
                    </div>
                  </div>

                  {selectedFile.type.startsWith('image/') && (
                    <button
                      onClick={() => setShowRedactionStudio(true)}
                      className="w-full py-1.5 rounded-lg bg-[#e7f8ff] text-[#0284c7] hover:bg-[#d0f0fd] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-[#0284c7]/30"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Mask / Redact Sensitive ID</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* ── CHAT INPUT ATTACHMENT BAR (WhatsApp Style) ── */}
          <div className="bg-[#f0f2f5] p-2 sm:p-2.5 flex items-center gap-2 border-t border-[#e9edef]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFilePicked}
              className="hidden"
            />

            {/* Attach Document Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full hover:bg-[#e9edef] text-[#54656f] transition-colors"
              title="Attach PDF or Image Document"
            >
              <Plus className="w-5 h-5 text-[#54656f]" />
            </button>

            {/* Quick Status / Input Display */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-white px-3.5 py-2.5 rounded-2xl text-xs text-[#667781] border border-[#e9edef] cursor-pointer hover:border-[#00a884] transition-colors truncate"
            >
              {selectedFile ? (
                <span className="text-[#111b21] font-semibold">{selectedFile.name}</span>
              ) : (
                <span>Tap (+) to choose document (PDF, JPG, PNG)...</span>
              )}
            </div>

            {/* Send Button (WhatsApp Circular Teal Button) */}
            <button
              onClick={handleSendDocument}
              disabled={!selectedFile}
              className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 disabled:cursor-not-allowed shrink-0"
              title="Encrypt & Send to Xerox Shop Terminal"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* Redaction Studio Modal */}
      {showRedactionStudio && selectedFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center">
          <RedactionStudio
            imageBuffer={selectedFile.buffer}
            onApplyRedaction={handleApplyRedaction}
            onCancel={() => setShowRedactionStudio(false)}
          />
        </div>
      )}

      {/* Verifiable Shred Proof Modal */}
      {activeCert && (
        <ShredCertificateModal certificate={activeCert} onNewSession={() => setActiveCert(null)} />
      )}
    </div>
  );
};
