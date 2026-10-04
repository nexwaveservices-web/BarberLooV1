/**
 * BarberLoo — Booking Initialization Module (booking.js)
 * Production Supabase queries for Shop, Services & Barbers
 */
(function () {
  'use strict';

  function getSupabaseClient() {
    return window.barberLooSupabase || null;
  }

  function parseShopId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('shop_id') || params.get('shop') || '';
  }

  async function loadBookingData(shopId) {
    const cleanId = (shopId || parseShopId()).trim();
    if (!cleanId) {
      console.log('BOOKING SHOP ID:', null);
      console.log('SHOP RESULT:', null);
      console.log('SERVICES RESULT:', 0);
      console.log('BARBERS RESULT:', 0);
      console.log('SELECTED SHOP:', null);
      return { error: 'missing_shop', message: 'No barber shop was selected.' };
    }

    const supa = getSupabaseClient();
    if (!supa) {
      return { error: 'no_client', message: 'Supabase client not initialized.' };
    }

    // 1. Load shop
    const { data: shop, error: shopErr } = await supa
      .from('shops')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (shopErr || !shop) {
      console.log('BOOKING SHOP ID:', cleanId);
      console.log('SHOP RESULT:', null);
      console.log('SERVICES RESULT:', 0);
      console.log('BARBERS RESULT:', 0);
      console.log('SELECTED SHOP:', null);
      return { error: 'shop_not_found', message: "We couldn't find this shop." };
    }

    // 2. Load services
    const { data: services, error: srvErr } = await supa
      .from('services')
      .select('*')
      .eq('shop_id', cleanId);

    const activeServices = (services || []).filter(
      (s) => s.active !== false && s.is_active !== false
    );

    // 3. Load barbers
    const { data: barbers, error: brbErr } = await supa
      .from('barbers')
      .select('*')
      .eq('shop_id', cleanId);

    const activeBarbers = (barbers || []).filter(
      (b) => b.active !== false && b.is_active !== false
    );

    console.log('BOOKING SHOP ID:', cleanId);
    console.log('SHOP RESULT:', shop);
    console.log('SERVICES RESULT:', activeServices.length);
    console.log('BARBERS RESULT:', activeBarbers.length);
    console.log('SELECTED SHOP:', shop.name);

    return {
      shop,
      services: activeServices,
      barbers: activeBarbers,
      error: null,
    };
  }

  window.barberLooBooking = {
    parseShopId,
    loadBookingData,
  };
})();
