<?php
/**
 * Plugin Name: BarberLoo Platform (WP Pusher GitHub Bridge)
 * Plugin URI: https://barberloo.in
 * Description: Official BarberLoo Luxury Barber Booking & Salon Discovery Platform connected via WP Pusher from https://github.com/nexwaveservices-web/BarberLooV1 and Supabase.
 * Version: 1.0.1
 * Author: NexWave Services (BarberLoo)
 * Author URI: https://barberloo.in
 * License: GPL v2 or later
 * GitHub Plugin URI: nexwaveservices-web/BarberLooV1
 * GitHub Branch: main
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BARBERLOO_VERSION', '1.0.1');
define('BARBERLOO_DOMAIN', 'https://barberloo.in');
define('BARBERLOO_GITHUB_REPO', 'https://github.com/nexwaveservices-web/BarberLooV1');
define('BARBERLOO_SUPABASE_URL', 'https://ddusvfylhifoniobzmcq.supabase.co');

/**
 * Guard to verify if the incoming request is for WordPress Administration,
 * WP Pusher plugin management, system crons, AJAX, REST API, or WooCommerce endpoints.
 * When true, BarberLoo strictly prevents hijacking or redirecting the request.
 */
if (!function_exists('barberloo_is_admin_or_system_request')) {
    function barberloo_is_admin_or_system_request() {
        if (is_admin()) {
            return true;
        }
        if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
            return true;
        }
        if (function_exists('wp_doing_cron') && wp_doing_cron()) {
            return true;
        }
        if (defined('DOING_CRON') && DOING_CRON) {
            return true;
        }
        if (defined('DOING_AJAX') && DOING_AJAX) {
            return true;
        }

        $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        $path = strtok($uri, '?');

        // Strictly protect WordPress admin dashboard, WP Pusher, login, and core files
        if (
            strpos($path, '/wp-admin') !== false ||
            strpos($path, 'wp-login.php') !== false ||
            strpos($path, 'wp-register.php') !== false ||
            strpos($path, 'wp-signup.php') !== false ||
            strpos($path, 'wp-trackback.php') !== false ||
            strpos($path, 'xmlrpc.php') !== false ||
            strpos($path, 'wp-cron.php') !== false ||
            strpos($path, '/wp-json/') !== false ||
            strpos($path, '/wc-api/') !== false ||
            strpos($path, '/wp-content/') !== false ||
            strpos($path, '/wp-includes/') !== false
        ) {
            return true;
        }

        // Native WordPress escape parameter for testing/debugging
        if (isset($_GET['wp_native']) && $_GET['wp_native'] === '1') {
            return true;
        }

        return false;
    }
}

// 1. Permalinks & Rewrite Rules Setup
add_action('init', function () {
    // Register query variables for BarberLoo clean permalinks
    add_rewrite_tag('%barberloo_route%', '([^&]+)');
    add_rewrite_tag('%barberloo_slug%', '([^&]+)');

    // Professional clean permalinks
    add_rewrite_rule('^shops/?$', 'index.php?barberloo_route=shops', 'top');
    add_rewrite_rule('^shop/([^/]+)/?$', 'index.php?barberloo_route=shop&barberloo_slug=$matches[1]', 'top');
    add_rewrite_rule('^book-appointment/?$', 'index.php?barberloo_route=booking', 'top');
    add_rewrite_rule('^signup/?$', 'index.php?barberloo_route=signup', 'top');
    add_rewrite_rule('^login/?$', 'index.php?barberloo_route=login', 'top');
    add_rewrite_rule('^my-bookings/?$', 'index.php?barberloo_route=my-bookings', 'top');
    add_rewrite_rule('^my-account/?$', 'index.php?barberloo_route=my-account', 'top');
    add_rewrite_rule('^partner/register/?$', 'index.php?barberloo_route=partner-register', 'top');
    add_rewrite_rule('^partner/?$', 'index.php?barberloo_route=partner-register', 'top');
    add_rewrite_rule('^barber/dashboard/?$', 'index.php?barberloo_route=barber-dashboard', 'top');
    add_rewrite_rule('^barber/services/?$', 'index.php?barberloo_route=barber-services', 'top');
    add_rewrite_rule('^barber/appointments/?$', 'index.php?barberloo_route=barber-appointments', 'top');
    add_rewrite_rule('^admin-dashboard/?$', 'index.php?barberloo_route=admin-dashboard', 'top');
    add_rewrite_rule('^admin/?$', 'index.php?barberloo_route=admin-dashboard', 'top');
});

