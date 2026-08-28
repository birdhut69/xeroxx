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
          {/* WhatsApp Chat Top Header */}
          <div className="bg-[#008069] text-white px-3.5 py-2.5 sm:py-3 flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={handleReset}
                className="p-1 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
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
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  showSettings ? 'bg-white/30 text-white' : 'hover:bg-white/15 text-white'
                }`}
                title="Printing & Watermark Options"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Name Bar */}
          <div className="bg-[#f0f2f5] px-3.5 py-2 border-b border-[#d1d7db] flex items-center gap-2 text-left shrink-0">
            <User className="w-4 h-4 text-[#008069] shrink-0" />
            <input
              type="text"
              value={customerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter Your Name (e.g. Rahul Sharma)..."
              className="flex-1 text-xs sm:text-sm bg-white px-3 py-1.5 rounded-lg border border-[#d1d7db] focus:outline-none focus:border-[#00a884] text-[#111b21] font-medium"
            />
          </div>

          {/* Quick Settings Dropdown */}
          {showSettings && (
            <div className="bg-white p-3 border-b border-[#e9edef] shadow-md text-left animate-in slide-in-from-top duration-200 space-y-3 shrink-0">
              <WatermarkTool
                watermarkText={watermarkText}
                maxCopies={maxCopies}
                onWatermarkChange={setWatermarkText}
                onMaxCopiesChange={setMaxCopies}
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
              <div className="flex justify-end animate-in zoom-in-95 duration-150">
                <div className="wa-bubble-out max-w-[94%] sm:max-w-md p-4 space-y-3 border-2 border-[#00a884] shadow-md w-full">
                  <div className="text-xs sm:text-sm font-bold text-[#008069] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{stagedFiles.length} Document(s) Ready in RAM</span>
                    </span>
                    <button
                      onClick={() => setStagedFiles([])}
                      className="text-[#667781] hover:text-red-500 text-sm font-bold p-1 cursor-pointer"
                      title="Clear all files"
                    >
                      ✕
                    </button>
                  </div>

                  {/* List of Staged Files */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {stagedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-2.5 rounded-xl bg-white flex items-center justify-between gap-2 border border-[#d1d7db]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileText className="w-5 h-5 text-[#008069] shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#111b21] truncate">{file.name}</div>
                            <div className="text-[10.5px] text-[#667781] font-mono">
                              {(file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {file.type.startsWith('image/') && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveRedactionFileId(file.id);
                                setShowRedactionStudio(true);
                              }}
                              className="p-1.5 rounded-lg bg-[#e7f8ff] text-[#0284c7] hover:bg-[#d0f0fd] text-[11px] font-bold cursor-pointer"
                              title="Mask private numbers"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setStagedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                            className="p-1.5 rounded-lg text-[#667781] hover:text-red-500 cursor-pointer"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Staged Sender Name */}
                  <div className="bg-white p-2 rounded-xl border border-[#d1d7db]">
                    <label className="text-[11px] font-bold text-[#54656f] block mb-1">
                      Sender Name:
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Your Name (e.g. Rahul Sharma)"
                      className="w-full text-xs font-medium px-2.5 py-1 rounded bg-[#f0f2f5] border border-[#d1d7db] text-[#111b21] focus:outline-none focus:border-[#00a884]"
                    />
                  </div>

                  {/* Send All Action */}
                  <button
                    onClick={handleSendAllStagedDocuments}
                    className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send {stagedFiles.length} Encrypted File(s) to Shop</span>
                  </button>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* WhatsApp Attachment Sheet Popover */}
          {showAttachmentMenu && (
            <div className="absolute bottom-16 left-3 bg-white rounded-2xl p-4 shadow-2xl border border-[#d1d7db] flex items-center gap-4 animate-in slide-from-bottom duration-150 z-30">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#8f3985] text-white flex items-center justify-center shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-xs text-[#54656f] font-semibold">Document(s)</span>
              </button>

              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-[#f0f2f5] transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-[#d3396d] text-white flex items-center justify-center shadow-md">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs text-[#54656f] font-semibold">Camera</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
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
          <div className="bg-[#f0f2f5] px-3.5 py-1.5 border-t border-[#e9edef] flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
            <span className="text-[11px] font-bold text-[#667781] uppercase tracking-wider shrink-0">Print Note:</span>
            {[
              '🖨️ 1 B&W Copy',
              '📑 Double-sided print',
              '🎨 Full Color Print',
              '⚡ Urgent / Priority',
              '📜 Legal / Stamp Paper',
            ].map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInputText(chip)}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-[#d9fdd3] hover:border-[#00a884] text-[#111b21] text-[11.5px] font-medium border border-[#d1d7db] shrink-0 cursor-pointer shadow-xs transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* ── AUTHENTIC WHATSAPP INPUT BAR WITH LIVE VOICE RECORDING ── */}
          <div className="bg-[#f0f2f5] p-2.5 sm:p-3 flex items-center gap-2.5 border-t border-[#e9edef] shrink-0">
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

            {/* Paperclip Attachment Button */}
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                showAttachmentMenu ? 'bg-[#d1d7db] text-[#008069]' : 'hover:bg-[#e9edef] text-[#54656f]'
              }`}
              title="Attach Document / Camera"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* If actively recording audio */}
            {isRecordingVoice ? (
              <div className="flex-1 bg-red-50 px-4 h-11 rounded-2xl border border-red-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
                  <span>Recording Voice Note ({voiceSeconds}s)</span>
                </div>
                <button
                  type="button"
                  onClick={() => stopVoiceRecording(true)}
                  className="text-xs text-red-600 hover:underline font-semibold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              /* Real WhatsApp Text Input */
              <div className="flex-1 bg-white px-4 h-11 rounded-2xl border border-[#d1d7db] flex items-center focus-within:border-[#00a884] shadow-xs">
                <input
                  type="text"
                  placeholder="Type message or print note..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  className="w-full text-sm bg-transparent border-none focus:outline-none text-[#111b21] placeholder-[#667781]"
                />
              </div>
            )}

            {/* Send or Voice Note Mic Button */}
            {inputText.trim() ? (
              <button
                onClick={handleSendMessage}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                title="Send Text"
              >
                <Send className="w-5 h-5 ml-0.5" />
              </button>
            ) : isRecordingVoice ? (
              <button
                onClick={() => stopVoiceRecording(false)}
                className="w-11 h-11 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                title="Finish & Send Voice Note"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                onClick={startVoiceRecording}
                className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-md transition-transform active:scale-95 shrink-0 cursor-pointer"
                title="Record Voice Note"
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
