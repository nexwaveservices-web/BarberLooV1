import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import { useLanguage } from '../lib/i18n';
import { apiCreateReport } from '../lib/api';
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  HelpCircle,
  Building,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface ContactUsPageProps {
  onNavigate: (page: PageView) => void;
  currentUserProfile?: any;
}

export const ContactUsPage: React.FC<ContactUsPageProps> = ({
  onNavigate,
  currentUserProfile,
}) => {
  const { tr } = useLanguage();

  const [name, setName] = useState(currentUserProfile?.name || '');
  const [email, setEmail] = useState(currentUserProfile?.email || '');
  const [phone, setPhone] = useState(currentUserProfile?.phone || '');
  const [subject, setSubject] = useState('Customer Support');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: tr('How do I cancel or reschedule my appointment?', 'मैं अपनी अपॉइंटमेंट कैसे रद्द या रीशेड्यूल करूँ?'),
      a: tr(
        'Go to your Customer Dashboard > My Bookings. You can reschedule for free up to 1 hour before your IST slot, or cancel for a 100% refund up to 2 hours in advance.',
        'कस्टमर डैशबोर्ड में मेरी बुकिंग पर जाएं। आप समय से 1 घंटे पहले तक मुफ्त रीशेड्यूल कर सकते हैं या 2 घंटे पहले तक 100% रिफंड के साथ रद्द कर सकते हैं।'
      ),
    },
    {
      q: tr('When should I share my 6-digit Completion OTP with the barber?', 'मुझे बार्बर को 6-अंकीय OTP कब देना चाहिए?'),
      a: tr(
        'Only share your 6-digit OTP AFTER your haircut or grooming service is completely finished to your satisfaction. The OTP authorizes release of your escrow payment to the barber.',
        'अपना 6-अंकीय OTP बार्बर के साथ केवल तभी साझा करें जब आपकी सेवा आपकी पूरी संतुष्टि के साथ संपन्न हो जाए। यह OTP बार्बर को भुगतान जारी करता है।'
      ),
    },
    {
      q: tr('What happens if the barber delays my appointment?', 'अगर बार्बर समय पर सेवा शुरू न करे तो क्या होगा?'),
      a: tr(
        'Under our 15-Minute Chair Guarantee, if service begins more than 15 minutes past your booked IST slot, you are eligible for an immediate 100% full refund plus a ₹100 platform compensation credit.',
        'हमारी 15-मिनट गारंटी के तहत, यदि 15 मिनट से अधिक देरी होती है, तो आप तुरंत 100% पूरा रिफंड और ₹100 का अतिरिक्त प्लेटफॉर्म क्रेडिट पाने के हकदार हैं।'
      ),
    },
    {
      q: tr('I am a barber or salon owner. How can I join BarberLoo?', 'मैं सैलून मालिक या बार्बर हूँ। बारबरलू से कैसे जुड़ूँ?'),
      a: tr(
        'We welcome verified grooming establishments across India. Select "Salon Partnership" in the contact form or email partners@barberloo.in. Our team inspects your facility and onboard you within 48 hours.',
        'हम भारत भर के गुणवत्तापूर्ण सैलून का स्वागत करते हैं। संपर्क फ़ॉर्म में "सैलून पार्टनरशिप" चुनें या partners@barberloo.in पर ईमेल करें। हमारी टीम 48 घंटों में संपर्क करेगी।'
      ),
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage(tr('Please fill in your name, email, and inquiry message.', 'कृपया अपना नाम, ईमेल और संदेश भरें।'));
      return;
    }

    setSubmitting(true);
    try {
      await apiCreateReport({
        reporterUid: currentUserProfile?.uid || 'guest-contact',
        reporterName: name.trim(),
        targetType: 'support_inquiry',
        targetId: email.trim(),
        targetLabel: `${subject} (${phone.trim() || 'No phone provided'})`,
        reason: subject,
        details: message.trim(),
      });
      setSubmitted(true);
      setMessage('');
    } catch {
      setErrorMessage(tr('Could not send message. Please email support@barberloo.in directly.', 'संदेश नहीं भेजा जा सका। कृपया support@barberloo.in पर ईमेल करें।'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#EFE9DD] min-h-screen text-[#111113] pb-24">
      {/* Top Hero Section */}
      <section className="bg-[#1C1718] text-[#FFF9E8] pt-14 pb-20 px-5 sm:px-8 border-b border-[#F1E194]/20 relative overflow-hidden">
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
            <span className="text-[#FFF9E8]">{tr('Contact Us', 'संपर्क करें')}</span>
          </div>

          <div className="max-w-2xl space-y-3 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full neu-dark-badge text-[#F1E194] text-[11px] font-bold uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5" />
              {tr('Always At Your Service', 'आपकी सेवा में सदैव तत्पर')}
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#FFF9E8]">
              {tr('We Are Here to Assist You', 'हम आपकी सहायता के लिए यहाँ हैं')}
            </h1>
            <p className="text-sm text-[#8A8178] leading-relaxed">
              {tr(
                'Whether you have questions about an appointment, need assistance with a refund, or wish to onboard your salon, our concierge team is at your disposal.',
                'चाहे अपॉइंटमेंट का प्रश्न हो, रिफंड में सहायता चाहिए हो, या सैलून पार्टनरशिप की बात हो, हमारी समर्पित टीम आपकी सेवा में है।'
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left 5 Cols: Contact Information & Cards */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 sm:p-8 space-y-6 shadow-sm">
              <h2 className="font-display text-xl font-bold text-[#111113] border-b border-[#5B0E14]/10 pb-3">
                {tr('Direct Support Channels', 'सीधे संपर्क माध्यम')}
              </h2>

              <div className="space-y-4 text-xs">
                {/* Email Channel */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-[12px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111113] uppercase tracking-wider">
                      {tr('Customer Support & Inquiries', 'ग्राहक सहायता एवं पूछताछ')}
                    </p>
                    <a
                      href="mailto:support@barberloo.in"
                      className="text-[#5B0E14] hover:underline font-semibold text-sm block mt-0.5"
                    >
                      support@barberloo.in
                    </a>
                    <p className="text-[#8A8178] mt-0.5">{tr('Average response within 2 hours', 'औसतन 2 घंटे में उत्तर')}</p>
                  </div>
                </div>

                {/* Partner Onboarding */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-[12px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center shrink-0">
                    <Building className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111113] uppercase tracking-wider">
                      {tr('Salon & Barber Partnerships', 'सैलून एवं बार्बर पार्टनरशिप')}
                    </p>
                    <a
                      href="mailto:partners@barberloo.in"
                      className="text-[#5B0E14] hover:underline font-semibold text-sm block mt-0.5"
                    >
                      partners@barberloo.in
                    </a>
                    <p className="text-[#8A8178] mt-0.5">{tr('Dedicated salon onboarding team', 'सैलून ऑनबोर्डिंग डेस्क')}</p>
                  </div>
                </div>

                {/* Phone Channel */}
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-[12px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111113] uppercase tracking-wider">
                      {tr('Customer Care & WhatsApp Desk', 'कस्टमर केयर एवं व्हाट्सएप')}
                    </p>
                    <a
                      href="tel:+919876543210"
                      className="text-[#5B0E14] hover:underline font-semibold text-sm block mt-0.5"
                    >
                      +91 98765 43210
                    </a>
                    <p className="text-[#8A8178] mt-0.5">{tr('Standard Operating Hours: 09:30 – 21:30 IST', 'समय: सुबह 09:30 – रात 09:30 IST')}</p>
                  </div>
                </div>

                {/* Grievance Officer */}
                <div className="flex items-start gap-3.5 pt-2 border-t border-[#5B0E14]/10">
                  <div className="w-9 h-9 rounded-[12px] bg-[#111113] text-[#F1E194] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-[#111113] uppercase tracking-wider">
                      {tr('Grievance Redressal Officer (DPDPA 2023)', 'शिकायत निवारण अधिकारी')}
                    </p>
                    <p className="text-[#5A534D] mt-0.5">
                      {tr('Officer: Mr. R. Sharma, Legal & Compliance', 'अधिकारी: श्री आर. शर्मा, विधि अनुभाग')}
                    </p>
                    <a
                      href="mailto:grievance@barberloo.in"
                      className="text-[#5B0E14] hover:underline font-semibold block mt-0.5"
                    >
                      grievance@barberloo.in
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Registered Offices */}
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 space-y-4 shadow-sm text-xs">
              <h3 className="font-display text-base font-bold text-[#111113] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#5B0E14]" />
                <span>{tr('Registered Offices', 'पंजीकृत कार्यालय')}</span>
              </h3>
              <div className="space-y-3 text-[#5A534D]">
                <div>
                  <p className="font-bold text-[#111113]">{tr('Bengaluru Headquarters:', 'बेंगलुरु मुख्यालय:')}</p>
                  <p>BarberLoo Technologies Pvt Ltd, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India.</p>
                </div>
                <div>
                  <p className="font-bold text-[#111113]">{tr('Mumbai Regional Desk:', 'मुंबई क्षेत्रीय कार्यालय:')}</p>
                  <p>Hill Road, Bandra West, Mumbai, Maharashtra 400050, India.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Interactive Contact Form & FAQ */}
          <div className="lg:col-span-7 space-y-8">
            {/* Form Card */}
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 sm:p-10 shadow-sm space-y-6">
              <div className="space-y-1">
                <h2 className="font-display text-2xl font-bold text-[#111113]">
                  {tr('Send Us a Message', 'हमें संदेश भेजें')}
                </h2>
                <p className="text-xs text-[#8A8178]">
                  {tr(
                    'We typically respond to inquiries within 2 to 4 business hours during standard IST operational windows.',
                    'हम मानक समय में 2 से 4 कार्य घंटों के भीतर उत्तर देते हैं।'
                  )}
                </p>
              </div>

              {submitted ? (
                <div className="p-6 rounded-[20px] bg-[#5B0E14]/8 border border-[#5B0E14]/20 space-y-3 text-center">
                  <CheckCircle2 className="w-10 h-10 text-[#5B0E14] mx-auto" />
                  <h3 className="font-display text-lg font-bold text-[#111113]">
                    {tr('Thank You! Message Received.', 'धन्यवाद! आपका संदेश प्राप्त हुआ।')}
                  </h3>
                  <p className="text-xs text-[#5A534D] max-w-md mx-auto leading-relaxed">
                    {tr(
                      'Your inquiry has been assigned to our customer support desk. A representative will contact you via email shortly.',
                      'आपकी पूछताछ सहायता डेस्क को सौंप दी गई है। एक प्रतिनिधि शीघ्र ही आपसे संपर्क करेगा।'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="px-5 py-2.5 rounded-[14px] neu-btn-burgundy text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {tr('Send Another Inquiry', 'दूसरा संदेश भेजें')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                  {errorMessage && (
                    <div className="p-3.5 rounded-[14px] bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-[#111113] uppercase tracking-wider block">
                        {tr('Full Name *', 'पूरा नाम *')}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Rahul Verma"
                        required
                        className="w-full px-4 py-3 rounded-[14px] neu-input text-xs text-[#111113] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-[#111113] uppercase tracking-wider block">
                        {tr('Email Address *', 'ईमेल पता *')}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. rahul@example.com"
                        required
                        className="w-full px-4 py-3 rounded-[14px] neu-input text-xs text-[#111113] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="font-bold text-[#111113] uppercase tracking-wider block">
                        {tr('Phone Number (Optional)', 'फ़ोन नंबर (वैकल्पिक)')}
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-4 py-3 rounded-[14px] neu-input text-xs text-[#111113] focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="font-bold text-[#111113] uppercase tracking-wider block">
                        {tr('Topic / Inquiry Subject *', 'विषय *')}
                      </label>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-4 py-3 rounded-[14px] neu-input text-xs text-[#111113] focus:outline-none bg-[#FAF6EA]"
                      >
                        <option value="Customer Support">{tr('Customer Support & Appointment', 'कस्टमर सपोर्ट और अपॉइंटमेंट')}</option>
                        <option value="Cancellation / Refund">{tr('Cancellation & Refund Help', 'रद्दीकरण एवं रिफंड सहायता')}</option>
                        <option value="Salon Partnership">{tr('Salon Partnership / Barber Onboarding', 'सैलून पार्टनरशिप ऑनबोर्डिंग')}</option>
                        <option value="Grievance / Feedback">{tr('Grievance Redressal / Feedback', 'शिकायत निवारण / सुझाव')}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-bold text-[#111113] uppercase tracking-wider block">
                      {tr('Your Message *', 'आपका संदेश *')}
                    </label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={tr(
                        'Describe your inquiry, booking reference number, or questions...',
                        'अपनी पूछताछ, बुकिंग संदर्भ संख्या या प्रश्न यहाँ लिखें...'
                      )}
                      required
                      className="w-full px-4 py-3 rounded-[14px] neu-input text-xs text-[#111113] focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-[16px] neu-btn-burgundy text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? tr('Sending Inquiry...', 'संदेश भेजा जा रहा है...') : tr('Submit Message', 'संदेश भेजें')}</span>
                  </button>
                </form>
              )}
            </div>

            {/* FAQ Accordion Section */}
            <div className="bg-[#FAF6EA] border border-[#5B0E14]/12 rounded-[24px] p-6 sm:p-8 space-y-5 shadow-sm">
              <div className="flex items-center gap-2 text-[#5B0E14]">
                <HelpCircle className="w-5 h-5 shrink-0" />
                <h3 className="font-display text-xl font-bold text-[#111113]">
                  {tr('Frequently Asked Questions', 'अक्सर पूछे जाने वाले प्रश्न (FAQ)')}
                </h3>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = openFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-[#5B0E14]/10 rounded-[16px] overflow-hidden bg-[#FAF2E2]"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaq(isOpen ? null : idx)}
                        className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-[#111113]">
                          {faq.q}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#5B0E14] shrink-0 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-xs text-[#5A534D] leading-relaxed border-t border-[#5B0E14]/8">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
