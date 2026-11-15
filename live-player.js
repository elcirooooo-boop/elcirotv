// Keep transient HLS errors inside the existing playback session. Re-resolving
// the provider creates a new live timeline and is reserved for sustained loss.
export function createLivePlayer({video,Hls,resolveSource,onStatus=()=>{},onProgress=()=>{},onState=()=>{},onUnavailable=()=>{},now=Date.now,timers=globalThis}){
  let engine,disposed=false,connecting=false,replacing=true,starting=true,wanted=true,pending,request,startupTimer,playAttempt=0;
  let lastProgress=now(),position=-1,stableSince=0,networkRetries=0,mediaRetries=0,reconnects=0,sourceKey='',persistent=false;
  const excluded=new Set(),listeners=[];
  let delivered=false,unavailable=false,waitingSince=0;
  let renewalTimer,renewalPending=false,tokenExpiry=0,sourceURL='';
  function renewAfter(delay){
    timers.clearTimeout(renewalTimer);
    renewalTimer=timers.setTimeout(()=>{
      if(disposed)return;
      if(!wanted){renewalPending=true;return;}
      if(connecting||pending){renewAfter(5000);return;}
      renewalPending=false;void connect(true);
    },Math.max(0,Math.min(delay,86400000)));
  }
  const hasVideo=()=>delivered||(delivered=video.readyState>=3&&!video.paused);
  const status=text=>{if(!disposed)onStatus(text);};
  function fail(){
    if(disposed||unavailable)return;unavailable=true;wanted=false;starting=false;
    timers.clearTimeout(startupTimer);timers.clearTimeout(pending);timers.clearTimeout(renewalTimer);pending=undefined;engine?.stopLoad();
    status('Esta señal no está disponible. Prueba otra opción.');onUnavailable();
  }
  const listen=(name,fn)=>{video.addEventListener(name,fn);listeners.push([name,fn]);};
  const bufferedAhead=()=>{
    const ranges=video.buffered,time=video.currentTime;
    for(let i=0;i<(ranges?.length||0);i++)if(ranges.start(i)<=time&&ranges.end(i)>time)return ranges.end(i)-time;
    return 0;
  };
  const requestPlay=()=>{
    if(disposed||!wanted)return;
    const attempt=++playAttempt;
    void video.play().catch(error=>{
      if(disposed||attempt!==playAttempt)return;
      if(error.name==='NotAllowedError'){wanted=false;status('Toca reproducir para continuar.');}
      else if(error.name!=='AbortError')reconnect();
    });
  };
  function reconnect(){
    if(disposed||connecting||pending||!wanted)return;
    if(reconnects>=(hasVideo()?5:1)){fail();return;}
    timers.clearTimeout(startupTimer);starting=false;
    timers.clearTimeout(renewalTimer);
    status('Recuperando la señal…');stableSince=0;
    const delay=Math.min(1000*2**reconnects,8000);
    pending=timers.setTimeout(()=>{pending=undefined;reconnects++;void connect();},delay);
  }
  function resumeDownload(){
    networkRetries++;
    // Preserve the buffered timeline and position: do not reload the source.
    engine.startLoad(video.currentTime||-1,true);
    status('Recuperando la conexión…');
  }
  async function connect(renewal=false){
    if(disposed||connecting)return;connecting=true;playAttempt++;timers.clearTimeout(startupTimer);
    request=new AbortController();
    const timeout=timers.setTimeout(()=>request?.abort(),hasVideo()?20000:15000);
    if(!renewal)status(sourceKey?'Recuperando la señal…':'Conectando…');
    try{
      // Retry the same provider first. Only sustained repeated failure moves to
      // another registered source for this channel.
      if(reconnects>=2&&sourceKey&&!persistent)excluded.add(sourceKey);
      const source=await resolveSource([...excluded],request.signal,{refresh:renewal||reconnects>0});
      if(disposed)return;
      if(renewal&&!wanted){renewalPending=true;return;}
      if(source.transport==='embed'){
        wanted=false;starting=false;replacing=false;status('Esta señal no ofrece vídeo compatible. Prueba otra opción.');return;
      }
      if(renewal&&source.url===sourceURL){renewAfter(30000);return;}
      sourceURL=source.url;tokenExpiry=Date.parse(source.expiresAt||'')||0;
      if(Number.isFinite(source.renewInSeconds)&&source.renewInSeconds>0)renewAfter(source.renewInSeconds*1000);
      sourceKey=source.sourceKey||'';persistent=['relay','direct'].includes(source.transport);
      if(renewal&&engine){engine.loadSource(source.url);return;}
      replacing=true;starting=true;
      engine?.destroy();engine=undefined;
      video.removeAttribute('src');video.load();
      position=-1;lastProgress=now();networkRetries=0;mediaRetries=0;
      waitingSince=now();
      if(Hls?.isSupported()){
        const instance=new Hls({progressive:true,lowLatencyMode:false,liveSyncDurationCount:3,startLevel:0,testBandwidth:false,maxBufferLength:30,maxMaxBufferLength:60,backBufferLength:30});
        let sourceLoaded=false,parsed=false;
        const startBuffered=(force=false)=>{
          if(disposed||connecting||engine!==instance||!parsed||!starting||!wanted)return;
          if(!force&&bufferedAhead()<1)return;
          starting=false;replacing=false;timers.clearTimeout(startupTimer);requestPlay();
        };
        engine=instance;video.dataset.engine='hls.js';
        instance.on(Hls.Events.ERROR,(_,error)=>{
          if(disposed||engine!==instance||!error.fatal||!wanted)return;
          const code=error.response?.code;
          if(error.type===Hls.ErrorTypes.NETWORK_ERROR&&hasVideo()&&instance.levels.length&&networkRetries<2&&![401,403,404,410].includes(code)){resumeDownload();return;}
          if(error.type===Hls.ErrorTypes.MEDIA_ERROR&&mediaRetries<1){mediaRetries++;lastProgress=now();replacing=true;instance.recoverMediaError();return;}
          reconnect();
        });
        instance.on(Hls.Events.MANIFEST_PARSED,()=>{
          if(disposed||engine!==instance||parsed)return;
          parsed=true;
          // Build only a small initial cushion. Never wait for a whole segment
          // or allow startup buffering to add more than one second of delay.
          startupTimer=timers.setTimeout(()=>startBuffered(true),1000);
          startBuffered();
        });
        instance.on(Hls.Events.BUFFER_APPENDED,()=>startBuffered());
        instance.on(Hls.Events.MEDIA_ATTACHED,()=>{if(!disposed&&engine===instance&&!sourceLoaded){sourceLoaded=true;instance.loadSource(source.url);}});
        instance.attachMedia(video);
      }else if(video.canPlayType('application/vnd.apple.mpegurl')){
        video.dataset.engine='native';video.src=source.url;replacing=false;starting=false;requestPlay();
      }else{wanted=false;status('Este navegador no admite la reproducción.');}
    }catch(error){
      if(!disposed&&renewal&&hasVideo()&&(!tokenExpiry||now()<tokenExpiry)){renewAfter(15000);return;}
      if(!disposed){if(error.code==='CHANNEL_UNAVAILABLE'||[404,410].includes(error.status)){fail();return;}status('No se pudo conectar con la señal. Reintentando…');connecting=false;reconnect();}
    }finally{timers.clearTimeout(timeout);connecting=false;}
  }
  listen('timeupdate',()=>{
    if(disposed||video.paused||video.currentTime===position)return;
    const advancing=position>=0&&video.currentTime>position&&video.currentTime-position<5;
    position=video.currentTime;lastProgress=now();onProgress();
    if(advancing){delivered=true;if(pending){timers.clearTimeout(pending);pending=undefined;status('Reproduciendo');}}
    if(!advancing)stableSince=0;
    else if(!stableSince)stableSince=now();
    if(stableSince&&now()-stableSince>30000){reconnects=0;networkRetries=0;mediaRetries=0;excluded.clear();}
  });
  listen('playing',()=>{if(disposed)return;replacing=false;lastProgress=now();status('Reproduciendo');onProgress();onState();});
  listen('canplay',()=>{if(!disposed&&replacing&&!starting){replacing=false;requestPlay();}});
  listen('play',()=>{if(disposed)return;wanted=true;starting=false;timers.clearTimeout(startupTimer);lastProgress=now();if(renewalPending){renewalPending=false;renewAfter(0);}});
  listen('pause',()=>{if(disposed||replacing||video.error||video.ended)return;wanted=false;timers.clearTimeout(pending);pending=undefined;status('En pausa');onState();});
  listen('waiting',()=>{if(!disposed&&wanted){stableSince=0;status('Cargando video…');}});
  listen('error',()=>{if(!disposed&&!replacing&&!engine)reconnect();});
  listen('ended',()=>{if(!disposed){if(sourceKey&&!persistent)excluded.add(sourceKey);reconnect();}});
  const watchdog=timers.setInterval(()=>{
    if(disposed||!wanted||connecting||pending)return;
    if(!hasVideo()&&waitingSince&&now()-waitingSince>=10000){reconnect();return;}
    const stalled=now()-lastProgress;
    // A missing sliver between already downloaded fragments needs a small
    // forward seek, not a new session or another download of the same media.
    if(stalled>2000&&!video.paused&&!video.seeking&&bufferedAhead()<0.15){
      const ranges=video.buffered,time=video.currentTime;
      for(let i=0;i<(ranges?.length||0);i++){
        const start=ranges.start(i),end=ranges.end(i);
        if(start>time&&start-time<=1&&end-start>0.25){
          video.currentTime=start+0.05;lastProgress=now();status('Ajustando la reproducción…');return;
        }
      }
    }
    // Let HLS.js handle normal buffering and small gaps. A stopped download
    // gets a retry without destroying buffered media or seeking backwards.
    if(stalled>12000&&engine&&networkRetries<1)resumeDownload();
    else if(stalled>22000)reconnect();
  },1000);
  return {
    start:connect,
    destroy(){disposed=true;playAttempt++;request?.abort();timers.clearTimeout(renewalTimer);timers.clearTimeout(startupTimer);timers.clearTimeout(pending);timers.clearInterval(watchdog);listeners.forEach(([name,fn])=>video.removeEventListener(name,fn));engine?.destroy();},
  };
}
