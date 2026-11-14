<?php
declare(strict_types=1);
const EMBEDLATAM_ORIGIN='https://embed.ksdjugfssddeports.com';
function embedlatam_player_url(string $url): bool {
    $p=parse_url($url);
    return $p!==false&&($p['scheme']??'')==='https'&&($p['host']??'')==='embed.ksdjugfssddeports.com'
        &&!isset($p['user'])&&!isset($p['pass'])&&!isset($p['port'])&&!isset($p['query'])&&!isset($p['fragment'])
        &&preg_match('~^/embed2?/[a-z0-9]{1,80}\.php$~D',$p['path']??'')===1;
}
function embedlatam_alias(string $slug): string {
    return ['dsports'=>'directvsports','dsports2'=>'directvsports2','dsportsplus'=>'directvsportsplus','dsports-plus'=>'directvsportsplus','directvsportsplus'=>'directvsportsplus','espn1'=>'espn','espnpremiumar'=>'espnpremiumargentina','tyc'=>'tycsports','tnt'=>'tntsports','fox1'=>'foxsports','fox2'=>'foxsports2','fox3'=>'foxsports3'][$slug]??$slug;
}
function normalize_embedlatam_channels(string $html): array {
    $channels=[];
    preg_match_all('~<div class="card">(.*?)</a></div>~s',$html,$cards);
    foreach(array_slice($cards[1],0,500) as $card){
        if(!preg_match('~<div class="channel-name">([^<]+)</div>~',$card,$label)||!preg_match('~href="https://embed\.ksdjugfssddeports\.com/([a-z0-9]{1,80})\.php"~',$card,$link))continue;
        $slug=$link[1];$name=trim(html_entity_decode($label[1],ENT_QUOTES|ENT_HTML5,'UTF-8'));if(!$name)continue;
        // Preserve existing shared ESPN/DSports channel links across the provider change.
        $identity=['directvsports'=>'dsports','directvsports2'=>'dsports2','directvsportsplus'=>'dsportsplus'][$slug]??$slug;
        $shared=preg_match('/^espn[2-7]?$/D',$slug)||str_starts_with($slug,'directvsports');
        $id=fingerprint(($shared?'fulbito:':'embedlatam:').$identity);$url=EMBEDLATAM_ORIGIN.'/embed2/'.$slug.'.php';
        $name=['espn'=>'ESPN Latinoamérica','espnar'=>'ESPN Argentina','espncol'=>'ESPN Colombia','directvsports'=>'DSports','directvsports2'=>'DSports 2','directvsportsplus'=>'DSports+'][$slug]??$name;
        $channels[$slug]=['id'=>$id,'slug'=>$slug,'name'=>mb_substr($name,0,120).' · Latam','url'=>$url,'sources'=>[['url'=>$url]],'provider'=>'embedlatam','publishedOnly'=>true,'lang'=>'Español'];
    }
    uasort($channels,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
    return array_values($channels);
}
function embedlatam_catalogue(): array {
    $key='embedlatam-channels-v1';$old=cached_read($key);
    if(time()-($old['loaded']??0)<300)return ['channels'=>$old['channels'],'stale'=>false];
    try{
        $response=net_request(EMBEDLATAM_ORIGIN.'/','','',2000000,8);
        if($response['status']!==200){fclose($response['stream']);throw new RuntimeException('CATALOGUE_HTTP');}
        $channels=normalize_embedlatam_channels(read_text($response));
        if(!$channels)throw new RuntimeException('EMPTY_EMBEDLATAM_CATALOGUE');
        cached_write($key,['loaded'=>time(),'channels'=>$channels]);return ['channels'=>$channels,'stale'=>false];
    }catch(Throwable $error){
        error_log('El Ciro Embed Latam catalogue: '.$error->getMessage());
        return ['channels'=>time()-($old['loaded']??0)<3600?($old['channels']??[]):[],'stale'=>true];
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
        // Keep signal IDs for previously shared match links; replace only the playback source.
        $signal=array_replace($replacement,['id'=>$signal['id']]);
    }
    unset($event,$signal);return $events;
}
function embedlatam_all_channels(array $events,array $catalogue): array {
    $channels=[];foreach($catalogue as $signal)$channels[$signal['id']]=$signal;
    foreach($events as $event)foreach($event['signals'] as $signal)$channels[$signal['id']]??=$signal;
    uasort($channels,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));return array_values($channels);
}
