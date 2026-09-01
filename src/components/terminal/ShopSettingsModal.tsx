import React, { useState } from 'react';
import { Store, QrCode, X, Check, DollarSign, Shield, RefreshCw, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../shared/ToastContext';

interface ShopSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  onSaveShopName: (name: string) => void;
  upiId: string;
  onSaveUpiId: (upi: string) => void;
  bwRate: number;
  onSaveBwRate: (rate: number) => void;
  colorRate: number;
  onSaveColorRate: (rate: number) => void;
  onRegenerateSession: () => void;
}

export const ShopSettingsModal: React.FC<ShopSettingsModalProps> = ({
  isOpen,
  onClose,
  shopName,
  onSaveShopName,
  upiId,
  onSaveUpiId,
  bwRate,
  onSaveBwRate,
  colorRate,
  onSaveColorRate,
  onRegenerateSession,
}) => {
  const { t } = useLanguage();
  const toast = useToast();

  const [name, setName] = useState(shopName);
  const [upi, setUpi] = useState(upiId);
  const [bw, setBw] = useState(bwRate);
  const [color, setColor] = useState(colorRate);

  // Security & PIN state
  const [adminPin, setAdminPin] = useState(() => {
    return localStorage.getItem('safeprint_custom_pin') || '7890';
  });
  const [requirePin, setRequirePin] = useState(() => {
    return localStorage.getItem('safeprint_pin_disabled') !== 'true';
  });
  const [customPassword, setCustomPassword] = useState(() => {
    return localStorage.getItem('safeprint_custom_password') || '';
  });
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveShopName(name.trim());
    onSaveUpiId(upi.trim());
    onSaveBwRate(Number(bw) || 2);
    onSaveColorRate(Number(color) || 10);

    // Save PIN and security settings
    if (adminPin.trim().length >= 4) {
      localStorage.setItem('safeprint_custom_pin', adminPin.trim());
    }
    if (customPassword.trim()) {
      localStorage.setItem('safeprint_custom_password', customPassword.trim());
    } else {
      localStorage.removeItem('safeprint_custom_password');
    }
    localStorage.setItem('safeprint_pin_disabled', (!requirePin).toString());

    toast.success('Settings Saved', 'Shop details, pricing & terminal PIN updated.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto flex items-center justify-center overscroll-contain">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-[#bec9c5] space-y-4 my-auto relative animate-in zoom-in-95 duration-150 max-h-[94dvh] overflow-y-auto overscroll-contain">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#bec9c5]/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00453d] text-white flex items-center justify-center font-bold shadow-xs">
              <Store className="w-4 h-4 text-[#3de273]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#00453d]">Shop Terminal Settings</h3>
              <p className="text-[11px] text-[#6f7976]">Customize shop name, UPI, rates & security PIN</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#f0f2f5] text-[#54656f] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-3.5 text-left text-xs">
          {/* Shop Name */}
          <div className="space-y-1">
            <label className="font-bold text-[#1d1c17]">Shop / Center Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shree Ganesh Xerox & Stationery"
              className="w-full px-3 py-2.5 rounded-xl border border-[#bec9c5] focus:outline-none focus:ring-2 focus:ring-[#00a884] text-xs font-semibold text-[#1d1c17]"
              required
            />
            <p className="text-[10px] text-[#6f7976]">Shown to customers when they scan your standee QR.</p>
          </div>

          {/* UPI ID */}
          <div className="space-y-1">
            <label className="font-bold text-[#1d1c17]">Merchant UPI ID (GPay / PhonePe / Paytm)</label>
            <input
              type="text"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="e.g. 9876543210@paytm or shop@okhdfcbank"
              className="w-full px-3 py-2.5 rounded-xl border border-[#bec9c5] focus:outline-none focus:ring-2 focus:ring-[#00a884] text-xs font-mono text-[#1d1c17]"
            />
            <p className="text-[10px] text-[#6f7976]">Customers can pay print charges directly to this UPI ID.</p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="font-bold text-[#1d1c17]">B&W Rate (₹/page)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={bw}
                onChange={(e) => setBw(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#bec9c5] focus:outline-none focus:ring-2 focus:ring-[#00a884] font-mono font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-[#1d1c17]">Color Rate (₹/page)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={color}
                onChange={(e) => setColor(parseFloat(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#bec9c5] focus:outline-none focus:ring-2 focus:ring-[#00a884] font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* 🔒 Security & Terminal PIN Section */}
          <div className="p-3.5 bg-[#f8fafc] rounded-2xl border border-[#bec9c5]/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-[#00453d] text-[11.5px]">
                <KeyRound className="w-4 h-4 text-[#00a884]" />
                <span>Shop Owner PIN & Security</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[#54656f]">
                <input
                  type="checkbox"
                  checked={requirePin}
                  onChange={(e) => setRequirePin(e.target.checked)}
                  className="accent-[#00a884] w-3.5 h-3.5 rounded cursor-pointer"
                />
                <span>Require PIN</span>
              </label>
            </div>

            {requirePin ? (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <label className="font-semibold text-[#1d1c17] text-[10.5px]">4-Digit Quick PIN</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="7890"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#bec9c5] focus:ring-1 focus:ring-[#00a884] font-mono font-bold text-xs text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-[#1d1c17] text-[10.5px]">Password (Optional)</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Optional text password"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#bec9c5] focus:ring-1 focus:ring-[#00a884] text-xs font-semibold pr-7"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-2 text-[#54656f] cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2 bg-emerald-50 text-[#006d2f] text-[10.5px] rounded-lg border border-emerald-200 leading-tight">
                ⚡ <strong>Instant Counter Mode</strong>: PIN is disabled. The Terminal will open directly without asking for a PIN on this device.
              </div>
            )}
          </div>

          {/* Reset Master Counter Session */}
          <div className="p-3 bg-red-50 rounded-2xl border border-red-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-red-800 text-[11px]">Regenerate Master Standee QR</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Regenerate Master Standee QR? Existing active sessions will be reset.')) {
                    onRegenerateSession();
                    onClose();
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset QR</span>
              </button>
            </div>
            <p className="text-[10px] text-red-600 leading-tight">
              Only reset if you want to invalidate all previous printed standees.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#00453d] hover:bg-[#075e54] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-98"
            >
              <Check className="w-4 h-4" />
              <span>Save & Update</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] font-semibold text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
