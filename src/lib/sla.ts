// BarberLoo Real-Time SLA (Service Level Agreement) Engine
// Evaluates Appointment Punctuality SLA (15-min On-Time Chair Start Guarantee)
// and Salon/Admin Dispute Resolution SLA.

export type SlaStatus = 'MET' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'EXEMPT';

export interface AppointmentSlaEvaluation {
  appointmentId: string;
  status: SlaStatus;
  badgeText: string;
  badgeTextHi: string;
  detailText: string;
  detailTextHi: string;
  minutesDelta: number; // positive = minutes past scheduled start, negative = minutes until start
  compensationPoints: number;
  canClaimCompensation: boolean;
}

export interface PlatformSlaSummary {
  overallScorePercent: number;
  appointmentSlaPercent: number;
  reportResolutionSlaPercent: number;
  metCount: number;
  onTrackCount: number;
  atRiskCount: number;
  breachedCount: number;
  targetChairGuaranteeMins: number;
}

export const SLA_TARGETS = {
  APPOINTMENT_ON_TIME_MINS: 15, // Barber must start cut within 15 mins of scheduled slot
  REPORT_RESOLUTION_HOURS: 2, // Admin/Salon dispute resolution target
  BREACH_COMPENSATION_POINTS: 100, // +100 Loyalty Points auto-credit for SLA breach
};

const CLAIMED_SLA_STORAGE_KEY = 'barberloo_claimed_sla_ids_v1';

export function hasCustomerClaimedSla(appointmentId: string): boolean {
  try {
    const raw = localStorage.getItem(CLAIMED_SLA_STORAGE_KEY);
    if (!raw) return false;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.includes(appointmentId);
  } catch {
    return false;
  }
}

