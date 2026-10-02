<?php
/**
 * BarberLoo WordPress Theme Functions (WP Pusher Bridge for barberloo.in)
 * Connected GitHub Repository: https://github.com/nexwaveservices-web/BarberLooV1
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('BARBERLOO_CLOUD_URL')) {
    define('BARBERLOO_CLOUD_URL', 'https://ais-pre-nj2coazdd4jx7u5jfte6yh-353284084828.asia-southeast1.run.app');
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
            $sw_path = get_template_directory() . '/dist/sw.js';
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
        $dist_index = get_template_directory() . '/dist/index.html';
        $theme_url  = get_template_directory_uri();

        if (file_exists($dist_index)) {
            $html = file_get_contents($dist_index);
            $html = str_replace('href="/assets/', 'href="' . esc_url($theme_url . '/dist/assets/'), $html);
            $html = str_replace('src="/assets/', 'src="' . esc_url($theme_url . '/dist/assets/'), $html);
            return $html;
        }

        $qs = !empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '';
        $target_src = esc_url(BARBERLOO_CLOUD_URL . '/' . $qs);

        ob_start();
        ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Booking &amp; Live Queue | barberloo.in</title>
    <link rel="canonical" href="https://barberloo.in/" />
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #111113; }
        #barberloo-theme-frame { width: 100%; height: 100vh; border: 0; display: block; }
    </style>
</head>
<body>
    <iframe
        id="barberloo-theme-frame"
        src="<?php echo $target_src; ?>"
        allow="geolocation; notifications; clipboard-write; web-share; payment"
        title="BarberLoo Platform"
    ></iframe>
    <script>
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
        }
    </script>
</body>
</html>
        <?php
        return ob_get_clean();
    }
}

add_shortcode('barberloo_app', function () {
    return barberloo_theme_render_app();
});
