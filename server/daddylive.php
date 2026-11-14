<?php
declare(strict_types=1);

function daddylive_channels(): array {
    return [
        'espn' => 149,
        'espn-1' => 149,
        'espn-2' => 150,
        'espn2' => 150,
        'espn-3' => 798,
        'espn3' => 798,
        'espn-4' => 928,
        'espn4' => 928,
        'espn-5' => 149,
        'espn-6' => 150,
        'espn-7' => 798,
        'espn-premium' => 387,
        'espn-deportes' => 375,
        'espn-usa' => 44,
        'espn2-usa' => 45,
        'fox-sports' => 787,
        'fox-sports-1' => 787,
        'fox-sports-2' => 788,
        'fox-sports-3' => 789,
        'fox-sports-premium' => 830,
        'fs1' => 39,
        'fs2' => 758,
        'tyc-sports' => 746,
        'tnt-sports' => 388,
        'tnt-sports-argentina' => 388,
        'tnt-sports-chile' => 642,
        'win-sports' => 392,
        'win-sports-plus' => 392,
        'movistar-laliga' => 84,
        'movistar-liga-de-campeones' => 435,
        'movistar-deportes' => 436,
        'dazn-laliga' => 538,
        'dazn-f1' => 537,
        'dazn-1' => 445,
        'dazn-2' => 446,
        'gol-play' => 530,
        'teledeporte' => 529,
        'claro-sports' => 933,
    ];
}

function daddylive_stream_id(string $slug): ?int {
    $map = daddylive_channels();
    $slug = strtolower(trim($slug));
    if (isset($map[$slug])) {
        return $map[$slug];
    }
    // Try generic regex matches
    if (preg_match('/^stream-([0-9]+)$/', $slug, $m)) {
        return (int)$m[1];
    }
    return null;
}

function daddylive_iframe_url(string $slug): ?string {
    $id = daddylive_stream_id($slug);
    if ($id === null) {
        return null;
    }
    return 'https://thedaddy.li/stream/stream-' . $id . '.php';
}
