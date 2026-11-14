export function providerPlayerURL(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['streamxhd.sbs','stream-xhd.com','streamxhd.st','streamxhd.click'].includes(url.hostname)||!['/live1.php','/live2.php'].includes(url.pathname)||!/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||''))throw Error('El reproductor de StreamXHD no es válido.');
  const host=url.hostname==='stream-xhd.com'?'streamxhd.sbs':url.hostname;
  return 'https://'+host+url.pathname+'?stream='+encodeURIComponent(url.searchParams.get('stream'));
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
export function createExternalPlayer({container,sources,name,onChange=()=>{},onOffline=()=>{},onSlow=()=>{},onLoad=()=>{},document=globalThis.document,window=globalThis.window,timers=globalThis}){
  const urls=[...new Set(sources.map(s=>providerPlayerURL(s.url)))];
  if(!urls.length)throw Error('Este canal no tiene un reproductor publicado.');
  let index=0,disposed=false,frame,timeout;
  const clearLoadTimer=()=>timers.clearTimeout(timeout);
  const open=(reason='open')=>{
    if(disposed)return;
    clearLoadTimer();
    frame?.remove();
    frame=document.createElement('iframe');frame.title='Reproductor externo · '+name;
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
    frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
    frame.setAttribute('allowfullscreen','');frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');frame.className='external-player';
    const current=frame;
    current.onload=()=>{
      if(disposed||current!==frame)return;
      clearLoadTimer();
      if(window?.navigator?.onLine!==false)onLoad({index,total:urls.length});
    };
    current.src=urls[index];
    timeout=timers.setTimeout(()=>{
      if(window?.navigator?.onLine!==false)onSlow({index,total:urls.length});
    },8000);
    container.replaceChildren(frame);
    onChange({url:urls[index],index,total:urls.length,reason});
  };
  open();
  const connection=watchPlayerConnection({window,document,onOffline:()=>{clearLoadTimer();onOffline();},onReconnect:()=>open('reconnect')});
  return {reload(){if(disposed)return;connection.reset();open('retry');},next(){if(disposed)return;connection.reset();index=(index+1)%urls.length;open();},destroy(){disposed=true;connection.destroy();clearLoadTimer();frame.onload=null;frame.src='about:blank';frame.remove();}};
}
