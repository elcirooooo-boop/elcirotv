<?php
declare(strict_types=1);
ini_set('display_errors','0');
require __DIR__.'/server/common.php';
require __DIR__.'/server/network.php';
require __DIR__.'/server/agenda.php';
require __DIR__.'/server/playback.php';
header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store');
function respond(array $data,int $status=200): never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
$action=$_GET['a']??'';
if(!is_string($action)||!in_array($action,['agenda','play','media','presence','viewers'],true))respond(['error'=>'Ruta no encontrada.'],404);
$method=$action==='presence'?'POST':'GET';if(($_SERVER['REQUEST_METHOD']??'')!==$method){header('Allow: '.$method);respond(['error'=>'Método no permitido.'],405);}
try {
    if(!extension_loaded('curl')||!extension_loaded('mbstring'))throw new RuntimeException('PHP_EXTENSIONS_REQUIRED');
    if($action==='agenda')respond(public_agenda(agenda()));
    if($action==='play'){
        $id=is_string($_GET['source']??null)?$_GET['source']:'';$signal=null;
        foreach(catalog_signals() as $s)if($s['id']===$id){$signal=$s;break;}
        if(!$signal)foreach(agenda()['events'] as $event)foreach($event['signals'] as $s)if($s['id']===$id){$signal=$s;break 2;}
        if(!$signal)respond(['error'=>'Esta señal ya no está publicada. Actualiza la agenda.'],404);
        $excluded=array_slice(array_values(array_filter(explode(',',is_string($_GET['exclude']??null)?$_GET['exclude']:''),fn($s)=>preg_match('/^[a-f0-9]{24}$/D',$s))),0,8);
        $resolved=select_playback(alternatives([$signal])[0],$excluded,($_GET['refresh']??'')==='1');
        if(($resolved['transport']??'')==='embed')respond(['url'=>$resolved['url'],'name'=>$signal['name'],'sourceKey'=>$resolved['sourceKey'],'transport'=>'embed']);
        respond(['url'=>'/api/media?t='.rawurlencode(grant_media($resolved['url'],$resolved['referer'],time()+21600)),'name'=>$signal['name'],'sourceKey'=>$resolved['sourceKey'],'transport'=>'php']);
    }
    if($action==='media'){
        try{$permission=verify_media(is_string($_GET['t']??null)?$_GET['t']:'');}catch(Throwable){respond(['error'=>'La sesión venció. Vuelve a abrir la señal.'],403);}
        $range=$_SERVER['HTTP_RANGE']??'';$r=net_request($permission['url'],$permission['referer'],$range,19000000,15);
        if(in_array($r['status'],[401,403],true)){$renewed=renew_media($permission,$range);if($renewed){fclose($r['stream']);$r=$renewed;}}
        $type=$r['headers']['content-type']??'application/octet-stream';
        if($r['status']<200||$r['status']>=300||preg_match('/html|javascript|json|svg/i',$type)){fclose($r['stream']);respond(['error'=>'Señal no disponible.'],in_array($r['status'],[401,403],true)?$r['status']:502);}
        if(preg_match('/mpegurl/i',$type)||preg_match('/\.m3u8$/i',parse_url($r['url'],PHP_URL_PATH)??'')){header('Content-Type: application/vnd.apple.mpegurl');echo rewrite_manifest(read_text($r),$r['url'],$permission['referer'],$permission['expiry']);exit;}
        http_response_code($r['status']);header('Content-Type: '.$type);header('Cache-Control: private, max-age=5');foreach(['content-range','accept-ranges'] as $name)if(isset($r['headers'][$name]))header($name.': '.$r['headers'][$name]);fpassthru($r['stream']);fclose($r['stream']);exit;
    }
    if($action==='presence'){
        $origin=parse_url($_SERVER['HTTP_ORIGIN']??'');$host=$_SERVER['HTTP_HOST']??'';$expectedScheme=!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'?'https':'http';
        if(!$origin||($origin['scheme']??'')!==$expectedScheme||strtolower(($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:''))!==strtolower($host))respond(['error'=>'Origen no válido.'],403);
        $text=file_get_contents('php://input',false,null,0,2049);if(strlen($text)>2048)respond(['error'=>'Solicitud demasiado grande.'],413);$body=json_decode($text,true,16,JSON_THROW_ON_ERROR);
        if(!is_array($body)||!preg_match('/^[a-f0-9-]{36}$/D',$body['session']??''))respond(['error'=>'Sesión no válida.'],400);
        $match=$body['match']??'';if($match&&!in_array($match,array_column(agenda()['events'],'id'),true))respond(['error'=>'Partido no válido.'],400);
        $dir=storage().'/viewers';if(!is_dir($dir))mkdir($dir,0700);$path=$dir.'/'.$body['session'].'.json';
        file_put_contents($path,json_encode(['match'=>$match,'playing'=>($body['playing']??false)===true,'at'=>time()]),LOCK_EX);respond(['ok'=>true]);
    }
    if($action==='viewers'){
        $counts=[];foreach(glob(storage().'/viewers/*.json')?:[] as $path){$r=json_decode(file_get_contents($path),true);if(!$r||time()-($r['at']??0)>=75){@unlink($path);continue;}if(($r['playing']??false)===true&&preg_match('/^[a-f0-9]{24}$/D',$r['match']??''))$counts[$r['match']]=($counts[$r['match']]??0)+1;}
        respond(['counts'=>(object)$counts]);
    }
}catch(Throwable $error){
    error_log('El Ciro PHP: '.get_class($error).' '.$error->getMessage());
    respond(['error'=>$action==='agenda'?'No se pudo actualizar la agenda. Intenta de nuevo.':'La señal no está disponible. Prueba otra opción.'],503);
}
