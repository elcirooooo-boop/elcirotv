import {matchPath,matchIdFromPath,sharedSignal,matchShareData,copyShareLink,shareMatch} from './share.js';
import {createLivePlayer} from './live-player.js?v=20261107d';
import {matchSchedule,scheduleText} from './schedule.js';
import {teamBadges,handleBadgeError} from './team-badges.js?v=20261107e';
import {liveIndicator,updateLiveStatuses} from './live-status.js';
import {requestJSON} from './api-client.js?v=20261107c';
document.addEventListener('error',handleBadgeError,true);
const main=document.querySelector('#main');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intro=(title,sub)=>`<section class="intro compact"><p class="eyebrow">EL CIRO TV</p><h1>${esc(title)}</h1><p>${esc(sub)}</p></section>`;
let playerGeneration=0,player,embeddedPlayer;
let updateMatchShare=()=>{};
let refreshListing=()=>{},agendaLoading=false;
let data,video,selected='',currentMatch='',tracking,counts=null,lastProgress=0,presenceQueue=Promise.resolve();
const session=crypto.randomUUID();
const phpAPI=document.querySelector('meta[name="api-runtime"]')?.content==='php';
async function api(path,options){return requestJSON(path,options,{php:phpAPI});}
function link(event){return matchPath(event);}
function scheduleMarkup(event){return matchSchedule(event).map(part=>`<span class="schedule-zone"><span class="schedule-country">${esc(part.label)}</span><time datetime="${esc(event.startsAt)}">${esc(part.date)} · ${esc(part.time)}</time></span>`).join('');}
function heartbeat(){
  const payload={session,match:currentMatch,playing:!!video&&!video.paused&&!video.ended&&video.readyState>=3&&Date.now()-lastProgress<8000};
  presenceQueue=presenceQueue.catch(()=>{}).then(()=>api('presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).catch(()=>{});
  return presenceQueue;
}
function viewerLabel(id){return `<span class="viewer-count" data-viewers="${esc(id)}" title="Espectadores activos aproximados">${counts===null?'— viendo ahora':`${counts[id]||0} viendo ahora`}</span>`;}
async function refreshViewers(){try{const result=await api('viewers');counts=result.counts;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent=(counts[el.dataset.viewers]||0)+' viendo ahora';});}catch{counts=null;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent='Conteo no disponible';});}}
function stop(){playerGeneration++;player?.destroy();player=null;embeddedPlayer?.remove();embeddedPlayer=null;lastProgress=0;if(video){video.hidden=false;video.style.removeProperty('display');video.pause();video.removeAttribute('src');video.load();video=null;}selected='';}
function navigate(href){history.pushState(null,'',href);render();window.scrollTo(0,0);}
document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.origin===location.origin&&!a.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(a.pathname+a.search);}});
addEventListener('popstate',render);
async function load(){data=await api('agenda');}
function signalCards(signals){return signals.map((s,i)=>`<button class="channel-card signal-button" data-signal="${esc(s.id)}" aria-pressed="false"><span class="channel-option">Opción ${i+1}</span><h2>${esc(s.name)}</h2><span class="text-link">Ver canal ↗</span></button>`).join('');}
async function play(signal,signals){
  stop();selected=signal.id;const generation=playerGeneration,identity=selected;
  updateMatchShare(signal);
  document.querySelector('#videoSection').hidden=false;
  document.querySelectorAll('[data-signal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.signal===identity)));
  const status=document.querySelector('#signalStatus');
  video=document.querySelector('video');
  const active=()=>playerGeneration===generation&&selected===identity;
  player=createLivePlayer({
    video,Hls:window.Hls,
    onEmbed:url=>{if(!active())return;const target=new URL(url);if(target.protocol!=='https:'||target.hostname!=='rodrixtv.site'||!/^\/tv\/canal\d+\.html$/.test(target.pathname))throw Error('Reproductor no válido.');embeddedPlayer=document.createElement('iframe');embeddedPlayer.src=target.href;embeddedPlayer.title=signal.name;embeddedPlayer.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');embeddedPlayer.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');embeddedPlayer.allowFullscreen=true;embeddedPlayer.style.cssText='width:100%;height:100%;border:0;position:absolute;inset:0';video.hidden=true;video.style.display='none';video.parentElement.style.position='relative';video.parentElement.append(embeddedPlayer);},
    resolveSource:(excluded,abortSignal,{refresh})=>api('play?source='+encodeURIComponent(identity)+'&exclude='+encodeURIComponent(excluded.join(','))+(refresh?'&refresh=1':''),{signal:abortSignal}),
    onStatus:text=>{if(active())status.textContent=signal.name+' · '+text;},
    onProgress:()=>{if(active())lastProgress=Date.now();},
    onState:()=>{if(active())void heartbeat().then(refreshViewers);},
  });
  document.querySelector('#retry').onclick=()=>play(signal,signals);
  document.querySelector('#fullscreen').onclick=()=>{if(embeddedPlayer?.requestFullscreen)void embeddedPlayer.requestFullscreen();else if(video.requestFullscreen)void video.requestFullscreen();else video.webkitEnterFullscreen?.();};
  await player.start();
  if(active())document.querySelector('#videoSection').scrollIntoView({behavior:'smooth',block:'start'});
}

