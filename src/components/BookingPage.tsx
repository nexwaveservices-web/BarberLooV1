import React, { useState, useMemo, useEffect } from 'react';
import {
  BarberItem,
  PageView,
  ServiceItem,
} from '../data/barberlooData';
import { SmartImage } from './SmartImage';
import {
  Check,
  Calendar,
  Clock,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Globe,
  Scissors,
  LogIn,
} from 'lucide-react';
import {
  useLanguage,
  getUpcomingISTDates,
  getCurrentISTDisplay,
  formatISTDateString,
  formatISTTimeSlot,
} from '../lib/i18n';

interface BookingPageProps {
  initialService: ServiceItem | null;
  initialBarber: BarberItem | null;
  onConfirmBooking: (appointmentPayload: any) => Promise<any>;
  onNavigate: (page: PageView) => void;
  shops?: any[];
  services?: any[];
  barbers?: any[];
  coupons?: any[];
  appointments?: any[];
  workingHours?: any[];
  currentUserProfile?: any | null;
  onOpenAuthModal?: () => void;
}

const TIME_SLOTS = {
  Morning: ['09:30', '10:15', '11:00', '11:45'],
  Afternoon: ['13:00', '14:15', '15:30', '16:15', '17:00'],
  Evening: ['18:00', '18:45', '19:30', '20:15'],
};

