<?php
declare(strict_types=1);

function streamxhd_direct_playback(array $embed, bool $refresh): array {
    if (!fulbito_player_url($embed['url'])) return $embed;
    parse_str(parse_url($embed['url'], PHP_URL_QUERY) ?? '', $params);
    $slug = strtolower($params['stream']);
    $key = 'streamxhd-hls-v1-' . fingerprint($slug);
    $read = static function (?array $entry) use ($embed, $refresh): ?array {
        $now = time();
        if (($entry['until'] ?? 0) <= $now) return null;
        if (!isset($entry['url'])) return $embed;
        if ($refresh && $now - $entry['loaded'] >= 15) return null;
        return array_replace($embed, [
            'transport' => 'direct',
            'url' => $entry['url'],
            'expiresAt' => isset($entry['expires']) ? iso($entry['expires']) : null,
            'renewInSeconds' => isset($entry['expires']) ? max(15, $entry['expires'] - $now - 90) : 300,
        ]);
    };

    $cached = $read(cached_read($key));
    if ($cached !== null) return $cached;
    $lock = fopen(storage() . '/' . $key . '.lock', 'c');
    if (!$lock) return $embed;
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        fclose($lock);
        return $embed;
    }

    try {
        $cached = $read(cached_read($key));
        if ($cached !== null) return $cached;
        $entry = ['loaded' => time(), 'until' => time() + 45];
        try {
            $response = net_request($embed['url'], '', '', 1_000_000, 5);
            $html = read_text($response);
            $url = $response['status'] === 200 ? published_playback_url($html) : null;
            $parts = parse_url($url ?? '');
            $path = preg_quote($slug, '~');
            if (($parts['scheme'] ?? '') === 'https'
                && preg_match('/^[a-z0-9-]+\.(?:futlivehd\.com|ftlly\.com)$/D', $parts['host'] ?? '')
                && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['port']) && !isset($parts['fragment'])
                && preg_match("~^/(?:global/)?$path/(?:tracks-[a-z0-9]+/)?(?:index|mono)\\.m3u8$~iD", $parts['path'] ?? '')) {
                parse_str($parts['query'] ?? '', $query);
                $token = $query['token'] ?? null;
                $now = time();
                if (is_string($token) && preg_match('/-[0-9a-f]+-(\d{10})-(\d{10})$/iD', $token, $times)
                    && (int) $times[1] > $now + 90 && (int) $times[2] <= $now + 300) {
                    $expires = (int) $times[1];
                    $entry = ['url' => $url, 'loaded' => $now, 'expires' => $expires, 'until' => min($now + 300, $expires - 90)];
                }
            }
        } catch (Throwable) {
            // The embedded player remains available when no direct URL can be obtained.
        }
        cached_write($key, $entry);
        return $read($entry) ?? $embed;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}
