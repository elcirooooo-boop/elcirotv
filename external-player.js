export function providerPlayerURL(value){
  let url=new URL(value);
  if(url.origin==='https://fulbitotv.xyz' && url.pathname==='/embed/eventos.html'){
    url=new URL(atob(url.searchParams.get('r')||''));
  }
  if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('El reproductor no es válido.');
  if(['matchora.to','matchora.pro','es.matchora.pro'].includes(url.hostname)&&/^\/embed\/(match|channel)\/[a-z0-9_-]{1,80}$/i.test(url.pathname)&&!url.search&&!url.hash)return url.href;
  if(['damitv.st','ondemand.st','ondemand.to'].includes(url.hostname)&&url.pathname==='/embed/'&&/^[a-z0-9_\/-]{1,180}$/i.test(url.searchParams.get('id')||''))return url.origin+url.pathname+'?id='+encodeURIComponent(url.searchParams.get('id'));
  if(['damitv.st','ondemand.st','ondemand.to'].includes(url.hostname)&&url.pathname==='/player/hls/'){
    const source=url.searchParams.get('url');
    const version=url.searchParams.get('v')||'';
    if(!source||!/^\d{1,12}$/.test(version))throw Error('El reproductor no es válido.');
    const media=new URL(source,url.origin);
    const local=source.startsWith('/')&&!source.startsWith('//')&&media.origin===url.origin;
    const provider=['damitv.st','ondemand.st','ondemand.to'].includes(media.hostname)||media.hostname.endsWith('.damitv.st');
    if(media.protocol!=='https:'||media.username||media.password||media.port||media.hash||(!local&&!provider))
      throw Error('El reproductor no es válido.');
    return url.href;
  }
  if(url.hostname==='tvf90.com' && /^\/(online|1|2|3|5|hd|canal|plus1)\.php$/.test(url.pathname) && /^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||''))return url.origin+url.pathname+'?stream='+encodeURIComponent(url.searchParams.get('stream'));
  if(url.hostname==='stream04.lat' && url.pathname==='/libre/live1.php' && /^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||''))return url.origin+url.pathname+'?stream='+encodeURIComponent(url.searchParams.get('stream'));
  if(['streamxhd.sbs','stream-xhd.com','streamxhd.st','streamxhd.click'].includes(url.hostname)){
    if(!['/live1.php','/live2.php'].includes(url.pathname)||!/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||''))throw Error('El reproductor de StreamXHD no es válido.');
    const host=url.hostname;
    return 'https://'+host+url.pathname+'?stream='+encodeURIComponent(url.searchParams.get('stream'));
  }
  if(url.hostname==='embed.ksdjugfssddeports.com'&&/^\/embed2?\/[a-z0-9]{1,80}\.php$/i.test(url.pathname)){
    return 'https://embed.ksdjugfssddeports.com'+url.pathname;
  }
  throw Error('El reproductor no es válido.');
}
// Recover only after an observed connection loss; never restart a healthy stream on a timer.
export function watchPlayerConnection({window=globalThis.window,document=globalThis.document,onOffline=()=>{},onReconnect=()=>{},setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout}){
  if(!window?.addEventListener)return {reset(){},destroy(){}};
  let lost=window.navigator?.onLine===false,timer=null,disposed=false;
  const cancel=()=>{if(timer!==null)clearTimer(timer);timer=null;};
  const offline=()=>{lost=true;cancel();onOffline();};
  const recover=()=>{
    if(disposed||!lost||window.navigator?.onLine===false||document.hidden||timer!==null)return;
    timer=setTimer(()=>{timer=null;if(disposed||!lost||document.hidden||window.navigator?.onLine===false)return;lost=false;onReconnect();},1200);
  };
  window.addEventListener('offline',offline);window.addEventListener('online',recover);document.addEventListener('visibilitychange',recover);
  if(lost)onOffline();
  return {reset(){cancel();lost=window.navigator?.onLine===false;},destroy(){disposed=true;cancel();window.removeEventListener('offline',offline);window.removeEventListener('online',recover);document.removeEventListener('visibilitychange',recover);}};
}
export function createExternalPlayer({container,sources,name,rotateOnReload=false,sportsrcOrigin=null,onChange=()=>{},onOffline=()=>{},onLoad=()=>{},document=globalThis.document,window=globalThis.window}){
  const urls=[...new Set(sources.map(s=>{
    if(!sportsrcOrigin)return providerPlayerURL(s.url);
    const url=new URL(s.url);
    if(url.protocol!=='https:'||url.origin!==sportsrcOrigin||url.username||url.password)
      throw Error('El reproductor no es válido.');
    return url.href;
  }))];
  if(!urls.length)throw Error('Este canal no tiene un reproductor publicado.');
  let index=0,disposed=false,frame;
  let triedRecovery=false;
  const open=(reason='open')=>{
    if(disposed)return;
    if(frame){frame.onload=null;frame.src='about:blank';frame.remove();}
    frame=document.createElement('iframe');frame.title='Reproductor externo · '+name;
    const embedHost=new URL(urls[index]).hostname;
    const isMatchora=['matchora.to','matchora.pro','es.matchora.pro'].includes(embedHost);
    if(!isMatchora&&!sportsrcOrigin)frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen','');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frame.className='external-player';
    const current=frame;
    let loaded=false,loadTime=0;
    const handleLoad=()=>{
      if(disposed||current!==frame)return;
      const now=Date.now();
      if(loaded&&!triedRecovery&&now-loadTime<=35000){
        const currentUrl=urls[index];
        const altUrl=currentUrl.replace(/\/live([12])\.php\?/,(_,m)=>m==='1'?'/live2.php?':'/live1.php?');
        const altIndex=urls.indexOf(altUrl);
        if(altIndex!==-1){
          triedRecovery=true;
          index=altIndex;
          open('recovery');
          return;
        }
      }
      loaded=true;
      loadTime=now;
      onLoad({index,total:urls.length});
    };
    if(typeof current.addEventListener==='function')current.addEventListener('load',handleLoad);
    else current.onload=handleLoad;
    current.src=urls[index];
    container.replaceChildren(frame);
    onChange({url:urls[index],index,total:urls.length,reason});
  };
  open();
  const connection=watchPlayerConnection({window,document,onOffline,onReconnect:()=>open('reconnect')});
  return {
    reload(){if(disposed)return;triedRecovery=false;connection.reset();if(rotateOnReload)index=(index+1)%urls.length;open('retry');},
    next(){if(disposed)return;triedRecovery=false;connection.reset();index=(index+1)%urls.length;open();},
    destroy(){disposed=true;connection.destroy();if(frame){frame.onload=null;frame.src='about:blank';frame.remove();}}
  };
}
