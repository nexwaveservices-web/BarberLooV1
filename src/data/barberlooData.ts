export type PageView =
  | 'home'
  | 'shops'
  | 'shop'
  | 'booking'
  | 'customer-dashboard'
  | 'profile'
  | 'barber-dashboard'
  | 'admin-dashboard'
  | 'privacy-policy'
  | 'terms-of-service'
  | 'refund-policy'
  | 'disclaimer'
  | 'about-us'
  | 'contact-us'
  | 'auth';

export const ASSETS = {
  heroCraft: '/assets/images/hero_barber_craft_1790869666069.jpg',
  royalInterior: '/assets/images/royal_barber_shop_1790869681010.jpg',
  barberMarcus: '/assets/images/barber_portrait_marcus_1790869694473.jpg',
  barberJulian: '/assets/images/barber_portrait_julian_1790869707086.jpg',
  barberDevon: '/assets/images/barber_portrait_marcus_1790869694473.jpg',
  serviceHotTowel: '/assets/images/signature_hot_towel_shave_1790869718147.jpg',
  serviceSkinFade: '/assets/images/hero_barber_craft_1790869666069.jpg',
  shopSovereign: '/assets/images/royal_barber_shop_1790869681010.jpg',
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
  city?: string;
  state?: string;
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
  latitude?: string;
  longitude?: string;
  pinCode?: string;
  landmark?: string;
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
  completionOtpStatus?: string;
  payoutHoldReason?: string;
  payoutStatus?: string;
  completionVerifiedAt?: Date | string | null;
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

// Production empty initial states (all real data fetched from database / Supabase)
export const SERVICES: ServiceItem[] = [];
export const BARBERS: BarberItem[] = [];
export const SHOPS: ShopItem[] = [];
export const INITIAL_SHOPS: ShopItem[] = [];
export const INITIAL_BARBERS: BarberItem[] = [];
export const INITIAL_SERVICES: ServiceItem[] = [];
export const INITIAL_APPOINTMENTS: AppointmentItem[] = [];
export const REVIEWS: ReviewItem[] = [];
export const INITIAL_COUPONS: CouponItem[] = [];
export const OPENING_HOURS: any[] = [];

export interface PlatformSettingsItem {
  id: string;
  feeType: 'fixed' | 'percentage';
  feeAmount: number;
  minFee: number;
  refundPolicy?: 'service_only' | 'full';
  updatedAt?: string;
}

