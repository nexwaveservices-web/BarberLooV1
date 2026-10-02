<?php
/**
 * BarberLoo WordPress Theme Entry Point for WP Pusher (barberloo.in)
 * Connected Repository: https://github.com/nexwaveservices-web/BarberLooV1
 * Renders the native BarberLoo React + Supabase SPA directly on barberloo.in (Zero iframe, Zero 404).
 */
if (!defined('ABSPATH')) {
    exit;
}

status_header(200);

if (function_exists('barberloo_theme_render_app')) {
    echo barberloo_theme_render_app();
    exit;
}

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
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Booking &amp; Live Queue | barberloo.in</title>
    <meta name="description" content="Discover trusted master barbers, book bespoke grooming appointments, or join the real-time live queue. BOOK • QUEUE • CUT • REPEAT." />
    <meta property="og:title" content="BarberLoo — Luxury Barber Booking &amp; Live Queue" />
    <meta property="og:description" content="Discover trusted master barbers, book bespoke grooming appointments, or join the real-time live queue." />
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
