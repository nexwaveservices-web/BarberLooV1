import React, { createContext, useContext, useEffect, useMemo } from 'react';

export type Language = 'en';

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ISTDateOption {
  id: string;
  isoDate: string; // YYYY-MM-DD in Asia/Kolkata
  label: string; // e.g., "Today", "Tomorrow", "Sat"
  sub: string; // e.g., "24 Oct"
  fullLabel: string; // e.g., "Today, 24 Oct (IST)"
  isToday: boolean;
}

export interface INRBreakdown {
  grossTotal: number;
  discountAmount: number;
  finalPayable: number;
  baseAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalGstAmount: number;
  formattedGross: string;
  formattedDiscount: string;
  formattedFinal: string;
  formattedBase: string;
  formattedCgst: string;
  formattedSgst: string;
  formattedTotalGst: string;
}

export function formatINRCurrency(
  amount: number | string | undefined | null,
  _lang: string = 'en',
  options?: { showDecimals?: boolean }
): string {
  const numeric =
    typeof amount === 'number'
      ? amount
      : Number(String(amount ?? 0).replace(/[^0-9.-]+/g, '')) || 0;
  const digits = options?.showDecimals ? 2 : 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(numeric);
  } catch {
    return `₹${numeric.toLocaleString('en-IN')}`;
  }
}

export function formatINRCompact(
  amount: number,
  _lang: string = 'en'
): string {
  if (amount >= 10000000) {
    const cr = (amount / 10000000).toFixed(2).replace(/\.00$/, '');
    return `₹${cr} Cr`;
  }
  if (amount >= 100000) {
    const lakh = (amount / 100000).toFixed(2).replace(/\.00$/, '');
    return `₹${lakh} L`;
  }
  return formatINRCurrency(amount, 'en');
}

export function calculateINRBreakdown(
  grossTotal: number,
  discountAmount = 0,
  _lang: string = 'en'
): INRBreakdown {
  const safeGross = Math.max(0, Math.round(grossTotal));
  const safeDiscount = Math.max(0, Math.min(safeGross, Math.round(discountAmount)));
  const finalPayable = Math.max(0, safeGross - safeDiscount);
  // 18% GST inclusive breakdown (9% CGST + 9% SGST)
  const baseAmount = Math.round(finalPayable / 1.18);
  const totalGstAmount = Math.max(0, finalPayable - baseAmount);
  const cgstAmount = Math.floor(totalGstAmount / 2);
  const sgstAmount = totalGstAmount - cgstAmount;

  return {
    grossTotal: safeGross,
    discountAmount: safeDiscount,
    finalPayable,
    baseAmount,
    cgstAmount,
    sgstAmount,
    totalGstAmount,
    formattedGross: formatINRCurrency(safeGross, 'en'),
    formattedDiscount: formatINRCurrency(safeDiscount, 'en'),
    formattedFinal: formatINRCurrency(finalPayable, 'en'),
    formattedBase: formatINRCurrency(baseAmount, 'en'),
    formattedCgst: formatINRCurrency(cgstAmount, 'en'),
    formattedSgst: formatINRCurrency(sgstAmount, 'en'),
    formattedTotalGst: formatINRCurrency(totalGstAmount, 'en'),
  };
}

export function getISTParts(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }
  const hourNum = Number(map.hour === '24' ? '0' : map.hour || '0');
  const minuteNum = Number(map.minute || '0');
  const isoDate = `${map.year}-${map.month}-${map.day}`;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: hourNum,
    minute: minuteNum,
    isoDate,
    time24: `${String(hourNum).padStart(2, '0')}:${String(minuteNum).padStart(2, '0')}`,
  };
}

export function getCurrentISTDisplay(_lang: string = 'en', now: Date = new Date()) {
  const timeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return {
    timeStr,
    dateStr,
    badge: 'Indian Standard Time (IST • UTC+5:30)',
    shortBadge: 'IST (UTC+5:30)',
  };
}

export function getUpcomingISTDates(
  count = 7,
  _lang: string = 'en'
): ISTDateOption[] {
  const now = new Date();
  const options: ISTDateOption[] = [];

  for (let i = 0; i < count; i++) {
    const target = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const istParts = getISTParts(target);

    const weekdayShort = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      weekday: 'short',
    }).format(target);

    const dayMonth = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
    }).format(target);

    let label = weekdayShort;
    if (i === 0) {
      label = 'Today';
    } else if (i === 1) {
      label = 'Tomorrow';
    }

    options.push({
      id: `ist-day-${i}`,
      isoDate: istParts.isoDate,
      label,
      sub: dayMonth,
      fullLabel: `${label}, ${dayMonth}`,
      isToday: i === 0,
    });
  }

  return options;
}

export function formatISTDateString(isoDate: string, _lang: string = 'en'): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 6, 30, 0));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dateObj);
}

export function formatISTTimeSlot(slot24: string, _lang: string = 'en'): {
  time24: string;
  time12: string;
  periodLabel: string;
} {
  const [hStr, mStr] = (slot24 || '10:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const suffixEn = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const paddedM = String(m).padStart(2, '0');
  const time12 = `${h12}:${paddedM} ${suffixEn}`;

  const periodLabel =
    h < 12
      ? 'Morning (IST)'
      : h < 17
      ? 'Afternoon (IST)'
      : 'Evening (IST)';

  return {
    time24: `${String(h).padStart(2, '0')}:${paddedM}`,
    time12,
    periodLabel,
  };
}

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  tr: (en: string, ..._unused: any[]) => string;
  formatINR: (amount: number | string | undefined | null, options?: { showDecimals?: boolean }) => string;
  formatCompactINR: (amount: number) => string;
  getINRBreakdown: (grossTotal: number, discountAmount?: number) => INRBreakdown;
  translateCity: (city: string) => string;
  translateCategory: (cat: string) => string;
  translateService: (name: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    document.documentElement.lang = 'en';
    try {
      localStorage.setItem('barberloo_lang', 'en');
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LanguageContextValue>(() => {
    // Strictly English only
    const tr = (en: string, ..._unused: any[]) => en;
    const formatINR = (
      amount: number | string | undefined | null,
      options?: { showDecimals?: boolean }
    ) => formatINRCurrency(amount, 'en', options);
    const formatCompactINR = (amount: number) => formatINRCompact(amount, 'en');
    const getINRBreakdown = (grossTotal: number, discountAmount = 0) =>
      calculateINRBreakdown(grossTotal, discountAmount, 'en');

    const translateCity = (city: string) => city;
    const translateCategory = (cat: string) => cat;
    const translateService = (name: string) => name;

    return {
      lang: 'en',
      setLang: () => {},
      toggleLang: () => {},
      tr,
      formatINR,
      formatCompactINR,
      getINRBreakdown,
      translateCity,
      translateCategory,
      translateService,
    };
  }, []);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
