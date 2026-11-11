<?php
declare(strict_types=1);
function tarjetaroja_test_source(string $channel): array {
    $channels=['winplus'=>'Win Sports+','espnpremium'=>'ESPN Premium'];
    if(!isset($channels[$channel]))throw new InvalidArgumentException('INVALID_CHANNEL');
    $key='tarjetaroja-direct-test-'.$channel;$old=cached_read($key);
    if(time()-($old['loaded']??0)<60)return $old['source'];
    $lock=fopen(storage().'/'.$key.'.lock','c');if(!$lock)throw new RuntimeException('SOURCE_BUSY');
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);if(time()-($old['loaded']??0)<120)return $old['source'];throw new RuntimeException('SOURCE_BUSY');}
    try{
        // Fetch only the public player's small HTML configuration. Never relay video.
        $response=net_request('https://streamtp99a.sbs/global1.php?stream='.$channel,'','',250000,8);
        if($response['status']!==200){fclose($response['stream']);throw new RuntimeException('SOURCE_UNAVAILABLE');}
        $html=read_text($response);
        if(!preg_match('~"src"\s*:\s*"(https://[^"\s]+\.m3u8[^"\s]*)"~',$html,$match))throw new RuntimeException('SOURCE_UNAVAILABLE');
        $url=json_decode('"'.$match[1].'"',true,8,JSON_THROW_ON_ERROR);$p=safe_url($url);
        if(($p['scheme']??'')!=='https'||!preg_match('/^(?:[a-z0-9-]+\.)?fubo18\.com$/D',$p['host'])||($p['path']??'')!=='/'.$channel.'/mono.m3u8')throw new RuntimeException('SOURCE_UNAVAILABLE');
        $source=['name'=>$channels[$channel],'url'=>$url,'transport'=>'hls','updatedAt'=>iso(time())];
        cached_write($key,['loaded'=>time(),'source'=>$source]);return $source;
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
