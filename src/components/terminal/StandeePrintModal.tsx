import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Printer, Download, X, Lock, CheckCircle2, Smartphone, Sparkles } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface StandeePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerUrl: string;
  shopName: string;
  shopId: string;
}

export const StandeePrintModal: React.FC<StandeePrintModalProps> = ({
  isOpen,
  onClose,
  customerUrl,
  shopName,
  shopId,
}) => {
  const { t } = useLanguage();
  const printRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const handlePrintStandee = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto flex items-center justify-center overscroll-contain">
      <div className="bg-white rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-[#bec9c5] space-y-4 my-auto relative animate-in zoom-in-95 duration-150 max-h-[94dvh] overflow-y-auto overscroll-contain">
        {/* Modal Top Header (Hidden on Print) */}
        <div className="flex items-center justify-between pb-3 border-b border-[#bec9c5]/50 no-print">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#00453d] text-white flex items-center justify-center font-bold shadow-xs">
              <Shield className="w-4 h-4 text-[#3de273]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#00453d]">
                Counter Acrylic Standee Sign
              </h3>
              <p className="text-[11px] text-[#6f7976]">
                Print this A4 table tent to place on your Xerox counter.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#f0f2f5] text-[#54656f] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Standee Sheet (A4 / A5 Layout) */}
        <div
          ref={printRef}
          className="bg-[#fef9f0] rounded-2xl p-6 sm:p-8 border-2 border-[#00453d] text-center space-y-4 relative overflow-hidden shadow-inner print:border-4 print:border-black print:p-8 print:m-0 print:bg-white"
        >
          {/* Top Brand Banner */}
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#00453d]/20">
            <div className="flex items-center gap-2 text-left">
              <div className="w-10 h-10 rounded-xl bg-[#00453d] text-white flex items-center justify-center font-bold">
                <Shield className="w-6 h-6 text-[#25D366]" />
              </div>
              <div>
                <div className="text-lg font-black text-[#00453d] tracking-tight leading-none">
                  CipherPrint Zero-Trust
                </div>
                <div className="text-[10px] font-bold text-[#006d2f] uppercase tracking-wider mt-0.5">
                  100% Private • No WhatsApp Number Needed
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold text-[#1d1c17] font-mono">{shopName}</div>
              <div className="text-[10px] text-[#6f7976] font-mono">{shopId}</div>
            </div>
          </div>

          {/* Main Title & Catchline */}
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-[#00453d] uppercase tracking-wide">
              Scan & Print Privately
            </h2>
            <p className="text-xs sm:text-sm font-bold text-[#3f4946]">
              कागदपत्रे सुरक्षित प्रिंट करा • दस्तावेज़ सुरक्षित प्रिंट करें
            </p>
          </div>

          {/* Centerpiece Large Crisp QR Code */}
          <div className="p-4 sm:p-5 bg-white rounded-3xl border-3 border-[#00a884] shadow-md inline-block mx-auto">
            <QRCodeSVG
              value={customerUrl}
              size={200}
              level="H"
              includeMargin={false}
              imageSettings={{
                src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2300453d' stroke='%23ffffff' stroke-width='2'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>",
                x: undefined,
                y: undefined,
                height: 44,
                width: 44,
                excavate: true,
              }}
            />
          </div>

          {/* 3 Step Visual Instructions */}
          <div className="grid grid-cols-3 gap-2 text-left pt-2">
            <div className="bg-white p-2.5 rounded-xl border border-[#bec9c5]/40 text-center space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#00453d] text-white font-bold text-xs flex items-center justify-center mx-auto">
                1
              </div>
              <div className="text-[11px] font-bold text-[#1d1c17] leading-tight">Scan QR</div>
              <div className="text-[9px] text-[#6f7976]">Open Phone Camera</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-[#bec9c5]/40 text-center space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#00453d] text-white font-bold text-xs flex items-center justify-center mx-auto">
                2
              </div>
              <div className="text-[11px] font-bold text-[#1d1c17] leading-tight">Send Files</div>
              <div className="text-[9px] text-[#6f7976]">PDF, Photos, Scans</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-[#bec9c5]/40 text-center space-y-1">
              <div className="w-6 h-6 rounded-full bg-[#006d2f] text-white font-bold text-xs flex items-center justify-center mx-auto">
                3
              </div>
              <div className="text-[11px] font-bold text-[#006d2f] leading-tight">Zero Disk</div>
              <div className="text-[9px] text-[#6f7976]">Deleted After Print</div>
            </div>
          </div>

          {/* Security Guarantee Pill */}
          <div className="pt-2 border-t border-[#bec9c5]/40 flex items-center justify-between text-[11px] font-mono text-[#00453d] font-bold">
            <span className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-[#006d2f]" />
              AES-256-GCM RAM Only
            </span>
            <span className="text-[#006d2f]">DoD 5220.22-M Compliant</span>
          </div>
        </div>

        {/* Action Controls (Hidden on Print) */}
        <div className="flex gap-2.5 pt-1 no-print">
          <button
            onClick={handlePrintStandee}
            className="flex-1 py-3 px-4 rounded-xl bg-[#00453d] hover:bg-[#075e54] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-transform active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Counter Standee (A4)</span>
          </button>

          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-[#f0f2f5] hover:bg-[#e9edef] text-[#54656f] text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
