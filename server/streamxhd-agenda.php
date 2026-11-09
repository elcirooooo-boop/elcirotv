<?php
declare(strict_types=1);
function normalize_streamxhd_agenda(array $payload): array {
    $events=[];
    foreach($payload['sports']??[] as $sport)foreach($sport['leagues']??[] as $league)foreach($league['events']??[] as $row){
        if(count($events)>=500)break 3;
        $title=trim((string)($row['title']??$row['name']??''));if($title==='')continue;
        $raw=(string)($row['time']??$row['datetime']??$row['date']??'');if($raw==='')continue;
        try{$date=new DateTimeImmutable($raw,new DateTimeZone($row['timezone']??$row['tz']??'America/Lima'));$start=$date->getTimestamp();}catch(Throwable){continue;}
        $leagueName=trim((string)($row['league']??$league['name']??'Deportes'));
        $signals=[];
        foreach(is_array($row['servers']??null)?$row['servers']:[] as $server){
            if(!is_array($server)||($server['active']??true)===false||($server['type']??'iframe')!=='iframe'||!is_string($server['url']??null)||!fulbito_player_url($server['url']))continue;
            $url=fulbito_canonical($server['url']);$id=fulbito_signal_id($url);
            $signals[$id]=['id'=>$id,'name'=>mb_substr((string)($server['name']??'Señal'),0,100),'url'=>$url,'sources'=>[['url'=>$url]],'lang'=>mb_substr((string)($server['customLanguages']??''),0,80),'provider'=>'streamxhd','publishedOnly'=>true];
        }
        $id=fingerprint(iso($start).'|'.slugify($leagueName).'|'.slugify($title));
        $event=['id'=>$id,'legacyIds'=>[],'title'=>$title,'league'=>$leagueName,'sport'=>mb_substr((string)($sport['name']??$sport['id']??''),0,80),'startsAt'=>iso($start),'time'=>$date->setTimezone(new DateTimeZone('America/Caracas'))->format('H:i'),'signals'=>array_values($signals)];
        foreach(['homeLogo','awayLogo'] as $field)if(is_string($row[$field]??null)&&agenda_logo_url($row[$field]))$event[$field]=$row[$field];
        $logo=($row['logo']??'')?:($league['logo']??'');if(is_string($logo)&&agenda_logo_url($logo))$event['leagueLogo']=$logo;
        if(is_numeric($row['duration']??null))$event['durationMinutes']=max(5,min(1440,(int)$row['duration']+max(0,(int)($row['extraTime']??0))));
        if(in_array($row['status']??'',['live','upcoming','finished'],true))$event['providerLive']=$row['status']==='live';
        $events[]=$event;
    }
    return $events;
}
function streamxhd_channels(array $events): array {
    $channels=[];foreach($events as $event)foreach($event['signals'] as $signal)$channels[$signal['id']]=$signal;
    return array_values($channels);
}
