<?php
declare(strict_types=1);

function matchora_embed(string $url): bool {
    return preg_match('~^https://(?:matchora\.to|matchora\.pro|es\.matchora\.pro)/embed/(?:match|channel)/[a-z0-9_-]{1,80}$~iD',$url)===1;
}

function matchora_signal(string $url,string $name): array {
    return ['id'=>fingerprint('matchora:'.parse_url($url,PHP_URL_PATH)),'name'=>$name,'url'=>$url,
        'lang'=>'','provider'=>'matchora','publishedOnly'=>true];
}

function normalize_matchora_agenda(array $payload): array {
    if(!is_array($payload['events']??null))throw new RuntimeException('AGENDA_FORMAT');
    $events=[];$channels=[];
    foreach($payload['events'] as $row){
        if(($row['sport']??'')!=='Soccer'||!empty($row['finished']))continue;
        $id=(string)($row['id']??'');
        $start=(int)($row['kickoff']??0);
        $league=trim((string)($row['league']??''));
        if($id===''||$start<946684800||preg_match('/\b(NFL|NCAA Football|NCAAF|American Football|CFB)\b/i',$league))continue;
        $home=trim((string)($row['home']??''));$away=trim((string)($row['away']??''));
        if($home===''||$away==='')continue;
        $signals=[];
        $embed=$row['embed_url']??'';
        if(!empty($row['channel_count'])&&is_string($embed)&&matchora_embed($embed)){
            $signal=matchora_signal($embed,'Reproductor principal');
            $signals[$signal['id']]=$signal;
        }
        foreach($row['channels']??[] as $channel){
            $url=$channel['embed_url']??'';
            if(!is_string($url)||!matchora_embed($url))continue;
            $name=mb_substr(trim((string)($channel['name']??''))?:'Canal',0,100);
            $signal=matchora_signal($url,$name);
            $signals[$signal['id']]=$signal;
            $channels[$signal['id']]=$signal;
        }
        $event=['id'=>fingerprint('matchora:event:'.$id),'legacyIds'=>[],
            'title'=>mb_substr($home.' vs '.$away,0,240),'league'=>mb_substr($league?:'Fútbol',0,100),
            'sport'=>'Soccer','startsAt'=>iso($start),'providerLive'=>!empty($row['live']),
            'signals'=>array_values($signals)];
        foreach(['home_badge'=>'homeLogo','away_badge'=>'awayLogo','league_badge'=>'leagueLogo'] as $source=>$field){
            if(is_string($row[$source]??null)&&agenda_logo_url($row[$source]))$event[$field]=$row[$source];
        }
        $events[]=$event;
    }
    if(!$events)throw new RuntimeException('AGENDA_EMPTY');
    return ['events'=>$events,'channels'=>array_values($channels)];
}
