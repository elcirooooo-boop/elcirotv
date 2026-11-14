<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__.'/server/common.php';
require_once __DIR__.'/server/network.php';
require_once __DIR__.'/server/embedlatam.php';
require_once __DIR__.'/server/clappr.php';
require_once __DIR__.'/server/playback.php';

echo "Testing storage(): " . storage() . "\n";

echo "\n--- Testing clappr_source('espn') ---\n";
$source = clappr_source('espn');
if ($source) {
    echo "SUCCESS: Found stream!\n";
    echo "URL: " . $source['url'] . "\n";
    echo "Expires: " . date('Y-m-d H:i:s', $source['expires_at']) . "\n";
} else {
    echo "FAILED: clappr_source('espn') returned null\n";
}

echo "\n--- Testing embedlatam_clean_iframe_url('espn') ---\n";
$iframeUrl = embedlatam_clean_iframe_url('espn');
echo "Clean Iframe URL: " . ($iframeUrl ?: 'FAILED') . "\n";
