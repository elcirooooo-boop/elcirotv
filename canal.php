<?php
declare(strict_types=1);
require_once __DIR__.'/server/common.php';
require_once __DIR__.'/server/network.php';
require_once __DIR__.'/server/embedlatam.php';
require_once __DIR__.'/server/clappr.php';

header('Cache-Control: no-store');
$channel = $_GET['channel'] ?? $_GET['canal'] ?? 'espn';
$slug = embedlatam_alias(strtolower(trim($channel)));

$cleanIframe = embedlatam_clean_iframe_url($slug);
if (!$cleanIframe) {
    $cleanIframe = 'https://embed.ksdjugfssddeports.com/embed2/' . rawurlencode($slug) . '.php';
}

if (($_GET['format'] ?? null) === 'json') {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(['url' => $cleanIframe, 'channel' => $slug]);
    exit;
}
?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Reproductor de El Ciro TV</title>
    <style>
        html,body{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden}
        iframe{width:100%;height:100%;border:0;display:block;position:absolute;inset:0}
    </style>
</head>
<body>
    <iframe src="<?= htmlspecialchars($cleanIframe, ENT_QUOTES, 'UTF-8') ?>"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerpolicy="strict-origin-when-cross-origin">
    </iframe>
</body>
</html>
