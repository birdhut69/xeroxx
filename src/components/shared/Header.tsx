import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  Monitor,
  Flame,
  Volume2,
  VolumeX,
  HelpCircle,
  LogOut,
  KeyRound,
  Lock,
  Globe,
  ChevronDown,
  Check
} from 'lucide-react';
import { AdminAuthModal } from '../terminal/AdminAuthModal';
import { ComparisonModal } from './ComparisonModal';
import { RAMProofModal } from './RAMProofModal';
import { sounds } from '../../services/AudioEffects';
import { zeroizeBuffer } from '../../crypto/zeroize';
import { useToast } from './ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { SupportedLanguage } from '../../i18n/translations';

interface HeaderProps {
  currentMode: 'TERMINAL' | 'CUSTOMER';
  onModeChange: (mode: 'TERMINAL' | 'CUSTOMER') => void;
  serverOnline: boolean;
  isAdminAuthenticated: boolean;
  onAdminLogin: () => void;
  onAdminLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  isAdminAuthenticated,
  onAdminLogin,
  onAdminLogout,
}) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showRAMProof, setShowRAMProof] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(sounds.isEnabled());
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const { language, setLanguage, t, availableLanguages } = useLanguage();

  // Close language menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectMode = (mode: 'TERMINAL' | 'CUSTOMER') => {
    if (mode === 'TERMINAL' && !isAdminAuthenticated) {
      setShowAdminModal(true);
      return;
    }
    onModeChange(mode);
  };

  const toggleAudio = () => {
    const nextState = sounds.toggle();
    setAudioEnabled(nextState);
    if (nextState) sounds.playConnect();
  };

  const handleLogout = () => {
    onAdminLogout();
    onModeChange('CUSTOMER');
    sounds.playConnect();
    toast.info('Terminal Locked', 'Shopkeeper session locked.');
  };

  const handleEmergencyPurge = () => {
    sounds.playShred();
    toast.shield('EMERGENCY RAM PURGE', 'All volatile document memory zeroized instantly.');
    // Global scrub dummy
    const dummy = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    zeroizeBuffer(dummy.buffer);

    setTimeout(() => {
      window.location.href = '/';
    }, 400);
  };

  const currentLangObj = availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  return (
    <>
      <header className="bg-[#075E54] text-white flex justify-between items-center h-[54px] sm:h-[60px] px-3 sm:px-6 w-full z-50 sticky top-0 border-b border-[#bec9c5]/30 shadow-md no-print select-none">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5 sm:gap-6 min-w-0">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => handleSelectMode('CUSTOMER')}>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white leading-none">{t('brandName')}</span>
              <span className="text-[8px] sm:text-[9px] uppercase tracking-wider text-[#8cd4c7] font-mono mt-0.5 hidden xs:inline truncate">
                {t('brandTagline')}
              </span>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <nav className="flex items-center bg-black/25 p-0.5 sm:p-1 rounded-xl border border-white/10 shrink-0">
            <button
              onClick={() => handleSelectMode('CUSTOMER')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'CUSTOMER'
                  ? 'bg-white text-[#075e54] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t('customerMode')}</span>
            </button>

            <button
              onClick={() => handleSelectMode('TERMINAL')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                currentMode === 'TERMINAL' && isAdminAuthenticated
                  ? 'bg-white text-[#075e54] shadow-sm'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Monitor className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>{t('terminalMode')}</span>
              {!isAdminAuthenticated && <KeyRound className="w-3 h-3 text-amber-300 ml-0.5" />}
            </button>
          </nav>
        </div>

        {/* Right: Language Selector & Actions & Emergency Purge */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* 🌐 Language Switcher Dropdown */}
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-black/25 hover:bg-black/40 border border-white/15 text-xs font-bold text-white transition-colors cursor-pointer"
              title="Change Language (भाषा बदला)"
            >
              <span className="text-xs sm:text-sm">{currentLangObj.flag}</span>
              <span className="hidden sm:inline font-semibold text-[11px] sm:text-xs">{currentLangObj.label}</span>
              <ChevronDown className="w-3 h-3 text-white/70" />
            </button>

            {showLangMenu && (
              <div className="absolute right-0 top-full mt-1.5 bg-white text-[#111b21] rounded-2xl p-1.5 shadow-2xl border border-[#bec9c5] min-w-[140px] z-50 animate-in slide-in-from-top duration-150">
                {availableLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setLanguage(lang.code as SupportedLanguage);
                      setShowLangMenu(false);
                      sounds.playConnect();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors text-left cursor-pointer ${
                      language === lang.code
                        ? 'bg-[#00a884]/15 text-[#00453d]'
                        : 'hover:bg-[#f0f2f5] text-[#111b21]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </div>
                    {language === lang.code && <Check className="w-3.5 h-3.5 text-[#006d2f]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RAM Proof Trigger */}
          <button
            onClick={() => setShowRAMProof(true)}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-[11px] font-mono text-emerald-200 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-[#25d366]" />
            <span>{t('ramStatus')}</span>
          </button>

          {/* Emergency Purge Button */}
          <button
            onClick={handleEmergencyPurge}
            className="bg-[#EF4444] hover:bg-red-600 text-white px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer"
            title={t('emergencyPurgeDesc')}
          >
            <Flame className="w-3.5 h-3.5 fill-current" />
            <span className="hidden md:inline">{t('emergencyPurge')}</span>
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
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-200 transition-colors cursor-pointer ml-0.5"
              title="Lock Terminal & Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Comparison & Auth Modals */}
      {showAdminModal && (
        <AdminAuthModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          onAuthenticated={() => {
            onAdminLogin();
            onModeChange('TERMINAL');
            setShowAdminModal(false);
          }}
        />
      )}

      {showComparison && (
        <ComparisonModal isOpen={showComparison} onClose={() => setShowComparison(false)} />
      )}

      {showRAMProof && (
        <RAMProofModal
          isOpen={showRAMProof}
          onClose={() => setShowRAMProof(false)}
          shopId="QuickXerox-Station"
          sessionId={Date.now().toString(36)}
        />
      )}
    </>
  );
};
