<?php
declare(strict_types=1);
ini_set('display_errors','0');
foreach(['common','network','agenda','playback','direct-playback'] as $file)require __DIR__.'/server/'.$file.'.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
$slug=$_GET['channel']??'espn2';if(!is_string($slug)||!in_array($slug,['espn2','espn6','dsports'],true)){http_response_code(400);exit;}
try{
 $page='https://tvf90.com/online.php?stream='.$slug;
 $source=direct_playback(['url'=>$page,'sources'=>[['url'=>$page]]],($_GET['refresh']??'')==='1');
 $r=net_request($source['url'],'https://tvf90.com/','',1000000,10);$text=read_text($r);
 if($r['status']!==200||!str_starts_with(ltrim($text),'#EXTM3U')){header('Content-Type: application/json');http_response_code(502);echo json_encode(['manifestStatus'=>$r['status'],'hls'=>false]);exit;}
 $base=$r['url'];$rewrite=fn($url)=>absolute_url($url,$base);
 $lines=[];$resources=[];
 foreach(explode("\n",$text) as $line){$line=trim($line);
  if($line!==''&&!str_starts_with($line,'#')){$line=$rewrite($line);$resources[]=$line;}
  else $line=preg_replace_callback('~URI="([^"]+)"~',fn($m)=>'URI="'.$rewrite($m[1]).'"',$line);
  $lines[]=$line;
 }
 if(($_GET['mode']??'info')==='manifest'){header('Content-Type: application/vnd.apple.mpegurl');echo implode("\n",$lines);exit;}
 header('Content-Type: application/json');echo json_encode(['channel'=>$slug,'manifestStatus'=>$r['status'],'hls'=>true,'referer'=>'https://tvf90.com/','lastResource'=>end($resources),'resources'=>count($resources),'expiresAt'=>$source['expiresAt'],'hasVariants'=>str_contains($text,'#EXT-X-STREAM-INF')]);
}catch(Throwable $e){http_response_code(503);header('Content-Type: application/json');echo json_encode(['error'=>'Prueba no disponible']);}
