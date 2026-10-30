import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import {
  AlertTriangle,
  Scale,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Scissors,
  HeartPulse,
  CreditCard,
  Building2,
  FileText,
  Mail,
  Info,
} from 'lucide-react';

interface DisclaimerPageProps {
  onNavigate: (page: PageView) => void;
}

export const DisclaimerPage: React.FC<DisclaimerPageProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();
  const [activeSection, setActiveSection] = useState('intermediary');

  const sections = [
    { id: 'intermediary', title: tr('1. Intermediary Status (IT Act 2000)', '1. मध्यस्थ स्थिति (आईटी अधिनियम 2000)') },
    { id: 'craftsmanship', title: tr('2. Barber Craftsmanship & Styling', '2. बार्बर कारीगरी और हेयरस्टाइलिंग परिणाम') },
    { id: 'health-safety', title: tr('3. Health, Skin & Allergy Advisory', '3. स्वास्थ्य, त्वचा और एलर्जी परामर्श') },
    { id: 'pricing-taxes', title: tr('4. Pricing, Quotes & GST', '4. मूल्य निर्धारण, कोटेशन और जीएसटी') },
    { id: 'third-party', title: tr('5. Third-Party Integrations', '5. तृतीय-पक्ष एकीकरण (गेटवे/मैप्स)') },
    { id: 'limitation', title: tr('6. Limitation of Platform Liability', '6. देयता की सीमा और कानूनी क्षेत्राधिकार') },
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
            <span className="text-[#FFF9E8]">{tr('Legal Disclaimer', 'कानूनी अस्वीकरण (डिस्क्लेमर)')}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-2">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5" />
                {tr('Legal Disclosure', 'वैधानिक सूचना')}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[#FFF9E8]">
                {tr('BarberLoo Legal Disclaimer', 'बारबरलू वैधानिक अस्वीकरण')}
              </h1>
              <p className="text-sm text-[#8A8178] leading-relaxed">
                {tr(
                  'Clarifying the roles, responsibilities, health advisories, and legal boundaries of our luxury salon booking network under Indian law.',
                  'भारतीय कानून के तहत हमारे लग्ज़री सैलून बुकिंग नेटवर्क की भूमिकाओं, जिम्मेदारियों और कानूनी सीमाओं का स्पष्टीकरण।'
                )}
              </p>
            </div>

            <div className="text-right text-xs text-[#8A8178] space-y-1">
              <p>{tr('Updated: October 2026', 'अपडेट: अक्टूबर 2026')}</p>
              <p>{tr('Applicable Law: IT Act 2000 (India)', 'लागू कानून: आईटी अधिनियम 2000 (भारत)')}</p>
              <p>{tr('Portal: barberloo.in', 'वेबसाइट: barberloo.in')}</p>
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
                {tr('Disclaimer Sections', 'अस्वीकरण अनुभाग')}
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

            {/* Advisory Highlight */}
            <div className="bg-[#5B0E14] text-[#FFF9E8] rounded-[20px] p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-[#F1E194] text-xs font-bold uppercase tracking-wider">
                <HeartPulse className="w-4 h-4 shrink-0" />
                <span>{tr('Client Health Notice', 'ग्राहक स्वास्थ्य परामर्श')}</span>
              </div>
              <p className="text-xs text-[#FFF9E8]/85 leading-relaxed">
                {tr(
                  'Always inform your barber of sensitive skin, allergies, or scalp conditions before chemical treatments or razor shaves. Request a 24-hr patch test for new hair dyes.',
                  'हेयर डाई या रेज़र शेव से पहले अपने बार्बर को संवेदनशील त्वचा या एलर्जी के बारे में अवश्य बताएं। नए हेयर कलर के लिए 24 घंटे पहले पैच टेस्ट की मांग करें।'
                )}
              </p>
            </div>
          </aside>

          {/* Document Content */}
          <main className="lg:col-span-8 space-y-8 bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 sm:p-10 shadow-sm leading-relaxed text-sm text-[#3E3835]">
            {/* Section 1 */}
            <section id="intermediary" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Building2 className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('1. Intermediary Status under Indian IT Act 2000', '1. भारतीय आईटी अधिनियम 2000 के तहत मध्यस्थ स्थिति')}
                </h2>
              </div>
              <p>
                {tr(
                  'BarberLoo (operated at barberloo.in) is a technology marketplace and online reservation platform. BarberLoo acts strictly as an "Intermediary" as defined under Section 2(1)(w) of the Information Technology Act, 2000 and is protected by the safe harbour provisions of Section 79 of the Act.',
                  'बारबरलू (barberloo.in) एक तकनीकी मार्केटप्लेस और ऑनलाइन आरक्षण मंच है। यह सूचना प्रौद्योगिकी अधिनियम 2000 की धारा 2(1)(w) के तहत एक "मध्यस्थ" के रूप में कार्य करता है और धारा 79 के तहत सुरक्षित बंदरगाह (सेफ हार्बर) प्रावधानों से संरक्षित है।'
                )}
              </p>
              <div className="p-4 rounded-[16px] bg-[#FAF2E2] border border-[#5B0E14]/15 space-y-1.5 text-xs">
                <p className="font-semibold text-[#111113]">
                  {tr('Independent Salon Ownership:', 'स्वतंत्र सैलून स्वामित्व:')}
                </p>
                <p>
                  {tr(
                    'All partner barber shops, grooming salons, and individual barbers listed on BarberLoo are independent business entities or contractors. BarberLoo does not own, operate, or directly employ the salon staff or manage physical salon premises.',
                    'बारबरलू पर सूचीबद्ध सभी सैलून और बार्बर्स स्वतंत्र व्यावसायिक संस्थाएं हैं। बारबरलू भौतिक सैलून परिसरों का सीधे संचालन या कर्मचारियों का प्रत्यक्ष रोजगार नहीं करता है।'
                  )}
                </p>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 2 */}
            <section id="craftsmanship" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scissors className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('2. Barber Craftsmanship, Consultations & Subjectivity', '2. बार्बर कारीगरी, परामर्श और परिणाम')}
                </h2>
              </div>
              <p>
                {tr(
                  'Hair styling, beard architecture, and grooming services are artistic, subjective, and dependent on individual hair texture, growth patterns, facial structure, and personal preference.',
                  'हेयर स्टाइलिंग, दाढ़ी शेपिंग और ग्रूमिंग कलात्मक और व्यक्तिगत प्राथमिकता, बालों की बनावट और चेहरे की संरचना पर निर्भर करती है।'
                )}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#3E3835]">
                <li>{tr('Reference images shown on BarberLoo represent portfolio work; individual results naturally vary based on hair genetics and length.', 'पोर्टफोलियो चित्र संदर्भ के लिए हैं; वास्तविक परिणाम बालों की बनावट के आधार पर भिन्न हो सकते हैं।')}</li>
                <li>{tr('Clients are strongly advised to conduct a thorough consultation with the assigned barber prior to cutting or styling.', 'सेवा शुरू होने से पहले बार्बर से अपनी पसंद और बालों की लंबाई के बारे में स्पष्ट बात करें।')}</li>
                <li>{tr('BarberLoo is not liable for dissatisfaction arising from subjective aesthetic preferences when the agreed service was delivered.', 'यदि सहमत सेवा पेशेवर रूप से प्रदान की गई है, तो व्यक्तिगत सौंदर्य पसंद के आधार पर बारबरलू उत्तरदायी नहीं है।')}</li>
              </ul>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 3 */}
            <section id="health-safety" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <HeartPulse className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('3. Health, Skin Conditions & Allergy Advisory', '3. स्वास्थ्य, त्वचा की स्थिति और एलर्जी परामर्श')}
                </h2>
              </div>
              <p>
                {tr(
                  'Client safety and salon hygiene are fundamental. However, beauty and personal care treatments involve chemical preparations, essential oils, and hot towel applications:',
                  'ग्राहकों की सुरक्षा और स्वच्छता सर्वोपरि है। फिर भी, ग्रूमिंग में केमिकल, हेयर डाई, एसेंशियल ऑयल और गर्म तौलिया का उपयोग होता है:'
                )}
              </p>
              <div className="p-4 rounded-[16px] bg-[#FAF2E2] border border-[#5B0E14]/15 space-y-2 text-xs">
                <p className="font-semibold text-[#5B0E14]">
                  {tr('Client Pre-Service Disclosure Obligation:', 'ग्राहक प्रकटीकरण दायित्व:')}
                </p>
                <p>
                  {tr(
                    'You are solely responsible for disclosing any pre-existing medical conditions, scalp psoriasis, dermatitis, cuts, infectious skin issues, or chemical allergies (such as PPD in hair dyes) to the barber BEFORE service begins. BarberLoo disclaims all liability for allergic reactions or complications arising from undisclosed medical sensitivities.',
                    'सेवा शुरू होने से पहले किसी भी त्वचा एलर्जी, कट, या केमिकल संवेदनशीलता (जैसे हेयर कलर में PPD) के बारे में बार्बर को सूचित करना आपकी जिम्मेदारी है। अघोषित संवेदनशीलता से होने वाली प्रतिक्रिया के लिए बारबरलू उत्तरदायी नहीं होगा।'
                  )}
                </p>
              </div>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 4 */}
            <section id="pricing-taxes" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <CreditCard className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('4. Pricing, Quotes & GST Transparency', '4. मूल्य निर्धारण, कोटेशन और जीएसटी पारदर्शिता')}
                </h2>
              </div>
              <p>
                {tr(
                  'All service prices and platform fees displayed on BarberLoo are denominated in Indian Rupees (₹ INR). Prices displayed for standard services are set by the partner salon.',
                  'बारबरलू पर प्रदर्शित सभी कीमतें भारतीय रुपये (₹ INR) में हैं और पार्टनर सैलून द्वारा निर्धारित की जाती हैं।'
                )}
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-[#3E3835]">
                <li>{tr('Additional treatments requested in-salon (e.g. hair spa, keratin, beard color) will be billed by the salon according to their published rate card.', 'सैलून में अतिरिक्त सेवाएं लेने पर उनका शुल्क सैलून रेट कार्ड के अनुसार देय होगा।')}</li>
                <li>{tr('Applicable Goods and Services Tax (GST) is collected transparently where applicable by registered salons or platform charges.', 'लागू जीएसटी पारदर्शी रूप से दर्शाया जाता है।')}</li>
                <li>{tr('BarberLoo guarantees that clients are never charged higher than the confirmed digital reservation receipt.', 'बारबरलू गारंटी देता है कि डिजिटल रसीद से अधिक कोई छिपा हुआ शुल्क नहीं लिया जाएगा।')}</li>
              </ul>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 5 */}
            <section id="third-party" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Scale className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('5. Third-Party Integrations & External Gateways', '5. तृतीय-पक्ष एकीकरण और गेटवे')}
                </h2>
              </div>
              <p>
                {tr(
                  'BarberLoo integrates with trusted third-party providers including Razorpay (payment processing), Google Maps / OpenStreetMap (geocoding and salon directions), and telecom gateways (SMS / OTP dispatch):',
                  'बारबरलू रेज़रपे (पेमेंट), गूगल मैप्स (दिशा-निर्देश) और टेलीकॉम गेटवे (SMS) जैसे विश्वसनीय भागीदारों के साथ काम करता है:'
                )}
              </p>
              <p className="text-xs text-[#8A8178]">
                {tr(
                  'While we maintain high availability architecture, BarberLoo is not responsible for transient outages, bank downtime, UPI server delays, or cellular network delays beyond our direct infrastructural control.',
                  'हम उच्च उपलब्धता सुनिश्चित करते हैं, लेकिन बैंक सर्वर डाउन होने, यूपीआई नेटवर्क की खराबी या सेलुलर ऑपरेटर की देरी के लिए बारबरलू जिम्मेदार नहीं है।'
                )}
              </p>
            </section>

            <hr className="border-[#5B0E14]/10" />

            {/* Section 6 */}
            <section id="limitation" className="space-y-4 pt-2">
              <div className="flex items-center gap-2.5 text-[#5B0E14]">
                <Info className="w-5 h-5 shrink-0" />
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#111113]">
                  {tr('6. Limitation of Platform Liability & Legal Jurisdiction', '6. देयता की सीमा और कानूनी क्षेत्राधिकार')}
                </h2>
              </div>
              <p>
                {tr(
                  'To the maximum extent permitted under applicable laws of India, BarberLoo’s aggregate liability for any claim arising from an appointment shall strictly be limited to the total amount paid by the customer for that specific booking transaction.',
                  'भारतीय कानून के तहत, किसी भी अपॉइंटमेंट से संबंधित दावे के लिए बारबरलू की कुल देयता उस विशेष बुकिंग के लिए ग्राहक द्वारा भुगतान की गई राशि तक ही सीमित होगी।'
                )}
              </p>
              <div className="bg-[#FAF2E2] p-4 rounded-[16px] border border-[#5B0E14]/15 space-y-1 text-xs">
                <p className="font-semibold text-[#111113]">
                  {tr('Exclusive Jurisdiction:', 'विशेष क्षेत्राधिकार:')}
                </p>
                <p className="text-[#8A8178]">
                  {tr(
                    'Any legal disputes, actions, or proceedings arising out of or related to this website shall be governed by the laws of India and subject to the exclusive jurisdiction of the competent courts in Bengaluru, Karnataka, India.',
                    'इस वेबसाइट से संबंधित कोई भी कानूनी विवाद भारत के कानूनों द्वारा शासित होगा और सक्षम न्यायालय बेंगलुरु, कर्नाटक, भारत के क्षेत्राधिकार के अधीन होगा।'
                  )}
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};
