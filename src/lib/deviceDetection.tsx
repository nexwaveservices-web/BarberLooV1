/**
 * BarberLoo Smart Device & Capability Detection System
 * 
 * Provides responsive breakpoint evaluation, pointer capability detection,
 * touch availability, orientation awareness, and touchscreen laptop classification.
 * No user-agent spoofing; purely hardware & viewport capability-based.
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type DeviceBreakpoint =
  | 'small-mobile' // <= 480px
  | 'large-mobile' // 481px - 767px
  | 'tablet'       // 768px - 1023px
  | 'laptop'       // 1024px - 1439px
  | 'desktop';     // >= 1440px

export type DeviceOrientation = 'portrait' | 'landscape';

export interface DeviceCapabilities {
  // Dimensions
  width: number;
  height: number;
  
  // Breakpoint Flags
  breakpoint: DeviceBreakpoint;
  isSmallMobile: boolean;  // <= 480px (iPhone SE, Android compact)
  isLargeMobile: boolean;  // 481px - 767px (iPhone Pro Max, Pixel XL)
  isMobile: boolean;       // < 768px
  isTablet: boolean;       // 768px - 1023px (iPad mini/air, Galaxy Tab)
  isLaptop: boolean;       // 1024px - 1439px (MacBook Air/Pro 13", Windows laptops 1366x768)
  isDesktop: boolean;      // >= 1440px (iMac, external 2K/4K monitors)
  isDesktopOrLaptop: boolean; // >= 1024px
  
  // Input Capabilities
  hasTouch: boolean;
  hasFinePointer: boolean;
  hasCoarsePointer: boolean;
  canHover: boolean;
  isTouchscreenLaptop: boolean; // Touch + Fine Mouse/Trackpad on >= 1024px screen
  
  // Orientation
  orientation: DeviceOrientation;
  isPortrait: boolean;
  isLandscape: boolean;
  
  // Dashboard Preferred Layout Style
  dashboardLayout: 'sidebar' | 'compact-tabs' | 'bottom-nav';
}

function calculateCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      breakpoint: 'laptop',
      isSmallMobile: false,
      isLargeMobile: false,
      isMobile: false,
      isTablet: false,
      isLaptop: true,
      isDesktop: false,
      isDesktopOrLaptop: true,
      hasTouch: false,
      hasFinePointer: true,
      hasCoarsePointer: false,
      canHover: true,
      isTouchscreenLaptop: false,
      orientation: 'landscape',
      isPortrait: false,
      isLandscape: true,
      dashboardLayout: 'sidebar',
    };
  }

  const width = window.innerWidth || document.documentElement.clientWidth || 1024;
  const height = window.innerHeight || document.documentElement.clientHeight || 768;

  // Breakpoints
  let breakpoint: DeviceBreakpoint = 'laptop';
  if (width <= 480) {
    breakpoint = 'small-mobile';
  } else if (width < 768) {
    breakpoint = 'large-mobile';
  } else if (width < 1024) {
    breakpoint = 'tablet';
  } else if (width < 1440) {
    breakpoint = 'laptop';
  } else {
    breakpoint = 'desktop';
  }

  const isSmallMobile = breakpoint === 'small-mobile';
  const isLargeMobile = breakpoint === 'large-mobile';
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isLaptop = width >= 1024 && width < 1440;
  const isDesktop = width >= 1440;
  const isDesktopOrLaptop = width >= 1024;

  // Media queries for pointer & hover capabilities
  const hasFinePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: fine)').matches
    : true;

  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  const canHover = typeof window.matchMedia === 'function'
    ? window.matchMedia('(hover: hover)').matches
    : true;

  const hasTouch =
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0));

  // Touchscreen laptop detection (e.g. Surface, ThinkPad Touch, iPad Pro with Magic Keyboard)
  const isTouchscreenLaptop = hasTouch && (hasFinePointer || canHover) && isDesktopOrLaptop;

  // Orientation
  const isLandscape = width >= height;
  const orientation: DeviceOrientation = isLandscape ? 'landscape' : 'portrait';

  // Dashboard Preferred Layout
  // - Desktop/Laptop: Sidebar navigation for executive overview
  // - Tablet: Adaptive horizontal segmented control with icons
  // - Mobile: Segmented tabs with touch targets >= 44px
  let dashboardLayout: 'sidebar' | 'compact-tabs' | 'bottom-nav' = 'sidebar';
  if (isMobile) {
    dashboardLayout = 'bottom-nav';
  } else if (isTablet) {
    dashboardLayout = 'compact-tabs';
  } else {
    dashboardLayout = 'sidebar';
  }

  return {
    width,
    height,
    breakpoint,
    isSmallMobile,
    isLargeMobile,
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    isDesktopOrLaptop,
    hasTouch,
    hasFinePointer,
    hasCoarsePointer,
    canHover,
    isTouchscreenLaptop,
    orientation,
    isPortrait: !isLandscape,
    isLandscape,
    dashboardLayout,
  };
}

const DeviceContext = createContext<DeviceCapabilities>(calculateCapabilities());

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>(() => calculateCapabilities());

  useEffect(() => {
    let timeoutId: any = null;

    const handleUpdate = () => {
      // Debounce window resize to ensure 60fps responsiveness without layout thrashing
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setCapabilities(calculateCapabilities());
      }, 60);
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    // Pointer / hover media query listeners
    let finePointerQuery: MediaQueryList | null = null;
    let hoverQuery: MediaQueryList | null = null;

    if (typeof window.matchMedia === 'function') {
      try {
        finePointerQuery = window.matchMedia('(pointer: fine)');
        hoverQuery = window.matchMedia('(hover: hover)');

        if (finePointerQuery?.addEventListener) {
          finePointerQuery.addEventListener('change', handleUpdate);
        }
        if (hoverQuery?.addEventListener) {
          hoverQuery.addEventListener('change', handleUpdate);
        }
      } catch {
        // Fallback for older browsers
      }
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
      if (finePointerQuery?.removeEventListener) {
        finePointerQuery.removeEventListener('change', handleUpdate);
      }
      if (hoverQuery?.removeEventListener) {
        hoverQuery.removeEventListener('change', handleUpdate);
      }
    };
  }, []);

  return (
    <DeviceContext.Provider value={capabilities}>
      {children}
    </DeviceContext.Provider>
  );
};

export function useDevice(): DeviceCapabilities {
  return useContext(DeviceContext);
}
