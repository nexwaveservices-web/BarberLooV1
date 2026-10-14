/**
 * BarberLoo — Canonical Domain & Instant Salon QR Destination Utility
 *
 * Ensures all Salon QR Destinations and deep links use the authoritative
 * production domain (https://barberloo.in) rather than ephemeral Cloud Run
 * preview URLs (e.g. ais-dev-*.run.app).
 */

export const DEFAULT_CANONICAL_DOMAIN = 'https://barberloo.in';

/**
 * Normalizes a domain URL ensuring https protocol and no trailing slash.
 */
export function normalizeDomain(rawDomain?: string): string {
  if (!rawDomain || typeof rawDomain !== 'string') {
    return DEFAULT_CANONICAL_DOMAIN;
  }
  let clean = rawDomain.trim();
  if (!clean) return DEFAULT_CANONICAL_DOMAIN;

  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  clean = clean.replace(/\/+$/, '');

  // Protect against temporary Cloud Run preview subdomains leaking into official QR destinations
  if (clean.includes('run.app') || clean.includes('localhost') || clean.includes('127.0.0.1')) {
    return DEFAULT_CANONICAL_DOMAIN;
  }

  return clean;
}

/**
 * Resolves the active production domain for QR destinations and canonical URLs.
 * Always prefers the configured production domain (barberloo.in) over
 * sandbox/preview subdomains (ais-dev-*.run.app / ais-pre-*.run.app / localhost).
 */
export function getProductionDomain(platformSettings?: any): string {
  if (platformSettings?.customDomain) {
    const custom = normalizeDomain(platformSettings.customDomain);
    if (custom && !custom.includes('run.app') && !custom.includes('localhost')) {
      return custom;
    }
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    // If the user is currently browsing on their actual live production domain, use it
    if (hostname === 'barberloo.in' || hostname === 'www.barberloo.in') {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }

  // In all other environments (including Cloud Run preview, Vite dev, etc.),
  // always use the authoritative domain requested by the user.
  return DEFAULT_CANONICAL_DOMAIN;
}

/**
 * Generates a clean, URL-safe slug from any string.
 * Example: "Pawan Hair Saloon" -> "pawan-hair-saloon"
 */
export function slugify(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns a stable, human-readable slug for a shop.
 * Prefers qrCodeSlug, then slugified shop name, then shop ID.
 */
export function getShopSlug(shop: { id?: string; name?: string; qrCodeSlug?: string } | null | undefined): string {
  if (!shop) return '';
  if (shop.qrCodeSlug && typeof shop.qrCodeSlug === 'string' && shop.qrCodeSlug.trim()) {
    return slugify(shop.qrCodeSlug);
  }
  if (shop.name && typeof shop.name === 'string' && shop.name.trim()) {
    return slugify(shop.name);
  }
  return shop.id ? slugify(shop.id) : '';
}

/**
 * Resolves a shop from an array of shops by matching slug, qrCodeSlug, id, or name.
 */
export function findShopBySlugOrId(shops: any[], slugOrId: string): any {
  if (!slugOrId || !Array.isArray(shops) || shops.length === 0) return null;
  const target = decodeURIComponent(slugOrId).toLowerCase().trim().replace(/^\/+|\/+$/g, '');
  if (!target) return null;

  return (
    shops.find((s) => s?.id && s.id.toLowerCase() === target) ||
    shops.find((s) => s?.qrCodeSlug && s.qrCodeSlug.toLowerCase() === target) ||
    shops.find((s) => getShopSlug(s) === target) ||
    shops.find((s) => slugify(s?.name || '') === target) ||
    shops.find((s) => String(s?.name || '').toLowerCase() === target) ||
    null
  );
}

/**
 * Generates the clean permalink URL for a shop details page.
 * Example: https://barberloo.in/shop/royal-gents-salon/
 */
export function getShopPermalinkUrl(shop: any, domain?: string): string {
  const base = normalizeDomain(domain || DEFAULT_CANONICAL_DOMAIN);
  const slug = getShopSlug(shop);
  return slug ? `${base}/shop/${slug}/` : `${base}/shops/`;
}

/**
 * Generates the clean permalink URL for booking.
 * Example: https://barberloo.in/book-appointment/ or https://barberloo.in/book-appointment/?shop=royal-gents-salon
 */
export function getBookingPermalinkUrl(shop?: any, domain?: string): string {
  const base = normalizeDomain(domain || DEFAULT_CANONICAL_DOMAIN);
  if (shop) {
    const slug = getShopSlug(shop);
    return slug ? `${base}/book-appointment/?shop=${slug}` : `${base}/book-appointment/`;
  }
  return `${base}/book-appointment/`;
}

/**
 * Generates the authoritative Salon QR Destination URL for a given shop.
 * Example: https://barberloo.in/shop/pawan-hair-saloon-ludhiana/
 * Fully backwards compatible with legacy ?shop_id= parameters.
 */
export function getShopQrDestinationUrl(
  shopIdOrShop: string | any,
  options?: {
    domain?: string;
    useHomeFormat?: boolean;
    useLegacyFormat?: boolean;
  }
): string {
  const domain = normalizeDomain(options?.domain || DEFAULT_CANONICAL_DOMAIN);

  let cleanId = '';
  let slug = '';
  if (typeof shopIdOrShop === 'string') {
    cleanId = shopIdOrShop.trim();
    slug = slugify(cleanId);
  } else if (shopIdOrShop && typeof shopIdOrShop === 'object') {
    cleanId = (shopIdOrShop.id || '').trim();
    slug = getShopSlug(shopIdOrShop);
  }

  if (!cleanId && !slug) {
    return `${domain}/book-appointment/`;
  }

  if (options?.useLegacyFormat) {
    return `${domain}/booking.html?shop_id=${encodeURIComponent(cleanId || slug)}`;
  }

  if (options?.useHomeFormat) {
    return `${domain}/?shop_id=${encodeURIComponent(cleanId || slug)}`;
  }

  // Authoritative clean shop permalink
  return `${domain}/shop/${slug || cleanId}/`;
}
