import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Download,
  Printer,
  ExternalLink,
  X,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { ShopItem } from '../data/barberlooData';
import { getShopQrDestinationUrl, getProductionDomain } from '../lib/domain';
import { useLanguage } from '../lib/i18n';

interface SalonQrModalProps {
  shop: ShopItem | null;
  isOpen: boolean;
  onClose: () => void;
  platformSettings?: any;
}

export const SalonQrModal: React.FC<SalonQrModalProps> = ({
  shop,
  isOpen,
  onClose,
  platformSettings,
}) => {
  const { tr } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [dataUrl, setDataUrl] = useState<string>('');

  const domain = getProductionDomain(platformSettings);
  const destinationUrl = shop
    ? getShopQrDestinationUrl(shop.id, { domain })
    : `${domain}/booking.html`;

  useEffect(() => {
    if (!isOpen || !shop || !canvasRef.current) return;

    QRCode.toCanvas(
      canvasRef.current,
      destinationUrl,
      {
        width: 280,
        margin: 2,
        color: {
          dark: '#111113',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      },
      (err) => {
        if (!err && canvasRef.current) {
          setDataUrl(canvasRef.current.toDataURL('image/png'));
        }
      }
    );
  }, [isOpen, shop, destinationUrl]);

  if (!isOpen || !shop) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(destinationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `barberloo-qr-${shop.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>BarberLoo Salon QR Standee - ${shop.name}</title>
          <style>
            body {
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              text-align: center;
              padding: 40px 20px;
              background: #fff;
              color: #111113;
            }
            .standee-card {
              max-width: 420px;
              margin: 0 auto;
              border: 3px solid #5B0E14;
              border-radius: 24px;
              padding: 32px 24px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            }
            .badge {
              display: inline-block;
              background: #5B0E14;
              color: #F1E194;
              padding: 6px 14px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 2px;
              text-transform: uppercase;
              border-radius: 999px;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 26px;
              margin: 8px 0;
              color: #111113;
            }
            p.sub {
              font-size: 13px;
              color: #666;
              margin-bottom: 24px;
            }
            .qr-img {
              width: 240px;
              height: 240px;
              margin: 0 auto;
              border: 4px solid #F1E194;
              border-radius: 16px;
              padding: 8px;
            }
            .url-box {
              margin-top: 20px;
              font-family: monospace;
              font-size: 12px;
              color: #5B0E14;
              font-weight: 600;
              word-break: break-all;
            }
            .footer {
              margin-top: 24px;
              font-size: 11px;
              color: #888;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
          </style>
        </head>
        <body>
          <div class="standee-card">
            <div class="badge">BarberLoo VIP Express Pass</div>
            <h1>${shop.name}</h1>
            <p class="sub">${shop.address || 'Flagship Grooming Salon'}</p>
            <img class="qr-img" src="${dataUrl}" alt="Salon QR" />
            <div class="url-box">${destinationUrl}</div>
            <div class="footer">Scan with any phone camera to book instant appointment</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-lg w-full rounded-[28px] bg-[#1a1214] border border-[#F1E194]/30 p-6 sm:p-8 text-[#FFF9E8] shadow-2xl relative space-y-6">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#241719] border border-[#F1E194]/20 flex items-center justify-center text-[#8A8178] hover:text-[#FFF9E8] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 pr-8">
          <div className="w-12 h-12 rounded-[16px] bg-[#5B0E14] border border-[#F1E194]/30 flex items-center justify-center text-[#F1E194]">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#F1E194]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{tr('OFFICIAL SALON QR DESTINATION', 'सैलून आधिकारिक QR पास')}</span>
            </div>
            <h3 className="font-display text-2xl font-bold mt-0.5 text-[#FFF9E8]">
              {shop.name}
            </h3>
          </div>
        </div>

        {/* QR Display Card */}
        <div className="rounded-[22px] bg-[#FAF6EA] p-6 flex flex-col items-center justify-center text-center border-2 border-[#F1E194]/50 shadow-inner">
          <div className="p-2 bg-white rounded-[16px] shadow-md border border-[#111113]/10">
            <canvas ref={canvasRef} className="rounded-[10px]" />
          </div>

          <div className="mt-4 space-y-1">
            <span className="inline-block px-3 py-1 rounded-full bg-[#5B0E14] text-[#F1E194] text-[10px] font-bold tracking-wider uppercase">
              {tr('Scan with Any Smartphone', 'किसी भी फ़ोन कैमरे से स्कैन करें')}
            </span>
            <p className="text-xs text-[#5B0E14] font-medium pt-1">
              {shop.district ? `${shop.district} · ` : ''}
              {tr('Direct Instant Salon Booking', 'सीधा त्वरित सैलून बुकिंग पास')}
            </p>
          </div>
        </div>

        {/* Domain & URL Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-[#8A8178]">
            <span>{tr('Authoritative Production Domain', 'आधिकारिक डोमेन')}</span>
            <span className="font-mono-num font-semibold text-emerald-400">
              {domain.replace('https://', '')} (Verified)
            </span>
          </div>

          <div className="p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 flex items-center justify-between gap-3">
            <span className="font-mono-num text-xs text-[#F1E194] break-all select-all">
              {destinationUrl}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="p-2 rounded-[10px] bg-[#241719] hover:bg-[#322023] text-[#F1E194] cursor-pointer transition-colors shrink-0"
              title="Copy URL"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="py-3 px-4 rounded-[14px] bg-[#241719] border border-[#F1E194]/25 hover:bg-[#322023] text-xs font-semibold text-[#FFF9E8] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tr('Copied Link', 'कॉपी हो गया')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#F1E194]" />
                <span>{tr('Copy Link', 'लिंक कॉपी करें')}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="py-3 px-4 rounded-[14px] bg-[#5B0E14] hover:bg-[#73121a] text-xs font-semibold text-[#FFF9E8] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
          >
            <Download className="w-3.5 h-3.5 text-[#F1E194]" />
            <span>{tr('Download PNG', 'PNG डाउनलोड करें')}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="py-3 px-4 rounded-[14px] bg-[#F1E194] hover:bg-[#FFF9E8] text-xs font-bold text-[#111113] transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{tr('Print Standee', 'स्टैंडी प्रिंट करें')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
