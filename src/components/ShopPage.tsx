import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  ASSETS,
  BarberItem,
  OPENING_HOURS,
  PageView,
  ServiceItem,
  ShopItem,
} from '../data/barberlooData';
import { SmartImage } from './SmartImage';
import {
  MapPin,
  Clock,
  ShieldCheck,
  Heart,
  Store,
  QrCode,
  Flag,
  Edit3,
  Check,
  Download,
  Printer,
  Copy,
  Search,
  ArrowLeft,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { getShopQrDestinationUrl, getProductionDomain } from '../lib/domain';
import { SalonQrModal } from './SalonQrModal';

interface ShopPageProps {
  shop: ShopItem | null;
  onSelectShop: (shop: ShopItem | null) => void;
  onNavigate: (page: PageView) => void;
  onSelectServiceForBooking: (service: ServiceItem) => void;
  onSelectBarberForBooking: (barber: BarberItem) => void;
  shops?: any[];
  services?: any[];
  barbers?: any[];
  reviews?: any[];
  workingHours?: any[];
  shopGallery?: any[];
  barberGallery?: any[];
  favorites?: any[];
  onToggleFavorite?: (targetType: 'shop' | 'barber', targetId: string) => void;
  onSubmitReview?: (payload: any) => Promise<void>;
  onUpdateReview?: (id: string, updates: any) => Promise<void>;
  onSubmitReport?: (payload: any) => Promise<void>;
  hasCompletedAppointment?: boolean;
  currentUserProfile?: any | null;
  onOpenAuthModal?: () => void;
  platformSettings?: any;
}

export const ShopPage: React.FC<ShopPageProps> = ({
  shop,
  onSelectShop,
  onNavigate,
  onSelectServiceForBooking,
  onSelectBarberForBooking,
  shops = [],
  services = [],
  barbers = [],
  reviews = [],
  workingHours = OPENING_HOURS,
  shopGallery = [],
  barberGallery = [],
  favorites = [],
  onToggleFavorite,
  onSubmitReview,
  onUpdateReview,
  onSubmitReport,
  hasCompletedAppointment = false,
  currentUserProfile,
  onOpenAuthModal,
  platformSettings,
}) => {
  const { tr, formatINR, translateCategory, translateService } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    'services' | 'barbers' | 'reviews' | 'about' | 'gallery' | 'hours' | 'qr'
  >('services');
  const [searchQuery, setSearchQuery] = useState('');
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Edit own review state
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewComment, setEditReviewComment] = useState('');
  const [editReviewRating, setEditReviewRating] = useState<number>(5);

  // Report state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTargetType, setReportTargetType] = useState<
    'shop' | 'barber' | 'review'
  >('shop');
  const [reportTargetId, setReportTargetId] = useState('');
  const [reportTargetLabel, setReportTargetLabel] = useState('');
  const [reportReason, setReportReason] = useState('Service Quality Inquiry');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');

  const [qrCopied, setQrCopied] = useState(false);

  // When no specific shop is selected: Display the All Shops Listing (Section 8)
  if (!shop) {
    const filteredShops = shops.filter((s: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name?.toLowerCase().includes(q) ||
        s.district?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="bg-[#FAF6EA] min-h-[85vh] py-12 px-5 sm:px-8">
        <div className="max-w-[1360px] mx-auto space-y-8">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#111113]">
              {tr('Find a Barber Shop', 'सैलून खोजें')}
            </h1>
            <p className="text-sm text-[#8A8178]">
              {tr(
                'Browse verified local barber shops and select one to book your appointment.',
                'सत्यापित सैलून देखें और अपनी अपॉइंटमेंट बुक करने के लिए एक चुनें।'
              )}
            </p>

            {/* Search Box */}
            <div className="pt-2 max-w-md mx-auto relative">
              <Search className="w-4 h-4 text-[#8A8178] absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  'Search barber shops by name or area...',
                  'सैलून का नाम या इलाका खोजें...'
                )}
                className="w-full pl-11 pr-4 py-3 rounded-[16px] bg-white border border-[#111113]/15 text-xs text-[#111113] focus:outline-none focus:border-[#5B0E14] shadow-sm"
              />
            </div>
          </div>

          {/* Shop Listing Grid */}
          {filteredShops.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredShops.map((s: any) => {
                const isClosed = s.status === 'closed' || s.isOpen === false;
                const shopReviewCount =
                  reviews.filter(
                    (r: any) =>
                      (r.shopId === s.id || r.shop_id === s.id) &&
                      r.status !== 'hidden'
                  ).length ||
                  s.reviewCount ||
                  0;

                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-[22px] border border-[#111113]/10 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-48 bg-[#111113] overflow-hidden">
                        <SmartImage
                          src={s.image || ASSETS.royalInterior}
                          alt={s.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide ${
                              isClosed
                                ? 'bg-red-500/90 text-white'
                                : 'bg-[#5B0E14] text-[#F1E194]'
                            }`}
                          >
                            {isClosed
                              ? tr('Closed', 'बंद है')
                              : tr('Open Now', 'खुला है')}
                          </span>
                        </div>
                        {s.verified && (
                          <div className="absolute bottom-3 left-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#111113]/90 text-[#F1E194] text-[11px] font-medium backdrop-blur-xs">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {tr('Verified', 'सत्यापित')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="p-6 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="font-display text-xl font-bold text-[#111113] leading-tight">
                            {s.name}
                          </h2>
                          <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#FAF6EA] text-xs font-semibold text-[#111113]">
                            ★ {s.rating || '4.9'} ({shopReviewCount})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8A8178]">
                          <MapPin className="w-3.5 h-3.5 text-[#5B0E14] shrink-0" />
                          <span className="truncate">
                            {s.address || s.district || 'City Center'}
                          </span>
                        </div>
                        {s.tagline && (
                          <p className="text-xs text-[#8A8178] line-clamp-2">
                            {s.tagline}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-6 pt-0 flex gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectShop(s)}
                        className="flex-1 py-3 rounded-[14px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold tracking-wider uppercase cursor-pointer hover:bg-[#43090E] transition-colors"
                      >
                        {tr('View Shop', 'सैलून देखें')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectShop(s);
                          window.history.pushState(
                            {},
                            '',
                            `booking.html?shop_id=${encodeURIComponent(s.id)}`
                          );
                          onNavigate('booking');
                        }}
                        className="py-3 px-4 rounded-[14px] bg-[#FAF6EA] border border-[#111113]/15 text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer hover:bg-[#F1E194]/40 transition-colors"
                      >
                        {tr('Book', 'बुक करें')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="max-w-md mx-auto text-center py-16 rounded-[22px] bg-white border border-[#111113]/10 p-8 space-y-4">
              <Store className="w-10 h-10 text-[#8A8178] mx-auto" />
              <p className="text-sm font-semibold text-[#111113]">
                {tr('No barber shops found', 'कोई सैलून नहीं मिला')}
              </p>
              <p className="text-xs text-[#8A8178]">
                {tr(
                  'Try searching with a different name or clear the search filter.',
                  'कृपया दूसरा नाम खोजें या फ़िल्टर हटाएँ।'
                )}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-5 py-2.5 rounded-[12px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold uppercase cursor-pointer"
                >
                  {tr('Clear Search', 'फ़िल्टर हटाएं')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const activeShop = shop;

  const shopServices = services.filter(
    (s: any) =>
      s.active !== false &&
      s.is_active !== false &&
      (s.shopId === activeShop.id || s.shop_id === activeShop.id)
  );
  const shopBarbers = barbers.filter(
    (b: any) =>
      b.active !== false &&
      b.is_active !== false &&
      b.verificationStatus !== 'suspended' &&
      (b.shopId === activeShop.id || b.shop_id === activeShop.id)
  );
  const shopReviews = reviews.filter(
    (r: any) =>
      r.status !== 'hidden' &&
      (r.shopId === activeShop.id || r.shop_id === activeShop.id)
  );
  const isShopFav = favorites.some(
    (f) => f.targetType === 'shop' && f.targetId === activeShop.id
  );
  const isBarberFav = (barberId: string) =>
    favorites.some((f) => f.targetType === 'barber' && f.targetId === barberId);

  const productionDomain = getProductionDomain(platformSettings);
  const qrDestinationUrl = getShopQrDestinationUrl(activeShop.id, {
    domain: productionDomain,
  });

  useEffect(() => {
    if (activeTab === 'qr' && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        qrDestinationUrl,
        {
          width: 220,
          margin: 2,
          color: {
            dark: '#111113',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'H',
        },
        (err) => {
          if (!err && qrCanvasRef.current) {
            setQrDataUrl(qrCanvasRef.current.toDataURL('image/png'));
          }
        }
      );
    }
  }, [activeTab, qrDestinationUrl]);

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    if (!hasCompletedAppointment) {
      setReviewMessage(
        tr(
          'Only customers with a completed appointment can submit a verified review.',
          'केवल पूर्ण अपॉइंटमेंट वाले ग्राहक ही समीक्षा लिख सकते हैं।'
        )
      );
      return;
    }
    if (onSubmitReview && newReviewComment.trim()) {
      await onSubmitReview({
        shopId: activeShop.id,
        barberId: shopBarbers[0]?.id || '',
        author: currentUserProfile.name,
        role: 'Verified Customer',
        rating: newReviewRating,
        comment: newReviewComment.trim(),
        service: shopServices[0]?.name || 'Grooming Service',
        barber: shopBarbers[0]?.name || 'Barber',
      });
      setNewReviewComment('');
      setReviewMessage(
        tr('✓ Thank you! Review published.', '✓ धन्यवाद! समीक्षा प्रकाशित हो गई।')
      );
    }
  };

  const handleSaveEditedReview = async (id: string) => {
    if (!onUpdateReview || !editReviewComment.trim()) return;
    await onUpdateReview(id, {
      rating: editReviewRating,
      comment: editReviewComment.trim(),
    });
    setEditingReviewId(null);
  };

  const openReportModal = (
    targetType: 'shop' | 'barber' | 'review',
    targetId: string,
    targetLabel: string
  ) => {
    if (!currentUserProfile) {
      if (onOpenAuthModal) onOpenAuthModal();
      return;
    }
    setReportTargetType(targetType);
    setReportTargetId(targetId);
    setReportTargetLabel(targetLabel);
    setReportDetails('');
    setReportSuccess('');
    setReportModalOpen(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSubmitReport) return;
    await onSubmitReport({
      targetType: reportTargetType,
      targetId: reportTargetId,
      targetLabel: reportTargetLabel,
      reason: reportReason,
      details: reportDetails.trim(),
    });
    setReportSuccess(
      tr(
        '✓ Report submitted to Platform Moderation.',
        '✓ रिपोर्ट मॉडरेशन टीम को भेज दी गई है।'
      )
    );
    setTimeout(() => {
      setReportModalOpen(false);
      setReportSuccess('');
    }, 1400);
  };

  const combinedGallery = [
    ...shopGallery.map((g: any) => ({
      id: g.id,
      image: g.imageUrl || ASSETS.royalInterior,
      title: g.title,
      tag: g.caption || activeShop.name,
    })),
    ...barberGallery.map((g: any) => ({
      id: g.id,
      image: g.imageUrl || ASSETS.barberMarcus,
      title: g.title,
      tag: g.styleTag || 'Barber Portfolio',
    })),
  ];

  return (
    <div className="bg-[#FAF6EA] text-[#111113] pb-20">
      {/* Top Bar with Back to All Shops and Switcher */}
      <div className="bg-[#111113] border-b border-[#F1E194]/15 py-3.5 px-5 sm:px-8">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onSelectShop(null)}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#F1E194] hover:text-[#FFF9E8] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{tr('All Barber Shops', 'सभी सैलून')}</span>
          </button>
          {shops.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs text-[#8A8178] shrink-0">
                {tr('Switch Salon:', 'सैलून बदलें:')}
              </span>
              {shops.map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectShop(s)}
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    s.id === activeShop.id
                      ? 'bg-[#F1E194] text-[#111113]'
                      : 'bg-[#241719] text-[#FFF9E8]/80 hover:text-[#FFF9E8]'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hero Cover */}
      <div className="relative h-[420px] sm:h-[480px] bg-[#111113] overflow-hidden">
        <SmartImage
          src={activeShop.image || ASSETS.royalInterior}
          alt={activeShop.name}
          className="w-full h-full object-cover opacity-65"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-[#111113]/40 to-transparent" />
      </div>

      {/* Overlapping Info Card */}
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 -mt-32 relative z-10">
        <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-7 sm:p-10 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {activeShop.verified && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[10px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {tr('Verified Salon', 'सत्यापित सैलून')}
                  </span>
                )}
                <span className="px-3 py-1 rounded-[10px] bg-[#111113] text-xs font-mono-num text-[#F1E194]">
                  {activeShop.rating}★ ({shopReviews.length || activeShop.reviewCount || 0}{' '}
                  {tr('reviews', 'समीक्षाएं')})
                </span>
                <span
                  className={`px-3 py-1 rounded-[10px] text-xs font-semibold ${
                    activeShop.isOpen
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-950/90 text-red-300'
                  }`}
                >
                  {activeShop.isOpen
                    ? tr('Open Now (IST)', 'अभी खुला है (IST)')
                    : tr('Closed', 'बंद है')}
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#FFF9E8]">
                {activeShop.name}
              </h1>

              <p className="text-xs sm:text-sm text-[#8A8178] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#F1E194] shrink-0" />
                <span>
                  {activeShop.address} · {activeShop.district}
                  {activeShop.phone ? ` · ${activeShop.phone}` : ''}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onToggleFavorite && (
                <button
                  type="button"
                  title={tr('Save Salon to Favorites', 'पसंदीदा में सहेजें')}
                  onClick={() => onToggleFavorite('shop', activeShop.id)}
                  className={`p-3.5 rounded-[16px] border cursor-pointer ${
                    isShopFav
                      ? 'bg-[#5B0E14] border-[#F1E194] text-[#F1E194]'
                      : 'bg-[#111113] border-[#F1E194]/25 text-[#FFF9E8]'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${isShopFav ? 'fill-[#F1E194]' : ''}`}
                  />
                </button>
              )}
              <button
                type="button"
                title={tr('Salon QR Check-In', 'सैलून QR')}
                onClick={() => setActiveTab('qr')}
                className="p-3.5 rounded-[16px] bg-[#111113] border border-[#F1E194]/25 text-[#F1E194] cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <button
                type="button"
                title={tr('Report Salon', 'सैलून की रिपोर्ट करें')}
                onClick={() =>
                  openReportModal('shop', activeShop.id, activeShop.name)
                }
                className="p-3.5 rounded-[16px] bg-[#111113] border border-[#F1E194]/20 text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
              >
                <Flag className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const srvElem = document.getElementById('shop-services-list');
                  if (srvElem) srvElem.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 rounded-[16px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
              >
                {tr('VIEW SERVICES', 'सेवाएं देखें')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSelectShop) onSelectShop(activeShop);
                  window.history.pushState(
                    {},
                    '',
                    `booking.html?shop_id=${encodeURIComponent(activeShop.id)}`
                  );
                  onNavigate('booking');
                }}
                className="px-6 py-3.5 rounded-[16px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer"
              >
                {tr('BOOK APPOINTMENT', 'अपॉइंटमेंट बुक करें')}
              </button>
            </div>
          </div>

          {(activeShop.about || activeShop.tagline) && (
            <p className="text-xs sm:text-sm text-[#FFF9E8]/80 mt-6 pt-6 border-t border-[#F1E194]/15 leading-relaxed">
              {activeShop.about || activeShop.tagline}
            </p>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-8 border-b border-[#5B0E14]/15 pb-3 overflow-x-auto">
          {[
            { id: 'services', label: tr('Services', 'सेवाएं') },
            { id: 'barbers', label: tr('Barbers', 'बार्बर टीम') },
            { id: 'reviews', label: tr('Reviews', 'समीक्षाएं') },
            { id: 'about', label: tr('About', 'सैलून विवरण') },
            { id: 'hours', label: tr('Opening Hours', 'खुलने का समय') },
            { id: 'gallery', label: tr('Gallery', 'गैलरी') },
            { id: 'qr', label: tr('Shop QR Pass', 'सैलून QR') },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-5 py-2.5 rounded-[14px] text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                activeTab === t.id
                  ? 'bg-[#5B0E14] text-[#FFF9E8]'
                  : 'bg-[#E9D9B8]/55 text-[#241719] hover:bg-[#E9D9B8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-8">
          {activeTab === 'services' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shopServices.length === 0 ? (
                <p className="text-sm text-[#8A8178] col-span-2 py-8">
                  {tr(
                    'No services are currently available.',
                    'इस समय कोई सेवा उपलब्ध नहीं है।'
                  )}
                </p>
              ) : (
                shopServices.map((srv: any) => (
                  <div
                    key={srv.id}
                    className="rounded-[20px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 flex items-center justify-between gap-4"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-[#5B0E14] uppercase">
                        {translateCategory(srv.category)} ·{' '}
                        {srv.durationMins || srv.durationMin || 45}{' '}
                        {tr('mins', 'मिनट')}
                      </span>
                      <h3 className="font-display text-2xl font-bold text-[#111113] mt-1">
                        {translateService(srv.name)}
                      </h3>
                      <p className="text-xs text-[#241719]/80 mt-1">
                        {srv.description}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono-num text-2xl font-bold text-[#5B0E14] block">
                        {formatINR(srv.price)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectShop) onSelectShop(activeShop);
                          onSelectServiceForBooking(srv);
                          window.history.pushState(
                            {},
                            '',
                            `booking.html?shop_id=${encodeURIComponent(activeShop.id)}`
                          );
                          onNavigate('booking');
                        }}
                        className="mt-2 px-4 py-2 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                      >
                        {tr('Book', 'बुक करें')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'barbers' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {shopBarbers.length === 0 ? (
                <p className="text-sm text-[#8A8178] col-span-3 py-8">
                  {tr('No barbers are currently available.', 'इस समय कोई बार्बर उपलब्ध नहीं है।')}
                </p>
              ) : (
                shopBarbers.map((brb: any) => {
                  const fav = isBarberFav(brb.id);
                  return (
                    <div
                      key={brb.id}
                      className="rounded-[22px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/20 p-6 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <SmartImage
                              src={brb.avatar}
                              alt={brb.name}
                              className="w-16 h-16 rounded-full object-cover border border-[#F1E194]/40"
                            />
                            <div>
                              <h3 className="font-display text-2xl font-bold">
                                {brb.name}
                              </h3>
                              <p className="text-xs text-[#F1E194]">{brb.role}</p>
                              <p className="text-[11px] text-[#8A8178] mt-0.5">
                                {brb.experience} · {brb.rating}★ ({brb.reviews || 0})
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {onToggleFavorite && (
                              <button
                                type="button"
                                onClick={() => onToggleFavorite('barber', brb.id)}
                                className="p-2 rounded-[10px] bg-[#111113] border border-[#F1E194]/20 text-[#F1E194] cursor-pointer"
                              >
                                <Heart
                                  className={`w-3.5 h-3.5 ${
                                    fav ? 'fill-[#F1E194]' : ''
                                  }`}
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              title={tr('Report Barber', 'रिपोर्ट करें')}
                              onClick={() =>
                                openReportModal('barber', brb.id, brb.name)
                              }
                              className="p-2 rounded-[10px] bg-[#111113] border border-[#F1E194]/15 text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-[#FFF9E8]/80 mt-3">
                          {brb.specialty}
                        </p>
                        {brb.bio && (
                          <p className="text-[11px] text-[#8A8178] mt-1.5">
                            {brb.bio}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#F1E194]/15">
                        <span className="font-mono-num text-sm font-bold text-[#F1E194]">
                          {formatINR(brb.priceFrom)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectShop) onSelectShop(activeShop);
                            onSelectBarberForBooking(brb);
                            window.history.pushState(
                              {},
                              '',
                              `booking.html?shop_id=${encodeURIComponent(activeShop.id)}`
                            );
                            onNavigate('booking');
                          }}
                          className="px-4 py-2 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
                        >
                          {tr('Book Barber', 'बार्बर चुनें')}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(combinedGallery.length > 0
                ? combinedGallery
                : [
                    {
                      id: 'gal-default-1',
                      image: activeShop.image || ASSETS.royalInterior,
                      title: activeShop.name,
                      tag: activeShop.district,
                    },
                    {
                      id: 'gal-default-2',
                      image: ASSETS.heroCraft,
                      title: tr('Bespoke Scissor Work', 'प्रेसिजन हेयरकट'),
                      tag: tr('Signature Craft', 'सिग्नेचर क्राफ्ट'),
                    },
                    {
                      id: 'gal-default-3',
                      image: ASSETS.serviceHotTowel,
                      title: tr('Hot Towel Shave Ritual', 'हॉट टॉवल शेव'),
                      tag: tr('Traditional Grooming', 'पारंपरिक ग्रूमिंग'),
                    },
                  ]
              ).map((item) => (
                <div
                  key={item.id}
                  className="rounded-[22px] overflow-hidden bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/20"
                >
                  <div className="h-56 overflow-hidden">
                    <SmartImage
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] uppercase tracking-widest text-[#F1E194]">
                      {item.tag}
                    </span>
                    <h3 className="font-display text-xl font-bold mt-0.5">
                      {item.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-7 space-y-4">
                {shopReviews.length === 0 ? (
                  <p className="text-sm text-[#8A8178] py-6">
                    {tr('No reviews submitted yet.', 'अभी तक कोई समीक्षा नहीं है।')}
                  </p>
                ) : (
                  shopReviews.map((rev: any) => {
                    const isMyReview =
                      currentUserProfile &&
                      (rev.customerUid === currentUserProfile.uid ||
                        rev.author === currentUserProfile.name);
                    return (
                      <div
                        key={rev.id}
                        className="rounded-[20px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-5 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm">{rev.author}</span>
                            {rev.date && (
                              <span className="text-[11px] text-[#8A8178] ml-2">
                                · {rev.date}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono-num text-xs text-[#5B0E14] font-bold">
                              {'★'.repeat(rev.rating || 5)}
                            </span>
                            {isMyReview && onUpdateReview && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReviewId(rev.id);
                                  setEditReviewComment(rev.comment);
                                  setEditReviewRating(Number(rev.rating) || 5);
                                }}
                                className="p-1.5 rounded-lg bg-[#FAF6EA] text-[#5B0E14] text-xs cursor-pointer"
                                title={tr('Edit Review', 'समीक्षा संपादित करें')}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                openReportModal(
                                  'review',
                                  rev.id,
                                  `Review by ${rev.author}`
                                )
                              }
                              className="p-1.5 rounded-lg bg-[#FAF6EA] text-[#8A8178] hover:text-[#5B0E14] text-xs cursor-pointer"
                              title={tr('Report Review', 'समीक्षा की रिपोर्ट करें')}
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingReviewId === rev.id ? (
                          <div className="space-y-2 pt-2">
                            <select
                              value={editReviewRating}
                              onChange={(e) =>
                                setEditReviewRating(Number(e.target.value))
                              }
                              className="px-3 py-1.5 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                            >
                              {[5, 4, 3, 2, 1].map((n) => (
                                <option key={n} value={n}>
                                  {n} Stars
                                </option>
                              ))}
                            </select>
                            <textarea
                              rows={2}
                              value={editReviewComment}
                              onChange={(e) => setEditReviewComment(e.target.value)}
                              className="w-full px-3 py-2 rounded-[10px] bg-[#FAF6EA] border border-[#5B0E14]/20 text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEditedReview(rev.id)}
                                className="px-3.5 py-1.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold cursor-pointer"
                              >
                                {tr('Save', 'सहेजें')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingReviewId(null)}
                                className="px-3.5 py-1.5 rounded-[10px] bg-[#FAF6EA] text-xs cursor-pointer"
                              >
                                {tr('Cancel', 'रद्द करें')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-[#241719] leading-relaxed">
                            {rev.comment}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="lg:col-span-5">
                <form
                  onSubmit={handleCreateReview}
                  className="rounded-[22px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/25 p-6 space-y-4"
                >
                  <h3 className="font-display text-2xl font-bold">
                    {tr('Leave a Verified Review', 'सत्यापित समीक्षा लिखें')}
                  </h3>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Rating (1-5)', 'रेटिंग (1-5)')}
                    </label>
                    <select
                      value={newReviewRating}
                      onChange={(e) => setNewReviewRating(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} Stars
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Your Experience', 'आपका अनुभव')}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={newReviewComment}
                      onChange={(e) => setNewReviewComment(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  {reviewMessage && (
                    <p className="text-xs text-[#F1E194]">{reviewMessage}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full py-3 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                  >
                    {tr('Submit Review', 'समीक्षा सबमिट करें')}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/25 p-8 max-w-3xl space-y-6">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194]">
                  {tr('About This Salon', 'सैलून के बारे में')}
                </span>
                <h3 className="font-display text-3xl font-bold mt-1">
                  {activeShop.name}
                </h3>
                <p className="text-sm text-[#FFF9E8]/80 mt-3 leading-relaxed">
                  {activeShop.about ||
                    activeShop.tagline ||
                    tr(
                      'Welcome to our salon. We provide premier grooming and styling services delivered by experienced barbers in a hygienic, comfortable setting.',
                      'हमारे सैलून में आपका स्वागत है। हम अनुभवी बार्बर्स द्वारा प्रीमियम ग्रूमिंग सेवाएं प्रदान करते हैं।'
                    )}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#F1E194]/15 text-xs">
                <div className="space-y-1">
                  <span className="text-[#8A8178] uppercase text-[10px] tracking-wider block">
                    {tr('Location & Address', 'स्थान और पता')}
                  </span>
                  <p className="font-medium text-[#FFF9E8]">
                    {activeShop.address}
                  </p>
                  <p className="text-[#8A8178]">{activeShop.district}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[#8A8178] uppercase text-[10px] tracking-wider block">
                    {tr('Direct Phone Contact', 'सीधा संपर्क नंबर')}
                  </span>
                  <p className="font-mono-num font-medium text-[#F1E194]">
                    {activeShop.phone || '+91 98765 43210'}
                  </p>
                  <p className="text-[#8A8178]">
                    {tr('Call for inquiries or directions', 'दिशा-निर्देश या पूछताछ के लिए कॉल करें')}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#F1E194]/15">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectShop) onSelectShop(activeShop);
                    window.history.pushState(
                      {},
                      '',
                      `booking.html?shop_id=${encodeURIComponent(activeShop.id)}`
                    );
                    onNavigate('booking');
                  }}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer hover:bg-[#FFE57F] transition-colors"
                >
                  {tr('Book Appointment', 'अपॉइंटमेंट बुक करें')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'hours' && (
            <div className="rounded-[22px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 max-w-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#5B0E14]/15 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#5B0E14] flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {tr(
                    'Operating Hours (IST • UTC+5:30)',
                    'खुलने का समय (IST • UTC+5:30)'
                  )}
                </span>
              </div>
              {(workingHours.length ? workingHours : OPENING_HOURS).map(
                (wh: any) => (
                  <div
                    key={wh.id || wh.day}
                    className="flex items-center justify-between text-xs py-2 border-b border-[#5B0E14]/10 last:border-0"
                  >
                    <span className="font-semibold text-[#111113]">
                      {wh.dayOfWeek || wh.day}
                    </span>
                    <span className="font-mono-num text-[#241719]">
                      {wh.isDayOff
                        ? tr('Closed', 'बंद')
                        : wh.hours || `${wh.startTime} – ${wh.endTime} IST`}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-6 sm:p-8 max-w-xl space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[16px] bg-[#5B0E14] text-[#F1E194] flex items-center justify-center">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-[#F1E194]">
                      {tr('INSTANT SALON QR DESTINATION', 'इंस्टेंट सैलून QR पास')}
                    </span>
                    <h3 className="font-display text-2xl font-bold">
                      {activeShop.name}
                    </h3>
                  </div>
                </div>
                <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                  barberloo.in ✓
                </span>
              </div>

              {/* Scannable High-Res QR Code Preview */}
              <div className="rounded-[20px] bg-[#FAF6EA] p-5 flex flex-col items-center justify-center text-center border-2 border-[#F1E194]/40 shadow-inner">
                <div className="p-2.5 bg-white rounded-[16px] shadow-md border border-[#111113]/10">
                  <canvas ref={qrCanvasRef} className="rounded-[10px]" />
                </div>
                <p className="text-xs text-[#5B0E14] font-semibold mt-3">
                  {tr(
                    'Scan with any smartphone camera to open instant booking',
                    'तुरंत बुकिंग खोलने के लिए किसी भी फ़ोन कैमरे से स्कैन करें'
                  )}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-[#8A8178]">
                  <span>{tr('Authoritative Production URL', 'आधिकारिक डोमेन URL')}</span>
                  <span className="font-mono-num font-semibold text-emerald-400">
                    barberloo.in
                  </span>
                </div>
                <div className="p-3.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 font-mono-num text-xs text-[#F1E194] break-all select-all">
                  {qrDestinationUrl}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(qrDestinationUrl);
                    setQrCopied(true);
                    setTimeout(() => setQrCopied(false), 2500);
                  }}
                  className="py-2.5 px-3 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-sm hover:bg-[#FFF9E8] transition-colors"
                >
                  {qrCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{tr('Copied!', 'कॉपी!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{tr('Copy Link', 'लिंक कॉपी')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!qrDataUrl) return;
                    const a = document.createElement('a');
                    a.href = qrDataUrl;
                    a.download = `barberloo-qr-${activeShop.id}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }}
                  className="py-2.5 px-3 rounded-[12px] bg-[#241719] border border-[#F1E194]/25 hover:bg-[#322023] text-[#FFF9E8] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[#F1E194]" />
                  <span>{tr('PNG', 'PNG')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  className="py-2.5 px-3 rounded-[12px] bg-[#241719] border border-[#F1E194]/25 hover:bg-[#322023] text-[#FFF9E8] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-[#F1E194]" />
                  <span>{tr('Standee', 'स्टैंडी')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onSelectShop) onSelectShop(activeShop);
                    window.history.pushState(
                      {},
                      '',
                      `booking.html?shop_id=${encodeURIComponent(activeShop.id)}`
                    );
                    onNavigate('booking');
                  }}
                  className="py-2.5 px-3 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] hover:bg-[#73121a] text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>{tr('Book Now', 'बुक करें')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111113]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleReportSubmit}
            className="w-full max-w-md rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-display text-2xl font-bold">
              {tr('Submit Moderation Report', 'रिपोर्ट दर्ज करें')}
            </h3>
            <p className="text-xs text-[#8A8178]">
              {tr('Reporting:', 'लक्ष्य:')} {reportTargetLabel} ({reportTargetType})
            </p>
            <div>
              <label className="block text-xs text-[#8A8178] mb-1">
                {tr('Reason', 'कारण')}
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
              >
                <option value="Service Quality Inquiry">Service Quality Inquiry</option>
                <option value="Inaccurate Salon Information">Inaccurate Salon Information</option>
                <option value="Inappropriate Review / Content">Inappropriate Review / Content</option>
                <option value="No-Show / Scheduling Issue">No-Show / Scheduling Issue</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#8A8178] mb-1">
                {tr('Details', 'विवरण')}
              </label>
              <textarea
                rows={3}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
              />
            </div>
            {reportSuccess && (
              <p className="text-xs text-[#F1E194]">{reportSuccess}</p>
            )}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-[12px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
              >
                {tr('Submit Report', 'रिपोर्ट भेजें')}
              </button>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="px-4 py-2.5 rounded-[12px] bg-[#111113] text-xs text-[#8A8178] cursor-pointer"
              >
                {tr('Cancel', 'रद्द करें')}
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Salon QR Modal */}
      <SalonQrModal
        shop={activeShop}
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        platformSettings={platformSettings}
      />
    </div>
  );
};
