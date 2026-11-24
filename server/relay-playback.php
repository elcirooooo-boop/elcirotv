<?php
declare(strict_types=1);
function relay_playback(array $signal,bool $refresh=false): array {
    $source=direct_playback($signal,$refresh);$page=null;
    foreach($signal['sources']??[['url'=>$signal['url']]] as $s)if(direct_player_url($s['url'])){$page=$s['url'];break;}
    if($page===null)throw new RuntimeException('CHANNEL_UNAVAILABLE');
    // A shared expiry bucket makes identical signed fragment links reusable.
    $expiry=(int)(ceil(time()/300)*300)+21600;
    return ['transport'=>'relay','url'=>'/api.php?a=media&t='.rawurlencode(grant_media($source['url'],$page,$expiry)),
        'sourceKey'=>$source['sourceKey'],'expiresAt'=>$source['expiresAt'],'renewInSeconds'=>$source['renewInSeconds']];
}
// Recover only the same published resource. Never replace a missing fragment
// with a different fragment, modify provider signatures, or guess channel URLs.
function renew_relay_media(array $permission,string $range='',?callable $resolve=null,?callable $fetch=null): ?array {
    $page=$permission['referer'];if(!direct_player_url($page))return null;
    $resolve??=fn($signal)=>direct_playback($signal,true);
    $fetch??=fn(...$args)=>shared_media_response(...$args);
    try{
        $fresh=$resolve(['name'=>'Señal','url'=>$page,'sources'=>[['url'=>$page]]]);$target=$fresh['url'];
        if(media_identity($target)===media_identity($permission['url']))return $fetch($target,$page,$range);
        for($depth=0;$depth<3;$depth++){
            $r=$fetch($target,$page,'');$base=$r['url'];$status=$r['status'];$text=read_text($r);
            if($status!==200||!str_starts_with(ltrim($text),'#EXTM3U'))return null;
            $lines=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($line)=>$line!==''&&!str_starts_with($line,'#')));
            $entries=array_map(fn($line)=>absolute_url($line,$base),$lines);
            preg_match_all('/URI="([^"]+)"/',$text,$tags);foreach($tags[1] as $uri)$entries[]=absolute_url($uri,$base);
            $matches=array_values(array_unique(array_filter($entries,fn($entry)=>media_identity($entry)===media_identity($permission['url']))));
            if(count($matches)===1)return $fetch($matches[0],$page,$range);
            if(!str_contains($text,'#EXT-X-STREAM-INF')||!$lines)return null;
            $target=absolute_url($lines[0],$base);
        }
    }catch(Throwable){}return null;
}
