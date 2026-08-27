import React from 'react';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Maximize2,
  X,
  Trash2
} from 'lucide-react';

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
  onCloseFile?: () => void;
  onDeleteFile?: () => void;
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
  onCloseFile,
  onDeleteFile,
}) => {
  return (
    <div className="wa-panel p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5 no-print shadow-sm border border-[#d1d7db]">
      {/* Left: Page Navigation */}
      <div className="flex items-center gap-1 bg-[#f0f2f5] px-2 py-1 rounded-lg border border-[#e9edef]">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-[#e9edef] disabled:opacity-30 text-[#54656f] transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-[#111b21] font-bold px-2 whitespace-nowrap">
          Page {currentPage} / {totalPages}
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

      {/* Middle: Rotation & Photocopy Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRotate}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#e9edef] border border-[#d1d7db] text-xs font-bold text-[#111b21] transition-all"
          title="Rotate 90°"
        >
          <RotateCw className="w-3.5 h-3.5 text-[#008069]" />
          <span>{rotation}°</span>
        </button>

        {/* Filter Mode Selector */}
        <div className="flex items-center bg-[#f0f2f5] p-0.5 rounded-lg border border-[#d1d7db] text-xs">
          <button
            onClick={() => onFilterChange('NORMAL')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              filterMode === 'NORMAL'
                ? 'bg-[#008069] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Color
          </button>
          <button
            onClick={() => onFilterChange('GRAYSCALE')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all ${
              filterMode === 'GRAYSCALE'
                ? 'bg-[#008069] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
          >
            Grayscale
          </button>
          <button
            onClick={() => onFilterChange('HIGH_CONTRAST')}
            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
              filterMode === 'HIGH_CONTRAST'
                ? 'bg-[#008069] text-white shadow-sm'
                : 'text-[#54656f] hover:text-[#111b21]'
            }`}
            title="Crisp Black & White Photocopy Mode"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            <span>Photocopy B&W</span>
          </button>
        </div>
      </div>

      {/* Right: Zoom & Copies & Close File */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#f0f2f5] px-1.5 py-1 rounded-lg border border-[#d1d7db]">
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
            className="text-xs font-mono font-bold text-[#111b21] cursor-pointer hover:text-[#008069] px-1 select-none"
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
        <div className="flex items-center gap-1 bg-[#f0f2f5] px-2.5 py-1 rounded-lg border border-[#d1d7db] text-xs">
          <span className="text-[#54656f] font-medium">Copies:</span>
          <select
            value={copies}
            onChange={(e) => onCopiesChange(parseInt(e.target.value, 10))}
            className="bg-white text-[#008069] font-bold font-mono px-1.5 py-0.5 rounded border border-[#d1d7db] outline-none cursor-pointer"
          >
            {Array.from({ length: Math.min(10, maxAllowedCopies) }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {i === 0 ? 'copy' : 'copies'}
              </option>
            ))}
          </select>
        </div>

        {/* Close File / Unload from Canvas */}
        {onCloseFile && (
          <button
            onClick={onCloseFile}
            className="p-1.5 rounded-lg bg-[#f0f2f5] hover:bg-[#fee2e2] text-[#54656f] hover:text-[#dc2626] transition-colors border border-[#d1d7db]"
            title="Close this document viewer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Delete File from RAM */}
        {onDeleteFile && (
          <button
            onClick={onDeleteFile}
            className="p-1.5 rounded-lg bg-[#fee2e2] hover:bg-[#fca5a5] text-[#dc2626] transition-colors border border-[#fca5a5]"
            title="Shred only this specific file from RAM"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
