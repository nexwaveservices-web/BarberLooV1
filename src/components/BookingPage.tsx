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
import { apiCalculatePricing } from '../lib/api';

interface BookingPageProps {
  initialService: ServiceItem | null;
  initialBarber: BarberItem | null;
  initialShop?: ShopItem | null;
  initialShopId?: string;
  onSelectShop?: (shop: any) => void;
  onConfirmBooking: (appointmentPayload: any) => Promise<any>;
  onNavigate: (page: PageView) => void;
  shops?: any[];
  services?: any[];
  barbers?: any[];
  coupons?: any[];
  appointments?: any[];
  workingHours?: any[];
  currentUserProfile?: any | null;
  platformSettings?: any;
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
  onSelectShop,
  onConfirmBooking,
  onNavigate,
  shops = [],
  services = [],
  barbers = [],
  coupons = [],
  appointments = [],
  workingHours = [],
  currentUserProfile,
  platformSettings,
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
  const [couponInput, setCouponInput] = useState<string>('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);
  const [couponFeedback, setCouponFeedback] = useState<string>('');
  const [bookingError, setBookingError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bookingComplete, setBookingComplete] = useState<any | null>(null);

  // Authoritative server-side price calculation state
  const [serverPricing, setServerPricing] = useState<{
    servicePrice: number;
    discountAmount: number;
    discountedServicePrice: number;
    platformFee: number;
    totalAmount: number;
    feeType?: string;
  } | null>(null);

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

  // Fetch trusted server pricing whenever service or coupon code changes
  useEffect(() => {
    if (!currentService?.id) return;
    let isCancelled = false;
    apiCalculatePricing(currentService.id, appliedCouponCode || undefined)
      .then((pricing) => {
        if (!isCancelled && pricing && typeof pricing.totalAmount === 'number') {
          setServerPricing(pricing);
        }
      })
      .catch(() => {
        // Fallback gracefully computed locally
      });
    return () => {
      isCancelled = true;
    };
  }, [currentService?.id, appliedCouponCode]);

  const steps = [
    { num: 1, label: tr('Select Service', 'सेवा चुनें') },
    { num: 2, label: tr('Select Barber', 'बार्बर चुनें') },
    { num: 3, label: tr('Select Date (IST)', 'तारीख चुनें (IST)') },
    { num: 4, label: tr('Select Time (IST)', 'समय चुनें (IST)') },
    { num: 5, label: tr('Confirm Booking', 'बुकिंग की पुष्टि') },
  ];

  // CASE A: shop_id is missing - Show "Choose a barber shop" and shop list (Rule 9)
  if (!selectedShopId || shopError === 'missing_shop') {
    return (
      <div className="min-h-[78vh] bg-[#FAF6EA] py-12 px-5 sm:px-8">
        <div className="max-w-[1200px] mx-auto space-y-8">
          {/* Header */}
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111113]">
              {tr('Choose a barber shop', 'एक सैलून चुनें')}
            </h1>
            <p className="text-sm text-[#8A8178]">
              {tr(
                'Select a barber shop to view services and book your appointment.',
                'सेवाएं देखने और अपनी अपॉइंटमेंट बुक करने के लिए एक सैलून चुनें।'
              )}
            </p>
          </div>

          {/* Shop List Grid */}
          {shops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.map((s: any) => {
                const isClosed = s.status === 'closed';
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-[20px] border border-[#111113]/10 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 bg-[#111113] overflow-hidden">
                        <SmartImage
                          src={s.image || '/default-shop.jpg'}
                          alt={s.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                              isClosed
                                ? 'bg-red-500/90 text-white'
                                : 'bg-[#5B0E14] text-[#F1E194]'
                            }`}
                          >
                            {isClosed ? tr('Closed', 'बंद है') : tr('Open Now', 'खुला है')}
                          </span>
                        </div>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h2 className="font-display text-xl font-bold text-[#111113] truncate">
                            {s.name}
                          </h2>
                          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#FAF6EA] text-xs font-semibold text-[#111113]">
                            ★ {s.rating || '4.9'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8A8178]">
                          <MapPin className="w-3.5 h-3.5 text-[#5B0E14] shrink-0" />
                          <span className="truncate">{s.address || s.district || 'City Center'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 pt-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectShop) onSelectShop(s);
                          setSelectedShopId(s.id);
                          setLoadedShop(s);
                          setShopError(null);
                        }}
                        className="w-full py-3 rounded-[14px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold tracking-wider uppercase cursor-pointer hover:bg-[#43090E] transition-colors"
                      >
                        {tr('Choose Shop', 'सैलून चुनें')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-12 rounded-[20px] bg-white border border-[#111113]/10 p-8 space-y-4">
              <p className="text-sm text-[#8A8178]">
                {tr(
                  'No barber shops are currently available. Please check back soon.',
                  'वर्तमान में कोई सैलून उपलब्ध नहीं है। कृपया थोड़ी देर बाद देखें।'
                )}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="px-6 py-2.5 rounded-[12px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold uppercase cursor-pointer"
              >
                {tr('Back to Home', 'होम पर वापस जाएं')}
              </button>
            </div>
          )}
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
              'No services are currently available.',
              'इस समय कोई सेवा उपलब्ध नहीं है।'
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
    const srvDuration = Number(
      currentService?.durationMins || currentService?.durationMin || 45
    );
    const [h, m] = timeStr.split(':').map(Number);
    const slotStartMin = h * 60 + m;
    const slotEndMin = slotStartMin + srvDuration;

    // 1. Cannot book past slots today
    const todayIso = istDates[0]?.isoDate;
    if (selectedDate === todayIso) {
      const nowIST = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date());
      if (timeStr <= nowIST) {
        return tr('Past', 'बीत चुका');
      }
    }

    // 2. Day off / leave
    if (selectedDaySchedule?.isDayOff) {
      return selectedDaySchedule.holidayNote || tr('Day Off', 'अवकाश');
    }

    const start = selectedDaySchedule?.startTime || '09:00';
    const end = selectedDaySchedule?.endTime || '21:30';
    const [eh, em] = end.split(':').map(Number);
    const endMin = eh * 60 + em;

    // 3. Must fit completely inside working hours
    if (timeStr < start || slotEndMin > endMin) {
      return tr('Closed', 'बंद');
    }

    // 4. Breaks
    const bStart = selectedDaySchedule?.breakStart || '';
    const bEnd = selectedDaySchedule?.breakEnd || '';
    if (bStart && bEnd) {
      const [bsh, bsm] = bStart.split(':').map(Number);
      const [beh, bem] = bEnd.split(':').map(Number);
      const breakStartMin = bsh * 60 + bsm;
      const breakEndMin = beh * 60 + bem;
      if (slotStartMin < breakEndMin && slotEndMin > breakStartMin) {
        return tr('Break', 'ब्रेक');
      }
    }

    // 5. Chair break
    if (
      currentBarber?.chairBreakActive &&
      selectedDate === todayIso
    ) {
      return tr('On Break', 'चेयर ब्रेक');
    }
    return null;
  };

  const isSlotReserved = (timeStr: string) => {
    const srvDuration = Number(
      currentService?.durationMins || currentService?.durationMin || 45
    );
    const [h, m] = timeStr.split(':').map(Number);
    const slotStartMin = h * 60 + m;
    const slotEndMin = slotStartMin + srvDuration;

    return appointments.some((a: any) => {
      const matchesBarber =
        a.barberId === currentBarber.id ||
        a.barber_id === currentBarber.id ||
        (!a.barberId && a.shopId === currentShop?.id);
      if (!matchesBarber) return false;
      if (a.date !== selectedDate) return false;
      if (
        a.status === 'cancelled' ||
        a.status === 'Cancelled' ||
        a.status === 'no_show'
      ) {
        return false;
      }

      const [ah, am] = (a.time || '00:00').split(':').map(Number);
      const aptStartMin = ah * 60 + am;
      const aptDuration = Number(
        a.duration_min || a.durationMins || a.duration || 45
      );
      const aptEndMin = aptStartMin + aptDuration;

      // Overlap: slot starts before appointment ends AND slot ends after appointment starts
      return slotStartMin < aptEndMin && slotEndMin > aptStartMin;
    });
  };

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

  const rawServicePrice = Number(currentService?.price || 0);
  const discountAmount = Math.round((rawServicePrice * appliedDiscountPercent) / 100);
  const discountedServicePrice = Math.max(0, rawServicePrice - discountAmount);

  // Authoritative Platform Fee (from server calculation or platform settings)
  const fallbackFeeType = platformSettings?.feeType || 'fixed';
  const fallbackFeeAmount = Number(platformSettings?.feeAmount ?? 10);
  const fallbackMinFee = Number(platformSettings?.minFee ?? 5);

  const platformFee =
    serverPricing?.platformFee ??
    (fallbackFeeType === 'percentage'
      ? Math.max(fallbackMinFee, Math.round(discountedServicePrice * (fallbackFeeAmount / 100)))
      : fallbackFeeAmount);

  const displayServicePrice = serverPricing?.servicePrice ?? rawServicePrice;
  const displayDiscountAmount = serverPricing?.discountAmount ?? discountAmount;
  const displayDiscountedServicePrice = serverPricing?.discountedServicePrice ?? discountedServicePrice;
  const displayPlatformFee = platformFee;
  // TOTAL CUSTOMER PAYMENT = BARBER SERVICE PRICE + BARBERLOO PLATFORM FEE
  const finalCustomerPayment = displayDiscountedServicePrice + displayPlatformFee;

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

    // Strictly Online Payment (Zero cash, zero pay-at-shop)
    setIsSubmitting(true);
    setBookingError('');
    try {
      await initiateRazorpayPayment({
        amountINR: finalCustomerPayment,
        serviceName: currentService.name,
        barberName: currentBarber.name,
        shopName: currentShop?.name || currentBarber.shopName || 'BarberLoo Partner Salon',
        clientName: clientName || currentUserProfile?.name || 'Guest',
        clientPhone: clientPhone || currentUserProfile?.phone || '+91',
        clientEmail: currentUserProfile?.email || 'guest@barberloo.in',
        appointmentId: `apt-${Date.now().toString(36)}`,
        onSuccess: async (rzpResult) => {
          try {
            const targetShopId = currentShop?.id || selectedShopId || currentBarber.shopId || (shops.length > 0 ? shops[0].id : '');
            if (!targetShopId) {
              throw new Error('Please select a salon.');
            }
            const payload = {
              shopId: targetShopId,
              shopName: currentShop?.name || currentBarber.shopName || (shops.length > 0 ? shops[0].name : 'BarberLoo Partner Salon'),
              serviceId: currentService.id,
              serviceName: currentService.name,
              barberId: currentBarber.id,
              barberName: currentBarber.name,
              barberAvatar: currentBarber.avatar,
              date: selectedDate,
              time: selectedTime,
              durationMins: totalAppointmentDuration,
              durationMin: totalAppointmentDuration,
              price: finalCustomerPayment,
              servicePrice: displayServicePrice,
              platformFee: displayPlatformFee,
              totalPrice: finalCustomerPayment,
              clientName: clientName || currentUserProfile?.name,
              clientPhone: clientPhone || currentUserProfile?.phone || '+91',
              notes: fullBookingNotes,
              paymentMethod: 'online',
              razorpayPaymentId: rzpResult.razorpay_payment_id,
              razorpayOrderId: rzpResult.razorpay_order_id,
              couponCode: appliedCouponCode || undefined,
            };
            const created = await onConfirmBooking(payload);
            setBookingComplete({
              ...(created || payload),
              servicePrice: displayServicePrice,
              platformFee: displayPlatformFee,
              totalPrice: finalCustomerPayment,
              razorpayPaymentId: rzpResult.razorpay_payment_id,
              paymentMethod: 'online',
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
                'Razorpay authorization was not completed. Please retry payment.',
                'रेज़रपे भुगतान पूरा नहीं हुआ। कृपया पुनः प्रयास करें।'
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
                  {tr('Appointment Confirmed!', 'अपॉइंटमेंट कन्फर्म!')}
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
                {tr('Shop', 'सैलून')}
              </p>
              <p className="font-display text-xl font-bold text-[#FFF9E8] mt-1">
                {currentBarber.shopName}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#8A8178]">
                {tr('Service', 'सेवा')}
              </p>
              <p className="font-display text-xl font-bold text-[#FFF9E8] mt-1">
                {translateService(currentService.name)}
              </p>
              <p className="text-xs text-[#F1E194] mt-1 font-mono-num font-semibold">
                {currentService.durationMins || 45} {tr('mins', 'मिनट')}
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
                {tr('Date & Time', 'तारीख और समय')}
              </p>
              <p className="font-mono-num text-sm font-semibold text-[#FFF9E8] mt-1">
                {formattedSelectedDate} · {formattedSelectedSlot.time24} IST (
                {formattedSelectedSlot.time12})
              </p>
            </div>

            {/* Transparent Financial Settlement Breakdown */}
            <div className="sm:col-span-2 pt-3 border-t border-[#F1E194]/15 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wider text-[#F1E194] font-semibold">
                  {tr('Amount Paid', 'भुगतान की गई राशि')}
                </p>
                <span className="font-mono-num text-2xl font-bold text-emerald-400">
                  {formatINR(bookingComplete.totalPrice || bookingComplete.price)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 rounded-[12px] bg-[#111113] border border-[#F1E194]/15 text-center">
                <div>
                  <span className="text-[10px] text-[#8A8178] block">{tr('Service price', 'सेवा शुल्क')}</span>
                  <span className="text-xs font-mono-num font-bold text-[#FFF9E8]">
                    {formatINR(bookingComplete.servicePrice || (bookingComplete.price - (bookingComplete.platformFee || 10)))}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8A8178] block">{tr('BarberLoo platform fee', 'प्लेटफ़ॉर्म शुल्क')}</span>
                  <span className="text-xs font-mono-num font-bold text-[#F1E194]">
                    {formatINR(bookingComplete.platformFee || 10)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#8A8178] block">{tr('Total', 'कुल')}</span>
                  <span className="text-xs font-mono-num font-bold text-emerald-400">
                    {formatINR(bookingComplete.totalPrice || bookingComplete.price)}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[12px] bg-emerald-950/60 border border-emerald-500/30">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-200">
                      {tr('Paid Online via Razorpay', 'रेज़रपे द्वारा ऑनलाइन भुगतान सफल')}
                    </p>
                    <p className="text-[10px] text-emerald-300/80 font-mono-num">
                      {bookingComplete.razorpayPaymentId
                        ? `Txn ID: ${bookingComplete.razorpayPaymentId}`
                        : 'Razorpay Verified Payment'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-800 text-emerald-100 font-bold">
                  PAID • VERIFIED
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3.5 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('customer-dashboard')}
              className="flex-1 py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#FFF9E8] transition-colors cursor-pointer"
            >
              {tr('View My Booking', 'मेरी बुकिंग देखें')}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="py-4 px-6 rounded-[18px] border border-[#F1E194]/25 text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
            >
              {tr('Back to Home', 'होम पर वापस जाएं')}
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
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                      {tr('Choose a Service', 'सेवा चुनें')}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-0.5">
                      {tr(
                        'Select the service you want to book.',
                        'वह सेवा चुनें जिसे आप बुक करना चाहते हैं।'
                      )}
                    </p>
                  </div>
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
                      {tr('Choose Barber', 'बार्बर चुनें')}
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
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                      {tr('Choose Your Barber', 'अपना बार्बर चुनें')}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-0.5">
                      {tr(
                        'Select a barber or let us assign an available professional.',
                        'एक बार्बर चुनें या किसी भी उपलब्ध बार्बर को चुनें।'
                      )}
                    </p>
                  </div>
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
                  {/* Any Available Barber Option (Rule 12) */}
                  <div
                    onClick={() => setSelectedBarber(defaultOnDutyBarber)}
                    className={`rounded-[22px] p-5 border transition-all cursor-pointer flex gap-4 items-center ${
                      currentBarber?.id === defaultOnDutyBarber.id || currentBarber?.name.includes('Master')
                        ? 'bg-[#241719] text-[#FFF9E8] border-[#F1E194] shadow-xl'
                        : 'bg-[#E9D9B8]/55 text-[#111113] border-[#5B0E14]/15 hover:border-[#5B0E14]/45'
                    }`}
                  >
                    <div className="w-20 h-24 rounded-[16px] bg-[#5B0E14] text-[#F1E194] flex flex-col items-center justify-center shrink-0 border border-[#F1E194]/30">
                      <Scissors className="w-8 h-8 mb-1" />
                      <span className="text-[10px] uppercase font-bold tracking-wider">ANY</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[#F1E194] bg-[#111113] px-2.5 py-0.5 rounded-[8px]">
                          {tr('Flexible', 'सुविधाजनक')}
                        </span>
                        <span className="text-[11px] opacity-75">
                          {tr('No Waiting', 'बिना इंतज़ार')}
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-bold mt-1.5 truncate">
                        {tr('Any Available Barber', 'कोई भी उपलब्ध बार्बर')}
                      </h3>
                      <p className="text-xs text-[#8A8178] mt-1 leading-relaxed">
                        {tr(
                          'Let us choose an available barber for you.',
                          'हमारे द्वारा आपके लिए एक उपलब्ध बार्बर चुना जाएगा।'
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Individual Shop Barbers */}
                  {shopBarbers.map((brb: any) => {
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
                          <h3 className="font-display text-xl font-bold mt-1.5 truncate">
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
                    <span>{tr('Choose Date & Time', 'तारीख और समय चुनें')}</span>
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
                        'Choose Date & Time',
                        'तारीख और समय चुनें'
                      )}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-1">
                      {tr(
                        'Select your preferred date for the appointment.',
                        'अपनी अपॉइंटमेंट के लिए पसंदीदा तारीख चुनें।'
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
                      {tr('Choose Time', 'समय चुनें')}
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
                        `Choose Time (${formattedSelectedDate})`,
                        `समय चुनें (${formattedSelectedDate})`
                      )}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-1">
                      {tr(
                        'Select an available time slot for your appointment.',
                        'अपनी अपॉइंटमेंट के लिए एक उपलब्ध समय स्लॉट चुनें।'
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
                      {tr('Review Booking', 'बुकिंग की समीक्षा करें')}
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
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                      {tr(
                        'Pay & Confirm',
                        'भुगतान करें और पुष्टि करें'
                      )}
                    </h2>
                    <p className="text-xs text-[#8A8178] mt-1">
                      {tr(
                        'Confirm your details and pay online to secure your appointment.',
                        'अपने विवरण की पुष्टि करें और अपनी बुकिंग सुरक्षित करने के लिए ऑनलाइन भुगतान करें।'
                      )}
                    </p>
                  </div>
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

                {/* Online Payment Method (Razorpay UPI / Cards / NetBanking) */}
                <div className="pt-2">
                  <div className="p-4 rounded-[16px] bg-[#FAF6EA] border border-[#5B0E14]/25 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-[#241719] flex items-center justify-center text-[#F1E194]">
                          <Zap className="w-4 h-4 fill-[#F1E194]" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[#111113]">
                            {tr('Online Payment via Razorpay', 'रेज़रपे ऑनलाइन भुगतान')}
                          </p>
                          <p className="text-[11px] text-[#8A8178]">
                            {tr('UPI (GPay, PhonePe, Paytm, BHIM) • Cards • NetBanking', 'UPI • डेबिट/क्रेडिट कार्ड्स • नेटबैंकिंग')}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                        Instant & Secure
                      </span>
                    </div>
                    <div className="pt-2 border-t border-[#5B0E14]/10 flex items-center justify-between text-xs text-[#241719]">
                      <span className="text-[#8A8178]">
                        {tr('Total Customer Payment', 'कुल देय राशि')}:
                      </span>
                      <span className="font-mono-num font-bold text-sm text-[#5B0E14]">
                        {formatINR(finalCustomerPayment)}
                      </span>
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
                  className="w-full py-4 px-6 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-sm font-bold tracking-[0.14em] uppercase hover:bg-[#241719] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xl"
                >
                  <Sparkles className="w-4 h-4 text-[#F1E194]" />
                  <span>
                    {isSubmitting
                      ? tr('PROCESSING RESERVATION...', 'प्रक्रिया जारी है...')
                      : tr(
                          `PAY ${formatINR(finalCustomerPayment)}`,
                          `${formatINR(finalCustomerPayment)} भुगतान करें`
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

              {/* PRICE BREAKDOWN: Service price + BarberLoo platform fee = Total */}
              <div className="pt-4 border-t border-[#F1E194]/15 space-y-2.5">
                <p className="text-[11px] font-semibold tracking-wider uppercase text-[#F1E194]">
                  {tr('PRICE BREAKDOWN', 'मूल्य विवरण')}
                </p>

                <div className="flex justify-between text-xs text-[#FFF9E8]/90">
                  <span>{tr('Service price', 'सेवा शुल्क')}</span>
                  <span className="font-mono-num font-semibold">{formatINR(displayServicePrice)}</span>
                </div>

                {displayDiscountAmount > 0 && (
                  <div className="flex justify-between text-xs text-[#F1E194]">
                    <span>
                      {tr('Discount', 'छूट')} ({appliedCouponCode} · {appliedDiscountPercent}%)
                    </span>
                    <span className="font-mono-num font-semibold">
                      -{formatINR(displayDiscountAmount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-xs text-[#FFF9E8]/90">
                  <span>{tr('BarberLoo platform fee', 'BarberLoo प्लेटफ़ॉर्म शुल्क')}</span>
                  <span className="font-mono-num font-semibold">{formatINR(displayPlatformFee)}</span>
                </div>

                <div className="flex justify-between items-baseline pt-3 border-t border-[#F1E194]/20">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#F1E194]">
                    {tr('Total', 'कुल राशि')}
                  </span>
                  <span className="font-mono-num text-3xl font-bold text-[#F1E194]">
                    {formatINR(finalCustomerPayment)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCompleteBooking}
                  disabled={isSubmitting}
                  className="w-full mt-3 py-3.5 px-5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-bold tracking-[0.14em] uppercase hover:bg-[#FFF9E8] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-[#111113]" />
                  <span>
                    {isSubmitting
                      ? tr('PROCESSING...', 'प्रक्रिया जारी है...')
                      : tr(
                          `PAY ${formatINR(finalCustomerPayment)}`,
                          `${formatINR(finalCustomerPayment)} भुगतान करें`
                        )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
