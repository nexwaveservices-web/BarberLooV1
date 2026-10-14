// Utility functions for geolocation, distance calculation, geocoding, and directions

/**
 * Parses and validates latitude and longitude coordinates.
 * Returns null if invalid or not provided.
 */
export function parseCoordinates(
  lat?: number | string | null,
  lng?: number | string | null
): { lat: number; lng: number } | null {
  if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
    return null;
  }
  const nLat = typeof lat === 'number' ? lat : parseFloat(String(lat).trim());
  const nLng = typeof lng === 'number' ? lng : parseFloat(String(lng).trim());

  if (isNaN(nLat) || isNaN(nLng)) return null;
  if (nLat < -90 || nLat > 90 || nLng < -180 || nLng > 180) return null;
  // If coordinates are exact 0,0, treat as unset unless explicitly intentional
  if (nLat === 0 && nLng === 0) return null;

  return { lat: nLat, lng: nLng };
}

/**
 * Computes great-circle distance between two points in kilometers using Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance nicely in kilometers or meters.
 */
export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || isNaN(km)) return '';
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

export type TravelMode = 'driving' | 'walking' | 'bicycling' | 'transit';

export interface DirectionsOptions {
  destinationLat?: number | string | null;
  destinationLng?: number | string | null;
  destinationAddress?: string;
  destinationName?: string;
  originLat?: number | string | null;
  originLng?: number | string | null;
  travelMode?: TravelMode;
}

/**
 * Generates a safe, production-grade Google Maps directions URL.
 * Works seamlessly across Android, iOS, desktop browsers, and in-car navigation.
 */
export function buildGoogleMapsDirectionsUrl(opts: DirectionsOptions): string {
  const coords = parseCoordinates(opts.destinationLat, opts.destinationLng);
  let destination = '';

  if (coords) {
    destination = `${coords.lat},${coords.lng}`;
  } else if (opts.destinationAddress && opts.destinationAddress.trim()) {
    destination = encodeURIComponent(opts.destinationAddress.trim());
  } else if (opts.destinationName && opts.destinationName.trim()) {
    destination = encodeURIComponent(opts.destinationName.trim());
  } else {
    destination = 'Ludhiana,Punjab,India';
  }

  const params = new URLSearchParams({
    api: '1',
    destination: destination,
  });

  const originCoords = parseCoordinates(opts.originLat, opts.originLng);
  if (originCoords) {
    params.set('origin', `${originCoords.lat},${originCoords.lng}`);
  }

  if (opts.travelMode) {
    params.set('travelmode', opts.travelMode);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Fallback OpenStreetMap directions URL
 */
export function buildOsmDirectionsUrl(opts: DirectionsOptions): string {
  const destCoords = parseCoordinates(opts.destinationLat, opts.destinationLng);
  const origCoords = parseCoordinates(opts.originLat, opts.originLng);

  if (destCoords && origCoords) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origCoords.lat}%2C${origCoords.lng}%3B${destCoords.lat}%2C${destCoords.lng}`;
  }
  if (destCoords) {
    return `https://www.openstreetmap.org/?mlat=${destCoords.lat}&mlon=${destCoords.lng}#map=16/${destCoords.lat}/${destCoords.lng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(opts.destinationAddress || opts.destinationName || '')}`;
}

/**
 * Native or Web Navigation Intent opener
 */
export function openExternalDirections(opts: DirectionsOptions, provider: 'google' | 'osm' = 'google') {
  const url = provider === 'osm' ? buildOsmDirectionsUrl(opts) : buildGoogleMapsDirectionsUrl(opts);
  window.open(url, '_blank', 'noopener,noreferrer');
}
