import React, { useState } from 'react';
import { Store, QrCode, X, Check, DollarSign, Shield, RefreshCw } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveShopName(name.trim());
    onSaveUpiId(upi.trim());
    onSaveBwRate(Number(bw) || 2);
    onSaveColorRate(Number(color) || 10);

    toast.success('Settings Saved', 'Shop details and pricing updated in RAM & storage.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm p-4 overflow-y-auto flex items-center justify-center">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#bec9c5] space-y-4 my-auto relative animate-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#bec9c5]/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00453d] text-white flex items-center justify-center font-bold shadow-xs">
              <Store className="w-4 h-4 text-[#3de273]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#00453d]">Shop Terminal Settings</h3>
              <p className="text-[11px] text-[#6f7976]">Customize shop name, UPI ID & pricing</p>
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

          {/* Reset Master Counter Session */}
          <div className="p-3 bg-red-50 rounded-2xl border border-red-200 space-y-1.5 mt-2">
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
                className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
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
          <div className="flex gap-2 pt-2">
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
