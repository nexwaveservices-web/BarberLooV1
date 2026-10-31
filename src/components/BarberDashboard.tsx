import React, { useState, useMemo } from 'react';
import {
  AppointmentItem,
} from '../data/barberlooData';
import {
  CheckCircle2,
  Clock,
  Scissors,
  Plus,
  Trash2,
  Store,
  Users,
  Calendar,
  TrendingUp,
  QrCode,
  AlertTriangle,
  ShieldAlert,
  Send,
  X,
} from 'lucide-react';
import {
  useLanguage,
  getCurrentISTDisplay,
  formatISTDateString,
} from '../lib/i18n';
import { uploadImageToSupabaseStorage } from '../lib/supabase';
import {
  evaluateAppointmentSla,
  calculatePlatformSlaSummary,
} from '../lib/sla';
import {
  DEFAULT_STATES,
  DEFAULT_CITIES,
  getCitiesForState,
} from '../lib/locations';
import { getShopQrDestinationUrl, getProductionDomain } from '../lib/domain';
import { SalonQrModal } from './SalonQrModal';
import { apiCreateReport, apiVerifyCompletionOtp } from '../lib/api';
import { BarberLocationPicker } from './BarberLocationPicker';

interface BarberDashboardProps {
  appointments: AppointmentItem[];
  onCreateAppointment?: (payload: any) => Promise<any>;
  onUpdateAppointment?: (id: string, updates: any) => Promise<void>;
  services?: any[];
  onCreateService?: (payload: any) => Promise<void>;
  onUpdateService?: (id: string, updates: any) => Promise<void>;
  onDeleteService?: (id: string) => Promise<void>;
  barbers?: any[];
  onCreateBarber?: (payload: any) => Promise<void>;
  onUpdateBarber?: (id: string, updates: any) => Promise<void>;
  onDeleteBarber?: (id: string) => Promise<void>;
  shops?: any[];
  onCreateShop?: (payload: any) => Promise<void>;
  onUpdateShop?: (id: string, updates: any) => Promise<void>;
  workingHours?: any[];
  onUpdateWorkingHours?: (id: string, updates: any) => Promise<void>;
  reviews?: any[];
  currentUserProfile?: any;
  coupons?: any[];
  onCreateCoupon?: (payload: any) => Promise<void>;
  onUpdateCoupon?: (id: string, updates: any) => Promise<void>;
  shopGallery?: any[];
  onCreateShopGalleryItem?: (payload: any) => Promise<void>;
  barberGallery?: any[];
  onCreateBarberGalleryItem?: (payload: any) => Promise<void>;
  onBroadcastShopNotification?: (payload: {
    shopName: string;
    message: string;
    targetRole?: 'customer' | 'barber' | 'all' | 'specific';
    specificUid?: string;
  }) => Promise<any>;
  notifications?: any[];
  onMarkNotificationsRead?: () => Promise<void>;
  profiles?: any[];
  platformSettings?: any;
}

