<?php
declare(strict_types=1);

function libre_player_url(string $url): bool {
    return preg_match('~^https://streamtp99a\.sbs/global1\.php\?stream=[a-z0-9_-]{1,80}$~iD', $url) === 1;
}

function libre_signal(string $url,string $name): array {
    return ['id'=>fingerprint('libre:'.$url),'name'=>$name,'url'=>$url,'lang'=>'Español','provider'=>'futbollibre','publishedOnly'=>true];
}

function libre_channels(): array {
    $names=['espn1'=>'ESPN 1','espn2'=>'ESPN 2','espn3'=>'ESPN 3','espnpremium'=>'ESPN Premium',
        'espndeportes'=>'ESPN Deportes','dsports'=>'DSports','dsports2'=>'DSports 2','dsportsplus'=>'DSports Plus'];
    $channels=[];
    foreach($names as $key=>$name)$channels[]=libre_signal('https://streamtp99a.sbs/global1.php?stream='.$key,$name);
    return $channels;
}

function libre_events(): array {
    $response=net_request('https://librefutboltv.se/','','',4500000,8);
    if($response['status']!==200){fclose($response['stream']);throw new RuntimeException('AGENDA_HTTP');}
    $html=read_text($response);
    $document=new DOMDocument();
    if(!@$document->loadHTML('<?xml encoding="UTF-8">'.$html,LIBXML_NONET))throw new RuntimeException('AGENDA_FORMAT');
    $xpath=new DOMXPath($document);
    $timezone=new DateTimeZone('America/Lima');
    $day=(new DateTimeImmutable('now',$timezone))->format('Y-m-d');
    $events=[];
    foreach($xpath->query('//ul[@id="menu"]/li[.//time[@data-raw-time]]') as $row){
        $title=trim($xpath->evaluate('string(.//span[@class="match-title"])',$row));
        $clock=$xpath->evaluate('string(.//time/@data-raw-time)',$row);
        $start=DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$day.' '.$clock,$timezone);
        if(!$start||$title==='')continue;
        $league=trim($xpath->evaluate('string(.//img[@class="match-icon"]/@alt)',$row))?:'Fútbol';
        $signals=[];
        foreach($xpath->query('.//a[@class="submenu-item"]',$row) as $link){
            $href=parse_url($link->getAttribute('href'));
            if(($href['host']??'')!=='librefutboltv.se'||($href['path']??'')!=='/watch')continue;
            parse_str($href['query']??'',$query);
            $encoded=$query['v']??null;
            if(!is_string($encoded)||strlen($encoded)>4096)continue;
            $decoded=base64_decode($encoded,true);
            $entry=$decoded===false?null:json_decode($decoded,true);
            $url=$entry['u']??null;
            if(!is_string($url)||!libre_player_url($url))continue;
            $signal=libre_signal($url,trim($entry['c']??'')?:'Señal principal');
            $signals[$signal['id']]=$signal;
        }
        $timestamp=$start->getTimestamp();
        $events[]=['id'=>fingerprint('libre:'.iso($timestamp).'|'.$title),'legacyIds'=>[],'title'=>$title,
            'league'=>$league,'sport'=>'Soccer','startsAt'=>iso($timestamp),'signals'=>array_values($signals)];
    }
    if(!$events)throw new RuntimeException('AGENDA_FORMAT');
    return $events;
}
