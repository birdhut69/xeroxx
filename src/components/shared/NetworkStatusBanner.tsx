import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Check } from 'lucide-react';

export const NetworkStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-200 pointer-events-none">
      {!isOnline ? (
        <div className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 border border-amber-400/50">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>No Internet Connection • Reconnecting...</span>
        </div>
      ) : showRestored ? (
        <div className="px-4 py-1.5 rounded-full bg-[#00a884] text-white text-xs font-bold shadow-lg flex items-center gap-2 border border-emerald-400/50">
          <Wifi className="w-3.5 h-3.5" />
          <span>Back Online</span>
        </div>
      ) : null}
    </div>
  );
};
