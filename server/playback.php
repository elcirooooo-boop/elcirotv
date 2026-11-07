<?php
declare(strict_types=1);
function resolve_player(string $initial): array {
    $players=['rojadirectatvmas.net','rojadirectatvplay.org','tarjetadigital.club','la18hd.su','tvf90.com'];$pending=[[$initial,'https://tarjetadigital.club/',0]];$seen=[];$deadline=microtime(true)+16;
    while($pending&&count($seen)<6&&microtime(true)<$deadline){[$value,$referer,$depth]=array_shift($pending);$p=safe_url($value);
        if(preg_match('/\.m3u8$/i',$p['path']??''))return ['url'=>$value,'referer'=>$referer];
        if(!in_array(preg_replace('/^www\./','',$p['host']),$players,true)||isset($seen[$value])||$depth>3)continue;$seen[$value]=true;
        try{$r=net_request($value,$referer,'',1500000,5);$url=$r['url'];if(!in_array(preg_replace('/^www\./','',parse_url($url,PHP_URL_HOST)),$players,true)||$r['status']!==200){fclose($r['stream']);continue;}
            $html=str_replace(['\\/','&amp;'],['/','&'],read_text($r));
            $hls=null;if(preg_match('~\b(?:var|let|const)\s+playbackURL\s*=\s*["\']([^"\']+)["\']~',$html,$m))$hls=$m[1];elseif(preg_match('~["\']((?:https?:)?//[^\s"\'<>]+\.m3u8(?:\?[^\s"\'<>]*)?)["\']~i',$html,$m))$hls=$m[1];
            if($hls){$target=absolute_url($hls,$url);safe_url($target);if(preg_match('/\.m3u8$/i',parse_url($target,PHP_URL_PATH)??''))return ['url'=>$target,'referer'=>$url];}
            preg_match_all('~<iframe\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']~i',$html,$frames);foreach($frames[1] as $frame)$pending[]=[absolute_url($frame,$url),$url,$depth+1];
            parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);if(isset($q['url']))$pending[]=[absolute_url($q['url'],$url),$url,$depth+1];
        }catch(Throwable){}
    }throw new RuntimeException('SOURCE_UNAVAILABLE');
}
function probe_playlist(array $resolved): void {
    $target=$resolved['url'];
    for($depth=0;$depth<3;$depth++){$r=net_request($target,$resolved['referer'],'',1000000,5);if($r['status']!==200){fclose($r['stream']);throw new RuntimeException('PLAYLIST_HTTP');}$url=$r['url'];$text=read_text($r);$lines=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($line)=>$line!==''&&!str_starts_with($line,'#')));
        if(!str_starts_with(ltrim($text),'#EXTM3U')||!$lines)throw new RuntimeException('INVALID_MANIFEST');
        if(str_contains($text,'#EXT-X-STREAM-INF')){$target=absolute_url($lines[0],$url);continue;}
        $segment=absolute_url($lines[max(0,count($lines)-3)],$url);
        // Range responses may be ignored by a provider; bound this probe too.
        $media=net_request($segment,$resolved['referer'],'bytes=0-187',19000000,5);
        $valid=$media['status']>=200&&$media['status']<300&&!preg_match('/html|javascript|json|svg/i',$media['headers']['content-type']??'')&&fstat($media['stream'])['size']>0;fclose($media['stream']);
        if(!$valid)throw new RuntimeException('SEGMENT_HTTP');return;
    }throw new RuntimeException('PLAYLIST_DEPTH');
}
function select_playback(array $signal,array $excluded,bool $refresh): array {
    $name='playback-'.$signal['id'];$cached=cached_read($name);$sources=$signal['sources']??[['id'=>fingerprint($signal['url']),'url'=>$signal['url']]];
    if(!$refresh&&($cached['until']??0)>time()&&!in_array($cached['result']['sourceKey'],$excluded,true)&&in_array($cached['result']['sourceKey'],array_column($sources,'id'),true))return $cached['result'];
    if(isset($cached['result']['sourceKey']))usort($sources,fn($a,$b)=>(int)($b['id']===$cached['result']['sourceKey'])<=>(int)($a['id']===$cached['result']['sourceKey']));
    $deadline=microtime(true)+24;$tried=0;
    foreach($sources as $source){if(in_array($source['id'],$excluded,true))continue;if(microtime(true)>$deadline||$tried++>=6)break;
        try{$resolved=resolve_player($source['url']);probe_playlist($resolved);$resolved['sourceKey']=$source['id'];cached_write($name,['until'=>time()+15,'result'=>$resolved]);return $resolved;}catch(Throwable){}
    }throw new RuntimeException('CHANNEL_UNAVAILABLE');
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
        if(!in_array(preg_replace('/^www\./','',$player['host']),['tvf90.com','la18hd.su'],true)||!preg_match('/^[-a-z0-9_]{1,80}$/i',$q['stream']??'')||!preg_match('/\.(m3u8|ts|m4s|aac)$/i',$original['path']??''))return null;
        $fresh=resolve_player($permission['referer']);$target=$fresh['url'];
        if(preg_match('/\.m3u8$/i',$original['path'])){if(media_identity($permission['url'])!==media_identity($target))return null;return net_request($target,$fresh['referer'],$range,19000000);}
        for($depth=0;$depth<3;$depth++){$r=net_request($target,$fresh['referer'],'',1000000,5);if($r['status']!==200){fclose($r['stream']);return null;}$url=$r['url'];$text=read_text($r);if(!str_starts_with(ltrim($text),'#EXTM3U'))return null;
            $entries=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($line)=>$line!==''&&!str_starts_with($line,'#')));$entries=array_map(fn($line)=>absolute_url($line,$url),$entries);
            if(str_contains($text,'#EXT-X-STREAM-INF')){if(!$entries)return null;$target=$entries[0];continue;}
            $matches=array_values(array_filter($entries,fn($entry)=>media_identity($entry)===media_identity($permission['url'])));if(count($matches)!==1)return null;return net_request($matches[0],$fresh['referer'],$range,19000000);
        }
    }catch(Throwable){}return null;
}
