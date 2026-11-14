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

function embedlatam_fetch(string $url): ?string {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => 7,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_ENCODING => '', // Fast gzip/deflate decoding
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer: https://embed.ksdjugfssddeports.com/',
            'Origin: https://embed.ksdjugfssddeports.com'
        ]
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status === 200 && is_string($body) && $body !== '') {
        return $body;
    }
    return null;
}

function embedlatam_clean_iframe_url(string $channel): ?string {
    $slug = embedlatam_alias(strtolower(trim($channel)));
    if ($slug === '') return null;
    $cacheKey = 'embedlatam-iframe-v3-' . $slug;
    $cached = cached_read($cacheKey);
    if (($cached['expires_at'] ?? 0) > time() + 60 && !empty($cached['url'])) {
        return $cached['url'];
    }

    try {
        $embedUrl = 'https://embed.ksdjugfssddeports.com/embed2/' . rawurlencode($slug) . '.php';
        $embedHtml = embedlatam_fetch($embedUrl);
        if (!$embedHtml) {
            $embedHtml = embedlatam_fetch('https://embed.ksdjugfssddeports.com/embed/' . rawurlencode($slug) . '.php');
        }
        if (!$embedHtml) return null;

        if (!preg_match('~<iframe[^>]+src=["\']([^"\']*stream\.php[^"\']*)["\']~i', $embedHtml, $mIframe)) {
            return null;
        }
        $streamUrl = str_replace('&amp;', '&', $mIframe[1]);
        cached_write($cacheKey, [
            'url' => $streamUrl,
            'expires_at' => time() + 7200,
        ]);
        return $streamUrl;
    } catch (Throwable) {
        return null;
    }
}

function embedlatam_stream_url(string $channel): ?string {
    $slug = embedlatam_alias(strtolower(trim($channel)));
    if ($slug === '') return null;
    $cacheKey = 'embedlatam-stream-v3-' . $slug;
    $cached = cached_read($cacheKey);
    if (($cached['expires_at'] ?? 0) > time() + 60 && !empty($cached['url'])) {
        return $cached['url'];
    }

    try {
        $streamUrl = embedlatam_clean_iframe_url($slug);
        if (!$streamUrl) {
            $embedUrl = 'https://embed.ksdjugfssddeports.com/embed2/' . rawurlencode($slug) . '.php';
            $embedHtml = embedlatam_fetch($embedUrl);
            if (!$embedHtml) {
                $embedHtml = embedlatam_fetch('https://embed.ksdjugfssddeports.com/embed/' . rawurlencode($slug) . '.php');
            }
            if (!$embedHtml) return null;
            if (!preg_match('~<iframe[^>]+src=["\']([^"\']*stream\.php[^"\']*)["\']~i', $embedHtml, $mIframe)) {
                return null;
            }
            $streamUrl = str_replace('&amp;', '&', $mIframe[1]);
        }

        $streamHtml = embedlatam_fetch($streamUrl);
        if (!$streamHtml) return null;

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
    $slug = embedlatam_alias(strtolower(trim($channel)));
    $stored = cached_read('private-channels') ?? [];
    $source = $stored[$slug] ?? $stored[$channel] ?? clappr_channels()[$channel] ?? null;
    try {
        if ($source instanceof Closure) $source = $source();
    } catch (Throwable) {
        $source = null;
    }
    $expiry = is_array($source) ? ($source['expires_at'] ?? null) : null;
    if (is_array($source) && isset($source['expiresAt'])) {
        $expiry = is_string($source['expiresAt']) ? strtotime($source['expiresAt']) : false;
    }
    $url = is_array($source) ? ($source['url'] ?? null) : $source;
    if (is_string($url) && filter_var($url, FILTER_VALIDATE_URL)) {
        $parts = parse_url($url);
        $host = strtolower($parts['host'] ?? '');
        if (str_ends_with($host, 'ftlly.com') || str_ends_with($host, 'futlivehd.com') || str_contains($host, 'streamxhd')) {
            $url = null; // Do NOT return null: ignore stale source and continue to clean EmbedLatam
        } elseif (($parts['scheme'] ?? '') === 'https' && !isset($parts['user']) && !isset($parts['pass'])
            && preg_match('~\.m3u8$~i', $parts['path'] ?? '')
            && ($expiry === null || (is_int($expiry) && $expiry > time() + 30))) {
            return ['url'=>$url, 'expires_at'=>$expiry];
        }
    }

    // Auto-resolución de flujo limpio desde EmbedLatam con CORS abierto
    $embedM3u8 = embedlatam_stream_url($slug);
    if ($embedM3u8 !== null) {
        return [
            'url' => $embedM3u8,
            'expires_at' => time() + 7200,
        ];
    }

    return null;
}
