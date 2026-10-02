import React, { useState } from 'react';
import { Scissors } from 'lucide-react';
import { ASSETS } from '../data/barberlooData';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

function resolveValidImageSrc(rawSrc: string): string {
  if (!rawSrc) return '';
  if (rawSrc.includes('royal_shop_interior_') || rawSrc.includes('shop_sovereign_lounge_')) {
    return ASSETS.royalInterior;
  }
  if (rawSrc.includes('barber_portrait_marcus_') || rawSrc.includes('barber_portrait_devon_')) {
    return ASSETS.barberMarcus;
  }
  if (rawSrc.includes('barber_portrait_julian_')) {
    return ASSETS.barberJulian;
  }
  if (rawSrc.includes('service_hot_towel_shave_')) {
    return ASSETS.serviceHotTowel;
  }
  if (rawSrc.includes('service_skin_fade_')) {
    return ASSETS.serviceSkinFade;
  }
  return rawSrc;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);
  const resolvedSrc = resolveValidImageSrc(src);

  if (hasError || !resolvedSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#241719] via-[#5B0E14] to-[#111113] text-[#F1E194] p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Scissors className="w-8 h-8 mb-2 opacity-80 stroke-[1.25]" />
        <span className="font-display text-sm tracking-wide text-[#FFF9E8] opacity-90">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
