<?php
declare(strict_types=1);

// Only public DAMITV embed pages go to the browser; video never passes through PHP.
function damitv_player_url(string $url): bool {
    if(strlen($url)>8192||preg_match('/[\x00-\x20]/',$url))return false;
    $p=parse_url($url);
    if(!$p||($p['scheme']??'')!=='https'||($p['host']??'')!=='damitv.st'||isset($p['user'])||isset($p['pass'])||isset($p['port'])||isset($p['fragment']))return false;
    parse_str($p['query']??'',$q);
    if(($p['path']??'')==='/embed/')return is_string($q['id']??null)&&preg_match('~^[a-zA-Z0-9_/-]{1,180}$~D',$q['id'])===1&&count($q)===1;
    if(($p['path']??'')!=='/player/hls/'||!is_string($q['url']??null)||!preg_match('/^[0-9]{1,8}$/D',(string)($q['v']??''))||array_diff(array_keys($q),['v','url','name']))return false;
    if(isset($q['name'])&&!is_string($q['name']))return false;
    $target=$q['url'];if(strlen($target)>7000||preg_match('/[\x00-\x20]/',$target))return false;
    if(str_starts_with($target,'/')&&!str_starts_with($target,'//'))return true;
    $nested=parse_url($target);$host=strtolower($nested['host']??'');
    return ($nested['scheme']??'')==='https'&&($host==='damitv.st'||str_ends_with($host,'.damitv.st'))&&!isset($nested['user'])&&!isset($nested['pass'])&&!isset($nested['port'])&&!isset($nested['fragment']);
}
function damitv_canonical(string $url): string {
    if(!damitv_player_url($url))throw new RuntimeException('CHANNEL_UNAVAILABLE');
    $p=parse_url($url);parse_str($p['query']??'',$q);
    $params=$p['path']==='/embed/'?['id'=>$q['id']]:['v'=>$q['v'],'url'=>$q['url'],'name'=>$q['name']??'Live'];
    return 'https://damitv.st'.$p['path'].'?'.http_build_query($params,'','&',PHP_QUERY_RFC3986);
}
function damitv_signal_id(string $url): string {
    parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);
    if(isset($q['id']))return fingerprint('damitv:embed:'.$q['id']);
    $target=parse_url($q['url']);parse_str($target['query']??'',$params);
    // Rotating auth tokens must not invalidate channel links or duplicate the catalogue.
    foreach(['tk','token','e','exp','s','t'] as $key)unset($params[$key]);ksort($params);
    return fingerprint('damitv:hls:'.($target['host']??'').($target['path']??'').'?'.http_build_query($params));
}
function normalize_damitv_agenda(array $payload): array {
    if(($payload['success']??null)!==true||!is_array($payload['streams']??null))throw new RuntimeException('AGENDA_FORMAT');
    $events=[];$channels=[];
    foreach($payload['streams'] as $category){
        if(!is_array($category))continue;
        foreach(is_array($category['streams']??null)?$category['streams']:[] as $row){
            if(!is_array($row))continue;
            $id=$row['id']??null;$title=trim(is_string($row['name']??null)?$row['name']:'');
            if(!is_string($id)||$id===''||strlen($id)>200||$title==='')continue;
            $title=mb_substr($title,0,250);$signals=[];
            $raw=is_array($row['sources']??null)?$row['sources']:[];
            if(is_string($row['embed']??null))$raw[]=['embed'=>$row['embed'],'name'=>'Principal'];
            foreach($raw as $i=>$source){
                if(!is_array($source)||!is_string($source['embed']??null)||!damitv_player_url($source['embed']))continue;
                $url=damitv_canonical($source['embed']);$sid=damitv_signal_id($url);
                if(isset($signals[$sid]))continue;
                $name=trim(is_string($source['name']??null)?$source['name']:'')?:'Señal '.($i+1);
                if(!empty($source['sd'])&&!preg_match('/\bSD\b/i',$name))$name.=' · SD';
                elseif(!empty($source['hd'])&&!preg_match('/\bHD\b/i',$name))$name.=' · HD';
                $signals[$sid]=['id'=>$sid,'name'=>mb_substr($name,0,100),'url'=>$url,'sources'=>[['id'=>fingerprint($url),'url'=>$url]],'lang'=>'','provider'=>'damitv','publishedOnly'=>true];
            }
            $permanent=($row['always_live']??0)==1;
            foreach($signals as $sid=>$signal){
                $signal['name']=$permanent&&count($signals)===1?$title:$title.' · '.$signal['name'];
                $channels[$sid]??=$signal;
            }
            if($permanent)continue;
            $start=$row['starts_at']??null;
            if(!is_numeric($start)||($start=(int)$start)<946684800||$start>4102444800)continue;
            $league=trim(is_string($row['league']??null)?$row['league']:'')?:'Deportes';
            $sport=(string)($row['category_name']??$category['category']??'');
            $sport=match($sport){'american-football'=>'American Football','football'=>'Soccer','fight'=>'Combat sports',default=>$sport};
            $event=['id'=>fingerprint('damitv:event:'.$id),'legacyIds'=>[],'title'=>$title,'league'=>mb_substr($league,0,120),'sport'=>mb_substr($sport,0,80),'startsAt'=>iso($start),'time'=>(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i'),'signals'=>array_values($signals)];
            foreach(['home'=>'homeLogo','away'=>'awayLogo'] as $team=>$field){$logo=$row['teams'][$team]['badge']??null;if(is_string($logo)&&agenda_logo_url($logo))$event[$field]=$logo;}
            $end=$row['ends_at']??null;if(is_numeric($end)&&$end>$start)$event['durationMinutes']=max(5,min(1440,(int)ceil(($end-$start)/60)));
            if(in_array($row['status']??'',['live','upcoming','finished','ended'],true))$event['providerLive']=$row['status']==='live';
            if(isset($events[$event['id']])){
                foreach($events[$event['id']]['signals'] as $signal)$signals[$signal['id']]??=$signal;
                $event['signals']=array_values($signals);
            }
            $events[$event['id']]=$event;
        }
    }
    uasort($channels,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
    return ['events'=>merge_agendas([array_values($events)]),'channels'=>array_values($channels)];
}
