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
  ChevronLeft,
  ShieldAlert,
  Camera,
  Paperclip,
  Smile,
  SlidersHorizontal,
  UserCheck,
  MoreVertical
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

  // Session & Pairing
  const [roomId, setRoomId] = useState<string | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [shopName, setShopName] = useState('SafePrint Express Station');
  const [shopId, setShopId] = useState('');
  const [customerId] = useState(() => `CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [customerName, setCustomerName] = useState('My Phone');

  // File staging
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    buffer: ArrayBuffer;
  } | null>(null);
  const [sentDocs, setSentDocs] = useState<SentDocument[]>([]);
  const [watermarkText, setWatermarkText] = useState('');
  const [maxCopies, setMaxCopies] = useState(1);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showRedactionStudio, setShowRedactionStudio] = useState(false);
  const [activeCert, setActiveCert] = useState<DestructionCertificate | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Parse URL parameters on load
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
        toast.shield('Paired to Shop Terminal', `Connected to ${data.shopName}`);
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
    setShowAttachmentMenu(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleLoadDemoDocument = (docType: 'AADHAAR' | 'PASSPORT' | 'MARKSHEET' | 'INVOICE') => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1050;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 1050);

    // Border
    ctx.strokeStyle = '#008069';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 760, 1010);

    // Header Bar
    ctx.fillStyle = '#008069';
    ctx.fillRect(20, 20, 760, 80);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('SAFEPRINT SECURE DEMO DOCUMENT', 50, 70);

    if (docType === 'AADHAAR') {
      ctx.fillStyle = '#111b21';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SAMPLE AADHAAR IDENTIFICATION CARD', 50, 150);

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(50, 180, 180, 220);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('ID PHOTO', 105, 295);

      ctx.fillStyle = '#1e293b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Name: ALEX KUMAR DOE', 260, 210);
      ctx.fillText('DOB: 15/08/1996', 260, 250);
      ctx.fillText('Gender: MALE', 260, 290);
      ctx.fillText('Address: 42 MG Road, Cyber City, Bangalore - 560001', 260, 330);

      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(50, 440, 700, 80);
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(50, 440, 700, 80);
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('8921  •  4490  •  7712', 220, 492);
      ctx.font = '12px sans-serif';
      ctx.fillText('(Sensitive Aadhaar Number — Mask with Redaction Studio)', 200, 512);
    } else if (docType === 'PASSPORT') {
      ctx.fillStyle = '#111b21';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('REPUBLIC OF PASSPORT DOCUMENT (SAMPLE)', 50, 150);

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(50, 180, 180, 220);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('PASSPORT PHOTO', 80, 295);

      ctx.fillStyle = '#1e293b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Passport No: Z88921004', 260, 210);
      ctx.fillText('Surname: DOE', 260, 250);
      ctx.fillText('Given Name: ALEX KUMAR', 260, 290);
      ctx.fillText('Nationality: INDIAN', 260, 330);
    } else if (docType === 'MARKSHEET') {
      ctx.fillStyle = '#111b21';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('UNIVERSITY DEGREE & MARKSHEET (SAMPLE)', 50, 150);

      ctx.fillStyle = '#1e293b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Candidate: ALEX DOE', 50, 200);
      ctx.fillText('Roll No: 2026-ENG-491', 50, 235);
      ctx.fillText('Degree: Bachelor of Computer Engineering (First Class with Distinction)', 50, 270);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(50, 310, 700, 200);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(50, 310, 700, 200);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Subject                    Max Marks     Obtained', 70, 340);
      ctx.font = '14px monospace';
      ctx.fillText('Data Structures & Algo        100           98', 70, 375);
      ctx.fillText('Cryptography & Security       100           99', 70, 410);
      ctx.fillText('Operating Systems             100           95', 70, 445);
    } else {
      ctx.fillStyle = '#111b21';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAX INVOICE & PROOF OF BILLING', 50, 150);
      ctx.fillStyle = '#1e293b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Invoice No: INV-2026-8841', 50, 200);
      ctx.fillText('Date: 28/08/2026', 50, 235);
      ctx.fillText('Client: Alex Doe | Total: $1,450.00 (PAID)', 50, 270);
    }

    // Convert canvas to Blob
    canvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buf) => {
        setSelectedFile({
          name: `Sample_${docType.charAt(0) + docType.slice(1).toLowerCase()}.png`,
          type: 'image/png',
          size: buf.byteLength,
          buffer: buf,
        });
        setShowAttachmentMenu(false);
        sounds.playConnect();
        toast.info('Demo Injected', `Loaded synthetic ${docType} document.`);
      });
    }, 'image/png');
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

      await relayRef.current.sendEncryptedPayload(
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
    <div className="max-w-xl mx-auto px-2 sm:px-4 py-2 sm:py-3 w-full">
      {/* ── STEP 1: Not Paired -> Scan QR ── */}
      {!roomId ? (
        <div className="space-y-4">
          <QRScanner onSessionDecoded={handleSessionDecoded} />
        </div>
      ) : (
        /* ── STEP 2: Authentic WhatsApp Chat Interface ── */
        <div className="wa-panel-elevated rounded-2xl overflow-hidden flex flex-col h-[calc(100dvh-120px)] sm:h-[680px] border border-[#d1d7db] shadow-2xl relative">
          {/* WhatsApp Chat Top Header */}
          <div className="bg-[#008069] text-white px-3 py-2.5 sm:py-3 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleReset}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Disconnect"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#25d366] border-2 border-[#008069]" />
              </div>

              <div className="text-left min-w-0">
                <div className="text-sm font-bold truncate flex items-center gap-1">
                  <span>{shopName}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25d366]" />
                </div>
                <div className="text-[11px] text-white/85 flex items-center gap-1 font-mono">
                  <span>🟢 Online • Encrypted RAM</span>
                </div>
              </div>
            </div>

            {/* Header Right Settings */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors ${
                  showSettings ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-white'
                }`}
                title="Printing & Watermark Options"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Settings Dropdown */}
          {showSettings && (
            <div className="bg-white p-3 border-b border-[#e9edef] shadow-md text-left animate-in slide-in-from-top duration-200 space-y-3 shrink-0">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[#54656f] block">
                  Your Display Name (shown to shopkeeper):
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

          {/* ── CHAT MESSAGES FEED ── */}
          <div className="flex-1 wa-chat-wallpaper overflow-y-auto p-4 sm:p-5 space-y-3.5 text-left">
            {/* System Encryption Pill */}
            <div className="wa-system-pill flex items-center justify-center gap-2 text-center text-xs py-2 px-4 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-[#54656f] shrink-0" />
              <span>
                🔒 Documents sent in this chat are AES-256 encrypted directly in printer RAM.
              </span>
            </div>

            {/* Sent Documents List */}
            {sentDocs.map((doc) => {
              const isPdf = doc.type.includes('pdf') || doc.name.toLowerCase().endsWith('.pdf');

              return (
                <div key={doc.id} className="flex justify-end animate-in fade-in duration-150">
                  <div className="wa-bubble-out max-w-[94%] sm:max-w-md p-3.5 space-y-2.5 border border-[#d1d7db]/40 shadow-sm">
                    <div className="p-3 rounded-xl bg-white flex items-center gap-3.5 border border-[#00a884]/20 shadow-sm">
                      <div className="p-2.5 rounded-xl bg-[#00a884]/15 text-[#008069] shrink-0">
                        {isPdf ? <FileText className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[#111b21] truncate" title={doc.name}>
                          {doc.name}
                        </div>
                        <div className="text-xs text-[#667781] font-mono mt-0.5">
                          {(doc.size / 1024).toFixed(1)} KB • {doc.copies} {doc.copies === 1 ? 'copy' : 'copies'}
                        </div>
                      </div>
                    </div>

                    {doc.status === 'STREAMING' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-[#54656f] font-mono">
                          <span>Streaming AES-256 chunks...</span>
                          <span>{doc.uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#00a884] h-full transition-all duration-150"
                            style={{ width: `${doc.uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {doc.watermark && (
                      <div className="text-xs text-[#008069] font-mono bg-[#d9fdd3] px-2.5 py-1 rounded-md border border-[#00a884]/30 inline-block font-semibold">
                        Watermark: {doc.watermark}
                      </div>
                    )}

                    {/* Bubble Footer */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-[#00a884]/10 text-xs">
                      <span className="text-[#667781] font-mono">
                        {new Date(doc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {doc.status === 'ENCRYPTING' && (
                          <span className="text-[#54656f] flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5 animate-spin" /> Encrypting
                          </span>
                        )}

                        {doc.status === 'STREAMING' && (
                          <span className="text-[#008069] flex items-center gap-1 font-semibold">
                            <Check className="w-4 h-4" /> Sending
                          </span>
                        )}

                        {doc.status === 'DELIVERED' && (
                          <span className="text-[#54656f] flex items-center gap-1 font-bold">
                            <CheckCheck className="w-4 h-4 text-[#54656f]" /> In Shop RAM
                          </span>
                        )}

                        {doc.status === 'PRINTING' && (
                          <span className="text-[#0284c7] font-bold flex items-center gap-1 animate-pulse">
                            <Printer className="w-4 h-4" /> Printing...
                          </span>
                        )}

                        {doc.status === 'PRINTED' && (
                          <span className="text-[#53bdeb] font-bold flex items-center gap-1">
                            <CheckCheck className="w-4 h-4 text-[#53bdeb]" /> Printed
                          </span>
                        )}

                        {doc.status === 'SHREDDED' && (
                          <button
                            onClick={() => doc.destructionCert && setActiveCert(doc.destructionCert)}
                            className="text-[#dc2626] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Flame className="w-3.5 h-3.5 text-[#dc2626]" /> Shredded Proof
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Staged File Preview */}
            {selectedFile && (
              <div className="flex justify-end animate-in zoom-in-95 duration-150">
                <div className="wa-bubble-out max-w-[94%] sm:max-w-md p-4 space-y-3 border-2 border-[#00a884] shadow-md">
                  <div className="text-xs sm:text-sm font-bold text-[#008069] flex items-center justify-between">
                    <span>Ready to Encrypt & Send</span>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-[#667781] hover:text-red-500 text-sm font-bold p-1"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-white flex items-center gap-3 border border-[#d1d7db]">
                    <div className="p-2.5 rounded-xl bg-[#00a884]/15 text-[#008069]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[#111b21] truncate">{selectedFile.name}</div>
                      <div className="text-xs text-[#667781] font-mono mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Staged in RAM
                      </div>
                    </div>
                  </div>

                  {selectedFile.type.startsWith('image/') && (
                    <button
                      onClick={() => setShowRedactionStudio(true)}
                      className="w-full py-2 rounded-xl bg-[#e7f8ff] text-[#0284c7] hover:bg-[#d0f0fd] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors border border-[#0284c7]/30 cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4" />
                      <span>Mask Private ID Numbers</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* WhatsApp Attachment Sheet Popover */}
          {showAttachmentMenu && (
            <div className="absolute bottom-16 left-3 bg-white rounded-2xl p-3 shadow-2xl border border-[#d1d7db] flex flex-col gap-3 animate-in slide-in-from-bottom duration-150 z-30 max-w-xs">
              <div className="flex gap-4 items-center justify-between">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#8f3985] text-white flex items-center justify-center shadow-md">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-[#54656f] font-semibold">Document</span>
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#d3396d] text-white flex items-center justify-center shadow-md">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-[#54656f] font-semibold">Camera</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors"
                >
                  <div className="w-11 h-11 rounded-full bg-[#ac44cf] text-white flex items-center justify-center shadow-md">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] text-[#54656f] font-semibold">Gallery</span>
                </button>
              </div>

              {/* Instant 1-Click Synthetic Demo Documents */}
              <div className="pt-2 border-t border-[#e9edef] space-y-1.5 text-left">
                <div className="text-[10px] font-bold text-[#008069] uppercase tracking-wider">Instant Demo Documents:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleLoadDemoDocument('AADHAAR')}
                    className="px-2 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#d9fdd3] text-[#111b21] text-[10px] font-semibold transition-colors text-left truncate border border-[#d1d7db]"
                  >
                    🪪 Aadhaar Card
                  </button>
                  <button
                    onClick={() => handleLoadDemoDocument('PASSPORT')}
                    className="px-2 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#d9fdd3] text-[#111b21] text-[10px] font-semibold transition-colors text-left truncate border border-[#d1d7db]"
                  >
                    🛂 Passport
                  </button>
                  <button
                    onClick={() => handleLoadDemoDocument('MARKSHEET')}
                    className="px-2 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#d9fdd3] text-[#111b21] text-[10px] font-semibold transition-colors text-left truncate border border-[#d1d7db]"
                  >
                    📜 Marksheet
                  </button>
                  <button
                    onClick={() => handleLoadDemoDocument('INVOICE')}
                    className="px-2 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#d9fdd3] text-[#111b21] text-[10px] font-semibold transition-colors text-left truncate border border-[#d1d7db]"
                  >
                    🧾 Tax Invoice
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── AUTHENTIC WHATSAPP INPUT BAR ── */}
          <div className="bg-[#f0f2f5] p-2 sm:p-2.5 flex items-center gap-2 border-t border-[#e9edef] shrink-0">
            {/* Hidden native pickers */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={handleFilePicked}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFilePicked}
              className="hidden"
            />

            {/* Smiley Emoji Icon */}
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-1.5 rounded-full hover:bg-[#e9edef] text-[#54656f] transition-colors"
            >
              <Smile className="w-6 h-6 text-[#54656f]" />
            </button>

            {/* Paperclip Attachment Button */}
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-1.5 rounded-full hover:bg-[#e9edef] text-[#54656f] transition-colors"
              title="Attach Document / Camera"
            >
              <Paperclip className="w-5 h-5 text-[#54656f]" />
            </button>

            {/* Input Bubble */}
            <div
              onClick={() => setShowAttachmentMenu(true)}
              className="flex-1 bg-white px-3.5 py-2.5 rounded-2xl text-xs text-[#667781] border border-[#e9edef] cursor-pointer hover:border-[#00a884] transition-colors truncate"
            >
              {selectedFile ? (
                <span className="text-[#111b21] font-semibold truncate block">{selectedFile.name}</span>
              ) : (
                <span>Type a message or attach document...</span>
              )}
            </div>

            {/* WhatsApp Send / Mic Button */}
            <button
              onClick={handleSendDocument}
              disabled={!selectedFile}
              className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 disabled:cursor-not-allowed shrink-0"
              title="Send to Xerox Shop"
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

      {/* Shred Certificate Modal */}
      {activeCert && (
        <ShredCertificateModal certificate={activeCert} onNewSession={() => setActiveCert(null)} />
      )}
    </div>
  );
};
