<?php
declare(strict_types=1);
function fingerprint(string $s): string { return substr(hash('sha256',$s),0,24); }
function folded(string $s): string {
    $s=mb_strtolower($s,'UTF-8');
    $s=strtr($s,['ø'=>'o','ł'=>'l','đ'=>'d','æ'=>'ae','ß'=>'ss','á'=>'a','à'=>'a','ä'=>'a','â'=>'a','ã'=>'a','å'=>'a','ā'=>'a','ą'=>'a','ç'=>'c','ć'=>'c','č'=>'c','ď'=>'d','é'=>'e','è'=>'e','ë'=>'e','ê'=>'e','ě'=>'e','ē'=>'e','ę'=>'e','ğ'=>'g','í'=>'i','ì'=>'i','ï'=>'i','î'=>'i','ı'=>'i','ñ'=>'n','ń'=>'n','ň'=>'n','ó'=>'o','ò'=>'o','ö'=>'o','ô'=>'o','õ'=>'o','ő'=>'o','ō'=>'o','ř'=>'r','ś'=>'s','š'=>'s','ş'=>'s','ť'=>'t','ú'=>'u','ù'=>'u','ü'=>'u','û'=>'u','ű'=>'u','ū'=>'u','ý'=>'y','ÿ'=>'y','ź'=>'z','ż'=>'z','ž'=>'z']);
    $s=preg_replace('/\p{Mn}/u','',$s);
    return trim(preg_replace('/[^a-z0-9]+/',' ',strtolower($s)));
}
function slugify(string $s): string { return str_replace(' ','-',folded($s)); }
function today(?int $at=null): string { return (new DateTimeImmutable('@'.($at??time())))->setTimezone(new DateTimeZone('America/Caracas'))->format('Y-m-d'); }
function iso(int $at): string { return gmdate('Y-m-d\TH:i:s.000\Z',$at); }
function storage(): string {
    static $dir;
    if($dir)return $dir;
    $root=dirname(__DIR__);
    $config=is_file($root.'/config.php')?require $root.'/config.php':[];
    $dir=$config['storage_dir']??dirname($root).'/.elciro-data-'.substr(hash('sha256',$root),0,12);
    if(!is_dir($dir)&&!mkdir($dir,0700,true)&&!is_dir($dir))throw new RuntimeException('STORAGE_UNAVAILABLE');
    if(!is_writable($dir))throw new RuntimeException('STORAGE_NOT_WRITABLE');
    return $dir;
}
function cached_read(string $name): ?array {
    $path=storage().'/'.$name.'.json';if(!is_file($path))return null;
    $value=json_decode(file_get_contents($path),true);return is_array($value)?$value:null;
}
function cached_write(string $name,array $data): void {
    $path=storage().'/'.$name.'.json';$tmp=tempnam(storage(),'write-');
    if($tmp===false)throw new RuntimeException('CACHE_WRITE');
    chmod($tmp,0600);
    try {if(file_put_contents($tmp,json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR))===false||!rename($tmp,$path))throw new RuntimeException('CACHE_WRITE');}
    finally {if(is_file($tmp))unlink($tmp);}
}
function prune_playback_cache(): void {
    $dir=storage();$marker=$dir.'/cache-cleanup.at';if(is_file($marker)&&@filemtime($marker)>time()-3600)return;
    // Only disposable playback metadata and abandoned atomic-write files.
    // Keep the signing key, agenda snapshots and configuration untouched.
    foreach(glob($dir.'/*')?:[] as $path){$name=basename($path);if(!preg_match('/^(?:(?:startup|native-playback|native-player-page)-[a-f0-9]{24}\.json|write-[a-zA-Z0-9]+)$/D',$name))continue;
        if(@filemtime($path)<time()-86400)@unlink($path);
    }@touch($marker);
}
function signing_key(): string {
    static $memo;if($memo!==null)return $memo;
    $handle=fopen(storage().'/signing.key','c+');if(!$handle)throw new RuntimeException('KEY_UNAVAILABLE');
    try {flock($handle,LOCK_EX);$key=stream_get_contents($handle);if(strlen($key)<64){$key=bin2hex(random_bytes(32));rewind($handle);ftruncate($handle,0);fwrite($handle,$key);fflush($handle);chmod(storage().'/signing.key',0600);}return $memo=$key;}
    finally {flock($handle,LOCK_UN);fclose($handle);}
}
function b64url(string $s): string {return rtrim(strtr(base64_encode($s),'+/','-_'),'=');}
function b64decode(string $s): string { $v=base64_decode(strtr($s,'-_','+/'),true);if($v===false)throw new RuntimeException('INVALID_GRANT');return $v; }
function grant_media(string $url,string $referer,int $expiry): string {
    $payload=b64url(json_encode(compact('url','referer','expiry'),JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    return $payload.'.'.b64url(hash_hmac('sha256',$payload,signing_key(),true));
}
function verify_media(string $token): array {
    if(strlen($token)>12000||substr_count($token,'.')!==1)throw new RuntimeException('INVALID_GRANT');
    [$payload,$sig]=explode('.',$token,2);
    if(!hash_equals(hash_hmac('sha256',$payload,signing_key(),true),b64decode($sig)))throw new RuntimeException('INVALID_GRANT');
    $data=json_decode(b64decode($payload),true,32,JSON_THROW_ON_ERROR);
    if(!is_array($data)||!is_int($data['expiry']??null)||$data['expiry']<time()||!is_string($data['url']??null)||!is_string($data['referer']??null))throw new RuntimeException('EXPIRED_GRANT');
    return $data;
}
