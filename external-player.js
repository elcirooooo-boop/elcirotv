export function providerPlayerURL(value){
  const url=new URL(value);
  const invalid=()=>{throw Error('El reproductor de DAMITV no es válido.');};
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hostname!=='damitv.st'||url.hash)invalid();
  const keys=[...url.searchParams.keys()];
  if(url.pathname==='/embed/'){
    if(keys.length!==1||keys[0]!=='id'||!/^[a-zA-Z0-9_/-]{1,180}$/.test(url.searchParams.get('id')||''))invalid();
  }else if(url.pathname==='/player/hls/'){
    if(keys.some(k=>!['v','url','name'].includes(k))||new Set(keys).size!==keys.length||!/^\d{1,8}$/.test(url.searchParams.get('v')||''))invalid();
    const target=url.searchParams.get('url')||'';
    if(!target||target.length>7000||/[\x00-\x20]/.test(target))invalid();
    if(!target.startsWith('/')||target.startsWith('//')){
      const nested=new URL(target);
      if(nested.protocol!=='https:'||nested.username||nested.password||nested.port||nested.hash||!(nested.hostname==='damitv.st'||nested.hostname.endsWith('.damitv.st')))invalid();
    }
  }else invalid();
  return url.href;
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
export function createExternalPlayer({container,sources,name,onChange=()=>{},onOffline=()=>{},document=globalThis.document,window=globalThis.window}){
  const urls=[...new Set(sources.map(s=>providerPlayerURL(s.url)))];
  if(!urls.length)throw Error('Este canal no tiene un reproductor publicado.');
  let index=0,disposed=false,frame;
  const mount=()=>{
    if(frame){frame.src='about:blank';frame.remove();}
    frame=document.createElement('iframe');frame.title='Reproductor externo · '+name;
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen','');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frame.className='external-player';
    container.replaceChildren(frame);
  };
  const open=(reason='open')=>{if(disposed)return;frame.src=urls[index];onChange({url:urls[index],index,total:urls.length,reason});};mount();open();
  const connection=watchPlayerConnection({window,document,onOffline,onReconnect:()=>open('reconnect')});
  return {reload(){if(disposed)return;connection.reset();open('retry');},next(){if(disposed)return;connection.reset();index=(index+1)%urls.length;open();},destroy(){disposed=true;connection.destroy();frame.src='about:blank';frame.remove();}};
}
