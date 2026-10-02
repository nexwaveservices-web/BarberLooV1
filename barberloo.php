<?php
/**
 * Plugin Name: BarberLoo Platform (WP Pusher GitHub Bridge)
 * Plugin URI: https://barberloo.in
 * Description: Official BarberLoo Luxury Barber Booking & Real-Time Live Queue Platform connected via WP Pusher from https://github.com/nexwaveservices-web/BarberLooV1 and Supabase.
 * Version: 1.0.0
 * Author: NexWave Services (BarberLoo)
 * Author URI: https://barberloo.in
 * License: Apache-2.0
 * GitHub Plugin URI: nexwaveservices-web/BarberLooV1
 * GitHub Branch: main
 */

if (!defined('ABSPATH')) {
    exit;
}

define('BARBERLOO_VERSION', '1.0.0');
define('BARBERLOO_DOMAIN', 'https://barberloo.in');
define('BARBERLOO_GITHUB_REPO', 'https://github.com/nexwaveservices-web/BarberLooV1');
define('BARBERLOO_CLOUD_URL', 'https://ais-pre-nj2coazdd4jx7u5jfte6yh-353284084828.asia-southeast1.run.app');
define('BARBERLOO_SUPABASE_URL', 'https://ddusvfylhifoniobzmcq.supabase.co');

/**
 * 1. Serve /sw.js Service Worker at the root of barberloo.in so Browser Notifications
 *    for Queue Status Changes & Appointment Reminders work in the background.
 */
add_action('init', function () {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? strtok($_SERVER['REQUEST_URI'], '?') : '';
    if ($request_uri === '/sw.js') {
        $sw_path = plugin_dir_path(__FILE__) . 'public/sw.js';
        if (!file_exists($sw_path)) {
            $sw_path = plugin_dir_path(__FILE__) . 'dist/sw.js';
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

/**
 * 2. Helper to render the BarberLoo App (uses local compiled dist/ assets if built by GitHub Actions,
 *    or seamlessly mounts the live BarberLoo Cloud + Supabase application).
 */
function barberloo_render_application($full_viewport = true) {
    $dist_index = plugin_dir_path(__FILE__) . 'dist/index.html';
    $plugin_url = plugin_dir_url(__FILE__);

    // If dist/index.html exists from GitHub Actions build, serve the native SPA bundle directly
    if (file_exists($dist_index)) {
        $html = file_get_contents($dist_index);
        $html = str_replace('href="/assets/', 'href="' . esc_url($plugin_url . 'dist/assets/'), $html);
        $html = str_replace('src="/assets/', 'src="' . esc_url($plugin_url . 'dist/assets/'), $html);
        return $html;
    }

    // Fallback seamless full-viewport mount connected to BarberLoo Cloud & Supabase
    $query_string = isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING'])
        ? '?' . $_SERVER['QUERY_STRING']
        : '';
    $target_src = esc_url(BARBERLOO_CLOUD_URL . '/' . $query_string);

    ob_start();
    if ($full_viewport) : ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Booking &amp; Live Queue | barberloo.in</title>
    <meta name="description" content="Discover trusted master barbers, book bespoke grooming appointments, or join the real-time live queue on barberloo.in." />
    <link rel="canonical" href="https://barberloo.in/" />
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #111113;
        }
        #barberloo-root-frame {
            width: 100%;
            height: 100vh;
            border: 0;
            display: block;
        }
    </style>
</head>
<body>
    <iframe
        id="barberloo-root-frame"
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
    <?php else : ?>
    <div style="width:100%;min-height:92vh;background:#111113;border-radius:24px;overflow:hidden;">
        <iframe
            src="<?php echo $target_src; ?>"
            style="width:100%;height:92vh;border:0;display:block;"
            allow="geolocation; notifications; clipboard-write; web-share; payment"
            title="BarberLoo Platform"
        ></iframe>
    </div>
    <?php endif;
    return ob_get_clean();
}

/**
 * 3. Shortcode [barberloo_app] so BarberLoo can be placed on any WordPress page
 */
add_shortcode('barberloo_app', function () {
    return barberloo_render_application(false);
});

/**
 * 4. Optional Full-Site Front Page Takeover on barberloo.in (enabled by default unless ?wp_native=1)
 */
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }
    if (isset($_GET['wp_native']) && $_GET['wp_native'] === '1') {
        return;
    }
    $takeover_enabled = get_option('barberloo_frontpage_takeover', 'yes');
    if ($takeover_enabled === 'yes' && (is_front_page() || is_home())) {
        echo barberloo_render_application(true);
        exit;
    }
});

/**
 * 5. WordPress Admin Menu under Settings -> BarberLoo WP Pusher
 */
add_action('admin_menu', function () {
    add_options_page(
        'BarberLoo & WP Pusher',
        'BarberLoo App',
        'manage_options',
        'barberloo-wppusher',
        function () {
            if (isset($_POST['barberloo_save_settings']) && check_admin_referer('barberloo_settings_nonce')) {
                $takeover = isset($_POST['barberloo_frontpage_takeover']) ? 'yes' : 'no';
                update_option('barberloo_frontpage_takeover', $takeover);
                echo '<div class="updated"><p>BarberLoo settings saved.</p></div>';
            }
            $current_takeover = get_option('barberloo_frontpage_takeover', 'yes');
            ?>
            <div class="wrap">
                <h1>BarberLoo Platform — Domain &amp; WP Pusher Connection</h1>
                <p>Connected Domain: <strong>https://barberloo.in</strong> | GitHub Repository: <strong><a href="https://github.com/nexwaveservices-web/BarberLooV1" target="_blank">nexwaveservices-web/BarberLooV1</a></strong></p>
                <form method="post">
                    <?php wp_nonce_field('barberloo_settings_nonce'); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row">Render BarberLoo on Front Page (barberloo.in)</th>
                            <td>
                                <label>
                                    <input type="checkbox" name="barberloo_frontpage_takeover" value="yes" <?php checked($current_takeover, 'yes'); ?> />
                                    Automatically launch the full BarberLoo application on the homepage of <code>barberloo.in</code>
                                </label>
                                <p class="description">You can also embed BarberLoo on any individual WordPress page using the shortcode <code>[barberloo_app]</code>.</p>
                            </td>
                        </tr>
                    </table>
                    <p class="submit">
                        <input type="submit" name="barberloo_save_settings" class="button-primary" value="Save Changes" />
                    </p>
                </form>
            </div>
            <?php
        }
    );
});
