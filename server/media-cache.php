<?php
declare(strict_types=1);
// Exact upstream URL + provider context only. api.php verifies the viewer's
// signed grant before reaching this private, shared fragment cache.
function media_cache_dir(): string {
    $dir=storage().'/media-cache';if(!is_dir($dir)&&!@mkdir($dir,0700)&&!is_dir($dir))throw new RuntimeException('CACHE_UNAVAILABLE');return $dir;
}
function media_cache_slot(string $key): string {return media_cache_dir().'/slot-'.sprintf('%02x',hexdec(substr($key,0,2))%64);}
function media_cache_read(string $file,string $key): ?array {
    $handle=@fopen($file,'rb');if(!$handle)return null;
    $line=fgets($handle,16385);$meta=$line===false?null:json_decode($line,true);
    if(!is_array($meta)||($meta['key']??'')!==$key||($meta['until']??0)<=time()||($meta['status']??0)!==200||!isset($meta['url'],$meta['headers'],$meta['bytes'])||fstat($handle)['size']-ftell($handle)!==$meta['bytes']){fclose($handle);return null;}
    // Stream straight from the open cache file at its body offset. An open
    // file remains readable during eviction, without another full-file copy.
    return ['status'=>200,'url'=>$meta['url'],'headers'=>$meta['headers'],'stream'=>$handle];
}
function media_cache_sweep(string $dir,int $budget=134217728): void {
    $lock=@fopen($dir.'/cleanup.lock','c');if(!$lock)return;
    if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return;}
    try{$files=[];$total=0;foreach(glob($dir.'/*.bin')?:[] as $file){$at=@filemtime($file);if($at===false)continue;if($at<time()-60||preg_match('/^[a-f0-9]{64}\.bin$/D',basename($file))){@unlink($file);continue;}$size=@filesize($file)?:0;$files[]=['file'=>$file,'at'=>$at,'bytes'=>$size];$total+=$size;}
        usort($files,fn($a,$b)=>$a['at']<=>$b['at']);foreach($files as $file){if($total<=$budget)break;if(@unlink($file['file']))$total-=$file['bytes'];}
        // Fixed slot locks must keep their inode while another request may wait.
        foreach(glob($dir.'/*.lock')?:[] as $file)if(preg_match('/^[a-f0-9]{64}\.lock$/D',basename($file))&&@filemtime($file)<time()-120)@unlink($file);
        foreach(glob($dir.'/write-*')?:[] as $file)if(@filemtime($file)<time()-120)@unlink($file);
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function shared_media_response(string $url,string $referer,string $range='',?callable $fetch=null): array {
    $fetch??=fn(...$args)=>net_request(...$args);
    // A partial response must never be confused with a complete fragment.
    if($range!=='')return $fetch($url,$referer,$range,19000000,15);
    try{$dir=media_cache_dir();}catch(Throwable){return $fetch($url,$referer,'',19000000,15);}
    if(!is_file($dir.'/fixed-slots.at')){media_cache_sweep($dir);@touch($dir.'/fixed-slots.at');}
    $key=hash('sha256',$url.'|'.$referer);$slot=media_cache_slot($key);$file=$slot.'.bin';
    if($cached=media_cache_read($file,$key))return $cached;
    $lock=@fopen($slot.'.lock','c');if(!$lock)return $fetch($url,$referer,'',19000000,15);
    $deadline=microtime(true)+1.5;$locked=false;
    try{
        do{if($locked=flock($lock,LOCK_EX|LOCK_NB))break;if($cached=media_cache_read($file,$key))return $cached;usleep(50000);}while(microtime(true)<$deadline);
        // Let HLS retry instead of opening another upstream connection for
        // the same fragment and filling all hosting workers with downloads.
        if(!$locked)throw new RuntimeException('MEDIA_BUSY');
        @touch($slot.'.lock');
        if($cached=media_cache_read($file,$key))return $cached;
        $r=$fetch($url,$referer,'',19000000,15);$type=$r['headers']['content-type']??'';$bytes=fstat($r['stream'])['size'];
        // 64 fixed slots x 2 MiB = at most 128 MiB of retained video.
        // Leave a reserve instead of filling the hosting disk with cache.
        $free=@disk_free_space($dir);
        if($r['status']===200&&$bytes>0&&$bytes<=2097152&&$free!==false&&$free>=268435456+$bytes&&preg_match('~^(?:video/|audio/|application/(?:octet-stream|mp4|[^;]*mpegurl)|binary/octet-stream)~i',$type)){
            $ttl=preg_match('/mpegurl/i',$type)||preg_match('/\.m3u8$/i',parse_url($r['url'],PHP_URL_PATH)??'')?3:45;
            $headers=array_intersect_key($r['headers'],array_flip(['content-type','content-range','accept-ranges']));
            $meta=['key'=>$key,'until'=>time()+$ttl,'status'=>200,'url'=>$r['url'],'headers'=>$headers,'bytes'=>$bytes];$line=json_encode($meta,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)."\n";$tmp=strlen($line)<16384?@tempnam($dir,'write-'):false;
            if($tmp!==false){$out=@fopen($tmp,'wb');if($out){$valid=@fwrite($out,$line)===strlen($line);rewind($r['stream']);$valid=$valid&&@stream_copy_to_stream($r['stream'],$out)===$bytes;fclose($out);chmod($tmp,0600);if($valid)@rename($tmp,$file);rewind($r['stream']);}if(is_file($tmp))@unlink($tmp);}
            if(random_int(1,32)===1)media_cache_sweep($dir);
        }
        return $r;
    }finally{if($locked)flock($lock,LOCK_UN);fclose($lock);}
}
