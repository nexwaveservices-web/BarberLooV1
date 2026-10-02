// Browser Notification API + Background Service Worker Integration for BarberLoo
// Delivers real-time OS notifications for Appointment Reminders, Status Changes, and Bookings
// even when the application tab is minimized or in the background.

const SENT_ALERTS_STORAGE_KEY = 'barberloo_sent_browser_alerts_v1';
const ALERTS_ENABLED_STORAGE_KEY = 'barberloo_browser_alerts_enabled_v1';
const LAST_APT_STATE_KEY = 'barberloo_last_apt_snapshot_v1';

export type BrowserNotificationCategory =
  | 'appointment_reminder'
  | 'booking_update'
  | 'broadcast';

export interface BrowserAlertPayload {
  title: string;
  body: string;
  tag: string;
  category?: BrowserNotificationCategory;
  requireInteraction?: boolean;
  targetPage?: string;
  silent?: boolean;
}

let swRegistration: ServiceWorkerRegistration | null = null;
let backgroundTimerWorker: Worker | null = null;

// Load already-sent notification tags so we never spam duplicate alerts
function getSentAlertTags(): Set<string> {
  try {
    const raw = localStorage.getItem(SENT_ALERTS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.slice(-300) : []);
  } catch {
    return new Set();
  }
}

function markAlertTagSent(tag: string) {
  try {
    const set = getSentAlertTags();
    set.add(tag);
    const arr = Array.from(set).slice(-300);
    localStorage.setItem(SENT_ALERTS_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage quota errors
  }
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export function areBrowserAlertsEnabled(): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const pref = localStorage.getItem(ALERTS_ENABLED_STORAGE_KEY);
    return pref !== 'false';
  } catch {
    return true;
  }
}

export function setBrowserAlertsEnabledPreference(enabled: boolean) {
  try {
    localStorage.setItem(ALERTS_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore
  }
}

// Register /sw.js Service Worker for background notifications
export async function registerNotificationServiceWorker(
  onNotificationClickNavigate?: (targetPage: string) => void
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    swRegistration = reg;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (
        event.data?.type === 'NOTIFICATION_CLICKED' &&
        onNotificationClickNavigate
      ) {
        const targetPage = event.data?.data?.targetPage;
        if (targetPage) {
          onNotificationClickNavigate(targetPage);
        }
      }
    });

    return reg;
  } catch {
    return null;
  }
}

// Subtle Web Audio API notification chime for urgent appointment / reminder alerts
function playAlertChime(urgent = false) {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(urgent ? 880 : 660, ctx.currentTime);
    if (urgent) {
      osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.18);
    }
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // AudioContext may be blocked if no prior user gesture
  }
}

// Request Browser Notification Permission from user
export async function requestBrowserNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!isBrowserNotificationSupported()) return 'unsupported';

  try {
    await registerNotificationServiceWorker();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setBrowserAlertsEnabledPreference(true);
      await sendBrowserNotification({
        title: 'BarberLoo Live Alerts Enabled',
        body: "You'll now receive real-time alerts for Appointment Reminders, Status Changes, and Confirmations even when BarberLoo is in the background.",
        tag: `barberloo-welcome-alert-${Date.now()}`,
        category: 'appointment_reminder',
        targetPage: 'customer-dashboard',
      });
    }
    return permission;
  } catch {
    return Notification.permission;
  }
}

// Core function to dispatch a native OS / Browser Notification (works in background & foreground)
export async function sendBrowserNotification(
  payload: BrowserAlertPayload,
  onNavigate?: (page: string) => void
): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (!areBrowserAlertsEnabled()) return false;

  const sentTags = getSentAlertTags();
  if (payload.tag && sentTags.has(payload.tag)) {
    return false;
  }
  if (payload.tag) {
    markAlertTagSent(payload.tag);
  }

  if (!payload.silent) {
    playAlertChime(Boolean(payload.requireInteraction));
  }

  const notificationData = {
    url: window.location.origin,
    targetPage: payload.targetPage || 'customer-dashboard',
    category: payload.category || 'appointment_reminder',
  };

  try {
    // 1. Prefer Service Worker notification so alerts appear reliably when tab is in the background
    const reg =
      swRegistration ||
      (await navigator.serviceWorker?.getRegistration('/sw.js')) ||
      null;

    if (reg && 'showNotification' in reg) {
      await reg.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: Boolean(payload.requireInteraction),
        data: notificationData,
      });
      return true;
    }

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_BROWSER_NOTIFICATION',
        title: payload.title,
        body: payload.body,
        tag: payload.tag,
        requireInteraction: Boolean(payload.requireInteraction),
        payload: notificationData,
      });
      return true;
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    // 2. Direct Browser Notification API fallback
    const notif = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/favicon.ico',
      requireInteraction: Boolean(payload.requireInteraction),
    });

    notif.onclick = () => {
      window.focus();
      if (onNavigate && payload.targetPage) {
        onNavigate(payload.targetPage);
      }
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// 1. REAL-TIME & BACKGROUND APPOINTMENT REMINDERS & STATUS ALERTS
// ============================================================================
function parseAppointmentDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  try {
    // Support YYYY-MM-DD
    const cleanDate = dateStr.trim();
    const [yearStr, monthStr, dayStr] = cleanDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (!year || !month || !day) {
      const fallback = new Date(`${dateStr} ${timeStr || '10:00 AM'}`);
      return isNaN(fallback.getTime()) ? null : fallback;
    }

    let hours = 10;
    let minutes = 0;

    if (timeStr) {
      const match = timeStr
        .trim()
        .match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
      if (match) {
        hours = Number(match[1]);
        minutes = Number(match[2]);
        const meridiem = match[3]?.toUpperCase();
        if (meridiem === 'PM' && hours < 12) hours += 12;
        if (meridiem === 'AM' && hours === 12) hours = 0;
      }
    }

    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  } catch {
    return null;
  }
}

