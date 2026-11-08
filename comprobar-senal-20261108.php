<?php
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
foreach(['common','network','agenda','playback','direct-playback'] as $part)require __DIR__.'/server/'.$part.'.php';
try{$s=array_values(array_filter(catalog_signals(),fn($s)=>$s['slug']==='espn'))[0];echo json_encode(direct_playback($s,true),JSON_UNESCAPED_SLASHES);}catch(Throwable $e){http_response_code(503);echo json_encode(['error'=>$e->getMessage()]);}