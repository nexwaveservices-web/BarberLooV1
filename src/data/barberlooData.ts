export type PageView =
  | 'home'
  | 'shops'
  | 'shop'
  | 'booking'
  | 'customer-dashboard'
  | 'profile'
  | 'barber-dashboard'
  | 'admin-dashboard'
  | 'auth';

export const ASSETS = {
  heroCraft: '/src/assets/images/hero_barber_craft_1790869666069.jpg',
  royalInterior: '/src/assets/images/royal_barber_shop_1790869681010.jpg',
  barberMarcus: '/src/assets/images/barber_portrait_marcus_1790869694473.jpg',
  barberJulian: '/src/assets/images/barber_portrait_julian_1790869707086.jpg',
  barberDevon: '/src/assets/images/barber_portrait_marcus_1790869694473.jpg',
  serviceHotTowel: '/src/assets/images/signature_hot_towel_shave_1790869718147.jpg',
  serviceSkinFade: '/src/assets/images/hero_barber_craft_1790869666069.jpg',
  shopSovereign: '/src/assets/images/royal_barber_shop_1790869681010.jpg',
};

export interface ServiceItem {
  id: string;
  shopId?: string;
  name: string;
  category:
    | 'Precision Haircuts'
    | 'Beard Architecture'
    | 'Traditional Shaves'
    | 'Complete Rituals'
    | string;
  durationMins: number;
  price: number;
  description: string;
  popular?: boolean;
  image?: string;
  active?: boolean;
}

export interface BarberItem {
  id: string;
  uid?: string;
  shopId?: string;
  name: string;
  role: string;
  specialty: string;
  rating: number;
  reviews: number;
  experience: string;
  shopName: string;
  avatar: string;
  nextAvailable: string;
  priceFrom: number;
  bio?: string;
  active?: boolean;
  verificationStatus?: string;
}

export interface ShopItem {
  id: string;
  ownerUid?: string;
  name: string;
  district: string;
  address: string;
  phone?: string;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  verified: boolean;
  approvalStatus?: string;
  image: string;
  priceTier: string;
  minPrice?: number;
  distance: string;
  distanceMilesTenths?: number;
  tagline: string;
  about?: string;
  qrCodeUrl?: string;
}

export interface AppointmentItem {
  id: string;
  referenceCode?: string;
  shopId?: string;
  shopName: string;
  customerUid?: string;
  clientName?: string;
  clientPhone?: string;
  serviceId?: string;
  serviceName: string;
  barberId?: string;
  barberName: string;
  barberAvatar: string;
  date: string;
  time: string;
  durationMins: number;
  price: number;
  servicePrice?: number;
  platformFee?: number;
  totalPrice?: number;
  status:
    | 'Confirmed'
    | 'Completed'
    | 'Pending'
    | 'Cancelled'
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show';
  notes?: string;
  barberNotes?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  couponCode?: string;
  completionOtp?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

export interface ReviewItem {
  id: string;
  shopId?: string;
  barberId?: string;
  customerUid?: string;
  author: string;
  role: string;
  rating: number;
  date: string;
  comment: string;
  service: string;
  barber: string;
  status?: string;
}

export interface CouponItem {
  id: string;
  code: string;
  discountPercent: number;
  description: string;
  minSpend: number;
  usesCount: number;
  maxUses: number;
  status: 'Active' | 'Paused' | 'Expired';
  expiryDate: string;
}

export const DEFAULT_FALLBACK_SHOP: ShopItem = {
  id: '7fa27fef-d890-449e-b9bb-85bbfeaa2998',
  name: 'BarberLoo Flagship Salon',
  district: 'Jalandhar',
  address: 'Model Town Main Market, Jalandhar, Punjab',
  phone: '+91 98765 43210',
  rating: 4.9,
  reviewCount: 142,
  isOpen: true,
  verified: true,
  image: ASSETS.royalInterior,
  priceTier: '₹₹₹',
  minPrice: 450,
  distance: '0.4 km',
  tagline: 'Luxury Grooming & Bespoke Appointments',
  about: 'Premier master grooming delivered by expert craftsmen in a relaxed, luxurious setting.',
};

// Clean production arrays with authoritative fallback shop to guarantee zero blank screens
export const SERVICES: ServiceItem[] = [];
export const BARBERS: BarberItem[] = [];
export const SHOPS: ShopItem[] = [DEFAULT_FALLBACK_SHOP];
export const INITIAL_SHOPS: ShopItem[] = [DEFAULT_FALLBACK_SHOP];
export const INITIAL_BARBERS: BarberItem[] = BARBERS;
export const INITIAL_SERVICES: ServiceItem[] = SERVICES;
export const INITIAL_APPOINTMENTS: AppointmentItem[] = [];
export const REVIEWS: ReviewItem[] = [];
export const INITIAL_COUPONS: CouponItem[] = [];

export const OPENING_HOURS = [
  { id: 'wh-mon', day: 'Monday', hours: '09:30 – 21:00', status: 'Open', breakWindow: '14:00 – 14:45' },
  { id: 'wh-tue', day: 'Tuesday', hours: '09:30 – 21:00', status: 'Open', breakWindow: '14:00 – 14:45' },
  { id: 'wh-wed', day: 'Wednesday', hours: '09:30 – 21:30', status: 'Open', breakWindow: '14:30 – 15:15' },
  { id: 'wh-thu', day: 'Thursday', hours: '09:30 – 22:00', status: 'Late Lounge', breakWindow: '15:00 – 15:45' },
  { id: 'wh-fri', day: 'Friday', hours: '09:30 – 22:00', status: 'Late Lounge', breakWindow: '15:00 – 15:45' },
  { id: 'wh-sat', day: 'Saturday', hours: '10:00 – 21:00', status: 'Peak Hours', breakWindow: '14:00 – 14:30' },
  { id: 'wh-sun', day: 'Sunday', hours: '11:00 – 19:00', status: 'By Appointment', breakWindow: 'None' },
];

export interface PlatformSettingsItem {
  id: string;
  feeType: 'fixed' | 'percentage';
  feeAmount: number;
  minFee: number;
  refundPolicy?: 'service_only' | 'full';
  updatedAt?: string;
}

