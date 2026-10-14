import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Search,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { parseCoordinates } from '../lib/geoUtils';

interface BarberLocationPickerProps {
  address: string;
  city: string;
  state: string;
  pinCode: string;
  landmark: string;
  latitude: string;
  longitude: string;
  onChange: (fields: {
    address?: string;
    city?: string;
    state?: string;
    pinCode?: string;
    landmark?: string;
    latitude?: string;
    longitude?: string;
  }) => void;
  disabled?: boolean;
}

export const BarberLocationPicker: React.FC<BarberLocationPickerProps> = ({
  address,
  city,
  state,
  pinCode,
  landmark,
  latitude,
  longitude,
  onChange,
  disabled = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeMessage, setGeocodeMessage] = useState<string | null>(null);

  // Validate coordinates
  const parsedCoords = parseCoordinates(latitude, longitude);

  // Default coordinate if none set (Ludhiana)
  const activeLat = parsedCoords ? parsedCoords.lat : 30.9010;
  const activeLng = parsedCoords ? parsedCoords.lng : 75.8573;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [activeLat, activeLng],
        zoom: parsedCoords ? 15 : 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Custom Barber marker pin
      const iconHtml = `
        <div class="relative flex items-center justify-center cursor-move">
          <div class="w-10 h-10 rounded-2xl bg-[#5B0E14] text-[#F1E194] border-2 border-[#F1E194] shadow-2xl flex items-center justify-center ring-4 ring-[#5B0E14]/30 animate-bounce">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
          </div>
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-[#241719] text-[#FFF9E8] text-[10px] font-bold shadow">
            Shop Pin
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'barberloo-owner-picker-pin',
        html: iconHtml,
        iconSize: [40, 50],
        iconAnchor: [20, 42],
      });

      const marker = L.marker([activeLat, activeLng], {
        icon: customIcon,
        draggable: !disabled,
      });

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onChange({
          latitude: pos.lat.toFixed(6),
          longitude: pos.lng.toFixed(6),
        });
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (disabled) return;
        marker.setLatLng(e.latlng);
        onChange({
          latitude: e.latlng.lat.toFixed(6),
          longitude: e.latlng.lng.toFixed(6),
        });
      });

      marker.addTo(map);
      markerRef.current = marker;
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker position when latitude or longitude changes externally
  useEffect(() => {
    if (parsedCoords && markerRef.current && mapInstanceRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - parsedCoords.lat) > 0.0001 ||
        Math.abs(currentPos.lng - parsedCoords.lng) > 0.0001
      ) {
        markerRef.current.setLatLng([parsedCoords.lat, parsedCoords.lng]);
        mapInstanceRef.current.panTo([parsedCoords.lat, parsedCoords.lng], {
          animate: true,
        });
      }
    }
  }, [parsedCoords?.lat, parsedCoords?.lng]);

  // Geocode address from form fields to locate on map
  const handleLocateFromAddress = async () => {
    const fullQuery = [address, landmark, city, state, pinCode]
      .filter(Boolean)
      .join(', ');

    if (!fullQuery.trim()) {
      setGeocodeMessage('Please enter an address or city first to locate on map.');
      return;
    }

    setIsGeocoding(true);
    setGeocodeMessage(null);

    try {
      const res = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(fullQuery)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data[0];
          const newLat = match.lat.toFixed(6);
          const newLng = match.lng.toFixed(6);

          onChange({
            latitude: newLat,
            longitude: newLng,
          });

          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.setView([match.lat, match.lng], 16, {
              animate: true,
            });
            markerRef.current.setLatLng([match.lat, match.lng]);
          }

          setGeocodeMessage(
            `Pin placed near: ${match.displayName.slice(0, 60)}... Drag pin to exact entrance.`
          );
        } else {
          setGeocodeMessage(
            'Address not automatically pinpointed. You can click on the map to set the pin manually.'
          );
        }
      }
    } catch {
      setGeocodeMessage(
        'Could not reach geocoding service. Please click directly on the map.'
      );
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Address Form Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-1">
            Shop Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={disabled}
            value={address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="e.g. Shop 12, Main Market, Model Town"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] focus:outline-none focus:ring-1 focus:ring-[#5B0E14] disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-1">
            City <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={disabled}
            value={city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="e.g. Ludhiana"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] focus:outline-none focus:ring-1 focus:ring-[#5B0E14] disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-1">
            State <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={disabled}
            value={state}
            onChange={(e) => onChange({ state: e.target.value })}
            placeholder="e.g. Punjab"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] focus:outline-none focus:ring-1 focus:ring-[#5B0E14] disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-1">
            PIN Code
          </label>
          <input
            type="text"
            disabled={disabled}
            value={pinCode}
            onChange={(e) => onChange({ pinCode: e.target.value })}
            placeholder="e.g. 141008"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] focus:outline-none focus:ring-1 focus:ring-[#5B0E14] disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-1">
            Nearby Landmark (Optional)
          </label>
          <input
            type="text"
            disabled={disabled}
            value={landmark}
            onChange={(e) => onChange({ landmark: e.target.value })}
            placeholder="e.g. Near Maha Luxmi Mandir / Clock Tower"
            className="w-full px-3.5 py-2.5 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] focus:outline-none focus:ring-1 focus:ring-[#5B0E14] disabled:opacity-60"
          />
        </div>
      </div>

      {/* Map Setup Controls Header */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-[#111113] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[#5B0E14]" />
            <span>Map Pin & Exact Salon Entrance</span>
          </label>
          <p className="text-[11px] text-[#8A8178]">
            Click anywhere on the map or drag the pin to mark your salon's exact customer entrance.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLocateFromAddress}
          disabled={isGeocoding || disabled}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5B0E14] text-[#F1E194] text-xs font-semibold shadow hover:bg-[#4A0B10] disabled:opacity-60 transition self-start sm:self-auto"
        >
          {isGeocoding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Locating Address...</span>
            </>
          ) : (
            <>
              <Search className="w-3.5 h-3.5" />
              <span>Pinpoint from Address</span>
            </>
          )}
        </button>
      </div>

      {geocodeMessage && (
        <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{geocodeMessage}</span>
        </div>
      )}

      {/* Interactive Map Preview & Pin Dragging Container */}
      <div className="relative w-full h-[320px] rounded-3xl overflow-hidden border border-[#E5DEC9] shadow-inner bg-[#EFE9DD]">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating overlay with coordinates feedback */}
        <div className="absolute top-3 left-3 z-10 px-3 py-1.5 rounded-2xl bg-[#EFE9DD]/90 backdrop-blur-md border border-[#E5DEC9] shadow-md text-[11px] font-mono flex items-center gap-2">
          {parsedCoords ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[#111113] font-semibold">
                Lat: {parsedCoords.lat.toFixed(5)}, Lng: {parsedCoords.lng.toFixed(5)}
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-amber-900">Pin not placed yet</span>
            </>
          )}
        </div>
      </div>

      {/* Precise coordinate input fields for fine-tuning */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-[11px] font-semibold text-[#8A8178] uppercase mb-1">
            Latitude
          </label>
          <input
            type="text"
            disabled={disabled}
            value={latitude}
            onChange={(e) => onChange({ latitude: e.target.value })}
            placeholder="e.g. 30.901000"
            className="w-full px-3 py-2 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs font-mono text-[#111113]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#8A8178] uppercase mb-1">
            Longitude
          </label>
          <input
            type="text"
            disabled={disabled}
            value={longitude}
            onChange={(e) => onChange({ longitude: e.target.value })}
            placeholder="e.g. 75.857300"
            className="w-full px-3 py-2 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs font-mono text-[#111113]"
          />
        </div>
      </div>
    </div>
  );
};
