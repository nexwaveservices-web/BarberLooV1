import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import {
  ShieldCheck,
  Lock,
  FileText,
  ChevronRight,
  ArrowLeft,
  KeyRound,
  CreditCard,
  Bell,
  Scale,
  Mail,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

interface PrivacyPolicyPageProps {
  onNavigate: (page: PageView) => void;
}

export const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();
  const [activeSection, setActiveSection] = useState('intro');

  const sections = [
    { id: 'intro', title: tr('1. Introduction & Overview', '1. परिचय और अवलोकन') },
    { id: 'collection', title: tr('2. Information We Collect', '2. जानकारी जो हम एकत्र करते हैं') },
    { id: 'usage', title: tr('3. How We Use Your Data', '3. हम आपके डेटा का उपयोग कैसे करते हैं') },
    { id: 'otp-security', title: tr('4. Completion OTP & Security', '4. कंप्लीशन OTP और सुरक्षा') },
    { id: 'payments', title: tr('5. Payment & Escrow Processing', '5. भुगतान और एस्क्रो प्रोसेसिंग') },
    { id: 'sharing', title: tr('6. Data Sharing with Salons', '6. सैलून पार्टनर्स के साथ डेटा साझाकरण') },
    { id: 'dpdpa', title: tr('7. Indian DPDPA & Your Rights', '7. भारतीय DPDPA और आपके अधिकार') },
    { id: 'cookies', title: tr('8. Cookies & Session Storage', '8. कुकीज़ और सत्र संग्रहण') },
    { id: 'retention', title: tr('9. Data Retention & Deletion', '9. डेटा प्रतिधारण और हटाना') },
    { id: 'grievance', title: tr('10. Grievance Redressal Officer', '10. शिकायत निवारण अधिकारी') },
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
            <span className="text-[#FFF9E8]">{tr('Privacy Policy', 'गोपनीयता नीति')}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                {tr('DPDPA 2023 Compliant', 'डीपीडीपीए 2023 अनुपालन')}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#FFF9E8]">
                {tr('BarberLoo Privacy Policy', 'बारबरलू गोपनीयता नीति')}
              </h1>
              <p className="text-sm text-[#8A8178] leading-relaxed">
                {tr(
                  'Committed to transparent data governance, cryptographic booking security, and full compliance with the Digital Personal Data Protection Act (DPDPA), 2023 of the Republic of India.',
                  'पारदर्शी डेटा प्रशासन, क्रिप्टोग्राफ़िक बुकिंग सुरक्षा और भारत गणराज्य के डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम (डीपीडीपीए), 2023 के पूर्ण अनुपालन के लिए प्रतिबद्ध।'
                )}
              </p>
            </div>

            <div className="p-4 rounded-[20px] bg-[#241719] border border-[#F1E194]/20 text-xs space-y-1.5 shrink-0 self-start md:self-auto">
              <p className="text-[#8A8178] uppercase tracking-wider text-[10px] font-semibold">
                {tr('Authoritative Domain', 'आधिकारिक डोमेन')}
              </p>
              <p className="text-[#F1E194] font-mono font-bold">https://barberloo.in</p>
              <p className="text-[#8A8178] text-[10px] pt-1">
                {tr('Last Revised: October 2026 (IST)', 'अंतिम संशोधन: अक्टूबर 2026 (IST)')}
              </p>
            </div>
          </div>

          {/* Quick tab switch between Legal docs */}
          <div className="pt-4 flex flex-wrap gap-2">
            <span className="px-4 py-2 rounded-[12px] bg-[#5B0E14] text-[#F1E194] text-xs font-bold uppercase tracking-wider border border-[#F1E194]/30 shadow-sm flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              {tr('Privacy Policy', 'गोपनीयता नीति')}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('terms-of-service')}
              className="px-4 py-2 rounded-[12px] bg-[#241719] hover:bg-[#2e1d20] text-[#FFF9E8] text-xs font-semibold uppercase tracking-wider border border-[#F1E194]/15 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-[#F1E194]" />
              {tr('Terms of Service', 'सेवा की शर्तें')}
            </button>
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
                <FileText className="w-4 h-4 text-[#5B0E14]" />
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#1C1718]">
                  {tr('Policy Outline', 'नीति रूपरेखा')}
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

            {/* Quick Contact Card */}
            <div className="rounded-[24px] bg-[#1C1718] text-[#FFF9E8] border border-[#F1E194]/20 p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#F1E194]">
                <Mail className="w-4 h-4" />
                <span>{tr('Privacy Questions?', 'गोपनीयता संबंधी प्रश्न?')}</span>
              </div>
              <p className="text-xs text-[#8A8178] leading-relaxed">
                {tr(
                  'Have questions about your personal data or wish to exercise your rights under DPDPA?',
                  'क्या आपके पास अपने व्यक्तिगत डेटा के संबंध में प्रश्न हैं या डीपीडीपीए के तहत अधिकारों का उपयोग करना चाहते हैं?'
                )}
              </p>
              <a
                href="mailto:privacy@barberloo.in"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F1E194] hover:underline"
              >
                <span>privacy@barberloo.in</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </aside>

          {/* Policy Text Articles */}
          <article className="lg:col-span-8 space-y-8">
            {/* Section 1 */}
            <section
              id="intro"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('1. Introduction & Overview', '1. परिचय और अवलोकन')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'Welcome to BarberLoo India (“BarberLoo”, “we”, “our”, or “us”), operated via the authoritative digital domain https://barberloo.in. BarberLoo is a digital appointment reservation and discovery marketplace that connects discerning customers seeking master haircutting, beard grooming, and salon rituals with verified partner barbers and barbershops across India.',
                  'बारबरलू इंडिया (“बारबरलू”, “हम”, या “हमारा”) में आपका स्वागत है, जो आधिकारिक डिजिटल डोमेन https://barberloo.in के माध्यम से संचालित होता है। बारबरलू एक डिजिटल अपॉइंटमेंट आरक्षण और खोज प्लेटफ़ॉर्म है जो पूरे भारत में सत्यापित मास्टर सैलून और बार्बर पार्टनर्स को ग्राहकों से जोड़ता है।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'This Privacy Policy outlines our transparent practices regarding the collection, storage, processing, transfer, and protection of your Personal Data in accordance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act (DPDPA), 2023.',
                  'यह गोपनीयता नीति सूचना प्रौद्योगिकी अधिनियम, 2000, आईटी नियम 2011 और डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम (डीपीडीपीए), 2023 के तहत आपके व्यक्तिगत डेटा के संग्रह, प्रसंस्करण और सुरक्षा से संबंधित हमारे सिद्धांतों को स्पष्ट करती है।'
                )}
              </p>
            </section>

            {/* Section 2 */}
            <section
              id="collection"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <FileText className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('2. Information We Collect', '2. जानकारी जो हम एकत्र करते हैं')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'We only collect information strictly necessary to facilitate verified grooming reservations, ensure platform security, and process payments:',
                  'हम केवल वही जानकारी एकत्र करते हैं जो सैलून आरक्षण को सुगम बनाने, प्लेटफ़ॉर्म सुरक्षा सुनिश्चित करने और भुगतान संसाधित करने के लिए आवश्यक है:'
                )}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                <div className="p-4 rounded-[16px] bg-[#EFE9DD]/80 border border-[#241719]/10 space-y-1.5">
                  <p className="text-xs font-bold text-[#5B0E14] uppercase tracking-wider">
                    {tr('Account & Identity Data', 'खाता और पहचान डेटा')}
                  </p>
                  <p className="text-xs text-[#5B524A] leading-relaxed">
                    {tr(
                      'Full name, email address, +91 mobile phone number, account password (cryptographically salted & hashed by Supabase Auth), and registered state & city.',
                      'पूरा नाम, ईमेल पता, +91 मोबाइल नंबर, सुरक्षित पासवर्ड (सुपाबेस ऑथ द्वारा हैशेड), और पंजीकृत राज्य और शहर।'
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-[16px] bg-[#EFE9DD]/80 border border-[#241719]/10 space-y-1.5">
                  <p className="text-xs font-bold text-[#5B0E14] uppercase tracking-wider">
                    {tr('Reservation & Service Data', 'आरक्षण और सेवा डेटा')}
                  </p>
                  <p className="text-xs text-[#5B524A] leading-relaxed">
                    {tr(
                      'Booked salon, assigned stylist, service choices (fade, beard sculpt, etc.), IST appointment timestamp, duration, special grooming notes, and service status.',
                      'सैलून का नाम, स्टाइलिस्ट, चयनित सेवा, भारतीय मानक समय (IST) पर समय, अवधि, विशेष निर्देश और सेवा स्थिति।'
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-[16px] bg-[#EFE9DD]/80 border border-[#241719]/10 space-y-1.5">
                  <p className="text-xs font-bold text-[#5B0E14] uppercase tracking-wider">
                    {tr('Transaction & Financial Data', 'वित्तीय और लेनदेन डेटा')}
                  </p>
                  <p className="text-xs text-[#5B524A] leading-relaxed">
                    {tr(
                      'Razorpay order IDs, payment transaction IDs, collected amounts in INR (₹), platform convenience fees, escrow ledger records, and refund logs. We never store credit/debit card PINs or CVV numbers.',
                      'रेज़रपे ऑर्डर आईडी, भारतीय रुपये (₹) में लेनदेन आईडी, प्लेटफ़ॉर्म शुल्क और रिफ़ंड लॉग। हम कभी भी कार्ड पिन या सीवीवी संग्रहीत नहीं करते।'
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-[16px] bg-[#EFE9DD]/80 border border-[#241719]/10 space-y-1.5">
                  <p className="text-xs font-bold text-[#5B0E14] uppercase tracking-wider">
                    {tr('Technical & Diagnostic Data', 'तकनीकी और डायग्नोस्टिक डेटा')}
                  </p>
                  <p className="text-xs text-[#5B524A] leading-relaxed">
                    {tr(
                      'IP address, browser type, device identifiers, and persistent session authentication tokens used strictly to maintain secure login status.',
                      'आईपी पता, ब्राउज़र प्रकार, डिवाइस विवरण और सुरक्षित लॉगिन सत्र बनाए रखने के लिए उपयोग किए जाने वाले टोकन।'
                    )}
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section
              id="usage"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Bell className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('3. How We Use Your Data', '3. हम आपके डेटा का उपयोग कैसे करते हैं')}
                </h2>
              </div>
              <ul className="space-y-3 text-sm text-[#4A423B]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#5B0E14] mt-1 shrink-0" />
                  <span>
                    <strong>{tr('Appointment Fulfillment:', 'अपॉइंटमेंट पूर्णता:')}</strong>{' '}
                    {tr(
                      'Scheduling calendar slots, allocating salon chairs, notifying the barber of incoming clients, and sending real-time IST appointment reminders.',
                      'सैलून चेयर आवंटित करना, बार्बर को सूचित करना और रीयल-टाइम IST रिमाइंडर भेजना।'
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#5B0E14] mt-1 shrink-0" />
                  <span>
                    <strong>{tr('Payment & Escrow Operations:', 'भुगतान और एस्क्रो संचालन:')}</strong>{' '}
                    {tr(
                      'Collecting upfront booking payments, holding barber payout balances pending in escrow, and validating refunds upon pre-service cancellation.',
                      'अग्रिम बुकिंग भुगतान प्राप्त करना, बार्बर कमाई को एस्क्रो में सुरक्षित रखना और रद्दीकरण पर रिफ़ंड प्रोसेस करना।'
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#5B0E14] mt-1 shrink-0" />
                  <span>
                    <strong>{tr('Fraud Prevention & Security:', 'धोखाधड़ी रोकथाम और सुरक्षा:')}</strong>{' '}
                    {tr(
                      'Enforcing single-use cryptographic OTP verification to prevent unauthorized service claims and simulated payment attacks.',
                      'अनधिकृत दावों को रोकने के लिए एकल-उपयोग क्रिप्टोग्राफ़िक ओटीपी सत्यापन लागू करना।'
                    )}
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section
              id="otp-security"
              className="rounded-[24px] bg-[#1C1718] text-[#FFF9E8] border border-[#F1E194]/25 p-7 sm:p-9 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-2.5 text-[#F1E194]">
                <KeyRound className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
                  {tr('4. Cryptographic Completion OTP & Privacy Vault', '4. क्रिप्टोग्राफ़िक कंप्लीशन OTP और गोपनीयता वॉल्ट')}
                </h2>
              </div>
              <p className="text-sm text-[#D3CBBF] leading-relaxed">
                {tr(
                  'To safeguard clients from false completion reports and ensure barbers are justly paid, BarberLoo employs an industry-first Cryptographic OTP Protocol:',
                  'ग्राहकों को झूठी सेवा रिपोर्टिंग से बचाने और बार्बर को निष्पक्ष भुगतान सुनिश्चित करने के लिए, बारबरलू एक विशेष क्रिप्टोग्राफ़िक ओटीपी प्रोटोकॉल लागू करता है:'
                )}
              </p>
              <div className="space-y-3 pt-2 text-xs text-[#D3CBBF]">
                <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15">
                  <strong className="text-[#F1E194] block mb-1">
                    {tr('Zero-Knowledge Barber Isolation:', 'शून्य-ज्ञान बार्बर अलगाव:')}
                  </strong>
                  {tr(
                    'The 6-digit completion OTP is generated upon confirmed payment and decrypted strictly on the customer’s private device. Barbers, salon managers, and public APIs are cryptographically forbidden from accessing the customer’s plaintext secret before physical in-salon service delivery.',
                    '6-अंकीय ओटीपी केवल ग्राहक की निजी स्क्रीन पर दिखाई देता है। सेवा पूर्ण होने से पहले बार्बर या सार्वजनिक एपीआई इसे देखने के लिए अधिकृत नहीं हैं।'
                  )}
                </div>
                <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15">
                  <strong className="text-[#F1E194] block mb-1">
                    {tr('Salted HMAC-SHA256 & Rate Limiting:', 'सॉल्टेड HMAC-SHA256 और दर सीमा:')}
                  </strong>
                  {tr(
                    'Stored in the database using unpredictable 16-byte random salts and HMAC-SHA256 hashes with brute-force protection capping attempts at 5 tries, with an automatic 48-hour expiration window.',
                    'डेटाबेस में 16-बाइट यादृच्छिक सॉल्ट और हैश के साथ संग्रहीत, अधिकतम 5 प्रयासों की सुरक्षा सीमा के साथ।'
                  )}
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section
              id="payments"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <CreditCard className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('5. Payment Processing & Escrow Operations', '5. भुगतान प्रसंस्करण और एस्क्रो संचालन')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'All digital payments on BarberLoo are processed via RBI-authorized payment aggregator Razorpay. When you pay for a booking, funds are deposited into a secure pending escrow ledger. The barber’s payout is held until the physical appointment is successfully verified with your completion OTP.',
                  'बारबरलू पर सभी डिजिटल भुगतान भारतीय रिज़र्व बैंक (आरबीआई) द्वारा अधिकृत भुगतान एग्रीगेटर रेज़रपे के माध्यम से सुरक्षित होते हैं। जब आप भुगतान करते हैं, तो राशि एस्क्रो में रखी जाती है और आपके ओटीपी सत्यापन के बाद ही बार्बर को जारी की जाती है।'
                )}
              </p>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'In the event of a cancellation by the salon or a timely cancellation by you prior to the appointment window, refunds are authorized directly through Razorpay back to your original source of payment (UPI, bank account, or card).',
                  'यदि सैलून द्वारा अपॉइंटमेंट रद्द किया जाता है या आपके द्वारा समय पर रद्द किया जाता है, तो रिफ़ंड सीधे आपके मूल भुगतान स्रोत (यूपीआई, बैंक खाता या कार्ड) पर वापस भेजा जाता है।'
                )}
              </p>
            </section>

            {/* Section 6 */}
            <section
              id="sharing"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Lock className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('6. Data Sharing with Salons & Third Parties', '6. सैलून पार्टनर्स और तीसरे पक्ष के साथ डेटा साझाकरण')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'We never sell, rent, or trade your personal data. We disclose your personal data strictly to the following entities under binding confidentiality obligations:',
                  'हम आपका व्यक्तिगत डेटा कभी भी बेचते या किराए पर नहीं देते। हम केवल निम्नलिखित पक्षों के साथ आवश्यक जानकारी साझा करते हैं:'
                )}
              </p>
              <ul className="space-y-2.5 text-sm text-[#4A423B] list-disc list-inside">
                <li>
                  <strong>{tr('Assigned Partner Salon:', 'आवंटित पार्टनर सैलून:')}</strong>{' '}
                  {tr(
                    'Client name, appointment date/time, selected grooming service, and optional styling notes.',
                    'ग्राहक का नाम, समय, सेवा का प्रकार और विशेष निर्देश।'
                  )}
                </li>
                <li>
                  <strong>{tr('Payment Aggregators (Razorpay):', 'भुगतान भागीदार (रेज़रपे):')}</strong>{' '}
                  {tr(
                    'Transaction amount, order ID, and client contact details for digital payment receipts and fraud detection.',
                    'लेनदेन राशि, ऑर्डर आईडी और डिजिटल रसीदों के लिए संपर्क विवरण।'
                  )}
                </li>
                <li>
                  <strong>{tr('Statutory Authorities:', 'सरकारी प्राधिकरण:')}</strong>{' '}
                  {tr(
                    'When required by enforceable court orders, law enforcement warrants, or Indian statutory regulations.',
                    'कानूनी आदेशों या भारतीय वैधानिक नियमों के अनुपालन के लिए आवश्यक होने पर।'
                  )}
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section
              id="dpdpa"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('7. Rights Under the Indian DPDPA (2023)', '7. भारतीय डीपीडीपीए (2023) के तहत आपके अधिकार')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'As a Data Principal under India’s Digital Personal Data Protection Act, 2023, you have guaranteed statutory rights:',
                  'भारत के डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के तहत डेटा प्रिंसिपल के रूप में आपके पास निम्नलिखित अधिकार हैं:'
                )}
              </p>
              <div className="space-y-2.5 text-xs text-[#5B524A]">
                <div className="p-3.5 rounded-[14px] bg-[#EFE9DD]/80 border border-[#241719]/10">
                  <strong className="text-[#1C1718] block">
                    {tr('Right to Access & Summary:', 'पहुंच और सारांश का अधिकार:')}
                  </strong>
                  {tr(
                    'You have the right to request a summary of the personal data processed by BarberLoo and the identities of salons with whom your data was shared.',
                    'आप बारबरलू द्वारा संसाधित व्यक्तिगत डेटा के सारांश का अनुरोध कर सकते हैं।'
                  )}
                </div>
                <div className="p-3.5 rounded-[14px] bg-[#EFE9DD]/80 border border-[#241719]/10">
                  <strong className="text-[#1C1718] block">
                    {tr('Right to Correction & Erasure:', 'सुधार और मिटाने का अधिकार:')}
                  </strong>
                  {tr(
                    'You may update inaccurate personal details anytime via your Account Profile, or request account and data erasure, subject to statutory tax and financial record retention laws.',
                    'आप अपनी प्रोफ़ाइल में डेटा सुधार सकते हैं या खाता हटाने का अनुरोध कर सकते हैं।'
                  )}
                </div>
                <div className="p-3.5 rounded-[14px] bg-[#EFE9DD]/80 border border-[#241719]/10">
                  <strong className="text-[#1C1718] block">
                    {tr('Right of Grievance Redressal:', 'शिकायत निवारण का अधिकार:')}
                  </strong>
                  {tr(
                    'You have the right to an expeditious resolution of any privacy grievances through our designated Grievance Officer.',
                    'आपको हमारे शिकायत निवारण अधिकारी के माध्यम से त्वरित समाधान का अधिकार है।'
                  )}
                </div>
              </div>
            </section>

            {/* Section 8 */}
            <section
              id="cookies"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <KeyRound className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('8. Cookies & Session Storage', '8. कुकीज़ और सत्र संग्रहण')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'BarberLoo utilizes essential cookies and local browser storage (such as barberloo_auth_token and barberloo_supabase_session) strictly to keep your account safely logged in across page refreshes, prevent cross-site request forgery, and store your preferred language (English/Hindi).',
                  'बारबरलू आवश्यक कुकीज़ और स्थानीय स्टोरेज (जैसे barberloo_auth_token और barberloo_supabase_session) का उपयोग केवल सुरक्षित लॉगिन बनाए रखने और भाषा प्राथमिकताओं को सहेजने के लिए करता है।'
                )}
              </p>
            </section>

            {/* Section 9 */}
            <section
              id="retention"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('9. Data Retention & Erasure', '9. डेटा प्रतिधारण और हटाना')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'We retain your account profile and booking history as long as your account remains active. Accounting transaction logs, invoice receipts, and double-entry ledger records are retained for a minimum of 8 years to comply with Indian GST and income tax statutory regulations, after which they are securely scrubbed.',
                  'हम आपकी बुकिंग जानकारी तब तक रखते हैं जब तक आपका खाता सक्रिय है। वित्तीय लेनदेन और जीएसटी चालान रिकॉर्ड भारतीय वैधानिक नियमों के तहत कम से कम 8 वर्षों तक रखे जाते हैं।'
                )}
              </p>
            </section>

            {/* Section 10 */}
            <section
              id="grievance"
              className="rounded-[24px] bg-[#FAF6EA] border border-[#241719]/10 p-7 sm:p-9 space-y-5 shadow-sm"
            >
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Mail className="w-5 h-5" />
                <h2 className="font-display text-2xl font-bold text-[#1C1718]">
                  {tr('10. Grievance Redressal Officer', '10. शिकायत निवारण अधिकारी')}
                </h2>
              </div>
              <p className="text-sm text-[#4A423B] leading-relaxed">
                {tr(
                  'In compliance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, the details of the designated Grievance Officer for BarberLoo India are as follows:',
                  'सूचना प्रौद्योगिकी अधिनियम, 2000 और डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुपालन में, बारबरलू इंडिया के नामित शिकायत अधिकारी का विवरण इस प्रकार है:'
                )}
              </p>
              <div className="p-5 rounded-[16px] bg-[#EFE9DD] border border-[#241719]/15 space-y-2 text-xs text-[#241719]">
                <p>
                  <strong>{tr('Officer Name:', 'अधिकारी का नाम:')}</strong> Legal & Compliance Desk, BarberLoo India
                </p>
                <p>
                  <strong>{tr('Registered Entity:', 'पंजीकृत इकाई:')}</strong> BarberLoo Grooming Technologies
                </p>
                <p>
                  <strong>{tr('Platform Domain:', 'प्लेटफ़ॉर्म डोमेन:')}</strong> https://barberloo.in
                </p>
                <p>
                  <strong>{tr('Grievance Email:', 'शिकायत ईमेल:')}</strong>{' '}
                  <a href="mailto:grievance@barberloo.in" className="text-[#5B0E14] font-semibold underline">
                    grievance@barberloo.in
                  </a>
                </p>
                <p>
                  <strong>{tr('Operational Response Window:', 'प्रतिक्रिया समय:')}</strong>{' '}
                  {tr('Within 48 business hours (IST)', '48 कार्य घंटों के भीतर (IST)')}
                </p>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
};
