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
          <div className="md:col-span-4 space-y-4">
            <div className="font-display text-3xl font-bold tracking-[0.16em] text-[#FFF9E8]">
              BARBERLOO
            </div>
            <p className="text-sm text-[#8A8178] max-w-sm leading-relaxed">
              {tr(
                'India’s luxury grooming reservation and verified appointment platform. Connecting discerning clients with verified partner barbershops across Mumbai, Bengaluru, New Delhi, and beyond.',
                'भारत का प्रमुख लग्ज़री ग्रूमिंग अपॉइंटमेंट प्लेटफ़ॉर्म। मुंबई, बेंगलुरु, नई दिल्ली और पूरे भारत में सत्यापित सैलून नेटवर्क।'
              )}
            </p>
            <p className="text-xs font-mono-num tracking-[0.22em] text-[#F1E194] uppercase pt-1">
              {tr(
                'INR (₹) • IST (UTC+05:30) • VERIFIED APPOINTMENTS',
                'भारतीय रुपया (₹) • भारतीय मानक समय (IST) • सत्यापित अपॉइंटमेंट्स'
              )}
            </p>
          </div>

          {/* Company & Discovery */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
              {tr('Company & Experience', 'कंपनी और अनुभव')}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#FFF9E8]/75">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('about-us')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('About BarberLoo', 'बारबरलू के बारे में')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('contact-us')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer"
                >
                  {tr('Contact & Support', 'संपर्क एवं सहायता')}
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
            </ul>
          </div>

          {/* Legal & Policies */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
              {tr('Legal & Compliance', 'कानूनी एवं नीतियां')}
            </h3>
            <ul className="space-y-2.5 text-sm text-[#FFF9E8]/75">
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('refund-policy')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer text-xs"
                >
                  {tr('Cancellation & Refund Policy', 'रद्दीकरण एवं रिफंड नीति')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('disclaimer')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer text-xs"
                >
                  {tr('Legal Disclaimer', 'कानूनी अस्वीकरण (डिस्क्लेमर)')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('privacy-policy')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer text-xs"
                >
                  {tr('Privacy Policy (DPDPA 2023)', 'गोपनीयता नीति (DPDPA)')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNav('terms-of-service')}
                  className="hover:text-[#F1E194] transition-colors cursor-pointer text-xs"
                >
                  {tr('Terms of Service', 'सेवा की शर्तें')}
                </button>
              </li>
            </ul>
          </div>

          {/* Indian Network & Care Desk */}
          <div className="md:col-span-2 space-y-3">
            <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
              {tr('Client Concierge', 'ग्राहक सहायता')}
            </h3>
            <p className="text-xs text-[#8A8178] leading-relaxed">
              {tr('Mumbai · Bengaluru · Delhi · Punjab', 'मुंबई · बेंगलुरु · दिल्ली · पंजाब')}
              <br />
              <span className="text-[#FFF9E8]/80 font-mono-num mt-1 block">
                09:30 – 21:30 IST
              </span>
              <a
                href="mailto:support@barberloo.in"
                className="text-[#F1E194] hover:underline block mt-1"
              >
                support@barberloo.in
              </a>
              <a
                href="tel:+919876543210"
                className="text-[#FFF9E8]/80 hover:text-[#F1E194] block mt-0.5"
              >
                +91 98765 43210
              </a>
            </p>
          </div>
        </div>

        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#8A8178]">
          <p>
            © {new Date().getFullYear()} BarberLoo India.{' '}
            {tr('All rights reserved.', 'सर्वाधिकार सुरक्षित।')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => handleNav('about-us')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('About Us', 'हमारे बारे में')}
            </button>
            <button
              type="button"
              onClick={() => handleNav('contact-us')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('Contact Us', 'संपर्क करें')}
            </button>
            <button
              type="button"
              onClick={() => handleNav('refund-policy')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('Refund Policy', 'रिफंड नीति')}
            </button>
            <button
              type="button"
              onClick={() => handleNav('disclaimer')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('Disclaimer', 'डिस्क्लेमर')}
            </button>
            <button
              type="button"
              onClick={() => handleNav('privacy-policy')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('Privacy Policy', 'गोपनीयता नीति')}
            </button>
            <button
              type="button"
              onClick={() => handleNav('terms-of-service')}
              className="hover:text-[#F1E194] transition-colors cursor-pointer"
            >
              {tr('Terms of Service', 'सेवा की शर्तें')}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
