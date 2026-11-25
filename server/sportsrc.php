<?php
declare(strict_types=1);

function sportsrc_config(): array {
    static $config;
    if($config!==null)return $config;
    $path=dirname(__DIR__).'/config.php';
    $local=is_file($path)?require $path:[];
    return $config=is_array($local)?$local:[];
}

function sportsrc_key(): string {
    $key=getenv('SPORTSRC_API_KEY') ?: (sportsrc_config()['sportsrc_api_key']??'');
    return is_string($key)&&preg_match('/^[!-~]{1,512}$/D',$key)?$key:'';
}

function sportsrc_request(array $params): array {
    $key=sportsrc_key();
    if($key==='')throw new RuntimeException('SPORTSRC_KEY_REQUIRED');
    $curl=curl_init('https://api.sportsrc.org/v3/?'.http_build_query($params));
    $body='';
    curl_setopt_array($curl,[
        CURLOPT_HTTPHEADER=>['Accept: application/json','X-API-KEY: '.$key],
        CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>8,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION=>static function($curl,string $chunk)use(&$body): int {
            if(strlen($body)+strlen($chunk)>3000000)return 0;
            $body.=$chunk;
            return strlen($chunk);
        },
    ]);
    $ok=curl_exec($curl);
    $status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);
    curl_close($curl);
    if(!$ok||$status!==200)throw new RuntimeException('SPORTSRC_HTTP_'.$status);
    $payload=json_decode($body,true,64,JSON_THROW_ON_ERROR);
    if(($payload['success']??null)!==true||!is_array($payload['data']??null))throw new RuntimeException('SPORTSRC_FORMAT');
    return $payload['data'];
}

function sportsrc_cached(string $cacheKey,int $ttl,callable $load): array {
    $key=$cacheKey.'-'.fingerprint(sportsrc_key());
    $old=cached_read($key);
    if(($old['until']??0)>time())return $old['data'];
    $lock=fopen(storage().'/'.$key.'.lock','c');
    if(!$lock)throw new RuntimeException('SPORTSRC_CACHE');
    if(!flock($lock,LOCK_EX|LOCK_NB)){
        fclose($lock);
        if(($old['staleUntil']??0)>time())return $old['data'];
        throw new RuntimeException('SPORTSRC_BUSY');
    }
    try{
        $old=cached_read($key);
        if(($old['until']??0)>time())return $old['data'];
        try{$data=$load();}
        catch(Throwable $error){
            if(($old['staleUntil']??0)>time())return $old['data'];
            throw $error;
        }
        cached_write($key,['until'=>time()+$ttl,'staleUntil'=>time()+$ttl*3,'data'=>$data]);
        return $data;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}

function sportsrc_agenda(): array {
    return sportsrc_cached('sportsrc-agenda-v1',240,static function(): array {
        $groups=sportsrc_request(['type'=>'matches','sport'=>'football']);
        $events=[];
        foreach($groups as $group){
            $league=$group['league']['name']??'Fútbol';
            foreach($group['matches']??[] as $row){
                $remoteId=$row['id']??'';
                $title=$row['title']??'';
                $start=(int)($row['timestamp']??0);
                if(!is_string($remoteId)||$remoteId===''||strlen($remoteId)>512||!is_string($title)||$title===''||$start<946684800)continue;
                $status=$row['status']??'';
                if(!in_array($status,['notstarted','inprogress','interrupted','suspended'],true))continue;
                $id=fingerprint('sportsrc:event:'.$remoteId);
                $event=['id'=>$id,'sportsrcId'=>$remoteId,'legacyIds'=>[],'title'=>mb_substr($title,0,240),
                    'league'=>mb_substr((string)$league,0,100),'sport'=>'Soccer','startsAt'=>iso($start),
                    'providerLive'=>$status==='inprogress','signals'=>[]];
                foreach(['home'=>'homeLogo','away'=>'awayLogo'] as $team=>$field){
                    $badge=$row['teams'][$team]['badge']??null;
                    if(is_string($badge)&&agenda_logo_url($badge))$event[$field]=$badge;
                }
                $events[$id]=$event;
            }
        }
        $previous=cached_read('agenda-matchora-v2');
        return ['provider'=>'sportsrc','day'=>today(),'events'=>retain_agenda_links(array_values($events),$previous['events']??[]),
            'channels'=>[],'updatedAt'=>iso(time()),'stale'=>false];
    });
}

function sportsrc_player_origin(string $url): ?string {
    if(strlen($url)>8192||preg_match('/[\x00-\x20\\\\]/',$url))return null;
    $parts=parse_url($url);
    if(!$parts||($parts['scheme']??'')!=='https'||isset($parts['user'])||isset($parts['pass'])||isset($parts['port']))return null;
    $host=strtolower($parts['host']??'');
    if(!preg_match('/^[a-z0-9.-]+$/D',$host))return null;
    $allowed=sportsrc_config()['sportsrc_embed_hosts']??[];
    if(!str_ends_with($host,'.sportsrc.org')&&(!is_array($allowed)||!in_array($host,$allowed,true)))return null;
    return 'https://'.$host;
}

function sportsrc_match_channels(string $match): ?array {
    if(sportsrc_key()==='')return null;
    foreach(sportsrc_agenda()['events'] as $event){
        if($event['id']!==$match)continue;
        return sportsrc_cached('sportsrc-detail-v1-'.$match,120,static function()use($event): array {
            $detail=sportsrc_request(['type'=>'detail','id'=>$event['sportsrcId']]);
            $signals=[];
            foreach($detail['sources']??[] as $source){
                $url=$source['embedUrl']??'';
                if(!is_string($url)||($origin=sportsrc_player_origin($url))===null)continue;
                $label=trim((string)($source['name']??$source['channel']??$source['source']??''));
                $language=trim((string)($source['language']??''));
                if(strtolower($language)==='unknown')$language='';
                $id=fingerprint($event['id'].'|'.($source['id']??'').'|'.($source['source']??'').'|'.($source['streamNo']??''));
                $signals[$id]=['id'=>$id,'name'=>mb_substr($label?:'Señal '.(count($signals)+1),0,100),
                    'lang'=>mb_substr($language,0,40),'playerUrl'=>$url,'playerOrigin'=>$origin];
            }
            return array_values($signals);
        });
    }
    return null;
}
