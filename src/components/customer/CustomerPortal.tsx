import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Lock,
  Camera,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Clock,
  Printer,
  Flame,
  ChevronLeft,
  Paperclip,
  Smile,
  Send,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  User,
  X,
  Mic,
  Square,
  Smartphone,
  ExternalLink,
  Plus,
  Trash2
} from 'lucide-react';
import { importKeyFromHash, encryptDocument } from '../../crypto/e2ee';
import { SecurityGuards } from '../../crypto/securityGuards';
import { RelaySocket } from '../../services/relaySocket';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';
import { QRScanner } from './QRScanner';
import { RedactionStudio } from './RedactionStudio';
import { WatermarkTool } from './WatermarkTool';
import { ShredCertificateModal } from './ShredCertificateModal';
import { VoiceNotePlayer } from '../shared/VoiceNotePlayer';
import { DestructionCertificate } from '../../crypto/ledger';

interface StagedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
  watermark?: string;
  copies: number;
}

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
  destructionCert?: DestructionCertificate;
}

interface ChatMessage {
  id: string;
  sender: 'CUSTOMER' | 'SHOP' | 'SYSTEM';
  text?: string;
  voiceBase64?: string;
  timestamp: number;
}

export const CustomerPortal: React.FC = () => {
  const toast = useToast();

  // Session & Pairing
  const [roomId, setRoomId] = useState<string | null>(null);
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const [shopName, setShopName] = useState('SafePrint Express Station');
  const [shopId, setShopId] = useState('');
  const [customerId] = useState(() => `CUST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [customerName, setCustomerName] = useState<string>(() => {
    return localStorage.getItem('safeprint_customer_name') || '';
  });

  // Multi-File Staging
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [sentDocs, setSentDocs] = useState<SentDocument[]>([]);
  const [watermarkText, setWatermarkText] = useState('');
  const [maxCopies, setMaxCopies] = useState(1);

  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showRedactionStudio, setShowRedactionStudio] = useState(false);
  const [activeRedactionFileId, setActiveRedactionFileId] = useState<string | null>(null);
  const [activeCert, setActiveCert] = useState<DestructionCertificate | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const relayRef = useRef<RelaySocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const [textMessages, setTextMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');

  // Persist customer name
  const handleNameChange = (name: string) => {
    setCustomerName(name);
    localStorage.setItem('safeprint_customer_name', name);
  };

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
  }, [sentDocs, textMessages, stagedFiles]);

  const handleSessionDecoded = (decodedRoom: string, decodedKey: string) => {
    setRoomId(decodedRoom);
    setKeyHex(decodedKey);

    if (relayRef.current) {
      relayRef.current.close();
    }

    const relay = new RelaySocket();
    relayRef.current = relay;

    const activeName = customerName.trim() || 'Customer';

    relay.connect({
      onOpen: () => {
        relay.send({
          type: 'JOIN_CUSTOMER',
          roomId: decodedRoom,
          customerId,
          customerName: activeName,
        });
      },
      onConnectedToShop: (data) => {
        setShopName(data.shopName);
        setShopId(data.shopId);
        sounds.playConnect();
        toast.shield('Paired to Shop Terminal', `Connected to ${data.shopName}`);
      },
      onChatMessage: (msg) => {
        sounds.playSuccess();
        setTextMessages((prev) => [
          ...prev,
          {
            id: msg.id || `MSG-${Date.now()}`,
            sender: msg.sender,
            text: msg.text,
            voiceBase64: msg.voiceBase64,
            timestamp: msg.timestamp || Date.now(),
          },
        ]);
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

  const processIncomingFiles = async (files: FileList | File[]) => {
    const newStaged: StagedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!SecurityGuards.validateFileSize(file.size)) {
        toast.error('File Too Large', `${file.name} exceeds 50 MB limit.`);
        continue;
      }

      const safeFilename = SecurityGuards.sanitizeFilename(file.name);
      const buffer = await file.arrayBuffer();

      newStaged.push({
        id: `STAGED-${Math.random().toString(36).substring(2, 8)}`,
        name: safeFilename,
        type: file.type || 'application/pdf',
        size: file.size,
        buffer,
        watermark: watermarkText || undefined,
        copies: maxCopies,
      });
    }

    if (newStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...newStaged]);
      setShowAttachmentMenu(false);
      sounds.playSuccess();
      toast.success('Files Ready', `${newStaged.length} file(s) staged in RAM.`);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await processIncomingFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processIncomingFiles(e.dataTransfer.files);
    }
  };

  const handleApplyRedaction = (newBuffer: ArrayBuffer) => {
    if (activeRedactionFileId) {
      setStagedFiles((prev) =>
        prev.map((f) => (f.id === activeRedactionFileId ? { ...f, buffer: newBuffer } : f))
      );
    }
    setShowRedactionStudio(false);
    setActiveRedactionFileId(null);
    sounds.playSuccess();
    toast.success('Redaction Applied', 'Sensitive ID masked in RAM.');
  };

  const handleSendAllStagedDocuments = async () => {
    if (stagedFiles.length === 0 || !roomId || !keyHex || !relayRef.current) return;

    const filesToSend = [...stagedFiles];
    setStagedFiles([]);

    const activeName = customerName.trim() || 'Customer';
    const cryptoKey = await importKeyFromHash(keyHex);

    for (const staged of filesToSend) {
      const docId = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newDoc: SentDocument = {
        id: docId,
        name: staged.name,
        type: staged.type,
        size: staged.size,
        buffer: staged.buffer,
        status: 'ENCRYPTING',
        uploadProgress: 0,
        timestamp: Date.now(),
        watermark: staged.watermark || watermarkText || undefined,
        copies: staged.copies || maxCopies,
      };

      setSentDocs((prev) => [...prev, newDoc]);

      try {
        sounds.playEncrypt();
        const encrypted = await encryptDocument(staged.buffer, cryptoKey);

        setSentDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: 'STREAMING' } : d))
        );

        const metadata = {
          filename: staged.name,
          fileType: staged.type,
          fileSize: staged.size,
          docHash: encrypted.docHash,
          watermarkText: staged.watermark || watermarkText || undefined,
          maxCopies: staged.copies || maxCopies,
        };

        await relayRef.current.sendEncryptedPayload(
          roomId,
          customerId,
          activeName,
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
        toast.error('Send Failed', `Could not send ${staged.name}`);
      }
    }
  };

  const handleReset = () => {
    relayRef.current?.close();
    setRoomId(null);
    setKeyHex(null);
    setSentDocs([]);
    setTextMessages([]);
    setStagedFiles([]);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // ── IN-MEMORY VOICE NOTE RECORDING ──
  const startVoiceRecording = async () => {
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

        // Convert to Base64 in RAM
        const reader = new FileReader();
        reader.onloadend = () => {
          const b64 = reader.result as string;
          const msgId = `VOICE-${Date.now()}`;
          const timestamp = Date.now();

          setTextMessages((prev) => [
            ...prev,
            {
              id: msgId,
              sender: 'CUSTOMER',
              voiceBase64: b64,
              timestamp,
            },
          ]);

          relayRef.current?.send({
            type: 'CHAT_MESSAGE',
            roomId,
            customerId,
            customerName: customerName.trim() || 'Customer',
            id: msgId,
            sender: 'CUSTOMER',
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

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const msgText = inputText.trim();
    const msgId = `MSG-${Date.now()}`;
    const timestamp = Date.now();

    setTextMessages((prev) => [
      ...prev,
      {
        id: msgId,
        sender: 'CUSTOMER',
        text: msgText,
        timestamp,
      },
    ]);

    relayRef.current?.send({
      type: 'CHAT_MESSAGE',
      roomId,
      customerId,
      customerName: customerName.trim() || 'Customer',
      id: msgId,
      sender: 'CUSTOMER',
      text: msgText,
      timestamp,
    });

    setInputText('');
    sounds.playSuccess();
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
        <div className="wa-panel-elevated rounded-2xl overflow-hidden flex flex-col h-[calc(100dvh-120px)] sm:h-[700px] border border-[#d1d7db] shadow-2xl relative">
          {/* WhatsApp Chat Top Header (#075E54) */}
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0 h-[64px]">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={handleReset}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Disconnect"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                  <Printer className="w-5 h-5" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25D366] border-2 border-[#075E54]" />
              </div>

              <div className="text-left min-w-0">
                <div className="text-[15px] font-bold truncate flex items-center gap-1.5 leading-tight">
                  <span>{shopName || 'QuickXerox Station #01'}</span>
                  <ShieldCheck className="w-4 h-4 text-[#3de273] shrink-0" />
                </div>
                <div className="text-[12px] text-white/85 flex items-center gap-1.5 font-medium mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse shrink-0" />
                  <span className="truncate">Online • In-RAM Session Active</span>
                </div>
              </div>
            </div>

            {/* Header Right Settings */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  showSettings ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-white'
                }`}
                title="Print & Security Settings"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Customer Strip */}
          <div className="bg-[#fef9f0] px-4 py-2 border-b border-[#bec9c5]/30 flex items-center justify-between text-left shrink-0 shadow-xs">
            <span className="text-[11px] font-bold text-[#6f7976] uppercase tracking-wider">Customer</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Rahul Sharma (Your Name)"
              className="text-xs sm:text-sm font-bold text-[#00453d] bg-transparent border-none focus:outline-none text-right placeholder-[#6f7976]"
            />
          </div>

          {/* Slide-Up / Dropdown Security Settings */}
          {showSettings && (
            <div className="bg-white p-4 border-b border-[#bec9c5] shadow-lg text-left animate-in slide-in-from-top duration-200 shrink-0">
              <WatermarkTool
                watermarkText={watermarkText}
                maxCopies={maxCopies}
                onWatermarkChange={setWatermarkText}
                onMaxCopiesChange={setMaxCopies}
                onClose={() => setShowSettings(false)}
              />
            </div>
          )}

          {/* ── CHAT MESSAGES FEED ── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="flex-1 wa-chat-wallpaper overflow-y-auto p-4 sm:p-5 space-y-3.5 text-left relative"
          >
            {/* Visual Drag & Drop Overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-30 bg-[#008069]/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-100">
                <div className="w-16 h-16 rounded-3xl bg-white/20 border-2 border-dashed border-white flex items-center justify-center mb-3 scale-110 animate-bounce">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h4 className="text-base font-bold">Drop Files to Stage in RAM</h4>
                <p className="text-xs text-white/80 mt-1">PDFs, ID scans, and images accepted (Max 50MB)</p>
              </div>
            )}

            {/* System Encryption Pill */}
            <div className="wa-system-pill flex items-center justify-center gap-2 text-center text-xs py-2 px-4 shadow-sm">
              <Lock className="w-3.5 h-3.5 text-[#54656f] shrink-0" />
              <span>
                🔒 Messages and documents sent in this chat are AES-256 encrypted directly in printer RAM.
              </span>
            </div>

            {/* User-Friendly Quick Onboarding Card */}
            {sentDocs.length === 0 && textMessages.length === 0 && stagedFiles.length === 0 && (
              <div className="bg-white/95 rounded-2xl p-4 sm:p-5 border border-[#d1d7db] shadow-sm max-w-md mx-auto my-3 text-left space-y-3">
                <div className="text-xs font-bold text-[#008069] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>3-Step Easy Printing</span>
                </div>

                <div className="space-y-2 text-xs text-[#54656f]">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#008069]/15 text-[#008069] font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                    <div>
                      <strong className="text-[#111b21]">Attach Document:</strong> Tap <Paperclip className="w-3.5 h-3.5 inline mx-0.5 text-[#54656f]" /> below to pick PDFs, ID scans, or photos.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#008069]/15 text-[#008069] font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                    <div>
                      <strong className="text-[#111b21]">Add Notes:</strong> Type a message or tap <Mic className="w-3.5 h-3.5 inline mx-0.5 text-[#008069]" /> to speak your instructions.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#008069]/15 text-[#008069] font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
                    <div>
                      <strong className="text-[#111b21]">Zero-Disk Print:</strong> File is decrypted in printer RAM only and shredded after printing.
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e9edef] flex justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-transform active:scale-95"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Select Document(s) to Start</span>
                  </button>
                </div>
              </div>
            )}

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

            {/* Text & Voice Messages */}
            {textMessages.map((msg) => {
              const isMe = msg.sender === 'CUSTOMER';

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-150`}
                >
                  <div
                    className={`${
                      isMe ? 'wa-bubble-out' : 'wa-bubble-in'
                    } max-w-[88%] sm:max-w-md px-4 py-2.5 space-y-1 shadow-sm border border-[#d1d7db]/40`}
                  >
                    {/* Voice Note Player */}
                    {msg.voiceBase64 && (
                      <VoiceNotePlayer
                        audioBase64={msg.voiceBase64}
                        timestamp={msg.timestamp}
                        isMe={isMe}
                      />
                    )}

                    {/* Regular Text */}
                    {msg.text && (
                      <div className="text-[14.5px] text-[#111b21] leading-relaxed break-words font-normal">
                        {msg.text}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-1 text-[11px] text-[#667781] font-mono mt-0.5">
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* ── MULTI-FILE BATCH STAGING CARD ── */}
            {stagedFiles.length > 0 && (
              <div className="flex justify-end animate-in zoom-in-95 duration-150 pb-2">
                <div className="bg-[#D9FDD3] text-[#1d1c17] rounded-2xl rounded-tr-sm p-3.5 max-w-[92%] sm:max-w-md w-[340px] relative bubble-shadow flex flex-col border border-[#c2f3ba]">
                  {/* Staged Header */}
                  <div className="flex items-center justify-between mb-3 border-b border-[#00453d]/10 pb-2">
                    <span className="text-[12px] font-bold text-[#00453d] flex items-center">
                      <FileText className="w-4 h-4 mr-1 text-[#00453d]" />
                      <span>Staging Area</span>
                    </span>
                    <span className="text-[11px] font-mono text-[#6f7976]">
                      {stagedFiles.length} {stagedFiles.length === 1 ? 'File' : 'Files'}
                    </span>
                  </div>

                  {/* List of Staged Files */}
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {stagedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="bg-white rounded-xl p-3 border border-[#bec9c5]/30 shadow-xs flex flex-col relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center text-[#ba1a1a] shrink-0 font-bold">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-bold text-[#1d1c17] truncate pr-2">{file.name}</span>
                              <span className="text-[11px] font-mono text-[#6f7976]">{(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                            className="text-[#6f7976] hover:text-[#ba1a1a] transition-colors shrink-0 p-1"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Mask Badge if image */}
                        {file.type.startsWith('image/') && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRedactionFileId(file.id);
                              setShowRedactionStudio(true);
                            }}
                            className="mt-2 inline-flex items-center self-start bg-emerald-50 text-[#00453d] border border-[#00453d]/20 rounded-md px-2 py-0.5 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer"
                          >
                            <ShieldAlert className="w-3 h-3 mr-1 text-[#00453d]" />
                            <span>Mask Sensitive ID Numbers</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Send CTA */}
                  <button
                    type="button"
                    onClick={handleSendAllStagedDocuments}
                    className="w-full mt-2.5 py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] font-bold rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Send {stagedFiles.length} Encrypted File(s) to Shop (AES-256)</span>
                  </button>

                  <div className="flex items-center justify-end mt-1.5">
                    <span className="text-[10.5px] font-mono text-[#6f7976] italic">Staged • Not sent yet</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* WhatsApp Attachment Sheet Popover */}
          {showAttachmentMenu && (
            <div className="absolute bottom-20 left-4 bg-white rounded-2xl p-4 shadow-2xl border border-[#bec9c5] flex items-center gap-4 animate-in slide-in-from-bottom duration-150 z-30">
              <button
                onClick={() => {
                  setShowAttachmentMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#8f3985] text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs text-[#54656f] font-semibold">Document(s)</span>
              </button>

              <button
                onClick={() => {
                  setShowAttachmentMenu(false);
                  cameraInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#d3396d] text-white flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs text-[#54656f] font-semibold">Camera</span>
              </button>

              <button
                onClick={() => {
                  setShowAttachmentMenu(false);
                  fileInputRef.current?.click();
                }}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#ac44cf] text-white flex items-center justify-center shadow-md">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs text-[#54656f] font-semibold">Gallery</span>
              </button>
            </div>
          )}

          {/* Quick Print Instruction Chips Strip */}
          <div className="bg-[#EFEAE2] px-3.5 py-1.5 border-t border-[#bec9c5]/30 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-hide">
            <span className="text-[11px] font-bold text-[#6f7976] uppercase tracking-wider shrink-0">Print Note:</span>
            {[
              '🖨️ 1 B&W Copy',
              '📑 Double-Sided',
              '🎨 Full Color',
              '⚡ Urgent',
              '📜 Legal Paper',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInputText(chip)}
                className="px-3 py-1 rounded-full bg-white hover:bg-[#D9FDD3] hover:border-[#25D366] text-[#00453d] text-xs font-semibold border border-[#bec9c5]/40 shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ── AUTHENTIC WHATSAPP INPUT BAR WITH LIVE VOICE RECORDING ── */}
          <div className="bg-[#EFEAE2] p-2.5 sm:p-3 flex items-center gap-2 border-t border-[#bec9c5]/30 shrink-0">
            {/* Hidden native pickers with MULTIPLE enabled */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,image/png,image/jpeg,image/webp,application/pdf"
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

            {/* If actively recording audio */}
            {isRecordingVoice ? (
              <div className="flex-1 bg-red-50 px-4 h-12 rounded-[24px] border border-red-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                  <span>Recording Voice Note ({voiceSeconds}s)</span>
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
              /* Text Input Wrapper */
              <div className="flex-1 bg-white rounded-[24px] flex items-center px-3 min-h-[48px] shadow-xs border border-[#bec9c5]/30">
                <button
                  type="button"
                  onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                  className="text-[#6f7976] hover:text-[#00453d] transition-colors p-1 shrink-0 cursor-pointer"
                  title="Attach Document or Photo"
                >
                  <Paperclip className="w-5 h-5 -rotate-45" />
                </button>

                <input
                  type="text"
                  placeholder="Message or Instructions..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="flex-1 text-sm bg-transparent border-none focus:outline-none px-2 text-[#1d1c17] placeholder-[#6f7976]"
                />

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="text-[#6f7976] hover:text-[#00453d] transition-colors p-1 shrink-0 cursor-pointer"
                  title="Camera Scan"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Circular Green Action Button (48x48) */}
            {inputText.trim() ? (
              <button
                type="button"
                onClick={handleSendMessage}
                className="w-12 h-12 bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer"
                title="Send Message"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : isRecordingVoice ? (
              <button
                type="button"
                onClick={() => stopVoiceRecording(false)}
                className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer"
                title="Send Voice Note"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startVoiceRecording}
                className="w-12 h-12 bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer"
                title="Hold or tap to record voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Redaction Studio Modal */}
      {showRedactionStudio && activeRedactionFileId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center">
          {(() => {
            const file = stagedFiles.find((f) => f.id === activeRedactionFileId);
            if (!file) return null;
            return (
              <RedactionStudio
                imageBuffer={file.buffer}
                onApplyRedaction={handleApplyRedaction}
                onCancel={() => {
                  setShowRedactionStudio(false);
                  setActiveRedactionFileId(null);
                }}
              />
            );
          })()}
        </div>
      )}

      {/* Shred Certificate Modal */}
      {activeCert && (
        <ShredCertificateModal certificate={activeCert} onNewSession={() => setActiveCert(null)} />
      )}
    </div>
  );
};
