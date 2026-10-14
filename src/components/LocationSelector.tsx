import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Crosshair,
  Search,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export interface UserLocation {
  displayName: string;
  lat: number;
  lng: number;
  isGps?: boolean;
  city?: string;
}

interface LocationSelectorProps {
  currentLocation: UserLocation | null;
  onSelectLocation: (location: UserLocation | null) => void;
  className?: string;
  compact?: boolean;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  currentLocation,
  onSelectLocation,
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualLabel, setManualLabel] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    setErrorMessage(null);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your current browser.');
      return;
    }

    setIsLocating(true);
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        onSelectLocation({
          displayName: 'Current GPS Location',
          lat: latitude,
          lng: longitude,
          isGps: true,
        });
        setIsOpen(false);
      },
      (error) => {
        setIsLocating(false);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage(
            'Location permission was denied. You can easily search by city, area, landmark, or PIN code below.'
          );
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setErrorMessage(
            'GPS position is currently unavailable. Please search by area or PIN code.'
          );
        } else {
          setErrorMessage(
            'GPS request timed out. Please search manually below.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleSelectResult = (result: any) => {
    onSelectLocation({
      displayName: result.displayName,
      lat: result.lat,
      lng: result.lng,
      isGps: false,
      city: result.city,
    });
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleApplyManual = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMessage('Please enter valid coordinates (-90 to 90 lat, -180 to 180 lng).');
      return;
    }
    onSelectLocation({
      displayName: manualLabel.trim() || `Coordinates: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      lat,
      lng,
      isGps: false,
    });
    setIsOpen(false);
    setManualMode(false);
  };

  const quickCities = [
    { name: 'Ludhiana', lat: 30.9010, lng: 75.8573 },
    { name: 'Maha Luxmi Nagar', lat: 30.8987, lng: 75.8645 },
    { name: 'Jalandhar', lat: 31.3260, lng: 75.5762 },
    { name: 'Model Town', lat: 31.3130, lng: 75.5866 },
    { name: 'Amritsar', lat: 31.6340, lng: 74.8723 },
    { name: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
    { name: 'Delhi NCR', lat: 28.6139, lng: 77.2090 },
  ];

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all text-xs font-medium ${
          currentLocation
            ? 'bg-[#5B0E14] text-[#F1E194] border-[#5B0E14] shadow-sm'
            : 'bg-[#F4EFE6] text-[#111113] border-[#E5DEC9] hover:bg-[#EAE4D7]'
        } ${compact ? 'text-[11px] py-1.5 px-2.5' : ''}`}
        aria-label="Select customer location for nearby shops"
      >
        <MapPin className={`w-3.5 h-3.5 ${currentLocation ? 'text-[#F1E194]' : 'text-[#5B0E14]'}`} />
        <span className="truncate max-w-[140px] sm:max-w-[200px]">
          {currentLocation ? currentLocation.displayName.split(',')[0] : 'Search Area / PIN'}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
      </button>

      {/* Dropdown Modal */}
      {isOpen && (
        <div
          ref={modalRef}
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-[320px] sm:w-[380px] rounded-3xl bg-[#EFE9DD] p-4 text-[#111113] shadow-2xl border border-[#E5DEC9] z-50 animate-fadeIn"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#E5DEC9]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#5B0E14] text-[#F1E194] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-[#111113]">Choose Location</h4>
                <p className="text-[11px] text-[#8A8178]">Find barbershops near you</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-[#8A8178] hover:text-[#111113] hover:bg-[#E5DEC9]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active location summary & clear */}
          {currentLocation && (
            <div className="mt-3 p-2.5 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-[#111113] font-medium truncate">
                  {currentLocation.displayName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(null);
                  setIsOpen(false);
                }}
                className="text-[11px] text-[#5B0E14] hover:underline font-semibold ml-2 shrink-0"
              >
                Clear
              </button>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-snug">{errorMessage}</p>
            </div>
          )}

          {/* GPS Quick Action */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleUseGps}
              disabled={isLocating}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#5B0E14] text-[#F1E194] text-xs font-semibold shadow hover:bg-[#4A0B10] disabled:opacity-60 transition"
            >
              {isLocating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Detecting GPS Location...</span>
                </>
              ) : (
                <>
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="mt-3">
            <label className="block text-[11px] font-semibold text-[#8A8178] uppercase tracking-wider mb-1">
              Search City, Area, Landmark or PIN
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A8178] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Maha Luxmi Nagar, 141008, Model Town..."
                className="w-full pl-8 pr-8 py-2 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] text-xs text-[#111113] placeholder-[#8A8178] focus:outline-none focus:ring-1 focus:ring-[#5B0E14]"
              />
              {isSearching ? (
                <Loader2 className="w-3 h-3 text-[#5B0E14] animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
              ) : searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8A8178] hover:text-[#111113]"
                >
                  <X className="w-3 h-3" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Search Results Dropdown List */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] divide-y divide-[#E5DEC9]">
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectResult(res)}
                  className="w-full text-left p-2.5 hover:bg-[#EAE4D7] text-xs text-[#111113] flex items-start gap-2 transition"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#5B0E14] shrink-0 mt-0.5" />
                  <span className="truncate leading-tight">{res.displayName}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Hub Suggestions */}
          <div className="mt-3">
            <div className="text-[11px] font-semibold text-[#8A8178] mb-1.5">
              Popular Areas & Hubs
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickCities.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() =>
                    handleSelectResult({
                      displayName: `${c.name}, Punjab, India`,
                      lat: c.lat,
                      lng: c.lng,
                    })
                  }
                  className="px-2.5 py-1 rounded-xl bg-[#F4EFE6] border border-[#E5DEC9] text-[11px] text-[#524B45] hover:bg-[#5B0E14] hover:text-[#F1E194] transition"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Manual Entry Toggle */}
          <div className="mt-3 pt-2.5 border-t border-[#E5DEC9] flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setManualMode(!manualMode)}
              className="text-[#5B0E14] font-semibold hover:underline"
            >
              {manualMode ? 'Hide manual coordinates' : 'Enter location manually'}
            </button>
            <span className="text-[#8A8178]">No GPS required</span>
          </div>

          {manualMode && (
            <div className="mt-2.5 p-3 rounded-2xl bg-[#F4EFE6] border border-[#E5DEC9] space-y-2">
              <input
                type="text"
                placeholder="Area or Label (optional)"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#E5DEC9] text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 30.9010)"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#E5DEC9] text-xs"
                />
                <input
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 75.8573)"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#E5DEC9] text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyManual}
                className="w-full py-1.5 rounded-xl bg-[#5B0E14] text-[#F1E194] text-xs font-semibold"
              >
                Apply Custom Coordinates
              </button>
            </div>
          )}

          {/* Privacy Note */}
          <p className="mt-3 text-[10px] text-center text-[#8A8178]">
            Your location is only used locally to calculate nearby distance and is never permanently stored on our servers.
          </p>
        </div>
      )}
    </div>
  );
};
