import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import {
  FileText,
  ShieldCheck,
  Scale,
  ArrowLeft,
  ChevronRight,
  Clock,
  CreditCard,
  KeyRound,
  AlertTriangle,
  Scissors,
  CheckCircle2,
  Mail,
  ExternalLink,
} from 'lucide-react';

interface TermsOfServicePageProps {
  onNavigate: (page: PageView) => void;
}

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();
  const [activeSection, setActiveSection] = useState('acceptance');

  const sections = [
    { id: 'acceptance', title: tr('1. Acceptance & Eligibility', '1. स्वीकृति और पात्रता') },
    { id: 'marketplace', title: tr('2. Marketplace & Platform Role', '2. मार्केटप्लेस और प्लेटफ़ॉर्म भूमिका') },
    { id: 'accounts', title: tr('3. User & Barber Accounts', '3. उपयोगकर्ता और बार्बर खाते') },
    { id: 'booking-ist', title: tr('4. IST Scheduling & Punctuality', '4. IST शेड्यूलिंग और समय की पाबंदी') },
    { id: 'fees-payment', title: tr('5. Pricing & Upfront Escrow', '5. मूल्य निर्धारण और अग्रिम एस्क्रो') },
    { id: 'otp-protocol', title: tr('6. Completion OTP Protocol', '6. कंप्लीशन OTP प्रोटोकॉल') },
    { id: 'cancellation', title: tr('7. Cancellation & Refunds', '7. रद्दीकरण और धनवापसी नीति') },
    { id: 'partner-conduct', title: tr('8. Salon Partner Code', '8. सैलून पार्टनर आचार संहिता') },
    { id: 'client-conduct', title: tr('9. Client Salon Etiquette', '9. ग्राहक सैलून शिष्टाचार') },
    { id: 'holds-disputes', title: tr('10. Administrative Holds & Disputes', '10. प्रशासनिक रोक और विवाद निवारण') },
    { id: 'liability', title: tr('11. Limitation of Liability', '11. दायित्व की सीमा') },
    { id: 'governing-law', title: tr('12. Governing Law & Jurisdiction', '12. लागू कानून और क्षेत्राधिकार') },
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
            <span>{tr('Legal & Compliance', 'कानूनी एवं अनुपालन')}</span>
            <span>/</span>
            <span className="text-[#FFF9E8]">{tr('Terms of Service', 'सेवा की शर्तें')}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
                <Scale className="w-3.5 h-3.5" />
                {tr('Legally Binding Agreement', 'कानूनी रूप से बाध्यकारी अनुबंध')}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#FFF9E8]">
                {tr('BarberLoo Terms of Service', 'बारबरलू सेवा की शर्तें')}
              </h1>
              <p className="text-sm text-[#8A8178] leading-relaxed">
                {tr(
                  'Governing your access to BarberLoo India, verified appointment reservations, upfront Razorpay escrow payments, and salon partner marketplace conduct.',
                  'बारबरलू इंडिया तक आपकी पहुंच, सत्यापित सैलून आरक्षण, अग्रिम रेज़रपे एस्क्रो भुगतान और सैलून पार्टनर मार्केटप्लेस आचरण को नियंत्रित करने वाली शर्तें।'
                )}
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#241719] border border-[#F1E194]/20 text-xs space-y-1.5 shrink-0 self-start md:self-auto">
              <p className="text-[#8A8178] uppercase tracking-wider text-[10px] font-semibold">
                {tr('Authoritative Domain', 'आधिकारिक डोमेन')}
              </p>
              <p className="text-[#F1E194] font-mono font-bold">https://barberloo.in</p>
              <p className="text-[#8A8178] text-[10px] pt-1">
                {tr('Effective: October 2026 (Republic of India)', 'प्रभावी: अक्टूबर 2026 (भारत गणराज्य)')}
              </p>
            </div>
          </div>

          {/* Quick tab switch between Legal docs */}
          <div className="pt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('privacy-policy')}
              className="px-4 py-2 rounded-[12px] bg-[#241719] hover:bg-[#2e1d20] text-[#FFF9E8] text-xs font-semibold uppercase tracking-wider border border-[#F1E194]/15 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#F1E194]" />
              {tr('Privacy Policy', 'गोपनीयता नीति')}
            </button>
            <span className="px-4 py-2 rounded-[12px] bg-[#5B0E14] text-[#F1E194] text-xs font-bold uppercase tracking-wider border border-[#F1E194]/30 shadow-sm flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {tr('Terms of Service', 'सेवा की शर्तें')}
            </span>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Sticky Navigation Sidebar */}
          <aside className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[#241719]/10 pb-3">
                <Scale className="w-4 h-4 text-[#5B0E14]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#1C1718]">
                  {tr('Table of Contents', 'विषय-सूची')}
                </h3>
              </div>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full text-left px-3 py-2 rounded-[12px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                      activeSection === sec.id
                        ? 'bg-[#5B0E14] text-[#FFF9E8] font-bold shadow-sm'
                        : 'text-[#5B524A] hover:bg-[#E8E1D2]/60 hover:text-[#111113]'
                    }`}
                  >
                    <span className="truncate pr-2">{sec.title}</span>
                    <ChevronRight
                      className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                        activeSection === sec.id ? 'text-[#F1E194] translate-x-0.5' : 'opacity-40'
                      }`}
                    />
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Summary Card */}
            <div className="rounded-[24px] bg-[#1C1718] text-[#FFF9E8] border border-[#F1E194]/20 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F1E194]">
                <KeyRound className="w-4 h-4" />
                <span>{tr('Core Guarantee', 'मुख्य गारंटी')}</span>
              </div>
              <p className="text-xs text-[#8A8178] leading-relaxed">
                {tr(
                  'Your booking payment is held safely in escrow until you present your 6-digit OTP in the salon. Salons cannot claim funds without physical service verification.',
                  'आपका बुकिंग भुगतान एस्क्रो में सुरक्षित रहता है जब तक आप सैलून में अपना 6-अंकीय ओटीपी प्रस्तुत नहीं करते। बिना सेवा पूर्णता के सैलून राशि प्राप्त नहीं कर सकते।'
                )}
              </p>
            </div>
          </aside>

          {/* Terms Articles */}
          <article className="lg:col-span-8 space-y-8">
            {/* 1. Acceptance */}
            <section
              id="acceptance"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('1. Acceptance of Terms & Legal Eligibility', '1. शर्तों की स्वीकृति और पात्रता')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'By accessing or using the BarberLoo platform located at https://barberloo.in, registering an account, or reserving a grooming appointment, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree to these terms, you must immediately discontinue using our services.',
                  'https://barberloo.in पर स्थित बारबरलू प्लेटफ़ॉर्म का उपयोग करके, खाता पंजीकृत करके, या अपॉइंटमेंट आरक्षित करके, आप इन सेवा की शर्तों और हमारी गोपनीयता नीति से बाध्य होने के लिए सहमत होते हैं।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'You affirm that you are at least 18 years of age, or an emancipated minor possessing legal parental or guardian consent under the Indian Contract Act, 1872, fully capable and competent to enter into these terms.',
                  'आप पुष्टि करते हैं कि आपकी आयु कम से कम 18 वर्ष है, या आप भारतीय अनुबंध अधिनियम, 1872 के तहत वैध अनुबंध करने में सक्षम हैं।'
                )}
              </p>
            </section>

            {/* 2. Marketplace Role */}
            <section
              id="marketplace"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scissors className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('2. The BarberLoo Marketplace Model', '2. मार्केटप्लेस और प्लेटफ़ॉर्म भूमिका')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'BarberLoo operates as an intermediary technology platform connecting independent partner barbers and salon owners with prospective clients. BarberLoo is not an employer of barbers, does not operate its own retail salons, and is not a provider of direct cosmetic or haircutting services.',
                  'बारबरलू एक मध्यस्थ तकनीकी प्लेटफ़ॉर्म के रूप में कार्य करता है जो स्वतंत्र पार्टनर बार्बर और सैलून मालिकों को ग्राहकों से जोड़ता है। बारबरलू बार्बरों का नियोक्ता नहीं है और स्वयं बाल काटने की सेवाएं प्रदान नहीं करता।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Independent salon partners are solely responsible for their physical facilities, sanitation standards, licenses, staff certifications, and technical hair styling execution.',
                  'स्वतंत्र सैलून पार्टनर अपनी सुविधाओं, स्वच्छता मानकों, लाइसेंस और बाल संवारने की तकनीकी गुणवत्ता के लिए स्वयं उत्तरदायी हैं।'
                )}
              </p>
            </section>

            {/* 3. Accounts */}
            <section
              id="accounts"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('3. User Accounts & Role Separation', '3. उपयोगकर्ता और बार्बर खाते')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'To access reservation features or salon management consoles, you must register a verified account using Supabase Auth. We enforce strict role-based separation:',
                  'आरक्षण सुविधाओं या सैलून प्रबंधन कंसोल का उपयोग करने के लिए, आपको सुपाबेस ऑथ के माध्यम से खाता बनाना होगा। हम सख्त भूमिका-आधारित पृथक्करण लागू करते हैं:'
                )}
              </p>
              <ul className="space-y-2 text-sm text-[#4A423B] list-disc list-inside">
                <li>
                  <strong>{tr('Customer Accounts:', 'ग्राहक खाते:')}</strong>{' '}
                  {tr('Authorized to discover salons, book appointments, and leave verified reviews.', 'सैलून खोजने, अपॉइंटमेंट बुक करने और समीक्षा देने के लिए अधिकृत।')}
                </li>
                <li>
                  <strong>{tr('Barber / Salon Partner Accounts:', 'बार्बर / पार्टनर खाते:')}</strong>{' '}
                  {tr(
                    'Authorized to manage chair schedules, update salon service menus, and verify completion OTPs. Barber accounts are strictly forbidden from creating customer appointments.',
                    'शेड्यूल प्रबंधित करने, सेवा सूची अपडेट करने और ओटीपी सत्यापित करने के लिए अधिकृत। बार्बर खातों द्वारा ग्राहक बुकिंग बनाना सख्त वर्जित है।'
                  )}
                </li>
              </ul>
            </section>

            {/* 4. Scheduling & IST */}
            <section
              id="booking-ist"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Clock className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('4. Indian Standard Time (IST) Scheduling & Punctuality', '4. IST शेड्यूलिंग और समय की पाबंदी')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'All appointments, chair availability slots, working hours, and notifications on BarberLoo operate strictly in Indian Standard Time (IST — UTC+05:30). Standard salon operating hours across partner networks run from 09:30 to 21:30 IST.',
                  'बारबरलू पर सभी अपॉइंटमेंट्स, समय स्लॉट और सूचनाएं भारतीय मानक समय (IST — UTC+05:30) पर संचालित होती हैं। सामान्य सैलून समय सुबह 09:30 से रात 09:30 IST तक है।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Clients are requested to arrive at least 5 minutes prior to their scheduled slot. Salons reserve the right to mark an appointment as a No-Show if a client is more than 15 minutes late without prior notification.',
                  'ग्राहकों से अनुरोध है कि वे अपने समय से कम से कम 5 मिनट पहले पहुंचें। बिना सूचना के 15 मिनट से अधिक देर होने पर सैलून इसे नो-शो चिह्नित कर सकते हैं।'
                )}
              </p>
            </section>

            {/* 5. Pricing & Escrow */}
            <section
              id="fees-payment"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <CreditCard className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('5. Pricing, Upfront Payment Collection & Platform Fee', '5. मूल्य निर्धारण और अग्रिम एस्क्रो')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'All service prices are listed in Indian Rupees (₹ INR). Clients pay the full service cost plus a nominal platform convenience fee upfront at the time of booking via Razorpay.',
                  'सभी कीमतें भारतीय रुपये (₹ INR) में दर्शाई गई हैं। ग्राहक बुकिंग के समय रेज़रपे के माध्यम से सेवा शुल्क और नाममात्र प्लेटफ़ॉर्म शुल्क का अग्रिम भुगतान करते हैं।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Upfront collection protects barbers against spurious no-shows while keeping client funds fully protected in a double-entry escrow ledger until the customer is physically seated and serviced.',
                  'अग्रिम संग्रह बार्बरों को झूठी बुकिंग से बचाता है, जबकि ग्राहक की राशि सेवा पूर्ण होने तक एस्क्रो लेज़र में सुरक्षित रहती है।'
                )}
              </p>
            </section>

            {/* 6. Completion OTP Protocol */}
            <section
              id="otp-protocol"
              className="rounded-[24px] bg-[#1C1718] text-[#FFF9E8] border border-[#F1E194]/25 p-7 sm:p-9 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-2.5 text-[#F1E194]">
                <KeyRound className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
                  {tr('6. Cryptographic Completion OTP Protocol & Payout Release', '6. कंप्लीशन OTP प्रोटोकॉल और भुगतान रिलीज')}
                </h2>
              </div>
              <p className="text-sm text-[#D3CBBF] leading-relaxed">
                {tr(
                  'Every confirmed booking generates a confidential, single-use 6-digit Completion OTP for the client. The rules governing this protocol are strictly enforced:',
                  'प्रत्येक पुष्ट बुकिंग ग्राहक के लिए एक गोपनीय, एकल-उपयोग 6-अंकीय कंप्लीशन ओटीपी उत्पन्न करती है:'
                )}
              </p>
              <div className="space-y-3 pt-2 text-xs text-[#D3CBBF]">
                <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15">
                  <strong className="text-[#F1E194] block mb-1">
                    {tr('Do Not Disclose In Advance:', 'समय से पहले साझा न करें:')}
                  </strong>
                  {tr(
                    'Clients must only share the 6-digit Completion OTP with the barber AFTER the haircut or grooming service is physically completed in the salon. Never share the OTP over phone, chat, or prior to service delivery.',
                    'ग्राहक सेवा पूर्ण होने के बाद ही सैलून में बार्बर के साथ ओटीपी साझा करें। फोन या चैट पर पहले से कभी साझा न करें।'
                  )}
                </div>
                <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15">
                  <strong className="text-[#F1E194] block mb-1">
                    {tr('Immediate Escrow Payout Release:', 'तत्काल एस्क्रो भुगतान रिलीज:')}
                  </strong>
                  {tr(
                    'Upon the barber submitting the correct OTP into their console, our backend immediately transitions the appointment to Completed, balances the double-entry financial ledger, and releases the net earnings to the barber’s registered account.',
                    'बार्बर द्वारा सही ओटीपी दर्ज करने पर, अपॉइंटमेंट पूर्ण हो जाता है और बार्बर के खाते में भुगतान जारी कर दिया जाता है।'
                  )}
                </div>
              </div>
            </section>

            {/* 7. Cancellation & Refunds */}
            <section
              id="cancellation"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('7. Rescheduling, Cancellations & Refund Policy', '7. रद्दीकरण और धनवापसी नीति')}
                </h2>
              </div>
              <div className="space-y-3 text-sm text-[#4A423B]">
                <p>
                  <strong>{tr('Client Cancellation:', 'ग्राहक रद्दीकरण:')}</strong>{' '}
                  {tr(
                    'Clients may cancel an upcoming appointment anytime prior to the scheduled start time directly from their Customer Dashboard. The service price will be refunded back to the original payment method via Razorpay within 5–7 business days.',
                    'ग्राहक अपने डैशबोर्ड से निर्धारित समय से पहले कभी भी अपॉइंटमेंट रद्द कर सकते हैं। 5-7 कार्य दिवसों में सेवा राशि मूल माध्यम पर वापस कर दी जाती है।'
                  )}
                </p>
                <p>
                  <strong>{tr('Salon Cancellation:', 'सैलून रद्दीकरण:')}</strong>{' '}
                  {tr(
                    'If a salon partner is unable to honor an appointment due to unforeseen emergencies, a 100% full refund (including platform fee) is immediately authorized to the client.',
                    'यदि सैलून अपरिहार्य कारणों से सेवा देने में असमर्थ होता है, तो ग्राहक को 100% पूर्ण धनवापसी दी जाती है।'
                  )}
                </p>
                <p>
                  <strong>{tr('Rescheduling:', 'समय परिवर्तन (री-शेड्यूल):')}</strong>{' '}
                  {tr(
                    'Appointments may be rescheduled to another available slot within salon operating hours without fee penalty, subject to stylist availability.',
                    'स्टाइलिस्ट की उपलब्धता के आधार पर बिना किसी जुर्माने के समय बदला जा सकता है।'
                  )}
                </p>
              </div>
            </section>

            {/* 8. Partner Code */}
            <section
              id="partner-conduct"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scissors className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('8. Salon Partner Code of Conduct', '8. सैलून पार्टनर आचार संहिता')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Verified partner salons agree to maintain impeccable hygiene, sanitize tools between clients, honor booked prices without off-platform cash surcharges, and respect scheduled IST start times.',
                  'पार्टनर सैलून स्वच्छता बनाए रखने, उपकरणों को सैनिटाइज़ करने, बिना अतिरिक्त शुल्क के निर्धारित दरों पर सेवा देने और समय का सम्मान करने के लिए सहमत होते हैं।'
                )}
              </p>
            </section>

            {/* 9. Client Conduct */}
            <section
              id="client-conduct"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <CheckCircle2 className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('9. Client Salon Etiquette', '9. ग्राहक सैलून शिष्टाचार')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Clients are expected to treat salon staff and craftsmen with mutual dignity. Abusive behavior, harassment, or refusal to follow salon safety guidelines may result in immediate appointment termination and account suspension.',
                  'ग्राहकों से सैलून कर्मचारियों के साथ सम्मानजनक व्यवहार की अपेक्षा की जाती है। किसी भी प्रकार का दुर्व्यवहार खाता निलंबन का कारण बन सकता है।'
                )}
              </p>
            </section>

            {/* 10. Administrative Holds & Disputes */}
            <section
              id="holds-disputes"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('10. Administrative Holds & Dispute Resolution', '10. प्रशासनिक रोक और विवाद निवारण')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'BarberLoo administrators hold the explicit authority to place an administrative hold on any appointment payout in the event of a customer grievance, quality dispute, or suspected fraudulent activity. Payouts remain strictly frozen until the dispute is investigated and resolved.',
                  'विवाद या शिकायत की स्थिति में बारबरलू प्रशासन के पास भुगतान को प्रशासनिक रोक (Hold) पर रखने का अधिकार है। जांच पूरी होने तक राशि सुरक्षित रूप से रोकी जाती है।'
                )}
              </p>
            </section>

            {/* 11. Limitation of Liability */}
            <section
              id="liability"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('11. Limitation of Liability', '11. दायित्व की सीमा')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'To the maximum extent permitted by applicable Indian law, BarberLoo shall not be liable for any indirect, incidental, punitive, or consequential damages resulting from salon craftsmanship, allergic reactions, personal property loss in salon premises, or third-party payment gateway downtime.',
                  'भारतीय कानून के तहत, बारबरलू सैलून कारीगरी, एलर्जी प्रतिक्रियाओं या तीसरे पक्ष के गेटवे डाउनटाइम से होने वाले अप्रत्यक्ष नुकसान के लिए उत्तरदायी नहीं होगा।'
                )}
              </p>
            </section>

            {/* 12. Governing Law */}
            <section
              id="governing-law"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('12. Governing Law & Jurisdiction', '12. लागू कानून और क्षेत्राधिकार')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'These Terms of Service and any disputes arising out of or related to BarberLoo India shall be governed by and construed in accordance with the laws of the Republic of India. The courts of Punjab and New Delhi shall have exclusive jurisdiction over any legal proceedings.',
                  'ये शर्तें भारत गणराज्य के कानूनों के अनुसार शासित होंगी। किसी भी कानूनी कार्यवाही के लिए पंजाब और नई दिल्ली की अदालतों का विशेष क्षेत्राधिकार होगा।'
                )}
              </p>
              <div className="pt-2 text-xs text-[#8A8178]">
                <p>
                  {tr('Official Legal Inquiries:', 'आधिकारिक कानूनी संपर्क:')}{' '}
                  <a href="mailto:legal@barberloo.in" className="text-[#5B0E14] font-semibold underline">
                    legal@barberloo.in
                  </a>
                </p>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
};
