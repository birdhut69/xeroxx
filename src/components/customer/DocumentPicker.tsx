import React, { useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, ShieldAlert, Sparkles, Check } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

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
  };

  // Generate Sample Demo Documents in RAM (Synthetic ID Card Canvas / Doc)
  const handleLoadSample = (sampleType: 'ID_CARD' | 'CERTIFICATE' | 'RENT_AGREEMENT') => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (sampleType === 'ID_CARD') {
      // Draw Synthetic Aadhaar / National ID Mock
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 800, 500);

      // Header Banner
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 800, 70);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('IDENTITY VERIFICATION CARD • GOVERNMENT SAMPLE', 40, 45);

      // Avatar box
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(40, 110, 140, 180);
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.fillText('[PHOTO]', 80, 205);

      // Personal Details
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Name: ALEX R. JOHNSON', 210, 135);
      ctx.font = '16px sans-serif';
      ctx.fillText('DOB: 14/08/1994', 210, 175);
      ctx.fillText('Gender: MALE', 210, 215);
      ctx.fillText('Address: 42 Silicon Cyberway, Tech Hub', 210, 255);

      // Aadhaar/ID Number
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('ID NO: 4892 7109 3841', 210, 320);

      // Security Badge
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(40, 360, 720, 100);
      ctx.fillStyle = '#334155';
      ctx.font = '13px sans-serif';
      ctx.fillText('CONFIDENTIAL: This sample contains mock personal identity data.', 60, 400);
      ctx.fillText('Protect with SafePrint client-side redaction and E2EE before printing.', 60, 430);

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
        });
      }, 'image/jpeg', 0.9);
    } else {
      // Draw Certificate Mock
      ctx.fillStyle = '#fffbeb';
      ctx.fillRect(0, 0, 800, 500);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 760, 460);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 28px serif';
      ctx.textAlign = 'center';
      ctx.fillText('CERTIFICATE OF ACADEMIC ACHIEVEMENT', 400, 90);

      ctx.fillStyle = '#1e293b';
      ctx.font = '18px sans-serif';
      ctx.fillText('This document certifies that the bearer has completed the curriculum with Honors.', 400, 180);
      ctx.fillText('Marks Roll No: 9940-2026-X • Grade: DISTINCTION (A+)', 400, 240);

      ctx.font = 'italic 16px serif';
      ctx.fillText('Authorized Signature: Dr. Evelyn Vance (Registrar)', 400, 380);

      canvas.toBlob((blob) => {
        if (!blob) return;
        blob.arrayBuffer().then((buffer) => {
          onFileSelected({
            name: 'Academic_Marksheet.jpg',
            type: 'image/jpeg',
            size: buffer.byteLength,
            buffer
          });
          sounds.playSuccess();
        });
      }, 'image/jpeg', 0.9);
    }
  };

  const isImage = selectedFile?.type.startsWith('image/');

  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-700/80 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Select Document to Send</h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">PDF, PNG, JPG</span>
      </div>

      {/* Drag/Drop Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-400/80 bg-slate-900/60 hover:bg-slate-900 transition-all cursor-pointer text-center group"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg,image/webp"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
          <Upload className="w-6 h-6" />
        </div>

        <p className="text-xs font-bold text-slate-200 mb-1">
          Tap to choose file from your phone
        </p>
        <p className="text-[10px] text-slate-400">
          Encrypted client-side with AES-256 before leaving your device
        </p>
      </div>

      {/* Sample Quick Loaders */}
      <div className="pt-1">
        <div className="text-[11px] text-slate-400 font-medium mb-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Or load a sample document:</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleLoadSample('ID_CARD')}
            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition-all"
          >
            <div className="text-xs font-bold text-cyan-300">Aadhaar Mock ID</div>
            <div className="text-[10px] text-slate-400">Sample identity card</div>
          </button>
          <button
            type="button"
            onClick={() => handleLoadSample('CERTIFICATE')}
            className="p-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition-all"
          >
            <div className="text-xs font-bold text-indigo-300">Marksheet Mock</div>
            <div className="text-[10px] text-slate-400">Sample marks certificate</div>
          </button>
        </div>
      </div>

      {/* Selected File Card */}
      {selectedFile && (
        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{selectedFile.name}</div>
              <div className="text-[10px] text-slate-400 font-mono">
                {(selectedFile.size / 1024).toFixed(1)} KB • Ready to Encrypt
              </div>
            </div>
          </div>

          {/* Redaction Button for Images */}
          {isImage && (
            <button
              type="button"
              onClick={onOpenRedactionStudio}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Redact</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
