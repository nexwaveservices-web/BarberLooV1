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
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (isset($_GET['wp_native']) && $_GET['wp_native'] === '1') {
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
