import React, { useState, useMemo } from 'react';
import {
  AppointmentItem,
  BarberItem,
  PageView,
  QueueItem,
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
} from 'lucide-react';
import {
  useLanguage,
  getUpcomingISTDates,
  formatISTDateString,
  formatISTTimeSlot,
} from '../lib/i18n';
import { uploadImageToSupabaseStorage } from '../lib/supabase';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  areBrowserAlertsEnabled,
  setBrowserAlertsEnabledPreference,
  sendBrowserNotification,
} from '../lib/browserNotifications';

interface CustomerDashboardProps {
  appointments: AppointmentItem[];
  onCancelAppointment: (id: string) => void;
  onRescheduleAppointment?: (
    id: string,
    date: string,
    time: string
  ) => Promise<void>;
  queue: QueueItem[];
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
  rewards?: any[];
  rewardBalance?: number;
  onRedeemReward?: (cost: number, label: string) => Promise<void>;
  currentUserProfile?: any;
  onUpdateProfile?: (updates: any) => Promise<void>;
  payments?: any[];
  reviews?: any[];
  onSubmitReview?: (payload: any) => Promise<void>;
  onUpdateReview?: (id: string, updates: any) => Promise<void>;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  appointments,
  onCancelAppointment,
  onRescheduleAppointment,
  queue,
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
  rewards = [],
  rewardBalance = 0,
  onRedeemReward,
  currentUserProfile,
  onUpdateProfile,
  payments = [],
  reviews = [],
  onSubmitReview,
  onUpdateReview,
}) => {
  const { lang, tr, formatINR, translateService } = useLanguage();
  const istDates = useMemo(() => getUpcomingISTDates(7, lang), [lang]);

  const [historyFilter, setHistoryFilter] = useState<
    'All' | 'Upcoming' | 'Completed' | 'Cancelled' | 'No-Show'
  >('All');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
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

  const userQueueEntry = queue.find(
    (q) => q.isCurrentUser || q.customerUid === currentUserProfile?.uid
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
        body: 'Queue status changes and appointment reminders will alert you even when the tab is in the background.',
        tag: `barberloo-toggle-on-${Date.now()}`,
        category: 'queue_status',
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
      title: userQueueEntry
        ? `💈 Queue Status • Position #${userQueueEntry.position}`
        : nextAppointment
          ? `⏰ Reminder: ${nextAppointment.serviceName} at ${nextAppointment.time}`
          : '🔔 BarberLoo Real-Time Alert',
      body: userQueueEntry
        ? `Estimated wait: ~${userQueueEntry.waitMins} mins with ${userQueueEntry.barberName}. Background alerts are working!`
        : nextAppointment
          ? `Upcoming appointment with ${nextAppointment.barberName} on ${nextAppointment.date} at ${nextAppointment.time}.`
          : 'Real-time Queue Status Changes & Appointment Reminders are active in the background.',
      tag: `barberloo-test-alert-${Date.now()}`,
      category: userQueueEntry ? 'queue_status' : 'appointment_reminder',
    });
  };

  const filteredAppointments = appointments.filter((apt) => {
    const st = String(apt.status).toLowerCase();
    if (historyFilter === 'All') return true;
    if (historyFilter === 'Upcoming')
      return (
        st === 'confirmed' ||
        st === 'pending' ||
        st === 'in_progress' ||
        st === 'in progress'
      );
    if (historyFilter === 'Completed') return st === 'completed';
    if (historyFilter === 'Cancelled') return st === 'cancelled';
    if (historyFilter === 'No-Show')
      return st === 'no_show' || st === 'no-show';
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
      await onUpdateProfile({
        name: profileName,
        phone: profilePhone,
        email: profileEmail,
        avatarUrl: profileAvatar,
        preferredNotes: profileNotes,
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

  const handleRedeem = async (cost: number, label: string) => {
    if (!onRedeemReward) return;
    if (rewardBalance < cost) {
      setStatusToast(
        tr(
          `Need ${cost} PTS to redeem ${label}. Complete appointments to earn points!`,
          `इसे रिडीम करने के लिए ${cost} पॉइंट्स आवश्यक हैं।`
        )
      );
      setTimeout(() => setStatusToast(''), 3500);
      return;
    }
    await onRedeemReward(cost, label);
    setStatusToast(
      tr(
        `✓ Redeemed ${label} (-${cost} PTS)`,
        `✓ ${label} सफलतापूर्वक रिडीम किया गया (-${cost} PTS)`
      )
    );
    setTimeout(() => setStatusToast(''), 3500);
  };

  return (
    <div className="min-h-screen bg-[#FAF6EA] text-[#111113] py-10 sm:py-14">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 space-y-10">
        {/* Top Welcome & Loyalty Header */}
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
            <div className="px-5 py-3 rounded-[18px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 flex items-center gap-3">
              <Award className="w-5 h-5 text-[#F1E194]" />
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#8A8178]">
                  {tr('Reward Points', 'रिवॉर्ड पॉइंट्स')}
                </div>
                <div className="font-mono-num text-lg font-bold text-[#F1E194]">
                  {rewardBalance.toLocaleString('en-IN')} PTS
                </div>
              </div>
            </div>

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

        {/* Main 12-Col Grid */}
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
                        onClick={() => onCancelAppointment(nextAppointment.id)}
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

            {/* Booking History with One-Tap Rebooking */}
            <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#111113]">
                  {tr('Booking History', 'बुकिंग इतिहास')}
                </h2>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      'All',
                      'Upcoming',
                      'Completed',
                      'Cancelled',
                      'No-Show',
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setHistoryFilter(tab)}
                      className={`px-3 py-1.5 rounded-[12px] text-xs font-semibold cursor-pointer ${
                        historyFilter === tab
                          ? 'bg-[#5B0E14] text-[#FFF9E8]'
                          : 'bg-[#FAF6EA] text-[#241719]'
                      }`}
                    >
                      {tab === 'All'
                        ? tr('All', 'सभी')
                        : tab === 'Upcoming'
                        ? tr('Upcoming', 'आगामी')
                        : tab === 'Completed'
                        ? tr('Completed', 'पूर्ण')
                        : tab === 'Cancelled'
                        ? tr('Cancelled', 'रद्द')
                        : tr('No-Show', 'अनुपस्थित')}
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
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="font-mono-num text-sm font-bold text-[#5B0E14]">
                              {formatINR(apt.price)}
                            </span>
                            <span className="px-2.5 py-1 rounded-[10px] bg-[#E9D9B8] text-[11px] font-semibold">
                              {apt.status}
                            </span>
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
                                      shopId: apt.shopId || 'shop-1',
                                      barberId: apt.barberId || 'brb-1',
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Loyalty Rewards & Points Ledger */}
            <div className="rounded-[24px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#111113] flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#5B0E14]" />
                    <span>
                      {tr(
                        'Loyalty Rewards & Points History',
                        'लॉयल्टी रिवॉर्ड्स और पॉइंट्स इतिहास'
                      )}
                    </span>
                  </h2>
                  <p className="text-xs text-[#8A8178]">
                    {tr(
                      'Earn 15% of every completed booking in reward points.',
                      'प्रत्येक पूर्ण बुकिंग पर रिवॉर्ड पॉइंट्स कमाएं।'
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleRedeem(200, '₹150 Grooming Credit Voucher')
                    }
                    className="px-3.5 py-2 rounded-[12px] bg-[#241719] text-[#F1E194] text-xs font-semibold cursor-pointer"
                  >
                    {tr('Redeem ₹150 Voucher (200 PTS)', '₹150 वाउचर (200 PTS)')}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleRedeem(300, 'Complimentary Hot Towel Ritual')
                    }
                    className="px-3.5 py-2 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                  >
                    {tr('Hot Towel Upgrade (300 PTS)', 'हॉट टॉवल (300 PTS)')}
                  </button>
                </div>
              </div>

              {rewards.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#5B0E14]/10">
                  {rewards.slice(0, 5).map((rw: any) => (
                    <div
                      key={rw.id}
                      className="p-3 rounded-[12px] bg-[#FAF6EA] flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-[#111113]">
                        {rw.reason}
                      </span>
                      <span
                        className={`font-mono-num font-bold ${
                          Number(rw.pointsDelta) >= 0
                            ? 'text-emerald-700'
                            : 'text-[#5B0E14]'
                        }`}
                      >
                        {Number(rw.pointsDelta) >= 0
                          ? `+${rw.pointsDelta} PTS`
                          : `${rw.pointsDelta} PTS`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right 4 Cols: Queue Status, Favorites & Notifications */}
          <div className="lg:col-span-4 space-y-6">
            {/* Live Queue Status */}
            <div className="rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wider uppercase text-[#F1E194]">
                  {tr('LIVE QUEUE STATUS', 'लाइव कतार स्थिति')}
                </span>
                <span className="w-2 h-2 rounded-full bg-[#F1E194] animate-pulse" />
              </div>
              {userQueueEntry ? (
                <div>
                  <p className="font-display text-3xl font-bold text-[#F1E194]">
                    {tr(
                      `Position #${userQueueEntry.position}`,
                      `आपका स्थान #${userQueueEntry.position}`
                    )}
                  </p>
                  <p className="text-xs text-[#8A8178] mt-1">
                    ~{userQueueEntry.waitMins} {tr('mins wait', 'मिनट प्रतीक्षा')} ·{' '}
                    {userQueueEntry.barberName}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#8A8178]">
                  {tr(
                    'You are not currently in a live queue.',
                    'आप अभी किसी लाइव कतार में नहीं हैं।'
                  )}
                </p>
              )}
              <button
                type="button"
                onClick={() => onNavigate('queue')}
                className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                {tr('Open Live Queue', 'लाइव कतार खोलें')}
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
                      title="Send a live browser notification for Queue Status & Appointment Reminders"
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
      </div>
    </div>
  );
};
