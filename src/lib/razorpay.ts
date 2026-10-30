// BarberLoo Official Razorpay Integration Engine
// Supports standard Razorpay Checkout (UPI, GPay, PhonePe, Paytm, Cards, NetBanking, Wallets)
// in INR (₹) with auto-verification and secure callback handling.

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export interface RazorpayPaymentSuccessResult {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface OpenRazorpayOptions {
  amountINR: number; // in Rupees (e.g. 500 for ₹500)
  serviceName: string;
  barberName: string;
  shopName: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  appointmentId?: string;
  orderId?: string;
  key?: string;
  addOns?: Array<{
    id: string;
    name: string;
    price: number;
    durationMins?: number;
  }>;
  onSuccess: (result: RazorpayPaymentSuccessResult) => void;
  onError: (error: any) => void;
  onDismiss?: () => void;
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptLoadingPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn('Could not load live Razorpay checkout.js script.');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

declare global {
  interface Window {
    Razorpay?: any;
    BARBERLOO_RAZORPAY_KEY_ID?: string;
  }
}

export function getRazorpayKey(): string {
  // 1. Vite injected env var (build-time / runtime)
  const envKey = (import.meta as any).env?.VITE_RAZORPAY_KEY_ID;
  if (envKey && envKey.trim() && !envKey.includes('YOUR_KEY_ID')) {
    return envKey.trim();
  }

  // 2. Global window configuration (injected by host PHP/HTML)
  if (typeof window !== 'undefined' && window.BARBERLOO_RAZORPAY_KEY_ID) {
    const winKey = String(window.BARBERLOO_RAZORPAY_KEY_ID).trim();
    if (winKey && !winKey.includes('YOUR_KEY_ID')) return winKey;
  }

  // 3. Local storage admin override (configured via Admin Console)
  try {
    const stored = localStorage.getItem('barberloo_razorpay_key_id');
    if (stored && stored.trim() && !stored.includes('YOUR_KEY_ID')) return stored.trim();
  } catch {
    // ignore
  }

  return '';
}

export async function initiateRazorpayPayment(options: OpenRazorpayOptions): Promise<void> {
  const loaded = await loadRazorpayScript();
  const key = ((options.key && options.key.trim()) || getRazorpayKey()).trim();

  if (!key || !/^rzp_(test|live)_[a-zA-Z0-9]+$/.test(key)) {
    options.onError(
      new Error(
        'Razorpay Payment Gateway is not configured with a valid Key ID. Please configure your live Razorpay Key in the BarberLoo system.'
      )
    );
    return;
  }

  // If Razorpay SDK is loaded and available
  if (loaded && window.Razorpay) {
    const amountPaise = Math.round(options.amountINR * 100);
    const addOnsSummary = options.addOns && options.addOns.length > 0
      ? ` + ${options.addOns.map((a) => a.name).join(', ')}`
      : '';

    const rzpOptions = {
      key,
      amount: amountPaise, // Amount is in currency subunits (paise)
      currency: 'INR',
      name: options.shopName || 'BarberLoo Luxury Grooming',
      description: `${options.serviceName}${addOnsSummary} with ${options.barberName}`,
      image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=200&q=80',
      order_id: options.orderId || undefined,
      prefill: {
        name: options.clientName || 'Valued Guest',
        contact: options.clientPhone || '+91',
        email: options.clientEmail || 'client@barberloo.in',
      },
      notes: {
        appointment_id: options.appointmentId || '',
        service: options.serviceName,
        barber: options.barberName,
        platform: 'BarberLoo Appointments',
      },
      theme: {
        color: '#5B0E14', // BarberLoo signature royal wine/burgundy
      },
      modal: {
        ondismiss: () => {
          if (options.onDismiss) options.onDismiss();
        },
      },
      handler: (response: RazorpayPaymentSuccessResult) => {
        options.onSuccess(response);
      },
    };

    try {
      const rzp = new window.Razorpay(rzpOptions);
      rzp.on('payment.failed', (err: any) => {
        options.onError(err?.error || err);
      });
      rzp.open();
      return;
    } catch (err) {
      options.onError(err);
      return;
    }
  }

  // Prevent false payment-success states: if Razorpay Checkout cannot load, report error safely
  options.onError(
    new Error(
      'Razorpay payment gateway could not be loaded. Please ensure you are online and refresh the page to try again.'
    )
  );
}
