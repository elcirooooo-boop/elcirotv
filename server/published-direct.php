<?php
declare(strict_types=1);
function published_direct_catalog(): array {
    static $rows;return $rows??=json_decode(file_get_contents(__DIR__.'/direct-channel-catalog.json'),true,32,JSON_THROW_ON_ERROR);
}
function published_direct_signal(array $signal): ?array {
    $available=array_column(published_direct_catalog(),null,'slug');
    foreach($signal['sources']??[['url'=>$signal['url']??'']] as $source){
        $url=$source['url']??'';if(!fulbito_player_url($url)&&!direct_player_url($url))continue;
        parse_str(parse_url($url,PHP_URL_QUERY)??'',$q);$slug=strtolower((string)($q['stream']??''));
        $slug=['espn1'=>'espn','winplus'=>'winsportsplus','foxpremium'=>'foxsportspremium','fox3ar'=>'foxsports3'][$slug]??$slug;
        if(!isset($available[$slug]))continue;
        $page='https://tvf90.com/online.php?stream='.rawurlencode($slug);
        return array_replace($signal,['slug'=>$slug,'provider'=>'direct-hls','url'=>$page,'sources'=>[['url'=>$page]]]);
    }
    return null;
}
function published_direct_agenda(array $data): array {
    $channels=[];
    foreach($data['events'] as &$event){$signals=[];
        foreach($event['signals'] as $signal)if($converted=published_direct_signal($signal)){$signals[$converted['id']]=$converted;$channels[$converted['slug']]=$converted;}
        $event['signals']=array_values($signals);
    }unset($event);
    foreach($data['channels']??[] as $signal)if($converted=published_direct_signal($signal))$channels[$converted['slug']]??=$converted;
    foreach(published_direct_catalog() as $row)if(!isset($channels[$row['slug']])){
        $page='https://tvf90.com/online.php?stream='.rawurlencode($row['slug']);
        $channels[$row['slug']]=['id'=>fingerprint('direct-catalog:'.$row['slug']),'slug'=>$row['slug'],'name'=>$row['name'],'provider'=>'direct-hls','lang'=>'Español','url'=>$page,'sources'=>[['url'=>$page]]];
    }
    $data['channels']=array_values($channels);$data['provider']='direct-hls';return $data;
}
