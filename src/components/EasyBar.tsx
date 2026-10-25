import React, { useState } from 'react';
import { useLanguage } from '../lib/i18n';
import { PageView } from '../data/barberlooData';
import {
  Scissors,
  KeyRound,
  HelpCircle,
  Sparkles,
  ChevronUp,
  X,
} from 'lucide-react';
import { EasyHelpModal } from './EasyHelpModal';

interface EasyBarProps {
  onNavigate: (page: PageView) => void;
  currentPage: PageView;
  activeUserUid?: string;
  hasActiveAppointments?: boolean;
}

export const EasyBar: React.FC<EasyBarProps> = ({
  onNavigate,
  currentPage,
  activeUserUid,
  hasActiveAppointments,
}) => {
  const { tr } = useLanguage();
  const [helpOpen, setHelpOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Hide on booking or admin to keep focused screen
  if (currentPage === 'booking' || currentPage === 'admin-dashboard') {
    return (
      <EasyHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <>
      <EasyHelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onNavigate={onNavigate}
      />

      <div className="fixed bottom-4 right-4 z-40 print:hidden select-none">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand quick actions"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-[#1C1718] text-[#F1E194] border border-[#F1E194]/30 shadow-2xl hover:scale-105 transition-all cursor-pointer text-xs font-semibold"
          >
            <Sparkles className="w-4 h-4 text-[#F1E194]" />
            <span className="hidden sm:inline">{tr('Quick Actions', 'त्वरित कार्य')}</span>
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="flex items-center gap-1.5 p-1.5 rounded-full bg-[#1C1718]/95 backdrop-blur-md text-[#FFF9E8] border border-[#F1E194]/30 shadow-2xl">
            {/* Quick Book Button */}
            <button
              type="button"
              onClick={() => onNavigate('booking')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#5B0E14] text-[#F1E194] text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{tr('Book Now', 'बुक करें')}</span>
            </button>

            {/* My OTP / Bookings */}
            <button
              type="button"
              onClick={() => onNavigate('customer-dashboard')}
              title={tr('View My Appointments & OTP', 'मेरी बुकिंग और OTP देखें')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#241719] hover:bg-[#2e1d20] text-[#FFF9E8] text-xs font-semibold border border-[#F1E194]/15 transition-all cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#F1E194]" />
              <span className="hidden md:inline">{tr('My OTP', 'मेरा OTP')}</span>
              {hasActiveAppointments && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            {/* How It Works Guide */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              title={tr('How BarberLoo Works in 3 Steps', 'बारबरलू गाइड')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#241719] hover:bg-[#2e1d20] text-[#F1E194] text-xs font-semibold border border-[#F1E194]/20 transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#F1E194]" />
              <span>{tr('How It Works', 'गाइड')}</span>
            </button>

            {/* Minimize */}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Minimize"
              className="p-1.5 text-[#8A8178] hover:text-[#FFF9E8] rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
