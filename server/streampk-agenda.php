<?php
declare(strict_types=1);

function streampk_events(string $html): array {
    preg_match_all('~self\.__next_f\.push\((.*?)\)</script>~s', $html, $chunks);
    $payload = '';
    foreach ($chunks[1] as $chunk) {
        $part = json_decode($chunk, true);
        if (($part[0] ?? null) === 1 && is_string($part[1] ?? null)) {
            $payload .= $part[1];
        }
    }
    preg_match_all('~"matchItem":(\{[^{}]*\}),~', $payload, $records);
    $events = [];
    foreach ($records[1] as $record) {
        $row = json_decode($record, true);
        $category = $row['urlCategory'] ?? '';
        $slug = $row['matchSlug'] ?? '';
        $home = trim($row['teamA'] ?? '');
        $away = trim($row['teamB'] ?? '');
        $date = $row['matchDate'] ?? '';
        if (!preg_match('/^[a-z0-9-]{1,180}$/D', $category)
            || !preg_match('/^[a-z0-9-]{1,180}$/D', $slug)
            || $home === '' || !preg_match('/^\d{4}-\d{2}-\d{2}T/', $date)) {
            continue;
        }
        $start = strtotime($date);
        if ($start === false) continue;
        $title = $away === '' || strcasecmp($away, 'Live') === 0 ? $home : "$home vs $away";
        $path = "/$category/$slug";
        $id = fingerprint('streampk:'.$path);
        $events[$id] = [
            'id' => $id,
            'legacyIds' => [],
            'title' => $title,
            'league' => ucwords(str_replace('-', ' ', $category)),
            'startsAt' => iso($start),
            'providerLive' => ($row['isLive'] ?? false) === true && ($row['isEnded'] ?? false) !== true,
            'watchUrl' => 'https://streampk.net'.$path,
            'signals' => [],
        ];
    }
    if (!$events) throw new RuntimeException('STREAMPK_AGENDA_EMPTY');
    return array_values($events);
}

function fetch_streampk_events(): array {
    $response = net_request('https://streampk.net/', '', '', 8000000);
    $html = read_text($response);
    if ($response['status'] !== 200) throw new RuntimeException('STREAMPK_HTTP');
    return streampk_events($html);
}
