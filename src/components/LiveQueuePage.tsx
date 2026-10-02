import React, { useState } from 'react';
import { PageView, QueueItem } from '../data/barberlooData';
import { Clock, Users, CheckCircle2, LogIn, Bell } from 'lucide-react';
import { useLanguage, getCurrentISTDisplay } from '../lib/i18n';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  areBrowserAlertsEnabled,
  setBrowserAlertsEnabledPreference,
  sendBrowserNotification,
} from '../lib/browserNotifications';

interface LiveQueuePageProps {
  queue: QueueItem[];
  onLeaveQueue: () => void;
  onRejoinQueue: () => void;
  onAdvanceQueue: () => void;
  onResetQueue?: () => void;
  onToggleGraceBuffer?: () => void;
  onNavigate: (page: PageView) => void;
  currentUserUid?: string;
  currentUserProfile?: any | null;
  shops?: any[];
  onOpenAuthModal?: () => void;
}

export const LiveQueuePage: React.FC<LiveQueuePageProps> = ({
  queue,
  onLeaveQueue,
  onRejoinQueue,
  onToggleGraceBuffer,
  onNavigate,
  currentUserUid,
  currentUserProfile,
  shops = [],
  onOpenAuthModal,
}) => {
  const { lang, tr } = useLanguage();
  const istDisplay = getCurrentISTDisplay(lang);
  const [browserPerm, setBrowserPerm] = useState<string>(() =>
    getBrowserNotificationPermission()
  );
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() =>
    areBrowserAlertsEnabled()
  );

  const userEntry = currentUserUid
    ? queue.find(
        (q) => q.isCurrentUser || q.customerUid === currentUserUid
      )
    : undefined;

  const handleQueueBrowserAlerts = async () => {
    const perm = getBrowserNotificationPermission();
    if (perm !== 'granted') {
      const res = await requestBrowserNotificationPermission();
      setBrowserPerm(res);
      setAlertsEnabled(res === 'granted');
      return;
    }
    setBrowserAlertsEnabledPreference(true);
    setAlertsEnabled(true);
    await sendBrowserNotification({
      title: userEntry
        ? `💈 Queue Position #${userEntry.position} • ~${userEntry.waitMins}m Wait`
        : '💈 Live Queue Background Alerts Active',
      body: userEntry
        ? `You are #${userEntry.position} in line for ${userEntry.serviceName} with ${userEntry.barberName}. We'll alert you even if this tab is in the background!`
        : "You'll receive real-time browser notifications whenever your queue position or chair status changes.",
      tag: `queue-live-alert-${Date.now()}`,
      category: 'queue_status',
      targetPage: 'queue',
    });
  };
  const currentlyServing =
    queue.find((q) => q.position === 1 || q.status === 'Serving') || queue[0];
  const peopleAhead = userEntry ? Math.max(0, userEntry.position - 1) : 0;
  const activeShopName = shops[0]?.name || tr('LIVE SALON QUEUE', 'लाइव सैलून कतार');

  return (
    <div className="min-h-screen bg-[#111113] text-[#FFF9E8] py-12 sm:py-16">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8">
        {/* Top Telemetry Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-[#F1E194]/15">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase text-[#F1E194] mb-2">
              <span className="w-2 h-2 rounded-full bg-[#F1E194] animate-pulse" />
              <span>
                {tr(
                  `REAL-TIME CHAIR TELEMETRY • ${istDisplay.shortBadge}`,
                  `रियल-टाइम चेयर टेलीमेट्री • ${istDisplay.shortBadge}`
                )}
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-[#FFF9E8]">
              {activeShopName.toUpperCase()}
            </h1>
          </div>

          <div className="text-xs text-[#8A8178] font-mono-num">
            {istDisplay.dateStr} · {istDisplay.timeStr} IST
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-10 items-start">
          {/* Left Circular / Telemetry Dial */}
          <div className="lg:col-span-5">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/30 p-8 sm:p-10 text-center shadow-2xl space-y-8">
              <div className="relative w-60 h-60 mx-auto flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 240 240">
                  <circle
                    cx="120"
                    cy="120"
                    r="104"
                    fill="none"
                    stroke="rgba(241, 225, 148, 0.14)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="104"
                    fill="none"
                    stroke="#F1E194"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 104}
                    strokeDashoffset={
                      userEntry
                        ? 2 *
                          Math.PI *
                          104 *
                          (1 - Math.max(0.18, 1 - (userEntry.position - 1) * 0.2))
                        : 2 * Math.PI * 104
                    }
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
                  {userEntry ? (
                    <>
                      <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#8A8178]">
                        {tr('QUEUE POSITION', 'आपका स्थान')}
                      </span>
                      <span className="font-display font-mono-num text-5xl font-bold text-[#F1E194] mt-1">
                        #{userEntry.position}
                      </span>
                      <span className="mt-2 px-3 py-0.5 rounded-[10px] bg-[#5B0E14] text-[#FFF9E8] text-[11px] font-semibold">
                        ~{userEntry.waitMins} {tr('mins wait', 'मिनट प्रतीक्षा')}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs uppercase tracking-widest text-[#8A8178]">
                        {tr('ACTIVE LINEUP', 'वर्तमान कतार')}
                      </span>
                      <span className="font-display text-3xl font-bold text-[#FFF9E8] mt-2">
                        {queue.length} {tr('in Queue', 'ग्राहक कतार में')}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#F1E194]/15">
                <div className="p-3.5 rounded-[16px] bg-[#111113]/70 border border-[#F1E194]/12">
                  <Users className="w-4 h-4 text-[#F1E194] mx-auto mb-1" />
                  <div className="font-mono-num text-2xl font-bold text-[#FFF9E8]">
                    {userEntry ? peopleAhead : queue.length}
                  </div>
                  <div className="text-[11px] text-[#8A8178]">
                    {tr('People Ahead', 'आपसे आगे')}
                  </div>
                </div>

                <div className="p-3.5 rounded-[16px] bg-[#111113]/70 border border-[#F1E194]/12">
                  <Clock className="w-4 h-4 text-[#F1E194] mx-auto mb-1" />
                  <div className="font-mono-num text-2xl font-bold text-[#F1E194]">
                    {userEntry ? `${userEntry.waitMins}m` : `${queue.length * 12}m`}
                  </div>
                  <div className="text-[11px] text-[#8A8178]">
                    {tr('Est. Wait', 'अनुमानित समय')}
                  </div>
                </div>

                <div className="p-3.5 rounded-[16px] bg-[#111113]/70 border border-[#F1E194]/12">
                  <CheckCircle2 className="w-4 h-4 text-[#F1E194] mx-auto mb-1" />
                  <div className="font-mono-num text-sm font-bold text-[#FFF9E8] truncate">
                    {currentlyServing
                      ? currentlyServing.clientName.split(' ')[0]
                      : '—'}
                  </div>
                  <div className="text-[11px] text-[#8A8178]">
                    {tr('Serving Now', 'अभी सेवा में')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {userEntry ? (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={onLeaveQueue}
                    className="w-full py-4 px-6 rounded-[18px] bg-[#5B0E14] hover:bg-[#75131b] text-[#FFF9E8] border border-[#F1E194]/30 text-xs font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer"
                  >
                    {tr('LEAVE QUEUE', 'कतार छोड़ें')}
                  </button>
                  {onToggleGraceBuffer && (
                    <button
                      type="button"
                      onClick={onToggleGraceBuffer}
                      className="w-full py-2.5 px-4 rounded-[14px] bg-[#111113] border border-[#F1E194]/25 text-xs text-[#F1E194] font-semibold cursor-pointer"
                    >
                      {tr(
                        'Request +5 Min Travel Grace Buffer',
                        '+5 मिनट का अतिरिक्त समय मांगें'
                      )}
                    </button>
                  )}
                </div>
              ) : currentUserProfile ? (
                <button
                  type="button"
                  onClick={onRejoinQueue}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] hover:bg-[#FFF9E8] text-xs font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer"
                >
                  {tr('JOIN LIVE QUEUE NOW', 'अभी लाइव कतार में जुड़ें')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenAuthModal && onOpenAuthModal()}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#F1E194] text-[#111113] hover:bg-[#FFF9E8] text-xs font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {tr('SIGN IN TO JOIN LIVE QUEUE', 'कतार में जुड़ने के लिए साइन इन करें')}
                  </span>
                </button>
              )}

              {browserPerm !== 'unsupported' && (
                <button
                  type="button"
                  onClick={handleQueueBrowserAlerts}
                  className="w-full py-2.5 px-4 rounded-[14px] bg-[#111113]/80 hover:bg-[#111113] border border-[#F1E194]/25 text-[11px] text-[#F1E194] font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5 text-[#F1E194]" />
                  <span>
                    {browserPerm === 'granted' && alertsEnabled
                      ? tr(
                          'Background Queue Alerts Active • Send Live Alert',
                          'बैकग्राउंड कतार अलर्ट सक्रिय • लाइव अलर्ट भेजें'
                        )
                      : browserPerm === 'denied'
                        ? tr(
                            'Browser Notifications Blocked in Browser Settings',
                            'ब्राउज़र सेटिंग्स में नोटिफिकेशन अवरुद्ध हैं'
                          )
                        : tr(
                            'Enable Background Browser Alerts for Queue',
                            'कतार के लिए बैकग्राउंड ब्राउज़र अलर्ट चालू करें'
                          )}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Right Queue Lineup */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-[24px] bg-[#241719] border border-[#F1E194]/20 p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1E194]/15 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#F1E194]">
                    {tr('LIVE LINEUP PROGRESSION', 'लाइव कतार सूची')}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#FFF9E8]">
                    {tr('Active Queue Lineup', 'वर्तमान कतार')}
                  </h2>
                </div>
                <span className="font-mono-num text-xs text-[#8A8178]">
                  {queue.length} {tr('Active', 'सक्रिय')}
                </span>
              </div>

              {queue.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="font-display text-2xl text-[#FFF9E8]">
                    {tr('The Queue Is Currently Empty', 'अभी कतार खाली है')}
                  </p>
                  <p className="text-xs text-[#8A8178]">
                    {tr(
                      'Zero wait time! Join the live queue now for immediate chair seating.',
                      'कोई प्रतीक्षा समय नहीं! तत्काल सेवा के लिए अभी लाइव कतार में जुड़ें।'
                    )}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.map((item) => {
                    const isMe =
                      item.isCurrentUser ||
                      (currentUserUid && item.customerUid === currentUserUid);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[18px] p-4 sm:p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isMe
                            ? 'bg-[#5B0E14] border-[#F1E194] text-[#FFF9E8]'
                            : 'bg-[#111113]/65 border-[#F1E194]/12 text-[#FFF9E8]'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-11 h-11 rounded-[12px] font-mono-num font-bold text-sm flex items-center justify-center shrink-0 ${
                              isMe
                                ? 'bg-[#F1E194] text-[#111113]'
                                : 'bg-[#241719] text-[#8A8178]'
                            }`}
                          >
                            #{item.position}
                          </div>
                          <div>
                            <span className="font-semibold text-sm sm:text-base">
                              {item.clientName} {isMe ? tr('(You)', '(आप)') : ''}
                            </span>
                            <p className="text-xs text-[#FFF9E8]/70 mt-0.5">
                              {item.serviceName} · {tr('Barber:', 'बार्बर:')}{' '}
                              {item.barberName}
                            </p>
                          </div>
                        </div>
                        <div className="font-mono-num text-sm font-bold text-[#F1E194]">
                          {item.waitMins === 0
                            ? tr('In Chair', 'चेयर पर')
                            : `~${item.waitMins} ${tr('mins', 'मिनट')}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
