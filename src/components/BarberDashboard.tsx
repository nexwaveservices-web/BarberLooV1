import React, { useState, useMemo } from 'react';
import {
  AppointmentItem,
  OPENING_HOURS,
  QueueItem,
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
} from 'lucide-react';
import {
  useLanguage,
  getCurrentISTDisplay,
  formatISTDateString,
} from '../lib/i18n';
import { uploadImageToSupabaseStorage } from '../lib/supabase';

interface BarberDashboardProps {
  appointments: AppointmentItem[];
  onUpdateAppointment?: (id: string, updates: any) => Promise<void>;
  queue: QueueItem[];
  onAdvanceQueue: () => void;
  onAddWalkInToQueue?: (clientName: string, serviceName: string) => Promise<void>;
  onChangeQueueItemStatus?: (queueId: string, newStatus: string) => Promise<void>;
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
}

export const BarberDashboard: React.FC<BarberDashboardProps> = ({
  appointments,
  onUpdateAppointment,
  queue,
  onAdvanceQueue,
  onAddWalkInToQueue,
  onChangeQueueItemStatus,
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
  workingHours = OPENING_HOURS,
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
}) => {
  const { lang, tr, formatINR } = useLanguage();
  const istNow = getCurrentISTDisplay(lang);

  const [activeTab, setActiveTab] = useState<
    | 'appointments'
    | 'queue'
    | 'services'
    | 'team'
    | 'schedule'
    | 'customers'
    | 'analytics'
    | 'shop'
  >('appointments');

  // Walk-in form
  const [walkInName, setWalkInName] = useState('');
  const [walkInService, setWalkInService] = useState('');

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
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editShopDistrict, setEditShopDistrict] = useState('');
  const [editShopAddress, setEditShopAddress] = useState('');
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
  const [newShopDistrict, setNewShopDistrict] = useState('Bandra West, Mumbai');
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPhone, setNewShopPhone] = useState(
    currentUserProfile?.phone || '+91 '
  );
  const [newShopMinPrice, setNewShopMinPrice] = useState('650');
  const [newShopTagline, setNewShopTagline] = useState(
    'Luxury Grooming & Live Chair Queue'
  );
  const [newShopAbout, setNewShopAbout] = useState('');

  // Internal customer note state
  const [noteAptId, setNoteAptId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const activeShop = shops[0] || null;

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
  const totalRealRevenueINR = completedOrConfirmedApts.reduce(
    (sum, a) => sum + (Number(a.price) || 0),
    0
  );
  const completedRevenueINR = completedApts.reduce(
    (sum, a) => sum + (Number(a.price) || 0),
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
    if (appointments.length === 0) return '14:15 IST';
    const counts: Record<string, number> = {};
    for (const a of appointments) {
      const t = a.time || '14:15';
      counts[t] = (counts[t] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((x, y) => y[1] - x[1]);
    return `${sorted[0]?.[0] || '14:15'} IST`;
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

  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim() || !onAddWalkInToQueue) return;
    await onAddWalkInToQueue(
      walkInName.trim(),
      walkInService.trim() || services[0]?.name || 'Haircut & Grooming'
    );
    setWalkInName('');
    setWalkInService('');
  };

  const handleCreateServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSrvName.trim() || !onCreateService) return;
    await onCreateService({
      shopId: activeShop?.id || 'shop-1',
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
    await onCreateBarber({
      userUid: currentUserProfile?.uid || '',
      shopId: activeShop?.id || 'shop-1',
      shopName: activeShop?.name || 'BarberLoo Partner Salon',
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
    await onCreateShop({
      name: newShopName.trim(),
      district: newShopDistrict.trim(),
      city: newShopDistrict.split(',')[1]?.trim() || newShopDistrict.trim(),
      address: newShopAddress.trim(),
      phone: newShopPhone.trim(),
      minPrice: Number(newShopMinPrice) || 500,
      priceTier: `₹${newShopMinPrice} – ₹2,500`,
      tagline: newShopTagline.trim(),
      about: newShopAbout.trim(),
    });
    setNewShopName('');
    setNewShopAddress('');
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
              {activeShop
                ? activeShop.name
                : tr('Barber Partner Console', 'बार्बर पार्टनर कंसोल')}
            </h1>
            <p className="text-xs text-[#8A8178] mt-1">
              {tr('Signed in as:', 'लॉग इन:')} {currentUserProfile?.name} (
              {currentUserProfile?.email})
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
                {tr('Live Queue', 'लाइव कतार')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                {queue.length}
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
                {tr('Revenue (INR)', 'राजस्व (₹ INR)')}
              </span>
              <span className="font-mono-num text-xl font-bold text-[#F1E194]">
                {formatINR(totalRealRevenueINR)}
              </span>
            </div>
          </div>
        </div>

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

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            {
              id: 'appointments',
              label: tr('Appointments', 'अपॉइंटमेंट्स'),
              icon: Calendar,
            },
            { id: 'queue', label: tr('Live Queue', 'लाइव कतार'), icon: Clock },
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
            <h2 className="font-display text-3xl font-bold">
              {tr('Client Appointments (IST)', 'ग्राहक अपॉइंटमेंट्स (IST)')}
            </h2>
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
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono-num text-xs font-bold text-[#F1E194]">
                            {formatISTDateString(apt.date, lang)} · {apt.time} IST
                          </span>
                          <span className="px-2.5 py-0.5 rounded-[8px] bg-[#241719] text-[11px] text-[#FFF9E8]">
                            {apt.status}
                          </span>
                        </div>
                        <h3 className="font-display text-2xl font-bold mt-1">
                          {apt.clientName} ({apt.clientPhone})
                        </h3>
                        <p className="text-xs text-[#8A8178]">
                          {apt.serviceName} · {apt.barberName} ·{' '}
                          <span className="text-[#F1E194] font-mono-num font-semibold">
                            {formatINR(apt.price)}
                          </span>
                        </p>
                        {(apt.notes || apt.barberNotes) && (
                          <p className="text-[11px] text-[#F1E194]/80 mt-1">
                            {apt.notes ? `Client Note: ${apt.notes} ` : ''}
                            {apt.barberNotes
                              ? `· Barber Note: ${apt.barberNotes}`
                              : ''}
                          </p>
                        )}
                      </div>

                      {onUpdateAppointment && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAppointment(apt.id, { status: 'confirmed' })
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/20 text-xs font-semibold text-[#FFF9E8] cursor-pointer"
                          >
                            {tr('Confirm', 'पुष्टि करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAppointment(apt.id, { status: 'in_progress' })
                            }
                            className="px-3.5 py-2 rounded-[12px] bg-[#241719] border border-[#F1E194]/25 text-xs font-semibold text-[#F1E194] cursor-pointer"
                          >
                            {tr('Start Cut', 'सेवा शुरू करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateAppointment(apt.id, { status: 'completed' })
                            }
                            className="px-3.5 py-2 rounded-[12px] bg-emerald-900/80 text-emerald-200 text-xs font-semibold cursor-pointer"
                          >
                            {tr('Mark Completed', 'पूर्ण करें')}
                          </button>
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

        {/* TAB 2: LIVE QUEUE */}
        {activeTab === 'queue' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-3xl font-bold">
                  {tr('Live Chair Queue', 'लाइव चेयर कतार')} ({queue.length})
                </h2>
                {queue.length > 0 && (
                  <button
                    type="button"
                    onClick={onAdvanceQueue}
                    className="px-4 py-2.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {tr('Complete #1 & Call Next', '#1 पूर्ण करें और अगले को बुलाएं')}
                    </span>
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <p className="text-xs text-[#8A8178] py-8">
                  {tr('Live queue is currently empty.', 'लाइव कतार अभी खाली है।')}
                </p>
              ) : (
                <div className="space-y-3">
                  {queue.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-[16px] bg-[#111113] border border-[#F1E194]/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div>
                        <span className="font-mono-num text-xs text-[#F1E194] font-bold">
                          #{q.position} · {q.status} (~{q.waitMins}m)
                        </span>
                        <p className="font-semibold text-sm mt-0.5">
                          {q.clientName}
                        </p>
                        <p className="text-xs text-[#8A8178]">
                          {q.serviceName} · {q.barberName}
                        </p>
                      </div>
                      {onChangeQueueItemStatus && (
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQueueItemStatus(q.id, 'called')
                            }
                            className="px-2.5 py-1.5 rounded-[10px] bg-[#241719] border border-[#F1E194]/25 text-[#F1E194] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Call', 'बुलाएं')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQueueItemStatus(q.id, 'serving')
                            }
                            className="px-2.5 py-1.5 rounded-[10px] bg-[#241719] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Serve', 'सेवा में')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQueueItemStatus(q.id, 'completed')
                            }
                            className="px-3 py-1.5 rounded-[10px] bg-emerald-900/70 text-emerald-200 text-xs font-semibold cursor-pointer"
                          >
                            {tr('Done', 'पूर्ण')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQueueItemStatus(q.id, 'skipped')
                            }
                            className="px-2.5 py-1.5 rounded-[10px] bg-[#5B0E14] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Skip', 'स्किप')}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onChangeQueueItemStatus(q.id, 'cancelled')
                            }
                            className="px-2.5 py-1.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/15 text-[#8A8178] hover:text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                          >
                            {tr('Remove', 'हटाएं')}
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
                {tr('Add Walk-In Customer', 'वॉक-इन ग्राहक जोड़ें')}
              </h3>
              <form onSubmit={handleWalkInSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Customer Name', 'ग्राहक का नाम')}
                  </label>
                  <input
                    type="text"
                    required
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder={tr('Enter customer name', 'ग्राहक का नाम लिखें')}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Service', 'सेवा')}
                  </label>
                  <input
                    type="text"
                    value={walkInService}
                    onChange={(e) => setWalkInService(e.target.value)}
                    placeholder={tr('e.g., Haircut & Beard', 'जैसे: हेयरकट और बियर्ड')}
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                >
                  {tr('+ Add Walk-In to Queue', '+ कतार में जोड़ें')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: SERVICES CRUD (INR) */}
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
              {(workingHours.length ? workingHours : OPENING_HOURS).map(
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
                          <p className="text-[11px] font-mono-num text-[#F1E194]/80 mt-1">
                            QR Destination: {s.qrCodeUrl || `${window.location.origin}/?shop=${s.id}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
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
                            <div className="space-y-2.5">
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
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  value={editShopAddress}
                                  onChange={(e) => setEditShopAddress(e.target.value)}
                                  placeholder={tr('Address', 'पता')}
                                  className="px-3 py-2 rounded-[10px] bg-[#241719] text-[#FFF9E8]"
                                />
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
                                      district: editShopDistrict.trim(),
                                      city:
                                        editShopDistrict.split(',')[1]?.trim() ||
                                        editShopDistrict.trim(),
                                      address: editShopAddress.trim(),
                                      phone: editShopPhone.trim(),
                                      closesAt: editShopClosesAt.trim(),
                                      image: editShopImage.trim(),
                                      about: editShopAbout.trim(),
                                    });
                                    setEditingShopId(null);
                                  }}
                                  className="px-4 py-2 rounded-[10px] bg-[#F1E194] text-[#111113] font-semibold cursor-pointer"
                                >
                                  {tr('Save Salon', 'सैलून सहेजें')}
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
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Neighborhood & City', 'क्षेत्र और शहर')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopDistrict}
                    onChange={(e) => setNewShopDistrict(e.target.value)}
                    placeholder="Bandra West, Mumbai"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#8A8178] mb-1">
                    {tr('Full Street Address', 'पूरा पता')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopAddress}
                    onChange={(e) => setNewShopAddress(e.target.value)}
                    placeholder="14 Pali Hill Road, Bandra West"
                    className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
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
    </div>
  );
};
