/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BarberItem,
  OPENING_HOURS,
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
} from './lib/supabase';
import { LanguageProvider } from './lib/i18n';
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
  const [workingHours, setWorkingHours] = useState<any[]>(OPENING_HOURS);
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
      const isBookingPath =
        pathname.includes('booking') ||
        params.get('page') === 'booking' ||
        (Boolean(params.get('shop_id')) && params.get('page') !== 'shop');

      if (isBookingPath) {
        setCurrentPage('booking');
      } else if (params.get('page') === 'shop' || params.get('shop')) {
        setCurrentPage('shop');
      } else if (
        pathname.includes('admin') ||
        params.get('page') === 'admin-dashboard'
      ) {
        setCurrentPage('admin-dashboard');
      } else if (
        pathname.includes('barber') ||
        params.get('page') === 'barber-dashboard'
      ) {
        setCurrentPage('barber-dashboard');
      } else if (
        pathname.includes('profile') ||
        params.get('page') === 'profile'
      ) {
        setCurrentPage('profile');
      } else if (
        pathname.includes('account') ||
        pathname.includes('bookings') ||
        params.get('page') === 'customer-dashboard'
      ) {
        setCurrentPage('customer-dashboard');
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

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

  useEffect(() => {
    if (!activeUserUid) return;
    const stopTicker = startBackgroundReminderTicker(() => {
      loadBootstrapState(activeUserUid);
      checkAndNotifyAppointmentReminders(activeUserUid, appointments, (page) =>
        setCurrentPage(page as PageView)
      );
    });
    return stopTicker;
  }, [activeUserUid, appointments, loadBootstrapState]);

  useEffect(() => {
    const disconnect = connectRealtimeSocket((event) => {
      if (event.type === 'state:updated') {
        loadBootstrapState(activeUserUid);
      }
    });
    return disconnect;
  }, [activeUserUid, loadBootstrapState]);

  useEffect(() => {
    // 1. Restore persisted Supabase user or active Supabase Auth session
    const persisted = getPersistedSupabaseUser();
    if (persisted && persisted.uid && persisted.email) {
      setActiveUserUid(persisted.uid);
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
          }
        })
        .catch(() => {
          // ignore transient sync error
        });
    } else {
      supabase.auth.getSession().then(({ data }) => {
        const supaUser = data?.session?.user;
        if (supaUser && supaUser.email) {
          apiSyncAuthUser({
            uid: supaUser.id,
            email: supaUser.email,
            name:
              supaUser.user_metadata?.full_name ||
              supaUser.email.split('@')[0],
            role: supaUser.user_metadata?.role,
            phone: supaUser.user_metadata?.phone,
          })
            .then((synced) => {
              setActiveUserUid(supaUser.id);
              if (synced?.profile) {
                setCurrentUserProfile(synced.profile);
              }
            })
            .catch(() => {
              // ignore transient sync error
            });
        }
      });
    }

    const { data: supaAuthListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const supaUser = session?.user;
        if (supaUser && supaUser.email) {
          try {
            const synced = await apiSyncAuthUser({
              uid: supaUser.id,
              email: supaUser.email,
              name:
                supaUser.user_metadata?.full_name ||
                supaUser.email.split('@')[0],
              role: supaUser.user_metadata?.role,
              phone: supaUser.user_metadata?.phone,
            });
            setActiveUserUid(supaUser.id);
            if (synced?.profile) {
              setCurrentUserProfile(synced.profile);
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
      return;
    }
    try {
      const synced = await apiSyncAuthUser({
        uid: userPayload.uid,
        email: userPayload.email,
        name: userPayload.name,
        role: userPayload.role,
        phone: userPayload.phone,
      });
      const profile = synced?.profile;
      setActiveUserUid(userPayload.uid);
      if (profile) {
        setCurrentUserProfile(profile);
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

  const handleNavigate = (page: PageView) => {
    if (page === 'shop') {
      setSelectedShop(null); // Clicking Shops ALWAYS shows the Shop List! (Section 8)
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen flex flex-col bg-[#FAF6EA] text-[#111113]">
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
              onSelectShop={(shop) => setSelectedShop(shop)}
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
              onSelectShop={(shop) => setSelectedShop(shop)}
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

          {currentPage === 'booking' && (
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
          )}

          {(currentPage === 'customer-dashboard' || currentPage === 'profile') &&
            (canAccessCustomerPortal ? (
              <CustomerDashboard
                initialSection={currentPage === 'profile' ? 'profile' : 'bookings'}
                appointments={appointments.filter(
                  (a) => a.customerUid === activeUserUid
                )}
                onCancelAppointment={handleCancelAppointment}
                onRescheduleAppointment={handleRescheduleAppointment}
                onNavigate={setCurrentPage}
                onSelectServiceForBooking={(srv) => setBookingService(srv)}
                onSelectBarberForBooking={(brb) => setBookingBarber(brb)}
                onSelectShop={(shop) => setSelectedShop(shop)}
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
        </main>

        <Footer onNavigate={setCurrentPage} />
      </div>
    </LanguageProvider>
  );
}
