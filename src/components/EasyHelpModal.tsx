import React from 'react';
import { useLanguage } from '../lib/i18n';
import {
  X,
  Sparkles,
  Calendar,
  CreditCard,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  HelpCircle,
  Scissors,
} from 'lucide-react';
import { PageView } from '../data/barberlooData';

interface EasyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageView) => void;
}

export const EasyHelpModal: React.FC<EasyHelpModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { tr } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#111113]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[28px] neu-dark-flat p-6 sm:p-8 space-y-6 text-[#FFF9E8]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F1E194]">
                {tr('BARBERLOO EASY GUIDE', 'बारबरलू आसान गाइड')}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FFF9E8]">
                {tr('How BarberLoo Works in 3 Easy Steps', '3 आसान चरणों में बारबरलू कैसे काम करता है')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-[12px] neu-dark-icon-btn text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Steps Visual Flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="p-5 rounded-[20px] bg-[#241719] border border-[#F1E194]/20 space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#5B0E14] text-[#F1E194] text-xs font-bold flex items-center justify-center">
              1
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#F1E194]">
              <Scissors className="w-3.5 h-3.5" />
              <span>{tr('Choose Salon & Cut', 'सैलून और सेवा चुनें')}</span>
            </div>
            <p className="text-xs text-[#8A8178] leading-relaxed">
              {tr(
                'Browse verified partner salons in your city, select your haircut, beard trim, or ritual, and choose your favorite stylist.',
                'अपने शहर में सत्यापित सैलून खोजें, अपनी पसंद की सेवा और स्टाइलिस्ट चुनें।'
              )}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-5 rounded-[20px] bg-[#241719] border border-[#F1E194]/20 space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#5B0E14] text-[#F1E194] text-xs font-bold flex items-center justify-center">
              2
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#F1E194]">
              <Clock className="w-3.5 h-3.5" />
              <span>{tr('Pick Time & Pay Safely', 'समय चुनें और भुगतान करें')}</span>
            </div>
            <p className="text-xs text-[#8A8178] leading-relaxed">
              {tr(
                'Select your IST time slot. Pay upfront via Razorpay (UPI/Card). Your money is safely held in escrow until your haircut is complete.',
                'अपना समय चुनें। रेज़रपे (UPI/कार्ड) से भुगतान करें। सेवा पूरी होने तक आपकी राशि एस्क्रो में सुरक्षित रहती है।'
              )}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-5 rounded-[20px] bg-[#241719] border border-[#F1E194]/20 space-y-3">
            <div className="w-8 h-8 rounded-full bg-[#5B0E14] text-[#F1E194] text-xs font-bold flex items-center justify-center">
              3
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#F1E194]">
              <KeyRound className="w-3.5 h-3.5" />
              <span>{tr('Show 6-Digit OTP', '6-अंकीय OTP दिखाएं')}</span>
            </div>
            <p className="text-xs text-[#8A8178] leading-relaxed">
              {tr(
                'Sit back and enjoy your cut. After the service is finished, share your private 6-digit OTP so the barber receives payment.',
                'हेयरकट का आनंद लें। काम पूरा होने पर अपना 6-अंकीय ओटीपी बार्बर को दें जिससे उन्हें भुगतान मिल सके।'
              )}
            </p>
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#F1E194] flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            <span>{tr('Frequently Asked Questions', 'अक्सर पूछे जाने वाले प्रश्न')}</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <details className="group rounded-[16px] bg-[#1C1718] border border-[#F1E194]/15 p-4 cursor-pointer">
              <summary className="font-semibold text-[#FFF9E8] flex items-center justify-between">
                <span>{tr('Where do I find my 6-digit Completion OTP?', 'मुझे अपना 6-अंकीय OTP कहाँ मिलेगा?')}</span>
                <span className="text-[#F1E194] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-2.5 text-[#8A8178] leading-relaxed border-t border-[#F1E194]/10 pt-2">
                {tr(
                  'Your OTP is displayed immediately after booking on the confirmation screen, and can always be found under "My Bookings" in the top navigation. Keep it confidential until your haircut is finished!',
                  'बुकिंग पुष्ट होने के तुरंत बाद और "मेरी बुकिंग" मेनू में आपका ओटीपी सुरक्षित रूप से प्रदर्शित होता है। सेवा पूर्ण होने तक इसे किसी के साथ साझा न करें!'
                )}
              </p>
            </details>

            <details className="group rounded-[16px] bg-[#1C1718] border border-[#F1E194]/15 p-4 cursor-pointer">
              <summary className="font-semibold text-[#FFF9E8] flex items-center justify-between">
                <span>{tr('What if I need to cancel or reschedule?', 'यदि मुझे रद्दीकरण या समय बदलना हो तो क्या होगा?')}</span>
                <span className="text-[#F1E194] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-2.5 text-[#8A8178] leading-relaxed border-t border-[#F1E194]/10 pt-2">
                {tr(
                  'You can reschedule or cancel with 1 click from "My Bookings" before your appointment time. Refunds are processed automatically through Razorpay back to your original payment method.',
                  'आप "मेरी बुकिंग" से 1 क्लिक में समय बदल सकते हैं या रद्द कर सकते हैं। धनवापसी रेज़रपे द्वारा आपके मूल बैंक/UPI खाते में वापस भेजी जाती है।'
                )}
              </p>
            </details>

            <details className="group rounded-[16px] bg-[#1C1718] border border-[#F1E194]/15 p-4 cursor-pointer">
              <summary className="font-semibold text-[#FFF9E8] flex items-center justify-between">
                <span>{tr('Can I book without choosing a specific barber?', 'क्या मैं किसी विशिष्ट बार्बर को चुने बिना बुक कर सकता हूँ?')}</span>
                <span className="text-[#F1E194] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="mt-2.5 text-[#8A8178] leading-relaxed border-t border-[#F1E194]/10 pt-2">
                {tr(
                  'Yes! In the booking schedule, simply choose "Any Available Master Barber" to get the earliest available chair without delay.',
                  'हाँ! बुकिंग स्क्रीन पर बस "उपलब्ध मास्टर बार्बर" चुनें ताकि आपको बिना प्रतीक्षा के पहला उपलब्ध स्लॉट मिल सके।'
                )}
              </p>
            </details>
          </div>
        </div>

        {/* Quick Action Footer */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#F1E194]/15">
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('booking');
            }}
            className="flex-1 py-3.5 px-6 rounded-[16px] neu-btn-burgundy text-xs font-semibold tracking-wider uppercase cursor-pointer flex items-center justify-center gap-2"
          >
            <Scissors className="w-4 h-4 text-[#F1E194]" />
            <span>{tr('BOOK AN APPOINTMENT NOW', 'अभी अपॉइंटमेंट बुक करें')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate('customer-dashboard');
            }}
            className="py-3.5 px-6 rounded-[16px] bg-[#241719] hover:bg-[#2e1d20] text-[#F1E194] text-xs font-semibold tracking-wider uppercase border border-[#F1E194]/20 cursor-pointer"
          >
            {tr('VIEW MY BOOKINGS & OTP', 'मेरी बुकिंग और OTP देखें')}
          </button>
        </div>
      </div>
    </div>
  );
};
