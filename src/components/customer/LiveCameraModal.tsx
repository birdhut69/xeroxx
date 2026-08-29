import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, Zap, ZapOff, Image as ImageIcon, AlertCircle, ShieldAlert, Sparkles, Eye } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (buffer: ArrayBuffer, filename: string, fileType: string, fileSize: number, openRedaction?: boolean) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileFallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<{
    dataUrl: string;
    blob: Blob;
    buffer: ArrayBuffer;
    filename: string;
  } | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);
    setTorchOn(false);
    setHasTorch(false);

    try {
      // First try with facingMode constraint
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback to basic video constraint
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if track supports torch
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities && videoTrack.getCapabilities()) as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      }

      setCameraLoading(false);
    } catch (err: any) {
      console.warn('[CipherPrint Camera] getUserMedia error:', err);
      let msg = 'Could not access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in browser settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system.';
      }
      setCameraError(msg);
      setCameraLoading(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen && !capturedImage) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing, capturedImage, startCamera, stopCamera]);

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !torchOn;
        await (videoTrack.applyConstraints as any)({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle not supported:', err);
      }
    }
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip if user-facing front camera
    if (cameraFacing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    sounds.playShutter();

    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const buffer = await blob.arrayBuffer();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        const filename = `DocScan_${timestamp}.jpg`;

        setCapturedImage({
          dataUrl,
          blob,
          buffer,
          filename,
        });

        stopCamera();
      },
      'image/jpeg',
      0.95
    );
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleConfirmUse = (openRedaction = false) => {
    if (!capturedImage) return;
    onCapture(
      capturedImage.buffer,
      capturedImage.filename,
      'image/jpeg',
      capturedImage.blob.size,
      openRedaction
    );
    setCapturedImage(null);
    onClose();
  };

  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    onCapture(buffer, file.name, file.type || 'image/jpeg', file.size, false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between overflow-hidden select-none animate-in fade-in duration-200 text-white">
      {/* ── TOP ACTION BAR ── */}
      <div className="w-full flex items-center justify-between px-4 py-3 z-30 bg-black/60 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#00a884]/20 border border-[#00a884]/40 flex items-center justify-center text-[#25D366]">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Document Camera</h3>
            <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              In-Memory Optical Scanner
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && !capturedImage && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-full border transition-colors cursor-pointer ${
                torchOn ? 'bg-amber-400/20 border-amber-400 text-amber-300' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
              }`}
              title="Toggle Flashlight"
            >
              {torchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors cursor-pointer"
            title="Close Camera"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── CENTER VIEWFINDER OR PREVIEW ── */}
      <div className="flex-1 w-full max-w-lg relative flex items-center justify-center overflow-hidden p-3">
        {capturedImage ? (
          /* SNAPSHOT PREVIEW */
          <div className="relative w-full h-full max-h-[75vh] flex flex-col items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/20">
            <img
              src={capturedImage.dataUrl}
              alt="Captured Document"
              className="w-full h-full object-contain rounded-2xl"
            />
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-xs font-mono text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#25D366]" />
              <span>{(capturedImage.blob.size / 1024).toFixed(1)} KB in RAM</span>
            </div>
          </div>
        ) : cameraError ? (
          /* ERROR / PERMISSION DENIED FALLBACK */
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-center max-w-sm border border-white/20 space-y-4 m-4">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Camera Access Notice</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{cameraError}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => fileFallbackInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Upload from Photos / Gallery</span>
              </button>

              <button
                type="button"
                onClick={() => startCamera(cameraFacing)}
                className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors cursor-pointer border border-white/20"
              >
                Retry Camera Access
              </button>
            </div>
          </div>
        ) : (
          /* LIVE VIDEO VIEWFINDER */
          <div className="relative w-full h-full max-h-[75vh] bg-neutral-900 rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex items-center justify-center">
            {cameraLoading && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 text-white text-xs font-mono">
                <div className="w-8 h-8 rounded-full border-2 border-[#25D366] border-t-transparent animate-spin" />
                <span>Starting Camera...</span>
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Document alignment frame */}
            <div className="absolute inset-6 sm:inset-10 border-2 border-white/30 rounded-2xl pointer-events-none z-10 flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-[#25D366] rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-[#25D366] rounded-tr-lg" />
              </div>

              <div className="text-center">
                <span className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-white/90 border border-white/20">
                  Align document inside frame
                </span>
              </div>

              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-[#25D366] rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-[#25D366] rounded-br-lg" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM CONTROLS ── */}
      <div className="w-full max-w-lg px-6 py-5 z-30 bg-black/75 backdrop-blur-lg border-t border-white/10 flex items-center justify-between">
        {capturedImage ? (
          /* SNAPSHOT CONFIRMATION BUTTONS */
          <div className="w-full flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRetake}
              className="flex-1 py-3 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retake</span>
            </button>

            <button
              type="button"
              onClick={() => handleConfirmUse(true)}
              className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#2a1b00] font-bold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
              title="Open in Redaction Studio to mask sensitive details"
            >
              <Eye className="w-4 h-4" />
              <span>Mask ID</span>
            </button>

            <button
              type="button"
              onClick={() => handleConfirmUse(false)}
              className="flex-1 py-3 px-4 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-[#002109] font-bold text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Use Photo</span>
            </button>
          </div>
        ) : (
          /* LIVE SHUTTER CONTROLS */
          <div className="w-full flex items-center justify-between">
            {/* Gallery Upload Alternative */}
            <button
              type="button"
              onClick={() => fileFallbackInputRef.current?.click()}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              title="Pick from Gallery"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleTakeSnapshot}
              disabled={cameraLoading || !!cameraError}
              className="w-18 h-18 rounded-full bg-white/20 border-4 border-white flex items-center justify-center p-1 transition-transform active:scale-90 disabled:opacity-40 cursor-pointer shadow-[0_0_24px_rgba(37,211,102,0.4)]"
              title="Take Photo"
            >
              <div className="w-full h-full rounded-full bg-white hover:bg-emerald-100 transition-colors flex items-center justify-center">
                <Camera className="w-6 h-6 text-[#075E54]" />
              </div>
            </button>

            {/* Switch Camera Button */}
            <button
              type="button"
              onClick={toggleCameraFacing}
              disabled={cameraLoading || !!cameraError}
              className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Flip Camera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Picker Fallback */}
      <input
        ref={fileFallbackInputRef}
        type="file"
        accept="image/*"
        onChange={handleFallbackFile}
        className="hidden"
      />
    </div>
  );
};
