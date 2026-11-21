<?php
declare(strict_types=1);

function external_playback(array $signal): array {
    $sources=[];
    foreach($signal['sources']??[['url'=>$signal['url']]] as $source){
        if(fulbito_player_url($source['url'])){
            $url=fulbito_canonical($source['url']);
            $path=substr($url,strlen('https://streamxhd.sbs'));
            $automatic=str_replace('/live1.php?', '/live2.php?', $path);
            foreach([$path,$automatic] as $route){
                foreach(['streamxhd.sbs','streamxhd.st','streamxhd.click'] as $host){
                    $option='https://'.$host.$route;
                    $sources[$option]=['url'=>$option,'sourceKey'=>fingerprint($option)];
                }
            }
        }
        if(function_exists('embedlatam_player_url')&&embedlatam_player_url($source['url'])){
            $sources[$source['url']]=['url'=>$source['url'],'sourceKey'=>fingerprint($source['url'])];
        }
    }
    if(!$sources)throw new RuntimeException('CHANNEL_UNAVAILABLE');
    $sources=array_values($sources);
    return [
        'transport'=>'embed',
        'openInNewTab'=>false,
        'name'=>$signal['name'],
        'url'=>$sources[0]['url'],
        'sourceKey'=>$sources[0]['sourceKey'],
        'sources'=>$sources
    ];
}