add_filter('query_vars', function ($vars) {
    $vars[] = 'barberloo_route';
    $vars[] = 'barberloo_slug';
    return $vars;
});

// Serve /sw.js Service Worker at the root of barberloo.in
add_action('init', function () {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? strtok($_SERVER['REQUEST_URI'], '?') : '';
    if ($request_uri === '/sw.js') {
        $sw_path = plugin_dir_path(__FILE__) . 'public/sw.js';
        if (!file_exists($sw_path)) {
            $sw_path = plugin_dir_path(__FILE__) . 'wp-assets/sw.js';
        }
        header('Content-Type: application/javascript; charset=utf-8');
        header('Service-Worker-Allowed: /');
        header('Cache-Control: no-cache, no-store, must-revalidate');
        if (file_exists($sw_path)) {
            readfile($sw_path);
        } else {
            echo "self.addEventListener('install', () => self.skipWaiting());\n";
            echo "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));\n";
        }
        exit;
    }

    // CRITICAL FIX: If this is a WordPress admin, WP Pusher, or system request, DO NOT INTERCEPT!
    if (barberloo_is_admin_or_system_request()) {
        return;
    }

    // Only intercept recognized BarberLoo frontend query page parameters
    $allowed_frontend_pages = [
        'shop',
        'shops',
        'booking',
        'book-appointment',
        'my-bookings',
        'customer-dashboard',
        'barber-dashboard',
        'admin-dashboard',
        'profile',
        'my-account',
        'signup',
        'login',
        'partner',
    ];
    $is_recognized_frontend_page = isset($_GET['page']) && in_array(strtolower(trim($_GET['page'])), $allowed_frontend_pages, true);

    // Deep-route interception for frontend single-page application
    $is_frontend_deep_route = (
        $request_uri === '/booking.html' ||
        $request_uri === '/booking' ||
        $request_uri === '/book-appointment' ||
        $request_uri === '/shop' ||
        $request_uri === '/shops' ||
        strpos($request_uri, '/shop/') === 0 ||
        strpos($request_uri, '/barber/') === 0 ||
        strpos($request_uri, '/my-bookings') === 0 ||
        strpos($request_uri, '/my-account') === 0 ||
        $is_recognized_frontend_page ||
        isset($_GET['shop']) ||
        isset($_GET['shop_id'])
    );

    if ($is_frontend_deep_route) {
        status_header(200);
        echo barberloo_render_application(true);
        exit;
    }
});

if (!function_exists('barberloo_resolve_production_assets')) {
    function barberloo_resolve_production_assets() {
        $theme_dir = function_exists('get_template_directory') ? get_template_directory() : '';
        $theme_url = function_exists('get_template_directory_uri') ? get_template_directory_uri() : '';
        $site_url  = function_exists('site_url') ? site_url() : 'https://barberloo.in';
        $site_host = rtrim($site_url, '/');

        // High-availability global CDN fallback (100% reachable with HTTP 200 via jsdelivr)
        $cdn_js  = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.js';
        $cdn_css = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.css';

        $theme_web_js  = $site_host . '/wp-content/themes/BarberLooV1/wp-assets/assets/barberloo.js';
        $theme_web_css = $site_host . '/wp-content/themes/BarberLooV1/wp-assets/assets/barberloo.css';
        $plugin_web_js  = $site_host . '/wp-content/plugins/BarberLooV1/wp-assets/assets/barberloo.js';
        $plugin_web_css = $site_host . '/wp-content/plugins/BarberLooV1/wp-assets/assets/barberloo.css';

        $ver = time();
        $primary_js  = '';
        $primary_css = '';

        // 1. Direct active theme inspection
        if (!empty($theme_dir) && file_exists($theme_dir . '/wp-assets/assets/barberloo.js')) {
            $ver = filemtime($theme_dir . '/wp-assets/assets/barberloo.js');
            $primary_js  = $theme_url . '/wp-assets/assets/barberloo.js?v=' . $ver;
            $primary_css = $theme_url . '/wp-assets/assets/barberloo.css?v=' . $ver;
        } elseif (!empty($theme_dir) && file_exists($theme_dir . '/dist/assets/barberloo.js')) {
            $ver = filemtime($theme_dir . '/dist/assets/barberloo.js');
            $primary_js  = $theme_url . '/dist/assets/barberloo.js?v=' . $ver;
            $primary_css = $theme_url . '/dist/assets/barberloo.css?v=' . $ver;
        }

        // 2. Relative to current file directory
        if (empty($primary_js)) {
            $curr_dir = dirname(__FILE__);
            if (file_exists($curr_dir . '/wp-assets/assets/barberloo.js')) {
                $ver = filemtime($curr_dir . '/wp-assets/assets/barberloo.js');
                if (strpos($curr_dir, '/themes/') !== false) {
                    $primary_js  = $theme_web_js . '?v=' . $ver;
                    $primary_css = $theme_web_css . '?v=' . $ver;
                } else {
                    $primary_js  = $plugin_web_js . '?v=' . $ver;
                    $primary_css = $plugin_web_css . '?v=' . $ver;
                }
            }
        }

        // 3. Fallback to theme web asset path
        if (empty($primary_js)) {
            $primary_js  = $theme_web_js;
            $primary_css = $theme_web_css;
        }

        return [
            'primary_js'  => $primary_js,
            'primary_css' => $primary_css,
            'theme_js'    => $theme_web_js,
            'theme_css'   => $theme_web_css,
            'plugin_js'   => $plugin_web_js,
            'cdn_js'      => $cdn_js,
            'cdn_css'     => $cdn_css,
            'version'     => $ver,
        ];
    }
}

