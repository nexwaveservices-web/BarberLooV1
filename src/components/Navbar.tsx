import React, { useState } from 'react';
import { PageView } from '../data/barberlooData';
import {
  Menu,
  X,
  LogIn,
  LogOut,
  KeyRound,
  Languages,
  User,
  Scissors,
  ShieldCheck,
} from 'lucide-react';
import {
  OWNER_ADMIN_EMAIL,
  supabaseSignUpUser,
  supabaseSignInUser,
  supabaseResetPassword,
  supabaseSignOut,
} from '../lib/supabase';
import { useLanguage } from '../lib/i18n';

interface NavbarProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  currentUserProfile?: any | null;
  onAuthChange?: (profilePayload: any | null) => Promise<void> | void;
  authModalOpenExternal?: boolean;
  onSetAuthModalOpenExternal?: (open: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  currentUserProfile,
  onAuthChange,
  authModalOpenExternal,
  onSetAuthModalOpenExternal,
}) => {
  const { lang, setLang, tr } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [internalAuthOpen, setInternalAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [signupAccountType, setSignupAccountType] = useState<'customer' | 'barber'>(
    'customer'
  );
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const authModalOpen =
    authModalOpenExternal !== undefined ? authModalOpenExternal : internalAuthOpen;

  const setAuthModalOpen = (open: boolean) => {
    setInternalAuthOpen(open);
    if (onSetAuthModalOpenExternal) {
      onSetAuthModalOpenExternal(open);
    }
  };

  const isDarkTheme =
    currentPage === 'barber-dashboard' ||
    currentPage === 'admin-dashboard';

  const userRole = currentUserProfile?.role || null;
  const isOwnerAdmin =
    currentUserProfile?.email?.toLowerCase() === OWNER_ADMIN_EMAIL ||
    userRole === 'admin';

  // Strictly role-gated navigation items
  const navItems: { id: PageView; label: string }[] = [
    { id: 'home', label: tr('Home', 'होम') },
    { id: 'shop', label: tr('Shops', 'सैलून') },
    { id: 'booking', label: tr('Book Appointment', 'अपॉइंटमेंट बुक करें') },
  ];

  if (currentUserProfile) {
    if (isOwnerAdmin) {
      navItems.push({
        id: 'admin-dashboard',
        label: tr('Admin Console', 'एडमिन कंसोल'),
      });
      navItems.push({
        id: 'barber-dashboard',
        label: tr('Barber Console', 'बार्बर कंसोल'),
      });
    } else if (userRole === 'barber' || userRole === 'shop_owner') {
      navItems.push({
        id: 'barber-dashboard',
        label: tr('Barber Console', 'बार्बर कंसोल'),
      });
    } else {
      navItems.push({
        id: 'customer-dashboard',
        label: tr('My Account', 'मेरा खाता'),
      });
    }
  }

  const handleSelectPage = (page: PageView) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthMessage('');

    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) return;

    if (authMode === 'reset') {
      setAuthBusy(true);
      try {
        await supabaseResetPassword(cleanEmail, passwordInput || undefined);
        setAuthMessage(
          passwordInput && passwordInput.length >= 6
            ? tr(
                `Password updated for ${cleanEmail}. Switching to Login...`,
                `${cleanEmail} के लिए पासवर्ड अपडेट हो गया है। अब लॉगिन करें।`
              )
            : tr(
                `Password reset instructions sent to ${cleanEmail}.`,
                `पासवर्ड रीसेट लिंक ${cleanEmail} पर भेज दिया गया है।`
              )
        );
        if (passwordInput && passwordInput.length >= 6) {
          setTimeout(() => {
            setAuthMode('login');
          }, 1200);
        }
      } catch (err: any) {
        setAuthError(
          err?.message ||
            tr('Unable to reset password.', 'पासवर्ड रीसेट करने में असमर्थ।')
        );
      } finally {
        setAuthBusy(false);
      }
      return;
    }

    setAuthBusy(true);
    try {
      if (authMode === 'signup') {
        const assignedRole =
          cleanEmail === OWNER_ADMIN_EMAIL ? 'admin' : signupAccountType;

        const supaUser = await supabaseSignUpUser(cleanEmail, passwordInput, {
          name:
            nameInput.trim() ||
            (cleanEmail === OWNER_ADMIN_EMAIL
              ? 'Founder Admin'
              : cleanEmail.split('@')[0]),
          phone: phoneInput.trim() || '+91',
          role: assignedRole,
        });

        if (onAuthChange) {
          await onAuthChange({
            uid: supaUser.uid,
            email: supaUser.email,
            name: supaUser.name,
            phone: supaUser.phone,
            role: assignedRole,
          });
        }
      } else {
        const supaUser = await supabaseSignInUser(cleanEmail, passwordInput);
        if (onAuthChange) {
          await onAuthChange({
            uid: supaUser.uid,
            email: supaUser.email,
            name: supaUser.name,
            phone: supaUser.phone,
            role: cleanEmail === OWNER_ADMIN_EMAIL ? 'admin' : supaUser.role,
          });
        }
      }
      setAuthModalOpen(false);
      setPasswordInput('');
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'user-not-found') {
        setAuthMode('signup');
        setAuthMessage(
          tr(
            'New email detected — please select Customer or Barber below, enter your name, and click Create Account.',
            'यह ईमेल नया है — कृपया नीचे ग्राहक या बार्बर चुनें, अपना नाम दर्ज करें और नया खाता बनाएं।'
          )
        );
      } else if (code.includes('invalid-credential') || code.includes('wrong-password')) {
        setAuthError(
          tr(
            'Incorrect password for this email. Please try again or use Forgot Pass to set a new password.',
            'अमान्य पासवर्ड। कृपया पुनः प्रयास करें या पासवर्ड रीसेट करें।'
          )
        );
      } else if (code.includes('email-already-in-use')) {
        setAuthMode('login');
        setAuthError(
          tr(
            'This email is already registered. Switched to Login — please enter your password.',
            'यह ईमेल पहले से पंजीकृत है। कृपया अपना पासवर्ड दर्ज करके लॉगिन करें।'
          )
        );
      } else {
        setAuthError(
          err?.message ||
            tr('Authentication failed. Please try again.', 'प्रमाणीकरण विफल रहा।')
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabaseSignOut();
    } catch {
      // ignore signOut error
    }
    if (onAuthChange) {
      await onAuthChange(null);
    }
    handleSelectPage('home');
  };

  const openDashboardForRole = () => {
    if (!currentUserProfile) {
      setAuthModalOpen(true);
      return;
    }
    if (isOwnerAdmin) {
      handleSelectPage('admin-dashboard');
    } else if (userRole === 'barber' || userRole === 'shop_owner') {
      handleSelectPage('barber-dashboard');
    } else {
      handleSelectPage('customer-dashboard');
    }
  };

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-colors duration-200 border-b ${
          isDarkTheme
            ? 'bg-[#111113]/95 border-[#F1E194]/15 text-[#FFF9E8]'
            : 'bg-[#FAF6EA]/95 border-[#5B0E14]/12 text-[#111113]'
        } backdrop-blur-md`}
      >
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleSelectPage('home')}
            className="font-display text-2xl sm:text-[28px] font-bold tracking-[0.14em] whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B0E14] cursor-pointer"
          >
            BARBERLOO
          </button>

          {/* Zone 2: Clean primary navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPage(item.id)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer ${
                    isDarkTheme
                      ? isActive
                        ? 'text-[#F1E194]'
                        : 'text-[#FFF9E8]/75 hover:text-[#FFF9E8]'
                      : isActive
                      ? 'text-[#5B0E14] font-semibold'
                      : 'text-[#111113]/75 hover:text-[#111113]'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute left-0 right-0 -bottom-0.5 h-[1.5px] transition-transform duration-200 origin-left ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    } ${isDarkTheme ? 'bg-[#F1E194]' : 'bg-[#5B0E14]'}`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Language Toggle + Real Auth Account Status */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Hindi / English Language Toggle */}
            <div
              role="group"
              aria-label="Language switcher"
              className={`inline-flex items-center p-0.5 rounded-[14px] border text-xs font-semibold transition-colors ${
                isDarkTheme
                  ? 'bg-[#241719] border-[#F1E194]/25 text-[#FFF9E8]'
                  : 'bg-[#E9D9B8]/45 border-[#5B0E14]/20 text-[#241719]'
              }`}
            >
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2.5 py-1.5 rounded-[11px] transition-all cursor-pointer ${
                  lang === 'en'
                    ? isDarkTheme
                      ? 'bg-[#F1E194] text-[#111113] shadow-xs'
                      : 'bg-[#5B0E14] text-[#FFF9E8] shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('hi')}
                className={`px-2.5 py-1.5 rounded-[11px] transition-all cursor-pointer ${
                  lang === 'hi'
                    ? isDarkTheme
                      ? 'bg-[#F1E194] text-[#111113] shadow-xs'
                      : 'bg-[#5B0E14] text-[#FFF9E8] shadow-xs'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                हिंदी
              </button>
            </div>

            {currentUserProfile ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={openDashboardForRole}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-[18px] border transition-colors cursor-pointer ${
                    isDarkTheme
                      ? 'border-[#F1E194]/30 text-[#F1E194] hover:bg-[#241719]'
                      : 'border-[#5B0E14]/25 text-[#241719] hover:bg-[#E9D9B8]/60'
                  }`}
                >
                  {isOwnerAdmin ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-[#F1E194]" />
                  ) : userRole === 'barber' ? (
                    <Scissors className="w-3.5 h-3.5" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                  <span className="max-w-[120px] truncate">
                    {currentUserProfile.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider opacity-75">
                    (
                    {isOwnerAdmin
                      ? tr('Admin', 'एडमिन')
                      : userRole === 'barber'
                      ? tr('Barber', 'बार्बर')
                      : tr('Customer', 'ग्राहक')}
                    )
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  title={tr('Sign Out', 'लॉग आउट')}
                  className={`p-2.5 rounded-[14px] border transition-colors cursor-pointer ${
                    isDarkTheme
                      ? 'border-[#F1E194]/20 text-[#8A8178] hover:text-[#FFF9E8]'
                      : 'border-[#5B0E14]/15 text-[#8A8178] hover:text-[#5B0E14]'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setAuthModalOpen(true);
                }}
                className={`hidden sm:inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold tracking-wider rounded-[18px] border transition-colors cursor-pointer ${
                  isDarkTheme
                    ? 'border-[#F1E194]/30 text-[#F1E194] hover:bg-[#241719]'
                    : 'border-[#5B0E14]/25 text-[#241719] hover:bg-[#E9D9B8]/60'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{tr('Sign In / Join', 'साइन इन / जुड़ें')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelectPage('booking')}
              className={`px-4 sm:px-5 py-2.5 text-xs font-semibold tracking-[0.12em] rounded-[18px] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                isDarkTheme
                  ? 'bg-[#F1E194] text-[#111113] hover:bg-[#FFF9E8]'
                  : 'bg-[#5B0E14] text-[#FFF9E8] hover:bg-[#241719]'
              }`}
            >
              {tr('BOOK NOW', 'बुक करें')}
            </button>

            <button
              type="button"
              aria-label="Toggle Menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-lg focus-visible:outline-2"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            className={`lg:hidden border-t px-5 py-5 space-y-4 ${
              isDarkTheme
                ? 'bg-[#111113] border-[#F1E194]/15 text-[#FFF9E8]'
                : 'bg-[#FAF6EA] border-[#5B0E14]/15 text-[#111113]'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#8A8178]/20">
              <span className="text-xs font-semibold text-[#8A8178] inline-flex items-center gap-1.5">
                <Languages className="w-3.5 h-3.5" />
                {tr('Language • INR (₹) • IST', 'भाषा • भारतीय रुपया (₹) • IST')}
              </span>
              <div className="inline-flex gap-1">
                <button
                  type="button"
                  onClick={() => setLang('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    lang === 'en'
                      ? 'bg-[#5B0E14] text-[#FFF9E8]'
                      : 'bg-[#E9D9B8]/40 text-[#8A8178]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang('hi')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    lang === 'hi'
                      ? 'bg-[#5B0E14] text-[#FFF9E8]'
                      : 'bg-[#E9D9B8]/40 text-[#8A8178]'
                  }`}
                >
                  हिंदी
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectPage(item.id)}
                  className={`px-3.5 py-2.5 text-left text-xs font-semibold rounded-[14px] whitespace-nowrap truncate ${
                    currentPage === item.id
                      ? 'bg-[#5B0E14] text-[#FFF9E8]'
                      : isDarkTheme
                      ? 'bg-[#241719] text-[#FFF9E8]/80'
                      : 'bg-[#E9D9B8]/60 text-[#111113]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-[#8A8178]/20">
              {currentUserProfile ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <p className="font-semibold">{currentUserProfile.name}</p>
                    <p className="text-[11px] text-[#8A8178]">
                      {currentUserProfile.email} · {currentUserProfile.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2 rounded-[12px] bg-[#5B0E14] text-[#FFF9E8] text-xs font-semibold"
                  >
                    {tr('Sign Out', 'लॉग आउट')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAuthModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-[14px] bg-[#241719] text-[#F1E194] text-xs font-semibold"
                >
                  {tr('Sign In / Create Account', 'साइन इन / नया खाता बनाएं')}
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Real Supabase Authentication Modal (Customer, Barber & Owner Admin) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111113]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[24px] bg-[#241719] text-[#FFF9E8] border border-[#F1E194]/30 p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.2em] text-[#F1E194]">
                  {tr('BARBERLOO INDIA • SUPABASE AUTH', 'बारबरलू इंडिया • सुपाबेस ऑथ')}
                </p>
                <h2 className="font-display text-3xl font-bold mt-0.5">
                  {authMode === 'login'
                    ? tr('Sign In to Your Account', 'अपने खाते में साइन इन करें')
                    : authMode === 'signup'
                    ? tr('Create Your Account', 'अपना नया खाता बनाएं')
                    : tr('Reset Password', 'पासवर्ड रीसेट करें')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 rounded-lg text-[#8A8178] hover:text-[#FFF9E8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-[14px] bg-[#111113]">
              {[
                { id: 'login', label: tr('Login', 'लॉगिन') },
                { id: 'signup', label: tr('Sign Up', 'साइन अप') },
                { id: 'reset', label: tr('Forgot Pass', 'पासवर्ड रीसेट') },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setAuthMode(m.id as any);
                    setAuthMessage('');
                    setAuthError('');
                  }}
                  className={`py-2 rounded-[10px] text-xs font-semibold cursor-pointer ${
                    authMode === m.id
                      ? 'bg-[#5B0E14] text-[#FFF9E8]'
                      : 'text-[#8A8178] hover:text-[#FFF9E8]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Account Type Selector on Sign Up (ONLY Customer or Barber; Admin is owner email) */}
            {authMode === 'signup' &&
              emailInput.trim().toLowerCase() !== OWNER_ADMIN_EMAIL && (
                <div>
                  <label className="block text-xs text-[#8A8178] mb-2">
                    {tr('I am joining BarberLoo as a:', 'मैं बारबरलू से जुड़ रहा हूँ:')}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSignupAccountType('customer')}
                      className={`p-3 rounded-[14px] border text-left transition-all cursor-pointer ${
                        signupAccountType === 'customer'
                          ? 'bg-[#5B0E14] border-[#F1E194] text-[#FFF9E8]'
                          : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#F1E194]">
                        <User className="w-3.5 h-3.5" />
                        <span>{tr('Customer', 'ग्राहक (Customer)')}</span>
                      </div>
                      <p className="text-[11px] opacity-80 mt-1">
                        {tr(
                          'Discover barbers & book appointments',
                          'बार्बर खोजें और अपॉइंटमेंट बुक करें'
                        )}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignupAccountType('barber')}
                      className={`p-3 rounded-[14px] border text-left transition-all cursor-pointer ${
                        signupAccountType === 'barber'
                          ? 'bg-[#5B0E14] border-[#F1E194] text-[#FFF9E8]'
                          : 'bg-[#111113] border-[#F1E194]/20 text-[#8A8178]'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#F1E194]">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>{tr('Barber / Shop', 'बार्बर / सैलून पार्टनर')}</span>
                      </div>
                      <p className="text-[11px] opacity-80 mt-1">
                        {tr(
                          'List your salon & receive bookings',
                          'अपना सैलून पंजीकृत करें और बुकिंग प्राप्त करें'
                        )}
                      </p>
                    </button>
                  </div>
                </div>
              )}

            <form onSubmit={handleEmailAuthSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Full Name', 'पूरा नाम')}
                    </label>
                    <input
                      type="text"
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={tr('Enter your full name', 'अपना पूरा नाम लिखें')}
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#8A8178] mb-1">
                      {tr('Mobile Number (+91)', 'मोबाइल नंबर (+91)')}
                    </label>
                    <input
                      type="tel"
                      required
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+91 98XXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-[#8A8178] mb-1">
                  {tr('Email Address', 'ईमेल पता')}
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                />
              </div>

              <div>
                <label className="block text-xs text-[#8A8178] mb-1">
                  {authMode === 'reset'
                    ? tr('New Password (min 6 chars)', 'नया पासवर्ड (कम से कम 6 अक्षर)')
                    : tr('Password', 'पासवर्ड')}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-[12px] bg-[#111113] border border-[#F1E194]/20 text-xs text-[#FFF9E8]"
                />
              </div>

              {authError && (
                <p className="text-xs text-[#FFF9E8] bg-[#5B0E14] p-3 rounded-[10px] border border-[#F1E194]/30">
                  {authError}
                </p>
              )}

              {authMessage && (
                <p className="text-xs text-[#F1E194] bg-[#111113] p-3 rounded-[10px] border border-[#F1E194]/25">
                  {authMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="w-full py-3.5 rounded-[14px] bg-[#5B0E14] hover:bg-[#75131b] text-[#FFF9E8] border border-[#F1E194]/30 text-xs font-semibold tracking-wider cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#F1E194]" />
                <span>
                  {authBusy
                    ? tr('PLEASE WAIT...', 'कृपया प्रतीक्षा करें...')
                    : authMode === 'login'
                    ? tr('SIGN IN', 'साइन इन करें')
                    : authMode === 'signup'
                    ? emailInput.trim().toLowerCase() === OWNER_ADMIN_EMAIL
                      ? tr('ACTIVATE ADMIN ACCOUNT', 'एडमिन खाता सक्रिय करें')
                      : tr(
                          `CREATE ${signupAccountType.toUpperCase()} ACCOUNT`,
                          'नया खाता बनाएं'
                        )
                    : tr('UPDATE PASSWORD', 'पासवर्ड अपडेट करें')}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