function getSavedAptSnapshotMap(uid: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(`${LAST_APT_STATE_KEY}_${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAptSnapshotMap(uid: string, map: Record<string, string>) {
  try {
    localStorage.setItem(`${LAST_APT_STATE_KEY}_${uid}`, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export async function checkAndNotifyAppointmentReminders(
  uid: string,
  appointments: any[],
  onNavigate?: (page: string) => void
) {
  if (!uid || !Array.isArray(appointments)) return;

  const userApts = appointments.filter(
    (a) => a.customerUid === uid || a.customer_uid === uid
  );
  if (userApts.length === 0) return;

  const prevMap = getSavedAptSnapshotMap(uid);
  const nextMap: Record<string, string> = { ...prevMap };
  const now = new Date();

  for (const apt of userApts) {
    const aptId = String(apt.id);
    const status = String(apt.status || 'confirmed').toLowerCase();
    const serviceName = apt.serviceName || apt.service_name || 'Grooming Appointment';
    const barberName = apt.barberName || apt.barber_name || 'Your Barber';
    const shopName = apt.shopName || apt.shop_name || 'BarberLoo Studio';
    const dateStr = String(apt.date || '');
    const timeStr = String(apt.time || '');
    const compositeState = `${status}|${dateStr}|${timeStr}`;

    // 1. Check if appointment status or schedule changed in real time
    if (prevMap[aptId] && prevMap[aptId] !== compositeState) {
      const [oldStatus, oldDate, oldTime] = prevMap[aptId].split('|');

      if (oldStatus !== status) {
        if (status === 'confirmed') {
          await sendBrowserNotification(
            {
              title: `✅ Appointment Confirmed!`,
              body: `${serviceName} with ${barberName} on ${dateStr} at ${timeStr} is confirmed.`,
              tag: `apt-status-${aptId}-confirmed-${dateStr}-${timeStr}`,
              category: 'booking_update',
              targetPage: 'customer-dashboard',
            },
            onNavigate
          );
        } else if (status === 'in_progress' || status === 'in-chair') {
          await sendBrowserNotification(
            {
              title: `✂️ Your Appointment Has Started`,
              body: `${barberName} has started your ${serviceName} at ${shopName}.`,
              tag: `apt-status-${aptId}-in_progress`,
              category: 'booking_update',
              targetPage: 'customer-dashboard',
            },
            onNavigate
          );
        } else if (status === 'completed') {
          await sendBrowserNotification(
            {
              title: `🌟 Appointment Completed!`,
              body: `Thank you for visiting ${shopName}! Tap to rate your ${serviceName} with ${barberName}.`,
              tag: `apt-status-${aptId}-completed`,
              category: 'booking_update',
              targetPage: 'customer-dashboard',
            },
            onNavigate
          );
        } else if (status === 'cancelled') {
          await sendBrowserNotification(
            {
              title: `❌ Appointment Cancelled`,
              body: `Your ${serviceName} with ${barberName} on ${dateStr} at ${timeStr} was cancelled.`,
              tag: `apt-status-${aptId}-cancelled`,
              category: 'booking_update',
              requireInteraction: true,
              targetPage: 'customer-dashboard',
            },
            onNavigate
          );
        }
      } else if (oldDate !== dateStr || oldTime !== timeStr) {
        await sendBrowserNotification(
          {
            title: `📅 Appointment Rescheduled`,
            body: `Your ${serviceName} with ${barberName} is now set for ${dateStr} at ${timeStr}.`,
            tag: `apt-resched-${aptId}-${dateStr}-${timeStr}`,
            category: 'booking_update',
            targetPage: 'customer-dashboard',
          },
          onNavigate
        );
      }
    }

    nextMap[aptId] = compositeState;

    // 2. Time-based Appointment Reminders for active upcoming appointments
    if (status !== 'confirmed' && status !== 'pending') continue;

    const aptDate = parseAppointmentDateTime(dateStr, timeStr);
    if (!aptDate) continue;

    const diffMs = aptDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    // A) Urgent 15-Minute Reminder (between 1 and 15 mins before appointment)
    if (diffMins > 0 && diffMins <= 15) {
      await sendBrowserNotification(
        {
          title: `⏰ Appointment in ${diffMins} Mins!`,
          body: `Your ${serviceName} with ${barberName} at ${shopName} starts at ${timeStr}. See you soon!`,
          tag: `apt-reminder-15m-${aptId}-${dateStr}-${timeStr}`,
          category: 'appointment_reminder',
          requireInteraction: true,
          targetPage: 'customer-dashboard',
        },
        onNavigate
      );
    }
    // B) 1-Hour Upcoming Reminder (between 16 and 60 mins before appointment)
    else if (diffMins > 15 && diffMins <= 60) {
      await sendBrowserNotification(
        {
          title: `🔔 Upcoming Appointment in ~${diffMins} Mins`,
          body: `Reminder: ${serviceName} with ${barberName} today at ${timeStr} (${shopName}).`,
          tag: `apt-reminder-60m-${aptId}-${dateStr}-${timeStr}`,
          category: 'appointment_reminder',
          targetPage: 'customer-dashboard',
        },
        onNavigate
      );
    }
    // C) Same-Day Reminder (between 61 mins and 12 hours away on the same calendar date)
    else if (
      diffMins > 60 &&
      diffMins <= 720 &&
      aptDate.toDateString() === now.toDateString()
    ) {
      await sendBrowserNotification(
        {
          title: `📅 Appointment Reminder for Today (${timeStr})`,
          body: `You have ${serviceName} booked with ${barberName} at ${shopName} today at ${timeStr}.`,
          tag: `apt-reminder-today-${aptId}-${dateStr}`,
          category: 'appointment_reminder',
          targetPage: 'customer-dashboard',
        },
        onNavigate
      );
    }
  }

  saveAptSnapshotMap(uid, nextMap);
}

// ============================================================================
// 3. SUPABASE REALTIME NOTIFICATIONS TABLE WATCHER
// ============================================================================
export async function checkAndNotifyDatabaseNotifications(
  uid: string,
  notifications: any[],
  onNavigate?: (page: string) => void
) {
  if (!uid || !Array.isArray(notifications)) return;

  // Check unread notifications created recently for this user
  const userUnread = notifications.filter(
    (n) =>
      (n.recipientUid === uid || n.recipient_uid === uid) &&
      !n.read
  );

  for (const notif of userUnread.slice(0, 3)) {
    const notifId = String(notif.id);
    const type = String(notif.type || '');
    const title = String(notif.title || 'BarberLoo Update');

    await sendBrowserNotification(
      {
        title: '📅 BarberLoo Notification',
        body: title,
        tag: `db-notif-${notifId}`,
        category: 'appointment_reminder',
        requireInteraction: type === 'appointment_reminder',
        targetPage: 'customer-dashboard',
      },
      onNavigate
    );
  }
}

// ============================================================================
// 4. UNTHROTTLED BACKGROUND WEB WORKER TICKER FOR BACKGROUND REMINDERS
// ============================================================================
// Standard window.setInterval gets heavily throttled when a browser tab is in the background.
// Using an inline Web Worker keeps our 30-second reminder check running accurately in the background!
export function startBackgroundReminderTicker(onTick: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  let fallbackInterval: number | null = null;

  try {
    const workerBlob = new Blob(
      [
        `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => self.postMessage('tick'), 25000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `,
      ],
      { type: 'application/javascript' }
    );
    const workerUrl = URL.createObjectURL(workerBlob);
    backgroundTimerWorker = new Worker(workerUrl);
    backgroundTimerWorker.onmessage = () => {
      onTick();
    };
    backgroundTimerWorker.postMessage('start');

    const handleVisibility = () => {
      onTick();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (backgroundTimerWorker) {
        backgroundTimerWorker.postMessage('stop');
        backgroundTimerWorker.terminate();
        backgroundTimerWorker = null;
      }
      URL.revokeObjectURL(workerUrl);
    };
  } catch {
    fallbackInterval = window.setInterval(onTick, 25000);
    return () => {
      if (fallbackInterval) window.clearInterval(fallbackInterval);
    };
  }
}
