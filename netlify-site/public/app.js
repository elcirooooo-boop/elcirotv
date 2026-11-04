const main=document.querySelector('#main');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intro=(title,sub)=>`<section class="intro compact"><p class="eyebrow">EL CIRO TV</p><h1>${esc(title)}</h1><p>${esc(sub)}</p></section>`;
let data,hls,video,selected='',currentMatch='',tracking,counts=null,lastProgress=0,presenceQueue=Promise.resolve();
const session=crypto.randomUUID();
async function api(path,options){const r=await fetch('/api/'+path,options);const value=await r.json();if(!r.ok)throw Error(value.error||'No disponible.');return value;}
function link(event){return '/partido/'+event.id;}
function heartbeat(){
  const payload={session,match:currentMatch,playing:!!video&&!video.paused&&!video.ended&&video.readyState>=3&&Date.now()-lastProgress<8000};
  presenceQueue=presenceQueue.catch(()=>{}).then(()=>api('presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).catch(()=>{});
  return presenceQueue;
}
function viewerLabel(id){return `<span class="viewer-count" data-viewers="${esc(id)}" title="Espectadores activos aproximados">${counts===null?'— viendo ahora':`${counts[id]||0} viendo ahora`}</span>`;}
async function refreshViewers(){try{const result=await api('viewers');counts=result.counts;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent=(counts[el.dataset.viewers]||0)+' viendo ahora';});}catch{counts=null;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent='Conteo no disponible';});}}
function stop(){lastProgress=0;hls?.destroy();hls=null;if(video){video.pause();video.removeAttribute('src');video.load();video=null;}selected='';}
function navigate(href){history.pushState(null,'',href);render();window.scrollTo(0,0);}
document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.origin===location.origin&&!a.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(a.pathname+a.search);}});
addEventListener('popstate',render);
async function load(){data=await api('agenda');}
function signalCards(signals){return signals.map((s,i)=>`<button class="channel-card signal-button" data-signal="${esc(s.id)}" aria-pressed="false"><span class="channel-option">Opción ${i+1}</span><h2>${esc(s.name)}</h2><span class="text-link">Ver canal ↗</span></button>`).join('');}
async function play(signal,signals){
  stop();selected=signal.id;const identity=selected;
  const oldVideo=document.querySelector('video');video=oldVideo.cloneNode(false);oldVideo.replaceWith(video);document.querySelector('#videoSection').hidden=false;
  document.querySelectorAll('[data-signal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.signal===identity)));
  const status=document.querySelector('#signalStatus');status.textContent='Conectando con '+signal.name+'…';
  video.addEventListener('timeupdate',()=>{if(selected===identity)lastProgress=Date.now();});
  const fail=()=>{lastProgress=0;void heartbeat();if(selected===identity)status.textContent='Esta señal no responde. Reintenta o elige otro canal disponible.';};
  video.addEventListener('playing',()=>{if(selected===identity){lastProgress=Date.now();status.textContent=signal.name+' · Reproduciendo';void heartbeat().then(refreshViewers);}});
  video.addEventListener('pause',()=>void heartbeat().then(refreshViewers));video.addEventListener('ended',()=>void heartbeat().then(refreshViewers));video.addEventListener('error',fail,{once:true});
  document.querySelector('#retry').onclick=()=>play(signal,signals);
  document.querySelector('#fullscreen').onclick=()=>{if(video.requestFullscreen)void video.requestFullscreen();else video.webkitEnterFullscreen?.();};
  try{
    const source=await api('play?source='+encodeURIComponent(identity));if(selected!==identity)return;
    if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=source.url;}
    else if(window.Hls?.isSupported()){
      hls=new Hls({maxBufferLength:25,maxMaxBufferLength:45});hls.on(Hls.Events.ERROR,(_,error)=>{if(error.fatal)fail();});hls.loadSource(source.url);hls.attachMedia(video);
    }else{status.textContent='Este navegador no admite la reproducción. Prueba Safari, Chrome o Edge actualizado.';return;}
    void video.play().catch(()=>{if(selected===identity)status.textContent='Toca reproducir para ver '+signal.name+'.';});
  }catch(error){if(selected===identity)status.textContent=error.message;}
  document.querySelector('#videoSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function chooser(event,signals){
  main.innerHTML=`<a class="back-link" href="${event?'/':'/canales'}">← ${event?'Todos los partidos':'Todos los canales'}</a>${intro(event?.title||signals[0]?.name||'Canal',event?`${event.league} · ${event.time}`:'Elige una señal para reproducir.')}${event?viewerLabel(event.id):''}<section id="videoSection" hidden><div class="video-wrap"><video controls playsinline preload="none" aria-label="Reproductor del partido"></video></div><p id="signalStatus" class="signal-status" role="status"></p><div class="status-actions"><button id="retry">Reintentar señal</button><button id="fullscreen">Pantalla completa</button></div></section><section class="match-channels"><div class="section-heading"><h2>Canales disponibles</h2><span>${signals.length} opciones</span></div><p class="player-note">Selecciona el canal con el que quieres ver ${event?'este partido':'la transmisión'}.</p>${signals.length?`<div class="channel-grid">${signalCards(signals)}</div>`:'<div class="empty"><h2>Señales por anunciar</h2><p>Vuelve a consultar la agenda más tarde.</p></div>'}</section>`;
  main.querySelectorAll('[data-signal]').forEach(b=>b.onclick=()=>play(signals.find(s=>s.id===b.dataset.signal),signals));
}
function listing(channels=false){
  main.innerHTML=intro(channels?'Tus canales.':'Tu próximo partido.',channels?'Todas las señales publicadas en la agenda.':'Elige tu partido, selecciona un canal y disfruta.')+`<div class="toolbar"><label class="search"><input id="search" type="search" aria-label="Buscar partido o canal" placeholder="${channels?'Buscar canal…':'Equipo, liga o canal…'}"></label>${channels?'':'<select id="league" aria-label="Filtrar por competición"><option value="">Todas las competiciones</option>'+[...new Set(data.events.map(e=>e.league))].map(l=>`<option>${esc(l)}</option>`).join('')+'</select>'}</div><div class="section-heading"><h2>${channels?'Canales':'Partidos de hoy'}</h2><span id="count"></span></div><div id="results"></div>${data.stale?'<p role="status">Mostrando la última agenda disponible de hoy.</p>':''}`;
  const update=()=>{
    const term=main.querySelector('#search').value.toLocaleLowerCase(),league=main.querySelector('#league')?.value;
    const values=channels?data.channels.filter(c=>c.name.toLowerCase().includes(term)):data.events.filter(e=>(!league||e.league===league)&&`${e.title} ${e.league} ${e.signals.map(s=>s.name).join(' ')}`.toLowerCase().includes(term));
    main.querySelector('#count').textContent=values.length+(channels?' señales':' partidos');
    main.querySelector('#results').innerHTML=values.length?(channels?`<div class="channel-grid">${values.map(c=>`<a class="channel-card" href="/canal/${c.id}"><h2>${esc(c.name)}</h2><span class="text-link">Elegir señal ↗</span></a>`).join('')}</div>`:`<div class="event-list">${values.map(e=>`<a class="event-row" href="${link(e)}"><span class="event-time">${esc(e.time)}</span><div class="event-description"><h3>${esc(e.title)}</h3><p>${esc(e.league)}</p>${viewerLabel(e.id)}</div><span class="event-channel-choice"><span>${e.signals.length} canales</span><span>›</span></span></a>`).join('')}</div>`):'<div class="empty"><h2>No hay resultados</h2><p>Prueba otra búsqueda o vuelve a consultar la agenda.</p></div>';
  };main.querySelector('#search').oninput=update;if(main.querySelector('#league'))main.querySelector('#league').onchange=update;update();
}
async function render(){
  stop();currentMatch='';
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try{
    if(!data)await load();
    if(location.pathname==='/')listing();
    else if(location.pathname==='/canales')listing(true);
    else if(location.pathname.startsWith('/partido/')){
      const event=data.events.find(e=>link(e)===location.pathname);
      if(!event)throw Error('Este partido ya no está publicado en la agenda de hoy.');currentMatch=event.id;chooser(event,event.signals);
    }else if(location.pathname.startsWith('/canal/')){
      const channel=data.channels.find(c=>'/canal/'+c.id===location.pathname);if(!channel)throw Error('Este canal ya no está publicado.');chooser(null,[channel]);
    }else throw Error('No encontramos esta página.');
    void heartbeat().then(refreshViewers);
    if(!tracking)tracking=setInterval(()=>void heartbeat().then(refreshViewers),30000);
  }catch(error){main.innerHTML=intro('Vuelve a intentarlo.',error.message)+'<a class="back-link" href="/">← Ver partidos</a><button id="reload" class="primary-button">Actualizar agenda</button>';main.querySelector('#reload').onclick=()=>{data=null;void render();};}
}
document.addEventListener('visibilitychange',()=>void heartbeat().then(refreshViewers));
addEventListener('pagehide',()=>{navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({session,match:currentMatch,playing:false})],{type:'application/json'}));});
void render();
