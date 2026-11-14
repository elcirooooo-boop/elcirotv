<?php
declare(strict_types=1);

function clappr_channels(): array {
    static $channels;
    if ($channels === null) {
        $file = dirname(__DIR__).'/config.php';
        $config = is_file($file) ? require $file : [];
        $channels = $config['clappr_channels'] ?? [];
    }
    return $channels;
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
        // Excluir hosts con protección anti-leech basada en IP (ftlly.com, futlivehd.com)
        // que rechazan a los visitantes con 403 Forbidden
        if (str_ends_with($host, 'ftlly.com') || str_ends_with($host, 'futlivehd.com')) {
            return null;
        }
        if (($parts['scheme'] ?? '') === 'https' && !isset($parts['user']) && !isset($parts['pass'])
            && preg_match('~\.m3u8$~i', $parts['path'] ?? '')
            && ($expiry === null || (is_int($expiry) && $expiry > time() + 30))) {
            return ['url'=>$url, 'expires_at'=>$expiry];
        }
    }

    return null;
}
