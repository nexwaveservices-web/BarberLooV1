import React, { useState, useMemo, useEffect } from 'react';
import {
  AppointmentItem,
  BarberItem,
  PageView,
  ServiceItem,
  ShopItem,
} from '../data/barberlooData';
import { SmartImage } from './SmartImage';
import {
  Calendar,
  Clock,
  Award,
  Bell,
  Heart,
  RefreshCw,
  XCircle,
  User,
  Check,
  RotateCcw,
  Settings as SettingsIcon,
} from 'lucide-react';
import {
  useLanguage,
  getUpcomingISTDates,
  formatISTDateString,
  formatISTTimeSlot,
} from '../lib/i18n';
import { uploadImageToSupabaseStorage } from '../lib/supabase';
import { apiClaimSlaCompensation } from '../lib/api';
import {
  evaluateAppointmentSla,
  markCustomerClaimedSla,
  hasCustomerClaimedSla,
} from '../lib/sla';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  areBrowserAlertsEnabled,
  setBrowserAlertsEnabledPreference,
  sendBrowserNotification,
} from '../lib/browserNotifications';
import {
  DEFAULT_STATES,
  DEFAULT_CITIES,
  getCitiesForState,
  validateCityBelongsToState,
} from '../lib/locations';

interface CustomerDashboardProps {
  initialSection?: 'bookings' | 'profile';
  appointments: AppointmentItem[];
  onCancelAppointment: (id: string) => void;
  onRescheduleAppointment?: (
    id: string,
    date: string,
    time: string
  ) => Promise<void>;
  onNavigate: (page: PageView) => void;
  onSelectServiceForBooking?: (service: ServiceItem) => void;
  onSelectBarberForBooking: (barber: BarberItem) => void;
  onSelectShop?: (shop: ShopItem) => void;
  barbers?: any[];
  shops?: any[];
  services?: any[];
  favorites?: any[];
  onToggleFavorite?: (targetType: 'shop' | 'barber', targetId: string) => void;
  notifications?: any[];
  onMarkNotificationsRead?: () => Promise<void>;
  currentUserProfile?: any;
  onUpdateProfile?: (updates: any) => Promise<void>;
  payments?: any[];
  reviews?: any[];
  onSubmitReview?: (payload: any) => Promise<void>;
  onUpdateReview?: (id: string, updates: any) => Promise<void>;
  platformSettings?: any;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  initialSection = 'bookings',
  appointments,
  onCancelAppointment,
  onRescheduleAppointment,
  onNavigate,
  onSelectServiceForBooking,
  onSelectBarberForBooking,
  onSelectShop,
  barbers = [],
  shops = [],
  services = [],
  favorites = [],
  onToggleFavorite,
  notifications = [],
  onMarkNotificationsRead,
  currentUserProfile,
  onUpdateProfile,
  payments = [],
  reviews = [],
  onSubmitReview,
  onUpdateReview,
  platformSettings,
}) => {
  const { lang, tr, formatINR, translateService } = useLanguage();
  const istDates = useMemo(() => getUpcomingISTDates(7, lang), [lang]);

  const [activeCustomerSection, setActiveCustomerSection] = useState<'bookings' | 'profile'>(
    initialSection
  );

  useEffect(() => {
    if (initialSection) {
      setActiveCustomerSection(initialSection);
    }
  }, [initialSection]);

  const [historyFilter, setHistoryFilter] = useState<
    'Upcoming' | 'Past' | 'All'
  >('Upcoming');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [cancellingApt, setCancellingApt] = useState<any | null>(null);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [newDate, setNewDate] = useState(
    istDates[1]?.isoDate || new Date().toISOString().slice(0, 10)
  );
  const [newTime, setNewTime] = useState('15:30');
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(
    currentUserProfile?.name || ''
  );
  const [profilePhone, setProfilePhone] = useState(
    currentUserProfile?.phone || ''
  );
  const [profileEmail, setProfileEmail] = useState(
    currentUserProfile?.email || ''
  );
  const [profileAvatar, setProfileAvatar] = useState(
    currentUserProfile?.avatarUrl || ''
  );
  const [profileNotes, setProfileNotes] = useState(
    currentUserProfile?.preferredNotes || ''
  );
  const [profileStateId, setProfileStateId] = useState(
    currentUserProfile?.stateId || currentUserProfile?.state_id || 'st-pb'
  );
  const [profileCityId, setProfileCityId] = useState(
    currentUserProfile?.cityId || currentUserProfile?.city_id || 'ct-jal'
  );

  const handleProfileStateChange = (stId: string) => {
    setProfileStateId(stId);
    const validCities = getCitiesForState(stId);
    if (validCities.length > 0) {
      setProfileCityId(validCities[0].id);
    }
  };
  const [statusToast, setStatusToast] = useState('');
  const [reviewingAptId, setReviewingAptId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [browserPerm, setBrowserPerm] = useState<string>(() =>
    getBrowserNotificationPermission()
  );
  const [browserAlertsOn, setBrowserAlertsOn] = useState<boolean>(() =>
    areBrowserAlertsEnabled()
  );

  const upcomingAppointments = appointments.filter(
    (a) =>
      a.status === 'Confirmed' ||
      a.status === 'Pending' ||
      a.status === 'confirmed' ||
      a.status === 'pending' ||
      a.status === 'in_progress' ||
      String(a.status).toLowerCase() === 'in progress'
  );
  const nextAppointment = upcomingAppointments[0];

  const handleToggleOrEnableBrowserAlerts = async () => {
    const currentPerm = getBrowserNotificationPermission();
    if (currentPerm !== 'granted') {
      const res = await requestBrowserNotificationPermission();
      setBrowserPerm(res);
      setBrowserAlertsOn(res === 'granted');
      return;
    }
    const nextState = !browserAlertsOn;
    setBrowserAlertsEnabledPreference(nextState);
    setBrowserAlertsOn(nextState);
    if (nextState) {
      await sendBrowserNotification({
        title: 'BarberLoo Background Alerts Active',
        body: 'Appointment reminders and status changes will alert you even when the tab is in the background.',
        tag: `barberloo-toggle-on-${Date.now()}`,
        category: 'appointment_reminder',
      });
    }
  };

  const handleSendTestBrowserAlert = async () => {
    if (getBrowserNotificationPermission() !== 'granted') {
      const res = await requestBrowserNotificationPermission();
      setBrowserPerm(res);
      setBrowserAlertsOn(res === 'granted');
      return;
    }
    setBrowserAlertsEnabledPreference(true);
    setBrowserAlertsOn(true);
    await sendBrowserNotification({
      title: nextAppointment
        ? `⏰ Reminder: ${nextAppointment.serviceName} at ${nextAppointment.time}`
        : '🔔 BarberLoo Appointment Alert',
      body: nextAppointment
        ? `Upcoming appointment with ${nextAppointment.barberName} on ${nextAppointment.date} at ${nextAppointment.time}.`
        : 'Real-time Appointment Reminders and booking updates are active in the background.',
      tag: `barberloo-test-alert-${Date.now()}`,
      category: 'appointment_reminder',
    });
  };

  const filteredAppointments = appointments.filter((apt) => {
    const st = String(apt.status).toLowerCase();
    if (historyFilter === 'Upcoming') {
      return (
        st === 'confirmed' ||
        st === 'pending' ||
        st === 'in_progress' ||
        st === 'in progress'
      );
    }
    if (historyFilter === 'Past') {
      return (
        st === 'completed' ||
        st === 'cancelled' ||
        st === 'no_show' ||
        st === 'no-show'
      );
    }
    return true;
  });

  const favoriteBarberIds = favorites
    .filter((f) => f.targetType === 'barber')
    .map((f) => f.targetId);
  const favoriteShopIds = favorites
    .filter((f) => f.targetType === 'shop')
    .map((f) => f.targetId);

  const favBarbers = barbers.filter((b: any) =>
    favoriteBarberIds.includes(b.id)
  );
  const favShops = shops.filter((s: any) => favoriteShopIds.includes(s.id));

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateProfile) {
      const validCities = getCitiesForState(profileStateId);
      const cityValid = validateCityBelongsToState(profileCityId, profileStateId);
      if (!cityValid) {
        setStatusToast(
          tr(
            'Please select a valid city belonging to the selected state.',
            'कृपया चुने गए राज्य के लिए एक मान्य शहर चुनें।'
          )
        );
        return;
      }
      const stateObj = DEFAULT_STATES.find((s) => s.id === profileStateId);
      const cityObj =
        validCities.find((c) => c.id === profileCityId) || validCities[0];

      await onUpdateProfile({
        name: profileName,
        phone: profilePhone,
        email: profileEmail,
        avatarUrl: profileAvatar,
        preferredNotes: profileNotes,
        stateId: profileStateId,
        cityId: cityObj.id,
        state: stateObj?.name || 'Punjab',
        city: cityObj.name || 'Jalandhar',
      });
      setEditingProfile(false);
      setStatusToast(tr('✓ Profile saved.', '✓ प्रोफ़ाइल सहेजी गई।'));
      setTimeout(() => setStatusToast(''), 3500);
    }
  };

  const handleRescheduleSubmit = async (id: string) => {
    if (onRescheduleAppointment) {
      try {
        await onRescheduleAppointment(id, newDate, newTime);
        setReschedulingId(null);
        setStatusToast(
          tr(
            `✓ Rescheduled to ${newDate} at ${newTime} IST`,
            `✓ अपॉइंटमेंट ${newDate} को ${newTime} IST पर पुनर्निर्धारित किया गया`
          )
        );
        setTimeout(() => setStatusToast(''), 4000);
      } catch (err: any) {
        setStatusToast(err?.message || 'Could not reschedule');
      }
    }
  };

  const handleOneTapRebook = (apt: AppointmentItem) => {
    const matchedSrv = services.find(
      (s: any) => s.id === apt.serviceId || s.name === apt.serviceName
    );
    const matchedBrb = barbers.find(
      (b: any) => b.id === apt.barberId || b.name === apt.barberName
    );
    if (matchedSrv && onSelectServiceForBooking) {
      onSelectServiceForBooking(matchedSrv);
    }
    if (matchedBrb) {
      onSelectBarberForBooking(matchedBrb);
    }
    onNavigate('booking');
  };

  return (
    <div className="min-h-screen bg-[#FAF6EA] text-[#111113] py-10 sm:py-14">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 space-y-10">
        {/* Top Welcome Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#5B0E14]/15">
          <div className="flex items-center gap-4">
            {currentUserProfile?.avatarUrl ? (
              <SmartImage
                src={currentUserProfile.avatarUrl}
                alt={currentUserProfile.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-[#5B0E14]"
              />
            ) : null}
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-2">
                {tr('CUSTOMER PORTAL • INDIA', 'ग्राहक पोर्टल • भारत')}
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#111113]">
                {tr('Welcome,', 'स्वागत है,')} {currentUserProfile?.name}
              </h1>
              <p className="text-sm text-[#8A8178] mt-1">
                {currentUserProfile?.email}{' '}
                {currentUserProfile?.phone ? `· ${currentUserProfile.phone}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEditingProfile((prev) => !prev)}
              className="px-5 py-3.5 rounded-[18px] border border-[#5B0E14]/25 text-[#111113] text-xs font-semibold tracking-wider uppercase hover:bg-[#E9D9B8]/60 transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <User className="w-4 h-4 text-[#5B0E14]" />
              <span>{tr('Edit Profile', 'प्रोफ़ाइल संपादित करें')}</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="px-6 py-3.5 rounded-[18px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-[0.14em] uppercase hover:bg-[#241719] transition-colors cursor-pointer"
            >
              {tr('+ BOOK NEW CUT', '+ नया अपॉइंटमेंट बुक करें')}
            </button>
          </div>
        </div>

        {/* Navigation Tabs between My Bookings and Profile (Rules 17 & 18) */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveCustomerSection('bookings')}
            className={`px-6 py-3 rounded-[18px] text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-2 ${
              activeCustomerSection === 'bookings'
                ? 'bg-[#5B0E14] text-[#FFF9E8] shadow-md'
                : 'bg-[#E9D9B8]/70 text-[#111113] hover:bg-[#E9D9B8]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{tr('My Bookings', 'मेरी बुकिंग')}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeCustomerSection === 'bookings'
                  ? 'bg-[#FFF9E8]/20 text-[#FFF9E8]'
                  : 'bg-[#5B0E14]/15 text-[#5B0E14]'
              }`}
            >
              {appointments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCustomerSection('profile')}
            className={`px-6 py-3 rounded-[18px] text-xs font-semibold cursor-pointer transition-colors inline-flex items-center gap-2 ${
              activeCustomerSection === 'profile'
                ? 'bg-[#5B0E14] text-[#FFF9E8] shadow-md'
                : 'bg-[#E9D9B8]/70 text-[#111113] hover:bg-[#E9D9B8]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{tr('Profile', 'प्रोफ़ाइल')}</span>
          </button>
        </div>

        {statusToast && (
          <div className="p-4 rounded-[16px] bg-[#241719] text-[#F1E194] border border-[#F1E194]/30 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{statusToast}</span>
          </div>
        )}

        {/* Customer Profile Editor Drawer */}
        {editingProfile && (
          <form
            onSubmit={handleSaveProfile}
            className="rounded-[24px] bg-[#E9D9B8]/65 border border-[#5B0E14]/20 p-6 sm:p-8 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[#111113]">
                {tr('Your Profile & Preferences', 'आपकी प्रोफ़ाइल और प्राथमिकताएं')}
              </h2>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="text-xs text-[#8A8178] hover:text-[#111113]"
              >
                {tr('Close', 'बंद करें')}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#241719] mb-1">
                  {tr('Full Name', 'पूरा नाम')}
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#241719] mb-1">
                  {tr('Phone (+91)', 'फ़ोन नंबर (+91)')}
                </label>
                <input
                  type="text"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#241719] mb-1">
                  {tr('Email', 'ईमेल')}
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#241719] mb-1">
                  {tr('Profile Photo (URL or Upload)', 'प्रोफ़ाइल फोटो')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={profileAvatar}
                    onChange={(e) => setProfileAvatar(e.target.value)}
                    placeholder="/src/assets/images/..."
                    className="flex-1 px-3 py-2 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                  />
                  <label className="px-3 py-2 rounded-[12px] bg-[#241719] text-[#F1E194] text-[11px] font-semibold cursor-pointer shrink-0 flex items-center">
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
                            'avatars'
                          );
                          setProfileAvatar(url);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#241719] mb-1">
                    {tr('Home State', 'गृह राज्य')}
                  </label>
                  <select
                    value={profileStateId}
                    onChange={(e) => handleProfileStateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113] cursor-pointer"
                  >
                    {DEFAULT_STATES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#241719] mb-1">
                    {tr('Home City', 'गृह शहर')}
                  </label>
                  <select
                    value={profileCityId}
                    onChange={(e) => setProfileCityId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113] cursor-pointer"
                  >
                    {getCitiesForState(profileStateId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#241719] mb-1">
                {tr('Preferred Haircut Notes', 'पसंदीदा हेयरकट निर्देश')}
              </label>
              <input
                type="text"
                value={profileNotes}
                onChange={(e) => setProfileNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-[14px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
            >
              {tr('Save Profile', 'प्रोफ़ाइल सहेजें')}
            </button>
          </form>
        )}

        {/* Section 1: Bookings View or Section 2: Profile View (Rule 18) */}
        {activeCustomerSection === 'bookings' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left 8 Cols */}
          <div className="lg:col-span-8 space-y-8">
            {/* Upcoming Appointment Hero Card */}
            <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-7 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F1E194]">
                    {tr('NEXT APPOINTMENT (IST)', 'अगला अपॉइंटमेंट (IST)')}
                  </span>
                  <h2 className="font-display text-3xl font-bold mt-1">
                    {nextAppointment
                      ? translateService(nextAppointment.serviceName)
                      : tr('No Upcoming Appointments', 'कोई आगामी अपॉइंटमेंट नहीं है')}
                  </h2>
                </div>
                {nextAppointment && (
                  <span className="px-3.5 py-1.5 rounded-[12px] bg-[#F1E194]/15 text-[#F1E194] border border-[#F1E194]/30 text-xs font-semibold">
                    {nextAppointment.status}
                  </span>
                )}
              </div>

              {nextAppointment ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-[18px] bg-[#111113]/65 border border-[#F1E194]/12">
                    <div className="flex items-center gap-3">
                      <SmartImage
                        src={nextAppointment.barberAvatar}
                        alt={nextAppointment.barberName}
                        className="w-12 h-12 rounded-full object-cover border border-[#F1E194]/30"
                      />
                      <div>
                        <div className="text-[11px] text-[#8A8178]">
                          {tr('Barber', 'बार्बर')}
                        </div>
                        <div className="text-sm font-semibold text-[#FFF9E8]">
                          {nextAppointment.barberName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-[#F1E194]" />
                      <div>
                        <div className="text-[11px] text-[#8A8178]">
                          {tr('Date & Time (IST)', 'तारीख और समय (IST)')}
                        </div>
                        <div className="font-mono-num text-sm font-semibold text-[#FFF9E8]">
                          {formatISTDateString(nextAppointment.date, lang)} ·{' '}
                          {nextAppointment.time} IST
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[#F1E194]" />
                      <div>
                        <div className="text-[11px] text-[#8A8178]">
                          {tr('Amount (INR)', 'राशि (₹ INR)')}
                        </div>
                        <div className="font-mono-num text-sm font-semibold text-[#F1E194]">
                          {formatINR(nextAppointment.price)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Customer 4-Digit Service Completion OTP Box */}
                  {nextAppointment.completionOtp && (
                    <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F1E194]">
                          {tr(
                            `🔐 SERVICE COMPLETION OTP • SENT TO ${nextAppointment.clientPhone || currentUserProfile?.phone || '+91'}`,
                            `🔐 सेवा पूर्णता OTP • ${nextAppointment.clientPhone || currentUserProfile?.phone || '+91'} पर भेजा गया`
                          )}
                        </span>
                        <p className="text-xs text-[#FFF9E8]/80 mt-0.5">
                          {tr(
                            'Share this 4-digit OTP with your barber only when your haircut/service is completed ✅',
                            'जब आपका काम पूरा हो जाए ✅ केवल तभी यह 4-अंकीय OTP अपने बार्बर को बताएं'
                          )}
                        </p>
                      </div>
                      <div className="px-4 py-2 rounded-[12px] bg-[#241719] border border-[#F1E194] font-mono-num text-xl font-bold tracking-[0.25em] text-[#F1E194] text-center shrink-0">
                        {nextAppointment.completionOtp}
                      </div>
                    </div>
                  )}

                  {/* Real-Time SLA On-Time Chair Guarantee Bar */}
                  {(() => {
                    const sla = evaluateAppointmentSla(nextAppointment);
                    if (sla.status === 'EXEMPT') return null;
                    const alreadyClaimed =
                      hasCustomerClaimedSla(nextAppointment.id) ||
                      !sla.canClaimCompensation;
                    return (
                      <div
                        className={`p-3.5 rounded-[14px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          sla.status === 'BREACHED'
                            ? 'bg-[#5B0E14]/65 border-red-400/40 text-red-100'
                            : sla.status === 'AT_RISK'
                            ? 'bg-amber-950/60 border-amber-400/40 text-amber-100'
                            : 'bg-emerald-950/50 border-emerald-400/30 text-emerald-100'
                        }`}
                      >
                        <div>
                          <span className="font-mono-num font-bold uppercase tracking-wider">
                            🛡️ {sla.badgeText}
                          </span>
                          <p className="text-[11px] opacity-85 mt-0.5">
                            {sla.detailText}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {reschedulingId === nextAppointment.id && (
                    <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/30 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="block text-[11px] text-[#8A8178] mb-1">
                          {tr('New Date (IST)', 'नई तारीख (IST)')}
                        </label>
                        <input
                          type="date"
                          min={istDates[0]?.isoDate}
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="px-3 py-2 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8] border border-[#F1E194]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[#8A8178] mb-1">
                          {tr('New Time (IST)', 'नया समय (IST)')}
                        </label>
                        <select
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="px-3 py-2 rounded-[10px] bg-[#241719] text-xs text-[#FFF9E8] border border-[#F1E194]/20"
                        >
                          {[
                            '09:30',
                            '10:15',
                            '11:00',
                            '13:00',
                            '14:15',
                            '15:30',
                            '17:00',
                            '18:45',
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t} IST ({formatISTTimeSlot(t, lang).time12})
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRescheduleSubmit(nextAppointment.id)}
                        className="px-4 py-2 rounded-[10px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
                      >
                        {tr('Confirm Reschedule', 'पुनर्निर्धारित करें')}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="text-xs text-[#8A8178]">
                      {nextAppointment.shopName}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setReschedulingId(
                            reschedulingId === nextAppointment.id
                              ? null
                              : nextAppointment.id
                          )
                        }
                        className="px-4 py-2 rounded-[14px] border border-[#F1E194]/25 text-xs font-semibold text-[#FFF9E8] hover:bg-[#111113] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{tr('Reschedule', 'समय बदलें')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancellingApt(nextAppointment)}
                        className="px-4 py-2 rounded-[14px] bg-[#5B0E14] text-xs font-semibold text-[#FFF9E8] hover:bg-[#75131b] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{tr('Cancel', 'रद्द करें')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-[#8A8178]">
                    {tr(
                      'You have no active appointments scheduled.',
                      'आपका कोई सक्रिय अपॉइंटमेंट निर्धारित नहीं है।'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigate('booking')}
                    className="px-5 py-2.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {tr('Book Now', 'अभी बुक करें')}
                  </button>
                </div>
              )}
            </div>

            {/* My Bookings (Rule 17) */}
            <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                    {tr('My Bookings', 'मेरी बुकिंग')}
                  </h2>
                  <p className="text-xs text-[#8A8178] mt-0.5">
                    {tr('See your appointments and booking status.', 'अपनी सभी अपॉइंटमेंट्स देखें।')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'Upcoming', label: tr('Upcoming', 'आगामी') },
                      { id: 'Past', label: tr('Past', 'पिछली') },
                      { id: 'All', label: tr('All', 'सभी') },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setHistoryFilter(tab.id as any)}
                      className={`px-4 py-2 rounded-[14px] text-xs font-semibold cursor-pointer transition-colors ${
                        historyFilter === tab.id
                          ? 'bg-[#5B0E14] text-[#FFF9E8]'
                          : 'bg-[#FAF6EA] text-[#241719] hover:bg-[#FAF6EA]/80'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAppointments.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr(
                    'No appointments in this category.',
                    'इस श्रेणी में कोई अपॉइंटमेंट नहीं है।'
                  )}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map((apt: any) => {
                    const isCompleted =
                      String(apt.status).toLowerCase() === 'completed';
                    const matchedPayment = payments.find(
                      (p: any) => p.appointmentId === apt.id
                    );
                    const existingRev = reviews.find(
                      (r: any) =>
                        r.customerUid === currentUserProfile?.uid &&
                        (r.service === apt.serviceName ||
                          r.barber === apt.barberName)
                    );
                    return (
                      <div
                        key={apt.id}
                        className="rounded-[18px] bg-[#FAF6EA] border border-[#5B0E14]/12 p-4 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-sm text-[#111113]">
                              {translateService(apt.serviceName)}
                            </p>
                            <p className="text-xs text-[#8A8178] mt-0.5">
                              {apt.barberName} · {apt.shopName} ·{' '}
                              <span className="font-mono-num">
                                {formatISTDateString(apt.date, lang)} ({apt.time}{' '}
                                IST)
                              </span>
                            </p>
                            {matchedPayment && (
                              <p className="text-[11px] font-mono-num text-[#5B0E14] mt-1">
                                {tr('Receipt:', 'रसीद:')}{' '}
                                {matchedPayment.receiptNumber || matchedPayment.id}{' '}
                                · {matchedPayment.methodDisplay || matchedPayment.method}{' '}
                                ({String(matchedPayment.status).toUpperCase()})
                              </p>
                            )}
                            {((apt.addOns && apt.addOns.length > 0) ||
                              (apt.notes && apt.notes.includes('Add-ons:'))) && (
                              <p className="text-[11px] text-[#5B0E14] font-medium mt-1">
                                ✦ {tr('Add-ons:', 'ऐड-ऑन्स:')}{' '}
                                {apt.addOns && apt.addOns.length > 0
                                  ? apt.addOns.map((a: any) => `${a.name} (+₹${a.price})`).join(', ')
                                  : apt.notes?.split('Add-ons:')[1]?.split('|')[0]?.trim()}
                              </p>
                            )}
                            {!isCompleted &&
                              String(apt.status).toLowerCase() !== 'cancelled' &&
                              apt.completionOtp && (
                                <p className="text-[11px] font-mono-num font-bold text-[#5B0E14] mt-1">
                                  🔐 {tr('Completion OTP (Share with barber when work is ✅):', 'सेवा पूर्ण OTP (काम पूरा होने पर बार्बर को दें ✅):')}{' '}
                                  <span className="px-2 py-0.5 rounded bg-[#241719] text-[#F1E194] tracking-widest">
                                    {apt.completionOtp}
                                  </span>
                                </p>
                              )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            {(() => {
                              const sla = evaluateAppointmentSla(apt);
                              if (sla.status === 'EXEMPT') return null;
                              return (
                                <span
                                  className={`px-2.5 py-1 rounded-[10px] text-[10px] font-mono-num font-semibold ${
                                    sla.status === 'BREACHED'
                                      ? 'bg-red-950 text-red-200'
                                      : sla.status === 'AT_RISK'
                                      ? 'bg-amber-950 text-amber-200'
                                      : 'bg-emerald-950 text-emerald-200'
                                  }`}
                                >
                                  🛡️ {sla.badgeText}
                                </span>
                              );
                            })()}
                            <span className="font-mono-num text-sm font-bold text-[#5B0E14]">
                              {formatINR(apt.price)}
                            </span>
                            <span className="px-2.5 py-1 rounded-[10px] bg-[#E9D9B8] text-[11px] font-semibold">
                              {apt.status}
                            </span>
                            {!isCompleted &&
                              String(apt.status).toLowerCase() !== 'cancelled' && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReschedulingId(
                                        reschedulingId === apt.id ? null : apt.id
                                      )
                                    }
                                    className="px-3 py-1.5 rounded-[10px] border border-[#5B0E14]/25 text-[#111113] hover:bg-[#E9D9B8]/60 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3 text-[#5B0E14]" />
                                    <span>{tr('Reschedule', 'समय बदलें')}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCancellingApt(apt)}
                                    className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-[#75131b]"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>{tr('Cancel', 'रद्द करें')}</span>
                                  </button>
                                </div>
                              )}
                            {isCompleted && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (reviewingAptId === apt.id) {
                                      setReviewingAptId(null);
                                    } else {
                                      setReviewingAptId(apt.id);
                                      if (existingRev) {
                                        setEditingReviewId(existingRev.id);
                                        setReviewRating(Number(existingRev.rating) || 5);
                                        setReviewComment(existingRev.comment || '');
                                      } else {
                                        setEditingReviewId(null);
                                        setReviewRating(5);
                                        setReviewComment('');
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-[10px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                                >
                                  {existingRev
                                    ? tr('Edit Review ★', 'समीक्षा संपादित करें ★')
                                    : tr('Rate & Review ★', 'रेटिंग और समीक्षा ★')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOneTapRebook(apt)}
                                  className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>{tr('Rebook', 'फिर से बुक करें')}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {reviewingAptId === apt.id && (
                          <div className="pt-3 border-t border-[#5B0E14]/15 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[#5B0E14]">
                                {tr('Rate Barber & Service (1–5★):', 'रेटिंग दें (1–5★):')}
                              </span>
                              <div className="flex gap-1.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setReviewRating(star)}
                                    className={`px-2.5 py-1 rounded-[8px] text-xs font-bold cursor-pointer ${
                                      reviewRating >= star
                                        ? 'bg-[#5B0E14] text-[#F1E194]'
                                        : 'bg-[#E9D9B8] text-[#8A8178]'
                                    }`}
                                  >
                                    {star}★
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={reviewComment}
                                onChange={(e) => setReviewComment(e.target.value)}
                                placeholder={tr(
                                  'Write your review for this completed session...',
                                  'इस सेवा के लिए अपनी समीक्षा लिखें...'
                                )}
                                className="flex-1 px-3 py-2 rounded-[10px] bg-[#E9D9B8]/40 border border-[#5B0E14]/20 text-xs"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!reviewComment.trim()) return;
                                  if (editingReviewId && onUpdateReview) {
                                    await onUpdateReview(editingReviewId, {
                                      rating: reviewRating,
                                      comment: reviewComment.trim(),
                                    });
                                  } else if (onSubmitReview) {
                                    await onSubmitReview({
                                      appointmentId: apt.id,
                                      shopId: apt.shopId || '',
                                      barberId: apt.barberId || '',
                                      author: currentUserProfile?.name || 'Verified Client',
                                      role: 'Verified Client',
                                      rating: reviewRating,
                                      comment: reviewComment.trim(),
                                      service: apt.serviceName,
                                      barber: apt.barberName,
                                    });
                                  }
                                  setReviewingAptId(null);
                                  setStatusToast(
                                    tr('✓ Review saved!', '✓ समीक्षा सहेजी गई!')
                                  );
                                  setTimeout(() => setStatusToast(''), 3500);
                                }}
                                className="px-4 py-2 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                              >
                                {tr('Submit Review', 'समीक्षा सहेजें')}
                              </button>
                            </div>
                          </div>
                        )}

                        {reschedulingId === apt.id && (
                          <div className="pt-3 border-t border-[#5B0E14]/15 space-y-2.5">
                            <span className="text-xs font-semibold text-[#5B0E14] block">
                              {tr('Select new date & time:', 'नई तारीख और समय चुनें:')}
                            </span>
                            <div className="flex flex-wrap items-center gap-2.5">
                              <select
                                value={newDate}
                                onChange={(e) => setNewDate(e.target.value)}
                                className="px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/30 text-xs text-[#111113]"
                              >
                                {istDates.map((d) => (
                                  <option key={d.isoDate} value={d.isoDate}>
                                    {d.fullLabel}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={newTime}
                                onChange={(e) => setNewTime(e.target.value)}
                                className="px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/30 text-xs text-[#111113]"
                              >
                                {[
                                  '09:30',
                                  '10:15',
                                  '11:00',
                                  '13:00',
                                  '14:15',
                                  '15:30',
                                  '17:00',
                                  '18:45',
                                ].map((t) => (
                                  <option key={t} value={t}>
                                    {t} IST ({formatISTTimeSlot(t, lang).time12})
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRescheduleSubmit(apt.id)}
                                className="px-4 py-2 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer hover:bg-[#241719]"
                              >
                                {tr('Confirm Reschedule', 'पुनर्निर्धारित करें')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setReschedulingId(null)}
                                className="px-3 py-2 text-xs text-[#8A8178] hover:text-[#111113] cursor-pointer"
                              >
                                {tr('Cancel', 'रद्द करें')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Book Appointment, Favorites & Notifications */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Book Appointment Card */}
            <div className="rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider uppercase text-[#F1E194]">
                  {tr('BOOK NEXT APPOINTMENT', 'अगला अपॉइंटमेंट बुक करें')}
                </span>
                <Calendar className="w-4 h-4 text-[#F1E194]" />
              </div>
              <p className="text-xs text-[#8A8178] leading-relaxed">
                {tr(
                  'Reserve your preferred master barber and premium slot in advance with guaranteed on-time chair start.',
                  'अपने पसंदीदा मास्टर बार्बर और समय को पहले से आरक्षित करें और 15-मिनट ऑन-टाइम चेयर गारंटी प्राप्त करें।'
                )}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('booking')}
                className="w-full py-3.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider hover:bg-[#FFF9E8] transition-colors cursor-pointer"
              >
                {tr('Book New Appointment', 'नया अपॉइंटमेंट बुक करें')}
              </button>
            </div>

            {/* Favorites */}
            <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
              <h3 className="font-display text-2xl font-bold text-[#111113] flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#5B0E14]" />
                <span>{tr('Saved Favorites', 'पसंदीदा बार्बर और सैलून')}</span>
              </h3>
              {favBarbers.length === 0 && favShops.length === 0 ? (
                <p className="text-xs text-[#8A8178]">
                  {tr(
                    'No favorite barbers or shops saved yet.',
                    'अभी तक कोई पसंदीदा बार्बर या सैलून सहेजा नहीं गया है।'
                  )}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {favBarbers.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-[14px] bg-[#FAF6EA] flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold">{b.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBarberForBooking(b);
                            onNavigate('booking');
                          }}
                          className="text-[#5B0E14] font-semibold cursor-pointer"
                        >
                          {tr('Book', 'बुक करें')}
                        </button>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={() => onToggleFavorite('barber', b.id)}
                            className="text-[#8A8178] hover:text-[#5B0E14] cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {favShops.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-[14px] bg-[#FAF6EA] flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectShop) onSelectShop(s);
                            onNavigate('shop');
                          }}
                          className="text-[#5B0E14] font-semibold cursor-pointer"
                        >
                          {tr('View', 'देखें')}
                        </button>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={() => onToggleFavorite('shop', s.id)}
                            className="text-[#8A8178] hover:text-[#5B0E14] cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-display text-2xl font-bold text-[#111113] flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#5B0E14]" />
                  <span>{tr('Notifications', 'सूचनाएं')}</span>
                </h3>
                <div className="flex items-center gap-2">
                  {browserPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleToggleOrEnableBrowserAlerts}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                        browserPerm === 'granted' && browserAlertsOn
                          ? 'bg-[#5B0E14] text-[#FFF9E8] border-[#5B0E14]'
                          : 'bg-[#FAF6EA] text-[#5B0E14] border-[#5B0E14]/30 hover:bg-[#5B0E14]/10'
                      }`}
                    >
                      {browserPerm === 'granted' && browserAlertsOn
                        ? tr('Browser Alerts: ON', 'ब्राउज़र अलर्ट: चालू')
                        : browserPerm === 'denied'
                          ? tr('Alerts Blocked', 'अलर्ट अवरुद्ध')
                          : tr('Enable Browser Alerts', 'ब्राउज़र अलर्ट चालू करें')}
                    </button>
                  )}
                  {browserPerm === 'granted' && browserAlertsOn && (
                    <button
                      type="button"
                      onClick={handleSendTestBrowserAlert}
                      className="px-2 py-1 rounded-full text-[10px] font-semibold bg-[#FAF6EA] text-[#5B0E14] border border-[#5B0E14]/25 hover:bg-[#5B0E14]/10 cursor-pointer"
                      title="Send a live browser notification for Appointment Reminders & Status Updates"
                    >
                      {tr('Test Alert', 'टेस्ट अलर्ट')}
                    </button>
                  )}
                  {notifications.length > 0 && onMarkNotificationsRead && (
                    <button
                      type="button"
                      onClick={onMarkNotificationsRead}
                      className="text-[11px] text-[#5B0E14] font-semibold cursor-pointer"
                    >
                      {tr('Mark Read', 'पढ़ा हुआ चिह्नित करें')}
                    </button>
                  )}
                </div>
              </div>
              {notifications.length === 0 ? (
                <p className="text-xs text-[#8A8178]">
                  {tr('No notifications yet.', 'अभी कोई सूचना नहीं है।')}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-60 overflow-y-auto">
                  {notifications.slice(0, 8).map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-[14px] bg-[#FAF6EA] text-xs space-y-1 border ${
                        n.unread
                          ? 'border-[#5B0E14]/30'
                          : 'border-transparent opacity-80'
                      }`}
                    >
                      <p className="font-semibold text-[#111113]">{n.title}</p>
                      <p className="text-[11px] text-[#8A8178]">
                        {n.timeLabel || n.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        ) : (
          /* Rule 18: CUSTOMER PROFILE VIEW */
          <div className="space-y-8">
            {/* Page Header (Rule 4) */}
            <div className="border-b border-[#5B0E14]/15 pb-4">
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#111113]">
                {tr('My Profile', 'मेरी प्रोफ़ाइल')}
              </h2>
              <p className="text-xs sm:text-sm text-[#8A8178] mt-1">
                {tr('Manage your account, saved shops, notifications, and settings.', 'अपनी प्रोफ़ाइल, पसंदीदा दुकानें, सूचनाएं और सेटिंग्स प्रबंधित करें।')}
              </p>
            </div>

            {/* Profile Card: Photo, Name, Phone, Email */}
            <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/25 p-7 sm:p-8 flex flex-col sm:flex-row items-center gap-6 shadow-xl">
              <div className="relative">
                {currentUserProfile?.avatarUrl ? (
                  <SmartImage
                    src={currentUserProfile.avatarUrl}
                    alt={currentUserProfile.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-[#F1E194]/40"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#5B0E14] border-4 border-[#F1E194]/40 flex items-center justify-center text-[#F1E194] text-3xl font-bold font-display">
                    {currentUserProfile?.name ? currentUserProfile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <label className="absolute -bottom-1 -right-1 p-2 rounded-full bg-[#F1E194] text-[#111113] cursor-pointer hover:bg-[#FFF9E8] transition-colors shadow-md">
                  <User className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file && onUpdateProfile) {
                        const url = await uploadImageToSupabaseStorage(file, 'avatars');
                        setProfileAvatar(url);
                        await onUpdateProfile({ avatarUrl: url });
                        setStatusToast(tr('✓ Profile photo updated!', '✓ प्रोफ़ाइल फ़ोटो अपडेट हो गई!'));
                        setTimeout(() => setStatusToast(''), 3000);
                      }
                    }}
                  />
                </label>
              </div>

              <div className="text-center sm:text-left space-y-1">
                <h3 className="font-display text-2xl font-bold text-[#FFF9E8]">
                  {currentUserProfile?.name || tr('Guest Customer', 'अतिथि ग्राहक')}
                </h3>
                <p className="text-xs text-[#F1E194]/90 font-mono-num font-semibold">
                  {currentUserProfile?.phone ? `+91 ${currentUserProfile.phone.replace(/^\+91/, '').trim()}` : tr('No mobile number added', 'कोई मोबाइल नंबर नहीं जोड़ा गया')}
                </p>
                <p className="text-xs text-[#8A8178]">
                  {currentUserProfile?.email}
                </p>
                <span className="inline-block mt-2 px-3 py-1 rounded-full bg-[#F1E194]/15 border border-[#F1E194]/30 text-[#F1E194] text-[10px] font-semibold uppercase tracking-wider">
                  {tr('Verified Customer • BarberLoo India', 'सत्यापित ग्राहक • BarberLoo भारत')}
                </span>
              </div>
            </div>

            {/* 4 Clear Sections: My Bookings, Saved Shops, Notifications, Settings (Rule 18) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. My Bookings Summary Card */}
              <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold text-[#111113] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#5B0E14]" />
                    <span>{tr('My Bookings', 'मेरी बुकिंग')}</span>
                  </h3>
                  <span className="px-2.5 py-1 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-bold font-mono-num">
                    {appointments.length}
                  </span>
                </div>
                <p className="text-xs text-[#8A8178] leading-relaxed">
                  {upcomingAppointments.length > 0
                    ? tr(
                        `You have ${upcomingAppointments.length} upcoming appointment(s) scheduled.`,
                        `आपके पास ${upcomingAppointments.length} आगामी अपॉइंटमेंट निर्धारित हैं।`
                      )
                    : tr(
                        'No upcoming appointments scheduled right now.',
                        'वर्तमान में कोई आगामी अपॉइंटमेंट निर्धारित नहीं है।'
                      )}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveCustomerSection('bookings')}
                  className="w-full py-3 rounded-[14px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold uppercase tracking-wider hover:bg-[#241719] transition-colors cursor-pointer"
                >
                  {tr('View My Bookings', 'मेरी बुकिंग देखें')}
                </button>
              </div>

              {/* 2. Saved Shops Card */}
              <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold text-[#111113] flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#5B0E14]" />
                    <span>{tr('Saved Shops', 'पसंदीदा सैलून')}</span>
                  </h3>
                  <span className="px-2.5 py-1 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-bold font-mono-num">
                    {favShops.length}
                  </span>
                </div>
                {favShops.length === 0 ? (
                  <p className="text-xs text-[#8A8178]">
                    {tr('No saved shops yet. Tap the heart on any shop to save it here.', 'अभी तक कोई सैलून सहेजा नहीं गया है।')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {favShops.map((s: any) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-[14px] bg-[#FAF6EA] border border-[#5B0E14]/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#111113]">{s.name}</p>
                          <p className="text-[11px] text-[#8A8178]">{s.city || s.location || 'Punjab'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectShop) onSelectShop(s);
                            onNavigate('shop');
                          }}
                          className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer hover:bg-[#241719]"
                        >
                          {tr('View Shop', 'सैलून देखें')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('shop')}
                  className="w-full py-3 rounded-[14px] border border-[#5B0E14]/30 text-[#111113] text-xs font-semibold uppercase tracking-wider hover:bg-[#FAF6EA] transition-colors cursor-pointer"
                >
                  {tr('Explore All Shops', 'सभी सैलून देखें')}
                </button>
              </div>

              {/* 3. Notifications Card */}
              <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-bold text-[#111113] flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#5B0E14]" />
                    <span>{tr('Notifications', 'सूचनाएं')}</span>
                  </h3>
                  {browserPerm !== 'unsupported' && (
                    <button
                      type="button"
                      onClick={handleToggleOrEnableBrowserAlerts}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                        browserPerm === 'granted' && browserAlertsOn
                          ? 'bg-[#5B0E14] text-[#FFF9E8] border-[#5B0E14]'
                          : 'bg-[#FAF6EA] text-[#5B0E14] border-[#5B0E14]/30'
                      }`}
                    >
                      {browserPerm === 'granted' && browserAlertsOn
                        ? tr('Alerts: ON', 'अलर्ट: चालू')
                        : tr('Enable Alerts', 'अलर्ट चालू करें')}
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-[#8A8178]">
                    {tr('No notifications yet.', 'अभी कोई सूचना नहीं है।')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {notifications.slice(0, 5).map((n: any) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-[12px] bg-[#FAF6EA] border border-[#5B0E14]/10 text-xs"
                      >
                        <p className="font-semibold text-[#111113]">{n.title}</p>
                        <p className="text-[11px] text-[#8A8178] mt-0.5">{n.timeLabel || n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. Settings Card */}
              <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 space-y-4">
                <h3 className="font-display text-xl font-bold text-[#111113] flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4 text-[#5B0E14]" />
                  <span>{tr('Settings', 'सेटिंग्स')}</span>
                </h3>
                <form onSubmit={handleSaveProfile} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                      {tr('Full Name', 'पूरा नाम')}
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                      {tr('Mobile Number', 'मोबाइल नंबर')}
                    </label>
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                      {tr('Email Address', 'ईमेल पता')}
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                        {tr('State', 'राज्य')}
                      </label>
                      <select
                        value={profileStateId}
                        onChange={(e) => handleProfileStateChange(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                      >
                        {DEFAULT_STATES.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                        {tr('City', 'शहर')}
                      </label>
                      <select
                        value={profileCityId}
                        onChange={(e) => setProfileCityId(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                      >
                        {getCitiesForState(profileStateId).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#241719] mb-1">
                      {tr('Preferred Haircut Notes', 'हेयरकट निर्देश')}
                    </label>
                    <input
                      type="text"
                      value={profileNotes}
                      onChange={(e) => setProfileNotes(e.target.value)}
                      placeholder={tr('e.g. Skin fade with textured top', 'उदा. स्किन फेड')}
                      className="w-full px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs text-[#111113]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer hover:bg-[#241719] transition-colors"
                  >
                    {tr('Save Changes', 'बदलाव सहेजें')}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation & Refund Breakdown Modal */}
      {cancellingApt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-[24px] bg-[#111113] border border-[#F1E194]/30 p-6 space-y-5 text-[#FFF9E8] shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1E194]/15">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-display text-lg font-bold">
                  {tr('Cancel Appointment & Refund', 'अपॉइंटमेंट रद्द व रिफ़ंड')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancellingApt(null)}
                className="text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1 text-[#8A8178]">
              <p className="font-semibold text-sm text-[#FFF9E8]">
                {cancellingApt.serviceName} with {cancellingApt.barberName}
              </p>
              <p>
                {cancellingApt.shopName} · {cancellingApt.date} · {cancellingApt.time} IST
              </p>
            </div>

            {/* Breakdown: Service price, BarberLoo platform fee, Total paid */}
            {(() => {
              const fee = Number(cancellingApt.platformFee ?? 10);
              const total = Number(cancellingApt.totalPrice ?? cancellingApt.price ?? 160);
              const service = Number(
                cancellingApt.servicePrice ?? (total - fee)
              );
              const policy = platformSettings?.refundPolicy || 'service_only';
              const refundAmt = policy === 'full' ? total : service;

              return (
                <div className="space-y-4">
                  <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/20 space-y-2.5 text-xs">
                    <p className="text-[10px] font-semibold tracking-wider uppercase text-[#F1E194]">
                      {tr('ORIGINAL PAYMENT BREAKDOWN', 'मूल भुगतान विवरण')}
                    </p>
                    <div className="flex justify-between text-[#8A8178]">
                      <span>{tr('Service price', 'सेवा मूल्य')}</span>
                      <span className="font-mono-num font-semibold text-[#FFF9E8]">
                        {formatINR(service)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#8A8178]">
                      <span>{tr('BarberLoo platform fee', 'BarberLoo प्लेटफ़ॉर्म शुल्क')}</span>
                      <span className="font-mono-num font-semibold text-[#F1E194]">
                        {formatINR(fee)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-[#F1E194]/15 text-xs font-semibold">
                      <span>{tr('Total paid online', 'कुल ऑनलाइन भुगतान')}</span>
                      <span className="font-mono-num text-[#FFF9E8]">{formatINR(total)}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-[16px] bg-[#1a1415] border border-amber-400/30 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        {tr('Applicable Refund Amount', 'प्रयोज्य रिफ़ंड राशि')}
                      </span>
                      <span className="font-mono-num text-2xl font-bold text-amber-400">
                        {formatINR(refundAmt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8A8178] leading-relaxed">
                      {policy === 'full'
                        ? tr(
                            `100% Full Refund Policy: You will receive the entire amount of ${formatINR(total)} (Service price + BarberLoo platform fee) back to your original payment method.`,
                            `पूर्ण रिफ़ंड नीति: आपको सेवा शुल्क व प्लेटफ़ॉर्म शुल्क सहित पूरी राशि ${formatINR(total)} वापस मिलेगी।`
                          )
                        : tr(
                            `BarberLoo Refund Policy: The barber service price of ${formatINR(service)} will be refunded to your original payment method. The BarberLoo platform fee (${formatINR(fee)}) is retained.`,
                            `BarberLoo रिफ़ंड नीति: बार्बर सेवा शुल्क ${formatINR(service)} वापस मिलेगा। प्लेटफ़ॉर्म शुल्क (${formatINR(fee)}) गैर-वापसी योग्य है।`
                          )}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCancellingApt(null)}
                      className="px-4 py-2.5 rounded-[12px] bg-[#241719] border border-[#F1E194]/20 text-xs font-semibold text-[#FFF9E8] hover:bg-[#322023] cursor-pointer"
                    >
                      {tr('Keep Appointment', 'अपॉइंटमेंट रखें')}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingCancel}
                      onClick={async () => {
                        setIsProcessingCancel(true);
                        try {
                          await onCancelAppointment(cancellingApt.id);
                          setCancellingApt(null);
                        } finally {
                          setIsProcessingCancel(false);
                        }
                      }}
                      className="px-5 py-2.5 rounded-[12px] bg-[#5B0E14] hover:bg-[#75131b] text-xs font-bold text-[#FFF9E8] cursor-pointer shadow-md"
                    >
                      {isProcessingCancel
                        ? tr('Processing Refund...', 'रिफ़ंड प्रक्रिया जारी...')
                        : tr(
                            `Confirm Cancel & Refund (${formatINR(refundAmt)})`,
                            `रद्द करें व रिफ़ंड लें (${formatINR(refundAmt)})`
                          )}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
