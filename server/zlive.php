<?php
declare(strict_types=1);

function zlive_player_url(string $url): bool {
    $p=parse_url($url);
    return $p!==false&&($p['scheme']??'')==='https'&&($p['host']??'')==='zlive.st'
        &&!isset($p['user'])&&!isset($p['pass'])&&!isset($p['port'])&&!isset($p['query'])&&!isset($p['fragment'])
        &&preg_match('~^/embed/[a-zA-Z0-9_-]{1,160}$~D',$p['path']??'')===1;
}
function normalize_zlive_channels(array $manifest): array {
    $channels=[];
    foreach($manifest['channels']??[] as $row){
        if(count($channels)>=1000)break;
        if(!is_array($row)||!is_string($row['url']??null)||!zlive_player_url($row['url']))continue;
        $name=trim((string)($row['name']??''));if($name==='')continue;
        $url=$row['url'];$id=fingerprint('zlive:'.basename(parse_url($url,PHP_URL_PATH)));
        $channels[$id]=['id'=>$id,'name'=>mb_substr($name,0,120).' · zlive','url'=>$url,'sources'=>[['url'=>$url]],'provider'=>'zlive','publishedOnly'=>true,'lang'=>''];
    }
    uasort($channels,fn($a,$b)=>strnatcasecmp($a['name'],$b['name']));
    return array_values($channels);
}
function zlive_catalogue(): array {
    $key='zlive-channels-v1';$old=cached_read($key);
    if(time()-($old['loaded']??0)<300)return ['channels'=>$old['channels'],'stale'=>false];
    try{
        $channels=normalize_zlive_channels(fetch_json('https://zlive.st/embed/manifest.json'));
        if(!$channels)throw new RuntimeException('EMPTY_ZLIVE_CATALOGUE');
        cached_write($key,['loaded'=>time(),'channels'=>$channels]);
        return ['channels'=>$channels,'stale'=>false];
    }catch(Throwable $error){
        error_log('El Ciro zlive catalogue: '.$error->getMessage());
        return ['channels'=>time()-($old['loaded']??0)<3600?($old['channels']??[]):[],'stale'=>true];
    }
}