export const BookingPage: React.FC<BookingPageProps> = ({
  initialService,
  initialBarber,
  onConfirmBooking,
  onNavigate,
  shops = [],
  services = [],
  barbers = [],
  coupons = [],
  appointments = [],
  workingHours = [],
  currentUserProfile,
  onOpenAuthModal,
}) => {
  const {
    lang,
    tr,
    formatINR,
    getINRBreakdown,
    translateCategory,
    translateService,
  } = useLanguage();

  const istDates = useMemo(() => getUpcomingISTDates(6, lang), [lang]);
  const istNowDisplay = useMemo(() => getCurrentISTDisplay(lang), [lang]);

  const activeServices = services.filter((s: any) => s.active !== false);
  const activeBarbers = barbers.filter(
    (b: any) => b.active !== false && b.verificationStatus !== 'suspended'
  );

  const [selectedShopId, setSelectedShopId] = useState<string>(
    initialBarber?.shopId || initialService?.shopId || shops[0]?.id || ''
  );
  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<any | null>(
    initialService || activeServices[0] || null
  );
  const [selectedBarber, setSelectedBarber] = useState<any | null>(
    initialBarber || activeBarbers[0] || null
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    istDates[0]?.isoDate || new Date().toISOString().slice(0, 10)
  );
  const [selectedTime, setSelectedTime] = useState<string>('14:15');
  const [clientName, setClientName] = useState<string>(
    currentUserProfile?.name || ''
  );
  const [clientPhone, setClientPhone] = useState<string>(
    currentUserProfile?.phone || ''
  );
  const [clientNotes, setClientNotes] = useState<string>(
    currentUserProfile?.preferredNotes || ''
  );
  const [beverageChoice, setBeverageChoice] = useState<string>(
    'Coorg Single-Estate Filter Coffee (Complimentary)'
  );
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'pay_at_shop'>(
    'online'
  );
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [couponFeedback, setCouponFeedback] = useState<string>('');
  const [bookingError, setBookingError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingComplete, setBookingComplete] = useState<any | null>(null);

  useEffect(() => {
    if (!selectedService && activeServices.length > 0) {
      setSelectedService(activeServices[0]);
    }
  }, [activeServices, selectedService]);

  useEffect(() => {
    if (!selectedBarber && activeBarbers.length > 0) {
      setSelectedBarber(activeBarbers[0]);
    }
  }, [activeBarbers, selectedBarber]);

  useEffect(() => {
    if (currentUserProfile) {
      if (!clientName && currentUserProfile.name) {
        setClientName(currentUserProfile.name);
      }
      if (!clientPhone && currentUserProfile.phone) {
        setClientPhone(currentUserProfile.phone);
      }
    }
  }, [currentUserProfile, clientName, clientPhone]);

  const steps = [
    { num: 1, label: tr('Select Service', 'सेवा चुनें') },
    { num: 2, label: tr('Select Barber', 'बार्बर चुनें') },
    { num: 3, label: tr('Select Date (IST)', 'तारीख चुनें (IST)') },
    { num: 4, label: tr('Select Time (IST)', 'समय चुनें (IST)') },
    { num: 5, label: tr('Confirm Booking', 'बुकिंग की पुष्टि') },
  ];

  // If no services or barbers exist yet on the platform, show a clean startup state
  if (activeServices.length === 0 || activeBarbers.length === 0) {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-16 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-8 sm:p-10 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto">
            <Scissors className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
            {tr('BARBERLOO INDIA • LIVE BOOKING ENGINE', 'बारबरलू इंडिया • लाइव बुकिंग')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {tr(
              'No Services or Barbers Listed Yet',
              'अभी कोई सेवा या बार्बर सूचीबद्ध नहीं है'
            )}
          </h1>
          <p className="text-xs text-[#8A8178] leading-relaxed">
            {tr(
              'This platform uses 100% real partner data. Once a registered Barber Partner adds their salon, services (in ₹ INR), and barber profile in the Barber Console, live IST booking slots will appear here.',
              'यह प्लेटफ़ॉर्म 100% वास्तविक डेटा का उपयोग करता है। जब कोई पंजीकृत बार्बर पार्टनर अपनी दुकान और सेवाएं जोड़ेगा, तो यहां लाइव IST बुकिंग स्लॉट दिखाई देंगे।'
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            {currentUserProfile?.role === 'barber' ||
            currentUserProfile?.role === 'admin' ? (
              <button
                type="button"
                onClick={() => onNavigate('barber-dashboard')}
                className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
              >
                {tr(
                  'Open Barber Console to Add Services',
                  'सेवाएं जोड़ने के लिए बार्बर कंसोल खोलें'
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuthModal && onOpenAuthModal()}
                className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
              >
                {tr('Sign Up as a Barber Partner', 'बार्बर पार्टनर के रूप में जुड़ें')}
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="px-6 py-3.5 rounded-[16px] border border-[#F1E194]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              {tr('Back to Home', 'होम पर वापस जाएं')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shopFilteredServices =
    selectedShopId && activeServices.some((s: any) => s.shopId === selectedShopId)
      ? activeServices.filter((s: any) => s.shopId === selectedShopId)
      : activeServices;

  const shopFilteredBarbers =
    selectedShopId && activeBarbers.some((b: any) => b.shopId === selectedShopId)
      ? activeBarbers.filter((b: any) => b.shopId === selectedShopId)
      : activeBarbers;

  const currentService = selectedService || shopFilteredServices[0] || activeServices[0];
  const currentBarber = selectedBarber || shopFilteredBarbers[0] || activeBarbers[0];

  const selectedDaySchedule = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
      const dayName = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: 'Asia/Kolkata',
      }).format(dt);
      const matched = workingHours.find(
        (wh: any) =>
          String(wh.dayOfWeek || wh.day || '').toLowerCase() ===
            dayName.toLowerCase() &&
          (!wh.barberId || wh.barberId === currentBarber?.id || wh.barberId === 'brb-1')
      );
      return matched || null;
    } catch {
      return null;
    }
  }, [selectedDate, workingHours, currentBarber]);

  const isSlotOutsideSchedule = (timeStr: string): string | null => {
    if (selectedDaySchedule?.isDayOff) {
      return selectedDaySchedule.holidayNote || tr('Day Off', 'अवकाश');
    }
    const start = selectedDaySchedule?.startTime || '09:00';
    const end = selectedDaySchedule?.endTime || '21:30';
    const bStart = selectedDaySchedule?.breakStart || '';
    const bEnd = selectedDaySchedule?.breakEnd || '';
    if (timeStr < start || timeStr > end) {
      return tr('Closed', 'बंद');
    }
    if (bStart && bEnd && timeStr >= bStart && timeStr < bEnd) {
      return tr('Break', 'ब्रेक');
    }
    if (
      currentBarber?.chairBreakActive &&
      selectedDate === istDates[0]?.isoDate
    ) {
      return tr('On Break', 'चेयर ब्रेक');
    }
    return null;
  };

  const isSlotReserved = (timeStr: string) =>
    appointments.some(
      (a: any) =>
        a.barberId === currentBarber.id &&
        a.date === selectedDate &&
        a.time === timeStr &&
        a.status !== 'cancelled' &&
        a.status !== 'Cancelled' &&
        a.status !== 'no_show'
    );

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    const match = coupons.find(
      (c: any) => c.code === code && c.status === 'Active'
    );
    if (match) {
      if (Number(currentService.price) < Number(match.minSpend || 0)) {
        setCouponFeedback(
          tr(
            `Minimum spend of ${formatINR(match.minSpend)} required for ${match.code}.`,
            `${match.code} के लिए न्यूनतम ${formatINR(match.minSpend)} आवश्यक है।`
          )
        );
        return;
      }
      setAppliedDiscountPercent(Number(match.discountPercent));
      setAppliedCouponCode(match.code);
      setCouponFeedback(
        tr(
          `✓ ${match.code} applied (${match.discountPercent}% privilege)`,
          `✓ ${match.code} लागू (${match.discountPercent}% छूट)`
        )
      );
    } else {
      setAppliedDiscountPercent(0);
      setAppliedCouponCode('');
      setCouponFeedback(
        tr('Invalid or inactive coupon code.', 'अमान्य या निष्क्रिय कूपन कोड।')
      );
    }
  };

  const grossPrice = Number(currentService?.price || 0);
  const discountAmount = Math.round((grossPrice * appliedDiscountPercent) / 100);
  const inrBreakdown = getINRBreakdown(grossPrice, discountAmount);
  const finalPrice = inrBreakdown.finalPayable;

  const formattedSelectedDate = formatISTDateString(selectedDate, lang);
  const formattedSelectedSlot = formatISTTimeSlot(selectedTime, lang);

  const handleCompleteBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setBookingError('');

    if (!currentUserProfile) {
      if (onOpenAuthModal) onOpenAuthModal();
      setBookingError(
        tr(
          'Please sign in or create a Customer account to confirm your appointment.',
          'अपॉइंटमेंट बुक करने के लिए कृपया साइन इन करें।'
        )
      );
      return;
    }

    if (isSlotReserved(selectedTime) || isSlotOutsideSchedule(selectedTime)) {
      setBookingError(
        tr(
          `Slot ${selectedTime} IST on ${selectedDate} is unavailable or reserved for ${currentBarber.name}. Please choose another time.`,
          `${selectedDate} को ${selectedTime} IST स्लॉट ${currentBarber.name} के लिए उपलब्ध नहीं है।`
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        shopId: currentBarber.shopId || 'shop-1',
        shopName: currentBarber.shopName || 'BarberLoo Partner Salon',
        serviceId: currentService.id,
        serviceName: currentService.name,
        barberId: currentBarber.id,
        barberName: currentBarber.name,
        barberAvatar: currentBarber.avatar,
        date: selectedDate,
        time: selectedTime,
        durationMins: currentService.durationMins || currentService.durationMin || 45,
        durationMin: currentService.durationMins || currentService.durationMin || 45,
        price: finalPrice,
        clientName: clientName || currentUserProfile.name,
        clientPhone: clientPhone || currentUserProfile.phone || '+91',
        notes: `${clientNotes} | Beverage: ${beverageChoice}`,
        paymentMethod,
        couponCode: appliedCouponCode || undefined,
      };
      const created = await onConfirmBooking(payload);
      setBookingComplete(created || payload);
    } catch (err: any) {
      setBookingError(
        err?.message ||
          tr(
            'Unable to confirm reservation. Please choose another time slot.',
            'बुकिंग की पुष्टि नहीं हो सकी। कृपया दूसरा समय स्लॉट चुनें।'
          )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (bookingComplete) {
    return (
      <div className="min-h-[82vh] bg-[#FAF6EA] py-14 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-2xl w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/30 p-8 sm:p-12 shadow-2xl space-y-8">
          <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-[#F1E194] text-[#111113] flex items-center justify-center font-bold">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
                  {tr(
                    'RESERVATION CONFIRMED • IST',
                    'अपॉइंटमेंट कन्फर्म • भारतीय मानक समय'
                  )}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl font-bold">
                  {tr('Your Chair Is Reserved.', 'आपकी चेयर आरक्षित है।')}
                </h1>
              </div>
            </div>
            <span className="font-mono-num text-xs text-[#F1E194] bg-[#241719] px-3.5 py-2 rounded-[12px] border border-[#F1E194]/25">
              {bookingComplete.id || 'CONFIRMED'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#241719] rounded-[20px] p-6 border border-[#F1E194]/15">
            <div>
              <p className="text-xs text-[#8A8178]">
                {tr('Selected Service', 'चयनित सेवा')}
              </p>
              <p className="font-display text-xl font-bold text-[#FFF9E8] mt-1">
                {translateService(currentService.name)}
              </p>
              <p className="text-xs text-[#F1E194] mt-1">
                {currentService.durationMins || 45} {tr('mins', 'मिनट')} ·{' '}
                {inrBreakdown.formattedFinal}{' '}
                <span className="text-[#8A8178]">
                  ({tr('Incl. 18% GST', '18% GST सहित')})
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A8178]">
                {tr('Barber', 'बार्बर')}
              </p>
              <div className="flex items-center gap-3 mt-1.5">
                <SmartImage
                  src={currentBarber.avatar}
                  alt={currentBarber.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#F1E194]/40"
                />
                <div>
                  <p className="text-sm font-semibold text-[#FFF9E8]">
                    {currentBarber.name}
                  </p>
                  <p className="text-xs text-[#8A8178]">{currentBarber.role}</p>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-[#8A8178]">
                {tr('Date & Time (IST • UTC+5:30)', 'तारीख और समय (IST • UTC+5:30)')}
              </p>
              <p className="font-mono-num text-sm font-semibold text-[#FFF9E8] mt-1">
                {formattedSelectedDate} · {formattedSelectedSlot.time24} IST (
                {formattedSelectedSlot.time12})
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A8178]">
                {tr('Salon Location', 'सैलून स्थान')}
              </p>
              <p className="text-sm font-semibold text-[#FFF9E8] mt-1">
                {currentBarber.shopName}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('customer-dashboard')}
              className="flex-1 py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#FFF9E8] transition-colors cursor-pointer"
            >
              {tr('VIEW IN MY ACCOUNT', 'मेरे खाते में देखें')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="py-4 px-6 rounded-[18px] border border-[#F1E194]/25 text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
            >
              {tr('RETURN HOME', 'होम पर वापस जाएं')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EA] py-10 sm:py-14">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
        {/* Header & Multi-Step Progress Bar */}
        <div className="mb-9">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-1.5">
                {tr(
                  'ONLINE APPOINTMENT BOOKING • INDIA',
                  'ऑनलाइन अपॉइंटमेंट बुकिंग • भारत'
                )}
              </p>
              <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#111113]">
                {tr('Reserve Your Chair.', 'अपनी चेयर बुक करें।')}
              </h1>
            </div>

            {/* Clean IST Timezone & INR Pill */}
            <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-[16px] bg-[#E9D9B8]/60 border border-[#5B0E14]/15 text-xs">
              <Globe className="w-4 h-4 text-[#5B0E14] shrink-0" />
              <div>
                <p className="font-semibold text-[#111113]">
                  {istNowDisplay.shortBadge} · {istNowDisplay.timeStr}
                </p>
                <p className="text-[11px] text-[#8A8178]">
                  {tr(
                    'All slots in Indian Standard Time · INR (₹)',
                    'सभी स्लॉट भारतीय मानक समय (IST) और ₹ में हैं'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 5-Step Progress Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {steps.map((s) => {
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-3 p-3.5 rounded-[18px] border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#5B0E14] text-[#FFF9E8] border-[#5B0E14] shadow-md'
                      : isDone
                      ? 'bg-[#241719] text-[#F1E194] border-[#241719]'
                      : 'bg-[#E9D9B8]/45 text-[#8A8178] border-[#5B0E14]/12 hover:bg-[#E9D9B8]/80'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono-num font-bold shrink-0 ${
                      isActive
                        ? 'bg-[#F1E194] text-[#111113]'
                        : isDone
                        ? 'bg-[#F1E194]/20 text-[#F1E194]'
                        : 'bg-[#FAF6EA] text-[#111113]'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : `0${s.num}`}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider opacity-75">
                      {tr(`Step 0${s.num}`, `चरण 0${s.num}`)}
                    </p>
                    <p className="text-xs font-semibold truncate">{s.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main 2-Column Booking Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8">
            {/* STEP 1: SELECT SERVICE */}
            {step === 1 && (
              <div className="space-y-4">
                {shops.length > 1 && (
                  <div className="rounded-[18px] bg-[#E9D9B8]/45 border border-[#5B0E14]/15 p-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#5B0E14]">
                      {tr('Select Salon Location:', 'सैलून स्थान चुनें:')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedShopId('')}
                        className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                          !selectedShopId
                            ? 'bg-[#5B0E14] text-[#FFF9E8]'
                            : 'bg-[#FAF6EA] text-[#111113]'
                        }`}
                      >
                        {tr('All Salons', 'सभी सैलून')}
                      </button>
                      {shops.map((sh: any) => (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => setSelectedShopId(sh.id)}
                          className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                            selectedShopId === sh.id
                              ? 'bg-[#5B0E14] text-[#FFF9E8]'
                              : 'bg-[#FAF6EA] text-[#111113]'
                          }`}
                        >
                          {sh.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                    {tr(
                      '01. Choose Your Grooming Service',
                      '01. अपनी ग्रूमिंग सेवा चुनें'
                    )}
                  </h2>
                  <span className="text-xs text-[#8A8178]">
                    {shopFilteredServices.length} {tr('services available', 'सेवाएं उपलब्ध')}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {shopFilteredServices.map((srv: any) => {
                    const isSelected = currentService.id === srv.id;
                    return (
                      <div
                        key={srv.id}
                        onClick={() => setSelectedService(srv)}
                        className={`rounded-[22px] p-6 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-xl'
                            : 'bg-[#E9D9B8]/55 text-[#111113] border-[#5B0E14]/15 hover:border-[#5B0E14]/45'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span
                              className={`text-[11px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-[8px] ${
                                isSelected
                                  ? 'bg-[#5B0E14] text-[#F1E194]'
                                  : 'bg-[#FAF6EA] text-[#5B0E14]'
                              }`}
                            >
                              {translateCategory(srv.category)}
                            </span>
                            <span
                              className={`font-mono-num text-xs ${
                                isSelected ? 'text-[#F1E194]' : 'text-[#8A8178]'
                              }`}
                            >
                              {srv.durationMins || srv.durationMin || 45}{' '}
                              {tr('mins', 'मिनट')}
                            </span>
                          </div>

                          <h3 className="font-display text-2xl font-bold mb-2">
                            {translateService(srv.name)}
                          </h3>
                          <p
                            className={`text-xs leading-relaxed mb-5 ${
                              isSelected ? 'text-[#FFF9E8]/75' : 'text-[#241719]/80'
                            }`}
                          >
                            {srv.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-current/10">
                          <div>
                            <span
                              className={`font-mono-num text-2xl font-bold ${
                                isSelected ? 'text-[#F1E194]' : 'text-[#5B0E14]'
                              }`}
                            >
                              {formatINR(srv.price)}
                            </span>
                            <span className="block text-[10px] opacity-65">
                              {tr('Inclusive of 18% GST', '18% GST सहित')}
                            </span>
                          </div>
                          <span
                            className={`text-xs font-semibold px-3.5 py-1.5 rounded-[12px] ${
                              isSelected
                                ? 'bg-[#F1E194] text-[#111113]'
                                : 'bg-[#5B0E14] text-[#FFF9E8]'
                            }`}
                          >
                            {isSelected
                              ? tr('Selected ✓', 'चयनित ✓')
                              : tr('Select', 'चुनें')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-2 px-7 py-4 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
                  >
                    <span>
                      {tr('CONTINUE TO BARBER', 'बार्बर चुनने के लिए आगे बढ़ें')}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: SELECT BARBER */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                    {tr('02. Select Barber', '02. बार्बर चुनें')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-semibold text-[#5B0E14] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{tr('Back to Services', 'सेवाओं पर वापस जाएं')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {shopFilteredBarbers.map((brb: any) => {
                    const isSelected = currentBarber.id === brb.id;
                    return (
                      <div
                        key={brb.id}
                        onClick={() => setSelectedBarber(brb)}
                        className={`rounded-[22px] p-5 border transition-all cursor-pointer flex gap-4 items-center ${
                          isSelected
                            ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-xl'
                            : 'bg-[#E9D9B8]/55 text-[#111113] border-[#5B0E14]/15 hover:border-[#5B0E14]/45'
                        }`}
                      >
                        <SmartImage
                          src={brb.avatar}
                          alt={brb.name}
                          className="w-20 h-24 rounded-[16px] object-cover shrink-0 border border-[#F1E194]/30"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-[#F1E194] bg-[#111113] px-2.5 py-0.5 rounded-[8px]">
                              {brb.rating}★ ({brb.reviews || 0})
                            </span>
                            <span className="text-[11px] opacity-75">
                              {brb.experience}
                            </span>
                          </div>
                          <h3 className="font-display text-2xl font-bold mt-1.5 truncate">
                            {brb.name}
                          </h3>
                          <p
                            className={`text-xs truncate ${
                              isSelected ? 'text-[#F1E194]' : 'text-[#5B0E14]'
                            }`}
                          >
                            {brb.role}
                          </p>
                          <p className="text-[11px] opacity-75 mt-1 truncate">
                            {brb.specialty}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-4 rounded-[18px] border border-[#5B0E14]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                  >
                    {tr('BACK', 'पीछे')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-2 px-7 py-4 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
                  >
                    <span>{tr('SELECT DATE (IST)', 'तारीख चुनें (IST)')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: SELECT DATE (IST) */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                      {tr(
                        '03. Select Appointment Date (IST)',
                        '03. अपॉइंटमेंट की तारीख चुनें (IST)'
                      )}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-1">
                      {tr(
                        'Synchronized with Indian Standard Time (Asia/Kolkata • UTC+05:30)',
                        'भारतीय मानक समय (Asia/Kolkata • UTC+05:30) के अनुसार'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs font-semibold text-[#5B0E14] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{tr('Change Barber', 'बार्बर बदलें')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {istDates.map((d) => {
                    const isSelected = selectedDate === d.isoDate;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDate(d.isoDate)}
                        className={`p-5 rounded-[20px] border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-xl'
                            : 'bg-[#E9D9B8]/55 text-[#111113] border-[#5B0E14]/15 hover:border-[#5B0E14]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-[8px] ${
                              isSelected
                                ? 'bg-[#5B0E14] text-[#F1E194]'
                                : 'bg-[#FAF6EA] text-[#5B0E14]'
                            }`}
                          >
                            {d.label}
                          </span>
                          <Calendar className="w-4 h-4 opacity-60" />
                        </div>
                        <p className="font-display text-3xl font-bold mt-1">
                          {d.sub}
                        </p>
                        <p className="font-mono-num text-[11px] opacity-75 mt-1">
                          {d.isoDate} · IST
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="p-5 rounded-[20px] bg-[#E9D9B8]/40 border border-[#5B0E14]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#111113]">
                      {tr(
                        'Need a specific future date in IST?',
                        'क्या आपको भविष्य की कोई विशेष तारीख चाहिए?'
                      )}
                    </p>
                    <p className="text-[11px] text-[#8A8178]">
                      {tr(
                        'Pick any date from the Indian Standard Time calendar.',
                        'भारतीय मानक समय कैलेंडर से कोई भी तारीख चुनें।'
                      )}
                    </p>
                  </div>
                  <input
                    type="date"
                    min={istDates[0]?.isoDate}
                    value={selectedDate}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="px-4 py-2.5 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/25 text-xs font-mono-num font-semibold text-[#111113]"
                  />
                </div>

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-6 py-4 rounded-[18px] border border-[#5B0E14]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                  >
                    {tr('BACK', 'पीछे')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="inline-flex items-center gap-2 px-7 py-4 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
                  >
                    <span>
                      {tr('SELECT TIME SLOT (IST)', 'समय स्लॉट चुनें (IST)')}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: SELECT TIME (IST) */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                      {tr(
                        `04. Select Time Slot (${formattedSelectedDate})`,
                        `04. समय स्लॉट चुनें (${formattedSelectedDate})`
                      )}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-1">
                      {tr(
                        'Real-time double-booking protection enabled · Indian Standard Time (UTC+05:30)',
                        'डबल-बुकिंग सुरक्षा सक्रिय · भारतीय मानक समय (IST • UTC+05:30)'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-xs font-semibold text-[#5B0E14] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{tr('Change Date', 'तारीख बदलें')}</span>
                  </button>
                </div>

                {selectedDaySchedule?.isDayOff && (
                  <div className="p-4 rounded-[16px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#F1E194] shrink-0" />
                    <span>
                      {tr(
                        `${currentBarber.name} is off duty on ${selectedDaySchedule.dayOfWeek || selectedDaySchedule.day} (${selectedDaySchedule.holidayNote || 'Scheduled Day Off'}). Please choose another date.`,
                        `${currentBarber.name} इस दिन अवकाश पर हैं। कृपया दूसरी तारीख चुनें।`
                      )}
                    </span>
                  </div>
                )}

                {Object.entries(TIME_SLOTS).map(([period, slots]) => {
                  const sampleFormatted = formatISTTimeSlot(slots[0], lang);
                  return (
                    <div
                      key={period}
                      className="rounded-[20px] bg-[#E9D9B8]/45 p-5 border border-[#5B0E14]/12 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold tracking-wider uppercase text-[#5B0E14] flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{sampleFormatted.periodLabel}</span>
                        </p>
                        <span className="text-[11px] font-mono-num text-[#8A8178]">
                          Asia/Kolkata (IST)
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {slots.map((timeStr) => {
                          const reserved = isSlotReserved(timeStr);
                          const scheduleReason = isSlotOutsideSchedule(timeStr);
                          const unavailable = reserved || Boolean(scheduleReason);
                          const isSelected = selectedTime === timeStr && !unavailable;
                          const slotMeta = formatISTTimeSlot(timeStr, lang);
                          return (
                            <button
                              key={timeStr}
                              type="button"
                              disabled={unavailable}
                              onClick={() => setSelectedTime(timeStr)}
                              className={`py-3 px-3 rounded-[14px] text-center border transition-all ${
                                unavailable
                                  ? 'bg-[#111113]/10 border-[#8A8178]/20 text-[#8A8178] line-through cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-[#5B0E14] text-[#FFF9E8] border-[#5B0E14] shadow-md cursor-pointer'
                                  : 'bg-[#FAF6EA] text-[#111113] border-[#5B0E14]/15 hover:border-[#5B0E14] cursor-pointer'
                              }`}
                            >
                              <span className="block font-mono-num text-xs font-bold">
                                {slotMeta.time24} IST
                              </span>
                              <span className="block text-[10px] opacity-75 mt-0.5">
                                {reserved
                                  ? tr('Booked', 'बुक हो चुका')
                                  : scheduleReason
                                  ? scheduleReason
                                  : slotMeta.time12}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-4 flex justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-4 rounded-[18px] border border-[#5B0E14]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
                  >
                    {tr('BACK', 'पीछे')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(5)}
                    className="inline-flex items-center gap-2 px-7 py-4 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
                  >
                    <span>
                      {tr('REVIEW & CONFIRM', 'समीक्षा करें और पुष्टि करें')}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: CONFIRM BOOKING */}
            {step === 5 && (
              <form
                onSubmit={handleCompleteBooking}
                className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/20 p-6 sm:p-8 space-y-6"
              >
                <div className="flex items-center justify-between border-b border-[#5B0E14]/12 pb-4">
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                    {tr(
                      '05. Guest Details & Settlement',
                      '05. ग्राहक विवरण और भुगतान'
                    )}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="text-xs font-semibold text-[#5B0E14] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{tr('Change Time', 'समय बदलें')}</span>
                  </button>
                </div>

                {!currentUserProfile && (
                  <div className="p-4 rounded-[16px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#F1E194]">
                        {tr('Sign In Required to Book', 'बुक करने के लिए साइन इन आवश्यक है')}
                      </p>
                      <p className="text-[11px] text-[#8A8178]">
                        {tr(
                          'Please sign in or create a Customer account to confirm your appointment.',
                          'अपॉइंटमेंट कन्फर्म करने के लिए कृपया अपने ग्राहक खाते में साइन इन करें।'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAuthModal && onOpenAuthModal()}
                      className="px-4 py-2 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{tr('Sign In / Sign Up', 'साइन इन करें')}</span>
                    </button>
                  </div>
                )}

                {bookingError && (
                  <div className="p-4 rounded-[14px] bg-[#5B0E14] text-[#FFF9E8] text-xs flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#F1E194] shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                      {tr('Full Name', 'पूरा नाम')}
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder={tr('Your full name', 'अपना नाम लिखें')}
                      className="w-full px-4 py-3 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-sm text-[#111113]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                      {tr('Mobile Number (+91)', 'मोबाइल नंबर (+91)')}
                    </label>
                    <input
                      type="tel"
                      required
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+91 98XXXXXXXX"
                      className="w-full px-4 py-3 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-sm text-[#111113]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                      {tr('Complimentary Lounge Beverage', 'निःशुल्क लाउंज पेय')}
                    </label>
                    <select
                      value={beverageChoice}
                      onChange={(e) => setBeverageChoice(e.target.value)}
                      className="w-full px-4 py-3 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs font-medium text-[#111113]"
                    >
                      <option value="Coorg Single-Estate Filter Coffee (Complimentary)">
                        {tr(
                          'Coorg Single-Estate Filter Coffee (Complimentary)',
                          'कूर्ग सिंगल-एस्टेट फ़िल्टर कॉफ़ी (निःशुल्क)'
                        )}
                      </option>
                      <option value="Royal Kashmiri Kahwa Tea (Complimentary)">
                        {tr(
                          'Royal Kashmiri Kahwa Tea (Complimentary)',
                          'रॉयल कश्मीरी कहवा चाय (निःशुल्क)'
                        )}
                      </option>
                      <option value="Artisanal Masala Chai & Sparkling Water (Complimentary)">
                        {tr(
                          'Artisanal Masala Chai & Sparkling Water (Complimentary)',
                          'पारंपरिक मसाला चाय और स्पार्कलिंग वाटर (निःशुल्क)'
                        )}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                      {tr('Settlement Preference (INR)', 'भुगतान का तरीका (₹ INR)')}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('online')}
                        className={`py-3 px-3 rounded-[14px] text-xs font-semibold border cursor-pointer ${
                          paymentMethod === 'online'
                            ? 'bg-[#241719] text-[#F1E194] border-[#241719]'
                            : 'bg-[#FAF6EA] text-[#111113] border-[#5B0E14]/20'
                        }`}
                      >
                        {tr('UPI / Card Now', 'UPI / कार्ड पेमेंट')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('pay_at_shop')}
                        className={`py-3 px-3 rounded-[14px] text-xs font-semibold border cursor-pointer ${
                          paymentMethod === 'pay_at_shop'
                            ? 'bg-[#241719] text-[#F1E194] border-[#241719]'
                            : 'bg-[#FAF6EA] text-[#111113] border-[#5B0E14]/20'
                        }`}
                      >
                        {tr('Pay at Salon', 'सैलून पर भुगतान करें')}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                    {tr('Styling Notes (Optional)', 'स्टाइलिंग निर्देश (वैकल्पिक)')}
                  </label>
                  <textarea
                    rows={2}
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder={tr(
                      'Any specific haircut or beard instructions...',
                      'हेयरकट या बियर्ड के लिए कोई विशेष निर्देश...'
                    )}
                    className="w-full px-4 py-3 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                  />
                </div>

                {coupons.length > 0 && (
                  <div className="pt-2 border-t border-[#5B0E14]/15">
                    <label className="block text-xs font-semibold text-[#241719] mb-1.5">
                      {tr('Promo / Coupon Code', 'प्रोमो / कूपन कोड')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        placeholder={tr('Enter coupon code', 'कूपन कोड दर्ज करें')}
                        className="flex-1 px-4 py-2.5 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs uppercase font-mono-num"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="px-5 py-2.5 rounded-[14px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                      >
                        {tr('Apply', 'लागू करें')}
                      </button>
                    </div>
                    {couponFeedback && (
                      <p className="text-xs text-[#5B0E14] font-medium mt-1.5">
                        {couponFeedback}
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.16em] uppercase hover:bg-[#241719] transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <Sparkles className="w-4 h-4 text-[#F1E194]" />
                  <span>
                    {isSubmitting
                      ? tr('RESERVING CHAIR...', 'चेयर आरक्षित हो रही है...')
                      : tr(
                          `CONFIRM BOOKING • ${inrBreakdown.formattedFinal}`,
                          `बुकिंग कन्फर्म करें • ${inrBreakdown.formattedFinal}`
                        )}
                  </span>
                </button>
              </form>
            )}
          </div>

          {/* Right Live Booking Summary Card with Locale INR + GST Breakdown */}
          <div className="lg:col-span-4">
            <div className="sticky top-28 rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-6 sm:p-7 space-y-6 shadow-2xl">
              <div className="border-b border-[#F1E194]/15 pb-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
                    {tr('BOOKING DOSSIER', 'बुकिंग सारांश')}
                  </p>
                  <h3 className="font-display text-2xl font-bold mt-1">
                    {currentBarber.shopName}
                  </h3>
                </div>
                <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-[10px] bg-[#241719] text-[#F1E194] border border-[#F1E194]/20">
                  INR (₹)
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-[#8A8178]">
                    {tr('Service', 'चयनित सेवा')}
                  </span>
                  <span className="font-semibold text-right text-[#FFF9E8]">
                    {translateService(currentService.name)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#8A8178]">
                    {tr('Barber', 'बार्बर')}
                  </span>
                  <span className="font-semibold text-right text-[#F1E194]">
                    {currentBarber.name}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#8A8178]">
                    {tr('Date (IST)', 'तारीख (IST)')}
                  </span>
                  <span className="font-mono-num font-semibold text-[#FFF9E8]">
                    {formattedSelectedDate}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#8A8178]">
                    {tr('Time (IST • UTC+5:30)', 'समय (IST • UTC+5:30)')}
                  </span>
                  <span className="font-mono-num font-semibold text-[#FFF9E8]">
                    {formattedSelectedSlot.time24} IST ({formattedSelectedSlot.time12})
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[#8A8178]">
                    {tr('Duration', 'अवधि')}
                  </span>
                  <span className="font-mono-num text-[#FFF9E8]">
                    {currentService.durationMins || 45} {tr('mins', 'मिनट')}
                  </span>
                </div>
              </div>

              {/* Indian Locale Pricing & GST Breakdown */}
              <div className="pt-4 border-t border-[#F1E194]/15 space-y-2">
                <div className="flex justify-between text-xs text-[#8A8178]">
                  <span>{tr('Service Tariff (MRP)', 'सेवा शुल्क (MRP)')}</span>
                  <span className="font-mono-num">{inrBreakdown.formattedGross}</span>
                </div>

                {appliedDiscountPercent > 0 && (
                  <div className="flex justify-between text-xs text-[#F1E194]">
                    <span>
                      {tr('Privilege Discount', 'विशेष छूट')} ({appliedCouponCode} ·{' '}
                      {appliedDiscountPercent}%)
                    </span>
                    <span className="font-mono-num">
                      -{inrBreakdown.formattedDiscount}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-[11px] text-[#8A8178]/85 pt-1">
                  <span>{tr('Taxable Base Value', 'कर योग्य मूल राशि')}</span>
                  <span className="font-mono-num">{inrBreakdown.formattedBase}</span>
                </div>
                <div className="flex justify-between text-[11px] text-[#8A8178]/85">
                  <span>CGST (9%) + SGST (9%)</span>
                  <span className="font-mono-num">
                    {inrBreakdown.formattedCgst} + {inrBreakdown.formattedSgst}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-3 border-t border-[#F1E194]/15">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8A8178]">
                      {tr('Total Payable (INR)', 'कुल देय राशि (INR)')}
                    </span>
                    <span className="block text-[10px] text-[#8A8178]">
                      {tr('Inclusive of 18% GST', '18% GST सहित')}
                    </span>
                  </div>
                  <span className="font-mono-num text-3xl font-bold text-[#F1E194]">
                    {inrBreakdown.formattedFinal}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
