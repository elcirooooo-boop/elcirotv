<?php
declare(strict_types=1);

require_once __DIR__.'/common.php';
require_once __DIR__.'/network.php';

const EMBEDLATAM_ORIGIN='https://embed.ksdjugfssddeports.com';

if (!function_exists('embedlatam_fetch')) {
    function embedlatam_fetch(string $url): ?string {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
            CURLOPT_TIMEOUT => 7,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_ENCODING => '',
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
}

function embedlatam_player_url(string $url): bool {
    $p=parse_url($url);
    return $p!==false&&($p['scheme']??'')==='https'&&($p['host']??'')==='embed.ksdjugfssddeports.com'
        &&!isset($p['user'])&&!isset($p['pass'])&&!isset($p['port'])&&!isset($p['query'])&&!isset($p['fragment'])
        &&preg_match('~^/embed2?/[a-z0-9_-]{1,80}\.php$~D',$p['path']??'')===1;
}

function embedlatam_alias(string $slug): string {
    return [
        'dsports'=>'directvsports',
        'dsports2'=>'directvsports2',
        'dsportsplus'=>'directvsportsplus',
        'dsports-plus'=>'directvsportsplus',
        'directvsportsplus'=>'directvsportsplus',
        'espn1'=>'espn',
        'espnpremiumar'=>'espnpremiumargentina',
        'tyc'=>'tycsports',
        'tnt'=>'tntsports',
        'fox1'=>'foxsports',
        'fox2'=>'foxsports2',
        'fox3'=>'foxsports3'
    ][$slug] ?? $slug;
}

function clean_channel_title(string $name): string {
    $name = trim($name);
    $map = [
        'ESPN PREMIUM LAT' => 'ESPN Premium',
        'ESPN PREMIUM ARGENTINA' => 'ESPN Premium Argentina',
        'FOX SPORTS' => 'Fox Sports',
        'FOX SPORTS 2' => 'Fox Sports 2',
        'FOX SPORTS 3' => 'Fox Sports 3',
        'TNT SPORTS' => 'TNT Sports',
        'TUDN' => 'TUDN',
        'TYC SPORTS' => 'TyC Sports',
        'ESPN LAT' => 'ESPN',
        'ESPN ARGENTINA' => 'ESPN Argentina',
        'ESPN COLOMBIA' => 'ESPN Colombia',
        'ESPN 2' => 'ESPN 2',
        'ESPN 3' => 'ESPN 3',
        'ESPN 4' => 'ESPN 4',
        'ESPN 5' => 'ESPN 5',
        'ESPN 6' => 'ESPN 6',
        'ESPN 7' => 'ESPN 7',
        'DIRECTV SPORTS' => 'DSports',
        'DIRECTV SPORTS 2' => 'DSports 2',
        'DIRECTV SPORTS PLUS' => 'DSports+',
        'FOX SPORTS MX' => 'Fox Sports México',
        'FOX SPORTS 2 MX' => 'Fox Sports 2 México',
        'FOX SPORTS 3 MX' => 'Fox Sports 3 México',
        'ESPN MX' => 'ESPN México',
        'ESPN 2 MX' => 'ESPN 2 México',
        'ESPN 3 MX' => 'ESPN 3 México',
        'ESPN 4 MX' => 'ESPN 4 México',
        'ESPN 5 MX' => 'ESPN 5 México',
        'LIGA 1' => 'Liga 1',
        'LIGA 1 MAX' => 'Liga 1 Max',
        'FOX SPORTS PREMIUM' => 'Fox Sports Premium',
        'MOVISTAR DEPORTES PE' => 'Movistar Deportes',
        'DAZN F1' => 'DAZN F1',
        'M. LIGA DE CAMPEONES' => 'Movistar Liga de Campeones',
        'BEIN SPORTS XTRA' => 'beIN Sports Xtra',
        'MOVISTAR LA LIGA' => 'Movistar LaLiga',
        'WIN SPORTS' => 'Win Sports',
        'WIN SPORTS PLUS' => 'Win Sports+',
        'AZTECA DEPORTES' => 'Azteca Deportes',
        'AZTECA 7' => 'Azteca 7',
        'CANAL 5' => 'Canal 5',
        'LATINA' => 'Latina TV',
        'AMERICA TV' => 'América TV',
        'SPACE' => 'Space',
        'WARNER BROS TV' => 'Warner TV',
        'TNT' => 'TNT',
        'STAR CHANNEL' => 'Star Channel',
        'CINEMAX' => 'Cinemax',
        'CINECANAL' => 'Cinecanal',
        'TELEFE' => 'Telefe',
        'EL TRECE' => 'El Trece',
        'TELEMUNDO MIAMI' => 'Telemundo Miami',
        'HISTORY' => 'History',
        'HISTORY 2' => 'History 2',
        'PASIONES' => 'Pasiones',
        'AZTECA UNO' => 'Azteca Uno',
        'TLNOVELAS' => 'TLNovelas',
        'LAS ESTRELLAS' => 'Las Estrellas',
        'CARACOL' => 'Caracol TV',
        'ATV' => 'ATV',
        'UNIVISION' => 'Univision',
        'FX' => 'FX',
        'GOLDEN PLUS' => 'Golden Plus',
        'GOLDEN EDGE' => 'Golden Edge',
        'TNT SERIES' => 'TNT Series',
        'AXN' => 'AXN',
        'UNIVERSAL TV' => 'Universal TV',
        'STUDIO UNIVERSAL' => 'Studio Universal',
        'MULTIPREMIER' => 'Multipremier',
        'AMC' => 'AMC',
        'NAT GEO' => 'Nat Geo',
        'DISCOVERY CHANNEL' => 'Discovery Channel',
        'CARTOON NETWORK' => 'Cartoon Network',
        'TOONCAST' => 'Tooncast',
        'TELEMUNDO PUERTO RICO' => 'Telemundo Puerto Rico',
        'RCN' => 'RCN',
        'ANTENA 3' => 'Antena 3',
        'DISNEY CHANNEL' => 'Disney Channel',
        'TNT NOVELAS' => 'TNT Novelas'
    ];
    $upper = mb_strtoupper($name, 'UTF-8');
    if (isset($map[$upper])) return $map[$upper];
    return mb_convert_case($name, MB_CASE_TITLE, 'UTF-8');
}

function normalize_embedlatam_channels(string $html): array {
    $channels=[];
    preg_match_all('~<div class="card">(.*?)</a>\s*</div>~s', $html, $cards);
    foreach(array_slice($cards[1], 0, 500) as $card){
        if(!preg_match('~<div class="channel-name">([^<]+)</div>~', $card, $label) || !preg_match('~href="https://embed\.ksdjugfssddeports\.com/([a-z0-9_-]+)\.php"~', $card, $link)) continue;
        $slug = strtolower(trim($link[1]));
        $rawName = trim(html_entity_decode($label[1], ENT_QUOTES|ENT_HTML5, 'UTF-8'));
        if(!$rawName || !$slug) continue;

        $name = clean_channel_title($rawName);
        $id = fingerprint('embedlatam:' . $slug);
        $url = EMBEDLATAM_ORIGIN . '/embed2/' . $slug . '.php';

        $channels[$slug] = [
            'id' => $id,
            'slug' => $slug,
            'name' => $name,
            'url' => $url,
            'sources' => [['url' => $url]],
            'provider' => 'embedlatam',
            'publishedOnly' => true,
            'lang' => 'Español'
        ];
    }
    uasort($channels, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
    return array_values($channels);
}

function embedlatam_catalogue(): array {
    $key='embedlatam-channels-v4';
    $old=cached_read($key);
    if(time()-($old['loaded']??0)<300 && !empty($old['channels']))return ['channels'=>$old['channels'],'stale'=>false];
    try{
        $html = embedlatam_fetch(EMBEDLATAM_ORIGIN.'/');
        if(!$html){
            $r=net_request(EMBEDLATAM_ORIGIN.'/','','',2000000,8);
            if($r['status']!==200){fclose($r['stream']);throw new RuntimeException('CATALOGUE_HTTP');}
            $html=read_text($r);
        }
        $channels=normalize_embedlatam_channels($html);
        if(!$channels)throw new RuntimeException('EMPTY_EMBEDLATAM_CATALOGUE');
        cached_write($key,['loaded'=>time(),'channels'=>$channels]);
        return ['channels'=>$channels,'stale'=>false];
    }catch(Throwable $error){
        error_log('El Ciro Embed Latam catalogue: '.$error->getMessage());
        return ['channels'=>time()-($old['loaded']??0)<86400?($old['channels']??[]):[],'stale'=>true];
    }
}

function connect_embedlatam_events(array $events,array $channels): array {
    $lookup=array_column($channels,null,'slug');
    foreach($events as &$event)foreach($event['signals'] as &$signal){
        if(!fulbito_player_url($signal['url']))continue;
        parse_str(parse_url($signal['url'],PHP_URL_QUERY)??'',$query);
        $slug=embedlatam_alias(strtolower($query['stream']??''));
        if(!isset($lookup[$slug]))continue;
        $replacement=$lookup[$slug];
        $signal=array_replace($replacement,['id'=>$signal['id']]);
    }
    unset($event,$signal);
    return $events;
}

function embedlatam_all_channels(array $events,array $catalogue): array {
    $channels=[];
    foreach($catalogue as $signal)$channels[$signal['id']]=$signal;
    foreach($events as $event)foreach($event['signals'] as $signal)$channels[$signal['id']]??=$signal;
    uasort($channels,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
    return array_values($channels);
}
