import React, { useState, useMemo, useEffect } from 'react';
import {
  BarberItem,
  PageView,
  ServiceItem,
  ShopItem,
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
  Scissors,
  Zap,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Globe,
  LogIn,
} from 'lucide-react';
import {
  useLanguage,
  getUpcomingISTDates,
  getCurrentISTDisplay,
  formatISTDateString,
  formatISTTimeSlot,
} from '../lib/i18n';
import { initiateRazorpayPayment } from '../lib/razorpay';
import { loadShopForBooking, parseShopIdFromUrl } from '../lib/booking';

interface BookingPageProps {
  initialService: ServiceItem | null;
  initialBarber: BarberItem | null;
  initialShop?: ShopItem | null;
  initialShopId?: string;
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
  initialShop,
  initialShopId,
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

  // Determine shop ID strictly from URL query parameter (as required by specification)
  // or fall back to explicitly selected shop context if passed
  const urlShopId = parseShopIdFromUrl();
  const detectedShopId = urlShopId || initialShopId || initialShop?.id || '';

  const [selectedShopId, setSelectedShopId] = useState<string>(detectedShopId);
  const [loadedShop, setLoadedShop] = useState<any | null>(() => {
    if (!detectedShopId) return null;
    return (
      (initialShop && initialShop.id === detectedShopId ? initialShop : null) ||
      shops.find((s: any) => s.id === detectedShopId) ||
      null
    );
  });
  const [shopServices, setShopServices] = useState<any[]>(() => {
    if (detectedShopId) {
      return services.filter(
        (s: any) => s.shopId === detectedShopId && s.active !== false
      );
    }
    return [];
  });
  const [shopBarbers, setShopBarbers] = useState<any[]>(() => {
    if (detectedShopId) {
      return barbers.filter(
        (b: any) =>
          b.shopId === detectedShopId &&
          b.active !== false &&
          b.verificationStatus !== 'suspended'
      );
    }
    return [];
  });
  const [shopLoading, setShopLoading] = useState<boolean>(Boolean(detectedShopId));
  const [shopError, setShopError] = useState<
    'missing_shop' | 'shop_not_found' | 'no_services' | null
  >(!detectedShopId ? 'missing_shop' : null);

  const [step, setStep] = useState<number>(1);
  const [selectedService, setSelectedService] = useState<any | null>(initialService || null);
  const [selectedBarber, setSelectedBarber] = useState<any | null>(initialBarber || null);
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
  const [paymentMethod, setPaymentMethod] = useState<
    'razorpay' | 'pay_at_shop'
  >('razorpay');
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [couponFeedback, setCouponFeedback] = useState<string>('');
  const [bookingError, setBookingError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingComplete, setBookingComplete] = useState<any | null>(null);

  // Sync shop ID if URL or prop changes
  useEffect(() => {
    const fromUrl = parseShopIdFromUrl();
    const candidate = fromUrl || initialShopId || initialShop?.id || '';
    if (candidate !== selectedShopId) {
      setSelectedShopId(candidate);
    }
  }, [initialShopId, initialShop]);

  // Load shop, services, and barbers strictly from Supabase for this shop_id
  useEffect(() => {
    let isCancelled = false;
    const fetchScopedData = async () => {
      if (!selectedShopId) {
        setShopLoading(false);
        setShopError('missing_shop');
        return;
      }

      setShopLoading(true);
      try {
        const result = await loadShopForBooking(
          selectedShopId,
          shops,
          services,
          barbers
        );
        if (isCancelled) return;

        setLoadedShop(result.shop);
        setShopServices(result.services);
        setShopBarbers(result.barbers);
        setShopError(result.error);

        // Sync selected service if valid
        if (result.services.length > 0) {
          setSelectedService((prev: any) => {
            if (prev && result.services.some((s) => s.id === prev.id)) {
              return prev;
            }
            if (initialService && result.services.some((s) => s.id === initialService.id)) {
              return initialService;
            }
            return result.services[0];
          });
        } else {
          setSelectedService(null);
        }

        // Sync selected barber or assign salon master barber
        if (result.barbers.length > 0) {
          setSelectedBarber((prev: any) => {
            if (prev && result.barbers.some((b) => b.id === prev.id)) {
              return prev;
            }
            if (initialBarber && result.barbers.some((b) => b.id === initialBarber.id)) {
              return initialBarber;
            }
            return result.barbers[0];
          });
        }
      } catch (err) {
        console.warn('[BarberLoo] Error during booking initialization:', err);
        if (!isCancelled) {
          setShopError('shop_not_found');
        }
      } finally {
        if (!isCancelled) {
          setShopLoading(false);
        }
      }
    };

    fetchScopedData();
    return () => {
      isCancelled = true;
    };
  }, [selectedShopId, shops, services, barbers, initialService, initialBarber]);

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

