import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Star,
  Navigation,
  Compass,
  Crosshair,
  Maximize2,
  ExternalLink,
  X,
  Phone,
  Clock,
  Scissors,
  AlertCircle,
} from 'lucide-react';
import { ShopItem } from '../data/barberlooData';
import { parseCoordinates, calculateDistanceKm, formatDistance } from '../lib/geoUtils';
import { UserLocation } from './LocationSelector';

interface ShopMapViewProps {
  shops: ShopItem[];
  selectedShop?: ShopItem | null;
  onSelectShop: (shop: ShopItem) => void;
  onOpenDirections: (shop: ShopItem) => void;
  customerLocation: UserLocation | null;
  className?: string;
}

export const ShopMapView: React.FC<ShopMapViewProps> = ({
  shops,
  selectedShop,
  onSelectShop,
  onOpenDirections,
  customerLocation,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [id: string]: L.Marker }>({});
  const customerMarkerRef = useRef<L.Marker | null>(null);

  const [previewShop, setPreviewShop] = useState<ShopItem | null>(selectedShop || null);

  // Filter shops that have valid coordinates
  const validCoordinateShops = useMemo(() => {
    return shops
      .map((s) => {
        const coords = parseCoordinates(s.latitude, s.longitude);
        return {
          shop: s,
          coords,
        };
      })
      .filter((item): item is { shop: ShopItem; coords: { lat: number; lng: number } } => item.coords !== null);
  }, [shops]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default to Ludhiana / Punjab coordinates
      const initialLat = customerLocation?.lat || 30.9010;
      const initialLng = customerLocation?.lng || 75.8573;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: false, // Custom position
        attributionControl: true,
      });

      // Standard OpenStreetMap tiles (free, reliable, zero secret keys)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Add Zoom control at top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
        customerMarkerRef.current = null;
      }
    };
  }, []);

  // Update Markers when validCoordinateShops or previewShop change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    const bounds = L.latLngBounds([]);

    // Add Shop Markers
    validCoordinateShops.forEach(({ shop, coords }) => {
      const isSelected = previewShop?.id === shop.id;

      // Custom BarberLoo luxury pin
      const iconHtml = `
        <div class="relative group cursor-pointer transition-transform duration-200 ${
          isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'
        }">
          <div class="w-9 h-9 rounded-2xl flex items-center justify-center shadow-lg border-2 ${
            isSelected
              ? 'bg-[#5B0E14] text-[#F1E194] border-[#F1E194] ring-4 ring-[#5B0E14]/30'
              : 'bg-[#5B0E14] text-[#F1E194] border-[#E5DEC9]'
          }">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
          </div>
          ${
            shop.minPrice
              ? `<div class="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                  isSelected
                    ? 'bg-[#F1E194] text-[#5B0E14]'
                    : 'bg-[#241719] text-[#FFF9E8]'
                }">₹${shop.minPrice}</div>`
              : ''
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'barberloo-custom-marker',
        html: iconHtml,
        iconSize: [36, 44],
        iconAnchor: [18, 36],
      });

      const marker = L.marker([coords.lat, coords.lng], { icon: customIcon });

      marker.on('click', () => {
        setPreviewShop(shop);
        map.panTo([coords.lat, coords.lng], { animate: true });
      });

      marker.addTo(map);
      markersRef.current[shop.id] = marker;
      bounds.extend([coords.lat, coords.lng]);
    });

    // Add Customer Location Marker if available
    if (customerLocation) {
      if (customerMarkerRef.current) {
        customerMarkerRef.current.remove();
      }

      const userIconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-6 h-6 rounded-full bg-blue-500/30 animate-ping absolute"></div>
          <div class="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md z-10"></div>
        </div>
      `;

      const userIcon = L.divIcon({
        className: 'barberloo-user-marker',
        html: userIconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const customerMarker = L.marker([customerLocation.lat, customerLocation.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      });

      customerMarker.bindTooltip('Your Location', {
        permanent: false,
        direction: 'top',
      });

      customerMarker.addTo(map);
      customerMarkerRef.current = customerMarker;
      bounds.extend([customerLocation.lat, customerLocation.lng]);
    } else if (customerMarkerRef.current) {
      customerMarkerRef.current.remove();
      customerMarkerRef.current = null;
    }

    // Fit bounds if we have points
    if (bounds.isValid()) {
      if (validCoordinateShops.length === 1 && !customerLocation) {
        map.setView(
          [validCoordinateShops[0].coords.lat, validCoordinateShops[0].coords.lng],
          14
        );
      } else {
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 15,
          animate: true,
        });
      }
    }
  }, [validCoordinateShops, customerLocation, previewShop?.id]);

  // Recenter map on customer or all shops
  const handleRecenter = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (customerLocation) {
      map.setView([customerLocation.lat, customerLocation.lng], 14, { animate: true });
    } else if (validCoordinateShops.length > 0) {
      const bounds = L.latLngBounds(
        validCoordinateShops.map((item) => [item.coords.lat, item.coords.lng])
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
    } else {
      map.setView([30.9010, 75.8573], 12, { animate: true });
    }
  };

  // Compute distance for preview shop if coords available
  const previewDistance = useMemo(() => {
    if (!previewShop || !customerLocation) return null;
    const coords = parseCoordinates(previewShop.latitude, previewShop.longitude);
    if (!coords) return null;
    return calculateDistanceKm(
      customerLocation.lat,
      customerLocation.lng,
      coords.lat,
      coords.lng
    );
  }, [previewShop, customerLocation]);

  return (
    <div className={`relative w-full h-[520px] md:h-[620px] rounded-3xl overflow-hidden border border-[#E5DEC9] bg-[#EFE9DD] shadow-lg ${className}`}>
      {/* The Leaflet Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Header Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 max-w-[calc(100%-80px)]">
        <div className="px-3 py-1.5 rounded-2xl bg-[#EFE9DD]/90 backdrop-blur-md border border-[#E5DEC9] shadow-md text-xs font-semibold text-[#111113] flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-[#5B0E14]" />
          <span>
            {validCoordinateShops.length} mapped{' '}
            {validCoordinateShops.length === 1 ? 'salon' : 'salons'}
          </span>
        </div>

        {customerLocation && (
          <div className="px-3 py-1.5 rounded-2xl bg-blue-50/90 backdrop-blur-md border border-blue-200 shadow-md text-xs font-medium text-blue-900 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="truncate max-w-[150px]">
              Near {customerLocation.displayName.split(',')[0]}
            </span>
          </div>
        )}
      </div>

      {/* Floating Recenter Action Button */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter Map"
        className="absolute bottom-6 right-4 z-10 p-3 rounded-2xl bg-[#EFE9DD] hover:bg-[#F4EFE6] text-[#5B0E14] border border-[#E5DEC9] shadow-xl transition active:scale-95"
        aria-label="Recenter map"
      >
        <Crosshair className="w-5 h-5" />
      </button>

      {/* If No Shops have coordinates warning */}
      {validCoordinateShops.length === 0 && (
        <div className="absolute inset-x-4 top-16 z-10 p-4 rounded-2xl bg-amber-50/95 backdrop-blur-md border border-amber-200 text-amber-900 text-xs shadow-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <p className="font-semibold">No shops with valid map coordinates</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Shops without stored coordinates remain fully accessible in the List View.
            </p>
          </div>
        </div>
      )}

      {/* Selected Shop Preview Bottom Sheet / Card */}
      {previewShop && (
        <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[380px] z-20 animate-fadeIn">
          <div className="rounded-3xl bg-[#EFE9DD]/95 backdrop-blur-md p-4 border border-[#E5DEC9] shadow-2xl text-[#111113]">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setPreviewShop(null)}
              className="absolute top-3 right-3 p-1 rounded-xl text-[#8A8178] hover:text-[#111113] hover:bg-[#E5DEC9]"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3">
              {/* Thumbnail */}
              <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#E5DEC9] bg-[#E5DEC9]">
                <img
                  src={previewShop.image || '/assets/images/royal_barber_shop_1790869681010.jpg'}
                  alt={previewShop.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-sm text-[#111113] truncate">
                    {previewShop.name}
                  </h4>
                  {previewShop.verified && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                      Verified
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {previewShop.rating || '5.0'}
                  </span>
                  <span className="text-[#8A8178]">
                    ({previewShop.reviewCount || 0} reviews)
                  </span>
                </div>

                <p className="text-xs text-[#524B45] truncate mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#5B0E14] shrink-0" />
                  <span className="truncate">
                    {previewShop.district || previewShop.city || previewShop.address}
                  </span>
                </p>

                {/* Distance Badge if available */}
                {previewDistance !== null && (
                  <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1E194]/40 text-[#5B0E14] text-[11px] font-semibold">
                    <Navigation className="w-3 h-3" />
                    <span>{formatDistance(previewDistance)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price & Action Buttons */}
            <div className="mt-3 pt-3 border-t border-[#E5DEC9] flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-[#8A8178] block">Starting from</span>
                <span className="text-sm font-bold text-[#5B0E14]">
                  ₹{previewShop.minPrice || 450}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDirections(previewShop)}
                  className="px-3 py-2 rounded-xl bg-[#F4EFE6] text-[#5B0E14] border border-[#E5DEC9] hover:bg-[#EAE4D7] text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Get Directions"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Get Directions</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectShop(previewShop)}
                  className="px-4 py-2 rounded-xl bg-[#5B0E14] text-[#F1E194] hover:bg-[#4A0B10] text-xs font-bold shadow-sm transition active:scale-95"
                >
                  View Shop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
