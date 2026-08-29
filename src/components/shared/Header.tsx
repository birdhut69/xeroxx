import React, { useState } from 'react';
import { Shield, Smartphone, Monitor, Volume2, VolumeX, Flame, Lock, HelpCircle, KeyRound, LogOut } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { ComparisonModal } from './ComparisonModal';
import { AdminAuthModal } from '../terminal/AdminAuthModal';
import { RAMProofModal } from './RAMProofModal';
import { useToast } from './ToastContext';

type AppMode = 'TERMINAL' | 'CUSTOMER';

interface HeaderProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  serverOnline?: boolean;
  isAdminAuthenticated: boolean;
  onAdminLogin: () => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  serverOnline = true,
  isAdminAuthenticated,
  onAdminLogin,
  onAdminLogout,
}) => {
  const [audioEnabled, setAudioEnabled] = useState(sounds.enabled);
  const [showComparison, setShowComparison] = useState(false);
  const [showRAMProof, setShowRAMProof] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const toast = useToast();

  const toggleAudio = () => {
    sounds.enabled = !sounds.enabled;
    setAudioEnabled(sounds.enabled);
    if (sounds.enabled) sounds.playSuccess();
  };

  const handleSelectMode = (mode: AppMode) => {
    if (mode === 'TERMINAL' && !isAdminAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    onModeChange(mode);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    onAdminLogin();
    onModeChange('TERMINAL');
  };

  const handleLogout = () => {
    onAdminLogout();
    onModeChange('CUSTOMER');
    toast.info('Terminal Locked', 'Shopkeeper logged out.');
  };

  const handleEmergencyPurge = () => {
    sounds.playShred();
    sessionStorage.clear();
    toast.shield('Emergency Purge Executed', 'All volatile RAM buffers zeroized.');
    setTimeout(() => {
      window.location.href = '/';
    }, 400);
  };

  return (
    <>
      <header className="bg-[#075E54] text-white flex justify-between items-center h-[60px] px-4 sm:px-6 w-full z-50 sticky top-0 border-b border-[#bec9c5]/30 shadow-md no-print">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSelectMode('CUSTOMER')}>
            <div className="w-8 h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center text-white">
              <Shield className="w-5 h-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-white leading-none">CipherPrint</span>
              <span className="text-[9px] uppercase tracking-widest text-[#8cd4c7] font-mono mt-0.5">Zero-Trace Ephemeral</span>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <nav className="flex items-center bg-black/25 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => handleSelectMode('CUSTOMER')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'CUSTOMER'
                  ? 'bg-white text-[#075e54] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer</span>
            </button>

            <button
              onClick={() => handleSelectMode('TERMINAL')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'TERMINAL' && isAdminAuthenticated
                  ? 'bg-white text-[#075e54] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Terminal</span>
              {!isAdminAuthenticated && <KeyRound className="w-3 h-3 text-amber-300 ml-0.5" />}
            </button>
          </nav>
        </div>

        {/* Right: Actions & Emergency Purge */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* RAM Proof Trigger */}
          <button
            onClick={() => setShowRAMProof(true)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-mono text-emerald-200 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#25d366]" />
            <span>28 MB RAM • 0 Disk</span>
          </button>

          {/* Emergency Purge Button */}
          <button
            onClick={handleEmergencyPurge}
            className="bg-[#EF4444] hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
            title="Immediately zeroize all document memory in RAM"
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span className="hidden sm:inline">Emergency Purge</span>
          </button>

          {/* Audio Mute Toggle */}
          <button
            onClick={toggleAudio}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer"
            title={audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-200" /> : <VolumeX className="w-4 h-4 text-white/50" />}
          </button>

          {/* Comparison Modal */}
          <button
            onClick={() => setShowComparison(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors cursor-pointer hidden sm:block"
            title="SafePrint vs Traditional WhatsApp"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Terminal Logout */}
          {currentMode === 'TERMINAL' && isAdminAuthenticated && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-200 transition-colors cursor-pointer ml-1"
              title="Lock Terminal & Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Comparison & Auth Modals */}
      {showComparison && <ComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} />}
      {showRAMProof && (
        <RAMProofModal
          isOpen={showRAMProof}
          onClose={() => setShowRAMProof(false)}
          shopId="XEROX-CENTRAL-01"
          sessionId="CIPHER-PRINT-RAM-NODE"
        />
      )}
      {showAuthModal && (
        <AdminAuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={handleAuthSuccess}
        />
      )}
    </>
  );
};
