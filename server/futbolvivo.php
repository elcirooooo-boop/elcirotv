<?php
declare(strict_types=1);
// Data codec published by the site's browser client; no remote JS is executed.
function futbolvivo_decode(string $text): array {
    $text=trim($text);
    if(str_starts_with($text,'k1')){
        $codec=json_decode(file_get_contents(__DIR__.'/futbolvivo-codec.json'),true,8,JSON_THROW_ON_ERROR);
        $encoded=strtr(strrev(substr($text,2)),array_combine(str_split($codec['mixed']),str_split($codec['plain'])));
        $bytes=base64_decode(strtr($encoded,'-_','+/'),true);$key=base64_decode($codec['key'],true);
        if($bytes===false||strlen($bytes)<29||$key===false)throw new RuntimeException('AGENDA_CODEC');
        $text=openssl_decrypt(substr($bytes,12,-16),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($bytes,0,12),substr($bytes,-16));
        if($text===false)throw new RuntimeException('AGENDA_CODEC');
    }
    $data=json_decode($text,true,64,JSON_THROW_ON_ERROR);if(!is_array($data))throw new RuntimeException('AGENDA_FORMAT');return $data;
}
function futbolvivo_fetch(string $path): array {
    if(!in_array($path,['gsc/matches','categories','matches','latin/matches'],true))throw new RuntimeException('AGENDA_PATH');
    $r=net_request('https://cdn.strm-api.org/api/v1/'.$path,'https://futbolvivo.tv/','',6000000,6);
    if($r['status']!==200){fclose($r['stream']);throw new RuntimeException('AGENDA_HTTP');}return futbolvivo_decode(read_text($r));
}
function futbolvivo_player_url(string $url): bool {
    $p=parse_url($url);if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['port']))return false;
    parse_str($p['query']??'',$query);
    if(in_array($p['host']??'',['tvf90.com','futbollibre.ch'],true))return in_array($p['path']??'',['/1.php','/2.php','/3.php','/5.php','/hd.php','/canal.php','/plus1.php'],true)&&preg_match('/^[-a-z0-9_]{1,80}$/iD',(string)($query['stream']??''))===1;
    if(($p['host']??'')==='tv-90.com')return in_array($p['path']??'',['/drm/dsports.php','/drm/clarosports.php'],true);
    if(($p['host']??'')==='streamec.st')return preg_match('~^/embed/ch[0-9]{1,8}\.php$~D',$p['path']??'')===1;
    if(($p['host']??'')!=='redirectus.net')return false;
    parse_str($p['query']??'',$direct);
    if(($p['path']??'')==='/streameast.html')return preg_match('/^[1-9][0-9]{0,12}$/D',(string)($direct['id']??''))===1;
    if(($p['path']??'')==='/streame.html')return preg_match('/^sc-ch[0-9]{1,8}$/D',(string)($direct['key']??''))===1;
    if(($p['path']??'')==='/streamlat.html')return preg_match('/^n[0-9]+-[a-f0-9]{16}$/D',(string)($direct['id']??''))===1;
    parse_str($p['query']??'',$q);$page=match($p['path']??''){'/latin/us.html'=>'us','/latin/latin.html'=>'latin','/latin/soccer.html'=>'soccer',default=>null};
    return $page!==null&&($q['p']??'')===$page&&($q['d']??'')==='redirectus.net'&&preg_match('/^[1-9][0-9]{0,12}$/D',(string)($q[$page==='soccer'?'m':'id']??''))===1;
}
function futbolvivo_event(string $kind,array $row,string $title,string $league,int $start,bool $live,bool $hasStream): array {
    $page=['us'=>'us','latin'=>'latin','soccer'=>'soccer'][$kind];$url='https://redirectus.net/latin/'.$page.'.html?'.http_build_query(['p'=>$page,'d'=>'redirectus.net',$kind==='soccer'?'m':'id'=>(string)$row['id'],'v'=>'20260917a','ref'=>'futbolvivo.tv']);
    $signal=['id'=>fingerprint('futbolvivo:'.$kind.':'.$row['id']),'name'=>mb_substr($title,0,100),'url'=>$url,'lang'=>'','publishedOnly'=>true,'provider'=>'futbolvivo','sources'=>[['id'=>fingerprint($url),'url'=>$url]]];
    $signals=[];foreach($row['streams']??[] as $i=>$stream){$embed=$stream['embed_url']??'';if(!is_string($embed)||!futbolvivo_player_url($embed))continue;$key=fingerprint($embed);$signals[$key]=['id'=>$key,'name'=>mb_substr(($stream['name']??null)?:'Señal '.($i+1),0,80).(!empty($stream['language'])?' · '.$stream['language']:''),'url'=>$embed,'lang'=>$stream['language']??'','publishedOnly'=>true,'provider'=>'futbolvivo','sources'=>[['id'=>$key,'url'=>$embed]]];}
    $signals=array_values($signals);usort($signals,fn($a,$b)=>futbolvivo_signal_rank($a)<=>futbolvivo_signal_rank($b));
    return ['id'=>fingerprint('futbolvivo:event:'.$kind.':'.$row['id']),'legacyIds'=>[],'title'=>$title,'league'=>$league,'startsAt'=>iso($start),'time'=>(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i'),'providerLive'=>$live,'signals'=>$signals?:($hasStream?[$signal]:[])];
}
function normalize_futbolvivo(array $us,array $soccer,array $latin,array $categories,?int $now=null): array {
    $now??=time();$events=[];$category=[];foreach($categories['categories']??[] as $c)$category[$c['id']]=$c['name'];
    foreach(['us'=>$us,'latin'=>$latin] as $kind=>$data)foreach($data['matches']??[] as $row){
        $live=!empty($row['live']);$start=strtotime($row['starts_at']??'');if(!$start||!empty($row['finished'])||(!$live&&$start<$now-28800))continue;
        $home=trim($row['home']['name']??'');$away=trim($row['away']['name']??'');$title=$home&&$away?$home.' vs '.$away:trim($row['title']??'');if(!$title)continue;
        $sport=$row['sport']??'';$league=$row['league']??($category[$sport]??$row['sport_name']??'Deportes');
        if($sport==='football')$league=str_contains($row['api_id']??'','college-football')?'NCAA Football':'NFL';
        elseif($sport==='basketball')$league='Baloncesto';elseif($sport==='hockey')$league='Hockey';
        $events[]=futbolvivo_event($kind,$row,$title,$league,$start,$live,!empty($row['stream_count'])||!empty($row['streams']));
    }
    foreach($soccer['matches']??[] as $row){
        if((int)($row['active']??0)!==1||empty($row['has_channels']))continue;
        $live=in_array((int)($row['status']??0),[1,3],true);
        try{$start=(new DateTimeImmutable(($row['date']??'').' '.($row['time']??''),new DateTimeZone('Europe/Madrid')))->getTimestamp();}catch(Throwable){continue;}
        if(!$live&&$start<$now-28800)continue;
        $home=$row['home']['name_es']??$row['home']['name']??'';$away=$row['away']['name_es']??$row['away']['name']??'';
        $events[]=futbolvivo_event('soccer',$row,$home.' vs '.$away,$row['league']['name_es']??$row['league']['name']??'Fútbol',$start,$live,true);
    }
    return futbolvivo_group_events($events);
}
function futbolvivo_signal_rank(array $signal): int {
    return match(parse_url($signal['url'],PHP_URL_HOST)){'tvf90.com','tv-90.com','futbollibre.ch'=>0,'streamec.st'=>1,default=>2};
}
function futbolvivo_group_events(array $events): array {
    $groups=[];
    foreach($events as $event){$names=preg_split('/\s+(?:vs?\.?|versus)\s+/iu',$event['title']);$identity=null;$league=folded($event['league']);
        if(count($names)===2){$sport=preg_match('/ncaa|nfl|american football/',$league)?'football':(preg_match('/basket|baloncesto|nba/',$league)?'basketball':(preg_match('/hockey|nhl/',$league)?'hockey':(preg_match('/ufc|mma|boxing|boxeo/',$league)?'fight':'soccer')));$teams=array_map(fn($name)=>team_identity($name,$league),$names);sort($teams);$identity=$sport.'|'.json_encode($teams).'|'.(int)preg_match('/femen|women|wnba|nwsl/',$league);}
        $chosen=null;foreach($groups as $i=>$g){$old=$g['event'];$same=$identity!==null&&$g['identity']===$identity;
            if(!$same&&$identity!==null&&$g['identity']!==null&&explode('|',$identity)[0]===explode('|',$g['identity'])[0]&&substr($identity,-1)===substr($g['identity'],-1)){
                $oldNames=preg_split('/\s+(?:vs?\.?|versus)\s+/iu',$old['title']);
                foreach([$league,folded($old['league'])] as $context){$left=array_map(fn($n)=>team_identity($n,$context),$oldNames);$right=array_map(fn($n)=>team_identity($n,$context),$names);sort($left);sort($right);if($left===$right){$same=true;break;}}
            }
            if($old['id']===$event['id']||$same&&today(strtotime($old['startsAt']))===today(strtotime($event['startsAt']))&&abs(strtotime($old['startsAt'])-strtotime($event['startsAt']))<=5400){$chosen=$i;break;}}
        if($chosen===null){$groups[]=['identity'=>$identity,'event'=>$event];continue;}
        $target=&$groups[$chosen]['event'];$target['providerLive']=($target['providerLive']??false)||($event['providerLive']??false);$target['legacyIds']=array_values(array_unique(array_merge($target['legacyIds'],[$event['id']],$event['legacyIds'])));
        if(in_array(folded($target['league']),['soccer','hockey','baloncesto'],true)&&!in_array($league,['soccer','hockey','baloncesto'],true))$target['league']=$event['league'];
        foreach($event['signals'] as $signal)if(!in_array($signal['id'],array_column($target['signals'],'id'),true))$target['signals'][]=$signal;usort($target['signals'],fn($a,$b)=>futbolvivo_signal_rank($a)<=>futbolvivo_signal_rank($b));unset($target);
    }return merge_agendas([array_column($groups,'event')]);
}
function futbolvivo_events(): array {
    $categories=cached_read('futbolvivo-categories');if(time()-($categories['loaded']??0)>86400){$categories=['loaded'=>time(),'data'=>futbolvivo_fetch('categories')];cached_write('futbolvivo-categories',$categories);}
    $us=futbolvivo_fetch('gsc/matches');$soccer=futbolvivo_fetch('matches');$latin=futbolvivo_fetch('latin/matches');
    return normalize_futbolvivo($us,$soccer,$latin,$categories['data']);
}
