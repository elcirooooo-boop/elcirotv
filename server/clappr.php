<?php
declare(strict_types=1);

require_once __DIR__.'/common.php';
require_once __DIR__.'/network.php';
require_once __DIR__.'/embedlatam.php';

function clappr_channels(): array {
    static $channels;
    if ($channels === null) {
        $file = dirname(__DIR__).'/config.php';
        $config = is_file($file) ? require $file : [];
        $channels = $config['clappr_channels'] ?? [];
    }
    return $channels;
}

function embedlatam_stream_url(string $channel): ?string {
    $slug = embedlatam_alias(strtolower(trim($channel)));
    $cacheKey = 'embedlatam-stream-v2-' . $slug;
    $cached = cached_read($cacheKey);
    if (($cached['expires_at'] ?? 0) > time() + 120 && !empty($cached['url'])) {
        return $cached['url'];
    }

    try {
        $embedUrl = 'https://embed.ksdjugfssddeports.com/embed2/' . rawurlencode($slug) . '.php';
        $embedRes = net_request($embedUrl, 'https://embed.ksdjugfssddeports.com/', '', 1000000, 5);
        if ($embedRes['status'] !== 200) {
            fclose($embedRes['stream']);
            return null;
        }
        $embedHtml = read_text($embedRes);
        if (!preg_match('~<iframe[^>]+src=["\']([^"\']*stream\.php[^"\']*)["\']~i', $embedHtml, $mIframe)) {
            return null;
        }
        $streamUrl = str_replace('&amp;', '&', $mIframe[1]);

        $streamRes = net_request($streamUrl, 'https://embed.ksdjugfssddeports.com/', '', 1000000, 5);
        if ($streamRes['status'] !== 200) {
            fclose($streamRes['stream']);
            return null;
        }
        $streamHtml = read_text($streamRes);
        if (!preg_match('~https?://[^\s"\'<>]+\.m3u8(?:\?[^\s"\'<>]*)?~i', $streamHtml, $mM3u8)) {
            return null;
        }

        $m3u8Url = $mM3u8[0];
        // Guardar en caché durante 2 horas para velocidad máxima
        cached_write($cacheKey, [
            'url' => $m3u8Url,
            'expires_at' => time() + 7200,
        ]);
        return $m3u8Url;
    } catch (Throwable) {
        return null;
    }
}

function clappr_source(string $channel): ?array {
    $stored = cached_read('private-channels') ?? [];
    $source = $stored[$channel] ?? clappr_channels()[$channel] ?? null;
    try {
        if ($source instanceof Closure) $source = $source();
    } catch (Throwable) {
        return null;
    }
    $expiry = is_array($source) ? ($source['expires_at'] ?? null) : null;
    if (is_array($source) && isset($source['expiresAt'])) {
        $expiry = is_string($source['expiresAt']) ? strtotime($source['expiresAt']) : false;
    }
    $url = is_array($source) ? ($source['url'] ?? null) : $source;
    if (is_string($url) && filter_var($url, FILTER_VALIDATE_URL)) {
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');
        if (str_ends_with($host, 'ftlly.com') || str_ends_with($host, 'futlivehd.com')) {
            return null;
        }
        if (($parts['scheme'] ?? '') === 'https' && !isset($parts['user']) && !isset($parts['pass'])
            && preg_match('~\.m3u8$~i', $parts['path'] ?? '')
            && ($expiry === null || (is_int($expiry) && $expiry > time() + 30))) {
            return ['url'=>$url, 'expires_at'=>$expiry];
        }
    }

    // Auto-resolución de flujo limpio desde EmbedLatam con CORS abierto
    $embedM3u8 = embedlatam_stream_url($channel);
    if ($embedM3u8 !== null) {
        return [
            'url' => $embedM3u8,
            'expires_at' => time() + 7200,
        ];
    }

    return null;
}
