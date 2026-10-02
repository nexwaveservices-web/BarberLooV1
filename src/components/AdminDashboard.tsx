import React, { useState, useMemo } from 'react';
import {
  AppointmentItem,
  QueueItem,
} from '../data/barberlooData';
import {
  ShieldCheck,
  Store,
  Users,
  Tag,
  TrendingUp,
  CreditCard,
  Flag,
  Calendar,
  Bell,
  Search,
  Check,
} from 'lucide-react';
import { useLanguage, getCurrentISTDisplay, formatISTDateString } from '../lib/i18n';
import { OWNER_ADMIN_EMAIL } from '../lib/firebase';
import { SUPABASE_URL, SUPABASE_SQL_SCHEMA } from '../lib/supabase';

interface AdminDashboardProps {
  appointments: AppointmentItem[];
  queue: QueueItem[];
  shops?: any[];
  barbers?: any[];
  profiles?: any[];
  coupons?: any[];
  payments?: any[];
  reviews?: any[];
  reports?: any[];
  onUpdateShop?: (id: string, updates: any) => Promise<void>;
  onUpdateBarber?: (id: string, updates: any) => Promise<void>;
  onUpdateProfile?: (uid: string, updates: any) => Promise<void>;
  onCreateCoupon?: (payload: any) => Promise<void>;
  onUpdateCoupon?: (id: string, updates: any) => Promise<void>;
  onUpdateReview?: (id: string, updates: any) => Promise<void>;
  onUpdateReport?: (id: string, updates: any) => Promise<void>;
  onUpdatePayment?: (id: string, status: string) => Promise<void>;
  onBroadcastNotification?: (payload: {
    shopName: string;
    message: string;
    targetRole?: 'customer' | 'barber' | 'all' | 'specific';
    specificUid?: string;
  }) => Promise<any>;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  appointments,
  queue,
  shops = [],
  barbers = [],
  profiles = [],
  coupons = [],
  payments = [],
  reviews = [],
  reports = [],
  onUpdateShop,
  onUpdateBarber,
  onUpdateProfile,
  onCreateCoupon,
  onUpdateCoupon,
  onUpdateReview,
  onUpdateReport,
  onUpdatePayment,
  onBroadcastNotification,
}) => {
  const { lang, tr, formatINR } = useLanguage();
  const istNow = getCurrentISTDisplay(lang);

  const [activeSection, setActiveSection] = useState<
    | 'overview'
    | 'users'
    | 'shops'
    | 'coupons'
    | 'payments'
    | 'moderation'
    | 'broadcast'
    | 'supabase'
  >('overview');
  const [copiedSchema, setCopiedSchema] = useState(false);

  // User search & role filter
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'customer' | 'barber'>('all');

  // Broadcast composer state
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<
    'customer' | 'barber' | 'all' | 'specific'
  >('customer');
  const [broadcastSpecificUid, setBroadcastSpecificUid] = useState<string>('');
  const [broadcastSenderTitle, setBroadcastSenderTitle] = useState<string>(
    'BarberLoo Platform Notice'
  );
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastFeedback, setBroadcastFeedback] = useState<string>('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState<boolean>(false);

  // Coupon form state
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState(20);
  const [newDesc, setNewDesc] = useState('');
  const [newMinSpend, setNewMinSpend] = useState(500);

  // Real calculated platform KPIs & analytics
  const totalCustomers = profiles.filter(
    (p: any) => String(p.role || 'customer').toLowerCase() === 'customer'
  ).length;
  const totalBarbersCount = Math.max(
    barbers.length,
    profiles.filter((p: any) =>
      ['barber', 'shop_owner'].includes(String(p.role || '').toLowerCase())
    ).length
  );
  const completedBookingsCount = appointments.filter(
    (a: any) => String(a.status || '').toLowerCase() === 'completed'
  ).length;
  const cancelledBookingsCount = appointments.filter(
    (a: any) => String(a.status || '').toLowerCase() === 'cancelled'
  ).length;
  const cancellationRate =
    appointments.length > 0
      ? Math.round((cancelledBookingsCount / appointments.length) * 100)
      : 0;

  const totalGmvINR = payments
    .filter((p: any) => p.status !== 'refunded')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const popularServiceName = useMemo(() => {
    if (appointments.length === 0) return 'Skin Fade & Beard Sculpt';
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      const s = a.serviceName || 'Haircut';
      counts[s] = (counts[s] || 0) + 1;
    }
    return (
      Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0] ||
      'Skin Fade & Beard Sculpt'
    );
  }, [appointments]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((u: any) => {
      const q = userSearch.trim().toLowerCase();
      const matchesQuery =
        !q ||
        String(u.name || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.role || '').toLowerCase().includes(q);
      const role = String(u.role || 'customer').toLowerCase();
      const matchesRole =
        userRoleFilter === 'all' ||
        (userRoleFilter === 'customer' && role === 'customer') ||
        (userRoleFilter === 'barber' &&
          (role === 'barber' || role === 'shop_owner'));
      return matchesQuery && matchesRole;
    });
  }, [profiles, userSearch, userRoleFilter]);

  const handleAddCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !onCreateCoupon) return;
    await onCreateCoupon({
      code: newCode.trim().toUpperCase(),
      discountPercent: Number(newDiscount) || 15,
      discountText: newDesc.trim() || `${newDiscount}% Off Grooming`,
      minSpend: Number(newMinSpend) || 500,
    });
    setNewCode('');
    setNewDesc('');
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim() || !onBroadcastNotification || isSendingBroadcast)
      return;
    setIsSendingBroadcast(true);
    setBroadcastFeedback('');
    try {
      await onBroadcastNotification({
        shopName: broadcastSenderTitle.trim() || 'BarberLoo Platform Notice',
        message: broadcastMessage.trim(),
        targetRole: broadcastTargetRole,
        specificUid:
          broadcastTargetRole === 'specific'
            ? broadcastSpecificUid || profiles[0]?.uid
            : undefined,
      });
      setBroadcastMessage('');
      const targetLabel =
        broadcastTargetRole === 'customer'
          ? tr('All Customers', 'सभी ग्राहकों')
          : broadcastTargetRole === 'barber'
          ? tr('All Barbers & Salons', 'सभी बार्बर और सैलून')
          : broadcastTargetRole === 'all'
          ? tr('Everyone (Customers & Barbers)', 'सभी उपयोगकर्ताओं')
          : tr('Selected User', 'चयनित उपयोगकर्ता');
      setBroadcastFeedback(
        tr(
          `✓ Broadcast message delivered in real time to ${targetLabel}.`,
          `✓ ब्रॉडकास्ट संदेश ${targetLabel} को भेज दिया गया है।`
        )
      );
      setTimeout(() => setBroadcastFeedback(''), 4500);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111113] text-[#FFF9E8] py-10 sm:py-14">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 space-y-8">
        {/* Top Founder Admin Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-[#F1E194]/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194] mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>
                {tr(
                  `FOUNDER ADMIN CONSOLE • ${OWNER_ADMIN_EMAIL}`,
                  `फाउंडर एडमिन कंसोल • ${OWNER_ADMIN_EMAIL}`
                )}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#FFF9E8]">
              {tr('Platform Operations & Governance', 'प्लेटफ़ॉर्म संचालन और नियंत्रण')}
            </h1>
            <p className="text-xs text-[#8A8178] mt-1 font-mono-num">
              {istNow.dateStr} · {istNow.timeStr} ({istNow.shortBadge})
            </p>
          </div>
        </div>

        {/* Real Platform KPIs (Total Users, Customers, Barbers, Shops, Appointments, Active Queues, Completed, Revenue) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/20 p-5">
            <Users className="w-4 h-4 text-[#F1E194] mb-2" />
            <div className="font-display font-mono-num text-3xl font-bold text-[#FFF9E8]">
              {profiles.length}
            </div>
            <div className="text-xs text-[#8A8178] mt-1">
              {tr('Users', 'कुल उपयोगकर्ता')} ({totalCustomers}{' '}
              {tr('Cust', 'ग्राहक')} · {totalBarbersCount}{' '}
              {tr('Barbers', 'बार्बर')})
            </div>
          </div>

          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/20 p-5">
            <Store className="w-4 h-4 text-[#F1E194] mb-2" />
            <div className="font-display font-mono-num text-3xl font-bold text-[#FFF9E8]">
              {shops.length}
            </div>
            <div className="text-xs text-[#8A8178] mt-1">
              {tr('Partner Salons', 'पार्टनर सैलून')} · {queue.length}{' '}
              {tr('In Queue', 'कतार में')}
            </div>
          </div>

          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/20 p-5">
            <Calendar className="w-4 h-4 text-[#F1E194] mb-2" />
            <div className="font-display font-mono-num text-3xl font-bold text-[#FFF9E8]">
              {appointments.length}
            </div>
            <div className="text-xs text-[#8A8178] mt-1">
              {tr('Bookings', 'बुकिंग')} ({completedBookingsCount}{' '}
              {tr('Completed', 'पूर्ण')})
            </div>
          </div>

          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/20 p-5">
            <TrendingUp className="w-4 h-4 text-[#F1E194] mb-2" />
            <div className="font-display font-mono-num text-3xl font-bold text-[#F1E194]">
              {formatINR(totalGmvINR)}
            </div>
            <div className="text-xs text-[#8A8178] mt-1">
              {tr('Platform Revenue (INR)', 'कुल राजस्व (₹ INR)')}
            </div>
          </div>

          <div className="rounded-[20px] bg-[#241719] border border-[#F1E194]/20 p-5">
            <Tag className="w-4 h-4 text-[#F1E194] mb-2" />
            <div className="font-display font-mono-num text-3xl font-bold text-[#FFF9E8]">
              {coupons.length}
            </div>
            <div className="text-xs text-[#8A8178] mt-1">
              {tr('Active Coupons', 'सक्रिय कूपन')} · {cancellationRate}%{' '}
              {tr('Cancel Rate', 'रद्द दर')}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'overview', label: tr('Bookings, Queue & Analytics', 'बुकिंग, कतार और एनालिटिक्स') },
            { id: 'users', label: tr('Users & Barber Verification', 'उपयोगकर्ता और बार्बर सत्यापन') },
            { id: 'shops', label: tr('Partner Salons', 'पार्टनर सैलून') },
            { id: 'broadcast', label: tr('Broadcast Messages', 'ब्रॉडकास्ट संदेश') },
            { id: 'coupons', label: tr('Coupons (INR)', 'कूपन (₹)') },
            { id: 'payments', label: tr('Payments Ledger', 'भुगतान खाता') },
            { id: 'moderation', label: tr('Reports & Reviews', 'रिपोर्ट और समीक्षाएं') },
            { id: 'supabase', label: tr('Supabase Project', 'Supabase कॉन्फ़िगरेशन') },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-5 py-2.5 rounded-[14px] text-xs font-semibold cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-[#F1E194] text-[#111113]'
                  : 'bg-[#241719] text-[#FFF9E8]/80 border border-[#F1E194]/15'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW: Real Appointments, Queue & Platform Analytics */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {tr('Platform Appointments', 'प्लेटफ़ॉर्म अपॉइंटमेंट्स')} ({appointments.length})
                </h2>
                {appointments.length === 0 ? (
                  <p className="text-xs text-[#8A8178] py-6">
                    {tr('No appointments recorded yet.', 'अभी कोई अपॉइंटमेंट दर्ज नहीं हुआ है।')}
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {appointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#FFF9E8]">
                            {apt.clientName} → {apt.barberName}
                          </p>
                          <p className="text-[#8A8178]">
                            {apt.serviceName} ·{' '}
                            {formatISTDateString(apt.date, lang)} ({apt.time} IST)
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono-num font-bold text-[#F1E194] block">
                            {formatINR(apt.price)}
                          </span>
                          <span className="text-[10px] text-[#8A8178]">
                            {apt.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
                <h2 className="font-display text-2xl font-bold">
                  {tr('Active Queue Telemetry', 'लाइव कतार मॉनिटर')} ({queue.length})
                </h2>
                {queue.length === 0 ? (
                  <p className="text-xs text-[#8A8178] py-6">
                    {tr('No customers in the live queue right now.', 'अभी लाइव कतार में कोई ग्राहक नहीं है।')}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {queue.map((q) => (
                      <div
                        key={q.id}
                        className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono-num text-[#F1E194] font-bold">
                            #{q.position}
                          </span>{' '}
                          <span className="font-semibold">{q.clientName}</span>
                          <p className="text-[#8A8178]">
                            {q.serviceName} · {q.barberName}
                          </p>
                        </div>
                        <span className="font-mono-num text-[#F1E194]">
                          {q.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Platform Analytics Summary */}
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Platform Growth & Usage Analytics', 'प्लेटफ़ॉर्म विकास और उपयोग विश्लेषण')}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12">
                  <span className="text-[#8A8178] block">
                    {tr('Active Users / Growth', 'सक्रिय उपयोगकर्ता')}
                  </span>
                  <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                    {profiles.filter((p: any) => p.status !== 'suspended').length} / {profiles.length}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12">
                  <span className="text-[#8A8178] block">
                    {tr('Most Popular Service', 'सबसे लोकप्रिय सेवा')}
                  </span>
                  <span className="font-semibold text-sm text-[#FFF9E8] block mt-1 truncate">
                    {popularServiceName}
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12">
                  <span className="text-[#8A8178] block">
                    {tr('Cancellation Rate', 'रद्दीकरण दर')}
                  </span>
                  <span className="font-mono-num text-xl font-bold text-[#FFF9E8]">
                    {cancellationRate}% ({cancelledBookingsCount})
                  </span>
                </div>
                <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12">
                  <span className="text-[#8A8178] block">
                    {tr('Live Queue Usage', 'लाइव कतार उपयोग')}
                  </span>
                  <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                    {queue.length} {tr('Active', 'सक्रिय')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* USERS & BARBER VERIFICATION */}
        {activeSection === 'users' && (
          <div className="space-y-6">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="font-display text-2xl font-bold">
                  {tr('User Management & Role Access', 'उपयोगकर्ता प्रबंधन')} ({filteredProfiles.length})
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8A8178] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder={tr('Search name, email, role...', 'नाम या ईमेल खोजें...')}
                      className="pl-8 pr-3 py-1.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  {(['all', 'customer', 'barber'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setUserRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-[10px] text-xs font-semibold cursor-pointer uppercase ${
                        userRoleFilter === r
                          ? 'bg-[#F1E194] text-[#111113]'
                          : 'bg-[#111113] text-[#8A8178]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {filteredProfiles.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr('No matching users found.', 'कोई उपयोगकर्ता नहीं मिला।')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {filteredProfiles.map((u: any) => (
                    <div
                      key={u.uid}
                      className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-sm text-[#FFF9E8]">
                          {u.name}{' '}
                          <span className="text-[#F1E194] uppercase text-[10px] ml-2">
                            [{u.role}]
                          </span>
                          {u.status === 'suspended' && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-[#5B0E14] text-[#FFF9E8] text-[10px]">
                              SUSPENDED
                            </span>
                          )}
                        </p>
                        <p className="text-[#8A8178]">
                          {u.email} {u.phone ? `· ${u.phone}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBroadcastTargetRole('specific');
                            setBroadcastSpecificUid(u.uid);
                            setActiveSection('broadcast');
                          }}
                          className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] font-semibold cursor-pointer"
                        >
                          {tr('Message User', 'संदेश भेजें')}
                        </button>
                        {onUpdateProfile && u.email !== OWNER_ADMIN_EMAIL && (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateProfile(u.uid, {
                                status:
                                  u.status === 'suspended' ? 'active' : 'suspended',
                              })
                            }
                            className={`px-3 py-1.5 rounded-[10px] font-semibold cursor-pointer ${
                              u.status === 'suspended'
                                ? 'bg-emerald-950 text-emerald-300'
                                : 'bg-[#5B0E14] text-[#FFF9E8]'
                            }`}
                          >
                            {u.status === 'suspended'
                              ? tr('Activate', 'सक्रिय करें')
                              : tr('Suspend', 'निलंबित करें')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* BARBER VERIFICATION */}
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Barber Profile Verification', 'बार्बर प्रोफ़ाइल सत्यापन')} ({barbers.length})
              </h2>
              {barbers.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-4">
                  {tr('No barber profiles registered yet.', 'अभी तक कोई बार्बर प्रोफ़ाइल पंजीकृत नहीं है।')}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {barbers.map((b: any) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/12 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-sm text-[#FFF9E8]">
                          {b.name} ·{' '}
                          <span className="text-[#F1E194]">{b.shopName}</span>
                        </p>
                        <p className="text-[#8A8178]">
                          {b.role} · {b.specialty} · Status:{' '}
                          <span className="uppercase text-[#F1E194]">
                            {b.verificationStatus || 'verified'}
                          </span>
                        </p>
                      </div>
                      {onUpdateBarber && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateBarber(b.id, {
                                verified: true,
                                verificationStatus: 'verified',
                                active: true,
                              })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-emerald-950 text-emerald-300 font-semibold cursor-pointer"
                          >
                            {tr('Verify Barber', 'सत्यापित करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateBarber(b.id, {
                                verified: false,
                                verificationStatus: 'rejected',
                              })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-[#8A8178] font-semibold cursor-pointer"
                          >
                            {tr('Reject', 'अस्वीकार करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateBarber(b.id, {
                                active: false,
                                verificationStatus: 'suspended',
                              })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] font-semibold cursor-pointer"
                          >
                            {tr('Suspend', 'निलंबित करें')}
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

        {/* SHOPS MANAGEMENT */}
        {activeSection === 'shops' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold">
              {tr('Partner Salon Review, Verification & Governance', 'पार्टनर सैलून समीक्षा और सत्यापन')} ({shops.length})
            </h2>
            {shops.length === 0 ? (
              <p className="text-xs text-[#8A8178] py-6">
                {tr('No partner salons registered yet.', 'अभी कोई पार्टनर सैलून पंजीकृत नहीं है।')}
              </p>
            ) : (
              <div className="space-y-3">
                {shops.map((s: any) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-sm text-[#FFF9E8]">
                        {s.name}{' '}
                        <span className="text-[#F1E194] uppercase text-[10px] ml-2">
                          [{s.approvalStatus || 'approved'} ·{' '}
                          {s.verified ? 'Verified ✓' : 'Unverified'}]
                        </span>
                      </p>
                      <p className="text-[#8A8178]">
                        {s.address} · {s.district} · {s.phone}
                      </p>
                    </div>
                    {onUpdateShop && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateShop(s.id, {
                              approvalStatus: 'approved',
                              verified: true,
                              isOpen: true,
                            })
                          }
                          className="px-3 py-1.5 rounded-[10px] bg-emerald-950 text-emerald-300 font-semibold cursor-pointer"
                        >
                          {tr('Approve & Verify', 'स्वीकृत और सत्यापित')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateShop(s.id, {
                              approvalStatus: 'rejected',
                              verified: false,
                            })
                          }
                          className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-[#8A8178] font-semibold cursor-pointer"
                        >
                          {tr('Reject', 'अस्वीकार')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateShop(s.id, {
                              approvalStatus:
                                s.approvalStatus === 'suspended'
                                  ? 'approved'
                                  : 'suspended',
                            })
                          }
                          className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] font-semibold cursor-pointer"
                        >
                          {s.approvalStatus === 'suspended'
                            ? tr('Activate Shop', 'सक्रिय करें')
                            : tr('Suspend Shop', 'निलंबित करें')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* BROADCAST MESSAGES (CHOICE OF CUSTOMER OR BARBER) */}
        {activeSection === 'broadcast' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194] flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span>
                  {tr(
                    'REAL-TIME BROADCAST DISPATCH • SUPABASE REALTIME',
                    'रियल-टाइम ब्रॉडकास्ट संदेश • SUPABASE REALTIME'
                  )}
                </span>
              </span>
              <h2 className="font-display text-3xl font-bold mt-1">
                {tr(
                  'Create Broadcast Message for Customers or Barbers',
                  'ग्राहकों या बार्बर के लिए ब्रॉडकास्ट संदेश बनाएं'
                )}
              </h2>
              <p className="text-xs text-[#8A8178] mt-1">
                {tr(
                  'Choose whether to broadcast your announcement to all Customers, all Barbers, Everyone, or a specific Customer/Barber account.',
                  'चुनें कि आप अपना संदेश सभी ग्राहकों, सभी बार्बर, या किसी विशेष उपयोगकर्ता को भेजना चाहते हैं।'
                )}
              </p>
            </div>

            {broadcastFeedback && (
              <div className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/40 text-xs text-[#F1E194] font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{broadcastFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#F1E194] mb-2">
                  {tr(
                    '1. Select Target Recipient Group (Customer or Barber)',
                    '1. प्राप्तकर्ता समूह चुनें (ग्राहक या बार्बर)'
                  )}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                      className={`py-3 px-4 rounded-[14px] text-xs font-semibold border cursor-pointer text-left ${
                        broadcastTargetRole === opt.id
                          ? 'bg-[#F1E194] text-[#111113] border-[#F1E194]'
                          : 'bg-[#111113] text-[#FFF9E8] border-[#F1E194]/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {broadcastTargetRole === 'specific' && (
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1.5">
                    {tr(
                      'Select Specific Customer or Barber',
                      'विशेष ग्राहक या बार्बर चुनें'
                    )}
                  </label>
                  <select
                    value={broadcastSpecificUid}
                    onChange={(e) => setBroadcastSpecificUid(e.target.value)}
                    className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#FFF9E8]"
                  >
                    {profiles.map((p: any) => (
                      <option key={p.uid} value={p.uid}>
                        [{String(p.role || 'customer').toUpperCase()}] {p.name} (
                        {p.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1.5">
                    {tr('Sender / Broadcast Heading', 'प्रेषक / शीर्षक')}
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastSenderTitle}
                    onChange={(e) => setBroadcastSenderTitle(e.target.value)}
                    placeholder="BarberLoo Platform Notice"
                    className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-[#8A8178] mb-1.5">
                    {tr('Broadcast Message Content', 'ब्रॉडकास्ट संदेश')}
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder={tr(
                      'Write your announcement for the selected Customers or Barbers...',
                      'चयनित ग्राहकों या बार्बर के लिए अपना संदेश लिखें...'
                    )}
                    className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingBroadcast}
                className="px-7 py-3.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                {isSendingBroadcast
                  ? tr('Sending Broadcast...', 'भेजा जा रहा है...')
                  : tr('Send Broadcast Message Now', 'अभी ब्रॉडकास्ट संदेश भेजें')}
              </button>
            </form>
          </div>
        )}

        {/* COUPONS */}
        {activeSection === 'coupons' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Promotional Coupons', 'प्रमोशनल कूपन')}
              </h2>
              {coupons.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr('No coupons created yet.', 'अभी कोई कूपन नहीं बनाया गया है।')}
                </p>
              ) : (
                <div className="space-y-3">
                  {coupons.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono-num font-bold text-[#F1E194]">
                          {c.code}
                        </span>{' '}
                        · {c.discountPercent}% OFF ({tr('Min:', 'न्यूनतम:')}{' '}
                        {formatINR(c.minSpend)})
                      </div>
                      {onUpdateCoupon && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateCoupon(c.id, {
                              status: c.status === 'Active' ? 'Paused' : 'Active',
                            })
                          }
                          className="px-3 py-1 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] cursor-pointer"
                        >
                          {c.status}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h3 className="font-display text-2xl font-bold">
                {tr('Create Coupon Code', 'नया कूपन कोड बनाएं')}
              </h3>
              <form onSubmit={handleAddCoupon} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Code', 'कोड')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="WELCOME20"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs uppercase text-[#FFF9E8]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Discount (%)', 'छूट (%)')}
                    </label>
                    <input
                      type="number"
                      required
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Min Spend (₹)', 'न्यूनतम खर्च (₹)')}
                    </label>
                    <input
                      type="number"
                      required
                      value={newMinSpend}
                      onChange={(e) => setNewMinSpend(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  {tr('+ Create Coupon', '+ कूपन बनाएं')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {activeSection === 'payments' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#F1E194]" />
              <span>{tr('Payments Ledger (INR)', 'भुगतान विवरण (₹ INR)')}</span>
            </h2>
            {payments.length === 0 ? (
              <p className="text-xs text-[#8A8178] py-6">
                {tr('No payment transactions recorded yet.', 'अभी कोई भुगतान लेनदेन दर्ज नहीं है।')}
              </p>
            ) : (
              <div className="space-y-2.5">
                {payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-[#FFF9E8]">
                        {p.clientName} · {p.shopName}
                      </p>
                      <p className="text-[#8A8178]">
                        {p.methodDisplay || p.method} · {p.receiptNumber}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num font-bold text-[#F1E194]">
                        {formatINR(p.amount)}
                      </span>
                      <span className="px-2.5 py-1 rounded-[8px] bg-[#241719] text-[10px] uppercase">
                        {p.status}
                      </span>
                      {onUpdatePayment && p.status !== 'refunded' && (
                        <button
                          type="button"
                          onClick={() => onUpdatePayment(p.id, 'refunded')}
                          className="text-[11px] text-[#F1E194] underline cursor-pointer"
                        >
                          {tr('Refund', 'रिफंड')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODERATION (REPORTS & REVIEWS) */}
        {activeSection === 'moderation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                <Flag className="w-5 h-5 text-[#F1E194]" />
                <span>
                  {tr('User Reports & Investigations', 'उपयोगकर्ता रिपोर्ट')} ({reports.length})
                </span>
              </h2>
              {reports.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr('No reports submitted yet.', 'अभी तक कोई रिपोर्ट नहीं है।')}
                </p>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep: any) => (
                    <div
                      key={rep.id}
                      className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#FFF9E8]">
                          {rep.reason} ({rep.targetLabel}) ·{' '}
                          <span className="text-[#F1E194] uppercase">
                            [{rep.status}]
                          </span>
                        </p>
                        <p className="text-[#8A8178]">{rep.details}</p>
                      </div>
                      {onUpdateReport && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateReport(rep.id, { status: 'investigating' })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] font-semibold cursor-pointer"
                          >
                            {tr('Investigate', 'जांच करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateReport(rep.id, { status: 'resolved' })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                          >
                            {tr('Resolve', 'समाधान करें')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <h2 className="font-display text-2xl font-bold">
                {tr('Review Moderation', 'समीक्षा मॉडरेशन')} ({reviews.length})
              </h2>
              {reviews.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-6">
                  {tr('No reviews submitted yet.', 'अभी तक कोई समीक्षा नहीं है।')}
                </p>
              ) : (
                <div className="space-y-3">
                  {reviews.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-[#FFF9E8]">
                          {rev.author} · {rev.rating}★ ({rev.barber}) ·{' '}
                          <span className="text-[#F1E194] uppercase">
                            [{rev.status || 'published'}]
                          </span>
                        </p>
                        <p className="text-[#8A8178]">{rev.comment}</p>
                      </div>
                      {onUpdateReview && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateReview(rev.id, {
                              status:
                                rev.status === 'hidden' ? 'published' : 'hidden',
                            })
                          }
                          className={`px-3 py-1.5 rounded-[10px] font-semibold cursor-pointer ${
                            rev.status === 'hidden'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-[#5B0E14] text-[#FFF9E8]'
                          }`}
                        >
                          {rev.status === 'hidden'
                            ? tr('Restore Review', 'पुनर्स्थापित करें')
                            : tr('Hide Review', 'छुपाएं')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUPABASE CONFIGURATION & SQL SCHEMA */}
        {activeSection === 'supabase' && (
          <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194]">
                  SUPABASE CONNECTED • REALTIME &amp; AUTH
                </span>
                <h2 className="font-display text-3xl font-bold mt-1">
                  {SUPABASE_URL}
                </h2>
                <p className="text-xs text-[#8A8178] mt-1">
                  {tr(
                    'Supabase Auth, Realtime Broadcast, and Table Sync are active. Run the SQL below in your Supabase SQL Editor if you have not created the public tables yet.',
                    'Supabase Auth और Realtime सक्रिय हैं। यदि आपने अभी तक Supabase में टेबल नहीं बनाई हैं, तो नीचे दिया गया SQL अपने Supabase SQL Editor में चलाएं।'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                  setCopiedSchema(true);
                  setTimeout(() => setCopiedSchema(false), 3000);
                }}
                className="px-5 py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider shrink-0 cursor-pointer"
              >
                {copiedSchema
                  ? tr('✓ Copied SQL Schema', '✓ SQL कॉपी हो गया')
                  : tr('Copy Supabase SQL Schema', 'Supabase SQL कॉपी करें')}
              </button>
            </div>
            <pre className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15 text-[11px] font-mono-num text-[#F1E194]/90 overflow-x-auto max-h-80">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
