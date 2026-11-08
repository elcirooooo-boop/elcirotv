// Keep an in-page expansion when embedded browsers cannot enter native fullscreen.
export function createPlayerFullscreen({section,button,document=globalThis.document}){
  let expanded=false,disposed=false,previousOverflow='',previousFocus;
  const nativeElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const exitNative=()=>document.exitFullscreen?document.exitFullscreen():document.webkitExitFullscreen?.();
  function collapse(){
    if(!expanded)return;
    expanded=false;section.classList.remove('player-expanded');
    document.documentElement.style.overflow=previousOverflow;
    button.textContent='Pantalla completa';button.setAttribute('aria-pressed','false');
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  async function exit(){
    collapse();
    if(nativeElement()===section){
      try{await exitNative();}catch{}
    }
  }
  async function enter(){
    if(disposed)return;
    expanded=true;previousOverflow=document.documentElement.style.overflow;
    previousFocus=document.activeElement;
    section.classList.add('player-expanded');document.documentElement.style.overflow='hidden';
    button.textContent='Salir de pantalla completa';button.setAttribute('aria-pressed','true');
    button.focus({preventScroll:true});
    try{
      const request=section.requestFullscreen||section.webkitRequestFullscreen;
      if(request)await request.call(section);
      if(disposed&&nativeElement()===section)await exitNative();
    }catch{ /* Telegram/iOS keeps the viewport expansion. */ }
  }
  const toggle=()=>expanded?void exit():void enter();
  const changed=()=>{if(!nativeElement())collapse();};
  const key=event=>{if(event.key==='Escape'&&expanded){event.preventDefault();void exit();}};
  button.setAttribute('aria-pressed','false');button.addEventListener('click',toggle);
  document.addEventListener('fullscreenchange',changed);document.addEventListener('webkitfullscreenchange',changed);
  document.addEventListener('keydown',key);
  return {destroy(){disposed=true;void exit();button.removeEventListener('click',toggle);document.removeEventListener('fullscreenchange',changed);document.removeEventListener('webkitfullscreenchange',changed);document.removeEventListener('keydown',key);}};
}
