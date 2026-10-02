<?php
/**
 * BarberLoo WordPress Theme Entry Point for WP Pusher (barberloo.in)
 * Connected Repository: https://github.com/nexwaveservices-web/BarberLooV1
 */
if (!defined('ABSPATH')) {
    exit;
}

if (function_exists('barberloo_render_application')) {
    echo barberloo_render_application(true);
    exit;
}

$dist_index = get_template_directory() . '/dist/index.html';
$theme_url  = get_template_directory_uri();

if (file_exists($dist_index)) {
    $html = file_get_contents($dist_index);
    $html = str_replace('href="/assets/', 'href="' . esc_url($theme_url . '/dist/assets/'), $html);
    $html = str_replace('src="/assets/', 'src="' . esc_url($theme_url . '/dist/assets/'), $html);
    echo $html;
    exit;
}

$cloud_url = 'https://ais-pre-nj2coazdd4jx7u5jfte6yh-353284084828.asia-southeast1.run.app';
$qs = !empty($_SERVER['QUERY_STRING']) ? '?' . $_SERVER['QUERY_STRING'] : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BarberLoo — Luxury Barber Booking &amp; Live Queue | barberloo.in</title>
    <link rel="canonical" href="https://barberloo.in/" />
    <style>
        html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #111113; }
        iframe { width: 100%; height: 100vh; border: 0; display: block; }
    </style>
</head>
<body>
    <iframe
        src="<?php echo esc_url($cloud_url . '/' . $qs); ?>"
        allow="geolocation; notifications; clipboard-write; web-share; payment"
        title="BarberLoo Platform"
    ></iframe>
</body>
</html>
