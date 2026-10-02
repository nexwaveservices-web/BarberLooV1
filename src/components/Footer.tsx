import React from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';

interface FooterProps {
  onNavigate: (page: PageView) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();

  const handleNav = (page: PageView) => {
    onNavigate(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#111113] text-[#FFF9E8] border-t border-[#F1E194]/15">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-[#F1E194]/12">
          {/* Brand Column */}
          <div className="md:col-span-6 space-y-4">
            <div className="font-display text-3xl font-bold tracking-[0.16em] text-[#FFF9E8]">
              BARBERLOO
            </div>
            <p className="text-sm text-[#8A8178] max-w-md leading-relaxed">
              {tr(
                'India’s luxury grooming reservation and live chair queue platform. Connecting discerning clients with verified partner barbershops across Mumbai, Bengaluru, New Delhi, and beyond.',
                'भारत का प्रमुख लग्ज़री ग्रूमिंग अपॉइंटमेंट और लाइव कतार प्लेटफ़ॉर्म। मुंबई, बेंगलुरु, नई दिल्ली और पूरे भारत में सत्यापित सैलून नेटवर्क।'
              )}
            </p>
            <p className="text-xs font-mono-num tracking-[0.22em] text-[#F1E194] uppercase pt-1">
              {tr(
                'INR (₹) • IST (UTC+05:30) • REAL-TIME QUEUE',
                'भारतीय रुपया (₹) • भारतीय मानक समय (IST) • लाइव कतार'
              )}
            </p>
          </div>

          {/* Navigation */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
              {tr('Explore', 'एक्सप्लोर करें')}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#FFF9E8]/75">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('home')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('Home & Discovery', 'होम और खोज')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('shop')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('Partner Salons', 'पार्टनर सैलून')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('booking')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('Book Appointment (IST)', 'अपॉइंटमेंट बुक करें (IST)')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('queue')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('Live Chair Queue', 'लाइव चेयर कतार')}
                </button>
              </li>
            </ul>
          </div>

          {/* Cities */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
              {tr('Indian Network', 'भारतीय नेटवर्क')}
            </h3>
            <p className="text-sm text-[#8A8178] leading-relaxed">
              {tr('Mumbai · Bengaluru · New Delhi', 'मुंबई · बेंगलुरु · नई दिल्ली')}
              <br />
              {tr(
                'Standard Operating Hours: 09:30 – 21:30 IST',
                'मानक समय: सुबह 09:30 – रात 09:30 IST'
              )}
            </p>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8A8178]">
          <p>
            © {new Date().getFullYear()} BarberLoo India.{' '}
            {tr('All rights reserved.', 'सर्वाधिकार सुरक्षित।')}
          </p>
          <div className="flex items-center gap-6">
            <span>{tr('Privacy Policy', 'गोपनीयता नीति')}</span>
            <span>{tr('Terms of Service', 'सेवा की शर्तें')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
