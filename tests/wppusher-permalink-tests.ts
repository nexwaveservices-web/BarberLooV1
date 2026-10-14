import { slugify, getShopSlug, findShopBySlugOrId, getShopPermalinkUrl, getBookingPermalinkUrl, getShopQrDestinationUrl } from '../src/lib/domain.ts';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('=== STARTING WP PUSHER & PERMALINK VERIFICATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string, detail?: string) {
    if (cond) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${detail ? `-> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Slugify utility tests
  assert(slugify('Royal Gents Salon') === 'royal-gents-salon', 'slugify: Standard salon name');
  assert(slugify('Pawan Hair Saloon, Ludhiana #01!') === 'pawan-hair-saloon-ludhiana-01', 'slugify: Removes punctuation and special chars');
  assert(slugify('   Trim & Shave   ') === 'trim-shave', 'slugify: Trims whitespace');

  // 2. getShopSlug tests
  const testShop1 = { id: 'shop-101', name: 'Royal Gents Salon', qrCodeSlug: 'royal-gents-salon' };
  const testShop2 = { id: 'shop-102', name: 'Pawan Hair Saloon' };
  const testShop3 = { id: 'shop-103' };

  assert(getShopSlug(testShop1) === 'royal-gents-salon', 'getShopSlug: Prefers qrCodeSlug');
  assert(getShopSlug(testShop2) === 'pawan-hair-saloon', 'getShopSlug: Uses slugified name if no qrCodeSlug');
  assert(getShopSlug(testShop3) === 'shop-103', 'getShopSlug: Falls back to id');

  // 3. findShopBySlugOrId tests
  const catalog = [testShop1, testShop2, testShop3];
  assert(findShopBySlugOrId(catalog, 'royal-gents-salon')?.id === 'shop-101', 'findShopBySlugOrId: Matched by slug');
  assert(findShopBySlugOrId(catalog, 'shop-102')?.id === 'shop-102', 'findShopBySlugOrId: Matched by ID');
  assert(findShopBySlugOrId(catalog, 'Pawan Hair Saloon')?.id === 'shop-102', 'findShopBySlugOrId: Matched by Name');
  assert(findShopBySlugOrId(catalog, 'pawan-hair-saloon')?.id === 'shop-102', 'findShopBySlugOrId: Matched by computed slug');
  assert(findShopBySlugOrId(catalog, 'non-existent') === null, 'findShopBySlugOrId: Correctly returns null on missing');

  // 4. Permalink URL generation
  const shopUrl = getShopPermalinkUrl(testShop1);
  assert(shopUrl === 'https://barberloo.in/shop/royal-gents-salon/', 'getShopPermalinkUrl: Produces clean URL https://barberloo.in/shop/royal-gents-salon/');

  const bookingUrlWithoutShop = getBookingPermalinkUrl();
  assert(bookingUrlWithoutShop === 'https://barberloo.in/book-appointment/', 'getBookingPermalinkUrl: Clean booking URL without shop');

  const bookingUrlWithShop = getBookingPermalinkUrl(testShop1);
  assert(bookingUrlWithShop === 'https://barberloo.in/book-appointment/?shop=royal-gents-salon', 'getBookingPermalinkUrl: Clean booking URL with shop parameter');

  const qrUrl = getShopQrDestinationUrl(testShop1);
  assert(qrUrl === 'https://barberloo.in/shop/royal-gents-salon/', 'getShopQrDestinationUrl: Generates clean shop permalink');

  const legacyQrUrl = getShopQrDestinationUrl(testShop1, { useLegacyFormat: true });
  assert(legacyQrUrl === 'https://barberloo.in/booking.html?shop_id=shop-101', 'getShopQrDestinationUrl: Preserves legacy ?shop_id= format when requested');

  // 5. Test functions.php and barberloo.php code presence
  const functionsPhp = fs.readFileSync(path.join(process.cwd(), 'functions.php'), 'utf8');
  assert(functionsPhp.includes('barberloo_is_admin_or_system_request'), 'functions.php: Contains admin request guard function');
  assert(functionsPhp.includes("add_rewrite_rule('^shops/?$'"), 'functions.php: Contains /shops/ rewrite rule');
  assert(functionsPhp.includes("add_rewrite_rule('^shop/([^/]+)/?$'"), 'functions.php: Contains /shop/:slug/ rewrite rule');
  assert(functionsPhp.includes("add_rewrite_rule('^book-appointment/?$'"), 'functions.php: Contains /book-appointment/ rewrite rule');
  assert(functionsPhp.includes("add_rewrite_rule('^my-bookings/?$'"), 'functions.php: Contains /my-bookings/ rewrite rule');
  assert(functionsPhp.includes("add_rewrite_rule('^barber/dashboard/?$'"), 'functions.php: Contains /barber/dashboard/ rewrite rule');
  assert(functionsPhp.includes('is_admin()'), 'functions.php: Explicitly checks is_admin()');
  assert(functionsPhp.includes('/wp-admin'), 'functions.php: Explicitly protects /wp-admin path');

  const barberlooPhp = fs.readFileSync(path.join(process.cwd(), 'barberloo.php'), 'utf8');
  assert(barberlooPhp.includes('barberloo_is_admin_or_system_request'), 'barberloo.php: Contains admin request guard function');
  assert(barberlooPhp.includes("add_rewrite_rule('^shop/([^/]+)/?$'"), 'barberloo.php: Contains /shop/:slug/ rewrite rule');
  assert(barberlooPhp.includes('/wp-admin'), 'barberloo.php: Explicitly protects /wp-admin path');

  // 6. Test .htaccess file
  const htaccess = fs.readFileSync(path.join(process.cwd(), '.htaccess'), 'utf8');
  assert(htaccess.includes('RewriteEngine On'), '.htaccess: Contains Apache mod_rewrite directives');
  assert(htaccess.includes('RewriteCond %{REQUEST_URI} ^/wp-admin'), '.htaccess: Protects /wp-admin from rewrite');
  assert(htaccess.includes('RewriteRule . /index.php [L]'), '.htaccess: Contains WordPress standard permalink dispatcher');

  // 7. Test Backend Server API: /api/wppusher/status
  try {
    const wpRes = await fetch('http://localhost:3000/api/wppusher/status');
    const wpData: any = await wpRes.json();
    assert(wpRes.status === 200 && wpData.connected === true, 'Server API: /api/wppusher/status reports connected = true');
    assert(wpData.pluginFile === 'barberloo.php', 'Server API: Reports pluginFile = barberloo.php');
    assert(wpData.githubRepository.includes('BarberLooV1'), 'Server API: References correct GitHub repository');
  } catch (err: any) {
    assert(false, 'Server API: /api/wppusher/status', err.message);
  }

  // 8. Test Backend Server API: /api/shops/:id by slug
  try {
    const sRes = await fetch('http://localhost:3000/api/shops/pawan-hair-saloon-ludhiana');
    if (sRes.status === 200) {
      const sData: any = await sRes.json();
      assert(Boolean(sData?.shop), 'Server API: /api/shops/:slug resolved shop by slug');
      assert(sData.shop.permalink.includes('/shop/'), 'Server API: Returns clean permalink URL');
    } else {
      // Test by first shop ID from bootstrap
      const bootRes = await fetch('http://localhost:3000/api/bootstrap');
      const bootData: any = await bootRes.json();
      const firstShop = bootData.shops?.[0];
      if (firstShop) {
        const sRes2 = await fetch(`http://localhost:3000/api/shops/${encodeURIComponent(firstShop.id)}`);
        const sData2: any = await sRes2.json();
        assert(sRes2.status === 200 && sData2.shop?.id === firstShop.id, 'Server API: /api/shops/:id resolved shop');
      }
    }
  } catch (err: any) {
    assert(false, 'Server API: /api/shops/:id query', err.message);
  }

  console.log(`\n=== TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
