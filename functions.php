<?php
/**
 * BarberLoo WordPress Theme Functions (WP Pusher Bridge for barberloo.in)
 * Connected GitHub Repository: https://github.com/nexwaveservices-web/BarberLooV1
 * Renders the native BarberLoo React + Supabase SPA directly on barberloo.in (Zero iframe, Zero 404).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script'));
});

// Serve /sw.js Service Worker at root of barberloo.in for background Browser Notifications
add_action('init', function () {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? strtok($_SERVER['REQUEST_URI'], '?') : '';
    if ($request_uri === '/sw.js') {
        $sw_path = get_template_directory() . '/public/sw.js';
        if (!file_exists($sw_path)) {
            $sw_path = get_template_directory() . '/wp-assets/sw.js';
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
});

if (!function_exists('barberloo_theme_render_app')) {
    function barberloo_theme_render_app() {
        $theme_dir = get_template_directory();
        $theme_url = get_template_directory_uri();

        $css_url = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.css';
        $js_url  = 'https://cdn.jsdelivr.net/gh/nexwaveservices-web/BarberLooV1@main/wp-assets/assets/barberloo.js';

        if (file_exists($theme_dir . '/wp-assets/assets/barberloo.js')) {
            $ver = filemtime($theme_dir . '/wp-assets/assets/barberloo.js');
            $css_url = $theme_url . '/wp-assets/assets/barberloo.css?v=' . $ver;
            $js_url  = $theme_url . '/wp-assets/assets/barberloo.js?v=' . $ver;
        } elseif (file_exists($theme_dir . '/dist/assets/barberloo.js')) {
            $ver = filemtime($theme_dir . '/dist/assets/barberloo.js');
            $css_url = $theme_url . '/dist/assets/barberloo.css?v=' . $ver;
            $js_url  = $theme_url . '/dist/assets/barberloo.js?v=' . $ver;
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
}

// Intercept front-end routes while allowing WooCommerce cart, checkout, REST API, and Razorpay webhooks
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (isset($_GET['wp_native']) && $_GET['wp_native'] === '1') {
        return;
    }
    // Allow WooCommerce and Razorpay webhook passthrough
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    if (strpos($uri, '/wc-api/') !== false || strpos($uri, '/wp-json/') !== false) {
        return;
    }
    if (function_exists('is_checkout') && (is_checkout() || is_cart() || is_account_page())) {
        return;
    }

    global $wp_query;
    if ($wp_query) {
        $wp_query->is_404 = false;
    }
    status_header(200);
    echo barberloo_theme_render_app();
    exit;
}, 1);

add_shortcode('barberloo_app', function () {
    return barberloo_theme_render_app();
});

// WooCommerce + Razorpay REST Bridge for BarberLoo Appointments
add_action('rest_api_init', function () {
    register_rest_route('barberloo/v1', '/create-wc-order', [
        'methods'             => 'POST',
        'callback'            => 'barberloo_rest_create_wc_order',
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
            ], 200);
        },
        'permission_callback' => '__return_true',
    ]);
});

function barberloo_rest_create_wc_order($request) {
    if (!class_exists('WooCommerce')) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'WooCommerce is not active on this WordPress site.',
        ], 200);
    }

    $params = $request->get_json_params();
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

        // 1. Primary Service Fee / Line Item
        $item  = new WC_Order_Item_Fee();
        $item->set_name($service_name . ' (Barber: ' . $barber_name . ' · ' . $date . ' ' . $time . ' IST)');
        $item->set_amount($price);
        $item->set_total($price);
        $order->add_item($item);

        // 2. Add-ons Line Items
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
    $order = wc_get_order($order_id);
    if (!$order) return;
    $apt_id = $order->get_meta('_barberloo_appointment_id');
    if ($apt_id) {
        $order->add_order_note('BarberLoo appointment ' . $apt_id . ' confirmed & paid via Razorpay.');
    }
});
