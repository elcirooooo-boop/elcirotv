<?php
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
foreach(['common','network','agenda','playback','direct-playback'] as $part)require __DIR__.'/server/'.$part.'.php';
try{
$s=array_values(array_filter(catalog_signals(),fn($s)=>$s['slug']==='espn'))[0];$d=direct_playback($s,false);
if(($_GET['check']??'')==='segments'){$r=net_request($d['url'],'https://tvf90.com/','',250000,8);$text=read_text($r);$rows=array_values(array_filter(array_map('trim',preg_split('/\r?\n/',$text)),fn($x)=>$x!==''&&!str_starts_with($x,'#')));$d=['manifestStatus'=>$r['status'],'isHLS'=>str_starts_with($text,'#EXTM3U'),'segmentUrl'=>$rows?absolute_url($rows[max(0,count($rows)-2)],$r['url']):null];}
echo json_encode($d,JSON_UNESCAPED_SLASHES);
}catch(Throwable $e){http_response_code(503);echo json_encode(['error'=>$e->getMessage(),'cause'=>$e->getPrevious()?->getMessage()]);}