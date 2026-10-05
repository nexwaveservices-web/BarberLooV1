import React, { useState } from 'react';
import {
  ASSETS,
  PageView,
  BarberItem,
  ServiceItem,
  ShopItem,
} from '../data/barberlooData';
import { SmartImage } from './SmartImage';
import {
  Search,
  MapPin,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Heart,
  Scissors,
  Store,
  UserPlus,
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import {
  DEFAULT_STATES,
  DEFAULT_CITIES,
  getCitiesForState,
} from '../lib/locations';

interface HomePageProps {
  onNavigate: (page: PageView) => void;
  onSelectServiceForBooking: (service: ServiceItem) => void;
  onSelectBarberForBooking: (barber: BarberItem) => void;
  onSelectShop: (shop: ShopItem) => void;
  shops?: any[];
  barbers?: any[];
  services?: any[];
  reviews?: any[];
  favorites?: any[];
  onToggleFavorite?: (targetType: 'shop' | 'barber', targetId: string) => void;
  onOpenAuthModal?: () => void;
  currentUserProfile?: any | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onSelectServiceForBooking,
  onSelectBarberForBooking,
  onSelectShop,
  shops = [],
  barbers = [],
  services = [],
  reviews = [],
  favorites = [],
  onToggleFavorite,
  onOpenAuthModal,
  currentUserProfile,
}) => {
  const {
    tr,
    formatINR,
    translateCity,
    translateCategory,
    translateService,
  } = useLanguage();

  const [selectedStateId, setSelectedStateId] = useState<string>(() => {
    return currentUserProfile?.stateId || currentUserProfile?.state_id || 'all';
  });
  const [selectedCityId, setSelectedCityId] = useState<string>(() => {
    return currentUserProfile?.cityId || currentUserProfile?.city_id || 'all';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeServiceFilter, setActiveServiceFilter] = useState<string>('All');
  const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(99999);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance');

  const handleStateSelect = (stId: string) => {
    setSelectedStateId(stId);
    setSelectedCityId('all');
  };

  const isFavorited = (type: 'shop' | 'barber', id: string) =>
    favorites.some((f) => f.targetType === type && f.targetId === id);

  const activeServicesList = services.filter((s: any) => s.active !== false);

  const filteredServices = activeServicesList
    .filter((srv: any) => {
      const matchesTab =
        activeServiceFilter === 'All' || srv.category === activeServiceFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (srv.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrice = Number(srv.price) <= maxPriceFilter;
      return matchesTab && matchesSearch && matchesPrice;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'price') return Number(a.price) - Number(b.price);
      return 0;
    });

  const activeBarbersList = barbers.filter(
    (b: any) => b.active !== false && b.verificationStatus !== 'suspended'
  );

  const filteredBarbers = activeBarbersList
    .filter((barber: any) => {
      const matchesQuery =
        !searchQuery.trim() ||
        barber.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (barber.specialty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (barber.shopName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = Number(barber.rating) >= minRatingFilter;
      const matchesPrice = Number(barber.priceFrom) <= maxPriceFilter;
      return matchesQuery && matchesRating && matchesPrice;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'rating') return Number(b.rating) - Number(a.rating);
      if (sortBy === 'price') return Number(a.priceFrom) - Number(b.priceFrom);
      return 0;
    });

  const filteredShops = shops
    .filter((shop: any) => {
      if (
        shop.approvalStatus === 'suspended' ||
        shop.approvalStatus === 'rejected'
      ) {
        return false;
      }

      // 1. State matching
      if (selectedStateId !== 'all') {
        const stateObj = DEFAULT_STATES.find((s) => s.id === selectedStateId);
        const stateName = stateObj?.name.toLowerCase() || '';
        const sState = (shop.state || '').toLowerCase();
        const sAddress = (shop.address || '').toLowerCase();
        const sDistrict = (shop.district || '').toLowerCase();
        const matchesState =
          shop.stateId === selectedStateId ||
          shop.state_id === selectedStateId ||
          (stateName &&
            (sState.includes(stateName) ||
              sAddress.includes(stateName) ||
              sDistrict.includes(stateName)));
        if (!matchesState) return false;
      }

      // 2. City matching
      if (selectedCityId !== 'all') {
        const cityObj = DEFAULT_CITIES.find((c) => c.id === selectedCityId);
        const cityName = cityObj?.name.toLowerCase() || '';
        const sCity = (shop.city || '').toLowerCase();
        const sAddress = (shop.address || '').toLowerCase();
        const sDistrict = (shop.district || '').toLowerCase();
        const matchesCity =
          shop.cityId === selectedCityId ||
          shop.city_id === selectedCityId ||
          (cityName &&
            (sCity.includes(cityName) ||
              sAddress.includes(cityName) ||
              sDistrict.includes(cityName)));
        if (!matchesCity) return false;
      }

      // 3. Search query
      const matchesQuery =
        !searchQuery.trim() ||
        shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.district || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (shop.tagline || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = Number(shop.rating) >= minRatingFilter;
      const matchesPrice = Number(shop.minPrice || 0) <= maxPriceFilter;
      return matchesQuery && matchesRating && matchesPrice;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'rating') return Number(b.rating) - Number(a.rating);
      if (sortBy === 'price')
        return Number(a.minPrice || 0) - Number(b.minPrice || 0);
      return (
        Number(a.distanceMilesTenths || 4) - Number(b.distanceMilesTenths || 4)
      );
    });

  const publishedReviews = reviews.filter((r: any) => r.status !== 'hidden');

  const avgRatingDisplay =
    activeBarbersList.length > 0
      ? (
          activeBarbersList.reduce(
            (acc, b) => acc + (Number(b.rating) || 5),
            0
          ) / activeBarbersList.length
        ).toFixed(1) + '★'
      : '—';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const el = document.getElementById('nearby-shops-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="bg-[#FAF6EA] text-[#111113]">
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[84vh] flex items-end bg-[#111113] text-[#FFF9E8] overflow-hidden">
        <div className="absolute inset-0">
          <SmartImage
            src={ASSETS.heroCraft}
            alt="Luxury Barber Craftsmanship"
            className="w-full h-full object-cover object-center opacity-55 scale-[1.01]"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(105deg, rgba(17,17,19,0.95) 0%, rgba(36,23,25,0.78) 52%, rgba(17,17,19,0.35) 100%)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-[1360px] w-full mx-auto px-5 sm:px-8 pt-24 pb-20 lg:pb-28">
          <div className="max-w-3xl space-y-6">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] uppercase text-[#F1E194]">
              {tr(
                'BARBERLOO INDIA • BOOK • GROOM • LOOK SHARP • REPEAT',
                'बारबरलू इंडिया • बुक करें • ग्रूमिंग • लुक शार्प'
              )}
            </p>

            <h1 className="font-display font-bold text-[#FFF9E8] text-5xl sm:text-7xl lg:text-[86px] leading-[0.94] tracking-[-0.02em]">
              {tr('FIND YOUR NEXT', 'अपना अगला शानदार')}
              <br />
              <span className="text-[#F1E194]">
                {tr('GREAT CUT.', 'हेयरकट बुक करें।')}
              </span>
            </h1>

            <p className="text-base sm:text-xl text-[#FFF9E8]/85 max-w-xl leading-relaxed font-normal">
              {tr(
                'Discover trusted barbers, book your appointment, and enjoy bespoke grooming without wasting time waiting.',
                'विश्वसनीय बार्बर खोजें, अपना अपॉइंटमेंट बुक करें और बिना समय बर्बाद किए प्रीमियम ग्रूमिंग का आनंद लें।'
              )}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  const targetShop = shops[0];
                  if (targetShop) {
                    onSelectShop(targetShop);
                    window.history.pushState(
                      {},
                      '',
                      `booking.html?shop_id=${encodeURIComponent(targetShop.id)}`
                    );
                  } else {
                    window.history.pushState({}, '', 'booking.html');
                  }
                  onNavigate('booking');
                }}
                className="px-8 py-4 rounded-[20px] bg-[#5B0E14] text-[#FFF9E8] border border-[#F1E194]/30 text-xs sm:text-sm font-semibold tracking-[0.14em] uppercase hover:bg-[#73121a] transition-all duration-200 shadow-xl cursor-pointer"
              >
                {tr('BOOK AN APPOINTMENT', 'अपॉइंटमेंट बुक करें')}
              </button>

              <button
                type="button"
                onClick={() => onNavigate('shop')}
                className="px-8 py-4 rounded-[20px] bg-[#F1E194] text-[#111113] text-xs sm:text-sm font-semibold tracking-[0.14em] uppercase hover:bg-[#FFF9E8] transition-all duration-200 shadow-xl inline-flex items-center gap-2.5 cursor-pointer"
              >
                <span>{tr('EXPLORE BARBERS', 'बार्बर देखें')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CLEAN SEARCH & DISCOVERY BAR */}
      <section className="relative z-20 -mt-10 max-w-[1360px] mx-auto px-5 sm:px-8">
        <div className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/25 p-5 sm:p-6 shadow-2xl space-y-4">
          <form
            onSubmit={handleSearchSubmit}
            className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center"
          >
            <div className="md:col-span-3 flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-[#111113]/75 border border-[#F1E194]/15">
              <MapPin className="w-4 h-4 text-[#F1E194] shrink-0" />
              <div className="w-full">
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[#8A8178]">
                  {tr('State', 'राज्य')}
                </label>
                <select
                  value={selectedStateId}
                  onChange={(e) => handleStateSelect(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#FFF9E8] focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#111113]">
                    {tr('All States', 'सभी राज्य')}
                  </option>
                  {DEFAULT_STATES.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#111113]">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-3 flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-[#111113]/75 border border-[#F1E194]/15">
              <MapPin className="w-4 h-4 text-[#F1E194] shrink-0" />
              <div className="w-full">
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[#8A8178]">
                  {tr('City', 'शहर')}
                </label>
                <select
                  value={selectedCityId}
                  onChange={(e) => setSelectedCityId(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#FFF9E8] focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[#111113]">
                    {selectedStateId !== 'all'
                      ? tr('All Cities in State', 'राज्य के सभी शहर')
                      : tr('All Indian Cities', 'सभी भारतीय शहर')}
                  </option>
                  {getCitiesForState(selectedStateId).map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#111113]">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-4 flex items-center gap-3 px-3.5 py-3 rounded-[16px] bg-[#111113]/75 border border-[#F1E194]/15">
              <Search className="w-4 h-4 text-[#F1E194] shrink-0" />
              <div className="w-full">
                <label className="block text-[10px] uppercase tracking-[0.16em] text-[#8A8178]">
                  {tr('Search Salon or Service', 'सैलून या सेवा खोजें')}
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tr(
                    'Search by salon name, barber or haircut...',
                    'सैलून का नाम, बार्बर या हेयरकट खोजें...'
                  )}
                  className="w-full bg-transparent text-xs text-[#FFF9E8] placeholder:text-[#8A8178] focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full py-3.5 px-3 rounded-[16px] bg-[#5B0E14] hover:bg-[#75131b] text-[#FFF9E8] border border-[#F1E194]/25 text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer"
              >
                {tr('DISCOVER', 'सैलून खोजें')}
              </button>
            </div>
          </form>

          {/* Compact Filter & Sort Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1E194]/12 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[#F1E194] font-semibold inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{tr('Filters:', 'फ़िल्टर:')}</span>
              </span>

              <select
                value={minRatingFilter}
                onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                className="px-3 py-1.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] text-xs cursor-pointer"
              >
                <option value={0}>{tr('Any Rating', 'सभी रेटिंग')}</option>
                <option value={4.5}>4.5★ &amp; {tr('Above', 'अधिक')}</option>
                <option value={4.8}>4.8★ &amp; {tr('Above', 'अधिक')}</option>
              </select>

              <select
                value={maxPriceFilter}
                onChange={(e) => setMaxPriceFilter(Number(e.target.value))}
                className="px-3 py-1.5 rounded-[10px] bg-[#111113] border border-[#F1E194]/20 text-[#FFF9E8] text-xs cursor-pointer"
              >
                <option value={99999}>{tr('Any Price (INR)', 'कोई भी कीमत (₹)')}</option>
                <option value={850}>
                  {tr('Up to', 'अधिकतम')} {formatINR(850)}
                </option>
                <option value={1500}>
                  {tr('Up to', 'अधिकतम')} {formatINR(1500)}
                </option>
                <option value={2500}>
                  {tr('Up to', 'अधिकतम')} {formatINR(2500)}
                </option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#8A8178]">{tr('Sort by:', 'क्रमबद्ध करें:')}</span>
              {(['distance', 'rating', 'price'] as const).map((sKey) => (
                <button
                  key={sKey}
                  type="button"
                  onClick={() => setSortBy(sKey)}
                  className={`px-3 py-1.5 rounded-[10px] font-semibold capitalize cursor-pointer ${
                    sortBy === sKey
                      ? 'bg-[#F1E194] text-[#111113]'
                      : 'bg-[#111113] text-[#8A8178] hover:text-[#FFF9E8]'
                  }`}
                >
                  {sKey === 'distance'
                    ? tr('Distance', 'दूरी')
                    : sKey === 'rating'
                    ? tr('Rating', 'रेटिंग')
                    : tr('Price (₹)', 'कीमत (₹)')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. REAL-TIME PLATFORM STATISTICS */}
      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 pt-14 pb-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-8 border-y border-[#5B0E14]/15">
          {[
            {
              num: String(shops.length),
              label: tr('Partner Salons', 'पंजीकृत सैलून'),
            },
            {
              num: String(activeBarbersList.length),
              label: tr('Verified Barbers', 'सत्यापित बार्बर'),
            },
            {
              num: String(activeServicesList.length),
              label: tr('Grooming Services', 'ग्रूमिंग सेवाएं'),
            },
            {
              num: avgRatingDisplay,
              label: tr('Average Rating', 'औसत रेटिंग'),
            },
          ].map((stat, idx) => (
            <div
              key={stat.label}
              className={`${
                idx !== 0 ? 'lg:border-l lg:border-[#5B0E14]/12 lg:pl-8' : ''
              }`}
            >
              <div className="font-display font-mono-num text-3xl sm:text-5xl font-bold text-[#5B0E14]">
                {stat.num}
              </div>
              <div className="text-xs sm:text-sm font-medium text-[#8A8178] mt-1 tracking-wide">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. REAL STARTUP ONBOARDING BANNER WHEN NO SHOPS/SERVICES ARE REGISTERED YET */}
      {shops.length === 0 && activeServicesList.length === 0 && (
        <section className="max-w-[1360px] mx-auto px-5 sm:px-8 py-8">
          <div className="rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/30 p-8 sm:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[10px] bg-[#5B0E14] text-[#F1E194] text-xs font-semibold tracking-wider uppercase">
                <Store className="w-3.5 h-3.5" />
                {tr('REAL PRODUCTION NETWORK • INDIA', 'रियल प्रोडक्शन नेटवर्क • भारत')}
              </span>
              <h2 className="font-display text-3xl sm:text-5xl font-bold leading-tight">
                {tr(
                  'Welcome to BarberLoo India.',
                  'बारबरलू इंडिया में आपका स्वागत है।'
                )}
              </h2>
              <p className="text-sm text-[#8A8178] max-w-2xl leading-relaxed">
                {tr(
                  'All mock data has been removed. Are you a barbershop owner or master barber? Sign up as a Barber Partner to register your salon, publish your ₹ INR service menu, and manage real online bookings. Customers can sign up to book real appointments in IST.',
                  'सभी डेमो डेटा हटा दिए गए हैं। यदि आप सैलून मालिक या बार्बर हैं, तो बार्बर पार्टनर के रूप में साइन अप करें और अपनी दुकान व सेवाएं (₹ में) जोड़ें। ग्राहक अपॉइंटमेंट बुक करने के लिए ग्राहक खाता बना सकते हैं।'
                )}
              </p>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-3">
              {currentUserProfile?.role === 'barber' ||
              currentUserProfile?.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => onNavigate('barber-dashboard')}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase hover:bg-[#FFF9E8] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Scissors className="w-4 h-4" />
                  <span>
                    {tr('OPEN BARBER CONSOLE', 'बार्बर कंसोल खोलें')}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal && onOpenAuthModal()}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase hover:bg-[#FFF9E8] transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {tr(
                      'SIGN UP AS CUSTOMER OR BARBER',
                      'ग्राहक या बार्बर के रूप में जुड़ें'
                    )}
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 5. SERVICES SECTION */}
      {activeServicesList.length > 0 && (
        <section className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-2">
                {tr('CURATED GROOMING MENU (INR)', 'ग्रूमिंग सेवाएं (₹ INR)')}
              </p>
              <h2 className="font-display text-4xl sm:text-5xl font-bold text-[#111113]">
                {tr('Popular Services', 'लोकप्रिय सेवाएं')}
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                'All',
                'Precision Haircuts',
                'Beard Architecture',
                'Traditional Shaves',
                'Complete Rituals',
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveServiceFilter(cat)}
                  className={`px-4 py-2 rounded-[16px] text-xs font-semibold transition-colors cursor-pointer ${
                    activeServiceFilter === cat
                      ? 'bg-[#5B0E14] text-[#FFF9E8]'
                      : 'bg-[#E9D9B8]/60 text-[#241719] hover:bg-[#E9D9B8]'
                  }`}
                >
                  {cat === 'All'
                    ? tr('All Services', 'सभी सेवाएं')
                    : translateCategory(cat)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service: any, index: number) => (
              <div
                key={service.id}
                className="group rounded-[22px] bg-[#E9D9B8]/55 hover:bg-[#E9D9B8]/90 border border-[#5B0E14]/12 p-7 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-[#8A8178] mb-4">
                    <span className="font-mono-num font-semibold text-[#5B0E14]">
                      0{index + 1} · {translateCategory(service.category)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono-num">
                      <Clock className="w-3.5 h-3.5" />
                      {service.durationMins || service.durationMin || 45}{' '}
                      {tr('mins', 'मिनट')}
                    </span>
                  </div>

                  <h3 className="font-display text-2xl font-bold text-[#111113] mb-2">
                    {translateService(service.name)}
                  </h3>

                  <p className="text-sm text-[#241719]/80 leading-relaxed mb-6">
                    {service.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-[#5B0E14]/12">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#8A8178] block">
                      {tr('Tariff (Incl. GST)', 'शुल्क (GST सहित)')}
                    </span>
                    <span className="font-mono-num text-2xl font-bold text-[#5B0E14]">
                      {formatINR(service.price)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const targetShop =
                        shops.find((sh: any) => sh.id === service.shopId) || shops[0];
                      if (targetShop) onSelectShop(targetShop);
                      onSelectServiceForBooking(service);
                      const targetId = service.shopId || targetShop?.id;
                      if (targetId) {
                        window.history.pushState(
                          {},
                          '',
                          `booking.html?shop_id=${encodeURIComponent(targetId)}`
                        );
                      }
                      onNavigate('booking');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[16px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold tracking-wider uppercase hover:bg-[#241719] transition-colors cursor-pointer"
                  >
                    <span>{tr('Select', 'बुक करें')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. NEARBY BARBER SHOPS (LOCATION FILTERED) */}
      <section
        id="nearby-shops-section"
        className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14 border-t border-[#5B0E14]/12"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-2">
              {tr('VERIFIED PARTNER SALONS', 'सत्यापित पार्टनर सैलून')}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-[#111113]">
              {selectedCityId !== 'all'
                ? `${DEFAULT_CITIES.find((c) => c.id === selectedCityId)?.name || ''} ${tr('Salons', 'सैलून')}`
                : selectedStateId !== 'all'
                ? `${DEFAULT_STATES.find((s) => s.id === selectedStateId)?.name || ''} ${tr('Salons', 'सैलून')}`
                : tr('Partner Barber Shops', 'पार्टनर बार्बर शॉप्स')}
            </h2>
          </div>
          {(selectedStateId !== 'all' || selectedCityId !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedStateId('all');
                setSelectedCityId('all');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[#5B0E14] underline hover:text-[#73121a] cursor-pointer"
            >
              {tr('Clear Location Filter', 'फ़िल्टर हटाएं')}
            </button>
          )}
        </div>

        {filteredShops.length === 0 ? (
          <div className="rounded-[24px] bg-[#E9D9B8]/40 border border-[#5B0E14]/15 p-8 sm:p-12 text-center space-y-4">
            <Store className="w-10 h-10 text-[#5B0E14] mx-auto opacity-75" />
            <h3 className="font-display text-2xl font-bold text-[#111113]">
              {tr(
                'No verified salons found in this location.',
                'इस स्थान पर कोई सत्यापित सैलून नहीं मिला।'
              )}
            </h3>
            <p className="text-xs sm:text-sm text-[#8A8178] max-w-lg mx-auto">
              {tr(
                'No partner barbershops match your selected state/city or search filters. Try switching city or exploring all registered partner salons.',
                'आपके चुने गए स्थान या खोज फ़िल्टर से कोई सैलून मेल नहीं खाता। कृपया दूसरा शहर चुनें या सभी सैलून देखें।'
              )}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedStateId('all');
                  setSelectedCityId('all');
                  setSearchQuery('');
                }}
                className="px-5 py-2.5 rounded-[14px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                {tr('SHOW ALL SALONS', 'सभी सैलून देखें')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedStateId('st-pb');
                  setSelectedCityId('all');
                }}
                className="px-5 py-2.5 rounded-[14px] bg-[#241719] text-[#F1E194] text-xs font-semibold uppercase tracking-wider cursor-pointer"
              >
                {tr('EXPLORE PUNJAB SALONS', 'पंजाब के सैलून देखें')}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {filteredShops.map((shop: any) => {
              const fav = isFavorited('shop', shop.id);
              return (
                <div
                  key={shop.id}
                  className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/20 overflow-hidden flex flex-col justify-between shadow-xl group"
                >
                  <div>
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <SmartImage
                        src={shop.image}
                        alt={shop.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#241719] via-transparent to-transparent" />
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                        <span className="px-3 py-1 rounded-[10px] bg-[#111113]/85 backdrop-blur-md text-xs font-semibold text-[#F1E194] border border-[#F1E194]/25">
                          {translateCity(shop.district || shop.city)}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-[10px] bg-[#111113]/85 backdrop-blur-md text-xs font-mono-num text-[#FFF9E8]">
                            {shop.rating}★ ({shop.reviewCount || 0})
                          </span>
                          {onToggleFavorite && (
                            <button
                              type="button"
                              onClick={() => onToggleFavorite('shop', shop.id)}
                              className={`p-2 rounded-full backdrop-blur-md border cursor-pointer ${
                                fav
                                  ? 'bg-[#5B0E14] border-[#F1E194] text-[#F1E194]'
                                  : 'bg-[#111113]/75 border-[#FFF9E8]/20 text-[#FFF9E8]'
                              }`}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 ${
                                  fav ? 'fill-[#F1E194]' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      <h3 className="font-display text-2xl font-bold text-[#FFF9E8]">
                        {shop.name}
                      </h3>
                      <p className="text-xs text-[#8A8178] mt-1">{shop.address}</p>
                      <p className="text-xs text-[#F1E194]/90 mt-3 line-clamp-2">
                        {shop.tagline}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-3 border-t border-[#F1E194]/12 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="text-[#8A8178] block">
                        {tr('From', 'शुरुआती शुल्क')}
                      </span>
                      <span className="font-mono-num font-bold text-[#F1E194]">
                        {formatINR(shop.minPrice || 500)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectShop(shop);
                          onNavigate('shop');
                        }}
                        className="px-4 py-2.5 rounded-[14px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/25 text-xs font-semibold cursor-pointer"
                      >
                        {tr('View Shop', 'दुकान देखें')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectShop(shop);
                          window.history.pushState(
                            {},
                            '',
                            `booking.html?shop_id=${encodeURIComponent(shop.id)}`
                          );
                          onNavigate('booking');
                        }}
                        className="px-4 py-2.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold cursor-pointer"
                      >
                        {tr('Book', 'बुक करें')}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 7. TOP RATED BARBERS */}
      {filteredBarbers.length > 0 && (
        <section className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14 border-t border-[#5B0E14]/12">
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-2">
              {tr('MASTER CRAFTSMEN', 'सत्यापित मास्टर बार्बर')}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-[#111113]">
              {tr('Registered Barbers', 'पंजीकृत बार्बर')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
            {filteredBarbers.map((barber: any) => {
              const fav = isFavorited('barber', barber.id);
              return (
                <div
                  key={barber.id}
                  className="rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/25 overflow-hidden flex flex-col justify-between shadow-xl group"
                >
                  <div>
                    <div className="relative aspect-[4/4] overflow-hidden bg-[#111113]">
                      <SmartImage
                        src={barber.avatar}
                        alt={barber.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#241719] via-transparent to-transparent" />
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        <div className="px-3 py-1 rounded-[12px] bg-[#111113]/85 backdrop-blur-md border border-[#F1E194]/30 text-xs font-mono-num font-semibold text-[#F1E194]">
                          {barber.rating} ★ ({barber.reviews || 0})
                        </div>
                        {onToggleFavorite && (
                          <button
                            type="button"
                            onClick={() => onToggleFavorite('barber', barber.id)}
                            className={`p-2 rounded-full backdrop-blur-md border cursor-pointer ${
                              fav
                                ? 'bg-[#5B0E14] border-[#F1E194] text-[#F1E194]'
                                : 'bg-[#111113]/75 border-[#FFF9E8]/20 text-[#FFF9E8]'
                            }`}
                          >
                            <Heart
                              className={`w-3.5 h-3.5 ${
                                fav ? 'fill-[#F1E194]' : ''
                              }`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-6">
                      <p className="text-xs font-medium text-[#F1E194] mb-1">
                        {barber.role} · {barber.shopName}
                      </p>
                      <h3 className="font-display text-3xl font-bold text-[#FFF9E8]">
                        {barber.name}
                      </h3>
                      <p className="text-xs text-[#8A8178] mt-2">
                        {barber.specialty}
                      </p>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-3 border-t border-[#F1E194]/12 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-[#8A8178] block">
                        {tr('Starts at', 'शुरुआती कीमत')}
                      </span>
                      <span className="font-mono-num text-lg font-bold text-[#F1E194]">
                        {formatINR(barber.priceFrom)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const targetShop =
                          shops.find((sh: any) => sh.id === barber.shopId) || shops[0];
                        if (targetShop) onSelectShop(targetShop);
                        onSelectBarberForBooking(barber);
                        const targetId = barber.shopId || targetShop?.id;
                        if (targetId) {
                          window.history.pushState(
                            {},
                            '',
                            `booking.html?shop_id=${encodeURIComponent(targetId)}`
                          );
                        }
                        onNavigate('booking');
                      }}
                      className="px-5 py-2.5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold uppercase tracking-wider cursor-pointer"
                    >
                      {tr('Book Chair', 'चेयर बुक करें')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 8. REVIEWS SECTION (ONLY IF VERIFIED REVIEWS EXIST) */}
      {publishedReviews.length > 0 && (
        <section className="max-w-[1360px] mx-auto px-5 sm:px-8 py-14 border-t border-[#5B0E14]/12">
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#5B0E14] mb-2">
              {tr('VERIFIED CLIENT REVIEWS', 'सत्यापित ग्राहक समीक्षाएं')}
            </p>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-[#111113]">
              {tr('Client Testimonials', 'ग्राहकों के अनुभव')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {publishedReviews.slice(0, 3).map((rev: any) => (
              <div
                key={rev.id}
                className="rounded-[22px] bg-[#E9D9B8]/55 border border-[#5B0E14]/15 p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-mono-num font-bold text-[#5B0E14] mb-3">
                    {'★'.repeat(rev.rating || 5)}
                  </div>
                  <p className="text-sm text-[#111113] leading-relaxed italic mb-6">
                    “{rev.comment}”
                  </p>
                </div>
                <div className="pt-4 border-t border-[#5B0E14]/10 text-xs">
                  <p className="font-bold text-[#111113]">{rev.author}</p>
                  <p className="text-[#8A8178]">
                    {rev.service} · {rev.barber}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
