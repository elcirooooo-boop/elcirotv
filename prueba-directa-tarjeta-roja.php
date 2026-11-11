<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Robots-Tag: noindex, nofollow');
if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){http_response_code(405);header('Allow: GET');exit;}
if(isset($_GET['channel'])){
    header('Content-Type: application/json; charset=utf-8');
    try{
        require __DIR__.'/server/common.php';require __DIR__.'/server/network.php';require __DIR__.'/server/tarjetaroja-direct-test.php';
        if(!is_string($_GET['channel']))throw new InvalidArgumentException('INVALID_CHANNEL');
        echo json_encode(tarjetaroja_test_source($_GET['channel']),JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
    }catch(Throwable $error){http_response_code($error instanceof InvalidArgumentException?400:503);echo json_encode(['error'=>$error instanceof InvalidArgumentException?'Canal de prueba no válido.':'El proveedor no entregó una señal compatible ahora. Reintenta más tarde.']);}
    exit;
}
header('Content-Type: text/html; charset=utf-8');
?><!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>El Ciro TV · Prueba de vídeo directo</title><style>
body{font:16px system-ui,sans-serif;max-width:960px;margin:0 auto;padding:24px;background:#f5f5f7;color:#172336}h1{font-size:clamp(24px,5vw,36px)}a{color:#006dcc}button{font:inherit;background:#006dcc;border:0;border-radius:10px;padding:12px 18px;color:#fff;cursor:pointer}button[aria-pressed=true]{outline:3px solid #23354b;outline-offset:2px}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}video{display:block;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px}.status{line-height:1.6;min-height:48px}.note{font-size:14px;color:#536176;line-height:1.6}</style></head><body>
<a href="/">← Volver a El Ciro TV</a><h1>Prueba de vídeo directo</h1><p>Reproductor propio con dos señales publicadas por Tarjeta Roja / StreamTP.</p>
<div class="actions"><button type="button" data-channel="winplus" aria-pressed="false">Win Sports+</button><button type="button" data-channel="espnpremium" aria-pressed="false">ESPN Premium</button></div>
<video controls playsinline preload="none" aria-label="Reproductor de prueba"></video><p id="status" class="status" role="status" aria-live="polite">Selecciona una señal y toca Play si el navegador lo requiere.</p><button type="button" id="retry" hidden>Reintentar señal</button>
<p class="note">El vídeo se descarga directamente desde el proveedor. Hostinger entrega esta página y consulta solo los metadatos de la señal, con una caché de 60 segundos. La disponibilidad y los anuncios incluidos dentro de la emisión dependen del proveedor. Esta prueba no cambia la agenda ni los canales de la web principal.</p>
<script src="/hls.min.js"></script><script>
const video=document.querySelector('video'),status=document.querySelector('#status'),retry=document.querySelector('#retry');let hls,selected='',generation=0,controller;
async function play(channel){
  selected=channel;const current=++generation;controller?.abort();controller=new AbortController();hls?.destroy();hls=null;video.pause();video.removeAttribute('src');video.load();
  status.textContent='Consultando la señal del proveedor…';retry.hidden=false;
  document.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));
  const active=()=>generation===current;
  try{
    const response=await fetch('?channel='+encodeURIComponent(channel),{cache:'no-store',signal:controller.signal});const source=await response.json();
    if(!active())return;if(!response.ok||source.transport!=='hls')throw Error(source.error||'No se pudo preparar la señal.');
    const url=new URL(source.url);if(url.protocol!=='https:'||!/(^|\.)fubo18\.com$/.test(url.hostname))throw Error('La señal del proveedor no es válida.');
    const start=async()=>{if(!active())return;status.textContent=source.name+' · Señal cargada. Toca Play si hace falta.';try{await video.play();}catch{}};
    if(window.Hls?.isSupported()){
      hls=new Hls({startLevel:0,maxBufferLength:20,backBufferLength:15});
      hls.on(Hls.Events.ERROR,(_,data)=>{if(active()&&data.fatal)status.textContent=source.name+' · Se interrumpió la conexión directa. Pulsa Reintentar señal.';});
      hls.on(Hls.Events.MANIFEST_PARSED,start);hls.attachMedia(video);hls.loadSource(url.href);
    }else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=url.href;await start();}
    else throw Error('Este navegador no admite esta señal HLS.');
  }catch(error){if(active()&&error.name!=='AbortError')status.textContent=error.message||'No se pudo cargar la señal.';}
}
document.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>void play(b.dataset.channel));retry.onclick=()=>{if(selected)void play(selected);};
video.addEventListener('playing',()=>{status.textContent='Reproduciendo directamente desde el proveedor.';});
video.addEventListener('error',()=>{if(selected)status.textContent='No se pudo reproducir esta señal. Pulsa Reintentar señal.';});
addEventListener('pagehide',()=>{controller?.abort();hls?.destroy();});
</script></body></html>