export const BarberDashboard: React.FC<BarberDashboardProps> = ({
  appointments,
  onCreateAppointment,
  onUpdateAppointment,
  services = [],
  onCreateService,
  onUpdateService,
  onDeleteService,
  barbers = [],
  onCreateBarber,
  onUpdateBarber,
  onDeleteBarber,
  shops = [],
  onCreateShop,
  onUpdateShop,
  workingHours = [],
  onUpdateWorkingHours,
  currentUserProfile,
  coupons = [],
  onCreateCoupon,
  onUpdateCoupon,
  onCreateShopGalleryItem,
  onCreateBarberGalleryItem,
  onBroadcastShopNotification,
  notifications = [],
  onMarkNotificationsRead,
  profiles = [],
  platformSettings,
}) => {
  const { lang, tr, formatINR } = useLanguage();
  const istNow = getCurrentISTDisplay(lang);

  const currentHour = new Date().getHours();
  const greetingTime =
    currentHour < 12
      ? tr('Good morning', 'शुभ प्रभात')
      : currentHour < 17
      ? tr('Good afternoon', 'शुभ दोपहर')
      : tr('Good evening', 'शुभ संध्या');
  const barberFirstName =
    currentUserProfile?.name?.split(' ')[0] || tr('Master Barber', 'मास्टर बार्बर');

  const [activeTab, setActiveTab] = useState<
    | 'appointments'
    | 'services'
    | 'team'
    | 'schedule'
    | 'customers'
    | 'analytics'
    | 'shop'
  >('appointments');

  // New Service form (INR)
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvCategory, setNewSrvCategory] = useState('Precision Haircuts');
  const [newSrvDuration, setNewSrvDuration] = useState('45');
  const [newSrvPrice, setNewSrvPrice] = useState('750');
  const [newSrvDesc, setNewSrvDesc] = useState('');

  // Edit Service state
  const [editingSrvId, setEditingSrvId] = useState<string | null>(null);
  const [editSrvName, setEditSrvName] = useState('');
  const [editSrvPrice, setEditSrvPrice] = useState('750');
  const [editSrvDuration, setEditSrvDuration] = useState('45');
  const [editSrvDesc, setEditSrvDesc] = useState('');

  // Edit Barber & Portfolio state
  const [editingBrbId, setEditingBrbId] = useState<string | null>(null);
  const [editBrbName, setEditBrbName] = useState('');
  const [editBrbRole, setEditBrbRole] = useState('');
  const [editBrbSpecialty, setEditBrbSpecialty] = useState('');
  const [editBrbExp, setEditBrbExp] = useState('5');
  const [editBrbBio, setEditBrbBio] = useState('');
  const [editBrbImage, setEditBrbImage] = useState('');
  const [editBrbServices, setEditBrbServices] = useState('');
  const [portfolioTitle, setPortfolioTitle] = useState('');
  const [portfolioTag, setPortfolioTag] = useState('Precision Fade');
  const [portfolioImage, setPortfolioImage] = useState('');

  // Edit Schedule row state
  const [editingWhId, setEditingWhId] = useState<string | null>(null);
  const [whStart, setWhStart] = useState('09:30');
  const [whEnd, setWhEnd] = useState('21:30');
  const [whBreakStart, setWhBreakStart] = useState('14:00');
  const [whBreakEnd, setWhBreakEnd] = useState('14:45');
  const [whHolidayNote, setWhHolidayNote] = useState('');

  // Edit Shop, Gallery & Shop Offers state
  const [selectedQrShop, setSelectedQrShop] = useState<any | null>(null);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopDistrict, setEditShopDistrict] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopCity, setEditShopCity] = useState('Ludhiana');
  const [editShopState, setEditShopState] = useState('Punjab');
  const [editShopPinCode, setEditShopPinCode] = useState('');
  const [editShopLandmark, setEditShopLandmark] = useState('');
  const [editShopLatitude, setEditShopLatitude] = useState('');
  const [editShopLongitude, setEditShopLongitude] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopClosesAt, setEditShopClosesAt] = useState('21:30');
  const [editShopImage, setEditShopImage] = useState('');
  const [editShopAbout, setEditShopAbout] = useState('');
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryImage, setGalleryImage] = useState('');
  const [shopAnnouncement, setShopAnnouncement] = useState('');
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<
    'customer' | 'barber' | 'all' | 'specific'
  >('customer');
  const [broadcastSpecificUid, setBroadcastSpecificUid] = useState('');
  const [broadcastStatusToast, setBroadcastStatusToast] = useState('');

  // Appointment Completion OTP verification state
  const [otpAptId, setOtpAptId] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpFeedback, setOtpFeedback] = useState<{
    id: string;
    text: string;
    isError?: boolean;
  } | null>(null);
  const [offerCode, setOfferCode] = useState('');
  const [offerDiscount, setOfferDiscount] = useState('15');
  const [offerMinSpend, setOfferMinSpend] = useState('500');
  const [offerExpiry, setOfferExpiry] = useState('2027-12-31');

  // New Barber form
  const [newBrbName, setNewBrbName] = useState(
    currentUserProfile?.name || ''
  );
  const [newBrbRole, setNewBrbRole] = useState('Master Barber');
  const [newBrbSpecialty, setNewBrbSpecialty] = useState(
    'Skin Fades, Scissor Crop & Beard Styling'
  );
  const [newBrbExp, setNewBrbExp] = useState('8');
  const [newBrbPrice, setNewBrbPrice] = useState('750');
  const [newBrbBio, setNewBrbBio] = useState('');

  // New Shop registration form
  const [newShopName, setNewShopName] = useState('');
  const [newShopStateId, setNewShopStateId] = useState('st-pb');
  const [newShopCityId, setNewShopCityId] = useState('ct-jal');
  const [newShopCity, setNewShopCity] = useState('Jalandhar');
  const [newShopState, setNewShopState] = useState('Punjab');
  const [newShopDistrict, setNewShopDistrict] = useState('Jalandhar, Punjab');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPinCode, setNewShopPinCode] = useState('');
  const [newShopLandmark, setNewShopLandmark] = useState('');
  const [newShopLatitude, setNewShopLatitude] = useState('');
  const [newShopLongitude, setNewShopLongitude] = useState('');
  const [newShopPhone, setNewShopPhone] = useState(
    currentUserProfile?.phone || '+91 '
  );
  const [newShopMinPrice, setNewShopMinPrice] = useState('650');
  const [newShopTagline, setNewShopTagline] = useState(
    'Luxury Grooming & Bespoke Appointments'
  );
  const [newShopAbout, setNewShopAbout] = useState('');

  const handleNewShopStateChange = (stId: string) => {
    setNewShopStateId(stId);
    const stateObj = DEFAULT_STATES.find((s) => s.id === stId);
    if (stateObj) setNewShopState(stateObj.name);
    const validCities = getCitiesForState(stId);
    if (validCities.length > 0) {
      setNewShopCityId(validCities[0].id);
      setNewShopCity(validCities[0].name);
    }
  };

  // Internal customer note state
  const [noteAptId, setNoteAptId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Walk-in / Direct Client Booking state
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false);
  const [walkInClientName, setWalkInClientName] = useState('');
  const [walkInClientPhone, setWalkInClientPhone] = useState('');
  const [walkInServiceId, setWalkInServiceId] = useState('');
  const [walkInBarberId, setWalkInBarberId] = useState('');
  const [walkInDate, setWalkInDate] = useState(new Date().toISOString().slice(0, 10));
  const [walkInTime, setWalkInTime] = useState('14:30');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<'salon_cash' | 'online'>('salon_cash');
  const [walkInPaymentStatus, setWalkInPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [selectedWalkInExtras, setSelectedWalkInExtras] = useState<string[]>([]);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInSuccessMsg, setWalkInSuccessMsg] = useState('');
  const [walkInError, setWalkInError] = useState('');
  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);

  const AVAILABLE_EXTRAS = [
    { id: 'ext-beard', name: 'Beard Sculpting & Hot Towel', price: 150, durationMin: 15 },
    { id: 'ext-massage', name: 'Herbal Head & Neck Massage', price: 200, durationMin: 20 },
    { id: 'ext-face', name: 'Charcoal Face Cleanup & Scrub', price: 300, durationMin: 25 },
    { id: 'ext-spa', name: 'Hair Spa & Conditioning', price: 400, durationMin: 30 },
    { id: 'ext-mustache', name: 'Mustache Styling & Trim', price: 80, durationMin: 10 },
  ];

  const activeShop = shops[0] || null;

  // Suspension & Governance State for Logged-In Barber
  const linkedBarber = barbers.find(
    (b: any) =>
      (currentUserProfile?.uid &&
        (b.userUid === currentUserProfile.uid || b.id === currentUserProfile.uid)) ||
      (barbers.length === 1 ? b : null)
  );

  const isBarberSuspended =
    currentUserProfile?.status === 'suspended' ||
    linkedBarber?.verificationStatus === 'suspended' ||
    (linkedBarber && linkedBarber.active === false && linkedBarber.verificationStatus !== 'verified');

  const [appealMessage, setAppealMessage] = useState('');
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealMessage.trim()) return;
    setAppealSubmitting(true);
    try {
      await apiCreateReport({
        reporterUid: currentUserProfile?.uid || 'barber',
        reporterName: linkedBarber?.name || currentUserProfile?.name || 'Barber',
        targetType: 'barber_appeal',
        targetId: linkedBarber?.id || currentUserProfile?.uid || 'barber',
        targetLabel: linkedBarber?.name || currentUserProfile?.name || 'Barber Chair',
        reason: 'Chair Reinstatement Appeal',
        details: appealMessage.trim(),
      }).catch(() => {});

      if (onBroadcastShopNotification) {
        await onBroadcastShopNotification({
          shopName: activeShop?.name || 'Partner Salon',
          message: `Reinstatement Appeal from ${linkedBarber?.name || currentUserProfile?.name || 'Barber'}: ${appealMessage.trim()}`,
          targetRole: 'all',
        });
      }
      setAppealSubmitted(true);
    } catch {
      // silent
    } finally {
      setAppealSubmitting(false);
    }
  };

  const handleCreateWalkInBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInClientName.trim()) {
      setWalkInError(tr('Please enter the customer full name.', 'कृपया ग्राहक का पूरा नाम दर्ज करें।'));
      return;
    }
    if (!walkInClientPhone.trim()) {
      setWalkInError(tr('Please enter customer phone number.', 'कृपया ग्राहक का फ़ोन नंबर दर्ज करें।'));
      return;
    }
    const targetShop = activeShop || shops[0];
    if (!targetShop) {
      setWalkInError(tr('Please select or register a salon first.', 'कृपया पहले एक सैलून चुनें।'));
      return;
    }
    const srv = services.find((s) => s.id === walkInServiceId) || services[0];
    if (!srv) {
      setWalkInError(tr('Please select a service from your menu.', 'कृपया मेनू से एक सेवा चुनें।'));
      return;
    }
    const brb = barbers.find((b) => b.id === walkInBarberId) || linkedBarber || barbers[0] || {
      id: 'master-barber',
      name: `${targetShop.name} Master Barber`,
    };

    setWalkInSubmitting(true);
    setWalkInError('');

    try {
      const selectedExtrasList = AVAILABLE_EXTRAS.filter((x) =>
        selectedWalkInExtras.includes(x.id)
      );
      const extrasCost = selectedExtrasList.reduce((sum, x) => sum + x.price, 0);
      const extrasDuration = selectedExtrasList.reduce((sum, x) => sum + x.durationMin, 0);
      const basePrice = Number(srv.price || 500);
      const baseDuration = Number(srv.durationMin || srv.durationMins || 45);
      const serviceTotal = basePrice + extrasCost;
      const platformFee = 10;
      const totalCustomerPrice = serviceTotal + platformFee;
      const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));

      const extrasNotes = selectedExtrasList.length > 0
        ? `[Extras: ${selectedExtrasList.map((x) => `${x.name} (+₹${x.price})`).join(', ')}]`
        : '';
      const notesCombined = `Direct / Walk-in Booking ${extrasNotes} ${walkInNotes ? `| ${walkInNotes}` : ''}`.trim();

      const bookingPayload = {
        clientName: walkInClientName.trim(),
        clientPhone: walkInClientPhone.trim(),
        shopId: targetShop.id,
        shopName: targetShop.name,
        serviceId: srv.id,
        serviceName: srv.name,
        barberId: brb.id,
        barberName: brb.name,
        barberAvatar: brb.avatar || brb.image,
        date: walkInDate,
        time: walkInTime,
        durationMin: baseDuration + extrasDuration,
        durationMins: baseDuration + extrasDuration,
        price: totalCustomerPrice,
        servicePrice: serviceTotal,
        platformFee,
        totalPrice: totalCustomerPrice,
        status: 'confirmed',
        paymentMethod: walkInPaymentMethod === 'online' ? 'online' : 'pay_at_shop',
        paymentStatus: walkInPaymentStatus,
        notes: notesCombined,
        internalBarberNotes: `[OTP:${generatedOtp}] Walk-in created by barber console`,
        completionOtp: generatedOtp,
        addOns: selectedExtrasList,
      };

      if (onCreateAppointment) {
        await onCreateAppointment(bookingPayload);
      }

      setWalkInSuccessMsg(
        tr(
          `✓ Appointment booked successfully for ${walkInClientName}! Service Completion OTP is: ${generatedOtp}. Customer can share this code upon completion.`,
          `✓ ${walkInClientName} के लिए अपॉइंटमेंट सफलतापूर्वक बुक हुआ! सेवा पूर्णता OTP है: ${generatedOtp}. कार्य पूरा होने पर ग्राहक यह कोड बताएं।`
        )
      );
      setIsWalkInModalOpen(false);
      setWalkInClientName('');
      setWalkInClientPhone('');
      setSelectedWalkInExtras([]);
      setWalkInNotes('');
    } catch (err: any) {
      setWalkInError(err?.message || 'Failed to create booking.');
    } finally {
      setWalkInSubmitting(false);
    }
  };

  // Real calculated revenue & analytics from appointments
  const completedApts = appointments.filter(
    (a) => String(a.status).toLowerCase() === 'completed'
  );
  const cancelledApts = appointments.filter(
    (a) => String(a.status).toLowerCase() === 'cancelled'
  );
  const noShowApts = appointments.filter(
    (a) =>
      String(a.status).toLowerCase() === 'no_show' ||
      String(a.status).toLowerCase() === 'no-show'
  );
  const completedOrConfirmedApts = appointments.filter(
    (a) =>
      String(a.status).toLowerCase() === 'completed' ||
      String(a.status).toLowerCase() === 'confirmed'
  );
  const totalServiceRevenueINR = completedOrConfirmedApts.reduce(
    (sum, a) => sum + (Number(a.servicePrice ?? (a.price - (a.platformFee ?? 10))) || 0),
    0
  );
  const totalPlatformFeesCollectedINR = completedOrConfirmedApts.reduce(
    (sum, a) => sum + (Number(a.platformFee ?? 10) || 0),
    0
  );
  const totalCustomerPaidINR = completedOrConfirmedApts.reduce(
    (sum, a) => sum + (Number(a.totalPrice ?? a.price) || 0),
    0
  );
  const totalRealRevenueINR = totalServiceRevenueINR;
  const completedRevenueINR = completedApts.reduce(
    (sum, a) => sum + (Number(a.servicePrice ?? (a.price - (a.platformFee ?? 10))) || 0),
    0
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const dailyRevenueINR = completedOrConfirmedApts
    .filter((a) => a.date === todayIso)
    .reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const weeklyRevenueINR = totalRealRevenueINR;
  const monthlyRevenueINR = totalRealRevenueINR;
  const cancellationRatePct =
    appointments.length > 0
      ? Math.round((cancelledApts.length / appointments.length) * 100)
      : 0;
  const peakBookingHour = useMemo(() => {
    if (appointments.length === 0) return '-';
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      if (!a.time) continue;
      counts[a.time] = (counts[a.time] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
    return sorted[0] ? `${sorted[0][0]} IST` : '-';
  }, [appointments]);

  // Customer directory aggregated from real appointments
  const customerDirectory = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        phone: string;
        visits: number;
        totalSpent: number;
        services: string[];
        lastNote: string;
        lastAptId: string;
      }
    >();
    for (const apt of appointments) {
      const k = apt.customerUid || apt.clientName || apt.id;
      const existing = map.get(k);
      if (!existing) {
        map.set(k, {
          key: k,
          name: apt.clientName || 'Client',
          phone: apt.clientPhone || '+91',
          visits: 1,
          totalSpent: Number(apt.price) || 0,
          services: [apt.serviceName],
          lastNote: apt.barberNotes || apt.notes || '',
          lastAptId: apt.id,
        });
      } else {
        existing.visits += 1;
        existing.totalSpent += Number(apt.price) || 0;
        if (!existing.services.includes(apt.serviceName)) {
          existing.services.push(apt.serviceName);
        }
        if (apt.barberNotes) existing.lastNote = apt.barberNotes;
      }
    }
    return Array.from(map.values());
  }, [appointments]);

  // Revenue by service breakdown
  const serviceRevenueList = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();
    for (const apt of completedOrConfirmedApts) {
      const entry = map.get(apt.serviceName) || {
        name: apt.serviceName,
        count: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += Number(apt.price) || 0;
      map.set(apt.serviceName, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrConfirmedApts]);

  const handleCreateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSrvName.trim() || !onCreateService) return;
    const targetShopId = activeShop?.id || (shops.length > 0 ? shops[0].id : '');
    if (!targetShopId) return;
    await onCreateService({
      shopId: targetShopId,
      name: newSrvName.trim(),
      category: newSrvCategory,
      durationMin: Number(newSrvDuration) || 45,
      price: Number(newSrvPrice) || 750,
      description: newSrvDesc.trim() || 'Professional grooming service.',
      popular: true,
    });
    setNewSrvName('');
    setNewSrvDesc('');
  };

  const handleSaveServiceEdit = async (id: string) => {
    if (!onUpdateService) return;
    await onUpdateService(id, {
      name: editSrvName.trim(),
      price: Number(editSrvPrice) || 750,
      durationMin: Number(editSrvDuration) || 45,
      description: editSrvDesc.trim(),
    });
    setEditingSrvId(null);
  };

  const handleCreateBarberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrbName.trim() || !onCreateBarber) return;
    const targetShop = activeShop || (shops.length > 0 ? shops[0] : null);
    if (!targetShop) return;
    await onCreateBarber({
      userUid: currentUserProfile?.uid || '',
      shopId: targetShop.id,
      shopName: targetShop.name || 'BarberLoo Partner Salon',
      name: newBrbName.trim(),
      role: newBrbRole.trim(),
      specialty: newBrbSpecialty.trim(),
      experienceYears: Number(newBrbExp) || 5,
      priceFrom: Number(newBrbPrice) || 750,
      bio: newBrbBio.trim(),
    });
    setNewBrbName('');
    setNewBrbBio('');
  };

  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName.trim() || !onCreateShop) return;
    const stateObj = DEFAULT_STATES.find((s) => s.id === newShopStateId);
    const validCities = getCitiesForState(newShopStateId);
    const cityObj =
      validCities.find((c) => c.id === newShopCityId) || validCities[0];

    await onCreateShop({
      name: newShopName.trim(),
      stateId: newShopStateId,
      cityId: cityObj?.id || 'ct-jal',
      state: stateObj?.name || newShopState || 'Punjab',
      city: cityObj?.name || newShopCity || 'Jalandhar',
      district: `${cityObj?.name || newShopCity || 'Jalandhar'}, ${stateObj?.name || newShopState || 'Punjab'}`,
      address: newShopAddress.trim(),
      phone: newShopPhone.trim(),
      minPrice: Number(newShopMinPrice) || 500,
      priceTier: `₹${newShopMinPrice} – ₹2,500`,
      tagline: newShopTagline.trim(),
      about: newShopAbout.trim(),
      pinCode: newShopPinCode.trim(),
      landmark: newShopLandmark.trim(),
      latitude: newShopLatitude.trim(),
      longitude: newShopLongitude.trim(),
    });
    setNewShopName('');
    setNewShopAddress('');
    setNewShopPinCode('');
    setNewShopLandmark('');
    setNewShopLatitude('');
    setNewShopLongitude('');
    setNewShopAbout('');
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#FFF9E8] py-10 sm:py-14">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#F1E194]/15">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194] mb-2">
              {tr(
                `BARBER & SALON PARTNER CONSOLE • ${istNow.shortBadge}`,
                `बार्बर और सैलून पार्टनर कंसोल • ${istNow.shortBadge}`
              )}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#FFF9E8]">
              {greetingTime}, {barberFirstName}
            </h1>
            <p className="text-xs text-[#8A8178] mt-1">
              {activeShop ? `${activeShop.name} · ` : ''}
              {currentUserProfile?.email}
            </p>
          </div>

          {/* Real KPI Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="px-4 py-3 rounded-[16px] bg-[#241719] border border-[#F1E194]/20">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                {tr('Bookings', 'कुल बुकिंग')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#FFF9E8]">
                {appointments.length}
              </span>
            </div>
            <div className="px-4 py-3 rounded-[16px] bg-[#241719] border border-[#F1E194]/20">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                {tr('Completed Cuts', 'पूर्ण कट')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                {completedApts.length}
              </span>
            </div>
            <div className="px-4 py-3 rounded-[16px] bg-[#241719] border border-[#F1E194]/20">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                {tr('Services', 'सेवाएं')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#FFF9E8]">
                {services.length}
              </span>
            </div>
            <div className="px-4 py-3 rounded-[16px] bg-[#241719] border border-[#F1E194]/20">
              <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                {tr('Service Revenue', 'सेवा राजस्व (दुकान)')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                {formatINR(totalServiceRevenueINR)}
              </span>
              <span className="text-[9px] text-[#8A8178] block mt-0.5">
                {tr('Paid by clients: ', 'कुल ग्राहक भुगतान: ')}{formatINR(totalCustomerPaidINR)}
              </span>
            </div>
          </div>
        </div>

        {/* SET UP YOUR SHOP CHECKLIST (Rule 23) */}
        {(() => {
          const hasShopInfo = Boolean(activeShop || shops.length > 0);
          const hasWorkingHours = workingHours.length > 0;
          const hasServices = services.length > 0;
          const hasBarbers = barbers.length > 0;
          const hasPhotos = Boolean(activeShop?.image || (activeShop?.gallery?.length ?? 0) > 0);
          const isComplete = hasShopInfo && hasWorkingHours && hasServices && hasBarbers && hasPhotos;

          return (
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/25 p-6 sm:p-7 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-[#F1E194]">
                    {tr('SET UP YOUR SHOP', 'अपनी दुकान सेट करें')}
                  </span>
                  <h2 className="font-display text-2xl font-bold mt-0.5">
                    {isComplete
                      ? tr('Shop Setup Complete ✓', 'दुकान सेटअप पूर्ण ✓')
                      : tr('Complete Your Salon Setup', 'सैलून सेटअप पूरा करें')}
                  </h2>
                </div>
                {!isComplete && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasShopInfo) setActiveTab('shop');
                      else if (!hasWorkingHours) setActiveTab('schedule');
                      else if (!hasServices) setActiveTab('services');
                      else if (!hasBarbers) setActiveTab('team');
                      else setActiveTab('shop');
                    }}
                    className="px-5 py-2.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer hover:bg-[#FFF9E8] transition-colors"
                  >
                    {tr('Continue Setup', 'सेटअप जारी रखें')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                <div
                  className={`p-3 rounded-[14px] border text-xs flex items-center gap-2 cursor-pointer ${
                    hasShopInfo
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                  }`}
                  onClick={() => setActiveTab('shop')}
                >
                  <span className="font-bold">{hasShopInfo ? '✓' : '○'}</span>
                  <span className="font-semibold">{tr('Shop information', 'दुकान जानकारी')}</span>
                </div>
                <div
                  className={`p-3 rounded-[14px] border text-xs flex items-center gap-2 cursor-pointer ${
                    hasWorkingHours
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                  }`}
                  onClick={() => setActiveTab('schedule')}
                >
                  <span className="font-bold">{hasWorkingHours ? '✓' : '○'}</span>
                  <span className="font-semibold">{tr('Working hours', 'कार्य समय')}</span>
                </div>
                <div
                  className={`p-3 rounded-[14px] border text-xs flex items-center gap-2 cursor-pointer ${
                    hasServices
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                  }`}
                  onClick={() => setActiveTab('services')}
                >
                  <span className="font-bold">{hasServices ? '✓' : '○'}</span>
                  <span className="font-semibold">{tr('Add services', 'सेवाएं जोड़ें')}</span>
                </div>
                <div
                  className={`p-3 rounded-[14px] border text-xs flex items-center gap-2 cursor-pointer ${
                    hasBarbers
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                  }`}
                  onClick={() => setActiveTab('team')}
                >
                  <span className="font-bold">{hasBarbers ? '✓' : '○'}</span>
                  <span className="font-semibold">{tr('Add barbers', 'बार्बर जोड़ें')}</span>
                </div>
                <div
                  className={`p-3 rounded-[14px] border text-xs flex items-center gap-2 cursor-pointer ${
                    hasPhotos
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                  }`}
                  onClick={() => setActiveTab('shop')}
                >
                  <span className="font-bold">{hasPhotos ? '✓' : '○'}</span>
                  <span className="font-semibold">{tr('Add photos', 'फ़ोटो जोड़ें')}</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Incoming Broadcasts & Notifications for Barber */}
        {notifications.length > 0 && (
          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/25 p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#F1E194]">
                {tr(
                  'Live Console Notifications & Broadcasts',
                  'लाइव सूचनाएं और ब्रॉडकास्ट संदेश'
                )}{' '}
                ({notifications.length})
              </span>
              {onMarkNotificationsRead && (
                <button
                  type="button"
                  onClick={onMarkNotificationsRead}
                  className="text-[11px] text-[#F1E194] underline cursor-pointer"
                >
                  {tr('Mark All Read', 'पढ़ा हुआ चिह्नित करें')}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {notifications.slice(0, 4).map((n: any) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-[12px] bg-[#111113] text-xs border ${
                    n.unread
                      ? 'border-[#F1E194]/40 text-[#FFF9E8]'
                      : 'border-[#F1E194]/10 text-[#8A8178]'
                  }`}
                >
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-[10px] text-[#8A8178] mt-0.5">
                    {n.timeLabel}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dedicated Chair Suspension Notice & Appeal Protocol */}
        {isBarberSuspended && (
          <div className="rounded-[24px] bg-rose-950/40 border-2 border-rose-500/50 p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[16px] bg-rose-900/60 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <span className="px-3 py-1 rounded-full bg-rose-900 text-rose-200 border border-rose-400/40 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{tr('CHAIR / ACCOUNT SUSPENDED BY ADMINISTRATION', 'प्रशासन द्वारा कुर्सी व खाता निलंबित')}</span>
                  </span>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-2">
                    {tr(
                      'Your Barber Chair Is Currently Suspended',
                      'आपकी बार्बर कुर्सी वर्तमान में निलंबित है'
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-rose-200/90 mt-1 max-w-2xl leading-relaxed">
                    {tr(
                      'Platform administration has temporarily placed your chair on administrative suspension. Your profile and chair are hidden from public discovery, and new client appointments cannot be booked.',
                      'प्लेटफ़ॉर्म प्रशासन ने अस्थायी रूप से आपकी कुर्सी निलंबित कर दी है। आपकी प्रोफ़ाइल सार्वजनिक खोज से छिपी हुई है और नए ग्राहक अपॉइंटमेंट बुक नहीं कर सकते।'
                    )}
                  </p>
                </div>
              </div>

              <div className="shrink-0">
                <span className="px-3.5 py-1.5 rounded-[12px] bg-[#111113] border border-rose-500/30 text-rose-300 text-xs font-mono-num font-semibold">
                  Status: SUSPENDED
                </span>
              </div>
            </div>

            {/* Impact Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-[16px] bg-[#111113]/70 border border-rose-500/20 text-xs space-y-1">
                <div className="font-semibold text-rose-300">1. {tr('Public Visibility', 'सार्वजनिक दृश्यता')}</div>
                <p className="text-[#8A8178]">
                  {tr(
                    'Hidden from Homepage master barbers, salon cards, and QR booking pass.',
                    'होमपेज, सैलून कार्ड और QR बुकिंग पास से छिपा हुआ है।'
                  )}
                </p>
              </div>

              <div className="p-4 rounded-[16px] bg-[#111113]/70 border border-rose-500/20 text-xs space-y-1">
                <div className="font-semibold text-rose-300">2. {tr('New Appointments', 'नई बुकिंग')}</div>
                <p className="text-[#8A8178]">
                  {tr(
                    'Booking slots locked. System prevents any customer from scheduling slots.',
                    'बुकिंग स्लॉट लॉक हैं। ग्राहक नए स्लॉट बुक नहीं कर सकते।'
                  )}
                </p>
              </div>

              <div className="p-4 rounded-[16px] bg-[#111113]/70 border border-rose-500/20 text-xs space-y-1">
                <div className="font-semibold text-rose-300">3. {tr('Scheduled Sessions', 'मौजूदा सत्र')}</div>
                <p className="text-[#8A8178]">
                  {tr(
                    'Existing records are preserved below for reference and audit.',
                    'मौजूदा रिकॉर्ड संदर्भ और ऑडिट के लिए नीचे सुरक्षित हैं।'
                  )}
                </p>
              </div>
            </div>

            {/* Appeal Submission Form */}
            <div className="p-5 rounded-[18px] bg-[#111113]/90 border border-[#F1E194]/20 space-y-3">
              <h3 className="font-display text-lg font-bold text-[#FFF9E8]">
                {tr('Submit Reinstatement Appeal to Platform Admin', 'प्रशासन को निलंबन बहाली अपील भेजें')}
              </h3>
              <p className="text-xs text-[#8A8178]">
                {tr(
                  'If you believe this suspension is in error or you have resolved the underlying compliance issue, submit your message below directly to the BarberLoo Admin Console.',
                  'यदि आपको लगता है कि यह निलंबन गलती से हुआ है, तो सीधे एडमिन कंसोल को अपना संदेश भेजें।'
                )}
              </p>

              {appealSubmitted ? (
                <div className="p-4 rounded-[14px] bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {tr(
                      '✓ Your appeal has been logged and transmitted to the Administrator. You will be notified once reviewed.',
                      '✓ आपकी अपील प्रशासक को भेज दी गई है। समीक्षा के बाद आपको सूचित किया जाएगा।'
                    )}
                  </span>
                </div>
              ) : (
                <form onSubmit={handleAppealSubmit} className="space-y-3">
                  <textarea
                    rows={3}
                    required
                    value={appealMessage}
                    onChange={(e) => setAppealMessage(e.target.value)}
                    placeholder={tr(
                      'State your appeal, verification details, or corrective steps taken for reinstatement...',
                      'बहाली के लिए अपनी अपील और विवरण लिखें...'
                    )}
                    className="w-full px-4 py-3 rounded-[14px] bg-[#1a1214] border border-[#F1E194]/20 text-xs text-[#FFF9E8] placeholder:text-[#8A8178] focus:outline-none focus:border-[#F1E194]"
                  />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-[11px] text-[#8A8178]">
                      {tr('Helpline: nexwaveservices@gmail.com', 'हेल्पलाइन: nexwaveservices@gmail.com')}
                    </span>
                    <button
                      type="submit"
                      disabled={appealSubmitting || !appealMessage.trim()}
                      className="px-5 py-2.5 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer inline-flex items-center gap-2 hover:bg-[#FFF9E8] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{appealSubmitting ? tr('Transmitting...', 'भेज रहे हैं...') : tr('Submit Appeal', 'अपील भेजें')}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              id: 'appointments',
              label: tr('Appointments', 'अपॉइंटमेंट्स'),
              icon: Calendar,
            },
            {
              id: 'services',
              label: tr('Services Menu (₹)', 'सेवा मेनू (₹)'),
              icon: Scissors,
            },
            {
              id: 'team',
              label: tr('Barbers Profile', 'बार्बर प्रोफ़ाइल'),
              icon: Users,
            },
            {
              id: 'schedule',
              label: tr('Working Hours (IST)', 'कार्य समय (IST)'),
              icon: Clock,
            },
            {
              id: 'customers',
              label: tr('Client Directory', 'ग्राहक सूची'),
              icon: Users,
            },
            {
              id: 'analytics',
              label: tr('Revenue & Analytics', 'राजस्व और एनालिटिक्स'),
              icon: TrendingUp,
            },
            {
              id: 'shop',
              label: tr('Salon Registration & Info', 'सैलून पंजीकरण और विवरण'),
              icon: Store,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-3 rounded-[16px] text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#F1E194] text-[#111113]'
                    : 'bg-[#241719] text-[#FFF9E8]/80 hover:text-[#FFF9E8] border border-[#F1E194]/15'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold">
                  {tr('Client Appointments (IST)', 'ग्राहक अपॉइंटमेंट्स (IST)')}
                </h2>
                <p className="text-xs text-[#8A8178] mt-0.5">
                  {tr('Live customer bookings, walk-ins, service OTP verification & add-on extras.', 'लाइव ग्राहक बुकिंग, वॉक-इन, सेवा OTP सत्यापन और अतिरिक्त सेवाएं।')}
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsWalkInModalOpen(true);
                    setWalkInSuccessMsg('');
                    setWalkInError('');
                    if (!walkInServiceId && services.length > 0) {
                      setWalkInServiceId(services[0].id);
                    }
                    if (!walkInBarberId && barbers.length > 0) {
                      setWalkInBarberId(linkedBarber?.id || barbers[0].id);
                    }
                  }}
                  className="px-4 py-2.5 rounded-[14px] bg-[#F1E194] hover:bg-[#FFF9E8] text-[#111113] text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{tr('+ Book Walk-in / Direct Client', '+ नई ग्राहक बुकिंग / वॉक-इन')}</span>
                </button>
                <div className="px-3.5 py-2 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-[#F1E194] text-xs font-semibold tracking-wider">
                  {appointments.length} {tr('Bookings', 'बुकिंग')}
                </div>
              </div>
            </div>

            {walkInSuccessMsg && (
              <div className="p-4 rounded-[16px] bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{walkInSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setWalkInSuccessMsg('')}
                  className="p-1 text-emerald-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {appointments.length === 0 ? (
              <p className="text-xs text-[#8A8178] py-8">
                {tr(
                  'No customer appointments booked yet. Make sure your Shop, Barber profile, and Services are added so customers can book you.',
                  'अभी तक कोई अपॉइंटमेंट बुक नहीं हुआ है। कृपया सुनिश्चित करें कि आपकी दुकान, बार्बर प्रोफ़ाइल और सेवाएं जुड़ी हुई हैं।'
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-[18px] bg-[#111113] border border-[#F1E194]/15 p-5 space-y-3"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono-num text-xs font-bold text-[#F1E194]">
                            {formatISTDateString(apt.date, lang)} · {apt.time} IST
                          </span>
                          <span className="px-2.5 py-0.5 rounded-[8px] bg-[#241719] text-[11px] text-[#FFF9E8]">
                            {apt.status}
                          </span>
                          {(() => {
                            const sla = evaluateAppointmentSla(apt);
                            if (sla.status === 'EXEMPT') return null;
                            return (
                              <span
                                className={`px-2.5 py-0.5 rounded-[8px] font-mono-num text-[10px] font-semibold border ${
                                  sla.status === 'BREACHED'
                                    ? 'bg-red-950/90 text-red-200 border-red-400/40'
                                    : sla.status === 'AT_RISK'
                                    ? 'bg-amber-950/90 text-amber-200 border-amber-400/40'
                                    : 'bg-emerald-950/80 text-emerald-200 border-emerald-400/30'
                                }`}
                              >
                                🛡️ {sla.badgeText}
                              </span>
                            );
                          })()}
                        </div>
                        <h3 className="font-display text-2xl font-bold mt-1">
                          {apt.clientName} ({apt.clientPhone})
                        </h3>
                        <p className="text-xs text-[#8A8178]">
                          {apt.serviceName} · {apt.barberName}
                        </p>

                        {/* Transparent Money Flow for Shop Owner / Barber */}
                        <div className="mt-2.5 p-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 grid grid-cols-3 gap-2 text-center text-xs">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                              {tr('Service price', 'सेवा शुल्क')}
                            </span>
                            <span className="font-mono-num font-bold text-[#FFF9E8]">
                              {formatINR(apt.servicePrice ?? (apt.price - (apt.platformFee ?? 10)))}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                              {tr('BarberLoo fee', 'BarberLoo शुल्क')}
                            </span>
                            <span className="font-mono-num font-semibold text-[#F1E194]">
                              {formatINR(apt.platformFee ?? 10)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                              {tr('Customer paid', 'कुल ग्राहक भुगतान')}
                            </span>
                            <span className="font-mono-num font-bold text-emerald-400">
                              {formatINR(apt.totalPrice ?? apt.price)}
                            </span>
                          </div>
                        </div>

                        {(apt.notes || apt.barberNotes) && (
                          <p className="text-[11px] text-[#F1E194]/80 mt-2">
                            {apt.notes ? `Client Note: ${apt.notes} ` : ''}
                            {apt.barberNotes
                              ? `· Barber Note: ${apt.barberNotes}`
                              : ''}
                          </p>
                        )}

                        {/* Extras / Add-on Services Display */}
                        {Boolean((apt as any).addOnsText) && (
                          <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-[8px] bg-[#241719] border border-[#D4AF37]/40 text-[#F1E194] text-[11px] font-medium w-fit">
                            <span>✨ {tr('Extras / Add-ons:', 'अतिरिक्त सेवाएं:')}</span>
                            <span className="font-semibold text-[#FFF9E8]">{(apt as any).addOnsText}</span>
                          </div>
                        )}

                        {/* Customer 6-Digit Completion OTP Tag */}
                        {Boolean((apt as any).completionOtp) && (
                          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/40 text-[#F1E194] text-xs font-mono w-fit">
                            <span>🔐 {tr('Service OTP:', 'सेवा पूर्णता OTP:')}</span>
                            <strong className="tracking-widest text-[#FFF9E8] bg-[#241719] px-2 py-0.5 rounded border border-[#F1E194]/25">
                              {(apt as any).completionOtp}
                            </strong>
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(String((apt as any).completionOtp));
                                  setCopiedOtpId(apt.id);
                                  setTimeout(() => setCopiedOtpId(null), 2500);
                                }
                              }}
                              className="text-[10px] text-[#D4AF37] hover:text-[#FFF9E8] underline cursor-pointer ml-1"
                            >
                              {copiedOtpId === apt.id ? tr('Copied! ✓', 'कॉपी हो गया! ✓') : tr('Copy OTP', 'कॉपी OTP')}
                            </button>
                          </div>
                        )}
                      </div>

                      {onUpdateAppointment && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={async () => {
                              await onUpdateAppointment(apt.id, {
                                status: 'confirmed',
                                sendOtp: true,
                              });
                              setOtpFeedback({
                                id: apt.id,
                                text: tr(
                                  `✓ Appointment Approved! 4-digit Completion OTP sent to customer number ${apt.clientPhone || '+91'}.`,
                                  `✓ अपॉइंटमेंट स्वीकृत! 4-अंकीय पूर्णता OTP ग्राहक के नंबर ${apt.clientPhone || '+91'} पर भेज दिया गया है।`
                                ),
                              });
                            }}
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-xs font-semibold text-[#FFF9E8] cursor-pointer"
                          >
                            {tr('Approve & Send OTP', 'स्वीकृत करें और OTP भेजें')}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await onUpdateAppointment(apt.id, {
                                status: 'in_progress',
                                sendOtp: true,
                              });
                              setOtpFeedback({
                                id: apt.id,
                                text: tr(
                                  `✂️ Service Started! Ask ${apt.clientName} (${apt.clientPhone || '+91'}) for their 4-digit OTP to complete.`,
                                  `✂️ सेवा शुरू! काम पूरा होने पर ${apt.clientName} से 4-अंकीय OTP मांगें।`
                                ),
                              });
                            }}
                            className="px-3.5 py-2 rounded-[12px] bg-[#241719] border border-[#F1E194]/25 text-xs font-semibold text-[#F1E194] cursor-pointer"
                          >
                            {tr('Start Cut', 'सेवा शुरू करें')}
                          </button>
                          {String(apt.status).toLowerCase() === 'completed' ? (
                            <span className="px-3.5 py-2 rounded-[12px] bg-emerald-950 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
                              {tr('OTP Verified • Completed ✅', 'OTP सत्यापित • पूर्ण ✅')}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setOtpAptId(otpAptId === apt.id ? null : apt.id);
                                setEnteredOtp('');
                                setOtpFeedback(null);
                              }}
                              className="px-3.5 py-2 rounded-[12px] bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-400/30 text-xs font-semibold cursor-pointer"
                            >
                              {tr('Complete with OTP ✅', 'OTP से पूर्ण करें ✅')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAppointment(apt.id, { status: 'no_show' })
                            }
                            className="px-3 py-2 rounded-[12px] bg-[#241719] text-[#8A8178] hover:text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                          >
                            {tr('No-Show', 'अनुपस्थित')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAppointment(apt.id, { status: 'cancelled' })
                            }
                            className="px-3.5 py-2 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Cancel', 'रद्द करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNoteAptId(noteAptId === apt.id ? null : apt.id);
                              setNoteInput(apt.barberNotes || '');
                            }}
                            className="px-3 py-2 rounded-[12px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                          >
                            {tr('+ Note', '+ नोट')}
                          </button>
                        </div>
                      )}
                    </div>

                    {otpFeedback && otpFeedback.id === apt.id && (
                      <div
                        className={`p-3 rounded-[12px] text-xs font-semibold border ${
                          otpFeedback.isError
                            ? 'bg-[#5B0E14]/70 border-red-400/40 text-red-200'
                            : 'bg-emerald-950/70 border-emerald-400/40 text-emerald-200'
                        }`}
                      >
                        {otpFeedback.text}
                      </div>
                    )}

                    {/* Complete Appointment with Customer OTP Section */}
                    {otpAptId === apt.id &&
                      String(apt.status).toLowerCase() !== 'completed' && (
                        <div className="p-4 rounded-[14px] bg-[#241719] border border-[#D4AF37]/40 space-y-3.5 shadow-lg">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#F1E194]/15 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F1E194] bg-[#111113] px-2 py-0.5 rounded border border-[#F1E194]/20">
                                  {tr('Complete Appointment', 'अपॉइंटमेंट पूर्ण करें')}
                                </span>
                                <span className="text-xs font-mono text-[#D4AF37]">
                                  #{apt.id}
                                </span>
                              </div>
                              <h4 className="text-sm font-serif font-bold text-[#FFF9E8] mt-1">
                                {apt.serviceName} · {apt.clientName}
                              </h4>
                              <p className="text-xs text-[#8A8178] mt-0.5">
                                {apt.date} · {apt.time} IST · {apt.shopName}
                              </p>
                            </div>

                            <div className="flex flex-col sm:items-end text-xs space-y-1">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-400/30 text-emerald-300 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                {tr('Online Payment Captured', 'ऑनलाइन भुगतान प्राप्त')} (₹{apt.totalPrice || apt.price})
                              </span>
                              <span className="text-[11px] text-[#F1E194]">
                                {tr('Barber Share:', 'नाई की कमाई:')} <strong>₹{apt.servicePrice ?? (apt.price - (apt.platformFee ?? 10))}</strong> ({tr('Pending OTP Verification', 'OTP सत्यापन शेष')})
                              </span>
                            </div>
                          </div>

                          {apt.payoutHoldReason && (
                            <div className="p-2.5 rounded-[10px] bg-amber-950/70 border border-amber-400/40 text-amber-200 text-xs">
                              ⚠️ <strong>{tr('Payout Hold Active:', 'पेआउट होल्ड सक्रिय:')}</strong> {apt.payoutHoldReason}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-semibold text-[#FFF9E8] mb-1.5">
                              {tr(
                                'Enter 6-digit Customer Completion OTP (Supplied by client after service is finished):',
                                'ग्राहक से 6-अंकीय सेवा पूर्णता OTP प्राप्त कर दर्ज करें:'
                              )}
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                value={enteredOtp}
                                onChange={(e) =>
                                  setEnteredOtp(
                                    e.target.value.replace(/\D/g, '').slice(0, 6)
                                  )
                                }
                                placeholder={tr(
                                  'Enter 6-digit OTP (e.g. 849201)',
                                  '6-अंकीय OTP दर्ज करें (उदा. 849201)'
                                )}
                                className="flex-1 px-4 py-2.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/30 font-mono text-sm tracking-[0.3em] text-[#F1E194] placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-[#F1E194]"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const clean = enteredOtp.trim();
                                  if (!clean || clean.length < 4 || clean.length > 6) {
                                    setOtpFeedback({
                                      id: apt.id,
                                      isError: true,
                                      text: tr(
                                        'Please enter a valid 4 to 6-digit numeric completion OTP.',
                                        'कृपया 4 से 6 अंकों का सही पूर्णता OTP दर्ज करें।'
                                      ),
                                    });
                                    return;
                                  }
                                  try {
                                    const result = await apiVerifyCompletionOtp(apt.id, clean);
                                    if (onUpdateAppointment) {
                                      await onUpdateAppointment(apt.id, {
                                        status: 'completed',
                                        payoutStatus: 'initiated',
                                      });
                                    }
                                    setOtpAptId(null);
                                    setEnteredOtp('');
                                    setOtpFeedback({
                                      id: apt.id,
                                      text: tr(
                                        `✓ Completion OTP Verified! ${apt.clientName}'s appointment is completed and your payout (Transfer #${result.transferId || result.payout?.providerTransferId || 'initiated'}) has been dispatched!`,
                                        `✓ OTP सत्यापित! कार्य पूर्ण हुआ और आपकी कमाई का ट्रांसफर शुरू कर दिया गया!`
                                      ),
                                    });
                                  } catch (err: any) {
                                    setOtpFeedback({
                                      id: apt.id,
                                      isError: true,
                                      text: err?.message || 'Verification failed. Please check the OTP.',
                                    });
                                  }
                                }}
                                className="px-5 py-2.5 rounded-[10px] bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-semibold uppercase tracking-wider cursor-pointer shrink-0 shadow-md transition-all"
                              >
                                {tr(
                                  'Verify & Complete Appointment ✅',
                                  'सत्यापित करें और कार्य पूर्ण करें ✅'
                                )}
                              </button>
                            </div>
                            <p className="text-[11px] text-[#8A8178] mt-1.5">
                              {tr(
                                'The customer receives their 6-digit completion OTP securely in their booking view. Do not ask them for it before the haircut is completed.',
                                'ग्राहक को यह 6-अंकीय OTP उनकी बुकिंग स्क्रीन पर मिलता है। सेवा पूर्ण होने से पूर्व OTP न मांगें।'
                              )}
                            </p>
                          </div>
                        </div>
                      )}

                    {noteAptId === apt.id && onUpdateAppointment && (
                      <div className="flex gap-2 pt-2 border-t border-[#F1E194]/10">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder={tr(
                            'Add internal barber note for this customer...',
                            'इस ग्राहक के लिए आंतरिक नोट लिखें...'
                          )}
                          className="flex-1 px-3 py-2 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateAppointment(apt.id, {
                              barberNotes: noteInput.trim(),
                            });
                            setNoteAptId(null);
                          }}
                          className="px-4 py-2 rounded-[10px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
                        >
                          {tr('Save Note', 'नोट सहेजें')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICES CRUD (INR) */}
        {activeTab === 'services' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-3xl font-bold">
                {tr('Your Salon Services (INR)', 'आपकी सैलून सेवाएं (₹ INR)')}
              </h2>
              {services.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr(
                    'No services added yet. Use the form on the right to publish your first service in ₹ INR.',
                    'अभी कोई सेवा नहीं जोड़ी गई है। अपनी पहली सेवा (₹ में) जोड़ने के लिए दाईं ओर के फ़ॉर्म का उपयोग करें।'
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  {services.map((srv: any) => (
                    <div
                      key={srv.id}
                      className="rounded-[16px] bg-[#111113] border border-[#F1E194]/15 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <span className="text-[11px] text-[#F1E194] uppercase">
                            {srv.category} · {srv.durationMins || srv.durationMin}{' '}
                            {tr('mins', 'मिनट')}
                          </span>
                          <p className="font-semibold text-sm mt-0.5">
                            {srv.name}
                          </p>
                          <p className="text-xs text-[#8A8178]">
                            {srv.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-num text-lg font-bold text-[#F1E194]">
                            {formatINR(srv.price)}
                          </span>
                          {onUpdateService && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSrvId(
                                    editingSrvId === srv.id ? null : srv.id
                                  );
                                  setEditSrvName(srv.name);
                                  setEditSrvPrice(String(srv.price));
                                  setEditSrvDuration(
                                    String(srv.durationMins || srv.durationMin || 45)
                                  );
                                }}
                                className="px-2.5 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#F1E194] cursor-pointer"
                              >
                                {tr('Edit', 'संपादित')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateService(srv.id, {
                                    active: srv.active === false,
                                  })
                                }
                                className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                                  srv.active !== false
                                    ? 'bg-emerald-950 text-emerald-300'
                                    : 'bg-[#241719] text-[#8A8178]'
                                }`}
                              >
                                {srv.active !== false
                                  ? tr('Active', 'सक्रिय')
                                  : tr('Paused', 'निष्क्रिय')}
                              </button>
                            </>
                          )}
                          {onDeleteService && (
                            <button
                              type="button"
                              onClick={() => onDeleteService(srv.id)}
                              className="p-2 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {editingSrvId === srv.id && (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2 border-t border-[#F1E194]/10">
                          <input
                            type="text"
                            value={editSrvName}
                            onChange={(e) => setEditSrvName(e.target.value)}
                            placeholder={tr('Service Name', 'नाम')}
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8]"
                          />
                          <input
                            type="text"
                            value={editSrvDesc}
                            onChange={(e) => setEditSrvDesc(e.target.value)}
                            placeholder={tr('Description', 'विवरण')}
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8]"
                          />
                          <input
                            type="number"
                            value={editSrvPrice}
                            onChange={(e) => setEditSrvPrice(e.target.value)}
                            placeholder="₹ Price"
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8]"
                          />
                          <input
                            type="number"
                            value={editSrvDuration}
                            onChange={(e) => setEditSrvDuration(e.target.value)}
                            placeholder="Mins"
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveServiceEdit(srv.id)}
                            className="px-3 py-1.5 rounded-[10px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Save', 'सहेजें')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h3 className="font-display text-2xl font-bold">
                {tr('Add New Service (₹ INR)', 'नई सेवा जोड़ें (₹ INR)')}
              </h3>
              <form onSubmit={handleCreateServiceSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Service Name', 'सेवा का नाम')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newSrvName}
                    onChange={(e) => setNewSrvName(e.target.value)}
                    placeholder={tr(
                      'e.g., Signature Fade & Beard Sculpt',
                      'जैसे: सिग्नेचर फेड और बियर्ड'
                    )}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Category', 'श्रेणी')}
                  </label>
                  <select
                    value={newSrvCategory}
                    onChange={(e) => setNewSrvCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  >
                    <option value="Precision Haircuts">Precision Haircuts</option>
                    <option value="Beard Architecture">Beard Architecture</option>
                    <option value="Traditional Shaves">Traditional Shaves</option>
                    <option value="Complete Rituals">Complete Rituals</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Price in INR (₹)', 'कीमत (₹ INR)')}
                    </label>
                    <input
                      type="number"
                      required
                      min={50}
                      value={newSrvPrice}
                      onChange={(e) => setNewSrvPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Duration (Mins)', 'अवधि (मिनट)')}
                    </label>
                    <input
                      type="number"
                      required
                      min={10}
                      value={newSrvDuration}
                      onChange={(e) => setNewSrvDuration(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Description', 'विवरण')}
                  </label>
                  <textarea
                    rows={2}
                    value={newSrvDesc}
                    onChange={(e) => setNewSrvDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{tr('Publish Service', 'सेवा प्रकाशित करें')}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: BARBERS TEAM CRUD */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-3xl font-bold">
                {tr('Registered Barbers', 'पंजीकृत बार्बर')}
              </h2>
              {barbers.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr(
                    'No barbers added yet. Add your barber profile using the form on the right so customers can select you when booking.',
                    'अभी तक कोई बार्बर नहीं जोड़ा गया है। दाईं ओर के फ़ॉर्म से अपनी बार्बर प्रोफ़ाइल जोड़ें।'
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  {barbers.map((b: any) => (
                    <div
                      key={b.id}
                      className="rounded-[16px] bg-[#111113] border border-[#F1E194]/15 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-sm">{b.name}</p>
                          <p className="text-xs text-[#F1E194]">
                            {b.role} · {b.shopName}
                          </p>
                          <p className="text-[11px] text-[#8A8178]">
                            {b.specialty} · {b.experience} ·{' '}
                            {tr('Starts at', 'शुरुआती शुल्क')}{' '}
                            {formatINR(b.priceFrom)}
                          </p>
                          {b.bio && (
                            <p className="text-[11px] text-[#8A8178] mt-1">
                              {b.bio}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {onUpdateBarber && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (editingBrbId === b.id) {
                                    setEditingBrbId(null);
                                  } else {
                                    setEditingBrbId(b.id);
                                    setEditBrbName(b.name || '');
                                    setEditBrbRole(b.role || 'Master Barber');
                                    setEditBrbSpecialty(b.specialty || '');
                                    setEditBrbExp(String(b.experienceYears || 5));
                                    setEditBrbBio(b.bio || '');
                                    setEditBrbImage(b.image || b.avatar || '');
                                    setEditBrbServices(b.assignedServiceIds || '');
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-[10px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                              >
                                {tr('Edit Profile & Portfolio', 'प्रोफ़ाइल संपादित करें')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBarber(b.id, {
                                    chairBreakActive: !b.chairBreakActive,
                                  })
                                }
                                className={`px-2.5 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                                  b.chairBreakActive
                                    ? 'bg-[#5B0E14] text-[#F1E194]'
                                    : 'bg-[#241719] text-[#8A8178]'
                                }`}
                              >
                                {b.chairBreakActive
                                  ? tr('On Break', 'चेयर ब्रेक पर')
                                  : tr('Take Break', 'ब्रेक लें')}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBarber(b.id, { active: b.active === false })
                                }
                                className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer ${
                                  b.active !== false
                                    ? 'bg-emerald-950 text-emerald-300'
                                    : 'bg-[#241719] text-[#8A8178]'
                                }`}
                              >
                                {b.active !== false
                                  ? tr('Active', 'सक्रिय')
                                  : tr('Off Duty', 'छुट्टी पर')}
                              </button>
                            </>
                          )}
                          {onDeleteBarber && (
                            <button
                              type="button"
                              onClick={() => onDeleteBarber(b.id)}
                              className="p-2 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {editingBrbId === b.id && onUpdateBarber && (
                        <div className="pt-3 border-t border-[#F1E194]/15 space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editBrbName}
                              onChange={(e) => setEditBrbName(e.target.value)}
                              placeholder={tr('Full Name', 'पूरा नाम')}
                              className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                            />
                            <input
                              type="text"
                              value={editBrbRole}
                              onChange={(e) => setEditBrbRole(e.target.value)}
                              placeholder={tr('Role / Title', 'पद')}
                              className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                            />
                            <input
                              type="number"
                              value={editBrbExp}
                              onChange={(e) => setEditBrbExp(e.target.value)}
                              placeholder={tr('Experience (Yrs)', 'अनुभव')}
                              className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editBrbSpecialty}
                              onChange={(e) => setEditBrbSpecialty(e.target.value)}
                              placeholder={tr('Specializations', 'विशेषज्ञता')}
                              className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                            />
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={editBrbImage}
                                onChange={(e) => setEditBrbImage(e.target.value)}
                                placeholder={tr('Profile Photo URL', 'फोटो URL')}
                                className="flex-1 px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <label className="px-3 py-2 rounded-[10px] bg-[#5B0E14] text-[#F1E194] font-semibold cursor-pointer flex items-center">
                                <span>{tr('Upload', 'अपलोड')}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await uploadImageToSupabaseStorage(
                                        file,
                                        'barbers'
                                      );
                                      setEditBrbImage(url);
                                    }
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={editBrbBio}
                            onChange={(e) => setEditBrbBio(e.target.value)}
                            placeholder={tr('Barber Bio', 'बार्बर परिचय')}
                            className="w-full px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <input
                              type="text"
                              value={editBrbServices}
                              onChange={(e) => setEditBrbServices(e.target.value)}
                              placeholder={tr(
                                'Assigned Services (e.g., Skin Fade, Beard Sculpt)',
                                'असाइन की गई सेवाएं'
                              )}
                              className="flex-1 px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateBarber(b.id, {
                                  name: editBrbName.trim(),
                                  role: editBrbRole.trim(),
                                  specialty: editBrbSpecialty.trim(),
                                  experienceYears: Number(editBrbExp) || 5,
                                  bio: editBrbBio.trim(),
                                  image: editBrbImage.trim(),
                                  assignedServiceIds: editBrbServices.trim(),
                                });
                                setEditingBrbId(null);
                              }}
                              className="px-4 py-2 rounded-[10px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                            >
                              {tr('Save Barber Profile', 'प्रोफ़ाइल सहेजें')}
                            </button>
                          </div>

                          {onCreateBarberGalleryItem && (
                            <div className="pt-2 border-t border-[#F1E194]/10 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={portfolioTitle}
                                onChange={(e) => setPortfolioTitle(e.target.value)}
                                placeholder={tr('Portfolio Look Title', 'पोर्टफोलियो शीर्षक')}
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <input
                                type="text"
                                value={portfolioTag}
                                onChange={(e) => setPortfolioTag(e.target.value)}
                                placeholder={tr('Style Tag', 'स्टाइल टैग')}
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <input
                                type="text"
                                value={portfolioImage}
                                onChange={(e) => setPortfolioImage(e.target.value)}
                                placeholder={tr('Portfolio Image URL', 'फोटो URL')}
                                className="flex-1 px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <label className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] font-semibold cursor-pointer">
                                <span>{tr('Upload', 'अपलोड')}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await uploadImageToSupabaseStorage(
                                        file,
                                        'portfolio'
                                      );
                                      setPortfolioImage(url);
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!portfolioTitle.trim()) return;
                                  await onCreateBarberGalleryItem({
                                    barberId: b.id,
                                    title: portfolioTitle.trim(),
                                    styleTag: portfolioTag.trim(),
                                    imageUrl: portfolioImage.trim(),
                                  });
                                  setPortfolioTitle('');
                                  setPortfolioImage('');
                                }}
                                className="px-3.5 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] font-semibold cursor-pointer"
                              >
                                {tr('+ Add Portfolio Work', '+ पोर्टफोलियो जोड़ें')}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h3 className="font-display text-2xl font-bold">
                {tr('Add Barber Profile', 'बार्बर प्रोफ़ाइल जोड़ें')}
              </h3>
              <form onSubmit={handleCreateBarberSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Barber Full Name', 'बार्बर का नाम')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBrbName}
                    onChange={(e) => setNewBrbName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Title / Role', 'पद / भूमिका')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBrbRole}
                    onChange={(e) => setNewBrbRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Specialty', 'विशेषज्ञता')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newBrbSpecialty}
                    onChange={(e) => setNewBrbSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Experience (Yrs)', 'अनुभव (वर्ष)')}
                    </label>
                    <input
                      type="number"
                      required
                      value={newBrbExp}
                      onChange={(e) => setNewBrbExp(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Starting Price (₹)', 'शुरुआती कीमत (₹)')}
                    </label>
                    <input
                      type="number"
                      required
                      value={newBrbPrice}
                      onChange={(e) => setNewBrbPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Bio / Portfolio Summary', 'संक्षिप्त परिचय')}
                  </label>
                  <textarea
                    rows={2}
                    value={newBrbBio}
                    onChange={(e) => setNewBrbBio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  {tr('+ Add Barber Profile', '+ बार्बर जोड़ें')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: BARBER SCHEDULE & WORKING HOURS (IST) */}
        {activeTab === 'schedule' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-3xl font-bold">
              {tr(
                'Barber Schedule & Working Hours (IST)',
                'बार्बर कार्य समय और छुट्टियां (IST)'
              )}
            </h2>
            <div className="space-y-3">
              {workingHours.map(
                (wh: any) => (
                  <div
                    key={wh.id || wh.day}
                    className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm text-[#FFF9E8]">
                          {wh.dayOfWeek || wh.day}
                        </p>
                        <p className="text-[#8A8178] font-mono-num">
                          {wh.isDayOff
                            ? tr('Day Off / Closed', 'साप्ताहिक अवकाश / बंद')
                            : `${wh.startTime || '09:30'} – ${
                                wh.endTime || '21:30'
                              } IST · Break: ${wh.breakStart || '14:00'} – ${
                                wh.breakEnd || '14:45'
                              }`}
                          {wh.holidayNote ? ` · ${wh.holidayNote}` : ''}
                        </p>
                      </div>
                      {onUpdateWorkingHours && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingWhId === wh.id) {
                                setEditingWhId(null);
                              } else {
                                setEditingWhId(wh.id);
                                setWhStart(wh.startTime || '09:30');
                                setWhEnd(wh.endTime || '21:30');
                                setWhBreakStart(wh.breakStart || '14:00');
                                setWhBreakEnd(wh.breakEnd || '14:45');
                                setWhHolidayNote(wh.holidayNote || '');
                              }
                            }}
                            className="px-3 py-2 rounded-[12px] bg-[#241719] text-[#F1E194] font-semibold cursor-pointer"
                          >
                            {tr('Configure Hours & Breaks', 'समय और ब्रेक बदलें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateWorkingHours(wh.id, {
                                dayOfWeek: wh.dayOfWeek || wh.day,
                                isDayOff: !wh.isDayOff,
                              })
                            }
                            className={`px-3.5 py-2 rounded-[12px] font-semibold cursor-pointer ${
                              wh.isDayOff
                                ? 'bg-[#5B0E14] text-[#FFF9E8]'
                                : 'bg-emerald-950 text-emerald-300'
                            }`}
                          >
                            {wh.isDayOff
                              ? tr('Closed (Mark Open)', 'बंद (खोलें)')
                              : tr('Open (Mark Day Off)', 'खुला है (अवकाश करें)')}
                          </button>
                        </div>
                      )}
                    </div>

                    {editingWhId === wh.id && onUpdateWorkingHours && (
                      <div className="pt-3 border-t border-[#F1E194]/15 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                        <div>
                          <label className="block text-[10px] text-[#8A8178] mb-1">
                            {tr('Start Time', 'शुरू समय')}
                          </label>
                          <input
                            type="text"
                            value={whStart}
                            onChange={(e) => setWhStart(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8A8178] mb-1">
                            {tr('End Time', 'समाप्ति समय')}
                          </label>
                          <input
                            type="text"
                            value={whEnd}
                            onChange={(e) => setWhEnd(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8A8178] mb-1">
                            {tr('Break Start', 'ब्रेक शुरू')}
                          </label>
                          <input
                            type="text"
                            value={whBreakStart}
                            onChange={(e) => setWhBreakStart(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8A8178] mb-1">
                            {tr('Break End', 'ब्रेक समाप्त')}
                          </label>
                          <input
                            type="text"
                            value={whBreakEnd}
                            onChange={(e) => setWhBreakEnd(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#8A8178] mb-1">
                            {tr('Holiday / Note', 'छुट्टी / नोट')}
                          </label>
                          <input
                            type="text"
                            value={whHolidayNote}
                            onChange={(e) => setWhHolidayNote(e.target.value)}
                            placeholder="e.g., Festival Hours"
                            className="w-full px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateWorkingHours(wh.id, {
                              dayOfWeek: wh.dayOfWeek || wh.day,
                              startTime: whStart,
                              endTime: whEnd,
                              breakStart: whBreakStart,
                              breakEnd: whBreakEnd,
                              holidayNote: whHolidayNote,
                            });
                            setEditingWhId(null);
                          }}
                          className="px-3 py-1.5 rounded-[8px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                        >
                          {tr('Save Hours', 'सहेजें')}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CUSTOMER DIRECTORY & VISIT HISTORY */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            {onBroadcastShopNotification && (
              <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
                <div>
                  <h3 className="font-display text-2xl font-bold text-[#FFF9E8]">
                    {tr(
                      'Create Broadcast Message (Customer or Barber)',
                      'ब्रॉडकास्ट संदेश भेजें (ग्राहक या बार्बर चुनें)'
                    )}
                  </h3>
                  <p className="text-xs text-[#8A8178] mt-0.5">
                    {tr(
                      'Send a real-time notification to your choice of Customers, Barbers, Everyone, or a specific individual.',
                      'अपनी पसंद के अनुसार ग्राहकों, बार्बर या किसी विशेष व्यक्ति को संदेश भेजें।'
                    )}
                  </p>
                </div>
                {broadcastStatusToast && (
                  <div className="p-3 rounded-[12px] bg-[#111113] border border-[#F1E194]/35 text-xs text-[#F1E194] font-semibold">
                    {broadcastStatusToast}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      id: 'customer',
                      label: tr('All Customers', 'सभी ग्राहक (Customers)'),
                    },
                    {
                      id: 'barber',
                      label: tr('All Barbers', 'सभी बार्बर (Barbers)'),
                    },
                    {
                      id: 'all',
                      label: tr(
                        'Everyone (Customers & Barbers)',
                        'सभी (ग्राहक और बार्बर)'
                      ),
                    },
                    {
                      id: 'specific',
                      label: tr(
                        'Specific Customer / Barber',
                        'विशेष ग्राहक या बार्बर'
                      ),
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBroadcastTargetRole(opt.id as any)}
                      className={`px-3.5 py-2 rounded-[12px] text-xs font-semibold cursor-pointer ${
                        broadcastTargetRole === opt.id
                          ? 'bg-[#F1E194] text-[#111113]'
                          : 'bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {broadcastTargetRole === 'specific' && profiles.length > 0 && (
                  <select
                    value={broadcastSpecificUid}
                    onChange={(e) => setBroadcastSpecificUid(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  >
                    {profiles.map((p: any) => (
                      <option key={p.uid} value={p.uid}>
                        [{String(p.role || 'customer').toUpperCase()}] {p.name} (
                        {p.email})
                      </option>
                    ))}
                  </select>
                )}
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={shopAnnouncement}
                    onChange={(e) => setShopAnnouncement(e.target.value)}
                    placeholder={tr(
                      'Write your broadcast message for the selected audience...',
                      'चयनित ग्राहकों या बार्बर के लिए अपना ब्रॉडकास्ट संदेश लिखें...'
                    )}
                    className="flex-1 px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!shopAnnouncement.trim()) return;
                      await onBroadcastShopNotification({
                        shopName:
                          activeShop?.name ||
                          currentUserProfile?.name ||
                          'BarberLoo Salon',
                        message: shopAnnouncement.trim(),
                        targetRole: broadcastTargetRole,
                        specificUid:
                          broadcastTargetRole === 'specific'
                            ? broadcastSpecificUid || profiles[0]?.uid
                            : undefined,
                      });
                      setShopAnnouncement('');
                      setBroadcastStatusToast(
                        tr(
                          '✓ Broadcast sent in real time!',
                          '✓ ब्रॉडकास्ट संदेश भेज दिया गया!'
                        )
                      );
                      setTimeout(() => setBroadcastStatusToast(''), 3500);
                    }}
                    className="px-5 py-2.5 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {tr('Send Broadcast', 'ब्रॉडकास्ट भेजें')}
                  </button>
                </div>
              </div>
            )}

          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-3xl font-bold">
              {tr('Client History & Notes', 'ग्राहक इतिहास और नोट्स')} (
              {customerDirectory.length})
            </h2>
            {customerDirectory.length === 0 ? (
              <p className="text-xs text-[#8A8178] py-6">
                {tr(
                  'Customer records will appear here automatically once clients book appointments.',
                  'जैसे ही ग्राहक अपॉइंटमेंट बुक करेंगे, उनका विवरण यहां दिखाई देगा।'
                )}
              </p>
            ) : (
              <div className="space-y-3">
                {customerDirectory.map((c) => (
                  <div
                    key={c.key}
                    className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm text-[#FFF9E8]">
                          {c.name} ({c.phone})
                        </p>
                        <p className="text-[#8A8178]">
                          {tr('Services:', 'सेवाएं:')} {c.services.join(', ')}
                        </p>
                        {c.lastNote && (
                          <p className="text-[#F1E194] mt-1">
                            {tr('Internal Note:', 'नोट:')} {c.lastNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {onUpdateAppointment && (
                          <button
                            type="button"
                            onClick={() => {
                              setNoteAptId(
                                noteAptId === c.lastAptId ? null : c.lastAptId
                              );
                              setNoteInput(c.lastNote || '');
                            }}
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#F1E194] font-semibold cursor-pointer"
                          >
                            {tr('+ Internal Note', '+ आंतरिक नोट')}
                          </button>
                        )}
                        <div className="text-right font-mono-num">
                          <span className="text-[#F1E194] font-bold block">
                            {formatINR(c.totalSpent)}
                          </span>
                          <span className="text-[#8A8178]">
                            {c.visits} {tr('visits', 'विज़िट')}
                          </span>
                        </div>
                      </div>
                    </div>
                    {noteAptId === c.lastAptId && onUpdateAppointment && (
                      <div className="pt-2 border-t border-[#F1E194]/10 flex gap-2">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(e) => setNoteInput(e.target.value)}
                          placeholder={tr(
                            'Add internal barber note for this customer...',
                            'इस ग्राहक के लिए आंतरिक बार्बर नोट लिखें...'
                          )}
                          className="flex-1 px-3 py-1.5 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8]"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await onUpdateAppointment(c.lastAptId, {
                              barberNotes: noteInput,
                            });
                            setNoteAptId(null);
                          }}
                          className="px-3.5 py-1.5 rounded-[10px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                        >
                          {tr('Save Note', 'सहेजें')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        )}

        {/* TAB 7: REVENUE & ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Performance & Booking Metrics', 'प्रदर्शन और बुकिंग मेट्रिक्स')}
              </h2>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Completed Cuts', 'पूर्ण सेवाएं')}
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-emerald-400">
                    {completedApts.length}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Completed Revenue', 'पूर्ण राजस्व')}
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-[#F1E194]">
                    {formatINR(completedRevenueINR)}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Cancelled / No-Show', 'रद्द / अनुपस्थित')}
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-[#FFF9E8]">
                    {cancelledApts.length} / {noShowApts.length}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Returning Clients', 'लौटने वाले ग्राहक')}
                  </span>
                  <span className="font-mono-num text-2xl font-bold text-[#F1E194]">
                    {customerDirectory.filter((c) => c.visits > 1).length}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Daily / Monthly Revenue', 'दैनिक / मासिक राजस्व')}
                  </span>
                  <span className="font-mono-num text-lg font-bold text-[#F1E194]">
                    {formatINR(dailyRevenueINR)} / {formatINR(monthlyRevenueINR)}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113]">
                  <span className="text-[#8A8178] block">
                    {tr('Peak Hour & Cancel Rate', 'पीक समय और रद्दीकरण दर')}
                  </span>
                  <span className="font-mono-num text-lg font-bold text-[#FFF9E8]">
                    {peakBookingHour} · {cancellationRatePct}%
                  </span>
                </div>
                {(() => {
                  const slaSummary = calculatePlatformSlaSummary(
                    appointments,
                    []
                  );
                  return (
                    <>
                      <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/20">
                        <span className="text-[#8A8178] block">
                          {tr(
                            '🛡️ Salon SLA Compliance Score',
                            '🛡️ सैलून SLA अनुपालन स्कोर'
                          )}
                        </span>
                        <span className="font-mono-num text-2xl font-bold text-emerald-400">
                          {slaSummary.overallScorePercent}%
                        </span>
                        <span className="text-[10px] text-[#8A8178] block mt-0.5">
                          {tr(
                            `15m Chair SLA: ${slaSummary.appointmentSlaPercent}% · On-Time Guarantee`,
                            `15m चेयर SLA: ${slaSummary.appointmentSlaPercent}% · समय पर सेवा गारंटी`
                          )}
                        </span>
                      </div>
                      <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/20">
                        <span className="text-[#8A8178] block">
                          {tr(
                            'SLA Status (Met / At Risk / Breached)',
                            'SLA स्थिति (पूर्ण / जोखिम / उल्लंघन)'
                          )}
                        </span>
                        <span className="font-mono-num text-lg font-bold text-[#F1E194]">
                          {slaSummary.metCount + slaSummary.onTrackCount} OK ·{' '}
                          {slaSummary.atRiskCount} Risk ·{' '}
                          <span
                            className={
                              slaSummary.breachedCount > 0
                                ? 'text-red-400'
                                : 'text-emerald-400'
                            }
                          >
                            {slaSummary.breachedCount} Breached
                          </span>
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Revenue by Service (INR)', 'सेवा के अनुसार राजस्व (₹)')}
              </h2>
              {serviceRevenueList.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr('No service revenue recorded yet.', 'अभी कोई राजस्व दर्ज नहीं है।')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {serviceRevenueList.map((sr) => (
                    <div
                      key={sr.name}
                      className="p-3.5 rounded-[14px] bg-[#111113] flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#FFF9E8]">{sr.name}</p>
                        <p className="text-[#8A8178]">
                          {sr.count} {tr('bookings', 'बुकिंग')}
                        </p>
                      </div>
                      <span className="font-mono-num font-bold text-[#F1E194]">
                        {formatINR(sr.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: SALON REGISTRATION & MANAGEMENT */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-3xl font-bold">
                {tr('Registered Salons', 'पंजीकृत सैलून')}
              </h2>
              {shops.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr(
                    'No barbershop registered yet. Register your salon on the right to make it live across BarberLoo India.',
                    'अभी तक कोई सैलून पंजीकृत नहीं है। दाईं ओर दिए गए फ़ॉर्म से अपना सैलून पंजीकृत करें।'
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  {shops.map((s: any) => (
                    <div
                      key={s.id}
                      className="rounded-[16px] bg-[#111113] border border-[#F1E194]/15 p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="font-display text-2xl font-bold">
                            {s.name}
                          </p>
                          <p className="text-xs text-[#F1E194]">{s.district}</p>
                          <p className="text-xs text-[#8A8178] mt-1">
                            {s.address} · {s.phone} ·{' '}
                            {tr('Closes at', 'बंद होने का समय')} {s.closesAt || '21:30'} IST
                          </p>
                          <p className="text-[11px] font-mono-num text-[#F1E194]/80 mt-1 break-all">
                            QR Destination: {getShopQrDestinationUrl(s.id, { domain: getProductionDomain(platformSettings) })}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedQrShop(s)}
                            className="px-3.5 py-2 rounded-[12px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-[#73121a] transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>{tr('Salon QR Pass & Standee', 'सैलून QR पास व स्टैंडी')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingShopId === s.id) {
                                setEditingShopId(null);
                              } else {
                                setEditingShopId(s.id);
                                setEditShopName(s.name || '');
                                setEditShopDistrict(s.district || '');
                                setEditShopAddress(s.address || '');
                                setEditShopCity(s.city || (s.district ? s.district.split(',')[0].trim() : 'Ludhiana'));
                                setEditShopState(s.state || 'Punjab');
                                setEditShopPinCode(s.pinCode || s.pin_code || '');
                                setEditShopLandmark(s.landmark || '');
                                setEditShopLatitude(s.latitude || '');
                                setEditShopLongitude(s.longitude || '');
                                setEditShopPhone(s.phone || '');
                                setEditShopClosesAt(s.closesAt || '21:30');
                                setEditShopImage(s.image || '');
                                setEditShopAbout(s.about || '');
                              }
                            }}
                            className="px-3.5 py-2 rounded-[12px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Edit Salon / Gallery / Offers', 'सैलून / गैलरी / ऑफ़र')}
                          </button>
                          {onUpdateShop && (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateShop(s.id, { isOpen: !s.isOpen })
                              }
                              className={`px-4 py-2 rounded-[12px] text-xs font-semibold cursor-pointer ${
                                s.isOpen
                                  ? 'bg-emerald-900/80 text-emerald-200'
                                  : 'bg-[#5B0E14] text-[#FFF9E8]'
                              }`}
                            >
                              {s.isOpen
                                ? tr('Open (Click to Close)', 'खुला है')
                                : tr('Closed (Click to Open)', 'बंद है')}
                            </button>
                          )}
                        </div>
                      </div>

                      {editingShopId === s.id && (
                        <div className="pt-4 border-t border-[#F1E194]/15 space-y-4 text-xs">
                          {onUpdateShop && (
                            <div className="space-y-4">
                              <p className="font-semibold text-[#F1E194] uppercase tracking-wider">
                                {tr('Update Salon Details & Cover Image', 'सैलून विवरण अपडेट करें')}
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={editShopName}
                                  onChange={(e) => setEditShopName(e.target.value)}
                                  placeholder={tr('Shop Name', 'सैलून नाम')}
                                  className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                />
                                <input
                                  type="text"
                                  value={editShopDistrict}
                                  onChange={(e) => setEditShopDistrict(e.target.value)}
                                  placeholder={tr('City / District', 'शहर')}
                                  className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                />
                                <input
                                  type="text"
                                  value={editShopPhone}
                                  onChange={(e) => setEditShopPhone(e.target.value)}
                                  placeholder={tr('Phone', 'फ़ोन')}
                                  className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                />
                              </div>

                              {/* Interactive Location Picker for Owner */}
                              <div className="p-4 rounded-2xl bg-[#1C1718] border border-[#F1E194]/20 space-y-2">
                                <p className="font-semibold text-[#F1E194] uppercase tracking-wider text-xs">
                                  {tr('Shop Location Setup & Entrance Pin', 'सैलून स्थान और मैप पिन')}
                                </p>
                                <BarberLocationPicker
                                  address={editShopAddress}
                                  city={editShopCity}
                                  state={editShopState}
                                  pinCode={editShopPinCode}
                                  landmark={editShopLandmark}
                                  latitude={editShopLatitude}
                                  longitude={editShopLongitude}
                                  onChange={(fields) => {
                                    if (fields.address !== undefined) setEditShopAddress(fields.address);
                                    if (fields.city !== undefined) setEditShopCity(fields.city);
                                    if (fields.state !== undefined) setEditShopState(fields.state);
                                    if (fields.pinCode !== undefined) setEditShopPinCode(fields.pinCode);
                                    if (fields.landmark !== undefined) setEditShopLandmark(fields.landmark);
                                    if (fields.latitude !== undefined) setEditShopLatitude(fields.latitude);
                                    if (fields.longitude !== undefined) setEditShopLongitude(fields.longitude);
                                  }}
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={editShopClosesAt}
                                  onChange={(e) => setEditShopClosesAt(e.target.value)}
                                  placeholder={tr('Closes At (e.g. 21:30)', 'बंद होने का समय')}
                                  className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editShopImage}
                                    onChange={(e) => setEditShopImage(e.target.value)}
                                    placeholder={tr('Cover / Logo URL', 'फोटो URL')}
                                    className="flex-1 px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                  />
                                  <label className="px-3 py-2 rounded-[10px] bg-[#5B0E14] text-[#F1E194] font-semibold cursor-pointer flex items-center">
                                    <span>{tr('Upload', 'अपलोड')}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const url = await uploadImageToSupabaseStorage(
                                            file,
                                            'shops'
                                          );
                                          setEditShopImage(url);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editShopAbout}
                                  onChange={(e) => setEditShopAbout(e.target.value)}
                                  placeholder={tr('Description / About Salon', 'सैलून विवरण')}
                                  className="flex-1 px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onUpdateShop(s.id, {
                                      name: editShopName.trim(),
                                      district: editShopDistrict.trim() || `${editShopCity.trim()}, ${editShopState.trim()}`,
                                      city: editShopCity.trim(),
                                      state: editShopState.trim(),
                                      address: editShopAddress.trim(),
                                      pinCode: editShopPinCode.trim(),
                                      landmark: editShopLandmark.trim(),
                                      latitude: editShopLatitude.trim(),
                                      longitude: editShopLongitude.trim(),
                                      phone: editShopPhone.trim(),
                                      closesAt: editShopClosesAt.trim(),
                                      image: editShopImage.trim(),
                                      about: editShopAbout.trim(),
                                    });
                                    setEditingShopId(null);
                                  }}
                                  className="px-5 py-2.5 rounded-[12px] bg-[#F1E194] text-[#111113] font-bold cursor-pointer hover:bg-[#FFF9E8] transition shadow"
                                >
                                  {tr('Save Salon & Location', 'सैलून व लोकेशन सहेजें')}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Add Shop Gallery Photo */}
                          {onCreateShopGalleryItem && (
                            <div className="pt-3 border-t border-[#F1E194]/10 flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={galleryTitle}
                                onChange={(e) => setGalleryTitle(e.target.value)}
                                placeholder={tr('Gallery Photo Title', 'गैलरी फोटो शीर्षक')}
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <input
                                type="text"
                                value={galleryImage}
                                onChange={(e) => setGalleryImage(e.target.value)}
                                placeholder={tr('Gallery Image URL', 'फोटो URL')}
                                className="flex-1 px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <label className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] font-semibold cursor-pointer">
                                <span>{tr('Upload', 'अपलोड')}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const url = await uploadImageToSupabaseStorage(
                                        file,
                                        'shop-gallery'
                                      );
                                      setGalleryImage(url);
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!galleryTitle.trim()) return;
                                  await onCreateShopGalleryItem({
                                    shopId: s.id,
                                    title: galleryTitle.trim(),
                                    imageUrl: galleryImage.trim(),
                                  });
                                  setGalleryTitle('');
                                  setGalleryImage('');
                                }}
                                className="px-3.5 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] font-semibold cursor-pointer"
                              >
                                {tr('+ Add Gallery Photo', '+ गैलरी फोटो जोड़ें')}
                              </button>
                            </div>
                          )}

                          {/* Important Shop Notification Broadcast */}
                          {onBroadcastShopNotification && (
                            <div className="pt-3 border-t border-[#F1E194]/10 flex flex-wrap items-center gap-2">
                              <select
                                value={broadcastTargetRole}
                                onChange={(e) =>
                                  setBroadcastTargetRole(e.target.value as any)
                                }
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#F1E194] font-semibold"
                              >
                                <option value="customer">
                                  {tr('To: Customers', 'ग्राहकों को')}
                                </option>
                                <option value="barber">
                                  {tr('To: Barbers', 'बार्बर को')}
                                </option>
                                <option value="all">
                                  {tr('To: Everyone', 'सभी को')}
                                </option>
                              </select>
                              <input
                                type="text"
                                value={shopAnnouncement}
                                onChange={(e) => setShopAnnouncement(e.target.value)}
                                placeholder={tr(
                                  'Send broadcast notification to chosen audience...',
                                  'चयनित समूह को ब्रॉडकास्ट सूचना भेजें...'
                                )}
                                className="flex-1 px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!shopAnnouncement.trim()) return;
                                  await onBroadcastShopNotification({
                                    shopName: s.name,
                                    message: shopAnnouncement.trim(),
                                    targetRole: broadcastTargetRole,
                                  });
                                  setShopAnnouncement('');
                                }}
                                className="px-3.5 py-1.5 rounded-[10px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                              >
                                {tr('Send Broadcast', 'ब्रॉडकास्ट भेजें')}
                              </button>
                            </div>
                          )}

                          {/* Shop Offers Management */}
                          {onCreateCoupon && (
                            <div className="pt-3 border-t border-[#F1E194]/10 space-y-2.5">
                              <p className="font-semibold text-[#F1E194] uppercase tracking-wider">
                                {tr('Salon Offers & Promo Codes', 'सैलून ऑफ़र और कूपन')}
                              </p>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                <input
                                  type="text"
                                  value={offerCode}
                                  onChange={(e) => setOfferCode(e.target.value)}
                                  placeholder="CODE (e.g. ROYAL20)"
                                  className="px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] uppercase font-mono-num"
                                />
                                <input
                                  type="number"
                                  value={offerDiscount}
                                  onChange={(e) => setOfferDiscount(e.target.value)}
                                  placeholder="Discount %"
                                  className="px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                                />
                                <input
                                  type="number"
                                  value={offerMinSpend}
                                  onChange={(e) => setOfferMinSpend(e.target.value)}
                                  placeholder="Min ₹"
                                  className="px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                                />
                                <input
                                  type="date"
                                  value={offerExpiry}
                                  onChange={(e) => setOfferExpiry(e.target.value)}
                                  className="px-2.5 py-1.5 rounded-[8px] bg-[#241719] text-[#FFF9E8] font-mono-num"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!offerCode.trim()) return;
                                    await onCreateCoupon({
                                      shopId: s.id,
                                      code: offerCode.trim().toUpperCase(),
                                      discountPercent: Number(offerDiscount) || 15,
                                      minSpend: Number(offerMinSpend) || 500,
                                      expiresAt: offerExpiry,
                                    });
                                    setOfferCode('');
                                  }}
                                  className="px-3 py-1.5 rounded-[8px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                                >
                                  {tr('+ Create Offer', '+ ऑफ़र बनाएं')}
                                </button>
                              </div>
                              {coupons.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  {coupons.map((cpn: any) => (
                                    <div
                                      key={cpn.id}
                                      className="p-2.5 rounded-[10px] bg-[#241719] flex items-center justify-between"
                                    >
                                      <span className="font-mono-num">
                                        <strong className="text-[#F1E194]">
                                          {cpn.code}
                                        </strong>{' '}
                                        · {cpn.discountPercent}% Off · Min{' '}
                                        {formatINR(cpn.minSpend)} · Exp:{' '}
                                        {cpn.expiresAt || cpn.expiryDate}
                                      </span>
                                      {onUpdateCoupon && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onUpdateCoupon(cpn.id, {
                                              status:
                                                cpn.status === 'Active'
                                                  ? 'Paused'
                                                  : 'Active',
                                            })
                                          }
                                          className={`px-2.5 py-1 rounded-[8px] font-semibold cursor-pointer ${
                                            cpn.status === 'Active'
                                              ? 'bg-emerald-950 text-emerald-300'
                                              : 'bg-[#5B0E14] text-[#FFF9E8]'
                                          }`}
                                        >
                                          {cpn.status}
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <h3 className="font-display text-2xl font-bold">
                {tr('Register New Barbershop', 'नया सैलून पंजीकृत करें')}
              </h3>
              <form onSubmit={handleCreateShopSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Salon Name', 'सैलून का नाम')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    placeholder={tr(
                      'e.g., The Royal Barber Mumbai',
                      'जैसे: द रॉयल बार्बर मुंबई'
                    )}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('State', 'राज्य')}
                    </label>
                    <select
                      value={newShopStateId}
                      onChange={(e) => handleNewShopStateChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8] cursor-pointer"
                    >
                      {DEFAULT_STATES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('City', 'शहर')}
                    </label>
                    <select
                      value={newShopCityId}
                      onChange={(e) => {
                        setNewShopCityId(e.target.value);
                        const c = getCitiesForState(newShopStateId).find((ct) => ct.id === e.target.value);
                        if (c) setNewShopCity(c.name);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8] cursor-pointer"
                    >
                      {getCitiesForState(newShopStateId).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Interactive Location Picker & Map Preview for Registration */}
                <div className="p-4 rounded-2xl bg-[#1C1718] border border-[#F1E194]/20 space-y-2">
                  <p className="font-semibold text-[#F1E194] uppercase tracking-wider text-xs">
                    {tr('Shop Location Setup & Entrance Pin', 'सैलून स्थान और मैप पिन')}
                  </p>
                  <BarberLocationPicker
                    address={newShopAddress}
                    city={newShopCity}
                    state={newShopState}
                    pinCode={newShopPinCode}
                    landmark={newShopLandmark}
                    latitude={newShopLatitude}
                    longitude={newShopLongitude}
                    onChange={(fields) => {
                      if (fields.address !== undefined) setNewShopAddress(fields.address);
                      if (fields.city !== undefined) setNewShopCity(fields.city);
                      if (fields.state !== undefined) setNewShopState(fields.state);
                      if (fields.pinCode !== undefined) setNewShopPinCode(fields.pinCode);
                      if (fields.landmark !== undefined) setNewShopLandmark(fields.landmark);
                      if (fields.latitude !== undefined) setNewShopLatitude(fields.latitude);
                      if (fields.longitude !== undefined) setNewShopLongitude(fields.longitude);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Contact Phone', 'फ़ोन नंबर')}
                    </label>
                    <input
                      type="text"
                      required
                      value={newShopPhone}
                      onChange={(e) => setNewShopPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Starting Price (₹)', 'शुरुआती शुल्क (₹)')}
                    </label>
                    <input
                      type="number"
                      required
                      value={newShopMinPrice}
                      onChange={(e) => setNewShopMinPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Salon Tagline', 'सैलून टैगलाइन')}
                  </label>
                  <input
                    type="text"
                    value={newShopTagline}
                    onChange={(e) => setNewShopTagline(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('About Salon', 'सैलून का विवरण')}
                  </label>
                  <textarea
                    rows={2}
                    value={newShopAbout}
                    onChange={(e) => setNewShopAbout(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  {tr('+ Register Salon on BarberLoo', '+ सैलून पंजीकृत करें')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Salon QR Standee & Pass Modal */}
      <SalonQrModal
        shop={selectedQrShop}
        isOpen={Boolean(selectedQrShop)}
        onClose={() => setSelectedQrShop(null)}
        platformSettings={platformSettings}
      />

      {/* Walk-in / Direct Client Booking Modal */}
      {isWalkInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-xl w-full rounded-[24px] bg-[#1a1113] border border-[#F1E194]/30 p-6 sm:p-8 space-y-5 text-[#FFF9E8] shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1E194]/15">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#F1E194] bg-[#241719] px-2.5 py-0.5 rounded border border-[#F1E194]/20">
                  {tr('BARBER & SALON CONSOLE', 'बार्बर और सैलून कंसोल')}
                </span>
                <h3 className="font-display text-2xl font-bold mt-1 text-[#FFF9E8]">
                  {tr('Book Client / Walk-in Appointment', 'ग्राहक अपॉइंटमेंट / वॉक-इन बुक करें')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsWalkInModalOpen(false)}
                className="p-2 rounded-full bg-[#111113] hover:bg-[#241719] text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {walkInError && (
              <div className="p-3.5 rounded-[12px] bg-[#5B0E14] border border-red-400/40 text-xs text-red-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
                <span>{walkInError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWalkInBooking} className="space-y-4 text-xs">
              {/* Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Client Full Name *', 'ग्राहक का पूरा नाम *')}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={walkInClientName}
                    onChange={(e) => setWalkInClientName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  />
                </div>
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Client Phone Number *', 'ग्राहक का फ़ोन नंबर *')}
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98765 43210"
                    value={walkInClientPhone}
                    onChange={(e) => setWalkInClientPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  />
                </div>
              </div>

              {/* Service & Barber Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Select Service *', 'सेवा चुनें *')}
                  </label>
                  <select
                    value={walkInServiceId}
                    onChange={(e) => setWalkInServiceId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  >
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} — {formatINR(srv.price)} ({srv.durationMins || srv.durationMin || 45}m)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Select Barber *', 'बार्बर चुनें *')}
                  </label>
                  <select
                    value={walkInBarberId}
                    onChange={(e) => setWalkInBarberId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  >
                    {barbers.map((brb) => (
                      <option key={brb.id} value={brb.id}>
                        {brb.name} ({brb.role || 'Barber'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Extras & Add-ons Section */}
              <div className="p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F1E194] text-xs">
                    ✨ {tr('Extras & Add-on Services', 'अतिरिक्त सेवाएं (Add-ons)')}
                  </span>
                  <span className="text-[10px] text-[#8A8178]">
                    {tr('Optional add-ons for the client', 'ग्राहक के लिए अतिरिक्त सेवाएं')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AVAILABLE_EXTRAS.map((extra) => {
                    const isChecked = selectedWalkInExtras.includes(extra.id);
                    return (
                      <label
                        key={extra.id}
                        className={`flex items-center gap-2 p-2 rounded-[10px] border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#241719] border-[#F1E194]/50 text-[#F1E194]'
                            : 'bg-[#1a1113] border-white/10 text-[#FFF9E8]/80 hover:border-[#F1E194]/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWalkInExtras([...selectedWalkInExtras, extra.id]);
                            } else {
                              setSelectedWalkInExtras(selectedWalkInExtras.filter((id) => id !== extra.id));
                            }
                          }}
                          className="rounded text-[#5B0E14] focus:ring-[#F1E194]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[11px] truncate">{extra.name}</p>
                          <p className="text-[10px] text-[#8A8178]">+{formatINR(extra.price)} · {extra.durationMin}m</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Date & Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Appointment Date (IST) *', 'अपॉइंटमेंट की तारीख *')}
                  </label>
                  <input
                    type="date"
                    required
                    value={walkInDate}
                    onChange={(e) => setWalkInDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  />
                </div>
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Time Slot (IST) *', 'समय स्लॉट *')}
                  </label>
                  <input
                    type="time"
                    required
                    value={walkInTime}
                    onChange={(e) => setWalkInTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  />
                </div>
              </div>

              {/* Payment Method & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Payment Collection', 'भुगतान माध्यम')}
                  </label>
                  <select
                    value={walkInPaymentMethod}
                    onChange={(e) => setWalkInPaymentMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  >
                    <option value="salon_cash">{tr('Pay at Salon (Cash / UPI QR)', 'दुकान पर नकद / UPI')}</option>
                    <option value="online">{tr('Online Razorpay Payment', 'रेज़रपे ऑनलाइन भुगतान')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#8A8178] mb-1 font-semibold">
                    {tr('Payment Status', 'भुगतान स्थिति')}
                  </label>
                  <select
                    value={walkInPaymentStatus}
                    onChange={(e) => setWalkInPaymentStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  >
                    <option value="paid">{tr('Paid / Captured ✅', 'भुगतान प्राप्त ✅')}</option>
                    <option value="pending">{tr('Pending Payment ⏳', 'भुगतान शेष ⏳')}</option>
                  </select>
                </div>
              </div>

              {/* Client Notes */}
              <div>
                <label className="block text-[#8A8178] mb-1 font-semibold">
                  {tr('Internal Notes / Hair Styling Preferences', 'विशेष निर्देश या स्टाइलिंग प्राथमिकता')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Skin fade with low taper, herbal shampoo requested"
                  value={walkInNotes}
                  onChange={(e) => setWalkInNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                />
              </div>

              {/* Price Calculation Summary */}
              {(() => {
                const srv = services.find((s) => s.id === walkInServiceId) || services[0];
                const base = Number(srv?.price || 500);
                const extrasCost = AVAILABLE_EXTRAS.filter((x) =>
                  selectedWalkInExtras.includes(x.id)
                ).reduce((sum, x) => sum + x.price, 0);
                const fee = 10;
                const total = base + extrasCost + fee;
                return (
                  <div className="p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#8A8178] block">{tr('Total Payable (Service + Extras + Fee)', 'कुल राशि (सेवा + अतिरिक्त + शुल्क)')}</span>
                      <span className="font-semibold text-[#FFF9E8] text-[11px]">
                        {formatINR(base)} (Base) + {formatINR(extrasCost)} (Extras) + {formatINR(fee)} (Fee)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono-num font-bold text-xl text-[#F1E194]">{formatINR(total)}</span>
                      <span className="text-[10px] text-emerald-400 block">🔐 6-digit OTP Generated</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWalkInModalOpen(false)}
                  className="w-1/3 py-3 rounded-[14px] bg-[#241719] border border-[#F1E194]/20 text-[#8A8178] hover:text-[#FFF9E8] font-semibold tracking-wider uppercase cursor-pointer"
                >
                  {tr('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  disabled={walkInSubmitting}
                  className="w-2/3 py-3 rounded-[14px] bg-[#F1E194] hover:bg-[#FFF9E8] text-[#111113] font-bold text-xs uppercase tracking-wider shadow-lg cursor-pointer transition-all disabled:opacity-50"
                >
                  {walkInSubmitting
                    ? tr('Creating Booking...', 'बुकिंग जारी है...')
                    : tr('Confirm & Create Booking ✅', 'पुष्टि करें और बुक करें ✅')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
