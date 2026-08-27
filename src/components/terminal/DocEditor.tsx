import React from 'react';
import { RotateCw, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Sliders, Layers, Printer, FileText } from 'lucide-react';

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
    <div className="glass-panel p-4 rounded-xl border border-slate-700/60 flex flex-wrap items-center justify-between gap-4 no-print">
      {/* Page Navigation */}
      <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono text-cyan-300 font-bold px-2">
          Page {currentPage} of {totalPages}
        </span>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Rotation & Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRotate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          title="Rotate 90° Clockwise"
        >
          <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
          <span>Rotate ({rotation}°)</span>
        </button>

        <div className="flex items-center bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => onFilterChange('NORMAL')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              filterMode === 'NORMAL' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Color
          </button>
          <button
            onClick={() => onFilterChange('GRAYSCALE')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              filterMode === 'GRAYSCALE' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Grayscale
          </button>
          <button
            onClick={() => onFilterChange('HIGH_CONTRAST')}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              filterMode === 'HIGH_CONTRAST' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="High contrast black & white enhancement for sharp photocopies"
          >
            Photocopy B&W
          </button>
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-800">
        <button
          onClick={() => onZoomChange(-0.15)}
          disabled={zoomLevel <= 0.6}
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span
          onClick={onResetZoom}
          className="text-xs font-mono text-slate-300 cursor-pointer hover:text-cyan-400 px-1"
          title="Click to reset 100%"
        >
          {Math.round(zoomLevel * 100)}%
        </span>
        <button
          onClick={() => onZoomChange(0.15)}
          disabled={zoomLevel >= 2.5}
          className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Copies Selector */}
      <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1 rounded-lg border border-slate-800 text-xs">
        <span className="text-slate-400">Copies:</span>
        <select
          value={copies}
          onChange={(e) => onCopiesChange(parseInt(e.target.value))}
          className="bg-slate-800 text-cyan-300 font-bold font-mono px-2 py-1 rounded border border-slate-700 outline-none"
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
