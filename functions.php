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

// Intercept all front-end routes on barberloo.in so WordPress never returns "Error: Page not found"
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (isset($_GET['wp_native']) && $_GET['wp_native'] === '1') {
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
