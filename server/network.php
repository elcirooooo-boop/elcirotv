<?php
declare(strict_types=1);
function safe_url(string $url): array {
    $p=parse_url($url);$host=strtolower($p['host']??'');
    if(!in_array($p['scheme']??'',['http','https'],true)||isset($p['user'])||isset($p['pass'])||!str_contains($host,'.')||!preg_match('/^[a-z0-9.-]+$/D',$host)||filter_var($host,FILTER_VALIDATE_IP)||preg_match('/(^|\.)(localhost|local|internal)$/',$host)||isset($p['port'])&&!in_array($p['port'],[80,443],true))throw new RuntimeException('INVALID_URL');
    return $p;
}
function absolute_url(string $relative,string $base): string {
    $relative=html_entity_decode(trim($relative),ENT_QUOTES|ENT_HTML5,'UTF-8');
    if(preg_match('~^[a-z][a-z0-9+.-]*:~i',$relative))return $relative;
    $p=parse_url($base);$origin=$p['scheme'].'://'.$p['host'].(isset($p['port'])?':'.$p['port']:'');
    if(str_starts_with($relative,'//'))return $p['scheme'].':'.$relative;
    if(str_starts_with($relative,'?'))return $origin.($p['path']??'/').$relative;
    if(str_starts_with($relative,'#'))return preg_replace('/#.*$/','',$base).$relative;
    $path=str_starts_with($relative,'/')?$relative:preg_replace('~/[^/]*$~','/',($p['path']??'/')).$relative;
    $parts=explode('?', $path,2);$segments=[];
    foreach(explode('/',$parts[0]) as $part){if($part==='..')array_pop($segments);elseif($part!=='.'&&$part!=='')$segments[]=$part;}
    return $origin.'/'.implode('/',$segments).(isset($parts[1])?'?'.$parts[1]:'');
}
function net_request(string $url,string $referer='',string $range='',int $limit=1500000,int $timeout=10,int $hop=0): array {
    $p=safe_url($url);$host=$p['host'];$ip=null;
    foreach(gethostbynamel($host)?:[] as $candidate)if(filter_var($candidate,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4|FILTER_FLAG_NO_PRIV_RANGE|FILTER_FLAG_NO_RES_RANGE)){$ip=$candidate;break;}
    if(!$ip)throw new RuntimeException('PRIVATE_ADDRESS');
    $stream=fopen('php://temp/maxmemory:1048576','w+b');$size=0;$headers=[];
    $ch=curl_init($url);$requestHeaders=['Accept: */*','Accept-Encoding: identity'];
    if($referer&&!preg_match('/[\r\n]/',$referer)){
        $r=safe_url($referer);$requestHeaders[]='Referer: '.$referer;$requestHeaders[]='Origin: '.$r['scheme'].'://'.$r['host'];
    }
    if(preg_match('/^bytes=\d+-\d*$/D',$range))$requestHeaders[]='Range: '.$range;
    curl_setopt_array($ch,[CURLOPT_HTTPHEADER=>$requestHeaders,CURLOPT_USERAGENT=>'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>4,CURLOPT_TIMEOUT=>$timeout,CURLOPT_PROTOCOLS=>CURLPROTO_HTTP|CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROXY=>'',CURLOPT_RESOLVE=>[$host.':'.($p['port']??($p['scheme']==='https'?443:80)).':'.$ip],CURLOPT_HEADERFUNCTION=>function($c,$line)use(&$headers){if(str_starts_with($line,'HTTP/'))$headers=[];elseif(str_contains($line,':')){[$k,$v]=explode(':',$line,2);$headers[strtolower(trim($k))]=trim($v);}return strlen($line);},CURLOPT_WRITEFUNCTION=>function($c,$chunk)use($stream,&$size,$limit){$size+=strlen($chunk);return $size>$limit?0:fwrite($stream,$chunk);}]);
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);
    if($ok===false){fclose($stream);throw new RuntimeException('UPSTREAM_UNAVAILABLE');}
    if(in_array($status,[301,302,303,307,308],true)){
        fclose($stream);if($hop>=3||!isset($headers['location']))throw new RuntimeException('REDIRECT_LIMIT');
        return net_request(absolute_url($headers['location'],$url),$referer,$range,$limit,$timeout,$hop+1);
    }
    rewind($stream);return ['status'=>$status,'headers'=>$headers,'stream'=>$stream,'url'=>$url];
}
function read_text(array $response): string {try{return stream_get_contents($response['stream']);}finally{fclose($response['stream']);}}
function fetch_json(string $url): array {$r=net_request($url,'','',6000000);if($r['status']!==200){fclose($r['stream']);throw new RuntimeException('AGENDA_HTTP');}return json_decode(read_text($r),true,64,JSON_THROW_ON_ERROR);}
