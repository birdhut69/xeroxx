import React from 'react';
import { Shield, Sparkles, Copy, Layers } from 'lucide-react';

interface WatermarkToolProps {
  watermarkText: string;
  maxCopies: number;
  onWatermarkChange: (text: string) => void;
  onMaxCopiesChange: (copies: number) => void;
}

export const WatermarkTool: React.FC<WatermarkToolProps> = ({
  watermarkText,
  maxCopies,
  onWatermarkChange,
  onMaxCopiesChange,
}) => {
  const presets = [
    'FOR PHOTOCOPY ONLY',
    'CONFIDENTIAL',
    'DO NOT ARCHIVE',
    'OFFICIAL PURPOSE',
  ];

  return (
    <div className="space-y-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#111b21]">
          <Shield className="w-4 h-4 text-[#008069]" />
          <span>Security & Print Preferences</span>
        </div>
      </div>

      {/* Watermark Input */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[#54656f] block">
          Custom Forensic Watermark (Optional):
        </label>
        <input
          type="text"
          value={watermarkText}
          onChange={(e) => onWatermarkChange(e.target.value)}
          placeholder="e.g. For Passport Application Only"
          className="w-full px-3 py-1.5 rounded-lg bg-[#f0f2f5] border border-[#d1d7db] text-xs text-[#111b21] placeholder-[#8696a0] focus:outline-none focus:border-[#00a884]"
        />

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onWatermarkChange(preset)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                watermarkText === preset
                  ? 'bg-[#d9fdd3] text-[#008069] border-[#00a884]'
                  : 'bg-[#f0f2f5] text-[#54656f] border-[#d1d7db] hover:bg-[#e9edef]'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Print Copies Limit */}
      <div className="flex items-center justify-between pt-2 border-t border-[#e9edef]">
        <div>
          <div className="text-xs font-semibold text-[#111b21]">Maximum Copies Allowed:</div>
          <div className="text-[10px] text-[#667781]">Limits prints shopkeeper can produce</div>
        </div>

        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 5].map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onMaxCopiesChange(count)}
              className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                maxCopies === count
                  ? 'bg-[#00a884] text-white shadow-sm'
                  : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
