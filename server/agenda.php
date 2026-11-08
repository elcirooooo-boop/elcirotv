<?php
declare(strict_types=1);
require_once __DIR__.'/futbolvivo.php';
function catalog(): array {static $v;return $v??=json_decode(file_get_contents(__DIR__.'/catalog.json'),true,64,JSON_THROW_ON_ERROR);}
function source_urls(?string $slug): array {
    if(!$slug)return [];
    if($slug==='premiere5')return ['https://streamxhd.sbs/live1.php?stream=premiere5','https://tvf90.com/1.php?stream=premiere5'];
    $c=catalog();if(!in_array($slug,array_column($c['channels'],'slug'),true))return [];
    $streamAliases=['espn'=>'espn','espn2'=>'espn2','espn3'=>'espn3','espn4'=>'espn4','espn5'=>'espn5','espn6'=>'espn6','espn7'=>'espn7','espnpremium'=>'espnpremium','dsports'=>'dsports','dsports2'=>'dsports2','dsportsplus'=>'dsportsplus','foxsports'=>'foxsports','fox1ar'=>'fox1ar','fox2ar'=>'fox2ar','fox3ar'=>'fox3ar','tntsports'=>'tntsports','tycsports'=>'tycsports','winsports'=>'winsports','winplus'=>'winplus','winsportsplus'=>'winplus','goltv'=>'goltv','tudn'=>'tudn_usa','telemundo'=>'telemundo','universo'=>'universo','canal5'=>'canal5mx'];
    $sources=[];
    $st=$streamAliases[$slug]??$slug;
    $sources[]='https://streamxhd.sbs/live1.php?stream='.rawurlencode($st);
    $clean=str_replace('_','-',$slug);$sources[]='https://tvf90.com/5.php?stream='.rawurlencode($clean);$sources[]='https://tvf90.com/plus1.php?stream='.rawurlencode($clean);
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
    foreach($signals as &$s){$urls=array_unique(array_merge(!empty($s['publishedOnly'])?[]:source_urls(channel_slug($s)),array_column($s['sources']??[],'url'),[$s['url']]));$s['sources']=array_map(fn($u)=>['id'=>fingerprint($u),'url'=>$u],array_values($urls));}unset($s);return $signals;
}
function catalog_signals(): array {return alternatives(array_map(function($c){return ['id'=>fingerprint('catalog:'.$c['slug']),'slug'=>$c['slug'],'name'=>$c['name'],'lang'=>'Español','provider'=>'streamxhd','url'=>source_urls($c['slug'])[0]];},catalog()['channels']));}
function classic_player_url(string $url): bool {
    $p=parse_url($url);if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['port']))return false;
    if(in_array($p['host']??'',['tvf90.com','tv-90.com','futbollibre.ch'],true))return futbolvivo_player_url($url);
    if(($p['host']??'')==='la18hd.su'&&($p['path']??'')==='/vivo/canal.php'){parse_str($p['query']??'',$q);return preg_match('/^[-a-z0-9_]{1,80}$/iD',(string)($q['stream']??''))===1;}
    return fulbito_player_url($url);
}
function classic_events(): array {
    $events=normalize_agenda(fetch_json('https://api.wqxag.com/diaries.json'));
    foreach($events as &$event)foreach($event['signals'] as &$signal)$signal['provider']='classic';unset($event,$signal);return $events;
}
function streamxhd_events(): array {
    try{$raw=fetch_json('https://streamxhd.sbs/eventos.json');}catch(Throwable){return [];}
    if(!isset($raw['sports'])||!is_array($raw['sports']))return [];
    $events=[];$now=time();
    foreach($raw['sports'] as $sport){
        $sportName=(string)($sport['name']??'Deportes');
        foreach($sport['leagues']??[] as $leagueData){
            $leagueName=trim((string)($leagueData['name']??$sportName));
            foreach($leagueData['events']??[] as $item){
                $title=trim((string)($item['title']??''));if(!$title)continue;
                $rawTime=trim((string)($item['time']??''));if(!$rawTime)continue;
                $rawTime=str_replace(' ','T',$rawTime);
                if(!preg_match('/[zZ]$|[+-]\d{2}:?\d{2}$/',$rawTime))$rawTime.='-05:00';
                try{$start=(new DateTimeImmutable($rawTime))->getTimestamp();}catch(Throwable){continue;}
                if(abs($start-$now)>86400&&today($start)!==today($now))continue;
                $league=!empty($item['league'])?trim((string)$item['league']):$leagueName;
                $id=fingerprint(iso($start).'|'.slugify($league).'|'.slugify($title));
                $signals=[];$seen=[];
                foreach($item['servers']??[] as $i=>$server){
                    $url=trim((string)($server['url']??''));if(!$url||!fulbito_player_url($url))continue;
                    if(isset($seen[$url]))continue;$seen[$url]=true;
                    $signals[]=['id'=>fingerprint($url),'name'=>mb_substr((string)($server['name']??'Opción '.($i+1)),0,100),'url'=>$url,'lang'=>'Español','provider'=>'streamxhd','publishedOnly'=>true];
                }
                if(!$signals)continue;
                $hourFormatted=(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i');
                $ev=['id'=>$id,'legacyIds'=>[],'title'=>$title,'league'=>$league,'startsAt'=>iso($start),'time'=>$hourFormatted,'signals'=>alternatives($signals)];
                if(!empty($item['homeLogo'])&&is_string($item['homeLogo'])&&str_starts_with($item['homeLogo'],'https://'))$ev['homeLogo']=$item['homeLogo'];
                if(!empty($item['awayLogo'])&&is_string($item['awayLogo'])&&str_starts_with($item['awayLogo'],'https://'))$ev['awayLogo']=$item['awayLogo'];
                $events[]=$ev;
            }
        }
    }
    return $events;
}
function rows($value): array {return isset($value['data'])&&is_array($value['data'])?$value['data']:(is_array($value)?$value:[]);}
function attrs(array $value): array {return $value['attributes']??$value;}
function normalize_agenda(array $payload,?int $now=null,bool $publishedOnly=false): array {
    $events=[];$raw=$payload['data']??$payload['events']??$payload;
    foreach($raw as $row){
        $a=attrs($row);$title=trim((string)($a['diary_description']??$a['title']??''));$hour=(string)($a['diary_hour']??$a['time']??'');$date=substr($a['date_diary']??$a['date']??today($now),0,10);
        $timestamp=str_contains($hour,'T')?$hour:$date.'T'.substr($hour?:'12:00:00',0,8);
        if(!preg_match('/[zZ]$|[+-]\d{2}:?\d{2}$/',$timestamp))$timestamp.='-05:00';
        try{$start=(new DateTimeImmutable($timestamp))->getTimestamp();}catch(Throwable){continue;}
        if(!$title||today($start)!==today($now))continue;
        $colon=strpos($title,':');$league=$colon===false?($a['sport']??'Deportes'):trim(substr($title,0,$colon));$match=$colon===false?$title:trim(substr($title,$colon+1));
        if($publishedOnly&&preg_match('/^(.+?)\s+[-–—]\s+(.+)$/u',$title,$parts)){$league=trim($parts[1]);$match=trim($parts[2]);}
        $id=fingerprint(iso($start).'|'.slugify($league).'|'.slugify($match));$signals=[];$seen=[];
        foreach(rows($a['embeds']??[]) as $i=>$embed){$embed=attrs($embed);$url=$embed['embed_iframe']??$embed['iframe']??$embed['url']??'';if(!$url)continue;
            try{$url=absolute_url($url,$publishedOnly?'https://fulbitotv.xyz/':'https://rojadirectatvplay.org/');parse_str(parse_url($url,PHP_URL_QUERY)??'',$query);if(isset($query['r']))$url=base64_decode($query['r'],true)?:'';safe_url($url);if($publishedOnly&&!fulbito_player_url($url))continue;}catch(Throwable){continue;}
            if(isset($seen[$url]))continue;$seen[$url]=true;$signals[]=['id'=>fingerprint($url),'name'=>mb_substr($embed['embed_name']??$embed['name']??'Opción '.($i+1),0,100),'url'=>$url,'lang'=>$embed['lang']??''];
            if($publishedOnly){$signals[count($signals)-1]['publishedOnly']=true;$signals[count($signals)-1]['id']=fulbito_signal_id($url);}
        }
        $legacy=[];
        try{$previous=(new DateTimeImmutable(str_contains($hour,'T')?$hour:$date.'T'.substr($hour?:'12:00:00',0,8).(isset($a['diary_description'])?'-05:00':'Z')))->getTimestamp();if($previous!==$start)$legacy[]=fingerprint(iso($previous).'|'.slugify($league).'|'.slugify($match));}catch(Throwable){}
        $events[]=['id'=>$id,'legacyIds'=>$legacy,'title'=>$match,'league'=>$league,'startsAt'=>iso($start),'time'=>$hour?(new DateTimeImmutable('@'.$start))->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i'):'--:--','signals'=>alternatives($signals)];
        if($publishedOnly)foreach(['homeLogo','awayLogo'] as $field)if(is_string($a[$field]??null)&&preg_match('~^https://a\.espncdn\.com/i/teamlogos/[^\s<>"\x27]+$~D',$a[$field]))$events[count($events)-1][$field]=$a[$field];
    }return $events;
}
function fulbito_player_url(string $url): bool {
    $p=parse_url($url);return ($p['scheme']??'')==='https'&&in_array(strtolower($p['host']??''),['streamxhd.sbs','stream-xhd.com'],true)&&($p['path']??'')==='/live1.php';
}
function fulbito_signal_id(string $url): string {
    parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);return fingerprint('fulbito:'.strtolower((string)($q['stream']??$url)));
}
function combine_fulbito_sources(array $events,array $channels): array {
    $pool=[];foreach(array_merge($events,[['signals'=>$channels]]) as $event)foreach($event['signals'] as $s)foreach($s['sources'] as $source)$pool[$s['id']][$source['url']]=$source;
    foreach($events as &$event)foreach($event['signals'] as &$s)$s['sources']=array_values($pool[$s['id']]);unset($event,$s);
    foreach($channels as &$s)$s['sources']=array_values($pool[$s['id']]);unset($s);
    return [$events,$channels];
}
function fulbito_channels(): array {
    $old=cached_read('fulbito-channels-v2');if(time()-($old['loaded']??0)<300)return $old['signals'];
    try{$signals=[];foreach(fetch_json('https://fulbitotv.xyz/canales') as $row){$url=$row['iframe']??'';if(!is_string($url)||!fulbito_player_url($url))continue;$id=fulbito_signal_id($url);$signals[$id]=['id'=>$id,'name'=>mb_substr((string)($row['nombre']??'Canal'),0,100),'url'=>$url,'lang'=>'Español','publishedOnly'=>true];}
        $signals=alternatives(array_values($signals));cached_write('fulbito-channels-v2',['loaded'=>time(),'signals'=>$signals]);return $signals;
    }catch(Throwable){return $old['signals']??[];}
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
    $title=preg_replace('/^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]\s*/iu','',$e['title']);$title=preg_replace('/^Mexico City Game\s*[-–—:]\s*/iu','',$title);$names=preg_split('/\s+(?:vs?\.?|versus)\s+/iu',$title);
    if(count($names)!==2){$context=folded($e['league'].' '.$title);if(preg_match('/\bgolf\b/',$context))return 'session:golf:'.folded($title);if(preg_match('/\bmoto\s*gp\b/',$context))return 'session:motogp:'.trim(preg_replace('/\b(motogp|moto gp|gp|gran premio|deportes)\b/','',$context));return null;}
    $league=$e['league'];if(preg_match('/^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/iu',$e['title'],$m))$league=$m[1];$league=folded($league);
    $league=match($league){'nba usa'=>'nba','liga 1 argentina','liga profesional','liga profesional argentina'=>'liga profesional argentina','liga 1 colombia','primera a','liga betplay','liga betplay dimayor'=>'colombia primera a','laliga ea sports'=>'laliga','laliga smartbank','laliga hypermotion'=>'laliga 2','bundesliga 2'=>'2 bundesliga','liga de ecuador','serie a italia'=>'serie a','ligue 1 francia'=>'ligue 1','mls usa'=>'mls','liga de portugal'=>'primeira liga','liga turquia'=>'super lig','premiership escocia'=>'premiership','liga 1 chile','liga de costa rica'=>'primera division','liga 1 peru'=>'liga 1','copa do brasil'=>'copa de brasil',default=>$league};
    $teams=[team_identity(trim($names[0]),$league),team_identity(trim($names[1]),$league)];if(in_array($league,['nba','wnba','nhl','nfl','mlb'],true))sort($teams);
    return json_encode([$league,...$teams]);
}

// Read only dated event rows and the channel links published inside those rows.
function normalize_public_programme(string $html,?int $now=null): array {
    $months=['enero'=>1,'febrero'=>2,'marzo'=>3,'abril'=>4,'mayo'=>5,'junio'=>6,'julio'=>7,'agosto'=>8,'septiembre'=>9,'octubre'=>10,'noviembre'=>11,'diciembre'=>12];
    if(!preg_match('/Partidos de hoy\s+\S+\s+(\d{1,2})\s+de\s+(\p{L}+)\s+(\d{4})/iu',strip_tags($html),$date))return [];
    $month=$months[folded($date[2])]??0;if(!$month||!checkdate($month,(int)$date[1],(int)$date[3]))return [];
    $day=sprintf('%04d-%02d-%02d',$date[3],$month,$date[1]);
    $dom=new DOMDocument();$prior=libxml_use_internal_errors(true);try{$dom->loadHTML('<?xml encoding="UTF-8">'.$html,LIBXML_NONET|LIBXML_NOERROR|LIBXML_NOWARNING);}finally{libxml_clear_errors();libxml_use_internal_errors($prior);}
    $xpath=new DOMXPath($dom);$events=[];
    foreach($xpath->query('//tr[td/span[@class="t"]]') as $row){
        $time=trim($xpath->evaluate('string(td/span[@class="t"])',$row));$cells=$xpath->query('td',$row);if($cells->length<3||!preg_match('/^\d{2}:\d{2}$/D',$time))continue;
        $cell=$cells->item(2);$anchor=$xpath->query('.//a[@href]',$cell)->item(0);if(!$anchor)continue;
        $title=trim(preg_replace('/\s+en\s+vivo\s*$/iu','',$anchor->textContent));$category=trim(explode(':',$cell->textContent,2)[0]);
        $category=match($category){'Moto GP'=>'MotoGP','NBA USA'=>'NBA',default=>$category};
        $url=absolute_url($anchor->getAttribute('href'),'https://www.rojadirectatv.company/');
        // This source's internal channel pages have a supported player chain.
        if(parse_url($url,PHP_URL_HOST)!=='www.rojadirectatv.company'||!preg_match('~^/canal-\d+\.php$~D',parse_url($url,PHP_URL_PATH)??''))continue;
        $events[]=['title'=>$category.': '.$title,'date'=>$day,'time'=>$day.'T'.$time.':00-05:00','embeds'=>[['name'=>'Señal '.preg_replace('/\D/','',parse_url($url,PHP_URL_PATH)),'url'=>$url]]];
    }
    return normalize_agenda($events,$now);
}
function merge_agendas(array $feeds): array {
    $groups=[];$ids=[];
    foreach($feeds as $feedIndex=>$feed)foreach($feed as $e){$identity=fixture_identity($e);$start=strtotime($e['startsAt']);$chosen=$ids[$e['id']]??null;
        if($chosen===null&&$identity!==null){$exact=[];$near=[];foreach($groups as $i=>$g)if($g['identity']===$identity){if($g['start']===$start||str_starts_with($identity,'session:golf:')&&today($g['start'])===today($start))$exact[]=$i;elseif(!in_array($feedIndex,$g['feeds'],true)&&abs($g['start']-$start)<=900&&today($g['start'])===today($start))$near[]=$i;}$options=$exact?:$near;if(count($options)===1)$chosen=$options[0];}
        if($chosen===null){$chosen=count($groups);$groups[]=['event'=>$e,'identity'=>$identity,'start'=>$start,'feeds'=>[$feedIndex]];}
        else{$existing=&$groups[$chosen]['event'];$existing['legacyIds']=array_values(array_diff(array_unique(array_merge($existing['legacyIds']??[],[$e['id']],$e['legacyIds']??[])),[$existing['id']]));foreach($e['signals'] as $signal)if(!in_array($signal['id'],array_column($existing['signals'],'id'),true))$existing['signals'][]=$signal;$groups[$chosen]['feeds'][]=$feedIndex;unset($existing);}$ids[$e['id']]=$chosen;
    }
    $events=array_column($groups,'event');$published=[];
    foreach($events as $event)foreach($event['signals'] as $signal){$p=parse_url($signal['url']);parse_str($p['query']??'',$q);if(in_array(preg_replace('/^www\./','',$p['host']??''),['streamxhd.sbs','stream-xhd.com','tvf90.com','la18hd.su'],true)&&in_array($p['path']??'',['/live1.php','/5.php','/1.php','/plus1.php','/vivo/canal.php'],true)&&preg_match('/^[a-z0-9_-]{1,80}$/i',$q['stream']??''))$published[$q['stream']][]=$signal['url'];}
    foreach($events as &$event){foreach($event['signals'] as &$signal){parse_str(parse_url($signal['url'],PHP_URL_QUERY)??'',$q);if(isset($published[$q['stream']??'']))foreach($published[$q['stream']] as $u)$signal['sources'][]=['id'=>fingerprint($u),'url'=>$u];}unset($signal);$event['signals']=alternatives($event['signals']);}unset($event);
    usort($events,fn($a,$b)=>strcmp($a['startsAt'],$b['startsAt'])?:strcmp($a['title'],$b['title']));return $events;
}
function agenda_feed(string $name,callable $fetch): ?array {
    try{$events=$fetch();$old=cached_read('feed-'.$name);
        if(!$events&&($old['day']??'')===today()&&time()-($old['loaded']??0)<1800&&!empty($old['events']))return $old['events'];
        cached_write('feed-'.$name,['day'=>today(),'loaded'=>time(),'events'=>$events]);return $events;
    }catch(Throwable){}
    $old=cached_read('feed-'.$name);return ($old['day']??'')===today()&&time()-($old['loaded']??0)<1800?($old['events']??[]):null;
}
function remember_published_signals(array $events,?int $seenAt=null): void {
    $signals=array_filter(cached_read('published-signals-classic-external')??[],fn($row)=>($row['until']??0)>time());
    $until=($seenAt??time())+21600;
    if($until>time())foreach($events as $event)foreach($event['signals'] as $signal)if(($signals[$signal['id']]['until']??0)<$until)$signals[$signal['id']]=['until'=>$until,'signal'=>$signal];
    cached_write('published-signals-classic-external',$signals);
}
function published_signal(string $id): ?array {
    $row=(cached_read('published-signals-classic-external')??[])[$id]??null;return ($row['until']??0)>time()?($row['signal']??null):null;
}
function retain_agenda_links(array $events,array $previous): array {
    foreach($previous as $old){$identity=fixture_identity($old);$matches=[];$exact=[];
        foreach($events as $i=>$event)if(today(strtotime($old['startsAt']))===today(strtotime($event['startsAt']))&&($identity!==null&&fixture_identity($event)===$identity||folded($old['title'])===folded($event['title']))){$matches[]=$i;if($old['startsAt']===$event['startsAt'])$exact[]=$i;}
        $candidates=$exact?:$matches;if(count($candidates)!==1)continue;$i=$candidates[0];
        $events[$i]['legacyIds']=array_values(array_diff(array_unique(array_merge($events[$i]['legacyIds']??[],[$old['id']],$old['legacyIds']??[])),[$events[$i]['id']]));
    }return $events;
}
function agenda(): array {
    $old=cached_read('agenda-streamxhd-v1');if(($old['version']??0)===4&&($old['day']??'')===today()&&time()-($old['loaded']??0)<90)return $old;
    $lock=fopen(storage().'/agenda-streamxhd-v1.lock','c');if(!$lock)throw new RuntimeException('CACHE_LOCK');
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);if(($old['day']??'')===today()&&time()-($old['loaded']??0)<1800)return array_replace($old,['stale'=>true]);return ['provider'=>'streamxhd','day'=>today(),'events'=>[],'channels'=>catalog_signals(),'updatedAt'=>iso(time()),'stale'=>true];}
    try{prune_playback_cache();$feeds=[];
        $feeds[]=agenda_feed('streamxhd-v1',fn()=>streamxhd_events());
        if(empty($feeds[0]))$feeds[]=agenda_feed('classic-direct-v3',fn()=>classic_events());
        $feeds=array_values(array_filter($feeds,fn($feed)=>$feed!==null));$unavailable=!$feeds;
        if($unavailable&&($old['day']??'')===today()&&time()-($old['loaded']??0)<1800)return array_replace($old,['stale'=>true]);
        $previous=$old??cached_read('agenda-classic-direct-v3')??cached_read('agenda-futbolvivo-external-v2');$events=retain_agenda_links(merge_agendas($feeds),$previous['events']??[]);$channels=catalog_signals();
        if($old)remember_published_signals($old['events']??[],(int)($old['loaded']??0));
        remember_published_signals(array_merge($events,[['signals'=>$channels]]));
        $data=['version'=>4,'provider'=>'streamxhd','day'=>today(),'events'=>$events,'channels'=>$channels,'updatedAt'=>iso(time()),'loaded'=>time(),'stale'=>$unavailable];cached_write('agenda-streamxhd-v1',$data);return $data;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function public_agenda(array $data): array {
    $hide=function($signal){if(($signal['provider']??'')==='futbolvivo'&&futbolvivo_player_url($signal['url']))$signal['playerUrl']=$signal['url'];unset($signal['url'],$signal['sources'],$signal['publishedOnly'],$signal['provider']);return $signal;};$channels=[];
    foreach(in_array($data['provider']??'',['classic','fulbito','futbolvivo','streamxhd'],true)?($data['channels']??[]):catalog_signals() as $s)$channels[$s['id']]=$hide($s);
    $events=$data['events'];foreach($events as &$event)foreach($event['signals'] as &$s){$channels[$s['id']]=$hide($s);$s=$hide($s);}unset($event,$s);
    return ['provider'=>$data['provider']??'','day'=>$data['day'],'updatedAt'=>$data['updatedAt'],'stale'=>$data['stale'],'events'=>$events,'channels'=>array_values($channels)];
}
