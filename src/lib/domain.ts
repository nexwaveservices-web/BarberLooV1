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
 * Generates the authoritative Salon QR Destination URL for a given shop ID.
 * Example: https://barberloo.in/booking.html?shop_id=shop-1790996769501
 */
export function getShopQrDestinationUrl(
  shopId: string,
  options?: {
    domain?: string;
    useHomeFormat?: boolean;
  }
): string {
  const cleanId = (shopId || '').trim();
  const domain = normalizeDomain(options?.domain || DEFAULT_CANONICAL_DOMAIN);

  if (!cleanId) {
    return `${domain}/booking.html`;
  }

  if (options?.useHomeFormat) {
    return `${domain}/?shop_id=${encodeURIComponent(cleanId)}`;
  }

  return `${domain}/booking.html?shop_id=${encodeURIComponent(cleanId)}`;
}
