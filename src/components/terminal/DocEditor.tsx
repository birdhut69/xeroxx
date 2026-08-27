import React from 'react';
import { RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface DocEditorProps {
  currentPage: number;
  totalPages: number;
  rotation: number;
  filterMode: 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST';
  zoomLevel: number;
  copies: number;
  maxAllowedCopies: number;
  onPageChange: (page: number) => void;
  onRotate: () => void;
  onFilterChange: (mode: 'NORMAL' | 'BW' | 'GRAYSCALE' | 'HIGH_CONTRAST') => void;
  onZoomChange: (delta: number) => void;
  onResetZoom: () => void;
  onCopiesChange: (copies: number) => void;
}

export const DocEditor: React.FC<DocEditorProps> = ({
  currentPage,
  totalPages,
  rotation,
  filterMode,
  zoomLevel,
  copies,
  maxAllowedCopies,
  onPageChange,
  onRotate,
  onFilterChange,
  onZoomChange,
  onResetZoom,
  onCopiesChange,
}) => {
  return (
    <div className="wa-panel p-3 sm:p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 no-print shadow-sm">
      {/* Page Navigation */}
      <div className="flex items-center gap-1.5 bg-[#f0f2f5] px-2.5 py-1 rounded-lg border border-[#e9edef]">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f] transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-[#111b21] font-bold px-2 whitespace-nowrap">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f] transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Rotation & Filter Mode */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRotate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#e9edef] text-xs font-bold text-[#111b21] transition-all"
          title="Rotate 90°"
        >
          <RotateCw className="w-3.5 h-3.5 text-[#00a884]" />
          <span>Rotate ({rotation}°)</span>
        </button>

        {/* Filter Mode Selector */}
        <div className="flex items-center bg-[#f0f2f5] p-0.5 rounded-lg border border-[#e9edef] text-xs">
          <button
            onClick={() => onFilterChange('NORMAL')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              filterMode === 'NORMAL'
                ? 'bg-[#00a884] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Color
          </button>
          <button
            onClick={() => onFilterChange('GRAYSCALE')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              filterMode === 'GRAYSCALE'
                ? 'bg-[#00a884] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Grayscale
          </button>
          <button
            onClick={() => onFilterChange('HIGH_CONTRAST')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
              filterMode === 'HIGH_CONTRAST'
                ? 'bg-[#00a884] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
            title="Photocopy Black & White for crisp sharp text"
          >
            <Sparkles className="w-3 h-3" />
            <span>Photocopy B&W</span>
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 bg-[#f0f2f5] px-2 py-1 rounded-lg border border-[#e9edef]">
        <button
          onClick={() => onZoomChange(-0.15)}
          disabled={zoomLevel <= 0.5}
          className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f]"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span
          onClick={onResetZoom}
          className="text-xs font-mono font-bold text-[#111b21] cursor-pointer hover:text-[#00a884] px-1.5 select-none"
          title="Reset Zoom to 100%"
        >
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(0.15)}
          disabled={zoomLevel >= 2.5}
          className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f]"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Copies Selector */}
      <div className="flex items-center gap-1.5 bg-[#f0f2f5] px-3 py-1 rounded-lg border border-[#e9edef] text-xs">
        <span className="text-[#54656f] font-medium">Copies:</span>
        <select
          value={copies}
          onChange={(e) => onCopiesChange(parseInt(e.target.value, 10))}
          className="bg-white text-[#008069] font-bold font-mono px-2 py-0.5 rounded border border-[#d1d7db] outline-none cursor-pointer"
        >
          {Array.from({ length: Math.min(10, maxAllowedCopies) }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} {i === 0 ? 'copy' : 'copies'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
