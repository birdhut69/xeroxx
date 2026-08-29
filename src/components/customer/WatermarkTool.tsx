import React, { useState } from 'react';
import { Shield, Lock, FileText, Fingerprint, Gavel, Palette, Check, Plus, Minus, Contrast } from 'lucide-react';

interface WatermarkToolProps {
  watermarkText: string;
  maxCopies: number;
  onWatermarkChange: (text: string) => void;
  onMaxCopiesChange: (copies: number) => void;
  onClose?: () => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({
  watermarkText,
  maxCopies,
  onWatermarkChange,
  onMaxCopiesChange,
  onClose,
}) => {
  const [colorMode, setColorMode] = useState<'BW' | 'COLOR'>('BW');
  const [isDuplex, setIsDuplex] = useState(true);

  const presets = [
    'VALID ONLY FOR PASSPORT VERIFICATION',
    'CONFIDENTIAL - FOR OFFICIAL USE ONLY',
    'ONLY FOR BANK ACCOUNT OPENING',
    'DO NOT ARCHIVE OR DIGITIZE',
  ];

  return (
    <div className="space-y-4 text-left">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1d1c17] flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#00453d]" />
          <span>Print & Security Settings</span>
        </h2>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-full text-[#6f7976] hover:bg-[#f0f2f5] cursor-pointer">
            ✕
          </button>
        )}
      </div>

      {/* Forensic Watermark Stamp Field */}
      <div>
        <label className="block text-[11px] font-bold text-[#3f4946] uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Fingerprint className="w-3.5 h-3.5 text-[#00453d]" />
          <span>Forensic Watermark Stamp (Optional)</span>
        </label>
        <div className="relative bg-[#ffffff] border-2 border-[#bec9c5] focus-within:border-[#00453d] rounded-xl p-2.5 transition-colors shadow-xs">
          <textarea
            value={watermarkText}
            onChange={(e) => onWatermarkChange(e.target.value.toUpperCase())}
            placeholder="e.g. VALID ONLY FOR PASSPORT VERIFICATION"
            className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-mono font-bold text-[#ba1a1a] resize-none h-14 outline-none uppercase tracking-wide leading-relaxed"
          />
          <div className="absolute bottom-2 right-2 text-[#6f7976] opacity-60">
            <Gavel className="w-4 h-4" />
          </div>
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onWatermarkChange(preset)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all border ${
                watermarkText === preset
                  ? 'bg-[#d9fdd3] text-[#00453d] border-[#00a884]'
                  : 'bg-[#f0f2f5] text-[#3f4946] border-[#bec9c5]/60 hover:bg-[#e7e2da]'
              }`}
            >
              {preset.split(' - ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Print Options Bento Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Color Toggle */}
        <div className="col-span-2 bg-[#f2ede5] rounded-xl p-1 flex border border-[#bec9c5]/30">
          <button
            type="button"
            onClick={() => setColorMode('BW')}
            className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${
              colorMode === 'BW'
                ? 'bg-white shadow-sm text-[#00453d] border border-[#bec9c5]/50'
                : 'text-[#3f4946] hover:bg-[#e7e2da]'
            }`}
          >
            <Contrast className="w-4 h-4 text-[#00453d]" />
            <span className="text-[11px]">Black & White (B&W)</span>
          </button>
          <button
            type="button"
            onClick={() => setColorMode('COLOR')}
            className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 rounded-lg text-xs font-bold transition-all ${
              colorMode === 'COLOR'
                ? 'bg-white shadow-sm text-[#00453d] border border-[#bec9c5]/50'
                : 'text-[#3f4946] hover:bg-[#e7e2da]'
            }`}
          >
            <Palette className="w-4 h-4 text-amber-500" />
            <span className="text-[11px]">Full Color</span>
          </button>
        </div>

        {/* Layout Option */}
        <div className="bg-[#f2ede5] rounded-xl p-2.5 flex flex-col gap-1.5 border border-[#bec9c5]/30">
          <span className="text-[11px] font-bold text-[#3f4946] uppercase tracking-wider">Layout</span>
          <button
            type="button"
            onClick={() => setIsDuplex(!isDuplex)}
            className={`w-full py-1.5 px-2 text-left text-xs font-bold rounded-lg transition-all flex items-center justify-between ${
              isDuplex ? 'bg-white text-[#00453d] shadow-sm border border-[#bec9c5]/40' : 'bg-transparent text-[#3f4946]'
            }`}
          >
            <span>{isDuplex ? 'Back-to-Back Duplex' : 'Single Sided'}</span>
            <Check className="w-3.5 h-3.5 text-[#00a884]" />
          </button>
        </div>

        {/* Copies Stepper */}
        <div className="bg-[#f2ede5] rounded-xl p-2.5 flex flex-col justify-between border border-[#bec9c5]/30">
          <span className="text-[11px] font-bold text-[#3f4946] uppercase tracking-wider">Copies</span>
          <div className="flex items-center justify-between bg-white rounded-full p-1 border border-[#bec9c5]/50 shadow-xs mt-1">
            <button
              type="button"
              onClick={() => onMaxCopiesChange(Math.max(1, maxCopies - 1))}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#f2ede5] hover:bg-[#e7e2da] text-[#1d1c17] active:scale-90 transition-transform cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-sm font-bold text-[#1d1c17]">{maxCopies}</span>
            <button
              type="button"
              onClick={() => onMaxCopiesChange(Math.min(20, maxCopies + 1))}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-[#075e54]/10 hover:bg-[#075e54]/20 text-[#075e54] active:scale-90 transition-transform cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-[#075e54] hover:bg-[#00453d] text-white rounded-xl text-xs font-bold shadow-md transition-transform active:scale-98 cursor-pointer"
        >
          Apply Security Settings
        </button>
      )}
    </div>
  );
};