  const currentShop =
    loadedShop || shops.find((s: any) => s.id === selectedShopId) || null;

  // Active services strictly scoped to the selected shop
  const shopFilteredServices = shopServices;

  // Default on-duty master barber if the shop hasn't added individual barber profiles yet
  const defaultOnDutyBarber: BarberItem = useMemo(() => {
    return {
      id: `brb-${currentShop?.id || selectedShopId || 'master'}`,
      userUid: '',
      shopId: currentShop?.id || selectedShopId || '',
      shopName: currentShop?.name || 'Partner Salon',
      name: `${currentShop?.name || 'Salon'} Master Barber`,
      role: 'Salon Master Stylist (On-Duty Team)',
      rating: parseFloat(currentShop?.rating) || 5.0,
      reviews: currentShop?.reviewCount || 10,
      experience: '5+ yrs',
      experienceYears: 5,
      specialty: 'All Hair & Beard Treatments',
      nextAvailable: 'Today · IST',
      priceFrom: Number(shopFilteredServices[0]?.price || 120),
      image: currentShop?.image || '/src/assets/images/hero_barber_craft_1790869666069.jpg',
      avatar: currentShop?.image || '/src/assets/images/hero_barber_craft_1790869666069.jpg',
      bio: `Dedicated master grooming team at ${currentShop?.name || 'this salon'}.`,
      featured: true,
      active: true,
      verified: true,
      verificationStatus: 'verified',
      chairBreakActive: false,
      assignedServiceIds: '',
    };
  }, [currentShop, selectedShopId, shopFilteredServices]);

  const shopFilteredBarbers =
    shopBarbers.length > 0 ? shopBarbers : [defaultOnDutyBarber];

  const currentService =
    selectedService || shopFilteredServices[0] || null;
  const currentBarber =
    selectedBarber || shopFilteredBarbers[0] || defaultOnDutyBarber;

  const steps = [
    { num: 1, label: tr('Select Service', 'सेवा चुनें') },
    { num: 2, label: tr('Select Barber', 'बार्बर चुनें') },
    { num: 3, label: tr('Select Date (IST)', 'तारीख चुनें (IST)') },
    { num: 4, label: tr('Select Time (IST)', 'समय चुनें (IST)') },
    { num: 5, label: tr('Confirm Booking', 'बुकिंग की पुष्टि') },
  ];