function barberloo_render_application($full_viewport = true) {
    $assets = barberloo_resolve_production_assets();

    // Prevent stale page caching of HTML wrapper and enforce defense headers
    if (!headers_sent()) {
        header('Cache-Control: no-cache, no-store, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=(self)');
    }

    ob_start();
    ?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Booking &amp; Salon Discovery | barberloo.in</title>
    <meta name="description" content="Discover trusted master barbers, book bespoke grooming appointments, and manage salon schedules seamlessly. DISCOVER • BOOK • CUT • REPEAT." />
    <meta property="og:title" content="BarberLoo — Luxury Barber Booking &amp; Salon Discovery" />
    <meta property="og:description" content="Discover trusted master barbers, book bespoke grooming appointments, and manage salon schedules seamlessly." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://barberloo.in" />
    <link rel="canonical" href="https://barberloo.in" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,600&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    
    <!-- Primary Stylesheet with automatic CDN recovery -->
    <link id="barberloo-css" rel="stylesheet" crossorigin href="<?php echo esc_url($assets['primary_css']); ?>" onerror="this.onerror=null;this.href='<?php echo esc_url($assets['cdn_css']); ?>';" />
  </head>
  <body class="bg-[#FAF6EA] text-[#111113] antialiased selection:bg-[#5B0E14] selection:text-[#FFF9E8]">
    <div id="root">
      <!-- Luxury Pre-Mount Loader (Replaced by React on mount; guarantees zero white screen on new devices) -->
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
      
      // Self-Healing Multi-Tier Asset Loader:
      // Tries Primary Path -> Theme Path -> CDN Path. Prevents 404 white screens completely.
      (function() {
        var candidates = [
          "<?php echo esc_js($assets['primary_js']); ?>",
          "<?php echo esc_js($assets['theme_js']); ?>",
          "<?php echo esc_js($assets['cdn_js']); ?>"
        ];
        
        var attempted = {};
        var currentIndex = 0;
        
        function tryNextScript() {
          if (window.__BARBERLOO_MOUNTED__) return;
          while (currentIndex < candidates.length) {
            var url = candidates[currentIndex++];
            if (url && !attempted[url]) {
              attempted[url] = true;
              loadScript(url, function() {
                tryNextScript();
              });
              return;
            }
          }
          showRecovery('Application script could not be loaded from primary or fallback servers. Please refresh or check your internet connection.');
        }
        
        function loadScript(src, onError) {
          var s = document.createElement('script');
          s.type = 'module';
          s.crossOrigin = 'anonymous';
          s.src = src;
          s.onerror = function(err) {
            console.warn('[BarberLoo Asset Recovery]: Bundle load failed for ' + src + ', falling back...');
            if (onError) onError(err);
          };
          document.body.appendChild(s);
        }
        
        function showRecovery(msg) {
          var el = document.getElementById('barberloo-preloader');
          if (el) {
            el.innerHTML = '<div style="max-width:380px;background:#241719;color:#FFF9E8;padding:26px;border-radius:22px;border:1px solid rgba(241,225,148,0.25);box-shadow:0 20px 40px rgba(0,0,0,0.3);text-align:center;">' +
              '<h2 style="font-family:\'Cormorant Garamond\',serif;font-size:22px;font-weight:700;color:#FFF9E8;margin-bottom:8px;">Temporarily Unavailable</h2>' +
              '<p style="font-size:12px;color:#8A8178;line-height:1.6;margin-bottom:18px;">' + (msg || 'The BarberLoo interface could not load properly.') + '</p>' +
              '<button onclick="window.location.reload(true)" style="padding:10px 20px;border-radius:12px;background:#F1E194;color:#111113;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;border:none;">Refresh Page</button>' +
              '</div>';
          }
        }
        
        tryNextScript();
        
        setTimeout(function() {
          if (!window.__BARBERLOO_MOUNTED__) {
            var pre = document.getElementById('barberloo-preloader');
            if (pre) {
              showRecovery('Page loading took longer than expected. Tap below to reload.');
            }
          }
        }, 9000);
      })();
    </script>
  </body>
</html>
    <?php
    return ob_get_clean();
}

