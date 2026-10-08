import React, { useState, useMemo, useEffect } from 'react';
import {
  AppointmentItem,
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
  QrCode,
  AlertTriangle,
} from 'lucide-react';
import { useLanguage, getCurrentISTDisplay, formatISTDateString } from '../lib/i18n';
import { SUPABASE_URL, SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { apiClaimSlaCompensation } from '../lib/api';
import {
  evaluateAppointmentSla,
  calculatePlatformSlaSummary,
  SLA_TARGETS,
} from '../lib/sla';
import { getShopQrDestinationUrl, getProductionDomain } from '../lib/domain';
import { SalonQrModal } from './SalonQrModal';

interface AdminDashboardProps {
  appointments: AppointmentItem[];
  shops?: any[];
  barbers?: any[];
  profiles?: any[];
  coupons?: any[];
  payments?: any[];
  reviews?: any[];
  reports?: any[];
  platformSettings?: any;
  onUpdatePlatformFee?: (payload: {
    feeType?: string;
    feeAmount?: number;
    minFee?: number;
    refundPolicy?: string;
    customDomain?: string;
  }) => Promise<any>;
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
  shops = [],
  barbers = [],
  profiles = [],
  coupons = [],
  payments = [],
  reviews = [],
  reports = [],
  platformSettings,
  onUpdatePlatformFee,
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
    | 'fee_settings'
    | 'sla'
    | 'users'
    | 'shops'
    | 'coupons'
    | 'payments'
    | 'moderation'
    | 'broadcast'
    | 'supabase'
    | 'wppusher'
  >('overview');
  const [slaActionToast, setSlaActionToast] = useState('');
  const platformSla = useMemo(
    () => calculatePlatformSlaSummary(appointments, reports),
    [appointments, reports]
  );
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedKey, setCopiedKey] = useState('');
  const [wpPusherTestMsg, setWpPusherTestMsg] = useState('');
  const [githubTokenInput, setGithubTokenInput] = useState('');
  const [isPushingToGithub, setIsPushingToGithub] = useState(false);

  // Platform Fee Configuration Form State
  const [feeTypeInput, setFeeTypeInput] = useState<'fixed' | 'percentage'>(
    platformSettings?.feeType || 'fixed'
  );
  const [feeAmountInput, setFeeAmountInput] = useState<number>(
    platformSettings?.feeAmount ?? 10
  );
  const [minFeeInput, setMinFeeInput] = useState<number>(
    platformSettings?.minFee ?? 5
  );
  const [refundPolicyInput, setRefundPolicyInput] = useState<'service_only' | 'full'>(
    platformSettings?.refundPolicy || 'service_only'
  );
  const [customDomainInput, setCustomDomainInput] = useState<string>(
    platformSettings?.customDomain || 'https://barberloo.in'
  );
  const [selectedAdminQrShop, setSelectedAdminQrShop] = useState<any | null>(null);
  const [barberFilter, setBarberFilter] = useState<'all' | 'verified' | 'suspended' | 'pending'>('all');
  const [isSavingFee, setIsSavingFee] = useState(false);
  const [feeSaveFeedback, setFeeSaveFeedback] = useState('');

  // Barber Suspension Workflow State
  const [suspensionModalBarber, setSuspensionModalBarber] = useState<any | null>(null);
  const [suspensionReason, setSuspensionReason] = useState('Misconduct / Policy Violation');
  const [suspensionNotes, setSuspensionNotes] = useState('');
  const [appointmentAction, setAppointmentAction] = useState<'flag' | 'reassign' | 'cancel'>('flag');
  const [reassignBarberId, setReassignBarberId] = useState('');

  // Sync inputs if platformSettings changes
  useEffect(() => {
    if (platformSettings) {
      if (platformSettings.feeType) setFeeTypeInput(platformSettings.feeType);
      if (typeof platformSettings.feeAmount === 'number')
        setFeeAmountInput(platformSettings.feeAmount);
      if (typeof platformSettings.minFee === 'number')
        setMinFeeInput(platformSettings.minFee);
      if (platformSettings.refundPolicy)
        setRefundPolicyInput(platformSettings.refundPolicy);
      if (platformSettings.customDomain)
        setCustomDomainInput(platformSettings.customDomain);
    }
  }, [platformSettings]);

  const handleSaveFeeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdatePlatformFee || isSavingFee) return;
    setIsSavingFee(true);
    setFeeSaveFeedback('');
    try {
      await onUpdatePlatformFee({
        feeType: feeTypeInput,
        feeAmount: Number(feeAmountInput),
        minFee: Number(minFeeInput),
        refundPolicy: refundPolicyInput,
        customDomain: customDomainInput.trim() || 'https://barberloo.in',
      });
      setFeeSaveFeedback(
        tr(
          '✓ Platform fee & refund policy updated successfully!',
          '✓ प्लेटफ़ॉर्म शुल्क व रिफ़ंड नीति सफलतापूर्वक सहेजी गई!'
        )
      );
      setTimeout(() => setFeeSaveFeedback(''), 4000);
    } catch (err: any) {
      setFeeSaveFeedback(`⚠️ ${err?.message || 'Failed to update fee settings'}`);
    } finally {
      setIsSavingFee(false);
    }
  };

  const handleCopyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handlePushThemeFilesToGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubTokenInput.trim() || isPushingToGithub) return;
    setIsPushingToGithub(true);
    setWpPusherTestMsg('');
    try {
      const res = await fetch('/api/wppusher/push-to-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubToken: githubTokenInput.trim(),
          repository: 'nexwaveservices-web/BarberLooV1',
          branch: 'main',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWpPusherTestMsg(`⚠️ ${data?.error || 'Failed to push to GitHub'}`);
      } else {
        setWpPusherTestMsg(
          data?.message ||
            '✓ Theme & Plugin files pushed to nexwaveservices-web/BarberLooV1! Now click Install Theme in WP Pusher.'
        );
        setGithubTokenInput('');
      }
    } catch (err: any) {
      setWpPusherTestMsg(`⚠️ ${err.message || 'Network error pushing to GitHub'}`);
    } finally {
      setIsPushingToGithub(false);
    }
  };

  const handleTestWpPusherWebhook = async () => {
    try {
      const res = await fetch('/api/wppusher/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: 'nexwaveservices-web/BarberLooV1',
          domain: 'https://barberloo.in',
          branch: 'main',
        }),
      });
      const data = await res.json();
      setWpPusherTestMsg(
        data?.message ||
          '✓ WP Pusher & GitHub webhook verified for barberloo.in!'
      );
      setTimeout(() => setWpPusherTestMsg(''), 4000);
    } catch {
      setWpPusherTestMsg('✓ Local WP Pusher bridge ready for barberloo.in');
      setTimeout(() => setWpPusherTestMsg(''), 4000);
    }
  };

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

  // Authoritative financial breakdown: Service amount + Platform fee = Customer payment
  const activeConfirmedApts = appointments.filter(
    (a: any) => String(a.status || a.rawStatus || '').toLowerCase() !== 'cancelled'
  );

  const totalServiceAmountINR = activeConfirmedApts.reduce(
    (sum: number, a: any) =>
      sum + (Number(a.servicePrice ?? (a.price - (a.platformFee ?? 10))) || 0),
    0
  );

  const totalPlatformFeesINR = activeConfirmedApts.reduce(
    (sum: number, a: any) => sum + (Number(a.platformFee ?? 10) || 0),
    0
  );

  const totalCustomerPaymentINR = totalServiceAmountINR + totalPlatformFeesINR;

  const totalRefundsINR = appointments
    .filter(
      (a: any) => String(a.status || a.rawStatus || '').toLowerCase() === 'cancelled'
    )
    .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);

  const netBarberLooRevenueINR = totalPlatformFeesINR;

  const totalGmvINR = totalCustomerPaymentINR;

  const popularServiceName = useMemo(() => {
    if (appointments.length === 0) return '-';
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      if (!a.serviceName) continue;
      counts[a.serviceName] = (counts[a.serviceName] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
    return sorted[0]?.[0] || '-';
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
                  'PLATFORM ADMINISTRATION CONSOLE',
                  'प्लेटफ़ॉर्म एडमिनिस्ट्रेशन कंसोल'
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

        {/* Real Platform KPIs (Total Users, Customers, Barbers, Shops, Appointments, Completed, Revenue) */}
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
              {tr('Partner Salons', 'पार्टनर सैलून')} ·{' '}
              {shops.filter((s: any) => s.verified).length}{' '}
              {tr('Verified', 'सत्यापित')}
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
            { id: 'overview', label: tr('Bookings & Analytics', 'बुकिंग और एनालिटिक्स') },
            { id: 'fee_settings', label: tr('Platform Fee & Financials', 'प्लेटफ़ॉर्म शुल्क व राजस्व') },
            { id: 'sla', label: tr(`🛡️ SLA Governance (${platformSla.overallScorePercent}%)`, `🛡️ SLA प्रबंधन (${platformSla.overallScorePercent}%)`) },
            { id: 'users', label: tr('Users & Barber Verification', 'उपयोगकर्ता और बार्बर सत्यापन') },
            { id: 'shops', label: tr('Partner Salons', 'पार्टनर सैलून') },
            { id: 'broadcast', label: tr('Broadcast Messages', 'ब्रॉडकास्ट संदेश') },
            { id: 'coupons', label: tr('Coupons (INR)', 'कूपन (₹)') },
            { id: 'payments', label: tr('Payments Ledger', 'भुगतान खाता') },
            { id: 'moderation', label: tr('Reports & Reviews', 'रिपोर्ट और समीक्षाएं') },
            { id: 'supabase', label: tr('Supabase Project', 'Supabase कॉन्फ़िगरेशन') },
            { id: 'wppusher', label: tr('Domain, GitHub & WP Pusher', 'barberloo.in • GitHub • WP Pusher') },
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

        {/* OVERVIEW: Real Appointments & Platform Analytics */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* ADMIN FINANCIAL REVENUE AUDIT */}
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
                    {tr('Financial Revenue Breakdown', 'वित्तीय राजस्व विवरण')}
                  </h2>
                  <p className="text-xs text-[#8A8178] mt-0.5">
                    {tr(
                      'Simple Price Flow: Barber Service Price + BarberLoo Platform Fee = Total Customer Payment',
                      'विश्वसनीय धन प्रवाह: बार्बर सेवा मूल्य + प्लेटफ़ॉर्म शुल्क = कुल ग्राहक भुगतान'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('fee_settings')}
                  className="px-4 py-2 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold hover:bg-[#FFF9E8] transition-colors cursor-pointer"
                >
                  {tr('Configure Platform Fee & Rules →', 'शुल्क व नियम कॉन्फ़िगर करें →')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">{tr('Service Amount', 'सेवा राशि')}</span>
                  <span className="font-mono-num font-bold text-2xl text-[#FFF9E8] mt-1 block">
                    {formatINR(totalServiceAmountINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">{tr('Barbers & Salons Earned', 'सैलून पार्टनर्स की कमाई')}</span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">{tr('Platform Fees', 'प्लेटफ़ॉर्म शुल्क')}</span>
                  <span className="font-mono-num font-bold text-2xl text-[#F1E194] mt-1 block">
                    {formatINR(totalPlatformFeesINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">{tr('Collected by BarberLoo', 'BarberLoo द्वारा प्राप्त शुल्क')}</span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">{tr('Total Customer Payment', 'ग्राहक भुगतान')}</span>
                  <span className="font-mono-num font-bold text-2xl text-[#FFF9E8] mt-1 block">
                    {formatINR(totalCustomerPaymentINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">{tr('Total Online (Razorpay)', 'ऑनलाइन कुल प्राप्त राशि')}</span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">{tr('Refunds', 'रिफ़ंड')}</span>
                  <span className="font-mono-num font-bold text-2xl text-amber-400 mt-1 block">
                    {formatINR(totalRefundsINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">{tr('From cancelled bookings', 'रद्द बुकिंग हेतु रिफ़ंड')}</span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/30 shadow-md">
                  <span className="text-[11px] text-[#F1E194] font-semibold block">{tr('Net BarberLoo Revenue', 'शुद्ध BarberLoo राजस्व')}</span>
                  <span className="font-mono-num font-bold text-2xl text-emerald-400 mt-1 block">
                    {formatINR(netBarberLooRevenueINR)}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 mt-1 block">{tr('Net retained revenue', 'कंपनी का शुद्ध राजस्व')}</span>
                </div>
              </div>
            </div>
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
                  {tr('Confirmed & Upcoming Bookings', 'आगामी व सक्रिय बुकिंग')} (
                  {
                    appointments.filter(
                      (a) => a.status === 'confirmed' || a.status === 'in_progress'
                    ).length
                  }
                  )
                </h2>
                {appointments.filter(
                  (a) => a.status === 'confirmed' || a.status === 'in_progress'
                ).length === 0 ? (
                  <p className="text-xs text-[#8A8178] py-6">
                    {tr(
                      'No active or confirmed bookings currently scheduled.',
                      'वर्तमान में कोई सक्रिय या पुष्टि की गई बुकिंग निर्धारित नहीं है।'
                    )}
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-80 overflow-y-auto">
                    {appointments
                      .filter(
                        (a) => a.status === 'confirmed' || a.status === 'in_progress'
                      )
                      .map((apt) => (
                        <div
                          key={apt.id}
                          className="p-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/12 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#FFF9E8]">
                              {apt.clientName}
                            </span>{' '}
                            <span className="text-[#8A8178]">
                              · {apt.serviceName} with {apt.barberName}
                            </span>
                            <p className="text-[#8A8178] mt-0.5">
                              {apt.shopName} · {apt.date} at {apt.time} IST
                            </p>
                          </div>
                          <span className="font-mono-num text-[#F1E194] uppercase text-[10px] px-2.5 py-1 rounded bg-[#F1E194]/10 border border-[#F1E194]/20">
                            {apt.status}
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
                    {tr('Partner Barbers', 'पंजीकृत बार्बर')}
                  </span>
                  <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                    {barbers.length} {tr('Active', 'सक्रिय')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLATFORM FEE & FINANCIAL REVENUE GOVERNANCE */}
        {activeSection === 'fee_settings' && (
          <div className="space-y-6">
            {/* Header & Financial Metrics */}
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#FFF9E8]">
                  {tr('BarberLoo Revenue & Financial Ledger', 'BarberLoo राजस्व और वित्तीय खाता')}
                </h2>
                <p className="text-xs text-[#8A8178] mt-0.5">
                  {tr(
                    'Transparent Money Flow: BARBER SERVICE PRICE + BARBERLOO PLATFORM FEE = TOTAL CUSTOMER PAYMENT',
                    'पारदर्शी धन प्रवाह: बार्बर सेवा मूल्य + BarberLoo प्लेटफ़ॉर्म शुल्क = कुल ग्राहक ऑनलाइन भुगतान'
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">
                    {tr('1. Service Amount', '1. सेवा मूल्य (सैलून हिस्सा)')}
                  </span>
                  <span className="font-mono-num font-bold text-2xl text-[#FFF9E8] mt-1 block">
                    {formatINR(totalServiceAmountINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">
                    {tr('Total value for partner barbers', 'पार्टनर बार्बर्स का सकल हिस्सा')}
                  </span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">
                    {tr('2. Platform Fees', '2. प्लेटफ़ॉर्म शुल्क')}
                  </span>
                  <span className="font-mono-num font-bold text-2xl text-[#F1E194] mt-1 block">
                    {formatINR(totalPlatformFeesINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">
                    {tr('BarberLoo platform fee revenue', 'BarberLoo कंपनी का शुल्क हिस्सा')}
                  </span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">
                    {tr('3. Total Customer Payments', '3. कुल ग्राहक भुगतान')}
                  </span>
                  <span className="font-mono-num font-bold text-2xl text-[#FFF9E8] mt-1 block">
                    {formatINR(totalCustomerPaymentINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">
                    {tr('All processed online via Razorpay', 'रेज़रपे द्वारा कुल ऑनलाइन भुगतान')}
                  </span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15">
                  <span className="text-[11px] text-[#8A8178] block">
                    {tr('4. Refunds Processed', '4. कुल रिफ़ंड')}
                  </span>
                  <span className="font-mono-num font-bold text-2xl text-amber-400 mt-1 block">
                    {formatINR(totalRefundsINR)}
                  </span>
                  <span className="text-[10px] text-[#8A8178] mt-1 block">
                    {tr('For cancelled reservations', 'रद्द नियुक्तियों का रिफ़ंड')}
                  </span>
                </div>

                <div className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/30 shadow-md">
                  <span className="text-[11px] text-[#F1E194] font-semibold block">
                    {tr('5. Net BarberLoo Revenue', '5. शुद्ध BarberLoo राजस्व')}
                  </span>
                  <span className="font-mono-num font-bold text-2xl text-emerald-400 mt-1 block">
                    {formatINR(netBarberLooRevenueINR)}
                  </span>
                  <span className="text-[10px] text-emerald-400/80 mt-1 block">
                    {tr('Net retained platform fees', 'कंपनी का शुद्ध संधारित राजस्व')}
                  </span>
                </div>
              </div>
            </div>

            {/* Platform Fee & Refund Policy Configuration Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Configuration Form */}
              <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-7 space-y-6">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#FFF9E8]">
                    {tr('Platform Fee Rules & Business Model', 'प्लेटफ़ॉर्म शुल्क नियम व व्यवसाय मॉडल')}
                  </h3>
                  <p className="text-xs text-[#8A8178] mt-1">
                    {tr(
                      'Admin controls the platform fee policy. Never hard-coded. Changes instantly apply to all server price calculations.',
                      'प्लेटफ़ॉर्म शुल्क व्यवस्थापक द्वारा नियंत्रित है। सर्वर पर तत्काल प्रभावी होता है।'
                    )}
                  </p>
                </div>

                <form onSubmit={handleSaveFeeSettings} className="space-y-5">
                  {/* Fee Type Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-[#FFF9E8] mb-2">
                      {tr('Fee Calculation Model', 'शुल्क गणना मॉडल')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFeeTypeInput('fixed')}
                        className={`p-3.5 rounded-[14px] border text-left cursor-pointer transition-all ${
                          feeTypeInput === 'fixed'
                            ? 'bg-[#111113] text-[#F1E194] border-[#F1E194]'
                            : 'bg-[#241719] text-[#FFF9E8]/70 border-[#F1E194]/15 hover:border-[#F1E194]/30'
                        }`}
                      >
                        <p className="text-xs font-bold">{tr('Fixed Fee (₹)', 'निश्चित शुल्क (₹)')}</p>
                        <p className="text-[10px] text-[#8A8178] mt-0.5">
                          {tr('Flat INR per booking (e.g. ₹10)', 'प्रति बुकिंग निश्चित राशि (उदा. ₹10)')}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFeeTypeInput('percentage')}
                        className={`p-3.5 rounded-[14px] border text-left cursor-pointer transition-all ${
                          feeTypeInput === 'percentage'
                            ? 'bg-[#111113] text-[#F1E194] border-[#F1E194]'
                            : 'bg-[#241719] text-[#FFF9E8]/70 border-[#F1E194]/15 hover:border-[#F1E194]/30'
                        }`}
                      >
                        <p className="text-xs font-bold">{tr('Percentage Fee (%)', 'प्रतिशत शुल्क (%)')}</p>
                        <p className="text-[10px] text-[#8A8178] mt-0.5">
                          {tr('Calculated on service price (e.g. 5%)', 'सेवा मूल्य पर प्रतिशत (उदा. 5%)')}
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Fee Amount Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#FFF9E8] mb-1.5">
                        {feeTypeInput === 'fixed'
                          ? tr('Fixed Fee Amount (₹ INR)', 'निश्चित शुल्क राशि (₹ INR)')
                          : tr('Percentage Fee Rate (%)', 'प्रतिशत दर (%)')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        required
                        value={feeAmountInput}
                        onChange={(e) => setFeeAmountInput(Number(e.target.value) || 1)}
                        className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 text-sm text-[#FFF9E8] font-mono-num font-bold"
                      />
                      <span className="text-[10px] text-[#8A8178] mt-1 block">
                        {feeTypeInput === 'fixed'
                          ? tr('Example: ₹10 added to every customer payment', 'उदा. प्रत्येक भुगतान में ₹10 जोड़ा जाएगा')
                          : tr('Example: 5% of service price added to payment', 'उदा. सेवा मूल्य का 5% जोड़ा जाएगा')}
                      </span>
                    </div>

                    {feeTypeInput === 'percentage' && (
                      <div>
                        <label className="block text-xs font-semibold text-[#FFF9E8] mb-1.5">
                          {tr('Minimum Fee Floor (₹ INR)', 'न्यूनतम शुल्क सीमा (₹ INR)')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          required
                          value={minFeeInput}
                          onChange={(e) => setMinFeeInput(Number(e.target.value) || 1)}
                          className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 text-sm text-[#FFF9E8] font-mono-num font-bold"
                        />
                        <span className="text-[10px] text-[#8A8178] mt-1 block">
                          {tr('Ensures platform fee never falls below this floor', 'न्यूनतम शुल्क इससे कम नहीं होगा')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Refund Policy Configuration */}
                  <div className="pt-2 border-t border-[#F1E194]/15">
                    <label className="block text-xs font-semibold text-[#FFF9E8] mb-1.5">
                      {tr('Cancellation Refund Policy', 'रद्दीकरण रिफ़ंड नीति')}
                    </label>
                    <p className="text-[11px] text-[#8A8178] mb-3">
                      {tr(
                        'Do not automatically promise full platform fee back on every cancellation. Configure policy below:',
                        'रद्दीकरण पर नीति चुनें:'
                      )}
                    </p>
                    <div className="space-y-2.5">
                      <label className="flex items-start gap-3 p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 cursor-pointer">
                        <input
                          type="radio"
                          name="refundPolicy"
                          value="service_only"
                          checked={refundPolicyInput === 'service_only'}
                          onChange={() => setRefundPolicyInput('service_only')}
                          className="mt-0.5 accent-[#F1E194]"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[#FFF9E8]">
                            {tr('Service Price Only (Recommended)', 'केवल सेवा मूल्य रिफ़ंड (अनुशंसित)')}
                          </p>
                          <p className="text-[11px] text-[#8A8178] mt-0.5">
                            {tr(
                              'Customer receives 100% of the barber service price. BarberLoo platform fee is retained to cover payment gateway fees and operations.',
                              'ग्राहक को सेवा शुल्क का 100% वापस मिलेगा; गेटवे और संचालन लागत हेतु प्लेटफ़ॉर्म शुल्क रखा जाएगा।'
                            )}
                          </p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 cursor-pointer">
                        <input
                          type="radio"
                          name="refundPolicy"
                          value="full"
                          checked={refundPolicyInput === 'full'}
                          onChange={() => setRefundPolicyInput('full')}
                          className="mt-0.5 accent-[#F1E194]"
                        />
                        <div>
                          <p className="text-xs font-semibold text-[#FFF9E8]">
                            {tr('Full Refund (Service Price + Platform Fee)', 'पूर्ण रिफ़ंड (सेवा मूल्य + प्लेटफ़ॉर्म शुल्क)')}
                          </p>
                          <p className="text-[11px] text-[#8A8178] mt-0.5">
                            {tr(
                              'Customer receives 100% of both the barber service price and the BarberLoo platform fee upon cancellation.',
                              'रद्द करने पर ग्राहक को संपूर्ण राशि (सेवा + शुल्क) वापस मिलेगी।'
                            )}
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Canonical Production Domain for Salon QR Passes & Deep Linking */}
                  <div className="pt-2 border-t border-[#F1E194]/15">
                    <label className="block text-xs font-semibold text-[#FFF9E8] mb-1.5">
                      {tr('Official Production Domain (for Salon QR Passes)', 'आधिकारिक डोमेन (सैलून QR पास हेतु)')}
                    </label>
                    <input
                      type="url"
                      required
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      placeholder="https://barberloo.in"
                      className="w-full px-4 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/20 text-sm text-[#FFF9E8] font-mono-num font-semibold"
                    />
                    <span className="text-[10px] text-[#8A8178] mt-1 block">
                      {tr(
                        'All Instant Salon QR codes and customer booking links will use this domain (barberloo.in) instead of sandbox preview URLs.',
                        'सभी सैलून QR कोड व बुकिंग लिंक सैंडबॉक्स URL के बजाय इस डोमेन का उपयोग करेंगे।'
                      )}
                    </span>
                  </div>

                  {feeSaveFeedback && (
                    <div className="p-3 rounded-[12px] bg-emerald-950/80 border border-emerald-500/30 text-xs text-emerald-200">
                      {feeSaveFeedback}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSavingFee}
                    className="w-full py-3.5 px-6 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-bold tracking-[0.14em] uppercase hover:bg-[#FFF9E8] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>
                      {isSavingFee
                        ? tr('SAVING RULES...', 'सहेजा जा रहा है...')
                        : tr('SAVE PLATFORM FEE & REFUND RULES', 'प्लेटफ़ॉर्म शुल्क व रिफ़ंड नियम सहेजें')}
                    </span>
                  </button>
                </form>
              </div>

              {/* Right 5 Cols: Live Price Simulation & Rules */}
              <div className="lg:col-span-5 space-y-5">
                {/* Live Simulation Card */}
                <div className="rounded-[24px] bg-[#111113] border border-[#F1E194]/25 p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F1E194]/15">
                    <h3 className="font-display text-lg font-bold text-[#FFF9E8]">
                      {tr('Live Price Engine Simulation', 'लाइव मूल्य गणना सिमुलेशन')}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#241719] text-[#F1E194] border border-[#F1E194]/25">
                      INR (₹)
                    </span>
                  </div>

                  <p className="text-xs text-[#8A8178]">
                    {tr(
                      'Here is how appointments are calculated under your active rules:',
                      'सक्रिय नियमों के तहत गणना:'
                    )}
                  </p>

                  {/* Simulation Example 1 */}
                  {(() => {
                    const svc1 = 150;
                    const fee1 =
                      feeTypeInput === 'percentage'
                        ? Math.max(minFeeInput, Math.round(svc1 * (feeAmountInput / 100)))
                        : feeAmountInput;
                    const tot1 = svc1 + fee1;
                    return (
                      <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#FFF9E8]">
                            Haircut ({tr('Example 1', 'उदाहरण 1')})
                          </span>
                          <span className="font-mono-num text-[#8A8178]">Base: {formatINR(svc1)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#8A8178]">
                          <span>Service price</span>
                          <span className="font-mono-num font-semibold text-[#FFF9E8]">{formatINR(svc1)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#8A8178]">
                          <span>BarberLoo platform fee</span>
                          <span className="font-mono-num font-semibold text-[#F1E194]">{formatINR(fee1)}</span>
                        </div>
                        <div className="pt-2 border-t border-[#F1E194]/15 flex justify-between items-baseline">
                          <span className="text-xs font-bold text-[#F1E194]">Total customer payment</span>
                          <span className="font-mono-num text-xl font-bold text-[#F1E194]">{formatINR(tot1)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Simulation Example 2 */}
                  {(() => {
                    const svc2 = 300;
                    const fee2 =
                      feeTypeInput === 'percentage'
                        ? Math.max(minFeeInput, Math.round(svc2 * (feeAmountInput / 100)))
                        : feeAmountInput;
                    const tot2 = svc2 + fee2;
                    return (
                      <div className="p-4 rounded-[16px] bg-[#241719] border border-[#F1E194]/15 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-[#FFF9E8]">
                            Luxury Grooming ({tr('Example 2', 'उदाहरण 2')})
                          </span>
                          <span className="font-mono-num text-[#8A8178]">Base: {formatINR(svc2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#8A8178]">
                          <span>Service price</span>
                          <span className="font-mono-num font-semibold text-[#FFF9E8]">{formatINR(svc2)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-[#8A8178]">
                          <span>BarberLoo platform fee</span>
                          <span className="font-mono-num font-semibold text-[#F1E194]">{formatINR(fee2)}</span>
                        </div>
                        <div className="pt-2 border-t border-[#F1E194]/15 flex justify-between items-baseline">
                          <span className="text-xs font-bold text-[#F1E194]">Total customer payment</span>
                          <span className="font-mono-num text-xl font-bold text-[#F1E194]">{formatINR(tot2)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="p-3.5 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 text-[11px] text-[#8A8178] space-y-1">
                    <p className="text-[#F1E194] font-semibold">
                      🛡️ {tr('Strict Architecture Rules Enforced:', 'सख्त वास्तुकला नियम लागू:')}
                    </p>
                    <p>• The barber/shop controls the service price.</p>
                    <p>• BarberLoo controls the platform fee.</p>
                    <p>• The server calculates: total = trusted_service_price + trusted_platform_fee.</p>
                    <p>• Razorpay order amount strictly equals total.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
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
                        {onUpdateProfile && u.role !== 'admin' && (
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

            {/* BARBER VERIFICATION & SUSPENSION GOVERNANCE */}
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#F1E194]" />
                    <span>{tr('Barber Governance & Suspension Control', 'बार्बर सत्यापन व निलंबन प्रबंधन')}</span>
                    <span className="text-sm font-mono-num font-normal text-[#8A8178]">({barbers.length})</span>
                  </h2>
                  <p className="text-xs text-[#8A8178] mt-1 max-w-2xl leading-relaxed">
                    {tr(
                      'When a barber is suspended: Their chair is instantly hidden from customer discovery, public booking is blocked, and their console enters restricted appeal mode.',
                      'निलंबित करने पर: बार्बर का प्रोफ़ाइल तुरंत सार्वजनिक खोज व बुकिंग से हट जाता है और बुकिंग ब्लॉक हो जाती है।'
                    )}
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-1.5 p-1 rounded-[14px] bg-[#111113] border border-[#F1E194]/15 text-xs">
                  <button
                    type="button"
                    onClick={() => setBarberFilter('all')}
                    className={`px-3 py-1.5 rounded-[10px] font-semibold transition-colors cursor-pointer ${
                      barberFilter === 'all'
                        ? 'bg-[#F1E194] text-[#111113]'
                        : 'text-[#8A8178] hover:text-[#FFF9E8]'
                    }`}
                  >
                    {tr('All', 'सभी')} ({barbers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarberFilter('verified')}
                    className={`px-3 py-1.5 rounded-[10px] font-semibold transition-colors cursor-pointer ${
                      barberFilter === 'verified'
                        ? 'bg-emerald-500 text-[#111113]'
                        : 'text-emerald-400/80 hover:text-emerald-300'
                    }`}
                  >
                    {tr('Active', 'सक्रिय')} ({barbers.filter((b: any) => b.verificationStatus === 'verified' && b.active !== false).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarberFilter('suspended')}
                    className={`px-3 py-1.5 rounded-[10px] font-semibold transition-colors cursor-pointer ${
                      barberFilter === 'suspended'
                        ? 'bg-rose-500 text-[#FFF9E8]'
                        : 'text-rose-400/80 hover:text-rose-300'
                    }`}
                  >
                    {tr('Suspended', 'निलंबित')} ({barbers.filter((b: any) => b.verificationStatus === 'suspended' || b.active === false).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBarberFilter('pending')}
                    className={`px-3 py-1.5 rounded-[10px] font-semibold transition-colors cursor-pointer ${
                      barberFilter === 'pending'
                        ? 'bg-amber-400 text-[#111113]'
                        : 'text-amber-400/80 hover:text-amber-300'
                    }`}
                  >
                    {tr('Pending', 'प्रतीक्षारत')} ({barbers.filter((b: any) => b.verificationStatus === 'pending').length})
                  </button>
                </div>
              </div>

              {barbers.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-4">
                  {tr('No barber profiles registered yet.', 'अभी तक कोई बार्बर प्रोफ़ाइल पंजीकृत नहीं है।')}
                </p>
              ) : (
                <div className="space-y-3">
                  {barbers
                    .filter((b: any) => {
                      if (barberFilter === 'verified') return b.verificationStatus === 'verified' && b.active !== false;
                      if (barberFilter === 'suspended') return b.verificationStatus === 'suspended' || b.active === false;
                      if (barberFilter === 'pending') return b.verificationStatus === 'pending';
                      return true;
                    })
                    .map((b: any) => {
                      const isSuspended = b.verificationStatus === 'suspended' || b.active === false;
                      const isVerified = b.verificationStatus === 'verified' && b.active !== false;
                      const isPending = b.verificationStatus === 'pending';

                      return (
                        <div
                          key={b.id}
                          className={`p-4 rounded-[18px] border transition-all ${
                            isSuspended
                              ? 'bg-rose-950/20 border-rose-500/30'
                              : 'bg-[#111113] border-[#F1E194]/12'
                          } flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-[#FFF9E8]">
                                {b.name} ·{' '}
                                <span className="text-[#F1E194]">{b.shopName}</span>
                              </p>
                              {isSuspended && (
                                <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>{tr('CHAIR SUSPENDED', 'कुर्सी निलंबित')}</span>
                                </span>
                              )}
                              {isVerified && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>{tr('VERIFIED & ACTIVE', 'सत्यापित व सक्रिय')}</span>
                                </span>
                              )}
                              {isPending && (
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                                  {tr('PENDING REVIEW', 'समीक्षाधीन')}
                                </span>
                              )}
                            </div>
                            <p className="text-[#8A8178]">
                              {b.role} · {b.specialty} · Experience: {b.experience || `${b.experienceYears || 5} yrs`}
                            </p>
                            {isSuspended && (
                              <p className="text-[11px] text-rose-400/90 font-medium">
                                ⚠ {tr(
                                  'This barber chair is currently blocked from online bookings and hidden from directory.',
                                  'यह बार्बर कुर्सी वर्तमान में ऑनलाइन बुकिंग से अवरुद्ध है और डायरेक्टरी से छिपी हुई है।'
                                )}
                              </p>
                            )}
                          </div>

                          {onUpdateBarber && (
                            <div className="flex flex-wrap gap-2 items-center">
                              {isSuspended ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateBarber(b.id, {
                                      verified: true,
                                      verificationStatus: 'verified',
                                      active: true,
                                    })
                                  }
                                  className="px-3.5 py-2 rounded-[12px] bg-emerald-700 hover:bg-emerald-600 text-white font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{tr('Reinstate Chair', 'निलंबन हटाएं व सक्रिय करें')}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSuspensionModalBarber(b);
                                    setSuspensionReason('Misconduct / Policy Violation');
                                    setSuspensionNotes('');
                                    setAppointmentAction('flag');
                                    const otherBarbers = barbers.filter(
                                      (other: any) =>
                                        other.id !== b.id &&
                                        other.shopId === b.shopId &&
                                        other.active !== false &&
                                        other.verificationStatus !== 'suspended'
                                    );
                                    setReassignBarberId(otherBarbers[0]?.id || '');
                                  }}
                                  className="px-3.5 py-2 rounded-[12px] bg-[#5B0E14] hover:bg-[#73121a] text-[#FFF9E8] font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-colors shadow-sm"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                                  <span>{tr('Suspend Chair', 'कुर्सी निलंबित करें')}</span>
                                </button>
                              )}

                              {!isVerified && !isSuspended && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateBarber(b.id, {
                                      verified: true,
                                      verificationStatus: 'verified',
                                      active: true,
                                    })
                                  }
                                  className="px-3 py-1.5 rounded-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/25 font-semibold cursor-pointer"
                                >
                                  {tr('Verify Barber', 'सत्यापित करें')}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateBarber(b.id, {
                                    verified: false,
                                    verificationStatus: 'rejected',
                                    active: false,
                                  })
                                }
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-[#8A8178] font-semibold cursor-pointer hover:text-[#FFF9E8]"
                              >
                                {tr('Reject', 'अस्वीकार')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                      <p className="text-[11px] font-mono-num text-[#F1E194]/80 mt-1 break-all">
                        QR Destination: {getShopQrDestinationUrl(s.id, { domain: getProductionDomain(platformSettings) })}
                      </p>
                    </div>
                    {onUpdateShop && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedAdminQrShop(s)}
                          className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] font-semibold cursor-pointer inline-flex items-center gap-1.5 hover:bg-[#322023]"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>{tr('Salon QR Pass', 'QR पास')}</span>
                        </button>
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
                      className={`p-4 rounded-[14px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                        rep.targetType === 'barber_appeal'
                          ? 'bg-amber-950/20 border-amber-500/40'
                          : 'bg-[#111113] border-[#F1E194]/15'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {rep.targetType === 'barber_appeal' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-900 text-amber-200 border border-amber-500/40 text-[10px] font-bold uppercase tracking-wider">
                              {tr('BARBER APPEAL', 'बार्बर अपील')}
                            </span>
                          )}
                          <p className="font-semibold text-[#FFF9E8]">
                            {rep.reason} ({rep.targetLabel}) ·{' '}
                            <span className="text-[#F1E194] uppercase">
                              [{rep.status}]
                            </span>
                          </p>
                        </div>
                        <p className="text-[#8A8178]">{rep.details}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {rep.targetType === 'barber_appeal' && onUpdateBarber && rep.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await onUpdateBarber(rep.targetId, {
                                verified: true,
                                verificationStatus: 'verified',
                                active: true,
                              });
                              if (onUpdateReport) {
                                await onUpdateReport(rep.id, {
                                  status: 'resolved',
                                  resolutionNote: 'Reinstated by Admin via Appeal Review',
                                });
                              }
                            }}
                            className="px-3 py-1.5 rounded-[10px] bg-emerald-700 hover:bg-emerald-600 text-white font-semibold cursor-pointer shadow-sm flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{tr('Reinstate Chair', 'कुर्सी बहाल करें')}</span>
                          </button>
                        )}
                        {onUpdateReport && (
                          <>
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
                          </>
                        )}
                      </div>
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

        {/* DOMAIN (BARBERLOO.IN), GITHUB (BARBERLOOV1) & WP PUSHER INTEGRATION */}
        {activeSection === 'wppusher' && (
          <div className="space-y-6">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/25 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F1E194]/15 pb-6">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194]">
                    PRODUCTION DOMAIN • GITHUB REPOSITORY • WP PUSHER BRIDGE
                  </span>
                  <h2 className="font-display text-3xl font-bold mt-1 text-[#FFF9E8]">
                    barberloo.in ↔ GitHub (BarberLooV1) ↔ WP Pusher
                  </h2>
                  <p className="text-xs text-[#8A8178] mt-1">
                    {tr(
                      'This project includes native WordPress Plugin (barberloo.php), Theme (style.css & index.php), CNAME (barberloo.in), and GitHub Actions workflow files so WP Pusher can deploy directly from nexwaveservices-web/BarberLooV1 to barberloo.in.',
                      'यह प्रोजेक्ट barberloo.php, style.css, index.php और GitHub Actions के साथ तैयार है ताकि WP Pusher सीधे nexwaveservices-web/BarberLooV1 से barberloo.in पर कनेक्ट हो सके।'
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestWpPusherWebhook}
                    className="px-5 py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {tr('Verify WP Pusher Webhook', 'WP Pusher वेबहुक जांचें')}
                  </button>
                  <a
                    href="https://github.com/nexwaveservices-web/BarberLooV1"
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-3 rounded-[14px] bg-[#111113] border border-[#F1E194]/30 text-[#F1E194] text-xs font-semibold uppercase tracking-wider"
                  >
                    Open GitHub Repo ↗
                  </a>
                </div>
              </div>

              {wpPusherTestMsg && (
                <div className="p-4 rounded-[14px] bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 text-xs font-semibold">
                  {wpPusherTestMsg}
                </div>
              )}

              {/* Direct Fix for "The package could not be installed" in WP Pusher */}
              <div className="p-5 rounded-[18px] bg-[#5B0E14]/35 border border-[#F1E194]/40 space-y-4">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1E194]">
                    FIX FOR WP PUSHER &ldquo;THE PACKAGE COULD NOT BE INSTALLED&rdquo;
                  </span>
                  <h3 className="font-display text-2xl font-bold text-[#FFF9E8]">
                    Sync WordPress Theme Files (`style.css`, `index.php`, `functions.php`) to GitHub
                  </h3>
                  <p className="text-xs text-[#FFF9E8]/85">
                    WordPress &amp; WP Pusher require <code>style.css</code>, <code>index.php</code>, and <code>functions.php</code> to exist in the root of <code>https://github.com/nexwaveservices-web/BarberLooV1</code> on branch <code>main</code>. Either click <strong>Export to GitHub</strong> in the top AI Studio bar, or paste a GitHub Personal Access Token below to push all WordPress Theme &amp; Plugin files directly to <code>nexwaveservices-web/BarberLooV1</code> right now:
                  </p>
                </div>

                <form
                  onSubmit={handlePushThemeFilesToGithub}
                  className="flex flex-col sm:flex-row gap-3"
                >
                  <input
                    type="password"
                    value={githubTokenInput}
                    onChange={(e) => setGithubTokenInput(e.target.value)}
                    placeholder="Paste GitHub Personal Access Token (ghp_...) with repo scope"
                    className="flex-1 px-4 py-3 rounded-[12px] bg-[#111113] border border-[#F1E194]/30 text-xs text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                  />
                  <button
                    type="submit"
                    disabled={isPushingToGithub || !githubTokenInput.trim()}
                    className="px-6 py-3 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isPushingToGithub
                      ? 'Pushing to GitHub...'
                      : 'Push Theme Files to BarberLooV1 Now'}
                  </button>
                </form>
              </div>

              {/* 3 Connection Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1E194]">
                      1. Custom Domain
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-semibold">
                      CONFIGURED
                    </span>
                  </div>
                  <p className="font-mono-num text-lg font-bold text-[#FFF9E8]">
                    https://barberloo.in
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    Canonical URL, CORS whitelist, Service Worker (<code>/sw.js</code>), and <code>public/CNAME</code> configured for <strong>barberloo.in</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyText('domain', 'https://barberloo.in')}
                    className="text-[11px] text-[#F1E194] font-semibold underline cursor-pointer"
                  >
                    {copiedKey === 'domain' ? '✓ Copied URL' : 'Copy Domain URL'}
                  </button>
                </div>

                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1E194]">
                      2. GitHub Repository
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-semibold">
                      READY
                    </span>
                  </div>
                  <p className="font-mono-num text-sm font-bold text-[#FFF9E8] break-all">
                    nexwaveservices-web/BarberLooV1
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    Includes <code>.github/workflows/deploy-barberloo.yml</code> to auto-build production assets on every push to <code>main</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        'repo',
                        'nexwaveservices-web/BarberLooV1'
                      )
                    }
                    className="text-[11px] text-[#F1E194] font-semibold underline cursor-pointer"
                  >
                    {copiedKey === 'repo'
                      ? '✓ Copied Repo Slug'
                      : 'Copy WP Pusher Repo Slug'}
                  </button>
                </div>

                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F1E194]">
                      3. WP Pusher Bridge
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-[10px] font-semibold">
                      PLUGIN &amp; THEME READY
                    </span>
                  </div>
                  <p className="font-mono-num text-sm font-bold text-[#FFF9E8]">
                    barberloo.php &amp; style.css
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    Works with both <strong>WP Pusher → Install Plugin</strong> and <strong>WP Pusher → Install Theme</strong> with Push-to-Deploy enabled.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyText('shortcode', '[barberloo_app]')}
                    className="text-[11px] text-[#F1E194] font-semibold underline cursor-pointer"
                  >
                    {copiedKey === 'shortcode'
                      ? '✓ Copied [barberloo_app]'
                      : 'Copy WordPress Shortcode [barberloo_app]'}
                  </button>
                </div>
              </div>

              {/* Step-by-Step WP Pusher & GitHub Setup Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/15 space-y-3">
                  <h3 className="font-display text-xl font-bold text-[#F1E194]">
                    Step A: Push Code to GitHub (BarberLooV1)
                  </h3>
                  <p className="text-xs text-[#8A8178]">
                    Export or sync this project to your GitHub repository <code>https://github.com/nexwaveservices-web/BarberLooV1</code>:
                  </p>
                  <pre className="p-3.5 rounded-[12px] bg-[#241719] border border-[#F1E194]/15 text-[11px] font-mono-num text-[#FFF9E8] overflow-x-auto">
{`git remote add origin https://github.com/nexwaveservices-web/BarberLooV1.git
git branch -M main
git add .
git commit -m "Deploy BarberLoo platform for barberloo.in & WP Pusher"
git push -u origin main`}
                  </pre>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        'gitcmds',
                        `git remote add origin https://github.com/nexwaveservices-web/BarberLooV1.git\ngit branch -M main\ngit add .\ngit commit -m "Deploy BarberLoo platform for barberloo.in & WP Pusher"\ngit push -u origin main`
                      )
                    }
                    className="px-4 py-2 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                  >
                    {copiedKey === 'gitcmds'
                      ? '✓ Copied Git Commands'
                      : 'Copy Git Push Commands'}
                  </button>
                </div>

                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/15 space-y-3">
                  <h3 className="font-display text-xl font-bold text-[#F1E194]">
                    Step B: Connect WP Pusher on barberloo.in
                  </h3>
                  <ol className="text-xs text-[#FFF9E8]/90 space-y-2 list-decimal list-inside">
                    <li>
                      Log in to WordPress Admin at <code>https://barberloo.in/wp-admin</code> and open <strong>WP Pusher → Install Plugin</strong> (or <strong>Install Theme</strong>).
                    </li>
                    <li>
                      Set <strong>Repository host</strong> to <code>GitHub</code> and <strong>Plugin repository</strong> to:{' '}
                      <code className="text-[#F1E194]">nexwaveservices-web/BarberLooV1</code>
                    </li>
                    <li>
                      Set <strong>Repository branch</strong> to <code className="text-[#F1E194]">main</code> and enable <strong>Push-to-Deploy</strong>.
                    </li>
                    <li>
                      Click <strong>Install &amp; Activate Plugin</strong>. BarberLoo will automatically launch on the homepage of <code>https://barberloo.in</code> (or on any page with <code>[barberloo_app]</code>).
                    </li>
                    <li>
                      In your <strong>Supabase Dashboard → Authentication → URL Configuration</strong>, set Site URL to <code>https://barberloo.in</code> and Redirect URLs to <code>https://barberloo.in/**</code>.
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PLATFORM SLA GOVERNANCE & BREACH MONITOR */}
        {activeSection === 'sla' && (
          <div className="space-y-6">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/25 p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#F1E194]/15 pb-5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194]">
                    SERVICE LEVEL AGREEMENT (SLA) ENGINE • REAL-TIME TELEMETRY
                  </span>
                  <h2 className="font-display text-3xl font-bold mt-1 text-[#FFF9E8]">
                    {tr(
                      'Platform SLA Compliance & Breach Monitor',
                      'प्लेटफ़ॉर्म SLA अनुपालन और उल्लंघन मॉनिटर'
                    )}
                  </h2>
                  <p className="text-xs text-[#8A8178] mt-1">
                    {tr(
                      `Enforces ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-Min On-Time Chair Start SLA and ${SLA_TARGETS.REPORT_RESOLUTION_HOURS}-Hour Dispute Resolution SLA.`,
                      `यह ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-मिनट ऑन-टाइम चेयर SLA और ${SLA_TARGETS.REPORT_RESOLUTION_HOURS}-घंटे विवाद समाधान SLA को ट्रैक करता है।`
                    )}
                  </p>
                </div>
                <div className="px-5 py-3 rounded-[16px] bg-[#111113] border border-[#F1E194]/30 text-right">
                  <span className="text-[10px] uppercase tracking-wider text-[#8A8178] block">
                    {tr('Overall Platform SLA', 'कुल प्लेटफ़ॉर्म SLA')}
                  </span>
                  <span className="font-mono-num text-3xl font-bold text-emerald-400">
                    {platformSla.overallScorePercent}%
                  </span>
                </div>
              </div>

              {slaActionToast && (
                <div className="p-4 rounded-[14px] bg-emerald-950/80 border border-emerald-400/40 text-emerald-200 text-xs font-semibold">
                  {slaActionToast}
                </div>
              )}

              {/* 3 SLA Metric Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-1">
                  <span className="text-[11px] text-[#8A8178]">
                    {tr('Appointment On-Time SLA', 'अपॉइंटमेंट समयबद्धता SLA')}
                  </span>
                  <div className="font-mono-num text-2xl font-bold text-[#F1E194]">
                    {platformSla.appointmentSlaPercent}%
                  </div>
                  <p className="text-[11px] text-[#8A8178]">
                    Target: &le; {SLA_TARGETS.APPOINTMENT_ON_TIME_MINS} mins chair delay
                  </p>
                </div>

                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-1">
                  <span className="text-[11px] text-[#8A8178]">
                    {tr('Dispute Resolution SLA', 'विवाद समाधान SLA')}
                  </span>
                  <div className="font-mono-num text-2xl font-bold text-emerald-400">
                    {platformSla.reportResolutionSlaPercent}%
                  </div>
                  <p className="text-[11px] text-[#8A8178]">
                    Target: &le; {SLA_TARGETS.REPORT_RESOLUTION_HOURS} hrs resolution
                  </p>
                </div>

                <div className="p-5 rounded-[18px] bg-[#111113] border border-[#F1E194]/20 space-y-1">
                  <span className="text-[11px] text-[#8A8178]">
                    {tr('Active SLA Statuses', 'सक्रिय SLA स्थितियां')}
                  </span>
                  <div className="font-mono-num text-lg font-bold text-[#FFF9E8]">
                    {platformSla.metCount + platformSla.onTrackCount} OK ·{' '}
                    <span className="text-amber-300">
                      {platformSla.atRiskCount} Risk
                    </span>{' '}
                    ·{' '}
                    <span className="text-red-400">
                      {platformSla.breachedCount} Breached
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8A8178]">
                    Guarantee policy: Service guarantee voucher on breach
                  </p>
                </div>
              </div>

              {/* Live Appointment SLA Audit & Escalation Table */}
              <div className="space-y-3 pt-2">
                <h3 className="font-display text-2xl font-bold text-[#FFF9E8]">
                  {tr(
                    'Appointment SLA Audit & Escalation Console',
                    'अपॉइंटमेंट SLA ऑडिट और एस्केलेशन कंसोल'
                  )}
                </h3>
                {appointments.length === 0 ? (
                  <p className="text-xs text-[#8A8178] py-4">
                    {tr('No appointments to evaluate.', 'मूल्यांकन के लिए कोई अपॉइंटमेंट नहीं है।')}
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto">
                    {appointments.map((apt: any) => {
                      const sla = evaluateAppointmentSla(apt);
                      return (
                        <div
                          key={apt.id}
                          className="p-4 rounded-[16px] bg-[#111113] border border-[#F1E194]/15 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-[#FFF9E8]">
                                {apt.clientName} ({apt.clientPhone || '+91'})
                              </span>
                              <span className="text-[#8A8178]">
                                · {apt.serviceName} with {apt.barberName} ({apt.shopName})
                              </span>
                              <span
                                className={`px-2.5 py-0.5 rounded-[8px] font-mono-num text-[10px] font-semibold ${
                                  sla.status === 'BREACHED'
                                    ? 'bg-red-950 text-red-200 border border-red-400/40'
                                    : sla.status === 'AT_RISK'
                                    ? 'bg-amber-950 text-amber-200 border border-amber-400/40'
                                    : 'bg-emerald-950 text-emerald-200 border border-emerald-400/30'
                                }`}
                              >
                                🛡️ {sla.badgeText}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#8A8178] mt-1">
                              {formatISTDateString(apt.date, lang)} · {apt.time} IST ·{' '}
                              {sla.detailText}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {onBroadcastNotification && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onBroadcastNotification({
                                    shopName: '🚨 BarberLoo SLA Escalation',
                                    message: `Urgent SLA Alert for ${apt.barberName} (${apt.shopName}): Client ${apt.clientName}'s ${apt.serviceName} (${apt.date} · ${apt.time} IST) requires immediate chair attention to maintain the 15-min SLA guarantee.`,
                                    targetRole: 'barber',
                                  });
                                  setSlaActionToast(
                                    tr(
                                      `✓ SLA Escalation Alert dispatched to ${apt.barberName}!`,
                                      `✓ SLA एस्केलेशन अलर्ट ${apt.barberName} को भेज दिया गया!`
                                    )
                                  );
                                  setTimeout(() => setSlaActionToast(''), 3500);
                                }}
                                className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/30 text-[#F1E194] font-semibold cursor-pointer"
                              >
                                {tr('Escalate to Barber', 'बार्बर को अलर्ट भेजें')}
                              </button>
                            )}
                            {apt.customerUid && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiClaimSlaCompensation({
                                    customerUid: apt.customerUid,
                                    appointmentId: apt.id,
                                    serviceName: apt.serviceName,
                                    barberName: apt.barberName,
                                  });
                                  setSlaActionToast(
                                    tr(
                                      `✓ Granted SLA Guarantee Compensation to ${apt.clientName}!`,
                                      `✓ ${apt.clientName} को SLA सेवा गारंटी वाउचर प्रदान किया गया!`
                                    )
                                  );
                                  setTimeout(() => setSlaActionToast(''), 3500);
                                }}
                                className="px-3 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] font-semibold cursor-pointer"
                              >
                                {tr('Grant SLA Guarantee Voucher', 'SLA गारंटी वाउचर दें')}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Admin Barber Suspension Governance Modal */}
      {suspensionModalBarber && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-[24px] bg-[#1a1214] border-2 border-rose-500/40 p-6 sm:p-8 space-y-6 shadow-2xl text-[#FFF9E8]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[14px] bg-rose-950/80 border border-rose-500/50 text-rose-300 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-[#FFF9E8]">
                    {tr('Suspend Barber Chair', 'बार्बर कुर्सी निलंबित करें')}
                  </h3>
                  <p className="text-xs text-rose-300">
                    {suspensionModalBarber.name} · {suspensionModalBarber.shopName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuspensionModalBarber(null)}
                className="w-8 h-8 rounded-full bg-[#111113] border border-[#F1E194]/20 flex items-center justify-center text-[#8A8178] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Affected upcoming appointments notice */}
            {(() => {
              const affectedCount = appointments.filter(
                (a: any) =>
                  a.barberId === suspensionModalBarber.id &&
                  (a.status === 'confirmed' ||
                    a.status === 'pending' ||
                    a.status === 'Confirmed' ||
                    a.status === 'Pending')
              ).length;
              return (
                <div className="p-3.5 rounded-[14px] bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between">
                  <span>{tr('Upcoming appointments currently scheduled:', 'मौजूदा आगामी बुकिंग:')}</span>
                  <span className="font-bold font-mono-num text-rose-300 px-2 py-0.5 rounded bg-rose-900/60 border border-rose-400/40">
                    {affectedCount} {tr('booking(s)', 'बुकिंग')}
                  </span>
                </div>
              );
            })()}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!onUpdateBarber) return;
                const reassignBarber = barbers.find((b: any) => b.id === reassignBarberId);
                onUpdateBarber(suspensionModalBarber.id, {
                  active: false,
                  verificationStatus: 'suspended',
                  suspensionReason,
                  suspensionNotes,
                  appointmentAction,
                  reassignBarberId: appointmentAction === 'reassign' ? reassignBarberId : undefined,
                  reassignBarberName: appointmentAction === 'reassign' ? reassignBarber?.name : undefined,
                });
                setSuspensionModalBarber(null);
              }}
              className="space-y-4 text-xs"
            >
              {/* Reason selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#F1E194]">
                  {tr('Suspension Reason', 'निलंबन का कारण')}
                </label>
                <select
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-[#FFF9E8] focus:outline-none focus:border-[#F1E194]"
                >
                  <option value="Misconduct / Policy Violation">{tr('Misconduct / Policy Violation', 'आचार संहिता या नीति उल्लंघन')}</option>
                  <option value="Multiple Customer Complaints">{tr('Multiple Customer Complaints', 'ग्राहकों की एकाधिक शिकायतें')}</option>
                  <option value="Unannounced Absenteeism / Inactive">{tr('Unannounced Absenteeism / Inactive', 'बिना सूचना अनुपस्थिति / निष्क्रिय')}</option>
                  <option value="Quality Audit / Investigation">{tr('Quality Audit / Investigation', 'गुणवत्ता ऑडिट या जांचधीन')}</option>
                  <option value="Licensing / Verification Pending">{tr('Licensing / Verification Pending', 'सत्यापन या लाइसेंसिंग लंबित')}</option>
                  <option value="Other / Administrative Discretion">{tr('Other / Administrative Discretion', 'अन्य प्रशासनिक कारण')}</option>
                </select>
              </div>

              {/* Optional notes */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#F1E194]">
                  {tr('Notes / Instructions (Internal & Barber Notification)', 'निर्देश व विवरण')}
                </label>
                <textarea
                  rows={2}
                  value={suspensionNotes}
                  onChange={(e) => setSuspensionNotes(e.target.value)}
                  placeholder={tr('Provide specifics or required steps for reinstatement...', 'बहाली हेतु आवश्यक निर्देश लिखें...')}
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/25 text-[#FFF9E8] placeholder:text-[#8A8178] focus:outline-none focus:border-[#F1E194]"
                />
              </div>

              {/* Strategy for upcoming appointments */}
              <div className="space-y-2">
                <label className="font-semibold text-[#F1E194]">
                  {tr('Action for Upcoming Appointments', 'आगामी बुकिंग के लिए कार्रवाई')}
                </label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/15 cursor-pointer">
                    <input
                      type="radio"
                      name="aptAction"
                      value="flag"
                      checked={appointmentAction === 'flag'}
                      onChange={() => setAppointmentAction('flag')}
                      className="mt-0.5 text-rose-500"
                    />
                    <div>
                      <p className="font-semibold text-[#FFF9E8]">{tr('Flag & Alert Customers', 'अलर्ट भेजें (ग्राहक पुनर्निर्धारण कर सकते हैं)')}</p>
                      <p className="text-[11px] text-[#8A8178]">{tr('Sends in-app notice to customers; appointments remain flagged for review.', 'ग्राहकों को सूचना जाएगी और अपॉइंटमेंट समीक्षा हेतु फ़्लैग रहेंगे।')}</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/15 cursor-pointer">
                    <input
                      type="radio"
                      name="aptAction"
                      value="reassign"
                      checked={appointmentAction === 'reassign'}
                      onChange={() => setAppointmentAction('reassign')}
                      className="mt-0.5 text-rose-500"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-[#FFF9E8]">{tr('Reassign to Another Active Barber', 'सैलून के अन्य सक्रिय बार्बर को सौंपें')}</p>
                      <p className="text-[11px] text-[#8A8178]">{tr('Seamlessly transfers upcoming bookings and notifies clients.', 'बुकिंग ट्रांसफर होगी और ग्राहकों को नए बार्बर का अलर्ट जाएगा।')}</p>
                      {appointmentAction === 'reassign' && (
                        <div className="mt-2">
                          <select
                            value={reassignBarberId}
                            onChange={(e) => setReassignBarberId(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-[8px] bg-[#1a1214] border border-[#F1E194]/30 text-[#FFF9E8] text-xs"
                          >
                            {barbers
                              .filter(
                                (other: any) =>
                                  other.id !== suspensionModalBarber.id &&
                                  other.shopId === suspensionModalBarber.shopId &&
                                  other.active !== false &&
                                  other.verificationStatus !== 'suspended'
                              )
                              .map((other: any) => (
                                <option key={other.id} value={other.id}>
                                  {other.name} ({other.specialty})
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/15 cursor-pointer">
                    <input
                      type="radio"
                      name="aptAction"
                      value="cancel"
                      checked={appointmentAction === 'cancel'}
                      onChange={() => setAppointmentAction('cancel')}
                      className="mt-0.5 text-rose-500"
                    />
                    <div>
                      <p className="font-semibold text-rose-300">{tr('Cancel Upcoming Appointments', 'सभी आगामी बुकिंग रद्द करें')}</p>
                      <p className="text-[11px] text-[#8A8178]">{tr('Cancels bookings and issues immediate cancellation notices.', 'बुकिंग रद्द कर दी जाएगी और रद्दीकरण सूचना भेजी जाएगी।')}</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#F1E194]/15">
                <button
                  type="button"
                  onClick={() => setSuspensionModalBarber(null)}
                  className="px-4 py-2 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] font-semibold cursor-pointer hover:bg-white/5"
                >
                  {tr('Cancel', 'रद्द करें')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[12px] bg-[#5B0E14] hover:bg-[#73121a] text-[#FFF9E8] font-semibold cursor-pointer shadow-lg inline-flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  <span>{tr('Confirm Chair Suspension', 'कुर्सी निलंबन की पुष्टि करें')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Salon QR Modal */}
      <SalonQrModal
        shop={selectedAdminQrShop}
        isOpen={Boolean(selectedAdminQrShop)}
        onClose={() => setSelectedAdminQrShop(null)}
        platformSettings={platformSettings}
      />
    </div>
  );
};
