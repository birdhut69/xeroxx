import React, { useRef, useState } from 'react';
import { Upload, FileText, Image as ImageIcon, ShieldAlert, Sparkles, Check, FileCheck, Award, CreditCard, Scroll } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

interface DocumentPickerProps {
  selectedFile: { name: string; type: string; size: number; buffer: ArrayBuffer } | null;
  onFileSelected: (file: { name: string; type: string; size: number; buffer: ArrayBuffer }) => void;
  onOpenRedactionStudio: () => void;
}

export const DocumentPicker: React.FC<DocumentPickerProps> = ({
  selectedFile,
  onFileSelected,
  onOpenRedactionStudio
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const toast = useToast();

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    onFileSelected({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer
    });
    sounds.playSuccess();
    toast.success('Document Loaded in Memory', `${file.name} (${(file.size / 1024).toFixed(1)} KB) ready.`);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    onFileSelected({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer
    });
    sounds.playSuccess();
    toast.success('Document Loaded in Memory', `${file.name} ready for encryption.`);
  };

  // Generate Synthetic Mock Documents in Browser Memory
  const handleLoadSample = (sampleType: 'ID_CARD' | 'CERTIFICATE' | 'DRIVING_LICENSE' | 'RENT_AGREEMENT') => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sampleType === 'ID_CARD') {
      // Draw Synthetic Aadhaar / National ID Mock
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 800, 500);

      // Top Tri-Color Accent
      ctx.fillStyle = '#f97316';
      ctx.fillRect(0, 0, 800, 10);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 10, 800, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('GOVERNMENT OF INDIA • UNIQUE IDENTIFICATION AUTHORITY', 40, 48);

      // Photo Frame
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(40, 100, 140, 175);
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('[PHOTO]', 80, 195);

      // Details
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Name: ABHAY VIKRAM JADHAV', 210, 130);
      ctx.font = '16px sans-serif';
      ctx.fillText('DOB: 14/08/1998', 210, 168);
      ctx.fillText('Gender: MALE / पुरुष', 210, 206);
      ctx.fillText('Address: Flat 402, Cyber Heights, Pune 411001', 210, 244);

      // Aadhaar 12-digit number (Target for redaction!)
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 28px monospace';
      ctx.fillText('9182  4029  7816', 210, 310);

      // Footer
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(40, 355, 720, 110);
      ctx.fillStyle = '#334155';
      ctx.font = '13px sans-serif';
      ctx.fillText('मेरा आधार, मेरी पहचान • Valid for Identity Verification', 60, 395);
      ctx.fillText('CONFIDENTIAL: Mask your 12-digit Aadhaar number with SafePrint Redaction Brush.', 60, 425);

      canvas.toBlob((blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          onFileSelected({
            name: 'Aadhaar_ID_Sample.jpg',
            type: 'image/jpeg',
            size: buffer.byteLength,
            buffer
          });
          sounds.playSuccess();
          toast.shield('Aadhaar Mock Loaded', 'Use the Redact button to black out the 12-digit ID before sending!');
        });
      }, 'image/jpeg', 0.92);
    } else if (sampleType === 'CERTIFICATE') {
      // Academic Marksheet
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, 800, 500);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 8;
      ctx.strokeRect(20, 20, 760, 460);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 26px serif';
      ctx.textAlign = 'center';
      ctx.fillText('UNIVERSITY OF ADVANCED TECHNOLOGY', 400, 80);
      ctx.font = '16px serif';
      ctx.fillText('BACHELOR OF TECHNOLOGY IN COMPUTER ENGINEERING', 400, 115);

      ctx.fillStyle = '#1e293b';
      ctx.font = '17px sans-serif';
      ctx.fillText('Candidate Name: Abhay V. Jadhav • Roll: EN-2026-9810', 400, 180);
      ctx.fillText('Marks Secured: 89.4% (First Class with Distinction - CGPA 9.42)', 400, 230);
      ctx.fillText('Conferred at Annual Convocation on August 2026', 400, 280);

      ctx.font = 'italic 16px serif';
      ctx.fillText('Chancellor Signature: Prof. Katherine Cole', 400, 390);

      canvas.toBlob((blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          onFileSelected({
            name: 'College_Degree_Marksheet.jpg',
            type: 'image/jpeg',
            size: buffer.byteLength,
            buffer
          });
          sounds.playSuccess();
          toast.success('Marksheet Mock Loaded', 'Ready for E2EE streaming.');
        });
      }, 'image/jpeg', 0.92);
    } else {
      // Driving License Mock
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(0, 0, 800, 500);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(0, 0, 800, 65);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('UNION MOTOR VEHICLE DRIVING LICENCE', 40, 42);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('DL No: MH-12-20260084129', 40, 120);
      ctx.fillText('Holder: ABHAY JADHAV', 40, 160);
      ctx.fillText('Class: LMV / MCWG (Private)', 40, 200);
      ctx.fillText('Valid Thru: 26/08/2046', 40, 240);

      ctx.fillStyle = '#15803d';
      ctx.fillRect(40, 300, 720, 140);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText('OFFICIAL LICENCE DOCUMENT • SECURE TRANSMISSION REQUIRED', 60, 350);

      canvas.toBlob((blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          onFileSelected({
            name: 'Driving_Licence.jpg',
            type: 'image/jpeg',
            size: buffer.byteLength,
            buffer
          });
          sounds.playSuccess();
          toast.success('Licence Mock Loaded', 'Ready to encrypt and beam.');
        });
      }, 'image/jpeg', 0.92);
    }
  };

  const isImage = selectedFile?.type.startsWith('image/');

  return (
    <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-slate-700/80 space-y-4 shadow-xl">
      <div className="flex items-center justify-between text-left">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">Select Document to Send</h3>
            <p className="text-[11px] text-slate-400">Zero-knowledge AES-256 E2EE before transmission</p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          PDF • PNG • JPG
        </span>
      </div>

      {/* Drag/Drop Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center group ${
          isDragOver
            ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
            : 'border-slate-700/80 hover:border-cyan-400/80 bg-slate-900/60 hover:bg-slate-900/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-inner">
          <Upload className="w-7 h-7" />
        </div>

        <p className="text-xs sm:text-sm font-bold text-slate-100 mb-1">
          Tap or Drop files here to choose from your phone
        </p>
        <p className="text-[11px] text-slate-400">
          Held exclusively in your phone's RAM • Never stored on any server
        </p>
      </div>

      {/* Quick Mock Sample Document Selectors */}
      <div className="pt-2 text-left">
        <div className="text-[11px] text-slate-300 font-bold mb-2 flex items-center gap-1.5 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Or load a sample document with 1 click:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleLoadSample('ID_CARD')}
            className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition-all active:scale-95 group"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 group-hover:text-cyan-200">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Aadhaar Mock ID</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Includes 12-digit number for redaction</div>
          </button>

          <button
            type="button"
            onClick={() => handleLoadSample('CERTIFICATE')}
            className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition-all active:scale-95 group"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 group-hover:text-amber-200">
              <Award className="w-3.5 h-3.5" />
              <span>Marksheet Mock</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">College Degree certificate</div>
          </button>

          <button
            type="button"
            onClick={() => handleLoadSample('DRIVING_LICENSE')}
            className="p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition-all active:scale-95 group"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 group-hover:text-emerald-200">
              <FileCheck className="w-3.5 h-3.5" />
              <span>Driving Licence</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Official vehicle licence</div>
          </button>
        </div>
      </div>

      {/* Selected File Status Card */}
      {selectedFile && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-3 shadow-lg text-left">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate">{selectedFile.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB • In RAM • Ready to Encrypt
              </div>
            </div>
          </div>

          {/* Privacy Redaction Button for Images */}
          {isImage && (
            <button
              type="button"
              onClick={onOpenRedactionStudio}
              className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-500/10"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Redact ID</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
