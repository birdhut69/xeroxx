import React, { useState } from 'react';
import { IndianRupee, QrCode, Send, X, Check, Calculator, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendRequest: (amount: number, upiId: string, note: string) => void;
  customerName: string;
  defaultPages?: number;
  defaultCopies?: number;
  defaultIsColor?: boolean;
}

export const PaymentRequestModal: React.FC<PaymentRequestModalProps> = ({
  isOpen,
  onClose,
  onSendRequest,
  customerName,
  defaultPages = 1,
  defaultCopies = 1,
  defaultIsColor = false,
}) => {
  const [pages, setPages] = useState(defaultPages);
  const [copies, setCopies] = useState(defaultCopies);
  const [isColor, setIsColor] = useState(defaultIsColor);
  const [customAmount, setCustomAmount] = useState<number | ''>('');
  const [upiId, setUpiId] = useState(() => localStorage.getItem('safeprint_shop_upi') || 'xeroxshop@upi');
  const [note, setNote] = useState('Photocopy & Printing');

  if (!isOpen) return null;

  // Pricing formula: B&W = ₹2/page, Color = ₹10/page
  const ratePerPage = isColor ? 10 : 2;
  const calculatedTotal = (pages * copies * ratePerPage);
  const finalAmount = typeof customAmount === 'number' && customAmount > 0 ? customAmount : calculatedTotal;

  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent('SafePrint Xerox')}&am=${finalAmount}&cu=INR&tn=${encodeURIComponent(note)}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (finalAmount <= 0) return;
    localStorage.setItem('safeprint_shop_upi', upiId);
    onSendRequest(finalAmount, upiId, note);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-4 flex items-center justify-center animate-in zoom-in-95 duration-150">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-[#d1d7db] text-left">
        {/* Header */}
        <div className="bg-[#008069] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-bold text-base">
            <IndianRupee className="w-5 h-5" />
            <span>Request UPI Payment</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Customer info */}
          <div className="bg-[#f0f2f5] p-3 rounded-2xl border border-[#d1d7db] flex items-center justify-between text-xs">
            <span className="text-[#54656f] font-medium">Customer:</span>
            <span className="font-bold text-[#111b21]">{customerName}</span>
          </div>

          {/* Quick Rate Calculator */}
          <div className="bg-[#f8fafc] p-3.5 rounded-2xl border border-[#d1d7db] space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-[#008069]">
              <span className="flex items-center gap-1">
                <Calculator className="w-3.5 h-3.5" />
                <span>Rate Calculator</span>
              </span>
              <span>₹{ratePerPage}/page</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="text-[11px] font-bold text-[#54656f] block mb-1">Pages:</label>
                <input
                  type="number"
                  min="1"
                  value={pages}
                  onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-[#d1d7db] font-bold text-[#111b21] text-center"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#54656f] block mb-1">Copies:</label>
                <input
                  type="number"
                  min="1"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-[#d1d7db] font-bold text-[#111b21] text-center"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#54656f] block mb-1">Type:</label>
                <button
                  type="button"
                  onClick={() => setIsColor(!isColor)}
                  className={`w-full py-1.5 px-2 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                    isColor
                      ? 'bg-[#008069] text-white border-[#008069]'
                      : 'bg-white text-[#111b21] border-[#d1d7db]'
                  }`}
                >
                  {isColor ? 'Color' : 'B&W'}
                </button>
              </div>
            </div>
          </div>

          {/* Amount Display & Override */}
          <div className="p-3.5 rounded-2xl bg-[#d9fdd3] border border-[#00a884]/40 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[11px] font-bold text-[#008069] block uppercase tracking-wider">Total Bill Amount</span>
              <span className="text-2xl font-black text-[#111b21]">₹{finalAmount}</span>
            </div>
            <div className="text-right">
              <input
                type="number"
                placeholder="Override ₹"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value ? parseFloat(e.target.value) : '')}
                className="w-24 px-2 py-1 rounded-lg bg-white border border-[#00a884]/40 text-xs font-bold text-[#111b21] text-center outline-none focus:border-[#008069]"
              />
            </div>
          </div>

          {/* Shopkeeper UPI ID */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-[#54656f] block">
              Your Shop UPI ID (for receiving payment):
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourshop@okaxis or paytmqr@paytm"
              className="w-full text-xs sm:text-sm px-3 py-2 rounded-xl bg-[#f0f2f5] border border-[#d1d7db] text-[#111b21] font-mono focus:outline-none focus:border-[#00a884]"
              required
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#111b21] text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>Send UPI Bill (₹{finalAmount})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
