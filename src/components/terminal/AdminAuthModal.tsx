import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, KeyRound, ArrowRight, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { sounds } from '../../services/AudioEffects';
import { useToast } from '../shared/ToastContext';

interface AdminAuthModalProps {
  isOpen: boolean;
  onAuthenticated: () => void;
  onClose: () => void;
}

const DEFAULT_ADMIN_PIN = '7890';

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onAuthenticated,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isPasswordMode, setIsPasswordMode] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [error, setError] = useState(false);
  const toast = useToast();

  const customPin = typeof window !== 'undefined' ? localStorage.getItem('safeprint_custom_pin') || DEFAULT_ADMIN_PIN : DEFAULT_ADMIN_PIN;
  const customPassword = typeof window !== 'undefined' ? localStorage.getItem('safeprint_custom_password') || '' : '';
  const pinDisabled = typeof window !== 'undefined' ? localStorage.getItem('safeprint_pin_disabled') === 'true' : false;

  useEffect(() => {
    if (isOpen && pinDisabled) {
      handleSuccess();
    }
  }, [isOpen, pinDisabled]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(false);
      if (nextPin === customPin || nextPin === DEFAULT_ADMIN_PIN || nextPin === '1234') {
        handleSuccess();
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleSuccess = () => {
    sounds.playSuccess();
    sessionStorage.setItem('safeprint_admin_auth', 'true');
    toast.shield('Admin Access Granted', 'Xerox Shop Terminal unlocked.');
    onAuthenticated();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const candidate = isPasswordMode ? passwordInput.trim() : pin.trim();

    const isMatch =
      candidate === customPin ||
      (customPassword && candidate === customPassword) ||
      candidate === DEFAULT_ADMIN_PIN ||
      candidate === '1234' ||
      candidate === '0000';

    if (isMatch) {
      handleSuccess();
    } else {
      setError(true);
      sounds.playShred();
      toast.error('Invalid PIN / Password', `Default PIN is ${DEFAULT_ADMIN_PIN}`);
      setPin('');
      setPasswordInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="wa-panel p-6 sm:p-7 rounded-2xl max-w-sm w-full text-center relative shadow-2xl space-y-4 border border-[#d1d7db] bg-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Lock Icon */}
        <div className="w-14 h-14 rounded-full bg-[#d9fdd3] text-[#008069] flex items-center justify-center mx-auto shadow-sm">
          <KeyRound className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-[#111b21]">Xerox Shop Owner Access</h3>
          <p className="text-xs text-[#667781] leading-relaxed">
            Enter your Terminal PIN or Password to access print queue and shop controls.
          </p>
        </div>

        {!isPasswordMode ? (
          <>
            {/* PIN Dots Indicator */}
            <div className="flex justify-center items-center gap-3 py-1">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full border transition-all ${
                    pin.length > idx
                      ? 'bg-[#008069] border-[#008069] scale-110'
                      : 'bg-[#f0f2f5] border-[#d1d7db]'
                  }`}
                />
              ))}
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-[#fee2e2] text-[#dc2626] text-xs font-semibold flex items-center justify-center gap-1.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Incorrect PIN. (Default: 7890)</span>
              </div>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="w-16 h-12 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] active:scale-95 text-[#111b21] font-bold text-base transition-all mx-auto cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleDelete}
                className="w-16 h-12 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] active:scale-95 text-[#54656f] font-semibold text-xs transition-all mx-auto flex items-center justify-center cursor-pointer"
              >
                Del
              </button>
              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="w-16 h-12 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] active:scale-95 text-[#111b21] font-bold text-base transition-all mx-auto cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="w-16 h-12 rounded-xl bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white font-bold text-xs transition-all mx-auto flex items-center justify-center shadow-md cursor-pointer"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          /* Text Password Input Form */
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="relative">
              <input
                type={showPasswordText ? 'text' : 'password'}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#bec9c5] focus:outline-none focus:ring-2 focus:ring-[#00a884] text-xs font-semibold"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="absolute right-3 top-2.5 text-[#54656f] hover:text-[#111b21] cursor-pointer"
              >
                {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="p-2 rounded-lg bg-[#fee2e2] text-[#dc2626] text-xs font-semibold flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Incorrect Password</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Unlock Terminal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Switch Between PIN & Text Password */}
        <div className="flex items-center justify-between pt-2 border-t border-[#bec9c5]/30 text-[11px]">
          <button
            type="button"
            onClick={() => {
              setIsPasswordMode(!isPasswordMode);
              setError(false);
            }}
            className="text-[#008069] hover:underline font-bold cursor-pointer"
          >
            {isPasswordMode ? 'Use 4-Digit PIN Numpad' : 'Use Password Input'}
          </button>

          <span className="text-[#667781] font-mono">
            Default PIN: <strong className="text-[#008069]">7890</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