  // CASE A: shop_id is missing
  if (!selectedShopId || shopError === 'missing_shop') {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-16 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-8 sm:p-10 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto">
            <Scissors className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
            {tr('BARBERLOO INDIA • SALON SELECTION', 'बारबरलू इंडिया • सैलून चयन')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {tr('No Barber Shop Selected', 'कोई सैलून चयनित नहीं है')}
          </h1>
          <p className="text-xs text-[#8A8178] leading-relaxed">
            {tr(
              'No shop was selected. Please choose a partner salon to view services and book an appointment.',
              'कोई सैलून चयनित नहीं है। सेवाएं देखने और अपनी अपॉइंटमेंट बुक करने के लिए कृपया एक सैलून चुनें।'
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              {tr('Explore Partner Salons', 'पार्टनर सैलून देखें')}
            </button>
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

  // CASE B: shop_id is invalid or shop doesn't exist
  if (shopError === 'shop_not_found') {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-16 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-8 sm:p-10 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
            {tr('BARBERLOO INDIA • VERIFIED DIRECTORY', 'बारबरलू इंडिया • सत्यापित डायरेक्टरी')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {tr('Shop Not Found', 'सैलून नहीं मिला')}
          </h1>
          <p className="text-xs text-[#8A8178] leading-relaxed">
            {tr(
              "We couldn't find this shop. It may have been moved or the booking link is invalid.",
              'हम इस सैलून को ढूंढ नहीं सके। कृपया हमारे अन्य सत्यापित सैलून में से चुनें।'
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              {tr('Explore Available Salons', 'उपलब्ध सैलून देखें')}
            </button>
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

  // CASE C: shop exists but services = 0
  if (!shopLoading && (shopError === 'no_services' || shopFilteredServices.length === 0)) {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-16 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-xl w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-8 sm:p-10 text-center space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto">
            <Scissors className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
            {currentShop?.name || tr('SALON MENU', 'सैलून मेनू')}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold">
            {tr(
              "This shop hasn't added any services yet.",
              'इस दुकान ने अभी तक कोई सेवा नहीं जोड़ी है।'
            )}
          </h1>
          <p className="text-xs text-[#8A8178] leading-relaxed">
            {tr(
              'This salon is registered on BarberLoo, but has not published active services yet. Please choose another partner salon.',
              'यह सैलून पंजीकृत है लेकिन अभी तक सेवाएं प्रकाशित नहीं की हैं। कृपया कोई अन्य सैलून चुनें।'
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              {tr('Explore Other Salons', 'अन्य सैलून देखें')}
            </button>
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

  // Loading indicator while scoped shop services are being retrieved
  if (shopLoading && shopFilteredServices.length === 0) {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-16 px-5 sm:px-8 flex items-center justify-center">
        <div className="max-w-md w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-8 text-center space-y-4 shadow-2xl">
          <RefreshCw className="w-8 h-8 text-[#F1E194] animate-spin mx-auto" />
          <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
            {tr('Loading Salon Services...', 'सैलून सेवाएं लोड हो रही हैं...')}
          </h2>
          <p className="text-xs text-[#8A8178]">
            {tr(
              'Connecting to Supabase for verified menu & IST chair availability.',
              'सत्यापित मेनू और IST उपलब्धता लोड की जा रही है।'
            )}
          </p>
        </div>
      </div>
    );
  }



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

  const baseServiceDuration = Number(
    currentService?.durationMins || currentService?.durationMin || 45
  );
  const totalAppointmentDuration = baseServiceDuration;

  const basePrice = Number(currentService?.price || 0);
  const grossPrice = basePrice;
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

    const fullBookingNotes = clientNotes ? clientNotes.trim() : '';

    if (paymentMethod === 'razorpay') {
      setIsSubmitting(true);
      setBookingError('');
      try {
        await initiateRazorpayPayment({
          amountINR: finalPrice,
          serviceName: currentService.name,
          barberName: currentBarber.name,
          shopName: currentShop?.name || currentBarber.shopName || 'BarberLoo Partner Salon',
          clientName: clientName || currentUserProfile?.name || 'Guest',
          clientPhone: clientPhone || currentUserProfile?.phone || '+91',
          clientEmail: currentUserProfile?.email || 'guest@barberloo.in',
          appointmentId: `apt-${Date.now().toString(36)}`,
          onSuccess: async (rzpResult) => {
            try {
              const payload = {
                shopId: currentShop?.id || selectedShopId || currentBarber.shopId || 'shop-1',
                shopName: currentShop?.name || currentBarber.shopName || 'BarberLoo Partner Salon',
                serviceId: currentService.id,
                serviceName: currentService.name,
                barberId: currentBarber.id,
                barberName: currentBarber.name,
                barberAvatar: currentBarber.avatar,
                date: selectedDate,
                time: selectedTime,
                durationMins: totalAppointmentDuration,
                durationMin: totalAppointmentDuration,
                price: finalPrice,
                clientName: clientName || currentUserProfile?.name,
                clientPhone: clientPhone || currentUserProfile?.phone || '+91',
                notes: fullBookingNotes,
                paymentMethod: 'razorpay',
                razorpayPaymentId: rzpResult.razorpay_payment_id,
                razorpayOrderId: rzpResult.razorpay_order_id,
                couponCode: appliedCouponCode || undefined,
              };
              const created = await onConfirmBooking(payload);
              setBookingComplete({
                ...(created || payload),
                razorpayPaymentId: rzpResult.razorpay_payment_id,
                paymentMethod: 'razorpay',
              });
            } catch (err: any) {
              setBookingError(
                err?.message || 'Error saving appointment after Razorpay payment.'
              );
            } finally {
              setIsSubmitting(false);
            }
          },
          onError: (err) => {
            setIsSubmitting(false);
            setBookingError(
              err?.description ||
                err?.message ||
                tr(
                  'Razorpay authorization was not completed. Please retry or choose another payment method.',
                  'रेज़रपे भुगतान पूरा नहीं हुआ। कृपया पुनः प्रयास करें या अन्य तरीका चुनें।'
                )
            );
          },
          onDismiss: () => {
            setIsSubmitting(false);
          },
        });
      } catch (err: any) {
        setIsSubmitting(false);
        setBookingError(err?.message || 'Failed to initialize Razorpay checkout.');
      }
      return;
    }

    // Default: Pay at salon
    setIsSubmitting(true);
    try {
      const payload = {
        shopId: currentShop?.id || selectedShopId || currentBarber.shopId || 'shop-1',
        shopName: currentShop?.name || currentBarber.shopName || 'BarberLoo Partner Salon',
        serviceId: currentService.id,
        serviceName: currentService.name,
        barberId: currentBarber.id,
        barberName: currentBarber.name,
        barberAvatar: currentBarber.avatar,
        date: selectedDate,
        time: selectedTime,
        durationMins: totalAppointmentDuration,
        durationMin: totalAppointmentDuration,
        price: finalPrice,
        clientName: clientName || currentUserProfile?.name,
        clientPhone: clientPhone || currentUserProfile?.phone || '+91',
        notes: fullBookingNotes,
        paymentMethod: 'pay_at_shop',
        couponCode: appliedCouponCode || undefined,
      };
      const created = await onConfirmBooking(payload);
      setBookingComplete({
        ...(created || payload),
        paymentMethod: 'pay_at_shop',
      });
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

            {/* Payment & Gateway Settlement Metadata */}
            <div className="sm:col-span-2 pt-3 border-t border-[#F1E194]/15">
              <p className="text-[11px] uppercase tracking-wider text-[#8A8178]">
                {tr('Payment Settlement & Verification', 'भुगतान निपटान और सत्यापन')}
              </p>
              {bookingComplete.paymentMethod === 'razorpay' ? (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 p-3 rounded-[12px] bg-emerald-950/60 border border-emerald-500/30">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-200">
                        {tr('Paid via Razorpay (UPI / Card)', 'रेज़रपे द्वारा भुगतान सफल')}
                      </p>
                      <p className="text-[10px] text-emerald-300/80 font-mono-num">
                        {bookingComplete.razorpayPaymentId
                          ? `Txn: ${bookingComplete.razorpayPaymentId}`
                          : 'Payment Authorized'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-800 text-emerald-100">
                    PAID • VERIFIED
                  </span>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2 p-3 rounded-[12px] bg-[#111113] border border-[#F1E194]/15">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#F1E194]" />
                    <p className="text-xs font-medium text-[#FFF9E8]">
                      {tr(
                        'Pay at Salon (Cash, Card or UPI after haircut)',
                        'सैलून पर भुगतान (हेयरकट के बाद नकद, कार्ड या UPI)'
                      )}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                    PAY IN-STORE
                  </span>
                </div>
              )}
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
                <div className="rounded-[18px] bg-[#E9D9B8]/45 border border-[#5B0E14]/15 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#5B0E14] text-[#F1E194] flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#111113]">
                        {currentShop?.name || 'Selected Partner Salon'}
                      </p>
                      <p className="text-[11px] text-[#8A8178]">
                        {currentShop?.address
                          ? `${currentShop.address}, ${currentShop.city || currentShop.district}`
                          : currentShop?.city || currentShop?.district || 'India'}
                      </p>
                    </div>
                  </div>
                  {shops.length > 1 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] uppercase font-semibold text-[#8A8178]">
                        {tr('Switch Salon:', 'सैलून बदलें:')}
                      </span>
                      {shops.map((sh: any) => (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => {
                            setSelectedShopId(sh.id);
                            window.history.pushState(
                              {},
                              '',
                              `booking.html?shop_id=${encodeURIComponent(sh.id)}`
                            );
                          }}
                          className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer transition-all ${
                            selectedShopId === sh.id
                              ? 'bg-[#5B0E14] text-[#FFF9E8]'
                              : 'bg-[#FAF6EA] text-[#111113] hover:bg-[#E9D9B8]'
                          }`}
                        >
                          {sh.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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

                {shopBarbers.length === 0 && (
                  <div className="p-4 rounded-[18px] bg-[#111113] border border-[#F1E194]/30 text-[#FFF9E8] space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#F1E194]" />
                      <span className="text-xs font-bold text-[#F1E194]">
                        {tr(
                          'Services Available • On-Duty Salon Team',
                          'सेवाएं उपलब्ध • ऑन-ड्यूटी सैलून टीम'
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-[#8A8178] leading-relaxed">
                      {tr(
                        "Services are available, but this shop hasn't added individual barber profiles yet. Your appointment will be reserved with the salon's verified on-duty master barber.",
                        'सेवाएं उपलब्ध हैं, लेकिन इस दुकान ने अभी तक अलग-अलग बार्बर प्रोफ़ाइल नहीं जोड़ी हैं। आपकी बुकिंग सैलून के ऑन-ड्यूटी मास्टर बार्बर के साथ आरक्षित होगी।'
                      )}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {shopFilteredBarbers.map((brb: any) => {
                    const isSelected = currentBarber?.id === brb.id;
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
                        {tr(
                          'Create your free BarberLoo account to book this appointment.',
                          'इस अपॉइंटमेंट को बुक करने के लिए अपना मुफ़्त बारबरलू खाता बनाएं।'
                        )}
                      </p>
                      <p className="text-[11px] text-[#8A8178]">
                        {tr(
                          'Sign in to confirm your chair reservation and receive instant IST confirmation.',
                          'अपनी चेयर की पुष्टि और तुरंत IST कन्फर्मेशन पाने के लिए साइन इन करें।'
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onOpenAuthModal && onOpenAuthModal()}
                        className="px-4 py-2 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>{tr('LOGIN', 'साइन इन')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenAuthModal && onOpenAuthModal()}
                        className="px-4 py-2 rounded-[12px] border border-[#F1E194]/40 text-[#F1E194] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#F1E194]/10"
                      >
                        <span>{tr('CREATE ACCOUNT', 'खाता बनाएं')}</span>
                      </button>
                    </div>
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

                {/* Settlement Preference (Razorpay + Pay at Salon) */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-[#241719] mb-2 flex items-center justify-between">
                    <span>
                      {tr(
                        'Settlement Preference & Payment Method',
                        'भुगतान का तरीका'
                      )}
                    </span>
                    <span className="text-[10px] text-[#8A8178] font-normal">
                      {tr('Secured by 256-bit SSL', '256-बिट SSL सुरक्षित')}
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Razorpay Instant */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('razorpay')}
                      className={`p-4 rounded-[16px] border text-left cursor-pointer transition-all ${
                        paymentMethod === 'razorpay'
                          ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-md ring-1 ring-[#F1E194]/40'
                          : 'bg-[#FAF6EA] text-[#111113] border-[#5B0E14]/20 hover:border-[#5B0E14]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F1E194]">
                          <Zap className="w-3.5 h-3.5 fill-[#F1E194]" />
                          <span>Razorpay</span>
                        </span>
                        <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          Instant
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold">
                        {tr('UPI / Cards / NetBanking', 'UPI / कार्ड / नेटबैंकिंग')}
                      </p>
                      <p className="text-[10px] text-[#8A8178] mt-0.5 leading-tight">
                        {tr(
                          'GPay, PhonePe, Paytm, Visa, RuPay',
                          'GPay, PhonePe, कार्ड्स'
                        )}
                      </p>
                    </button>

                    {/* 2. Pay at Salon */}
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pay_at_shop')}
                      className={`p-4 rounded-[16px] border text-left cursor-pointer transition-all ${
                        paymentMethod === 'pay_at_shop'
                          ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-md ring-1 ring-[#F1E194]/40'
                          : 'bg-[#FAF6EA] text-[#111113] border-[#5B0E14]/20 hover:border-[#5B0E14]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F1E194]">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Salon Counter</span>
                        </span>
                        <span className="text-[9px] uppercase font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/30">
                          Post-Cut
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold">
                        {tr('Pay at Salon (Post-Cut)', 'सैलून पर भुगतान')}
                      </p>
                      <p className="text-[10px] text-[#8A8178] mt-0.5 leading-tight">
                        {tr(
                          'Cash or UPI after service completion',
                          'सेवा के बाद नकद या UPI'
                        )}
                      </p>
                    </button>
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
                      ? tr('PROCESSING RESERVATION...', 'प्रक्रिया जारी है...')
                      : paymentMethod === 'razorpay'
                      ? tr(
                          `PAY WITH RAZORPAY • ${inrBreakdown.formattedFinal}`,
                          `रेज़रपे से भुगतान करें • ${inrBreakdown.formattedFinal}`
                        )
                      : tr(
                          `RESERVE CHAIR (PAY AT SALON) • ${inrBreakdown.formattedFinal}`,
                          `चेयर आरक्षित करें (सैलून पर भुगतान) • ${inrBreakdown.formattedFinal}`
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
                    {totalAppointmentDuration} {tr('mins', 'मिनट')}
                  </span>
                </div>
              </div>

              {/* Indian Locale Pricing & GST Breakdown */}
              <div className="pt-4 border-t border-[#F1E194]/15 space-y-2">
                <div className="flex justify-between text-xs text-[#8A8178]">
                  <span>{tr('Base Service MRP', 'मूल सेवा शुल्क')}</span>
                  <span className="font-mono-num">{formatINR(basePrice)}</span>
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
