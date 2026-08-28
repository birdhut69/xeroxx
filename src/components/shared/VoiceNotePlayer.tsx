import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface VoiceNotePlayerProps {
  audioBuffer?: ArrayBuffer | null;
  audioBase64?: string | null;
  timestamp: number;
  isMe?: boolean;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  audioBuffer,
  audioBase64,
  timestamp,
  isMe = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (audioBuffer) {
      const blob = new Blob([audioBuffer], { type: 'audio/webm' });
      url = URL.createObjectURL(blob);
    } else if (audioBase64) {
      url = audioBase64.startsWith('data:') ? audioBase64 : `data:audio/webm;base64,${audioBase64}`;
    }

    if (url) {
      setAudioSrc(url);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 5);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (url && audioBuffer) {
        URL.revokeObjectURL(url);
      }
    };
  }, [audioBuffer, audioBase64]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 p-2 w-full min-w-[200px] max-w-xs">
      {/* WhatsApp Circular Avatar with Mic Badge */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xs ${
            isMe ? 'bg-[#008069] text-white' : 'bg-[#00a884] text-white'
          }`}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-[#d1d7db] flex items-center justify-center shadow-xs">
          <Mic className="w-2.5 h-2.5 text-[#008069]" />
        </span>
      </div>

      {/* Voice Waveform Mock & Progress Bar */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-0.5 h-6">
          {[40, 70, 90, 60, 30, 80, 100, 75, 45, 60, 85, 50, 65, 95, 40, 70].map((height, i) => {
            const barPercent = (i / 16) * 100;
            const isPlayed = barPercent <= progressPercent;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isPlayed
                    ? isMe
                      ? 'bg-[#008069]'
                      : 'bg-[#00a884]'
                    : 'bg-[#d1d7db]'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-[#667781] font-mono">
          <span>{formatTime(isPlaying ? currentTime : duration || 0)}</span>
          <span>{new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
};