export function markCustomerClaimedSla(appointmentId: string) {
  try {
    const raw = localStorage.getItem(CLAIMED_SLA_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(arr) ? arr : []);
    set.add(appointmentId);
    localStorage.setItem(CLAIMED_SLA_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function parseScheduledTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.trim().split('-').map(Number);
    if (!y || !m || !d) return null;

    let hours = 10;
    let mins = 0;
    if (timeStr) {
      const match = timeStr
        .trim()
        .match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
      if (match) {
        hours = Number(match[1]);
        mins = Number(match[2]);
        const mer = match[3]?.toUpperCase();
        if (mer === 'PM' && hours < 12) hours += 12;
        if (mer === 'AM' && hours === 12) hours = 0;
      }
    }
    return new Date(y, m - 1, d, hours, mins, 0, 0);
  } catch {
    return null;
  }
}

export function evaluateAppointmentSla(apt: any): AppointmentSlaEvaluation {
  const id = String(apt?.id || '');
  const rawStatus = String(apt?.status || 'confirmed').toLowerCase();

  if (rawStatus === 'cancelled' || rawStatus === 'no_show' || rawStatus === 'no-show') {
    return {
      appointmentId: id,
      status: 'EXEMPT',
      badgeText: 'SLA Exempt',
      badgeTextHi: 'SLA मुक्त',
      detailText: 'Cancelled / No-Show appointment is exempt from SLA.',
      detailTextHi: 'रद्द या अनुपस्थित अपॉइंटमेंट SLA से मुक्त है।',
      minutesDelta: 0,
      compensationPoints: 0,
      canClaimCompensation: false,
    };
  }

  if (rawStatus === 'completed' || rawStatus === 'in_progress' || rawStatus === 'in progress') {
    return {
      appointmentId: id,
      status: 'MET',
      badgeText: 'SLA Met ✓ (On-Time)',
      badgeTextHi: 'SLA पूर्ण ✓ (समय पर)',
      detailText: `Chair started within ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-min SLA guarantee.`,
      detailTextHi: `${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-मिनट SLA गारंटी के भीतर सेवा शुरू/पूर्ण हुई।`,
      minutesDelta: 0,
      compensationPoints: 0,
      canClaimCompensation: false,
    };
  }

  const scheduledDate = parseScheduledTime(String(apt?.date || ''), String(apt?.time || ''));
  if (!scheduledDate) {
    return {
      appointmentId: id,
      status: 'ON_TRACK',
      badgeText: 'SLA Active • 15m Guarantee',
      badgeTextHi: 'SLA सक्रिय • 15m गारंटी',
      detailText: '15-minute On-Time Chair Guarantee active.',
      detailTextHi: '15-मिनट समय पर चेयर गारंटी सक्रिय है।',
      minutesDelta: 0,
      compensationPoints: 0,
      canClaimCompensation: false,
    };
  }

  const now = new Date();
  const diffMins = Math.round((now.getTime() - scheduledDate.getTime()) / 60000);

  // Past scheduled time + 15 minutes and still not started -> SLA BREACHED
  if (diffMins > SLA_TARGETS.APPOINTMENT_ON_TIME_MINS) {
    const alreadyClaimed =
      hasCustomerClaimedSla(id) ||
      String(apt?.notes || '').includes('[SLA_CLAIMED]') ||
      String(apt?.barberNotes || '').includes('[SLA_CLAIMED]');

    return {
      appointmentId: id,
      status: 'BREACHED',
      badgeText: `SLA Breached (+${diffMins}m Delay)`,
      badgeTextHi: `SLA उल्लंघन (+${diffMins}m देरी)`,
      detailText: `Delayed ${diffMins} mins past slot (>15m SLA). Eligible for +${SLA_TARGETS.BREACH_COMPENSATION_POINTS} PTS SLA Guarantee Credit.`,
      detailTextHi: `निर्धारित समय से ${diffMins} मिनट देरी (>15m SLA)। +${SLA_TARGETS.BREACH_COMPENSATION_POINTS} PTS मुआवजे के पात्र।`,
      minutesDelta: diffMins,
      compensationPoints: SLA_TARGETS.BREACH_COMPENSATION_POINTS,
      canClaimCompensation: !alreadyClaimed,
    };
  }

  // Between scheduled time and +15 mins -> AT RISK (Grace Window ticking)
  if (diffMins >= 0 && diffMins <= SLA_TARGETS.APPOINTMENT_ON_TIME_MINS) {
    const remaining = Math.max(1, SLA_TARGETS.APPOINTMENT_ON_TIME_MINS - diffMins);
    return {
      appointmentId: id,
      status: 'AT_RISK',
      badgeText: `SLA Window: ${remaining}m Left`,
      badgeTextHi: `SLA समय: ${remaining}m शेष`,
      detailText: `Start service within ${remaining} mins to meet the 15-min On-Time SLA.`,
      detailTextHi: `15-मिनट SLA पूरा करने के लिए ${remaining} मिनट में सेवा शुरू करें।`,
      minutesDelta: diffMins,
      compensationPoints: 0,
      canClaimCompensation: false,
    };
  }

  // Upcoming within 20 minutes
  const minsUntil = Math.abs(diffMins);
  if (minsUntil <= 20) {
    return {
      appointmentId: id,
      status: 'ON_TRACK',
      badgeText: `SLA Ready • Starts in ${minsUntil}m`,
      badgeTextHi: `SLA तैयार • ${minsUntil}m में शुरू`,
      detailText: `Protected by BarberLoo ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-Min On-Time Chair Guarantee.`,
      detailTextHi: `BarberLoo ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-मिनट ऑन-टाइम चेयर गारंटी द्वारा सुरक्षित।`,
      minutesDelta: diffMins,
      compensationPoints: 0,
      canClaimCompensation: false,
    };
  }

  return {
    appointmentId: id,
    status: 'ON_TRACK',
    badgeText: 'SLA Protected • 15m Guarantee',
    badgeTextHi: 'SLA सुरक्षित • 15m गारंटी',
    detailText: `Protected by BarberLoo ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-Min On-Time Chair Guarantee.`,
    detailTextHi: `BarberLoo ${SLA_TARGETS.APPOINTMENT_ON_TIME_MINS}-मिनट ऑन-टाइम चेयर गारंटी द्वारा सुरक्षित।`,
    minutesDelta: diffMins,
    compensationPoints: 0,
    canClaimCompensation: false,
  };
}

export function calculatePlatformSlaSummary(
  appointments: any[] = [],
  reports: any[] = []
): PlatformSlaSummary {
  let metCount = 0;
  let onTrackCount = 0;
  let atRiskCount = 0;
  let breachedCount = 0;

  const evalApts = appointments
    .map(evaluateAppointmentSla)
    .filter((e) => e.status !== 'EXEMPT');

  for (const e of evalApts) {
    if (e.status === 'MET') metCount++;
    else if (e.status === 'ON_TRACK') onTrackCount++;
    else if (e.status === 'AT_RISK') atRiskCount++;
    else if (e.status === 'BREACHED') breachedCount++;
  }

  const appointmentSlaPercent =
    evalApts.length > 0
      ? Math.round(
          ((evalApts.length -
            evalApts.filter((x) => x.status === 'BREACHED').length) /
            evalApts.length) *
            100
        )
      : 100;

  const resolvedReports = reports.filter(
    (r: any) => String(r.status || '').toLowerCase() === 'resolved'
  ).length;
  const reportResolutionSlaPercent =
    reports.length > 0
      ? Math.round((resolvedReports / reports.length) * 100)
      : 100;

  const overallScorePercent = Math.round(
    appointmentSlaPercent * 0.8 + reportResolutionSlaPercent * 0.2
  );

  return {
    overallScorePercent,
    appointmentSlaPercent,
    reportResolutionSlaPercent,
    metCount,
    onTrackCount,
    atRiskCount,
    breachedCount,
    targetChairGuaranteeMins: SLA_TARGETS.APPOINTMENT_ON_TIME_MINS,
  };
}
