import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type Language = 'en' | 'hi';

export const IST_TIMEZONE = 'Asia/Kolkata';

export interface ISTDateOption {
  id: string;
  isoDate: string; // YYYY-MM-DD in Asia/Kolkata
  label: string; // e.g., "Today" / "आज" or "Sat" / "शनि"
  sub: string; // e.g., "24 Oct" / "24 अक्टू"
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
  lang: Language = 'en',
  options?: { showDecimals?: boolean }
): string {
  const numeric =
    typeof amount === 'number'
      ? amount
      : Number(String(amount ?? 0).replace(/[^0-9.-]+/g, '')) || 0;
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const digits = options?.showDecimals ? 2 : 0;
  try {
    return new Intl.NumberFormat(locale, {
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
  lang: Language = 'en'
): string {
  if (amount >= 10000000) {
    const cr = (amount / 10000000).toFixed(2).replace(/\.00$/, '');
    return lang === 'hi' ? `₹${cr} करोड़` : `₹${cr} Cr`;
  }
  if (amount >= 100000) {
    const lakh = (amount / 100000).toFixed(2).replace(/\.00$/, '');
    return lang === 'hi' ? `₹${lakh} लाख` : `₹${lakh} L`;
  }
  return formatINRCurrency(amount, lang);
}

export function calculateINRBreakdown(
  grossTotal: number,
  discountAmount = 0,
  lang: Language = 'en'
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
    formattedGross: formatINRCurrency(safeGross, lang),
    formattedDiscount: formatINRCurrency(safeDiscount, lang),
    formattedFinal: formatINRCurrency(finalPayable, lang),
    formattedBase: formatINRCurrency(baseAmount, lang),
    formattedCgst: formatINRCurrency(cgstAmount, lang),
    formattedSgst: formatINRCurrency(sgstAmount, lang),
    formattedTotalGst: formatINRCurrency(totalGstAmount, lang),
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

export function getCurrentISTDisplay(lang: Language = 'en', now: Date = new Date()) {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const timeStr = new Intl.DateTimeFormat(locale, {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);
  const dateStr = new Intl.DateTimeFormat(locale, {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return {
    timeStr,
    dateStr,
    badge: lang === 'hi' ? 'भारतीय मानक समय (IST • UTC+5:30)' : 'Indian Standard Time (IST • UTC+5:30)',
    shortBadge: 'IST (UTC+5:30)',
  };
}

export function getUpcomingISTDates(
  count = 7,
  lang: Language = 'en'
): ISTDateOption[] {
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const now = new Date();
  const options: ISTDateOption[] = [];

  for (let i = 0; i < count; i++) {
    const target = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    const istParts = getISTParts(target);

    const weekdayShort = new Intl.DateTimeFormat(locale, {
      timeZone: IST_TIMEZONE,
      weekday: 'short',
    }).format(target);

    const dayMonth = new Intl.DateTimeFormat(locale, {
      timeZone: IST_TIMEZONE,
      day: 'numeric',
      month: 'short',
    }).format(target);

    let label = weekdayShort;
    if (i === 0) {
      label = lang === 'hi' ? 'आज' : 'Today';
    } else if (i === 1) {
      label = lang === 'hi' ? 'कल' : 'Tomorrow';
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

export function formatISTDateString(isoDate: string, lang: Language = 'en'): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return isoDate;
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  // Construct midday UTC so Asia/Kolkata stays on the same calendar date
  const dateObj = new Date(Date.UTC(y, m - 1, d, 6, 30, 0));
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Intl.DateTimeFormat(locale, {
    timeZone: IST_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dateObj);
}

export function formatISTTimeSlot(slot24: string, lang: Language = 'en'): {
  time24: string;
  time12: string;
  periodLabel: string;
} {
  const [hStr, mStr] = (slot24 || '10:00').split(':');
  const h = Number(hStr);
  const m = Number(mStr || 0);
  const suffixEn = h >= 12 ? 'PM' : 'AM';
  const suffixHi =
    h < 12 ? 'सुबह' : h < 17 ? 'दोपहर' : 'शाम';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const paddedM = String(m).padStart(2, '0');
  const time12 =
    lang === 'hi'
      ? `${suffixHi} ${h12}:${paddedM}`
      : `${h12}:${paddedM} ${suffixEn}`;

  const periodLabel =
    h < 12
      ? lang === 'hi'
        ? 'सुबह (Morning IST)'
        : 'Morning (IST)'
      : h < 17
      ? lang === 'hi'
        ? 'दोपहर (Afternoon IST)'
        : 'Afternoon (IST)'
      : lang === 'hi'
      ? 'शाम (Evening IST)'
      : 'Evening (IST)';

  return {
    time24: `${String(h).padStart(2, '0')}:${paddedM}`,
    time12,
    periodLabel,
  };
}

const CITY_HI_MAP: Record<string, string> = {
  'All Indian Cities': 'सभी भारतीय शहर',
  'Bandra West, Mumbai': 'बांद्रा वेस्ट, मुंबई',
  'Kala Ghoda, Mumbai': 'काला घोड़ा, मुंबई',
  'Indiranagar, Bengaluru': 'इंदिरानगर, बेंगलुरु',
  'Khan Market, New Delhi': 'खान मार्केट, नई दिल्ली',
};

const CATEGORY_HI_MAP: Record<string, string> = {
  'All Services': 'सभी सेवाएं',
  'All Categories': 'सभी श्रेणियां',
  'Precision Haircuts': 'प्रीसिजन हेयरकट',
  'Beard Architecture': 'बियर्ड आर्किटेक्चर',
  'Traditional Shaves': 'पारंपरिक शाही शेव',
  'Complete Rituals': 'संपूर्ण ग्रूमिंग अनुष्ठान',
};

const SERVICE_HI_MAP: Record<string, string> = {
  'The Royal Bespoke Cut & Finish': 'द रॉयल बेस्पोक कट और फिनिश',
  'Precision Skin Fade & Beard Architecture': 'प्रीसिजन स्किन फेड और बियर्ड आर्किटेक्चर',
  'Hot Towel Straight-Razor Royal Shave': 'हॉट टॉवल स्ट्रेट-रेज़र रॉयल शेव',
  'Executive Scissor Crop & Scalp Ritual': 'एग्जीक्यूटिव सिज़र क्रॉप और आयुर्वेदिक चंपी',
  'Sovereign Full Grooming Experience': 'सॉवरेन संपूर्ण ग्रूमिंग अनुभव',
  'Charcoal Detox Facial & Beard Sculpt': 'चारकोल डिटॉक्स फेशियल और बियर्ड स्कल्प्ट',
};

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  tr: (en: string, hi: string) => string;
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
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('barberloo_lang');
      if (saved === 'hi' || saved === 'en') return saved;
    } catch {
      // ignore storage errors
    }
    return 'en';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      localStorage.setItem('barberloo_lang', next);
    } catch {
      // ignore storage errors
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'hi' : 'en');
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  }, [lang]);

  const value = useMemo<LanguageContextValue>(() => {
    const tr = (en: string, hi: string) => (lang === 'hi' ? hi : en);
    const formatINR = (
      amount: number | string | undefined | null,
      options?: { showDecimals?: boolean }
    ) => formatINRCurrency(amount, lang, options);
    const formatCompactINR = (amount: number) => formatINRCompact(amount, lang);
    const getINRBreakdown = (grossTotal: number, discountAmount = 0) =>
      calculateINRBreakdown(grossTotal, discountAmount, lang);

    const translateCity = (city: string) =>
      lang === 'hi' ? CITY_HI_MAP[city] || city : city;
    const translateCategory = (cat: string) =>
      lang === 'hi' ? CATEGORY_HI_MAP[cat] || cat : cat;
    const translateService = (name: string) =>
      lang === 'hi' ? SERVICE_HI_MAP[name] || name : name;

    return {
      lang,
      setLang,
      toggleLang,
      tr,
      formatINR,
      formatCompactINR,
      getINRBreakdown,
      translateCity,
      translateCategory,
      translateService,
    };
  }, [lang]);

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