function chooser(event,signals){
  main.innerHTML=`<a class="back-link" href="${event?'/':'/canales'}">← ${event?'Todos los partidos':'Todos los canales'}</a>${intro(event?.title||signals[0]?.name||'Canal',event?`${event.league} · ${scheduleText(event)}`:'Elige una señal para reproducir.')}${event?viewerLabel(event.id):''}<section id="videoSection" hidden><div class="video-wrap"><video controls playsinline preload="none" aria-label="Reproductor del partido"></video></div><p id="signalStatus" class="signal-status" role="status"></p><div class="status-actions"><button id="retry">Reintentar señal</button><button id="fullscreen">Pantalla completa</button></div></section><section class="match-channels"><div class="section-heading"><h2>Canales disponibles</h2><span>${signals.length} opciones</span></div><p class="player-note">Selecciona el canal con el que quieres ver ${event?'este partido':'la transmisión'}.</p>${signals.length?`<div class="channel-grid">${signalCards(signals)}</div>`:'<div class="empty"><h2>Señales por anunciar</h2><p>Vuelve a consultar la agenda más tarde.</p></div>'}</section>`;
  if(event){
    main.querySelector('.intro h1').insertAdjacentHTML('afterend',liveIndicator(event));
    const badges=teamBadges(event);
    if(badges)main.querySelector('.intro h1').insertAdjacentHTML('beforebegin',`<div class="match-team-heading">${badges}</div>`);
    let channel=sharedSignal(event,location.search)||signals[0];
    const getShareData=()=>matchShareData(event,location.origin,channel);
    const sharing=document.createElement('section');sharing.className='match-sharing';sharing.setAttribute('aria-label','Compartir este partido');
    sharing.innerHTML=`<div class="share-actions"><button type="button" data-share>Compartir partido ↗</button><button type="button" data-copy>Copiar enlace</button></div><p class="share-feedback" role="status" aria-live="polite"></p><label class="share-manual" hidden>Enlace directo al partido<input type="url" readonly aria-label="Enlace directo al partido"></label>`;
    const feedback=sharing.querySelector('.share-feedback'),manual=sharing.querySelector('.share-manual'),input=sharing.querySelector('input');input.value=getShareData().url;
    const destination=document.createElement('p');destination.className='share-destination';sharing.append(destination);
    updateMatchShare=signal=>{
      channel=signals.find(s=>s.id===signal?.id);input.value=getShareData().url;
      destination.textContent=channel?'El enlace abrirá directamente '+channel.name+'.':'Comparte el enlace de este partido.';
      feedback.textContent='';manual.hidden=true;
    };
    updateMatchShare(channel);
    const report=result=>{
      if(!sharing.isConnected)return;
      feedback.textContent=result==='copied'?'Enlace del partido copiado.':result==='manual'?'Selecciona el enlace y cópialo para compartirlo.':'';
      manual.hidden=result!=='manual';if(result==='manual'){input.focus();input.select();}
    };
    sharing.querySelector('[data-share]').onclick=async()=>report(await shareMatch(getShareData()));
    sharing.querySelector('[data-copy]').onclick=async()=>report(await copyShareLink(getShareData()));
    main.querySelector('#videoSection').before(sharing);
    document.title=getShareData().title;
  }
  main.querySelectorAll('[data-signal]').forEach(b=>b.onclick=()=>play(signals.find(s=>s.id===b.dataset.signal),signals));
}
function listing(channels=false){
  main.innerHTML=intro(channels?'Tus canales.':'Tu próximo partido.',channels?'Todas las señales publicadas en la agenda.':'Elige tu partido, selecciona un canal y disfruta.')+`<div class="toolbar"><label class="search"><input id="search" type="search" aria-label="Buscar partido o canal" placeholder="${channels?'Buscar canal…':'Equipo, liga o canal…'}"></label>${channels?'':'<select id="league" aria-label="Filtrar por competición"><option value="">Todas las competiciones</option>'+[...new Set(data.events.map(e=>e.league))].map(l=>`<option>${esc(l)}</option>`).join('')+'</select>'}</div><div class="section-heading"><h2>${channels?'Canales':'Partidos de hoy'}</h2><span id="count"></span></div><div id="results"></div>${data.stale?'<p role="status">Mostrando la última agenda disponible de hoy.</p>':''}`;
  const update=()=>{
    const term=main.querySelector('#search').value.toLocaleLowerCase(),league=main.querySelector('#league')?.value;
    const values=channels?data.channels.filter(c=>c.name.toLowerCase().includes(term)):data.events.filter(e=>(!league||e.league===league)&&`${e.title} ${e.league} ${e.signals.map(s=>s.name).join(' ')}`.toLowerCase().includes(term));
    main.querySelector('#count').textContent=values.length+(channels?' señales':' partidos');
    main.querySelector('#results').innerHTML=values.length?(channels?`<div class="channel-grid">${values.map(c=>`<a class="channel-card" href="/canal/${c.id}"><h2>${esc(c.name)}</h2><span class="text-link">Elegir señal ↗</span></a>`).join('')}</div>`:`<div class="event-list">${values.map(e=>{const badges=teamBadges(e);return `<a class="event-row${badges?' has-teams':''}" href="${link(e)}"><span class="event-time">${scheduleMarkup(e)}</span>${badges}<div class="event-description"><h3>${esc(e.title)}</h3><p>${esc(e.league)}</p>${liveIndicator(e)}${viewerLabel(e.id)}</div><span class="event-channel-choice"><span>${e.signals.length} canales</span><span>›</span></span></a>`;}).join('')}</div>`):'<div class="empty"><h2>No hay resultados</h2><p>Prueba otra búsqueda o vuelve a consultar la agenda.</p></div>';
  };main.querySelector('#search').oninput=update;if(main.querySelector('#league'))main.querySelector('#league').onchange=update;update();
  refreshListing=()=>{const select=main.querySelector('#league');if(select){const value=select.value;select.innerHTML='<option value="">Todas las competiciones</option>'+[...new Set(data.events.map(e=>e.league))].map(l=>`<option>${esc(l)}</option>`).join('');select.value=[...select.options].some(o=>o.value===value)?value:'';}update();};
}
async function render(){
  refreshListing=()=>{};
  stop();currentMatch='';
  updateMatchShare=()=>{};
  document.title='El Ciro · Deportes en directo';
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try{
    if(!data)await load();
    if(location.pathname==='/')listing();
    else if(location.pathname==='/canales')listing(true);
    else if(location.pathname.startsWith('/partido/')){
      const requestedId=matchIdFromPath(location.pathname);
      const event=data.events.find(e=>e.id===requestedId)||data.events.find(e=>e.legacyIds?.includes(requestedId));
      if(!event)throw Error('Este partido ya no está publicado en la agenda de hoy.');currentMatch=event.id;chooser(event,event.signals);
      const requested=new URLSearchParams(location.search).get('canal');
      if(requested){
        const signal=sharedSignal(event,location.search);
        if(signal)void play(signal,event.signals);
        else{
          const notice=document.createElement('p');notice.className='player-note';notice.setAttribute('role','status');notice.textContent='El canal compartido ya no está disponible para este partido. Selecciona otro canal de la lista.';main.querySelector('.match-channels').before(notice);
        }
      }
    }else if(location.pathname.startsWith('/canal/')){
      const channel=data.channels.find(c=>'/canal/'+c.id===location.pathname);if(!channel)throw Error('Este canal ya no está publicado.');chooser(null,[channel]);
    }else throw Error('No encontramos esta página.');
    void heartbeat().then(refreshViewers);
    if(!tracking)tracking=setInterval(()=>void heartbeat().then(refreshViewers),30000);
  }catch(error){main.innerHTML=intro('Vuelve a intentarlo.',error.message)+'<a class="back-link" href="/">← Ver partidos</a><button id="reload" class="primary-button">Actualizar agenda</button>';main.querySelector('#reload').onclick=()=>{data=null;void render();};}
}
setInterval(()=>updateLiveStatuses(main),15000);
async function refreshAgenda(){
  if(document.hidden||agendaLoading)return;
  agendaLoading=true;
  try{data=await api('agenda');refreshListing();}catch{/* Retain the last working agenda during a temporary outage. */}
  finally{agendaLoading=false;}
}
setInterval(()=>void refreshAgenda(),60000);
document.addEventListener('visibilitychange',()=>{updateLiveStatuses(main);void refreshAgenda();void heartbeat().then(refreshViewers);});
addEventListener('pagehide',()=>{navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({session,match:currentMatch,playing:false})],{type:'application/json'}));});
void render();
