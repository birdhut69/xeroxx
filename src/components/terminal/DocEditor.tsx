import React from 'react';
import { RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sliders, Layers, Printer, FileText, Sparkles } from 'lucide-react';

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
  onCopiesChange
}) => {
  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-700/80 flex flex-wrap items-center justify-between gap-4 no-print shadow-xl">
      {/* Page Navigation */}
      <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-300 transition-colors active:scale-95"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-cyan-300 font-bold px-2 whitespace-nowrap">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-300 transition-colors active:scale-95"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Rotation & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRotate}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 transition-all active:scale-95 shadow-sm"
          title="Rotate 90° Clockwise"
        >
          <RotateCw className="w-4 h-4 text-cyan-400" />
          <span>Rotate ({rotation}°)</span>
        </button>

        {/* Photocopy Filter Mode Segmented Buttons */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
          <button
            onClick={() => onFilterChange('NORMAL')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'NORMAL'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Color
          </button>
          <button
            onClick={() => onFilterChange('GRAYSCALE')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              filterMode === 'GRAYSCALE'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Grayscale
          </button>
          <button
            onClick={() => onFilterChange('HIGH_CONTRAST')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
              filterMode === 'HIGH_CONTRAST'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="High contrast photocopy filter for sharp text"
          >
            <Sparkles className="w-3 h-3" />
            <span>Photocopy B&W</span>
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1.5 bg-slate-900/90 px-2.5 py-1.5 rounded-xl border border-slate-800 shadow-inner">
        <button
          onClick={() => onZoomChange(-0.15)}
          disabled={zoomLevel <= 0.6}
          className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-300 active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <span
          onClick={onResetZoom}
          className="text-xs font-mono font-bold text-slate-200 cursor-pointer hover:text-cyan-400 px-2 select-none"
          title="Click to reset zoom to 100%"
        >
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(0.15)}
          disabled={zoomLevel >= 2.5}
          className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 text-slate-300 active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* Copies Selector */}
      <div className="flex items-center gap-2 bg-slate-900/90 px-3.5 py-1.5 rounded-xl border border-slate-800 text-xs shadow-inner">
        <span className="text-slate-400 font-medium">Copies:</span>
        <select
          value={copies}
          onChange={(e) => onCopiesChange(parseInt(e.target.value))}
          className="bg-slate-800 text-cyan-300 font-bold font-mono px-2.5 py-1 rounded-lg border border-slate-700 outline-none cursor-pointer"
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
