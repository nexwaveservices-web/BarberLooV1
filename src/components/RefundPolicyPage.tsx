import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import {
  RotateCcw,
  Clock,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  Mail,
  Phone,
} from 'lucide-react';

interface RefundPolicyPageProps {
  onNavigate: (page: PageView) => void;
}

export const RefundPolicyPage: React.FC<RefundPolicyPageProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();
  const [activeSection, setActiveSection] = useState('cancellation');

  const sections = [
    { id: 'cancellation', title: tr('1. Appointment Cancellation Rules', '1. अपॉइंटमेंट रद्दीकरण नियम') },
    { id: 'rescheduling', title: tr('2. Rescheduling Flexibility', '2. अपॉइंटमेंट समय बदलाव (रीशेड्यूल)') },
    { id: 'sla-noshow', title: tr('3. Barber No-Show & 15-Min SLA', '3. बार्बर नो-शो और 15-मिनट SLA गारंटी') },
    { id: 'otp-escrow', title: tr('4. Customer OTP & Escrow Protection', '4. ग्राहक OTP और एस्क्रो सुरक्षा') },
    { id: 'product-returns', title: tr('5. Grooming Product Returns', '5. ग्रूमिंग प्रोडक्ट वापसी नियम') },
    { id: 'refund-modes', title: tr('6. Refund Processing & Timelines', '6. रिफंड प्रक्रिया और समयसीमा') },
    { id: 'disputes', title: tr('7. Dispute Resolution & Grievance', '7. विवाद समाधान एवं सहायता') },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="bg-[#EFE9DD] min-h-screen text-[#111113] pb-24">
      {/* Top Breadcrumb & Hero */}
      <section className="bg-[#1C1718] text-[#FFF9E8] pt-12 pb-14 px-5 sm:px-8 border-b border-[#F1E194]/20 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-[#5B0E14]/30 blur-3xl pointer-events-none" />
        <div className="max-w-[1240px] mx-auto relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#F1E194]">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {tr('Home', 'होम')}
            </button>
            <span>/</span>
            <span>{tr('Legal & Policies', 'कानूनी एवं नीतियां')}</span>
            <span>/</span>
            <span className="text-[#FFF9E8]">{tr('Cancellation & Refund Policy', 'रद्दीकरण एवं रिफंड नीति')}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
                <RotateCcw className="w-3.5 h-3.5" />
                {tr('100% Escrow Protection', '100% एस्क्रो सुरक्षा गारंटी')}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#FFF9E8]">
                {tr('Cancellation, Refund & Return Policy', 'रद्दीकरण, रिफंड एवं रिटर्न नीति')}
              </h1>
              <p className="text-sm text-[#8A8178] leading-relaxed">
                {tr(
                  'Transparent, fair, and consumer-first refund guidelines for grooming appointments and retail purchases across all verified BarberLoo salons in India.',
                  'भारत भर में बारबरलू के सत्यापित सैलून में ग्रूमिंग अपॉइंटमेंट्स और खरीदारी के लिए स्पष्ट, निष्पक्ष और ग्राहक-हितैषी रिफंड दिशानिर्देश।'
                )}
              </p>
            </div>

            <div className="text-right text-xs text-[#8A8178] space-y-1">
              <p>{tr('Effective Date: October 25, 2026', 'प्रभावी तिथि: 25 अक्टूबर 2026')}</p>
              <p>{tr('Jurisdiction: Republic of India', 'अधिकार क्षेत्र: भारत गणराज्य')}</p>
              <p>{tr('Payment Partner: Razorpay India', 'पेमेंट पार्टनर: रेज़रपे इंडिया')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[20px] p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#5B0E14] pb-2 border-b border-[#5B0E14]/10">
                {tr('Table of Contents', 'विषय सूची')}
              </h3>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-[12px] text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                      activeSection === sec.id
                        ? 'bg-[#5B0E14] text-[#FFF9E8]'
                        : 'text-[#5A534D] hover:bg-[#5B0E14]/8 hover:text-[#111113]'
                    }`}
                  >
                    <span className="truncate">{sec.title}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Summary Card */}
            <div className="bg-[#111113] text-[#FFF9E8] rounded-[20px] p-5 border border-[#F1E194]/20 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#F1E194]">
                {tr('At a Glance', 'मुख्य बिंदु')}
              </h4>
              <ul className="text-xs text-[#8A8178] space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F1E194] shrink-0 mt-0.5" />
                  <span>{tr('Free cancellation up to 2 hours before scheduled slot.', 'समय से 2 घंटे पहले तक मुफ्त रद्दीकरण।')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F1E194] shrink-0 mt-0.5" />
                  <span>{tr('Free rescheduling up to 1 hour before scheduled slot.', 'समय से 1 घंटे पहले तक असीमित रीशेड्यूल।')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F1E194] shrink-0 mt-0.5" />
                  <span>{tr('Full refund if barber delays chair start past 15 mins.', 'बार्बर 15 मिनट से अधिक देरी करे तो 100% रिफंड।')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#F1E194] shrink-0 mt-0.5" />
                  <span>{tr('UPI/Card refunds processed within 3–7 business days.', 'रिफंड 3–7 कार्य दिवसों में मूल खाते में।')}</span>
                </li>
              </ul>
            </div>
          </aside>

          {/* Document Content */}
          <main className="lg:col-span-8 space-y-8 bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 sm:p-10 shadow-sm leading-relaxed text-sm text-[#3E3835]">
            {/* Section 1 */}
            <section id="cancellation" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Clock className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('1. Appointment Cancellation Policy', '1. अपॉइंटमेंट रद्दीकरण नीति')}
                </h2>
              </div>
              <p>
                {tr(
                  'At BarberLoo, we respect our clients’ time and our partner barbers’ craft and booked schedules. You can cancel your booked appointment directly through your Customer Dashboard under the following terms:',
                  'बारबरलू में हम आपके समय और हमारे पार्टनर बार्बर्स के समय का सम्मान करते हैं। आप अपनी अपॉइंटमेंट कस्टमर डैशबोर्ड से निम्न शर्तों पर रद्द कर सकते हैं:'
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div className="bg-[#FAF2E2] border border-[#5B0E14]/15 rounded-[16px] p-4 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B0E14] block">
                    {tr('Cancellation > 2 Hours in Advance', '2 घंटे से अधिक पहले रद्दीकरण')}
                  </span>
                  <p className="text-xs text-[#111113] font-semibold">
                    {tr('100% Full Refund of Service Amount', 'सेवा शुल्क का 100% पूरा रिफंड')}
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    {tr('No cancellation penalty. Full service fee refunded automatically to original payment method.', 'कोई जुर्माना नहीं। पूरा सेवा शुल्क आपके बैंक खाते में स्वतः वापस आ जाएगा।')}
                  </p>
                </div>

                <div className="bg-[#FAF2E2] border border-[#5B0E14]/15 rounded-[16px] p-4 space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B0E14] block">
                    {tr('Cancellation < 2 Hours in Advance', '2 घंटे से कम समय में रद्दीकरण')}
                  </span>
                  <p className="text-xs text-[#111113] font-semibold">
                    {tr('Late Cancellation Fee Applies', 'विलंब रद्दीकरण शुल्क लागू')}
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    {tr('A nominal chair reservation fee (₹50 or 25% of service amount) is retained for the reserved barber slot; remainder refunded.', 'बार्बर के समय क्षतिपूर्ति के लिए ₹50 या 25% आरक्षित रखा जाएगा; शेष राशि वापस की जाएगी।')}
                  </p>
                </div>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 2 */}
            <section id="rescheduling" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('2. Free Appointment Rescheduling', '2. अपॉइंटमेंट समय बदलाव (रीशेड्यूल)')}
                </h2>
              </div>
              <p>
                {tr(
                  'Need to change your appointment date or time? BarberLoo provides seamless one-click rescheduling with zero penalty up to 1 hour before your scheduled appointment time.',
                  'क्या आपको अपनी अपॉइंटमेंट की तारीख या समय बदलना है? बारबरलू आपको समय से 1 घंटे पहले तक बिना किसी अतिरिक्त शुल्क के आसानी से रीशेड्यूल करने की सुविधा देता है।'
                )}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#3E3835]">
                <li>{tr('Reschedule to any available date and time slot within the next 14 days.', 'अगले 14 दिनों में किसी भी उपलब्ध तारीख और समय पर बदलें।')}</li>
                <li>{tr('Your pre-paid funds and coupon discounts remain safely transferred to the new appointment date.', 'आपकी पूर्व-भुगतान राशि और कूपन छूट नई तारीख पर सुरक्षित स्थानांतरित रहेगी।')}</li>
                <li>{tr('Your unique 6-digit Customer Completion OTP remains securely linked to the rescheduled booking.', 'आपका 6-अंकीय कंप्लीशन OTP नए समय पर सुरक्षित रूप से मान्य रहेगा।')}</li>
              </ul>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 3 */}
            <section id="sla-noshow" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('3. Barber No-Show & 15-Minute Chair SLA Guarantee', '3. बार्बर नो-शो एवं 15-मिनट चेयर SLA गारंटी')}
                </h2>
              </div>
              <p>
                {tr(
                  'We take on-time salon appointments seriously. BarberLoo guarantees that your service begins within 15 minutes of your confirmed IST reservation time.',
                  'हम समय की पाबंदी को गंभीरता से लेते हैं। बारबरलू गारंटी देता है कि आपकी सेवा आपके निर्धारित समय से 15 मिनट के भीतर शुरू होगी।'
                )}
              </p>
              <div className="p-4 rounded-[16px] bg-[#5B0E14]/6 border border-[#5B0E14]/20 space-y-2">
                <p className="text-xs font-bold text-[#5B0E14] uppercase tracking-wider">
                  {tr('Our SLA Commitment to Discerning Clients:', 'ग्राहकों के प्रति हमारी SLA प्रतिबद्धता:')}
                </p>
                <p className="text-xs text-[#3E3835]">
                  {tr(
                    'If your assigned barber fails to seat you within 15 minutes of your booked time, or in the rare event of a salon emergency/no-show, you are eligible for an immediate 100% full refund PLUS a complimentary ₹100 BarberLoo Platform Credit for your next salon reservation.',
                    'यदि आपका बार्बर समय के 15 मिनट बाद भी सेवा शुरू नहीं करता है, तो आप तुरंत 100% पूरा रिफंड और अगली बुकिंग के लिए ₹100 का अतिरिक्त बारबरलू क्रेडिट पाने के हकदार हैं।'
                  )}
                </p>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 4 */}
            <section id="otp-escrow" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <FileCheck className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('4. Customer Completion OTP & Escrow Protection', '4. ग्राहक कंप्लीशन OTP एवं एस्क्रो सुरक्षा')}
                </h2>
              </div>
              <p>
                {tr(
                  'Every pre-paid appointment is protected by BarberLoo’s proprietary Dual-Custody Escrow Protocol. When you pay online, funds are held in a secure neutral escrow vault.',
                  'प्रत्येक ऑनलाइन बुकिंग बारबरलू के सुरक्षित एस्क्रो प्रोटोकॉल से सुरक्षित होती है। आपके द्वारा भुगतान की गई राशि सीधे बार्बर को तब तक नहीं मिलती जब तक सेवा पूरी न हो।'
                )}
              </p>
              <div className="bg-[#FAF2E2] p-4 rounded-[16px] border border-[#5B0E14]/15 space-y-2 text-xs">
                <p className="font-bold text-[#111113]">
                  {tr('Important Rule regarding the 6-Digit Completion OTP:', '6-अंकीय कंप्लीशन OTP से संबंधित महत्वपूर्ण नियम:')}
                </p>
                <p>
                  {tr(
                    'Only share your 6-digit Customer Completion OTP with your barber AFTER your grooming service has been completed to your satisfaction. Once your OTP is entered and cryptographically verified on the barber console, the service is marked officially completed and barber earnings are released. Once OTP is verified, cancellations or refunds for that appointment can no longer be processed.',
                    'अपना 6-अंकीय OTP बार्बर के साथ केवल तभी साझा करें जब आपकी सेवा आपकी संतुष्टि के अनुसार पूरी हो जाए। एक बार OTP सत्यापित होने के बाद, राशि बार्बर को जारी हो जाती है और उस अपॉइंटमेंट का रिफंड नहीं किया जा सकता।'
                  )}
                </p>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 5 */}
            <section id="product-returns" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <RotateCcw className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('5. Return Policy on Retail Grooming Products', '5. ग्रूमिंग प्रोडक्ट वापसी नियम')}
                </h2>
              </div>
              <p>
                {tr(
                  'For retail grooming items (beard oils, hair pomades, shaving balms, brushes) purchased directly through partner salons or our online portal:',
                  'सैलून या पोर्टल से खरीदे गए ग्रूमिंग उत्पादों (दाढ़ी का तेल, पोमेड, शेविंग बाम) के लिए:'
                )}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#3E3835]">
                <li>{tr('Unopened, unused products in original intact tamper-evident packaging may be returned within 7 days of purchase.', 'सील और अनपेक्ड उत्पाद खरीद के 7 दिनों के भीतर बदले या लौटाए जा सकते हैं।')}</li>
                <li>{tr('Due to hygiene and personal care safety regulations, opened, unsealed, or partially consumed cosmetics and balms cannot be returned.', 'व्यक्तिगत स्वच्छता और सुरक्षा नियमों के कारण खुले या उपयोग किए गए कॉस्मेटिक्स वापस नहीं लिए जा सकते।')}</li>
                <li>{tr('Defective, leaking, or expired items at the time of delivery/purchase are replaced or refunded at 100% cost with no questions asked.', 'यदि उत्पाद खराब या लीक हुआ है, तो उसे बिना किसी शुल्क के बदला जाएगा या पूरा रिफंड मिलेगा।')}</li>
              </ul>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 6 */}
            <section id="refund-modes" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <CreditCard className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('6. Refund Processing & Banking Timelines', '6. रिफंड प्रक्रिया और समयसीमा')}
                </h2>
              </div>
              <p>
                {tr(
                  'All refunds are processed securely via our Reserve Bank of India (RBI) authorized payment gateway partner, Razorpay India.',
                  'सभी रिफंड भारतीय रिज़र्व बैंक (RBI) द्वारा अधिकृत पेमेंट पार्टनर रेज़रपे इंडिया के माध्यम से सुरक्षित रूप से प्रोसेस किए जाते हैं।'
                )}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border border-[#5B0E14]/15 rounded-[14px] overflow-hidden">
                  <thead className="bg-[#5B0E14] text-[#FFF9E8]">
                    <tr>
                      <th className="p-3">{tr('Payment Source', 'भुगतान का तरीका')}</th>
                      <th className="p-3">{tr('Refund Timeline', 'रिफंड समय')}</th>
                      <th className="p-3">{tr('Tracking Method', 'ट्रैकिंग विधि')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#5B0E14]/10 bg-[#FAF2E2]">
                    <tr>
                      <td className="p-3 font-semibold">{tr('UPI (GPay / PhonePe / Paytm / BHIM)', 'UPI')}</td>
                      <td className="p-3">2 – 48 Hours</td>
                      <td className="p-3">{tr('Instant Bank UTR Reference', 'बैंक UTR नंबर')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">{tr('Debit / Credit Cards (Visa / Mastercard / RuPay)', 'कार्ड')}</td>
                      <td className="p-3">3 – 5 Business Days</td>
                      <td className="p-3">{tr('Card Issuer ARN Reference', 'बैंक ARN नंबर')}</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">{tr('Net Banking (SBI / HDFC / ICICI / Axis)', 'नेट बैंकिंग')}</td>
                      <td className="p-3">3 – 7 Business Days</td>
                      <td className="p-3">{tr('Core Banking Transaction Ref', 'बैंक लेनदेन संदर्भ')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 7 */}
            <section id="disputes" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <HelpCircle className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('7. Dispute Resolution & Customer Grievance', '7. विवाद समाधान एवं शिकायत निवारण')}
                </h2>
              </div>
              <p>
                {tr(
                  'Have an issue with an appointment, billing discrepancy, or service quality? Our dedicated customer success team is available 7 days a week to review your case with fairness.',
                  'क्या आपको किसी अपॉइंटमेंट, बिलिंग या सेवा गुणवत्ता में समस्या है? हमारी समर्पित कस्टमर सपोर्ट टीम सप्ताह के सातों दिन आपकी सहायता के लिए उपलब्ध है।'
                )}
              </p>
              <div className="bg-[#FAF2E2] p-5 rounded-[18px] border border-[#5B0E14]/15 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-xs uppercase tracking-wider text-[#5B0E14]">
                      {tr('BarberLoo Refund & Support Desk', 'बारबरलू रिफंड एवं सपोर्ट हेल्पडेस्क')}
                    </p>
                    <p className="text-xs text-[#8A8178] mt-0.5">
                      {tr('Mon – Sun: 09:30 – 21:30 IST • Response within 4 business hours', 'सोम – रवि: 09:30 – 21:30 IST • 4 घंटे के भीतर उत्तर')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="mailto:refunds@barberloo.in"
                      className="px-3.5 py-2 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>refunds@barberloo.in</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onNavigate('contact-us')}
                      className="px-3.5 py-2 rounded-[12px] bg-[#111113] text-[#F1E194] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{tr('Contact Support', 'सहायता केंद्र')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};
