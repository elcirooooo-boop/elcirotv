<?php
declare(strict_types=1);
function direct_player_url(string $url): bool {
    return (parse_url($url,PHP_URL_HOST)??'')==='tvf90.com'&&classic_player_url($url);
}
function direct_expiry(string $url): ?int {
    parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);
    if(preg_match('/-(\d{10})-\d{10}$/D',(string)($query['token']??''),$m))return (int)$m[1];
    foreach(['expires','exp','e'] as $key)if(preg_match('/^\d{10}$/D',(string)($query[$key]??'')))return (int)$query[$key];
    return null;
}
function direct_agenda(array $data): array {
    $supported=function(array $signal): bool {
        foreach($signal['sources']??[['url'=>$signal['url']]] as $source)if(direct_player_url($source['url']))return true;
        return false;
    };
    $data['channels']=array_values(array_filter($data['channels']??[],$supported));
    foreach($data['events'] as &$event)$event['signals']=array_values(array_filter($event['signals'],$supported));unset($event);
    return $data;
}
function direct_result(array $result,int $now): array {
    $expiry=!empty($result['expiresAt'])?strtotime($result['expiresAt']):null;
    $result['renewInSeconds']=$expiry===null?600:max(15,$expiry-$now-90);return $result;
}
// Only read published player metadata: no manifests, fragments, ads or remote JS.
function resolve_direct_metadata(string $initial,?callable $fetch=null,?int $now=null): array {
    $fetch??=fn(...$args)=>net_request(...$args);$now??=time();
    $pending=[[$initial,'https://tvf90.com/']];$seen=[];
    while($pending&&count($seen)<3){
        [$url,$ref]=array_shift($pending);if(!direct_player_url($url)||isset($seen[$url]))continue;$seen[$url]=true;
        $r=$fetch($url,$ref,'',1500000,8);$html=read_text($r);if($r['status']!==200)continue;
        $html=str_replace(['\\/','&amp;'],['/','&'],$html);$media=published_playback_url($html);
        if($media){
            $media=absolute_url($media,$url);$p=safe_url($media);
            if($p['scheme']!=='https'||!preg_match('/\.m3u8$/i',$p['path']??''))continue;
            $expiry=direct_expiry($media);if($expiry!==null&&$expiry<=$now+30)continue;
            return direct_result(['transport'=>'direct','url'=>$media,'sourceKey'=>fingerprint($initial),'expiresAt'=>$expiry===null?null:iso($expiry)],$now);
        }
        preg_match_all('~<iframe\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']~i',$html,$frames);
        foreach($frames[1] as $frame)$pending[]=[absolute_url($frame,$url),$url];
    }
    throw new RuntimeException('CHANNEL_UNAVAILABLE');
}
function direct_playback(array $signal,bool $refresh=false,?callable $fetch=null,?int $now=null): array {
    $now??=time();$initial=null;
    foreach($signal['sources']??[['url'=>$signal['url']]] as $source)if(direct_player_url($source['url'])){$initial=$source['url'];break;}
    if($initial===null)throw new RuntimeException('CHANNEL_UNAVAILABLE');
    $key='direct-metadata-v2-'.fingerprint($initial);$old=cached_read($key);
    $usable=fn($row)=>($row['until']??0)>$now&&(!$refresh||$now-($row['loaded']??0)<10);
    if($usable($old)){
        if(isset($old['result']))return direct_result($old['result'],$now);
        throw new RuntimeException('CHANNEL_UNAVAILABLE');
    }
    $lock=fopen(storage().'/'.$key.'.lock','c');if(!$lock)throw new RuntimeException('DIRECT_BUSY');
    if(!flock($lock,LOCK_EX|LOCK_NB)){
        fclose($lock);if(($old['until']??0)>$now&&isset($old['result']))return direct_result($old['result'],$now);
        throw new RuntimeException('DIRECT_BUSY');
    }
    try{
        $latest=cached_read($key);if($usable($latest)){
            if(isset($latest['result']))return direct_result($latest['result'],$now);
            throw new RuntimeException('CHANNEL_UNAVAILABLE');
        }
        try{
            $result=resolve_direct_metadata($initial,$fetch,$now);
            $expiry=!empty($result['expiresAt'])?strtotime($result['expiresAt']):$now+600;
            cached_write($key,['loaded'=>$now,'until'=>min($now+300,$expiry-30),'result'=>$result]);return $result;
        }catch(Throwable $error){
            cached_write($key,['loaded'=>$now,'until'=>$now+20,'error'=>'CHANNEL_UNAVAILABLE']);
            throw new RuntimeException('CHANNEL_UNAVAILABLE',0,$error);
        }
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
