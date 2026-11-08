<?php
declare(strict_types=1);
ini_set('display_errors','0');
require __DIR__.'/server/common.php';
require __DIR__.'/server/network.php';
require __DIR__.'/server/agenda.php';
require __DIR__.'/server/playback.php';
require __DIR__.'/server/direct-playback.php';
require __DIR__.'/server/media-cache.php';
require __DIR__.'/server/relay-playback.php';
header('X-Content-Type-Options: nosniff');header('Cache-Control: no-store');
function respond(array $data,int $status=200): never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
$action=$_GET['a']??'';
if(!is_string($action)||!in_array($action,['agenda','play','media','presence','viewers'],true))respond(['error'=>'Ruta no encontrada.'],404);
$method=$action==='presence'?'POST':'GET';if(($_SERVER['REQUEST_METHOD']??'')!==$method){header('Allow: '.$method);respond(['error'=>'Método no permitido.'],405);}
try {
    if(!extension_loaded('curl')||!extension_loaded('mbstring'))throw new RuntimeException('PHP_EXTENSIONS_REQUIRED');
    if($action==='agenda')respond(public_agenda(direct_agenda(agenda())));
    if($action==='play'){
        $id=is_string($_GET['source']??null)?$_GET['source']:'';$signal=null;
        $current=agenda();foreach($current['channels']??[] as $s)if($s['id']===$id){$signal=$s;break;}
        if(!$signal)foreach($current['events'] as $event)foreach($event['signals'] as $s)if($s['id']===$id){$signal=$s;break 2;}
        if(!$signal&&preg_match('/^[a-f0-9]{24}$/D',$id))$signal=published_signal($id);
        if(!$signal)respond(['error'=>'Esta señal ya no está publicada. Actualiza la agenda.'],404);
        respond(relay_playback($signal,($_GET['refresh']??'')==='1'));
    }
    if($action==='media'){
        try{$permission=verify_media(is_string($_GET['t']??null)?$_GET['t']:'');}catch(Throwable){respond(['error'=>'La sesión venció. Vuelve a abrir la señal.'],403);}
        $range=$_SERVER['HTTP_RANGE']??'';
        if($range!==''&&!preg_match('/^bytes=\d+-\d*$/D',$range))respond(['error'=>'Rango no válido.'],416);
        $r=shared_media_response($permission['url'],$permission['referer'],$range);
        if(in_array($r['status'],[401,403],true)){
            $renewed=renew_relay_media($permission,$range);
            if($renewed){fclose($r['stream']);$r=$renewed;}
        }
        $type=$r['headers']['content-type']??'application/octet-stream';
        if($r['status']<200||$r['status']>=300||preg_match('/html|javascript|json|svg/i',$type)){
            $status=$r['status'];fclose($r['stream']);respond(['error'=>'Señal no disponible.'],in_array($status,[401,403],true)?$status:502);
        }
        if(preg_match('/mpegurl/i',$type)||preg_match('/\.m3u8$/i',parse_url($r['url'],PHP_URL_PATH)??'')){
            header('Content-Type: application/vnd.apple.mpegurl');
            $text=read_text($r);echo rewrite_manifest($text,$r['url'],$permission['referer'],$permission['expiry']);exit;
        }
        http_response_code($r['status']);header('Content-Type: '.$type);header('Cache-Control: private, max-age=30');
        foreach(['content-range','accept-ranges'] as $name)if(isset($r['headers'][$name]))header($name.': '.$r['headers'][$name]);
        $remaining=fstat($r['stream'])['size']-ftell($r['stream']);header('Content-Length: '.$remaining);
        fpassthru($r['stream']);fclose($r['stream']);exit;
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
        $cached=cached_read('viewer-counts');if(($cached['until']??0)>time())respond(['counts'=>(object)$cached['counts']]);
        $counts=[];foreach(glob(storage().'/viewers/*.json')?:[] as $path){$r=json_decode(file_get_contents($path),true);if(!$r||time()-($r['at']??0)>=75){@unlink($path);continue;}if(($r['playing']??false)===true&&preg_match('/^[a-f0-9]{24}$/D',$r['match']??''))$counts[$r['match']]=($counts[$r['match']]??0)+1;}
        cached_write('viewer-counts',['until'=>time()+5,'counts'=>$counts]);respond(['counts'=>(object)$counts]);
    }
}catch(Throwable $error){
    if($error->getMessage()==='MEDIA_BUSY'){header('Retry-After: 1');respond(['error'=>'La señal se está preparando. Reintenta.'],503);}
    error_log('El Ciro PHP: '.get_class($error).' '.$error->getMessage());
    $response=['error'=>$action==='agenda'?'No se pudo actualizar la agenda. Intenta de nuevo.':'La señal no está disponible. Prueba otra opción.'];
    if($action==='play'&&$error->getMessage()==='CHANNEL_UNAVAILABLE')$response['code']='CHANNEL_UNAVAILABLE';
    respond($response,503);
}
