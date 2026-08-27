import React, { useRef, useState } from 'react';
import { Upload, FileText, ShieldAlert, Check, File, ImageIcon } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

interface SelectedFile {
  name: string;
  type: string;
  size: number;
  buffer: ArrayBuffer;
}

interface DocumentPickerProps {
  selectedFile: SelectedFile | null;
  onFileSelected: (file: SelectedFile) => void;
  onOpenRedactionStudio: () => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5" />;
  return <File className="w-5 h-5" />;
}

export const DocumentPicker: React.FC<DocumentPickerProps> = ({
  selectedFile,
  onFileSelected,
  onOpenRedactionStudio,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const toast = useToast();

  const processFile = async (file: globalThis.File) => {
    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Unsupported File', `"${file.name}" is not a supported format. Use PDF, PNG, JPG, or WebP.`);
      return;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File Too Large', `Max file size is 25 MB. "${file.name}" is ${formatFileSize(file.size)}.`);
      return;
    }

    if (file.size === 0) {
      toast.error('Empty File', 'The selected file is empty.');
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      onFileSelected({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        buffer,
      });
      sounds.playSuccess();
      toast.success('Document Loaded', `${file.name} (${formatFileSize(file.size)}) ready for encryption.`);
    } catch (err) {
      console.error('[SafePrint] File read error:', err);
      toast.error('Read Error', 'Failed to read file. Please try again.');
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
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
            <h3 className="text-sm sm:text-base font-bold text-white">Select Document</h3>
            <p className="text-[11px] text-slate-400">AES-256-GCM encrypted before transmission</p>
          </div>
        </div>
        <span className="text-[10px] font-mono uppercase px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
          PDF • PNG • JPG • WebP
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
          accept=".pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-inner">
          <Upload className="w-7 h-7" />
        </div>

        <p className="text-xs sm:text-sm font-bold text-slate-100 mb-1">
          Tap to choose or drop your document here
        </p>
        <p className="text-[11px] text-slate-400">
          Held exclusively in RAM • Never stored on any server • Max 25 MB
        </p>
      </div>

      {/* Selected File Status Card */}
      {selectedFile && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-500/40 flex items-center justify-between gap-3 shadow-lg text-left">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0">
              {getFileIcon(selectedFile.type)}
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate max-w-[220px]" title={selectedFile.name}>
                {selectedFile.name}
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>{formatFileSize(selectedFile.size)}</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <Check className="w-3 h-3" /> In RAM
                </span>
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
