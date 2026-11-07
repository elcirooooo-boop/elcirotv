<?php
declare(strict_types=1);
function catalog(): array {static $v;return $v??=json_decode(file_get_contents(__DIR__.'/catalog.json'),true,64,JSON_THROW_ON_ERROR);}
function source_urls(?string $slug): array {
    if($slug==='premiere5')return ['https://tvf90.com/1.php?stream=premiere5'];
    $c=catalog();if(!in_array($slug,array_column($c['channels'],'slug'),true))return [];
    $clean=str_replace('_','-',$slug);$sources=['https://tvf90.com/5.php?stream='.rawurlencode($clean),'https://tvf90.com/plus1.php?stream='.rawurlencode($clean)];
    $compact=str_replace('-','',$clean);if($compact!==$clean)$sources[]='https://tvf90.com/5.php?stream='.rawurlencode($compact);
    $sources[]='https://la18hd.su/vivo/canal.php?stream='.rawurlencode($c['providerAliases'][$slug]??$c['providerAliases'][$clean]??$slug);
    if(isset($c['pages'][$slug]))$sources[]='https://rojadirectatvplay.org/en-vivo/'.$c['pages'][$slug];return $sources;
}
function channel_slug(array $s): ?string {
    parse_str(parse_url($s['url'],PHP_URL_QUERY)??'',$query);$c=catalog();
    if(!empty($query['stream']))return $c['aliases'][$query['stream']]??$query['stream'];
    $name=preg_replace('/\([^)]*\)/','',folded($s['name']));$name=preg_replace('/\b(hd|movil)\b/','',$name);$name=preg_replace('/[^a-z0-9]/','',$name);
    if(preg_match('/^disney0*(\d+)$/',$name,$m)&&isset($c['aliases']['disney'.(int)$m[1]]))return 'disney'.(int)$m[1];
    return $c['aliases'][$name]??null;
}
function alternatives(array $signals): array {
    foreach($signals as &$s){$urls=array_unique(array_merge(source_urls(channel_slug($s)),array_column($s['sources']??[],'url'),[$s['url']]));$s['sources']=array_map(fn($u)=>['id'=>fingerprint($u),'url'=>$u],array_values($urls));}unset($s);return $signals;
}
function catalog_signals(): array {return alternatives(array_map(function($c){return ['id'=>fingerprint('catalog:'.$c['slug']),'slug'=>$c['slug'],'name'=>$c['name'],'lang'=>'Español','url'=>source_urls($c['slug'])[0]];},catalog()['channels']));}
function rows($value): array {return isset($value['data'])&&is_array($value['data'])?$value['data']:(is_array($value)?$value:[]);}
function attrs(array $value): array {return $value['attributes']??$value;}
function normalize_agenda(array $payload,?int $now=null): array {
    $events=[];$raw=$payload['data']??$payload['events']??$payload;
    foreach($raw as $row){
        $a=attrs($row);$title=trim((string)($a['diary_description']??$a['title']??''));$hour=(string)($a['diary_hour']??$a['time']??'');$date=substr($a['date_diary']??$a['date']??today($now),0,10);
        $timestamp=str_contains($hour,'T')?$hour:$date.'T'.substr($hour?:'12:00:00',0,8);
        if(!preg_match('/[zZ]$|[+-]\d{2}:?\d{2}$/',$timestamp))$timestamp.='-05:00';
        try{$start=(new DateTimeImmutable($timestamp))->getTimestamp();}catch(Throwable){continue;}
        if(!$title||today($start)!==today($now))continue;
        $colon=strpos($title,':');$league=$colon===false?($a['sport']??'Deportes'):trim(substr($title,0,$colon));$match=$colon===false?$title:trim(substr($title,$colon+1));
        $id=fingerprint(iso($start).'|'.slugify($league).'|'.slugify($match));$signals=[];$seen=[];
        foreach(rows($a['embeds']??[]) as $i=>$embed){$embed=attrs($embed);$url=$embed['embed_iframe']??$embed['iframe']??$embed['url']??'';if(!$url)continue;
            try{$url=absolute_url($url,'https://rojadirectatvplay.org/');parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);if(isset($query['r']))$url=base64_decode($query['r'],true)?:'';safe_url($url);}catch(Throwable){continue;}
            if(isset($seen[$url]))continue;$seen[$url]=true;$signals[]=['id'=>fingerprint($url),'name'=>mb_substr($embed['embed_name']??$embed['name']??'Opción '.($i+1),0,100),'url'=>$url,'lang'=>$embed['lang']??''];
        }
        $legacy=[];
        try{$previous=(new DateTimeImmutable(str_contains($hour,'T')?$hour:$date.'T'.substr($hour?:'12:00:00',0,8).(isset($a['diary_description'])?'-05:00':'Z')))->getTimestamp();if($previous!==$start)$legacy[]=fingerprint(iso($previous).'|'.slugify($league).'|'.slugify($match));}catch(Throwable){}
        $events[]=['id'=>$id,'legacyIds'=>$legacy,'title'=>$match,'league'=>$league,'startsAt'=>iso($start),'time'=>$hour?(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i'):'--:--','signals'=>alternatives($signals)];
    }return $events;
}
function team_identity(string $name,string $league): string {
    static $index;if($index===null)$index=json_decode(file_get_contents(__DIR__.'/teams.json'),true,64,JSON_THROW_ON_ERROR);
    $gender=preg_match('/\b(femenil|femenino|femenina|women|womens|wnba|nwsl)\b/',folded($name.' '.$league))?'women':'men';
    $sport=preg_match('/nhl|hockey/',$league)?'hockey':(preg_match('/nfl|futbol americano/',$league)?'football':(preg_match('/nba|basket|baloncesto|euroliga/',$league)?'basketball':(preg_match('/mlb|beisbol|baseball/',$league)?'baseball':'soccer')));
    if(preg_match('/\b(sub|u)\s*\d{2}\b/',folded($name.' '.$league)))return 'name:'.folded($name);
    $normalized=trim(preg_replace('/\b(femenil|femenino|femenina|women|womens)\b/','',folded($name)));$matches=$index[$sport.':'.$gender.':'.$normalized]??[];
    $codes=['/liga profesional|argentina/'=>'arg.1','/brasileir|brasil/'=>'bra.1','/primera a|colombia/'=>'col.1','/liga mx/'=>'mex.1','/laliga|liga espan/'=>'esp.1','/premier league/'=>'eng.1'];
    foreach($codes as $pattern=>$code)if(preg_match($pattern,$league)){$local=array_values(array_filter($matches,fn($t)=>in_array($code,$t['leagues'],true)));if(count($local)===1)return $local[0]['id'];break;}
    return count($matches)===1?$matches[0]['id']:'name:'.folded($name);
}
function fixture_identity(array $e): ?string {
    $title=preg_replace('/^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]\s*/iu','',$e['title']);$names=preg_split('/\s+(?:vs?\.?|versus)\s+/iu',$title);if(count($names)!==2)return null;
    $league=$e['league'];if(preg_match('/^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/iu',$e['title'],$m))$league=$m[1];$league=folded($league);
    $league=match($league){'liga profesional','liga profesional argentina'=>'liga profesional argentina','primera a','liga betplay','liga betplay dimayor'=>'colombia primera a',default=>$league};
    return json_encode([$league,team_identity(trim($names[0]),$league),team_identity(trim($names[1]),$league)]);
}
function merge_agendas(array $feeds): array {
    $groups=[];$ids=[];
    foreach($feeds as $feedIndex=>$feed)foreach($feed as $e){$identity=fixture_identity($e);$start=strtotime($e['startsAt']);$chosen=$ids[$e['id']]??null;
        if($chosen===null&&$identity!==null){$exact=[];$near=[];foreach($groups as $i=>$g)if($g['identity']===$identity){if($g['start']===$start)$exact[]=$i;elseif(!in_array($feedIndex,$g['feeds'],true)&&abs($g['start']-$start)<=900&&today($g['start'])===today($start))$near[]=$i;}$options=$exact?:$near;if(count($options)===1)$chosen=$options[0];}
        if($chosen===null){$chosen=count($groups);$groups[]=['event'=>$e,'identity'=>$identity,'start'=>$start,'feeds'=>[$feedIndex]];}
        else{$existing=&$groups[$chosen]['event'];$existing['legacyIds']=array_values(array_diff(array_unique(array_merge($existing['legacyIds']??[],[$e['id']],$e['legacyIds']??[])),[$existing['id']]));foreach($e['signals'] as $signal)if(!in_array($signal['id'],array_column($existing['signals'],'id'),true))$existing['signals'][]=$signal;$groups[$chosen]['feeds'][]=$feedIndex;unset($existing);}$ids[$e['id']]=$chosen;
    }
    $events=array_column($groups,'event');$published=[];
    foreach($events as $event)foreach($event['signals'] as $signal){$p=parse_url($signal['url']);parse_str($p['query']??'',$q);if(in_array(preg_replace('/^www\./','',$p['host']??''),['tvf90.com','la18hd.su'],true)&&in_array($p['path']??'',['/5.php','/1.php','/plus1.php','/vivo/canal.php'],true)&&preg_match('/^[a-z0-9_-]{1,80}$/i',$q['stream']??''))$published[$q['stream']][]=$signal['url'];}
    foreach($events as &$event){foreach($event['signals'] as &$signal){parse_str(parse_url($signal['url'],PHP_URL_QUERY)??'',$q);if(isset($published[$q['stream']??'']))foreach($published[$q['stream']] as $u)$signal['sources'][]=['id'=>fingerprint($u),'url'=>$u];}unset($signal);$event['signals']=alternatives($event['signals']);}unset($event);
    usort($events,fn($a,$b)=>strcmp($a['startsAt'],$b['startsAt'])?:strcmp($a['title'],$b['title']));return $events;
}
function agenda(): array {
    $old=cached_read('agenda');if(($old['version']??0)===2&&($old['day']??'')===today()&&time()-($old['loaded']??0)<90)return $old;
    $lock=fopen(storage().'/agenda.lock','c');if(!$lock)throw new RuntimeException('CACHE_LOCK');
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);if(($old['day']??'')===today()&&time()-($old['loaded']??0)<1800)return array_replace($old,['stale'=>true]);throw new RuntimeException('AGENDA_LOADING');}
    try{$feeds=[];foreach(['https://api.wqxag.com/diaries.json','https://tarjetadigital.club/api/agenda'] as $url)try{$feeds[]=normalize_agenda(fetch_json($url));}catch(Throwable){}
        if(!$feeds){if(($old['day']??'')===today()&&time()-($old['loaded']??0)<1800)return array_replace($old,['stale'=>true]);throw new RuntimeException('AGENDA_UNAVAILABLE');}
        $data=['version'=>2,'day'=>today(),'events'=>merge_agendas($feeds),'updatedAt'=>iso(time()),'loaded'=>time(),'stale'=>false];cached_write('agenda',$data);return $data;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function public_agenda(array $data): array {
    $hide=function($signal){unset($signal['url'],$signal['sources']);return $signal;};$channels=[];
    foreach(catalog_signals() as $s)$channels[$s['id']]=$hide($s);
    $events=$data['events'];foreach($events as &$event)foreach($event['signals'] as &$s){$channels[$s['id']]=$hide($s);$s=$hide($s);}unset($event,$s);
    return ['day'=>$data['day'],'updatedAt'=>$data['updatedAt'],'stale'=>$data['stale'],'events'=>$events,'channels'=>array_values($channels)];
}
