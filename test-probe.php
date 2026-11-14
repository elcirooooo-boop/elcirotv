<?php
error_reporting(E_ALL);
ini_set('display_errors', '1');
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__.'/server/common.php';
require_once __DIR__.'/server/network.php';
require_once __DIR__.'/server/embedlatam.php';
require_once __DIR__.'/server/clappr.php';

try {
    echo "Testing storage(): " . storage() . "\n";
} catch (Throwable $e) {
    echo "Storage error: " . $e->getMessage() . "\n";
}

echo "Testing embedlatam_stream_url('espn')...\n";

$slug = embedlatam_alias('espn');
echo "Slug: $slug\n";

$embedUrl = 'https://embed.ksdjugfssddeports.com/embed2/' . rawurlencode($slug) . '.php';
echo "Embed URL: $embedUrl\n";

try {
    echo "Attempting net_request on $embedUrl...\n";
    $embedRes = net_request($embedUrl, 'https://embed.ksdjugfssddeports.com/', '', 1000000, 5);
    echo "Embed status: " . $embedRes['status'] . "\n";
    $embedHtml = read_text($embedRes);
    echo "Embed HTML length: " . strlen($embedHtml) . "\n";
    if (preg_match('~<iframe[^>]+src=["\']([^"\']*stream\.php[^"\']*)["\']~i', $embedHtml, $mIframe)) {
        echo "Found iframe stream: " . $mIframe[1] . "\n";
        $streamUrl = str_replace('&amp;', '&', $mIframe[1]);
        $streamRes = net_request($streamUrl, 'https://embed.ksdjugfssddeports.com/', '', 1000000, 5);
        echo "Stream status: " . $streamRes['status'] . "\n";
        $streamHtml = read_text($streamRes);
        echo "Stream HTML length: " . strlen($streamHtml) . "\n";
        if (preg_match('~https?://[^\s"\'<>]+\.m3u8(?:\?[^\s"\'<>]*)?~i', $streamHtml, $mM3u8)) {
            echo "Found m3u8: " . $mM3u8[0] . "\n";
        } else {
            echo "No m3u8 found in stream HTML\n";
            echo "Preview:\n" . substr($streamHtml, 0, 500) . "\n";
        }
    } else {
        echo "No stream.php iframe found in embed HTML\n";
        echo "Preview:\n" . substr($embedHtml, 0, 500) . "\n";
    }
} catch (Throwable $e) {
    echo "Caught exception: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo $e->getTraceAsString() . "\n";
}