add_shortcode('barberloo_app', function () {
    return barberloo_render_application(false);
});

add_action('template_redirect', function () {
    if (barberloo_is_admin_or_system_request()) {
        return;
    }

    // Allow WooCommerce checkout, cart, API, and native account pages
    if (function_exists('is_checkout') && (is_checkout() || is_cart() || is_account_page())) {
        return;
    }

    $takeover_enabled = get_option('barberloo_frontpage_takeover', 'yes');
    if ($takeover_enabled === 'yes') {
        global $wp_query;
        if ($wp_query) {
            $wp_query->is_404 = false;
        }
        status_header(200);
        echo barberloo_render_application(true);
        exit;
    }
}, 1);

// Native Razorpay & WooCommerce Plugin REST Bridge for BarberLoo Appointments (WP Pusher / InfinityFree)
add_action('rest_api_init', function () {
    // 1. Native Razorpay Order Creation via PHP (Works on InfinityFree with no Node.js needed!)
    register_rest_route('barberloo/v1', '/create-razorpay-order', [
        'methods'             => 'POST',
        'callback'            => 'barberloo_plugin_create_razorpay_order',
        'permission_callback' => '__return_true',
    ]);

    // 2. Native Razorpay Cryptographic Signature Verification via PHP HMAC SHA256
    register_rest_route('barberloo/v1', '/verify-razorpay-payment', [
        'methods'             => 'POST',
        'callback'            => 'barberloo_plugin_verify_razorpay_payment',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('barberloo/v1', '/create-wc-order', [
        'methods'             => 'POST',
        'callback'            => 'barberloo_plugin_create_wc_order',
        'permission_callback' => '__return_true',
    ]);

    register_rest_route('barberloo/v1', '/wc-status', [
        'methods'             => 'GET',
        'callback'            => function () {
            $wc_active = class_exists('WooCommerce');
            $rzp_active = false;
            if ($wc_active) {
                $available_gateways = function_exists('WC') && WC()->payment_gateways ? WC()->payment_gateways->get_available_payment_gateways() : [];
                $rzp_active = isset($available_gateways['razorpay']) || class_exists('WC_Razorpay');
            }
            return new WP_REST_Response([
                'woocommerce_active' => $wc_active,
                'razorpay_active'    => $rzp_active,
                'currency'           => function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : 'INR',
                'plugin'             => 'barberloo-platform',
            ], 200);
        },
        'permission_callback' => '__return_true',
    ]);
});

function barberloo_plugin_get_razorpay_credentials() {
    // 1. Secret MUST come from server environment (wp-config.php or OS env), never hardcoded
    $key_id = defined('RAZORPAY_KEY_ID') ? RAZORPAY_KEY_ID : getenv('RAZORPAY_KEY_ID');
    $key_secret = defined('RAZORPAY_KEY_SECRET') ? RAZORPAY_KEY_SECRET : getenv('RAZORPAY_KEY_SECRET');
    
    // 2. Fall back to secure database wp_options if set via admin settings
    if (empty($key_id)) {
        $key_id = get_option('barberloo_razorpay_key_id', 'rzp_live_TxxTT810pVluT8');
    }
    if (empty($key_secret)) {
        $key_secret = get_option('barberloo_razorpay_key_secret', '');
    }

    return [
        'key_id' => trim((string)$key_id),
        'key_secret' => trim((string)$key_secret),
    ];
}

function barberloo_plugin_create_razorpay_order($request) {
    // 1. If dedicated Node.js backend is configured, forward order creation to it
    $backend_url = defined('BARBERLOO_BACKEND_URL') ? BARBERLOO_BACKEND_URL : get_option('barberloo_backend_url', '');
    if (!empty($backend_url)) {
        $backend_endpoint = rtrim($backend_url, '/') . '/api/payments/razorpay/create-order';
        $response = wp_remote_post($backend_endpoint, [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode($request->get_json_params() ?? []),
            'timeout' => 20,
        ]);
        if (!is_wp_error($response)) {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            $status_code = wp_remote_retrieve_response_code($response);
            return new WP_REST_Response($data, $status_code ?: 200);
        }
    }

    $creds = barberloo_plugin_get_razorpay_credentials();
    $key_id = $creds['key_id'];
    $key_secret = $creds['key_secret'];

    $params = $request->get_json_params();
    $amount_inr = floatval($params['amount'] ?? 500);
    $amount_paise = round($amount_inr * 100);
    $receipt = sanitize_text_field($params['receipt'] ?? ('bl_' . time()));
    $notes = isset($params['notes']) && is_array($params['notes']) ? $params['notes'] : [];

    // If key ID & secret configured in WordPress, create authentic Razorpay order via Razorpay API
    if (!empty($key_id) && !empty($key_secret) && strpos($key_id, 'YOUR_KEY_ID') === false) {
        $auth = base64_encode($key_id . ':' . $key_secret);
        $response = wp_remote_post('https://api.razorpay.com/v1/orders', [
            'headers' => [
                'Authorization' => 'Basic ' . $auth,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode([
                'amount'   => $amount_paise,
                'currency' => 'INR',
                'receipt'  => $receipt,
                'notes'    => $notes,
            ]),
            'timeout' => 20,
        ]);

        if (!is_wp_error($response)) {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            if (isset($data['id'])) {
                return new WP_REST_Response([
                    'success'     => true,
                    'orderId'     => $data['id'],
                    'amount'      => $data['amount'],
                    'currency'    => $data['currency'] ?? 'INR',
                    'keyId'       => $key_id,
                    'totalAmount' => $amount_inr,
                ], 200);
            }
        }
    }

    // Return keyId without an invalid orderId so standard checkout opens smoothly without crashing
    return new WP_REST_Response([
        'success'     => true,
        'orderId'     => null,
        'amount'      => $amount_paise,
        'currency'    => 'INR',
        'keyId'       => !empty($key_id) ? $key_id : '',
        'totalAmount' => $amount_inr,
    ], 200);
}

function barberloo_plugin_verify_razorpay_payment($request) {
    $params = $request->get_json_params();
    $order_id = sanitize_text_field($params['razorpay_order_id'] ?? '');
    $payment_id = sanitize_text_field($params['razorpay_payment_id'] ?? '');
    $signature = sanitize_text_field($params['razorpay_signature'] ?? '');

    if (empty($payment_id)) {
        return new WP_REST_Response([
            'verified' => false,
            'error'    => 'Missing payment ID',
        ], 400);
    }

    // 1. If dedicated Node.js backend is configured, forward verification request to it
    $backend_url = defined('BARBERLOO_BACKEND_URL') ? BARBERLOO_BACKEND_URL : get_option('barberloo_backend_url', '');
    if (!empty($backend_url)) {
        $backend_endpoint = rtrim($backend_url, '/') . '/api/payments/razorpay/verify';
        $response = wp_remote_post($backend_endpoint, [
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode([
                'razorpay_order_id'   => $order_id,
                'razorpay_payment_id' => $payment_id,
                'razorpay_signature'  => $signature,
            ]),
            'timeout' => 15,
        ]);
        if (!is_wp_error($response)) {
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            $status_code = wp_remote_retrieve_response_code($response);
            return new WP_REST_Response($data, $status_code ?: 200);
        }
    }

    // 2. Local cryptographic verification if secret is present in WordPress config
    $creds = barberloo_plugin_get_razorpay_credentials();
    $key_secret = $creds['key_secret'];

    if (!empty($order_id) && !empty($signature) && !empty($key_secret)) {
        $expected_sig = hash_hmac('sha256', $order_id . '|' . $payment_id, $key_secret);
        if (hash_equals($expected_sig, $signature)) {
            return new WP_REST_Response([
                'verified'  => true,
                'paymentId' => $payment_id,
                'orderId'   => $order_id,
            ], 200);
        }
        return new WP_REST_Response([
            'verified' => false,
            'error'    => 'Invalid cryptographic signature.',
        ], 400);
    }

    // Strictly reject unverified requests - NEVER trust frontend success without cryptographic HMAC signature
    return new WP_REST_Response([
        'verified' => false,
        'error'    => 'Payment verification failed: cryptographic signature and secret are required. Please configure RAZORPAY_KEY_SECRET or set BARBERLOO_BACKEND_URL.',
    ], 400);
}

function barberloo_plugin_create_wc_order($request) {
    if (!class_exists('WooCommerce')) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'WooCommerce is not active on this WordPress site.',
        ], 200);
    }

    $params       = $request->get_json_params();
    $service_name = sanitize_text_field($params['serviceName'] ?? 'Bespoke Grooming');
    $barber_name  = sanitize_text_field($params['barberName'] ?? 'Master Barber');
    $price        = floatval($params['price'] ?? 500);
    $client_name  = sanitize_text_field($params['clientName'] ?? 'Guest');
    $client_phone = sanitize_text_field($params['clientPhone'] ?? '');
    $client_email = sanitize_email($params['clientEmail'] ?? 'guest@barberloo.in');
    $date         = sanitize_text_field($params['date'] ?? '');
    $time         = sanitize_text_field($params['time'] ?? '');
    $apt_id       = sanitize_text_field($params['appointmentId'] ?? '');
    $add_ons      = $params['addOns'] ?? [];

    try {
        $order = wc_create_order();

        // 1. Primary Service Line Item
        $item = new WC_Order_Item_Fee();
        $item->set_name($service_name . ' (Barber: ' . $barber_name . ' · ' . $date . ' ' . $time . ' IST)');
        $item->set_amount($price);
        $item->set_total($price);
        $order->add_item($item);

        // 2. Add-on Services Line Items
        if (!empty($add_ons) && is_array($add_ons)) {
            foreach ($add_ons as $addon) {
                $addon_name  = sanitize_text_field($addon['name'] ?? 'Add-on Service');
                $addon_price = floatval($addon['price'] ?? 0);
                if ($addon_price > 0) {
                    $addon_item = new WC_Order_Item_Fee();
                    $addon_item->set_name('[Add-on] ' . $addon_name);
                    $addon_item->set_amount($addon_price);
                    $addon_item->set_total($addon_price);
                    $order->add_item($addon_item);
                }
            }
            $order->update_meta_data('_barberloo_addons', wp_json_encode($add_ons));
        }

        $order->set_billing_first_name($client_name);
        $order->set_billing_email($client_email);
        $order->set_billing_phone($client_phone);
        $order->set_payment_method('razorpay');
        $order->set_payment_method_title('Razorpay (UPI / Card / NetBanking)');

        $order->update_meta_data('_barberloo_appointment_id', $apt_id);
        $order->update_meta_data('_barberloo_service', $service_name);
        $order->update_meta_data('_barberloo_barber', $barber_name);
        $order->update_meta_data('_barberloo_slot', $date . ' ' . $time . ' IST');

        $order->calculate_totals();
        $order->save();

        return new WP_REST_Response([
            'success'     => true,
            'orderId'     => $order->get_id(),
            'orderKey'    => $order->get_order_key(),
            'checkoutUrl' => $order->get_checkout_payment_url(),
            'status'      => $order->get_status(),
            'total'       => $order->get_total(),
        ], 200);
    } catch (Exception $e) {
        return new WP_REST_Response([
            'success' => false,
            'message' => $e->getMessage(),
        ], 500);
    }
}

// Hook to update BarberLoo appointment when WooCommerce order completes via Razorpay
add_action('woocommerce_payment_complete', function ($order_id) {
    if (!function_exists('wc_get_order')) return;
    $order = wc_get_order($order_id);
    if (!$order) return;
    $apt_id = $order->get_meta('_barberloo_appointment_id');
    if ($apt_id) {
        $order->add_order_note('BarberLoo appointment ' . $apt_id . ' confirmed & paid via WooCommerce Razorpay Gateway.');
    }
});
