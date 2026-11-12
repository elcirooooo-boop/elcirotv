// Native video fullscreen, with an in-page fallback for embedded browsers.
export function createPlayerFullscreen({section,button,document=globalThis.document,window=document.defaultView||globalThis.window}){
  const video=section.querySelector?.('video');
  let expanded=false,disposed=false,previousOverflow='',previousBodyOverflow='',previousFocus,nativeOwned=false;
  const viewport=window?.visualViewport;
  const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  // Cross-origin players expose their iframe here, not the video inside it.
  const ownsNative=()=>!!nativeElement()&&(nativeElement()===video||nativeElement()===section||section.contains?.(nativeElement()));
  const exitNative=()=>video?.webkitDisplayingFullscreen?video.webkitExitFullscreen?.():document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.();
  const resize=()=>{
    if(!expanded||!section.style)return;
    const height=viewport?.height||window?.innerHeight,width=viewport?.width||window?.innerWidth;
    // iPhone webviews cannot fullscreen a cross-origin video from the parent.
    // Rotate the entire embed into a landscape viewport instead of letterboxing it in portrait.
    if(!video&&width<=600&&height>width)section.classList.add('player-landscape');
    else section.classList.remove('player-landscape');
    for(const [name,value] of Object.entries({height,width,top:viewport?.offsetTop||0,left:viewport?.offsetLeft||0})){
      if(Number.isFinite(value))section.style.setProperty('--player-'+name,value+'px');
    }
  };
  function expand(){
    if(expanded||disposed)return;
    expanded=true;previousOverflow=document.documentElement.style.overflow;
    previousBodyOverflow=document.body?.style.overflow;previousFocus=document.activeElement;
    section.classList.add('player-expanded');document.documentElement.style.overflow='hidden';
    if(document.body)document.body.style.overflow='hidden';
    button.textContent='Salir ✕';button.setAttribute('aria-label','Salir de pantalla completa');button.setAttribute('aria-pressed','true');
    resize();
  }
  function collapse(){
    if(!expanded)return;
    expanded=false;nativeOwned=false;section.classList.remove('player-expanded');section.classList.remove('player-landscape');
    document.documentElement.style.overflow=previousOverflow;
    if(document.body)document.body.style.overflow=previousBodyOverflow;
    for(const name of ['height','width','top','left'])section.style?.removeProperty('--player-'+name);
    button.textContent='Pantalla completa';button.setAttribute('aria-label','Pantalla completa');button.setAttribute('aria-pressed','false');
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  async function exit(){
    const owned=ownsNative()||video?.webkitDisplayingFullscreen;
    collapse();
    if(owned){try{await exitNative();}catch{}}
  }
  async function enter(){
    if(disposed)return;
    expand();
    button.focus({preventScroll:true});
    try{
      // iPhone exposes fullscreen on the video, rather than the surrounding section.
      if(video?.requestFullscreen)await video.requestFullscreen();
      else if(video?.webkitEnterFullscreen)video.webkitEnterFullscreen();
      else {
        const request=section.requestFullscreen||section.webkitRequestFullscreen;
        if(request)await request.call(section);
      }
      nativeOwned=ownsNative()||!!video?.webkitDisplayingFullscreen;
      if((disposed||!expanded)&&nativeOwned)await exitNative();
    }catch{ /* Telegram/iOS keeps the viewport expansion when native mode is blocked. */ }
  }
  const toggle=()=>expanded||ownsNative()||video?.webkitDisplayingFullscreen?void exit():void enter();
  const changed=()=>{if(ownsNative()||video?.webkitDisplayingFullscreen){nativeOwned=true;expand();}else if(nativeOwned)collapse();};
  const ended=()=>collapse();
  const key=event=>{if(event.key==='Escape'&&expanded){event.preventDefault();void exit();}};
  button.setAttribute('aria-pressed','false');button.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
  video?.addEventListener('webkitbeginfullscreen',changed);video?.addEventListener('webkitendfullscreen',ended);
  document.addEventListener('keydown',key);
  window?.addEventListener('resize',resize);viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  return {destroy(){disposed=true;void exit();button.removeEventListener('click',toggle);document.removeEventListener('fullscreenchange',changed);document.removeEventListener('webkitfullscreenchange',changed);video?.removeEventListener('webkitbeginfullscreen',changed);video?.removeEventListener('webkitendfullscreen',ended);document.removeEventListener('keydown',key);window?.removeEventListener('resize',resize);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);}};
}

