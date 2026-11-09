<?php
/**
 * BarberLoo WordPress Theme Entry Point for WP Pusher (barberloo.in)
 * Connected Repository: https://github.com/nexwaveservices-web/BarberLooV1
 * Renders the native BarberLoo React + Supabase SPA directly on barberloo.in (Zero iframe, Zero 404).
 */
if (!defined('ABSPATH')) {
    exit;
}

if (function_exists('barberloo_is_admin_or_system_request') && barberloo_is_admin_or_system_request()) {
    return;
}

status_header(200);

if (function_exists('barberloo_theme_render_app')) {
    echo barberloo_theme_render_app();
    exit;
}

if (function_exists('barberloo_render_application')) {
    echo barberloo_render_application(true);
    exit;
}

$site_url = function_exists('site_url') ? site_url() : 'https://barberloo.in';
$site_host = rtrim($site_url, '/');
$cdn_js  = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.js';
$cdn_css = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.css';
$theme_js  = $site_host . '/wp-content/themes/BarberLooV1/wp-assets/assets/barberloo.js';
$theme_css = $site_host . '/wp-content/themes/BarberLooV1/wp-assets/assets/barberloo.css';

if (!headers_sent()) {
    header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(self)');
}
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Discovery &amp; Appointment Booking | barberloo.in</title>
    <meta name="description" content="Discover trusted master barbers, browse bespoke grooming services, and book confirmed appointments with real-time availability." />
    <meta property="og:title" content="BarberLoo — Luxury Barber Discovery &amp; Appointment Booking" />
    <meta property="og:description" content="Discover trusted master barbers, browse bespoke grooming services, and book confirmed appointments with real-time availability." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://barberloo.in" />
    <link rel="canonical" href="https://barberloo.in" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link id="barberloo-css" rel="stylesheet" crossorigin href="<?php echo esc_url($theme_css); ?>" onerror="this.onerror=null;this.href='<?php echo esc_url($cdn_css); ?>';" />
  </head>
  <body class="bg-[#FAF6EA] text-[#111113] antialiased selection:bg-[#5B0E14] selection:text-[#FFF9E8]">
    <div id="root">
      <div id="barberloo-preloader" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#FAF6EA;color:#111113;font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:24px;text-align:center;">
        <div style="width:68px;height:68px;border-radius:20px;background:#5B0E14;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(91,14,20,0.28);margin-bottom:20px;">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#F1E194" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
            <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
            <line x1="8.12" y1="8.12" x2="12" y2="12"></line>
          </svg>
        </div>
        <h1 style="font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:700;letter-spacing:0.06em;color:#111113;margin:0 0 6px 0;">BARBERLOO</h1>
        <p style="font-size:12px;color:#8A8178;font-weight:600;margin:0 0 18px 0;letter-spacing:0.12em;text-transform:uppercase;">Luxury Barber Discovery &amp; Booking</p>
        <div style="width:130px;height:3px;background:rgba(91,14,20,0.1);border-radius:999px;overflow:hidden;position:relative;">
          <div style="width:40%;height:100%;background:#5B0E14;border-radius:999px;animation:barberlooShimmer 1.4s infinite ease-in-out;"></div>
        </div>
        <style>
          @keyframes barberlooShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        </style>
      </div>
    </div>
    <script>
      window.BARBERLOO_RAZORPAY_KEY_ID = "<?php echo esc_js(defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : get_option('barberloo_razorpay_key_id', 'rzp_live_TxxTT810pVluT8')); ?>";
      window.BARBERLOO_BACKEND_URL = "<?php echo esc_js(defined('BARBERLOO_BACKEND_URL') ? BARBERLOO_BACKEND_URL : get_option('barberloo_backend_url', '')); ?>";
      
      (function() {
        var candidates = [
          "<?php echo esc_js($theme_js); ?>",
          "<?php echo esc_js($cdn_js); ?>"
        ];
        var attempted = {};
        var idx = 0;
        function tryNext() {
          if (window.__BARBERLOO_MOUNTED__) return;
          while (idx < candidates.length) {
            var url = candidates[idx++];
            if (url && !attempted[url]) {
              attempted[url] = true;
              var s = document.createElement('script');
              s.type = 'module';
              s.crossOrigin = 'anonymous';
              s.src = url;
              s.onerror = function() {
                tryNext();
              };
              document.body.appendChild(s);
              return;
            }
          }
        }
        tryNext();
      })();
    </script>
  </body>
</html>
