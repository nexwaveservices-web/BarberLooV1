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

function barberloo_render_application($full_viewport = true) {
    $plugin_dir = plugin_dir_path(__FILE__);
    $plugin_url = plugin_dir_url(__FILE__);

    $css_url = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.css';
    $js_url  = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.js';

    if (file_exists($plugin_dir . 'wp-assets/assets/barberloo.js')) {
        $ver = filemtime($plugin_dir . 'wp-assets/assets/barberloo.js');
        $css_url = $plugin_url . 'wp-assets/assets/barberloo.css?v=' . $ver;
        $js_url  = $plugin_url . 'wp-assets/assets/barberloo.js?v=' . $ver;
    } elseif (file_exists($plugin_dir . 'dist/assets/barberloo.js')) {
        $ver = filemtime($plugin_dir . 'dist/assets/barberloo.js');
        $css_url = $plugin_url . 'dist/assets/barberloo.css?v=' . $ver;
        $js_url  = $plugin_url . 'dist/assets/barberloo.js?v=' . $ver;
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
    <link rel="stylesheet" crossorigin href="<?php echo esc_url($css_url); ?>" />
  </head>
  <body class="bg-[#FAF6EA] text-[#111113] antialiased selection:bg-[#5B0E14] selection:text-[#FFF9E8]">
    <div id="root"></div>
    <script type="module" crossorigin src="<?php echo esc_url($js_url); ?>"></script>
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

// WooCommerce & Razorpay Plugin REST Bridge for BarberLoo Appointments & Add-ons
add_action('rest_api_init', function () {
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
