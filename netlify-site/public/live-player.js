// Keep transient HLS errors inside the existing playback session. Re-resolving
// the provider creates a new live timeline and is reserved for sustained loss.
export function createLivePlayer({video,Hls,resolveSource,onStatus=()=>{},onProgress=()=>{},onState=()=>{},now=Date.now,timers=globalThis}){
  let engine,disposed=false,connecting=false,replacing=true,wanted=true,pending,request;
  let lastProgress=now(),position=-1,stableSince=0,networkRetries=0,mediaRetries=0,reconnects=0,sourceKey='';
  const excluded=new Set(),listeners=[];
  const status=text=>{if(!disposed)onStatus(text);};
  const listen=(name,fn)=>{video.addEventListener(name,fn);listeners.push([name,fn]);};
  const requestPlay=()=>{
    if(disposed||!wanted)return;
    void video.play().catch(error=>{
      if(disposed)return;
      if(error.name==='NotAllowedError'){wanted=false;status('Toca reproducir para continuar.');}
      else if(error.name!=='AbortError')reconnect();
    });
  };
  function reconnect(){
    if(disposed||connecting||pending||!wanted)return;
    if(reconnects>=5){wanted=false;engine?.stopLoad();status('La señal está interrumpida. Puedes reintentar más tarde.');return;}
    status('Recuperando la señal…');stableSince=0;
    const delay=Math.min(1000*2**reconnects,8000);
    pending=timers.setTimeout(()=>{pending=undefined;reconnects++;void connect();},delay);
  }
  function resumeDownload(){
    networkRetries++;lastProgress=now();
    // Preserve the buffered timeline and position: do not reload the source.
    engine.startLoad(video.currentTime||-1,true);
    status('Recuperando la conexión…');
  }
  async function connect(){
    if(disposed||connecting)return;connecting=true;
    request=new AbortController();
    const timeout=timers.setTimeout(()=>request?.abort(),30000);
    status(sourceKey?'Recuperando la señal…':'Conectando…');
    try{
      // Retry the same provider first. Only sustained repeated failure moves to
      // another registered source for this channel.
      if(reconnects>=2&&sourceKey)excluded.add(sourceKey);
      const source=await resolveSource([...excluded],request.signal,{refresh:reconnects>0});
      if(disposed)return;
      sourceKey=source.sourceKey||'';replacing=true;
      engine?.destroy();engine=undefined;
      video.removeAttribute('src');video.load();
      position=-1;lastProgress=now();networkRetries=0;mediaRetries=0;
      if(Hls?.isSupported()){
        const instance=new Hls({lowLatencyMode:false,liveSyncDurationCount:3,startLevel:0,testBandwidth:false,maxBufferLength:30,maxMaxBufferLength:60,backBufferLength:30});
        let sourceLoaded=false;
        engine=instance;video.dataset.engine='hls.js';
        instance.on(Hls.Events.ERROR,(_,error)=>{
          if(disposed||engine!==instance||!error.fatal||!wanted)return;
          const code=error.response?.code;
          if(error.type===Hls.ErrorTypes.NETWORK_ERROR&&instance.levels.length&&networkRetries<2&&code!==401&&code!==403){resumeDownload();return;}
          if(error.type===Hls.ErrorTypes.MEDIA_ERROR&&mediaRetries<1){mediaRetries++;lastProgress=now();replacing=true;instance.recoverMediaError();return;}
          reconnect();
        });
        instance.on(Hls.Events.MANIFEST_PARSED,()=>{if(!disposed&&engine===instance){replacing=false;requestPlay();}});
        instance.on(Hls.Events.MEDIA_ATTACHED,()=>{if(!disposed&&engine===instance&&!sourceLoaded){sourceLoaded=true;instance.loadSource(source.url);}});
        instance.attachMedia(video);
      }else if(video.canPlayType('application/vnd.apple.mpegurl')){
        video.dataset.engine='native';video.src=source.url;replacing=false;requestPlay();
      }else{wanted=false;status('Este navegador no admite la reproducción.');}
    }catch(error){
      if(!disposed){status('No se pudo conectar con la señal. Reintentando…');connecting=false;reconnect();}
    }finally{timers.clearTimeout(timeout);connecting=false;}
  }
  listen('timeupdate',()=>{
    if(disposed||video.paused||video.currentTime===position)return;
    const advancing=position>=0&&video.currentTime>position&&video.currentTime-position<5;
    position=video.currentTime;lastProgress=now();onProgress();
    if(advancing&&pending){timers.clearTimeout(pending);pending=undefined;status('Reproduciendo');}
    if(!advancing)stableSince=0;
    else if(!stableSince)stableSince=now();
    if(stableSince&&now()-stableSince>30000){reconnects=0;networkRetries=0;mediaRetries=0;excluded.clear();}
  });
  listen('playing',()=>{if(disposed)return;replacing=false;lastProgress=now();status('Reproduciendo');onProgress();onState();});
  listen('canplay',()=>{if(!disposed&&replacing){replacing=false;requestPlay();}});
  listen('play',()=>{if(disposed)return;wanted=true;lastProgress=now();});
  listen('pause',()=>{if(disposed||replacing||video.error||video.ended)return;wanted=false;timers.clearTimeout(pending);pending=undefined;status('En pausa');onState();});
  listen('waiting',()=>{if(!disposed&&wanted){stableSince=0;status('Cargando video…');}});
  listen('error',()=>{if(!disposed&&!replacing&&!engine)reconnect();});
  listen('ended',()=>{if(!disposed){if(sourceKey)excluded.add(sourceKey);reconnect();}});
  const watchdog=timers.setInterval(()=>{
    if(disposed||!wanted||connecting||pending)return;
    const stalled=now()-lastProgress;
    // Let HLS.js handle normal buffering and small gaps. A stopped download
    // gets a retry without destroying buffered media or seeking backwards.
    if(stalled>15000&&engine&&networkRetries<2)resumeDownload();
    else if(stalled>30000)reconnect();
  },3000);
  return {
    start:connect,
    destroy(){disposed=true;request?.abort();timers.clearTimeout(pending);timers.clearInterval(watchdog);listeners.forEach(([name,fn])=>video.removeEventListener(name,fn));engine?.destroy();},
  };
}
