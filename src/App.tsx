/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarberItem,
  PageView,
  ServiceItem,
  ShopItem,
  PlatformSettingsItem,
} from './data/barberlooData';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { ShopPage } from './components/ShopPage';
import { BookingPage } from './components/BookingPage';
import { CustomerDashboard } from './components/CustomerDashboard';
import { BarberDashboard } from './components/BarberDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { RefundPolicyPage } from './components/RefundPolicyPage';
import { DisclaimerPage } from './components/DisclaimerPage';
import { AboutUsPage } from './components/AboutUsPage';
import { ContactUsPage } from './components/ContactUsPage';
import { EasyBar } from './components/EasyBar';
import { Footer } from './components/Footer';
import {
  apiFetchBootstrap,
  apiSyncAuthUser,
  apiUpdateProfile,
  apiCreateAppointment,
  apiUpdateAppointment,
  apiCreateService,
  apiUpdateService,
  apiDeleteService,
  apiCreateBarber,
  apiUpdateBarber,
  apiDeleteBarber,
  apiCreateShop,
  apiUpdateShop,
  apiUpdateWorkingHours,
  apiCreateReview,
  apiUpdateReview,
  apiToggleFavorite,
  apiMarkNotificationsRead,
  apiCreateCoupon,
  apiUpdateCoupon,
  apiCreateReport,
  apiUpdateReport,
  apiUpdatePayment,
  apiCreateShopGalleryItem,
  apiCreateBarberGalleryItem,
  apiBroadcastShopNotification,
  apiUpdatePlatformFee,
  connectRealtimeSocket,
} from './lib/api';
import {
  supabase,
  getPersistedSupabaseUser,
  setPersistedSupabaseUser,
} from './lib/supabase';
import { LanguageProvider } from './lib/i18n';
import { getShopSlug, findShopBySlugOrId } from './lib/domain';
import {
  registerNotificationServiceWorker,
  checkAndNotifyAppointmentReminders,
  checkAndNotifyDatabaseNotifications,
  startBackgroundReminderTicker,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from './lib/browserNotifications';
import { Lock, LogIn } from 'lucide-react';

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageView>('home');
  const [activeUserUid, setActiveUserUid] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  const [shops, setShops] = useState<any[]>([]);
  const [barbers, setBarbers] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedShop, setSelectedShop] = useState<ShopItem | null>(null);
  const [bookingService, setBookingService] = useState<ServiceItem | null>(null);
  const [bookingBarber, setBookingBarber] = useState<BarberItem | null>(null);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [workingHours, setWorkingHours] = useState<any[]>([]);
  const [shopGallery, setShopGallery] = useState<any[]>([]);
  const [barberGallery, setBarberGallery] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettingsItem>({
    id: 'default',
    feeType: 'fixed',
    feeAmount: 10,
    minFee: 5,
    refundPolicy: 'service_only',
  });

  const loadBootstrapState = useCallback(
    async (uidToLoad = activeUserUid) => {
      try {
        const data = await apiFetchBootstrap(uidToLoad);
        if (data.platformSettings) {
          setPlatformSettings(data.platformSettings);
        }
        if (Array.isArray(data.shops)) {
          setShops(data.shops);
          const params = new URLSearchParams(window.location.search);
          const targetShopId = params.get('shop_id') || params.get('shop');
          setSelectedShop((prev) => {
            if (!data.shops.length) return null;
            if (targetShopId) {
              const matched = data.shops.find(
                (s: any) =>
                  s.id === targetShopId ||
                  s.qrCodeSlug === targetShopId ||
                  String(s.name || '').toLowerCase() === targetShopId.toLowerCase()
              );
              if (matched) return matched;
            }
            if (prev) {
              const matched = data.shops.find((s: any) => s.id === prev.id);
              if (matched) return matched;
            }
            // Section 8: Never automatically lock into last viewed or default shop
            return null;
          });
        }
        if (Array.isArray(data.barbers)) setBarbers(data.barbers);
        if (Array.isArray(data.services)) setServices(data.services);
        if (Array.isArray(data.appointments)) setAppointments(data.appointments);
        if (Array.isArray(data.reviews)) setReviews(data.reviews);
        if (Array.isArray(data.coupons)) setCoupons(data.coupons);
        if (data.workingHours?.length) setWorkingHours(data.workingHours);
        if (Array.isArray(data.shopGallery)) setShopGallery(data.shopGallery);
        if (Array.isArray(data.barberGallery)) setBarberGallery(data.barberGallery);
        if (Array.isArray(data.payments)) setPayments(data.payments);
        if (Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
          if (uidToLoad) {
            const matchedProfile = data.profiles.find(
              (p: any) => p.uid === uidToLoad
            );
            if (matchedProfile) {
              setCurrentUserProfile(matchedProfile);
            }
          }
        }
        if (Array.isArray(data.reports)) setReports(data.reports);
        if (Array.isArray(data.favorites)) setFavorites(data.favorites);
        if (Array.isArray(data.notifications)) setNotifications(data.notifications);
      } catch {
        // Resilient fallback on transient network hiccup
      }
    },
    [activeUserUid]
  );

  useEffect(() => {
    const handleUrlRoute = () => {
      const pathname = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);

      // CRITICAL: Never intercept or rewrite WordPress administration or login paths
      if (
        pathname.startsWith('/wp-admin') ||
        pathname.includes('/wp-admin/') ||
        pathname.includes('wp-login') ||
        pathname.includes('wp-cron') ||
        pathname.includes('wp-json')
      ) {
        return;
      }

      // 1. Direct Modal Triggers (Signup / Login)
      if (pathname === '/signup' || pathname === '/signup/' || params.get('page') === 'signup') {
        setCurrentPage('home');
        setAuthModalOpen(true);
        return;
      }
      if (pathname === '/login' || pathname === '/login/' || params.get('page') === 'login') {
        setCurrentPage('home');
        setAuthModalOpen(true);
        return;
      }

      // 2. Booking URLs: /book-appointment/, /book-appointment/?shop=..., /booking.html, ?page=booking
      const isBookingPath =
        pathname === '/book-appointment' ||
        pathname.startsWith('/book-appointment/') ||
        pathname === '/booking' ||
        pathname === '/booking.html' ||
        pathname.includes('booking') ||
        params.get('page') === 'booking' ||
        (Boolean(params.get('shop_id')) && params.get('page') !== 'shop');

      if (isBookingPath) {
        setCurrentPage('booking');
        const shopParam = params.get('shop') || params.get('shop_id');
        if (shopParam && shops.length > 0) {
          const matched = findShopBySlugOrId(shops, shopParam);
          if (matched) setSelectedShop(matched);
        }
        return;
      }

      // 3. Shop Details: /shop/:slug/ or legacy ?page=shop&shop=...
      if (pathname.startsWith('/shop/') && pathname !== '/shops' && pathname !== '/shops/') {
        const rawSlug = pathname.replace(/^\/shop\//, '').replace(/\/+$/, '');
        setCurrentPage('shop');
        if (rawSlug && shops.length > 0) {
          const matched = findShopBySlugOrId(shops, rawSlug);
          if (matched) setSelectedShop(matched);
        }
        return;
      }

      // 4. Shops Directory: /shops or /shops/ or legacy ?page=shop (without shop param)
      if (
        pathname === '/shops' ||
        pathname === '/shops/' ||
        (pathname === '/shop' && !params.get('shop') && !params.get('shop_id')) ||
        (params.get('page') === 'shop' && !params.get('shop') && !params.get('shop_id'))
      ) {
        setCurrentPage('shop');
        setSelectedShop(null);
        return;
      }

      // 4b. Legacy ?page=shop with shop param
      if (params.get('page') === 'shop' || params.get('shop')) {
        setCurrentPage('shop');
        const shopParam = params.get('shop') || params.get('shop_id');
        if (shopParam && shops.length > 0) {
          const matched = findShopBySlugOrId(shops, shopParam);
          if (matched) setSelectedShop(matched);
        }
        return;
      }

      // 5. Barber Console & Sub-routes: /barber/dashboard/, /barber/services/, /barber/appointments/, /partner/register/
      if (
        pathname === '/barber/dashboard' ||
        pathname.startsWith('/barber/') ||
        pathname === '/partner/register' ||
        pathname.startsWith('/partner/') ||
        params.get('page') === 'barber-dashboard'
      ) {
        setCurrentPage('barber-dashboard');
        return;
      }

      // 6. Customer Appointments & Account: /my-bookings/, /my-account/, /profile
      if (
        pathname === '/my-bookings' ||
        pathname === '/my-bookings/' ||
        pathname.includes('bookings') ||
        params.get('page') === 'customer-dashboard'
      ) {
        setCurrentPage('customer-dashboard');
        return;
      }
      if (
        pathname === '/my-account' ||
        pathname === '/my-account/' ||
        pathname === '/profile' ||
        pathname.includes('account') ||
        params.get('page') === 'profile'
      ) {
        setCurrentPage('profile');
        return;
      }

      // 7. App Administration: /admin or /admin-dashboard (strictly excluding /wp-admin)
      if (
        (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin-dashboard' || pathname === '/admin-dashboard/') &&
        !pathname.includes('wp-admin')
      ) {
        setCurrentPage('admin-dashboard');
        return;
      }
      if (params.get('page') === 'admin-dashboard') {
        setCurrentPage('admin-dashboard');
        return;
      }

      // 7b. Legal Pages: Privacy Policy & Terms of Service
      if (
        pathname === '/privacy-policy' ||
        pathname === '/privacy-policy/' ||
        pathname === '/privacy' ||
        params.get('page') === 'privacy-policy' ||
        params.get('page') === 'privacy'
      ) {
        setCurrentPage('privacy-policy');
        return;
      }
      if (
        pathname === '/terms-of-service' ||
        pathname === '/terms-of-service/' ||
        pathname === '/terms' ||
        params.get('page') === 'terms-of-service' ||
        params.get('page') === 'terms'
      ) {
        setCurrentPage('terms-of-service');
        return;
      }
      if (
        pathname === '/refund-policy' ||
        pathname === '/refund-policy/' ||
        pathname === '/cancellation-policy' ||
        pathname === '/cancellation-policy/' ||
        pathname === '/return-policy' ||
        pathname === '/return-policy/' ||
        params.get('page') === 'refund-policy' ||
        params.get('page') === 'cancellation-policy' ||
        params.get('page') === 'return-policy'
      ) {
        setCurrentPage('refund-policy');
        return;
      }
      if (
        pathname === '/disclaimer' ||
        pathname === '/disclaimer/' ||
        params.get('page') === 'disclaimer'
      ) {
        setCurrentPage('disclaimer');
        return;
      }
      if (
        pathname === '/about-us' ||
        pathname === '/about-us/' ||
        pathname === '/about' ||
        pathname === '/about/' ||
        params.get('page') === 'about-us' ||
        params.get('page') === 'about'
      ) {
        setCurrentPage('about-us');
        return;
      }
      if (
        pathname === '/contact-us' ||
        pathname === '/contact-us/' ||
        pathname === '/contact' ||
        pathname === '/contact/' ||
        params.get('page') === 'contact-us' ||
        params.get('page') === 'contact'
      ) {
        setCurrentPage('contact-us');
        return;
      }

      // 8. Homepage default
      if (pathname === '/' || pathname === '' || params.get('page') === 'home') {
        setCurrentPage('home');
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, [shops]);

  useEffect(() => {
    loadBootstrapState(activeUserUid);
  }, [activeUserUid, loadBootstrapState]);

  useEffect(() => {
    registerNotificationServiceWorker((targetPage) => {
      if (targetPage) {
        setCurrentPage(targetPage as PageView);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeUserUid) return;
    checkAndNotifyAppointmentReminders(activeUserUid, appointments, (page) =>
      setCurrentPage(page as PageView)
    );
  }, [activeUserUid, appointments]);

  useEffect(() => {
    if (!activeUserUid) return;
    checkAndNotifyDatabaseNotifications(activeUserUid, notifications, (page) =>
      setCurrentPage(page as PageView)
    );
  }, [activeUserUid, notifications]);

  const appointmentsRef = React.useRef(appointments);
  useEffect(() => {
    appointmentsRef.current = appointments;
  }, [appointments]);

  useEffect(() => {
    if (!activeUserUid) return;
    const stopTicker = startBackgroundReminderTicker(() => {
      checkAndNotifyAppointmentReminders(activeUserUid, appointmentsRef.current, (page) =>
        setCurrentPage(page as PageView)
      );
    });
    return stopTicker;
  }, [activeUserUid]);

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const disconnect = connectRealtimeSocket((event) => {
      if (event.type === 'state:updated') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          loadBootstrapState(activeUserUid);
        }, 1200);
      }
    });
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      disconnect();
    };
  }, [activeUserUid, loadBootstrapState]);

  useEffect(() => {
    // 1. Immediately restore session from dual storage (localStorage + Cookies) to prevent any UI flicker
    const persisted = getPersistedSupabaseUser();
    if (persisted && persisted.uid && persisted.email) {
      setActiveUserUid(persisted.uid);
      setCurrentUserProfile(persisted);
      apiSyncAuthUser({
        uid: persisted.uid,
        email: persisted.email,
        name: persisted.name,
        role: persisted.role,
        phone: persisted.phone,
      })
        .then((synced) => {
          if (synced?.profile) {
            setCurrentUserProfile(synced.profile);
            setPersistedSupabaseUser(
              {
                ...persisted,
                ...synced.profile,
              },
              persisted.token
            );
          }
        })
        .catch(() => {
          // ignore transient sync error
        });
    }

    // 2. Validate session with Supabase Auth server
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.warn('[Supabase Auth] Session check notice:', error.message);
      }
      const supaUser = data?.session?.user;
      const accessToken = data?.session?.access_token;
      if (supaUser && supaUser.email) {
        const sessionPayload = {
          uid: supaUser.id,
          email: supaUser.email,
          name:
            supaUser.user_metadata?.full_name ||
            supaUser.email.split('@')[0],
          role: supaUser.user_metadata?.role || 'customer',
          phone: supaUser.user_metadata?.phone || '',
          token: accessToken,
        };
        setActiveUserUid(supaUser.id);
        setPersistedSupabaseUser(sessionPayload, accessToken);

        apiSyncAuthUser(sessionPayload)
          .then((synced) => {
            if (synced?.profile) {
              setCurrentUserProfile(synced.profile);
              setPersistedSupabaseUser(
                {
                  ...sessionPayload,
                  ...synced.profile,
                },
                accessToken
              );
            }
          })
          .catch(() => {});
      } else if (!persisted) {
        // No session found anywhere
        setActiveUserUid('');
        setCurrentUserProfile(null);
      }
    });

    // 3. Listen to all Supabase Auth lifecycle events (Login, Refresh, Logout, Token Rotation)
    const { data: supaAuthListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setActiveUserUid('');
          setCurrentUserProfile(null);
          setPersistedSupabaseUser(null);
          return;
        }

        const supaUser = session?.user;
        const accessToken = session?.access_token;
        if (supaUser && supaUser.email) {
          const sessionPayload = {
            uid: supaUser.id,
            email: supaUser.email,
            name:
              supaUser.user_metadata?.full_name ||
              supaUser.email.split('@')[0],
            role: supaUser.user_metadata?.role || 'customer',
            phone: supaUser.user_metadata?.phone || '',
            token: accessToken,
          };
          setActiveUserUid(supaUser.id);
          setPersistedSupabaseUser(sessionPayload, accessToken);

          try {
            const synced = await apiSyncAuthUser(sessionPayload);
            if (synced?.profile) {
              setCurrentUserProfile(synced.profile);
              setPersistedSupabaseUser(
                {
                  ...sessionPayload,
                  ...synced.profile,
                },
                accessToken
              );
            }
          } catch {
            // ignore transient sync error
          }
        }
      }
    );

    return () => {
      supaAuthListener.subscription.unsubscribe();
    };
  }, []);

  const hasCompletedAppointment = Boolean(
    activeUserUid &&
      appointments.some(
        (a) =>
          String(a.status).toLowerCase() === 'completed' &&
          a.customerUid === activeUserUid
      )
  );

  // Real Auth Sync Handler
  const handleAuthChange = async (userPayload: any | null) => {
    if (!userPayload) {
      setActiveUserUid('');
      setCurrentUserProfile(null);
      setPersistedSupabaseUser(null);
      return;
    }
    try {
      setPersistedSupabaseUser(userPayload, userPayload.token);
      setActiveUserUid(userPayload.uid);
      setCurrentUserProfile(userPayload);
      const synced = await apiSyncAuthUser({
        uid: userPayload.uid,
        email: userPayload.email,
        name: userPayload.name,
        role: userPayload.role,
        phone: userPayload.phone,
      });
      const profile = synced?.profile;
      if (profile) {
        setCurrentUserProfile(profile);
        setPersistedSupabaseUser(
          { ...userPayload, ...profile },
          userPayload.token
        );
        await loadBootstrapState(userPayload.uid);

        const isCurrentlyInBooking =
          currentPage === 'booking' ||
          window.location.pathname.toLowerCase().includes('booking') ||
          new URLSearchParams(window.location.search).get('page') === 'booking' ||
          Boolean(new URLSearchParams(window.location.search).get('shop_id'));

        if (isCurrentlyInBooking) {
          setCurrentPage('booking');
        } else if (profile.role === 'admin') {
          setCurrentPage('admin-dashboard');
        } else if (
          profile.role === 'barber' ||
          profile.role === 'shop_owner'
        ) {
          setCurrentPage('barber-dashboard');
        } else {
          setCurrentPage('customer-dashboard');
        }
      }
    } catch {
      // ignore auth sync error
    }
  };

  // Appointment handlers
  const handleConfirmBooking = async (newAptPayload: any) => {
    if (!activeUserUid) {
      setAuthModalOpen(true);
      throw new Error('Please sign in to confirm your appointment.');
    }
    if (currentUserProfile?.role === 'barber' || currentUserProfile?.role === 'shop_owner') {
      throw new Error(
        'Barber accounts cannot create bookings. Appointments can only be booked by customer accounts.'
      );
    }
    if (getBrowserNotificationPermission() === 'default') {
      requestBrowserNotificationPermission().catch(() => {});
    }
    const created = await apiCreateAppointment({
      ...newAptPayload,
      customerUid: activeUserUid,
    });
    await loadBootstrapState(activeUserUid);
    return created;
  };

  const handleCancelAppointment = async (id: string) => {
    await apiUpdateAppointment(id, { status: 'cancelled' });
    await loadBootstrapState(activeUserUid);
  };

  const handleRescheduleAppointment = async (
    id: string,
    date: string,
    time: string
  ) => {
    await apiUpdateAppointment(id, {
      date,
      time,
      status: 'confirmed',
    });
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateAppointment = async (id: string, updates: any) => {
    await apiUpdateAppointment(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  // Favorites, Reviews, Rewards, Notifications, Profile handlers
  const handleToggleFavorite = async (
    targetType: 'shop' | 'barber',
    targetId: string
  ) => {
    if (!activeUserUid) {
      setAuthModalOpen(true);
      return;
    }
    const updatedFavs = await apiToggleFavorite(
      targetType,
      targetId,
      activeUserUid
    );
    setFavorites(updatedFavs);
  };

  const handleSubmitReview = async (payload: any) => {
    if (!activeUserUid) {
      setAuthModalOpen(true);
      return;
    }
    await apiCreateReview({
      ...payload,
      customerUid: activeUserUid,
    });
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateReview = async (id: string, updates: any) => {
    await apiUpdateReview(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleSubmitReport = async (payload: any) => {
    if (!activeUserUid) {
      setAuthModalOpen(true);
      return;
    }
    await apiCreateReport({
      ...payload,
      reporterUid: activeUserUid,
      reporterName: currentUserProfile?.name || 'Verified User',
    });
    await loadBootstrapState(activeUserUid);
  };

  const handleMarkNotificationsRead = async () => {
    if (!activeUserUid) return;
    await apiMarkNotificationsRead(activeUserUid);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateCurrentUserProfile = async (updates: any) => {
    if (!activeUserUid) return;
    const updated = await apiUpdateProfile(activeUserUid, updates);
    setCurrentUserProfile(updated);
    await loadBootstrapState(activeUserUid);
  };

  // Barber & Admin Management handlers
  const handleCreateService = async (payload: any) => {
    await apiCreateService(payload);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateService = async (id: string, updates: any) => {
    await apiUpdateService(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleDeleteService = async (id: string) => {
    await apiDeleteService(id);
    await loadBootstrapState(activeUserUid);
  };

  const handleCreateBarber = async (payload: any) => {
    await apiCreateBarber(payload);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateBarber = async (id: string, updates: any) => {
    await apiUpdateBarber(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleDeleteBarber = async (id: string) => {
    await apiDeleteBarber(id);
    await loadBootstrapState(activeUserUid);
  };

  const handleCreateShop = async (payload: any) => {
    await apiCreateShop({
      ...payload,
      ownerUid: activeUserUid,
    });
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateShop = async (id: string, updates: any) => {
    await apiUpdateShop(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateWorkingHours = async (id: string, updates: any) => {
    await apiUpdateWorkingHours(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleAdminUpdateProfile = async (uid: string, updates: any) => {
    await apiUpdateProfile(uid, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleCreateCoupon = async (payload: any) => {
    await apiCreateCoupon(payload);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateCoupon = async (id: string, updates: any) => {
    await apiUpdateCoupon(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdateReport = async (id: string, updates: any) => {
    await apiUpdateReport(id, updates);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdatePayment = async (id: string, status: string) => {
    await apiUpdatePayment(id, status);
    await loadBootstrapState(activeUserUid);
  };

  const handleUpdatePlatformFee = async (payload: {
    feeType?: string;
    feeAmount?: number;
    minFee?: number;
    refundPolicy?: string;
  }) => {
    const updated = await apiUpdatePlatformFee(payload);
    if (updated) {
      setPlatformSettings((prev) => ({ ...prev, ...updated }));
    }
    await loadBootstrapState(activeUserUid);
    return updated;
  };

  const handleCreateShopGalleryItem = async (payload: any) => {
    await apiCreateShopGalleryItem(payload);
    await loadBootstrapState(activeUserUid);
  };

  const handleCreateBarberGalleryItem = async (payload: any) => {
    await apiCreateBarberGalleryItem(payload);
    await loadBootstrapState(activeUserUid);
  };

  const handleBroadcastShopNotification = async (payload: {
    shopName: string;
    message: string;
    targetRole?: 'customer' | 'barber' | 'all' | 'specific';
    specificUid?: string;
  }) => {
    const res = await apiBroadcastShopNotification(payload);
    await loadBootstrapState(activeUserUid);
    return res;
  };

  const userRole = currentUserProfile?.role || null;
  const isOwnerAdmin = userRole === 'admin';
  const canAccessBarberConsole =
    isOwnerAdmin || userRole === 'barber' || userRole === 'shop_owner';
  const canAccessCustomerPortal = Boolean(currentUserProfile);

  const renderRoleGuard = (title: string, message: string) => (
    <div className="min-h-[75vh] bg-[#FAF6EA] flex items-center justify-center px-5 py-16">
      <div className="max-w-md w-full rounded-[24px] bg-[#111113] text-[#FFF9E8] border border-[#F1E194]/30 p-8 text-center space-y-5 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-[#5B0E14] text-[#F1E194] flex items-center justify-center mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="font-display text-3xl font-bold">{title}</h2>
        <p className="text-xs text-[#8A8178] leading-relaxed">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="flex-1 py-3.5 px-5 rounded-[14px] bg-[#F1E194] text-[#111113] text-xs font-semibold tracking-wider uppercase cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In / Sign Up</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('home')}
            className="py-3.5 px-5 rounded-[14px] border border-[#F1E194]/25 text-xs font-semibold tracking-wider uppercase cursor-pointer"
          >
            Back Home
          </button>
        </div>
      </div>
    </div>
  );

  const handleNavigate = (page: PageView, targetShop?: any) => {
    if (page === 'shop') {
      if (targetShop !== undefined && targetShop !== null) {
        let resolved = targetShop;
        if (typeof targetShop === 'string') {
          resolved = findShopBySlugOrId(shops, targetShop) || { id: targetShop };
        }
        setSelectedShop(resolved);
        const slug = getShopSlug(resolved);
        window.history.pushState(
          {},
          '',
          slug ? `/shop/${slug}/` : `/shop/${encodeURIComponent(resolved?.id || '')}/`
        );
      } else {
        setSelectedShop(null); // Clicking Shops in Nav shows the full Shop List
        window.history.pushState({}, '', '/shops/');
      }
    } else if (page === 'booking') {
      const target = targetShop || selectedShop;
      if (targetShop) {
        let resolved = targetShop;
        if (typeof targetShop === 'string') {
          resolved = findShopBySlugOrId(shops, targetShop) || { id: targetShop };
        }
        setSelectedShop(resolved);
      }
      const slug = getShopSlug(target);
      const url = slug
        ? `/book-appointment/?shop=${encodeURIComponent(slug)}`
        : '/book-appointment/';
      window.history.pushState({}, '', url);
    } else if (page === 'home') {
      window.history.pushState({}, '', '/');
    } else if (page === 'customer-dashboard') {
      window.history.pushState({}, '', '/my-bookings/');
    } else if (page === 'profile') {
      window.history.pushState({}, '', '/my-account/');
    } else if (page === 'barber-dashboard') {
      window.history.pushState({}, '', '/barber/dashboard/');
    } else if (page === 'admin-dashboard') {
      window.history.pushState({}, '', '/admin-dashboard/');
    } else if (page === 'privacy-policy') {
      window.history.pushState({}, '', '/privacy-policy');
    } else if (page === 'terms-of-service') {
      window.history.pushState({}, '', '/terms-of-service');
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectShop = (shop: any) => {
    let resolvedShop = shop;
    if (typeof shop === 'string') {
      resolvedShop = findShopBySlugOrId(shops, shop) || { id: shop };
    }
    setSelectedShop(resolvedShop);
    setCurrentPage('shop');
    const slug = getShopSlug(resolvedShop);
    window.history.pushState(
      {},
      '',
      slug ? `/shop/${slug}/` : `/shop/${encodeURIComponent(resolvedShop?.id || '')}/`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col bg-[#EFE9DD] text-[#111113] selection:bg-[#5B0E14] selection:text-[#FFF9E8]">
        <Navbar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          currentUserProfile={currentUserProfile}
          onAuthChange={handleAuthChange}
          authModalOpenExternal={authModalOpen}
          onSetAuthModalOpenExternal={setAuthModalOpen}
        />

        <main className="flex-1 pb-20 lg:pb-0">
          {currentPage === 'home' && (
            <HomePage
              onNavigate={handleNavigate}
              onSelectServiceForBooking={(srv) => setBookingService(srv)}
              onSelectBarberForBooking={(brb) => setBookingBarber(brb)}
              onSelectShop={handleSelectShop}
              shops={shops}
              barbers={barbers}
              services={services}
              reviews={reviews}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              currentUserProfile={currentUserProfile}
            />
          )}

          {currentPage === 'shop' && (
            <ShopPage
              shop={selectedShop}
              onSelectShop={handleSelectShop}
              onNavigate={handleNavigate}
              onSelectServiceForBooking={(srv) => setBookingService(srv)}
              onSelectBarberForBooking={(brb) => setBookingBarber(brb)}
              shops={shops}
              services={services}
              barbers={barbers}
              reviews={reviews}
              workingHours={workingHours}
              shopGallery={shopGallery}
              barberGallery={barberGallery}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onSubmitReview={handleSubmitReview}
              onUpdateReview={handleUpdateReview}
              onSubmitReport={handleSubmitReport}
              hasCompletedAppointment={hasCompletedAppointment}
              currentUserProfile={currentUserProfile}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              platformSettings={platformSettings}
            />
          )}

          {currentPage === 'booking' &&
            (userRole === 'barber' || userRole === 'shop_owner' ? (
              renderRoleGuard(
                'Barber Account Detected',
                'Barber accounts cannot create bookings. Appointments can only be scheduled by customers. Please use your Barber Console to manage appointments, or sign in with a Customer account.'
              )
            ) : (
              <BookingPage
                initialService={bookingService}
                initialBarber={bookingBarber}
                initialShop={selectedShop}
                initialShopId={selectedShop?.id}
                onSelectShop={(shop) => setSelectedShop(shop)}
                onConfirmBooking={handleConfirmBooking}
                onNavigate={handleNavigate}
                shops={shops}
                services={services}
                barbers={barbers}
                coupons={coupons}
                appointments={appointments}
                workingHours={workingHours}
                currentUserProfile={currentUserProfile}
                platformSettings={platformSettings}
                onOpenAuthModal={() => setAuthModalOpen(true)}
              />
            ))}

          {(currentPage === 'customer-dashboard' || currentPage === 'profile') &&
            (canAccessCustomerPortal ? (
              <CustomerDashboard
                initialSection={currentPage === 'profile' ? 'profile' : 'bookings'}
                appointments={appointments.filter(
                  (a) => a.customerUid === activeUserUid
                )}
                onCancelAppointment={handleCancelAppointment}
                onRescheduleAppointment={handleRescheduleAppointment}
                onNavigate={handleNavigate}
                onSelectServiceForBooking={(srv) => setBookingService(srv)}
                onSelectBarberForBooking={(brb) => setBookingBarber(brb)}
                onSelectShop={handleSelectShop}
                barbers={barbers}
                shops={shops}
                services={services}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                notifications={notifications}
                onMarkNotificationsRead={handleMarkNotificationsRead}
                currentUserProfile={currentUserProfile}
                onUpdateProfile={handleUpdateCurrentUserProfile}
                payments={payments}
                reviews={reviews}
                onSubmitReview={handleSubmitReview}
                onUpdateReview={handleUpdateReview}
                platformSettings={platformSettings}
              />
            ) : (
              renderRoleGuard(
                'Customer Account Required',
                'Please sign in or sign up as a Customer to view your appointments and saved favorites.'
              )
            ))}

          {currentPage === 'barber-dashboard' &&
            (canAccessBarberConsole ? (
              <BarberDashboard
                appointments={appointments}
                onUpdateAppointment={handleUpdateAppointment}
                services={services}
                onCreateService={handleCreateService}
                onUpdateService={handleUpdateService}
                onDeleteService={handleDeleteService}
                barbers={barbers}
                onCreateBarber={handleCreateBarber}
                onUpdateBarber={handleUpdateBarber}
                onDeleteBarber={handleDeleteBarber}
                shops={shops}
                onCreateShop={handleCreateShop}
                onUpdateShop={handleUpdateShop}
                workingHours={workingHours}
                onUpdateWorkingHours={handleUpdateWorkingHours}
                reviews={reviews}
                currentUserProfile={currentUserProfile}
                coupons={coupons}
                onCreateCoupon={handleCreateCoupon}
                onUpdateCoupon={handleUpdateCoupon}
                shopGallery={shopGallery}
                onCreateShopGalleryItem={handleCreateShopGalleryItem}
                barberGallery={barberGallery}
                onCreateBarberGalleryItem={handleCreateBarberGalleryItem}
                onBroadcastShopNotification={handleBroadcastShopNotification}
                notifications={notifications}
                onMarkNotificationsRead={handleMarkNotificationsRead}
                profiles={profiles}
                platformSettings={platformSettings}
              />
            ) : (
              renderRoleGuard(
                'Barber Partner Access Only',
                'Only registered Barber & Salon Partner accounts can access the Barber Console. Sign up as a Barber to register your shop and services.'
              )
            ))}

          {currentPage === 'admin-dashboard' &&
            (isOwnerAdmin ? (
              <AdminDashboard
                appointments={appointments}
                shops={shops}
                barbers={barbers}
                profiles={profiles}
                coupons={coupons}
                payments={payments}
                reviews={reviews}
                reports={reports}
                platformSettings={platformSettings}
                onUpdatePlatformFee={handleUpdatePlatformFee}
                onUpdateShop={handleUpdateShop}
                onUpdateBarber={handleUpdateBarber}
                onUpdateProfile={handleAdminUpdateProfile}
                onCreateCoupon={handleCreateCoupon}
                onUpdateCoupon={handleUpdateCoupon}
                onUpdateReview={handleUpdateReview}
                onUpdateReport={handleUpdateReport}
                onUpdatePayment={handleUpdatePayment}
                onBroadcastNotification={handleBroadcastShopNotification}
              />
            ) : (
              renderRoleGuard(
                'Admin Access Only',
                'The Platform Admin Console is restricted exclusively to authorized administrators.'
              )
            ))}

          {currentPage === 'privacy-policy' && (
            <PrivacyPolicyPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'terms-of-service' && (
            <TermsOfServicePage onNavigate={handleNavigate} />
          )}

          {currentPage === 'refund-policy' && (
            <RefundPolicyPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'disclaimer' && (
            <DisclaimerPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'about-us' && (
            <AboutUsPage onNavigate={handleNavigate} />
          )}

          {currentPage === 'contact-us' && (
            <ContactUsPage
              onNavigate={handleNavigate}
              currentUserProfile={currentUserProfile}
            />
          )}
        </main>

        <EasyBar
          onNavigate={handleNavigate}
          currentPage={currentPage}
          activeUserUid={activeUserUid}
          hasActiveAppointments={appointments.some(
            (a) =>
              a.customerUid === activeUserUid &&
              (a.status === 'confirmed' || a.status === 'in_progress')
          )}
        />

        <Footer onNavigate={handleNavigate} />
      </div>
    </LanguageProvider>
  );
}
