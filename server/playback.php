<?php
declare(strict_types=1);
function external_playback(array $signal): array {
    $sources=[];foreach($signal['sources']??[['url'=>$signal['url']]] as $source){$url=$source['url'];if(($signal['provider']??'')==='futbolvivo'?futbolvivo_player_url($url):fulbito_player_url($url))$sources[$url]=['url'=>$url,'sourceKey'=>fingerprint($url)];}
    if(!$sources)throw new RuntimeException('CHANNEL_UNAVAILABLE');$sources=array_values($sources);
    return ['transport'=>'embed','openInNewTab'=>false,'name'=>$signal['name'],'url'=>$sources[0]['url'],'sourceKey'=>$sources[0]['sourceKey'],'sources'=>$sources];
}
function published_player_config(string $html): ?array {
    if(!preg_match('~window\._econfig\s*=\s*["\']([A-Za-z0-9+/=]+)["\']~',$html,$m))return null;
    if(strlen($m[1])>250000)return null;$raw=base64_decode($m[1],true);if($raw===false)return null;$size=(int)ceil(strlen($raw)/4);$parts=[];
    foreach([2,0,3,1] as $i=>$position){$part=substr($raw,$i*$size,$size);if(strlen($part)<4)return null;$decoded=base64_decode(substr($part,0,3).substr($part,4),true);if($decoded===false)return null;$parts[$position]=$decoded;}
    ksort($parts);$json=base64_decode(implode('',$parts),true);if($json===false)return null;
    try{$config=json_decode($json,true,32,JSON_THROW_ON_ERROR);}catch(Throwable){return null;}
    // Read video configuration only; never evaluate the page's ads or scripts.
    if(!is_array($config)||($config['domainlocked']??false))return null;return $config;
}
function published_playback_url(string $html): ?string {
    $config=published_player_config($html);if($config){foreach(['stream_url_nop2p','stream_url'] as $key)if(is_string($config[$key]??null)&&$config[$key]!=='')return $config[$key];}
    if(preg_match('~\b(?:var|let|const)\s+playbackURL\s*=\s*["\']([^"\']+)["\']~',$html,$m))return $m[1];
    if(preg_match('~["\']((?:https?:)?//[^\s"\'<>]+\.m3u8(?:\?[^\s"\'<>]*)?)["\']~i',$html,$m))return $m[1];
    // Decode the provider's character table without executing any remote JavaScript.
    if(!preg_match('~\bvar playbackURL="",(\w+)=\[\]~',$html,$variable))return null;$name=preg_quote($variable[1],'~');
    if(!preg_match('~\b'.$name.'\s*=\s*(\[\[.{1,30000}?\]\])\s*;~s',$html,$table)||!preg_match('~var k=(\w+)\(\)\+(\w+)\(\); '.$name.'\.forEach~',$html,$key))return null;
    $sum=0;foreach([$key[1],$key[2]] as $fn){if(!preg_match('~function '.preg_quote($fn,'~').'\(\)\{return (\d{1,8});\}~',$html,$n))return null;$sum+=(int)$n[1];}
    try{$pairs=json_decode($table[1],true,8,JSON_THROW_ON_ERROR);}catch(Throwable){return null;}
    if(count($pairs)>4096)return null;usort($pairs,fn($a,$b)=>($a[0]??0)<=>($b[0]??0));$url='';
    foreach($pairs as $pair){if(count($pair)!==2||!is_string($pair[1]))return null;$decoded=base64_decode($pair[1],true);if($decoded===false)return null;$code=(int)preg_replace('/\D/','',$decoded)-$sum;if($code<32||$code>126)return null;$url.=chr($code);}
    return $url?:null;
}
function supported_player_host(string $host): bool {
    $host=preg_replace('/^www\./','',strtolower($host));
    return in_array($host,['rojadirectatvmas.net','rojadirectatvplay.org','tarjetadigital.club','la18hd.su','tvf90.com','rojadirectatv.company','tarjetarojatv.cam','rodrixtv.site','streamxhd.sbs','stream-xhd.com','zonalivetv.biz','dog.tilinhd.lol','sportsoonline.click'],true)||preg_match('/^[a-f0-9]{32}\.dynmetal\.net$/D',$host)===1;
}
function resolve_player(string $initial): array {
    $pending=[[$initial,'https://tarjetadigital.club/',0]];$seen=[];$deadline=microtime(true)+18;
    $pageKey='native-player-page-'.fingerprint($initial);$warm=cached_read($pageKey);
    if(($warm['until']??0)>time()&&isset($warm['page'],$warm['referer']))array_unshift($pending,[$warm['page'],$warm['referer'],0]);
    while($pending&&count($seen)<8&&microtime(true)<$deadline){[$value,$referer,$depth]=array_shift($pending);$p=safe_url($value);
        if(preg_match('/\.m3u8$/i',$p['path']??''))return ['url'=>$value,'referer'=>$referer];
        if(!supported_player_host($p['host'])||isset($seen[$value])||$depth>6)continue;$seen[$value]=true;
        try{$r=net_request($value,$referer,'',1500000,5);$url=$r['url'];if(!supported_player_host(parse_url($url,PHP_URL_HOST))||$r['status']!==200){fclose($r['stream']);continue;}
            $html=str_replace(['\\/','&amp;'],['/','&'],read_text($r));
            $config=published_player_config($html);
            if($config&&$p['host']==='dog.tilinhd.lol'&&str_contains($html,'stream_tv=')){
                $media=$config['stream_url_nop2p']??$config['stream_url']??'';
                if(is_string($media)&&$media!==''){safe_url($media);$target=absolute_url('playstream.php?stream_tv='.rtrim(strtr(base64_encode($media),'+/','-_'),'='),$url);
                    cached_write($pageKey,['page'=>$url,'referer'=>$referer,'until'=>time()+1800]);return ['url'=>$target,'referer'=>$url];}
            }
            $hls=published_playback_url($html);
            if($hls){$target=absolute_url($hls,$url);safe_url($target);if(preg_match('/\.m3u8$/i',parse_url($target,PHP_URL_PATH)??'')){cached_write($pageKey,['page'=>$url,'referer'=>$referer,'until'=>time()+1800]);return ['url'=>$target,'referer'=>$url];}}
            preg_match_all('~<iframe\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']~i',$html,$frames);foreach($frames[1] as $frame)$pending[]=[absolute_url($frame,$url),$url,$depth+1];
            if(preg_match('~iframe\.src\s*=\s*atob\(\s*["\']([A-Za-z0-9+/=]{1,4096})["\']\s*\)~',$html,$encoded)){$frame=base64_decode($encoded[1],true);if($frame!==false)$pending[]=[absolute_url($frame,$url),$url,$depth+1];}
            if(preg_match('~\b(?:let|var|const)\s+encodedUrl\s*=\s*["\']([A-Za-z0-9+/=]{1,4096})["\']~',$html,$encoded)){$frame=base64_decode($encoded[1],true);if($frame!==false)$pending[]=[absolute_url($frame,$url),$url,$depth+1];}
            parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);if(isset($q['url']))$pending[]=[absolute_url($q['url'],$url),$url,$depth+1];
        }catch(Throwable){}
    }throw new RuntimeException('SOURCE_UNAVAILABLE');
}
function remember_startup_manifest(string $requested,string $referer,string $base,string $text): void {
    if(!str_starts_with(ltrim($text),'#EXTM3U')||strlen($text)>1000000)return;
    cached_write('startup-'.fingerprint($requested.'|'.$referer),['until'=>time()+3,'base'=>$base,'text'=>$text]);
    if(random_int(1,16)===1)foreach(glob(storage().'/startup-*.json')?:[] as $file)if(filemtime($file)<time()-30)@unlink($file);
}
function startup_manifest(string $requested,string $referer): ?array {
    $cached=cached_read('startup-'.fingerprint($requested.'|'.$referer));
    return ($cached['until']??0)>time()&&str_starts_with(ltrim($cached['text']??''),'#EXTM3U')?$cached:null;
}
function probe_playlist(array $resolved,bool $checkMedia=true,?callable $fetch=null): void {
    $fetch??=fn(...$args)=>net_request(...$args);
    $target=$resolved['url'];
    for($depth=0;$depth<3;$depth++){$r=$fetch($target,$resolved['referer'],'',1000000,5);if($r['status']!==200){fclose($r['stream']);throw new RuntimeException('PLAYLIST_HTTP');}$url=$r['url'];$text=read_text($r);$lines=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($line)=>$line!==''&&!str_starts_with($line,'#')));
        if(!str_starts_with(ltrim($text),'#EXTM3U')||!$lines)throw new RuntimeException('INVALID_MANIFEST');
        remember_startup_manifest($target,$resolved['referer'],$url,$text);
        // On initial selection, hand the validated playlist straight to HLS.
        // Segment checks are reserved for recovery, avoiding a duplicate video download.
        if(!$checkMedia)return;
        if(str_contains($text,'#EXT-X-STREAM-INF')){$target=absolute_url($lines[0],$url);continue;}
        $segment=absolute_url($lines[max(0,count($lines)-3)],$url);
        // Range responses may be ignored by a provider; bound this probe too.
        $media=$fetch($segment,$resolved['referer'],'bytes=0-187',19000000,5);
        $valid=$media['status']>=200&&$media['status']<300&&!preg_match('/html|javascript|json|svg/i',$media['headers']['content-type']??'')&&fstat($media['stream'])['size']>0;fclose($media['stream']);
        if(!$valid)throw new RuntimeException('SEGMENT_HTTP');return;
    }throw new RuntimeException('PLAYLIST_DEPTH');
}
function select_playback(array $signal,array $excluded,bool $refresh): array {
    $name='native-playback-'.$signal['id'];$cached=cached_read($name);$sources=$signal['sources']??[['id'=>fingerprint($signal['url']),'url'=>$signal['url']]];
    if(!$refresh&&($cached['until']??0)>time()&&!in_array($cached['result']['sourceKey'],$excluded,true)&&in_array($cached['result']['sourceKey'],array_column($sources,'id'),true))return $cached['result'];
    if(isset($cached['result']['sourceKey']))usort($sources,fn($a,$b)=>(int)($b['id']===$cached['result']['sourceKey'])<=>(int)($a['id']===$cached['result']['sourceKey']));
    $deadline=microtime(true)+24;$tried=0;
    foreach($sources as $source){if(in_array($source['id'],$excluded,true))continue;if(microtime(true)>$deadline||$tried++>=6)break;
        try{$resolved=resolve_player($source['url']);probe_playlist($resolved,$refresh);$resolved['sourceKey']=$source['id'];cached_write($name,['until'=>time()+120,'result'=>$resolved]);return $resolved;}catch(Throwable){}
    }
    throw new RuntimeException('CHANNEL_UNAVAILABLE');
}
function rewrite_manifest(string $text,string $base,string $referer,int $expiry): string {
    if(!str_starts_with(ltrim($text),'#EXTM3U')||strlen($text)>1000000)throw new RuntimeException('INVALID_MANIFEST');
    $local=fn($value)=>'/api/media?t='.rawurlencode(grant_media(absolute_url($value,$base),$referer,$expiry));
    return implode("\n",array_map(function($line)use($local){if(trim($line)!==''&&!str_starts_with($line,'#'))return $local(trim($line));return preg_replace_callback('/URI="([^"]+)"/',fn($m)=>'URI="'.$local($m[1]).'"',$line);},preg_split('/\r?\n/',$text)));
}
function media_identity(string $url): string {
    $p=safe_url($url);parse_str($p['query']??'',$q);foreach(array_keys($q) as $k)if(in_array(strtolower($k),['token','auth','expires','expiry','signature','sig','hdntl','hdnts'],true))unset($q[$k]);ksort($q);return ($p['path']??'/').'?'.http_build_query($q);
}
function renew_media(array $permission,string $range): ?array {
    try{$player=safe_url($permission['referer']);$original=safe_url($permission['url']);parse_str($player['query']??'',$q);
        if(!in_array(preg_replace('/^www\./','',$player['host']),['tvf90.com','la18hd.su','streamxhd.sbs','stream-xhd.com'],true)||!preg_match('/^[-a-z0-9_]{1,80}$/i',$q['stream']??'')||!preg_match('/\.(m3u8|ts|m4s|aac)$/i',$original['path']??''))return null;
        $fresh=resolve_player($permission['referer']);$target=$fresh['url'];
        if(preg_match('/\.m3u8$/i',$original['path'])){if(media_identity($permission['url'])!==media_identity($target))return null;return net_request($target,$fresh['referer'],$range,19000000);}
        for($depth=0;$depth<3;$depth++){$r=net_request($target,$fresh['referer'],'',1000000,5);if($r['status']!==200){fclose($r['stream']);return null;}$url=$r['url'];$text=read_text($r);if(!str_starts_with(ltrim($text),'#EXTM3U'))return null;
            $entries=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($line)=>$line!==''&&!str_starts_with($line,'#')));$entries=array_map(fn($line)=>absolute_url($line,$url),$entries);
            if(str_contains($text,'#EXT-X-STREAM-INF')){if(!$entries)return null;$target=$entries[0];continue;}
            $matches=array_values(array_filter($entries,fn($entry)=>media_identity($entry)===media_identity($permission['url'])));if(count($matches)!==1)return null;return net_request($matches[0],$fresh['referer'],$range,19000000);
        }
    }catch(Throwable){}return null;
}
