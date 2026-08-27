import React, { useState } from 'react';
import { ShieldCheck, Lock, Volume2, VolumeX, Smartphone, Monitor, HelpCircle, Menu, X, LogOut, KeyRound } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { ComparisonModal } from './ComparisonModal';
import { AdminAuthModal } from '../terminal/AdminAuthModal';
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    setMobileMenuOpen(false);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    onAdminLogin();
    onModeChange('TERMINAL');
    setMobileMenuOpen(false);
  };

  const handleLogout = () => {
    onAdminLogout();
    onModeChange('CUSTOMER');
    toast.info('Terminal Locked', 'Shop Owner logged out.');
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#008069] text-white px-3 sm:px-6 py-2.5 shadow-md transition-all duration-300 no-print">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand & Security Guarantee */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 border border-white/30 shadow-sm shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  SafePrint
                </span>
                <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  {currentMode === 'TERMINAL' ? 'Shop Admin' : 'Zero-Trust'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-white/80 hidden sm:flex items-center gap-1 font-mono">
                <Lock className="w-3 h-3 text-white inline" />
                100% In-Memory • 0 KB Disk Storage
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center bg-black/15 p-1 rounded-xl border border-white/20">
            <button
              onClick={() => handleSelectMode('CUSTOMER')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentMode === 'CUSTOMER'
                  ? 'bg-white text-[#008069] shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer Send (Chat)</span>
            </button>

            <button
              onClick={() => handleSelectMode('TERMINAL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentMode === 'TERMINAL'
                  ? 'bg-white text-[#008069] shadow-sm'
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              {isAdminAuthenticated ? <Monitor className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5 text-amber-300" />}
              <span>Shop Owner Admin</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {currentMode === 'TERMINAL' && isAdminAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-black/20 hover:bg-red-500/30 text-white text-xs font-semibold transition-all border border-white/20"
                title="Lock Terminal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lock</span>
              </button>
            )}

            <button
              onClick={() => setShowComparison(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 text-white text-xs font-medium transition-all"
              title="Why SafePrint is safer than WhatsApp"
            >
              <HelpCircle className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Why SafePrint?</span>
            </button>

            <button
              onClick={toggleAudio}
              title={audioEnabled ? 'Mute Sound FX' : 'Enable Sound FX'}
              className="p-1.5 sm:p-2 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors"
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 opacity-60" />}
            </button>

            {/* Mobile Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg bg-white/15 text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-2.5 pb-1 space-y-2 border-t border-white/20 mt-2.5">
            <div className="grid grid-cols-2 gap-1.5 bg-black/15 p-1 rounded-xl">
              <button
                onClick={() => handleSelectMode('CUSTOMER')}
                className={`py-2 px-2 rounded-lg text-xs font-bold text-center flex flex-col items-center gap-1 ${
                  currentMode === 'CUSTOMER' ? 'bg-white text-[#008069]' : 'text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Customer Send</span>
              </button>

              <button
                onClick={() => handleSelectMode('TERMINAL')}
                className={`py-2 px-2 rounded-lg text-xs font-bold text-center flex flex-col items-center gap-1 ${
                  currentMode === 'TERMINAL' ? 'bg-white text-[#008069]' : 'text-white'
                }`}
              >
                {isAdminAuthenticated ? <Monitor className="w-4 h-4" /> : <KeyRound className="w-4 h-4 text-amber-300" />}
                <span>Shop Admin</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Admin Auth Modal */}
      <AdminAuthModal
        isOpen={showAuthModal}
        onAuthenticated={handleAuthSuccess}
        onClose={() => setShowAuthModal(false)}
      />

      {/* Comparison Modal */}
      <ComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} />
    </>
  );
};
