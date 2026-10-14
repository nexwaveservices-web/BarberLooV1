import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Car,
  Footprints,
  Bike,
  ExternalLink,
  Copy,
  Check,
  X,
  Compass,
} from 'lucide-react';
import {
  DirectionsOptions,
  TravelMode,
  buildGoogleMapsDirectionsUrl,
  buildOsmDirectionsUrl,
  parseCoordinates,
} from '../lib/geoUtils';

interface GetDirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  shopAddress: string;
  shopCity?: string;
  shopState?: string;
  shopPinCode?: string;
  shopLandmark?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  customerCoords?: { lat: number; lng: number } | null;
}

export const GetDirectionsModal: React.FC<GetDirectionsModalProps> = ({
  isOpen,
  onClose,
  shopName,
  shopAddress,
  shopCity,
  shopState,
  shopPinCode,
  shopLandmark,
  latitude,
  longitude,
  customerCoords,
}) => {
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const coords = parseCoordinates(latitude, longitude);
  const fullAddress = [
    shopAddress,
    shopLandmark ? `Near ${shopLandmark}` : '',
    shopCity,
    shopState,
    shopPinCode,
  ]
    .filter(Boolean)
    .join(', ');

  const dirOpts: DirectionsOptions = {
    destinationLat: coords ? coords.lat : undefined,
    destinationLng: coords ? coords.lng : undefined,
    destinationAddress: fullAddress || shopAddress,
    destinationName: shopName,
    originLat: customerCoords?.lat,
    originLng: customerCoords?.lng,
    travelMode,
  };

  const googleMapsUrl = buildGoogleMapsDirectionsUrl(dirOpts);
  const osmUrl = buildOsmDirectionsUrl(dirOpts);

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(`${shopName}\n${fullAddress}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  const handleOpenGoogle = () => {
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenOsm = () => {
    window.open(osmUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md rounded-3xl bg-[#EFE9DD] p-6 text-[#111113] shadow-2xl border border-[#E5DEC9] transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E5DEC9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#5B0E14] text-[#F1E194] flex items-center justify-center shadow-md">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-serif text-[#111113] tracking-wide">
                Get Directions
              </h3>
              <p className="text-xs text-[#8A8178]">
                Real-time external navigation to salon
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#8A8178] hover:text-[#111113] hover:bg-[#E5DEC9] transition"
            aria-label="Close directions modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Destination Card */}
        <div className="my-5 p-4 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] shadow-inner">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-[#5B0E14] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-[#111113] truncate">
                {shopName}
              </p>
              <p className="text-xs text-[#524B45] mt-0.5 leading-relaxed">
                {fullAddress || 'Verified BarberLoo partner salon'}
              </p>
              {coords ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                  Verified GPS Coordinates ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-medium border border-amber-200">
                  Using verified address destination
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Travel Mode Selector */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[#524B45] uppercase tracking-wider mb-2">
            Select Travel Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTravelMode('driving')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                travelMode === 'driving'
                  ? 'bg-[#5B0E14] text-[#F1E194] border-[#5B0E14] shadow'
                  : 'bg-[#F4EFE6] text-[#524B45] border-[#E5DEC9] hover:bg-[#E5DEC9]'
              }`}
            >
              <Car className="w-4 h-4 mb-1" />
              <span>Drive / Cab</span>
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('bicycling')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                travelMode === 'bicycling'
                  ? 'bg-[#5B0E14] text-[#F1E194] border-[#5B0E14] shadow'
                  : 'bg-[#F4EFE6] text-[#524B45] border-[#E5DEC9] hover:bg-[#E5DEC9]'
              }`}
            >
              <Bike className="w-4 h-4 mb-1" />
              <span>Two-Wheeler</span>
            </button>
            <button
              type="button"
              onClick={() => setTravelMode('walking')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition ${
                travelMode === 'walking'
                  ? 'bg-[#5B0E14] text-[#F1E194] border-[#5B0E14] shadow'
                  : 'bg-[#F4EFE6] text-[#524B45] border-[#E5DEC9] hover:bg-[#E5DEC9]'
              }`}
            >
              <Footprints className="w-4 h-4 mb-1" />
              <span>Walking</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleOpenGoogle}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#5B0E14] text-[#F1E194] font-medium text-sm shadow-md hover:bg-[#4A0B10] active:scale-[0.99] transition"
          >
            <Navigation className="w-4 h-4" />
            <span>Open in Google Maps</span>
            <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
          </button>

          <button
            type="button"
            onClick={handleOpenOsm}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[#F4EFE6] text-[#111113] font-medium text-sm border border-[#E5DEC9] hover:bg-[#E5DEC9] active:scale-[0.99] transition"
          >
            <Compass className="w-4 h-4 text-[#8A8178]" />
            <span>Alternative Map (OpenStreetMap)</span>
            <ExternalLink className="w-3.5 h-3.5 ml-auto text-[#8A8178]" />
          </button>

          <button
            type="button"
            onClick={handleCopyAddress}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs text-[#524B45] hover:text-[#111113] hover:bg-[#F4EFE6] transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">
                  Address copied to clipboard!
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy verified address</span>
              </>
            )}
          </button>
        </div>

        {/* Guidance disclaimer */}
        <p className="mt-4 text-[11px] text-center text-[#8A8178]">
          Navigation opens in your preferred external map application with verified destination coordinates.
        </p>
      </div>
    </div>
  );
};
