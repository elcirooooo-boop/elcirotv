// Native video fullscreen, with an in-page fallback for embedded browsers.
export function createPlayerFullscreen({section,button,document=globalThis.document}){
  const video=section.querySelector?.('video');
  let expanded=false,disposed=false,previousOverflow='',previousFocus,nativeOwned=false;
  const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const ownsNative=()=>!!nativeElement()&&(nativeElement()===video||nativeElement()===section);
  const exitNative=()=>video?.webkitDisplayingFullscreen?video.webkitExitFullscreen?.():document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.();
  function collapse(){
    if(!expanded)return;
    expanded=false;nativeOwned=false;section.classList.remove('player-expanded');
    document.documentElement.style.overflow=previousOverflow;
    button.textContent='Pantalla completa';button.setAttribute('aria-pressed','false');
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  async function exit(){
    const owned=ownsNative()||video?.webkitDisplayingFullscreen;
    collapse();
    if(owned){try{await exitNative();}catch{}}
  }
  async function enter(){
    if(disposed)return;
    expanded=true;previousOverflow=document.documentElement.style.overflow;
    previousFocus=document.activeElement;
    section.classList.add('player-expanded');document.documentElement.style.overflow='hidden';
    button.textContent='Salir de pantalla completa';button.setAttribute('aria-pressed','true');
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
  const toggle=()=>expanded?void exit():void enter();
  const changed=()=>{if(ownsNative()||video?.webkitDisplayingFullscreen)nativeOwned=true;else if(nativeOwned)collapse();};
  const ended=()=>collapse();
  const key=event=>{if(event.key==='Escape'&&expanded){event.preventDefault();void exit();}};
  button.setAttribute('aria-pressed','false');button.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
  video?.addEventListener('webkitbeginfullscreen',changed);video?.addEventListener('webkitendfullscreen',ended);
  document.addEventListener('keydown',key);
  return {destroy(){disposed=true;void exit();button.removeEventListener('click',toggle);document.removeEventListener('fullscreenchange',changed);document.removeEventListener('webkitfullscreenchange',changed);video?.removeEventListener('webkitbeginfullscreen',changed);video?.removeEventListener('webkitendfullscreen',ended);document.removeEventListener('keydown',key);}};
}

