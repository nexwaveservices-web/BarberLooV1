import React from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import { SmartImage } from './SmartImage';
import {
  Scissors,
  Clock,
  ShieldCheck,
  Award,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Users,
  Building,
  HeartHandshake,
  Star,
  MapPin,
} from 'lucide-react';

interface AboutUsPageProps {
  onNavigate: (page: PageView) => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({ onNavigate }) => {
  const { tr } = useLanguage();

  const stats = [
    { number: '45+', label: tr('Verified Partner Salons', 'सत्यापित पार्टनर सैलून') },
    { number: '180+', label: tr('Certified Master Barbers', 'प्रमाणित मास्टर बार्बर्स') },
    { number: '15,000+', label: tr('Satisfied Gentlemen Groomed', 'संतुष्ट ग्राहक') },
    { number: '99.4%', label: tr('On-Time Chair Start SLA', 'समय पर चेयर शुरुआत') },
  ];

  const pillars = [
    {
      icon: Scissors,
      title: tr('Artisan Craftsmanship', 'कारीगरी और उत्कृष्टता'),
      description: tr(
        'Every partner salon and barber on BarberLoo undergoes rigorous vetting for skill, tool sterilization, hot-towel mastery, and customer etiquette.',
        'बारबरलू पर हर सैलून और बार्बर का स्वच्छता, औजारों की नसबंदी और स्टाइलिंग कौशल के लिए कठोर सत्यापन होता है।'
      ),
    },
    {
      icon: Clock,
      title: tr('Guaranteed Zero Wait-Time', 'शून्य प्रतीक्षा समय गारंटी'),
      description: tr(
        'We believe waiting in salon queues diminishes the luxury experience. Our 15-Minute Chair Guarantee ensures your seat is reserved and waiting for you.',
        'लाइन में प्रतीक्षा करना लग्ज़री अनुभव को कम करता है। हमारी 15-मिनट गारंटी सुनिश्चित करती है कि आपकी चेयर तैयार मिले।'
      ),
    },
    {
      icon: ShieldCheck,
      title: tr('Cryptographic OTP Escrow', 'सुरक्षित OTP एस्क्रो सिस्टम'),
      description: tr(
        'Client funds are held in secure escrow. Barbers are compensated only after you share your 6-digit Customer OTP upon complete service satisfaction.',
        'आपका भुगतान सुरक्षित एस्क्रो में रहता है। बार्बर को भुगतान तभी जारी होता है जब आप सेवा से संतुष्ट होकर OTP साझा करते हैं।'
      ),
    },
    {
      icon: HeartHandshake,
      title: tr('Empowering Local Barbers', 'स्थानीय बार्बर्स का सशक्तिकरण'),
      description: tr(
        'By providing digital bookings, predictable income, and zero commission exploitation, BarberLoo elevates the livelihood of master craftsmen across India.',
        'डिजिटल बुकिंग, निश्चित आय और पारदर्शी व्यवस्था से बारबरलू भारत भर के कारीगरों की आजीविका को बेहतर बनाता है।'
      ),
    },
  ];

  const metroCities = [
    { name: 'Mumbai', hindi: 'मुंबई', shops: '14 Salons', tag: 'Colaba, Bandra, Juhu, BKC' },
    { name: 'Bengaluru', hindi: 'बेंगलुरु', shops: '18 Salons', tag: 'Indiranagar, Koramangala, Whitefield' },
    { name: 'New Delhi', hindi: 'नई दिल्ली', shops: '12 Salons', tag: 'Connaught Place, South Ex, Vasant Vihar' },
    { name: 'Punjab & Beyond', hindi: 'पंजाब और अन्य', shops: '8 Salons', tag: 'Jalandhar, Ludhiana, Chandigarh' },
  ];

  return (
    <div className="bg-[#EFE9DD] min-h-screen text-[#111113] pb-24">
      {/* Hero Section */}
      <section className="bg-[#1C1718] text-[#FFF9E8] pt-14 pb-20 px-5 sm:px-8 border-b border-[#F1E194]/20 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-[#5B0E14]/30 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 bottom-0 w-80 h-80 rounded-full bg-[#F1E194]/10 blur-3xl pointer-events-none" />

        <div className="max-w-[1240px] mx-auto relative z-10 space-y-6">
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
            <span className="text-[#FFF9E8]">{tr('About BarberLoo', 'बारबरलू के बारे में')}</span>
          </div>

          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              {tr('India’s Luxury Grooming Network', 'भारत का प्रमुख लग्ज़री ग्रूमिंग नेटवर्क')}
            </div>
            <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#FFF9E8] leading-[1.12]">
              {tr(
                'Redefining the Gentleman’s Grooming Experience in India',
                'भारत में पुरुषों के ग्रूमिंग अनुभव को नया रूप देना'
              )}
            </h1>
            <p className="text-base sm:text-lg text-[#8A8178] leading-relaxed max-w-2xl">
              {tr(
                'BarberLoo was founded with a singular conviction: discerning gentlemen deserve master craftsmanship, punctuality, and complete peace of mind, while skilled barbers deserve fair, dignified digital livelihoods.',
                'बारबरलू की स्थापना एक स्पष्ट उद्देश्य के साथ हुई: समझदार पुरुषों को कुशल कारीगरी और समय की पाबंदी मिले, और कुशल बार्बर्स को सम्मानजनक डिजिटल आजीविका मिले।'
              )}
            </p>
          </div>

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-[#F1E194]/15">
            {stats.map((st, idx) => (
              <div key={idx} className="space-y-1">
                <div className="font-display text-2xl sm:text-4xl font-bold text-[#F1E194]">
                  {st.number}
                </div>
                <div className="text-xs text-[#8A8178] tracking-wider uppercase">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Story & Vision Section */}
      <section className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B0E14] block">
                {tr('The BarberLoo Story', 'हमारी कहानी')}
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#111113]">
                {tr('Where Ancient Craft Meets Modern Technology', 'जहाँ प्राचीन कारीगरी आधुनिक तकनीक से मिलती है')}
              </h2>
            </div>
            <p className="text-sm text-[#5A534D] leading-relaxed">
              {tr(
                'For centuries, traditional Indian barbering was an art of supreme touch — straight-razor precision, bespoke head massages, and fragrant sandalwood tonics. Yet, modern urban life brought congested waiting rooms, unpredictable pricing, and rushed haircuts.',
                'सदियों से भारतीय बार्बरिंग एक अद्वितीय कला रही है — उस्तरे की सटीकता, सिर की मालिश और चंदन की खुशबू। लेकिन आधुनिक जीवन में भीड़, अनिश्चित दरें और जल्दबाजी ने इसका आनंद कम कर दिया।'
              )}
            </p>
            <p className="text-sm text-[#5A534D] leading-relaxed">
              {tr(
                'BarberLoo bridges this divide. We combine the soul of artisanal barbering with precision time-slot reservations, transparent INR pricing, and cryptographic customer protection. No lines, no guesswork — just master grooming delivered on your terms.',
                'बारबरलू इसी अंतर को समाप्त करता है। हम पारंपरिक बार्बरिंग की आत्मा को डिजिटल बुकिंग, स्पष्ट कीमतों और ग्राहक सुरक्षा के साथ जोड़ते हैं।'
              )}
            </p>

            <div className="pt-2 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => onNavigate('shop')}
                className="px-6 py-3.5 rounded-[16px] neu-btn-burgundy text-xs font-semibold tracking-wider uppercase flex items-center gap-2 cursor-pointer"
              >
                <span>{tr('Explore Partner Salons', 'पार्टनर सैलून देखें')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="px-6 py-3.5 rounded-[16px] neu-btn-gold text-xs font-semibold tracking-wider uppercase cursor-pointer"
              >
                {tr('Book an Appointment', 'अपॉइंटमेंट बुक करें')}
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/15 rounded-[24px] p-8 shadow-sm space-y-6">
              <h3 className="font-display text-xl font-bold text-[#111113] border-b border-[#5B0E14]/10 pb-4">
                {tr('How BarberLoo Works for You', 'बारबरलू कैसे काम करता है')}
              </h3>
              <div className="space-y-5">
                {[
                  {
                    step: '01',
                    title: tr('Curated Discovery', 'पसंदीदा सैलून खोजें'),
                    desc: tr('Browse verified salons, inspect master barber profiles, and view authentic verified client reviews.', 'सत्यापित सैलून और बार्बर्स की प्रोफ़ाइल व समीक्षाएं देखें।'),
                  },
                  {
                    step: '02',
                    title: tr('Guaranteed IST Slot', 'निश्चित समय चुनें'),
                    desc: tr('Pick your exact date and 15-minute chair window. Transparent INR prices with zero hidden salon charges.', 'अपनी पसंदीदा तारीख और समय चुनें। कोई छिपा हुआ शुल्क नहीं।'),
                  },
                  {
                    step: '03',
                    title: tr('Secure Escrow & OTP', 'सुरक्षित एस्क्रो और OTP'),
                    desc: tr('Your payment is held in escrow. You receive a confidential 6-digit Customer Completion OTP.', 'भुगतान एस्क्रो में सुरक्षित रहता है और आपको 6-अंकीय OTP मिलता है।'),
                  },
                  {
                    step: '04',
                    title: tr('Flawless Execution', 'उत्कृष्ट सेवा और समापन'),
                    desc: tr('Enjoy your luxury grooming session. Share your OTP with the barber only after you are 100% satisfied.', 'सेवा का आनंद लें। संतुष्ट होने के बाद ही बार्बर को OTP दें।'),
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <span className="font-display font-bold text-lg text-[#5B0E14] bg-[#5B0E14]/8 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                      {item.step}
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-[#111113]">{item.title}</h4>
                      <p className="text-xs text-[#8A8178] leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="bg-[#1C1718] text-[#FFF9E8] py-20 px-5 sm:px-8 border-y border-[#F1E194]/20">
        <div className="max-w-[1240px] mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#F1E194]">
              {tr('Our Core Values', 'हमारे मूल सिद्धांत')}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#FFF9E8]">
              {tr('Built on Craft, Punctuality & Trust', 'कारीगरी, समयनिष्ठा और विश्वास')}
            </h2>
            <p className="text-sm text-[#8A8178]">
              {tr(
                'Four unbreakable standards that govern every reservation across the BarberLoo salon network.',
                'चार बुनियादी मानक जो बारबरलू नेटवर्क पर हर बुकिंग को नियंत्रित करते हैं।'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pillars.map((pil, idx) => {
              const IconComp = pil.icon;
              return (
                <div
                  key={idx}
                  className="bg-[#111113] border border-[#F1E194]/15 rounded-[20px] p-6 space-y-4 hover:border-[#F1E194]/40 transition-colors"
                >
                  <div className="w-12 h-12 rounded-[14px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center">
                    <IconComp className="w-6 h-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#FFF9E8]">
                    {pil.title}
                  </h3>
                  <p className="text-xs text-[#8A8178] leading-relaxed">
                    {pil.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Metro Presence Section */}
      <section className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5B0E14] block">
              {tr('Nationwide Reach', 'अखिल भारतीय नेटवर्क')}
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
              {tr('Partner Salons Across Major Indian Metros', 'प्रमुख भारतीय शहरों में पार्टनर सैलून')}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('contact-us')}
            className="text-xs font-bold uppercase tracking-wider text-[#5B0E14] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{tr('Are you a salon owner? Partner with us', 'सैलून मालिक? हमारे पार्टनर बनें')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metroCities.map((city, idx) => (
            <div
              key={idx}
              className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[18px] p-5 space-y-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-bold text-[#111113]">{city.name}</span>
                <span className="text-xs font-semibold text-[#5B0E14] bg-[#5B0E14]/8 px-2.5 py-0.5 rounded-full">
                  {city.shops}
                </span>
              </div>
              <p className="text-xs text-[#8A8178]">{city.hindi}</p>
              <p className="text-xs text-[#5A534D] border-t border-[#5B0E14]/10 pt-2 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#5B0E14] shrink-0" />
                <span className="truncate">{city.tag}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Box */}
      <section className="max-w-[1240px] mx-auto px-5 sm:px-8">
        <div className="bg-[#5B0E14] text-[#FFF9E8] rounded-[28px] p-8 sm:p-12 text-center space-y-6 relative overflow-hidden shadow-lg">
          <div className="max-w-xl mx-auto space-y-3 relative z-10">
            <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#FFF9E8]">
              {tr('Experience True Luxury Grooming Today', 'आज ही बेहतरीन ग्रूमिंग अनुभव प्राप्त करें')}
            </h3>
            <p className="text-sm text-[#FFF9E8]/80 leading-relaxed">
              {tr(
                'Book your appointment with a verified master craftsman in seconds. Zero wait time, upfront INR rates, and guaranteed chair readiness.',
                'कुछ ही सेकंड में अपनी अपॉइंटमेंट बुक करें। शून्य प्रतीक्षा समय, स्पष्ट दरें और समय की गारंटी।'
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 relative z-10">
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="px-8 py-3.5 rounded-[16px] neu-btn-gold text-xs font-bold tracking-wider uppercase cursor-pointer"
            >
              {tr('Book Appointment Now', 'अभी अपॉइंटमेंट बुक करें')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('contact-us')}
              className="px-6 py-3.5 rounded-[16px] bg-[#111113] text-[#FFF9E8] hover:bg-black text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              {tr('Contact Our Team', 'हमारी टीम से संपर्क करें')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
