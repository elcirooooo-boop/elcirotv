import {createPlayerFullscreen} from './fullscreen.js?v=20261114c';
import {createExternalPlayer} from './external-player.js?v=20261114c';
import {matchPath,matchIdFromPath,sharedSignal,matchShareData,copyShareLink,shareMatch} from './share.js';
import {matchSchedule,scheduleText,chronologicalEvents,scheduleDay,visibleAgendaEvents} from './schedule.js?v=20261112k';
import {teamBadges,handleBadgeError} from './team-badges.js?v=20261114b';
import {liveIndicator,updateLiveStatuses} from './live-status.js?v=20261109n';
import {requestJSON,apiURL} from './api-client.js?v=20261107h';
import {createPreparedPlayback} from './prepared-playback.js?v=20261107g';

document.addEventListener('error',handleBadgeError,true);
const main=document.querySelector('#main');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intro=(title,sub)=>`<section class="intro compact"><p class="eyebrow">EL CIRO TV</p><h1>${esc(title)}</h1><p>${esc(sub)}</p></section>`;
let playerGeneration=0,player,playerFullscreen,externalActive=false;
let updateMatchShare=()=>{};
let refreshListing=()=>{},agendaLoading=false;
let data,selected='',currentMatch='',tracking,counts=null,presenceQueue=Promise.resolve();
const session=crypto.randomUUID();
const phpAPI=document.querySelector('meta[name="api-runtime"]')?.content==='php';
async function api(path,options){return requestJSON(path,options,{php:phpAPI});}
const preparedPlayback=createPreparedPlayback((id,{excluded,refresh,signal})=>api('play?source='+encodeURIComponent(id)+'&exclude='+encodeURIComponent(excluded.join(','))+(refresh?'&refresh=1':''),{signal}));
function link(event){return matchPath(event);}
function scheduleMarkup(event){return matchSchedule(event).map(part=>`<span class="schedule-zone"><span class="schedule-country">${esc(part.label)}</span><time datetime="${esc(event.startsAt)}">${esc(part.date)} · ${esc(part.time)}</time></span>`).join('');}
function heartbeat(){
  const payload={session,match:currentMatch,playing:externalActive&&!document.hidden};
  presenceQueue=presenceQueue.catch(()=>{}).then(()=>api('presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).catch(()=>{});
  return presenceQueue;
}
function viewerLabel(id){return `<span class="viewer-count" data-viewers="${esc(id)}" title="Personas con la transmisión abierta, aproximadamente">${counts===null?'— viendo ahora':`${counts[id]||0} viendo ahora`}</span>`;}
async function refreshViewers(){if(document.hidden)return;try{const result=await api('viewers');counts=result.counts;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent=(counts[el.dataset.viewers]||0)+' viendo ahora';});}catch{counts=null;document.querySelectorAll('[data-viewers]').forEach(el=>{el.textContent='Conteo no disponible';});}}
function stop(){externalActive=false;playerFullscreen?.destroy();playerFullscreen=null;playerGeneration++;player?.destroy();player=null;selected='';}
function navigate(href){history.pushState(null,'',href);render();window.scrollTo(0,0);}
document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.origin===location.origin&&!a.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(a.pathname+a.search);}});
addEventListener('popstate',render);
async function load(){data=await api('agenda');}
function signalCards(signals){return signals.map((s,i)=>`<button class="channel-card signal-button" data-signal="${esc(s.id)}" aria-pressed="false"><span class="channel-option">Opción ${i+1}</span><h2>${esc(s.name)}</h2><span class="text-link">Ver aquí ↗</span></button>`).join('');}
async function play(signal,signals,{refresh=false}={}){
  stop();selected=signal.id;const generation=playerGeneration,identity=selected;
  updateMatchShare(signal);
  const section=document.querySelector('#videoSection'),status=document.querySelector('#signalStatus'),next=document.querySelector('#providerNext');
  const fullscreen=section.querySelector('#fullscreen'),retry=section.querySelector('#providerRetry');
  section.hidden=false;
  fullscreen.hidden=true;retry.hidden=true;next.hidden=true;

  document.querySelectorAll('[data-signal]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.signal===identity)));
  const active=()=>playerGeneration===generation&&selected===identity;
  status.textContent='Cargando reproductor externo del proveedor…';
  try{
    const source=await preparedPlayback.read(identity,{refresh});if(!active())return;
    if(source.transport!=='embed')throw Error('Esta señal no tiene un reproductor externo disponible.');
    const signalLabel=({index,total})=>signal.name+(total>1?' · Servidor '+(index+1)+' de '+total:'');
    player=createExternalPlayer({
      container:section.querySelector('.video-frame'),sources:source.sources||[{url:source.url}],name:signal.name,
      onOffline:()=>{if(active())status.textContent='Se perdió la conexión. Reintentaremos al volver internet.';},
      onChange:info=>{
        next.hidden=info.total<2;
        status.textContent=signalLabel(info)+' · Cargando…';
      },
      onLoad:info=>{if(active())status.textContent=signalLabel(info)+' · Toca reproducir dentro del vídeo.';},
      onSlow:info=>{
        if(active())status.textContent=signalLabel(info)+' · Está tardando en abrir. '+(info.total>1?'Puedes cambiar de servidor.':'Puedes recargar la señal.');
      },
    });
    fullscreen.hidden=false;retry.hidden=false;
    retry.onclick=()=>player?.reload();
    next.onclick=()=>player?.next();
    playerFullscreen=createPlayerFullscreen({section,button:fullscreen});
    externalActive=true;void heartbeat().then(refreshViewers);
  }catch(error){if(active())status.textContent=error.message||'No se pudo abrir el reproductor. Selecciona otro canal.';}
  if(active())section.scrollIntoView({behavior:'smooth',block:'start'});
}

function chooser(event,signals){
  main.innerHTML=`<a class="back-link" href="${event?'/':'/canales'}">← ${event?'Todos los partidos':'Todos los canales'}</a>${intro(event?.title||signals[0]?.name||'Canal',event?`${event.league} · ${scheduleText(event)}`:'Elige una señal para reproducir.')}${event?viewerLabel(event.id):''}<section id="videoSection" hidden><div class="video-wrap"><div class="video-frame"></div><button id="fullscreen" class="player-fullscreen" type="button" aria-label="Pantalla completa" title="Pantalla completa" hidden>Pantalla completa</button></div><p id="signalStatus" class="signal-status" role="status"></p><div class="status-actions"><button id="providerRetry" type="button" hidden>Recargar señal</button><button id="providerNext" type="button" hidden>Cambiar servidor</button></div></section><section class="match-channels"><div class="section-heading"><h2>Canales disponibles</h2><span>${signals.length} opciones</span></div><p class="player-note">${data.provider==='futbolvivo'?'Selecciona una señal para verla aquí. Si alguna está bloqueada, prueba otra opción del partido.':"Selecciona el canal con el que quieres ver "+(event?'este partido':'la transmisión')+"."}</p>${signals.length?`<div class="channel-grid">${signalCards(signals)}</div>`:'<div class="empty"><h2>Señales por anunciar</h2><p>Vuelve a consultar la agenda más tarde.</p></div>'}</section>`;
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
  const initial=event?sharedSignal(event,location.search)||signals[0]:signals[0];
  if(initial&&data.provider==='streamxhd'&&!document.querySelector('link[data-player-preconnect]')){
    const connection=document.createElement('link');
    connection.rel='preconnect';
    connection.href='https://streamxhd.sbs';
    connection.dataset.playerPreconnect='';
    document.head.append(connection);
  }
  if(initial&&data.provider!=='futbolvivo')void preparedPlayback.prepare(initial.id);
  main.querySelectorAll('[data-signal]').forEach(b=>{b.onfocus=()=>void preparedPlayback.prepare(b.dataset.signal);b.onclick=()=>play(signals.find(s=>s.id===b.dataset.signal),signals);});
}
function listing(channels=false){
  const leagueOptions=()=>'<option value="">Todas las competiciones</option>'+[...new Set(visibleAgendaEvents(data.events).map(e=>e.league))].map(l=>`<option>${esc(l)}</option>`).join('');
  main.innerHTML=intro(channels?'Tus canales.':'Tu próximo partido.',channels?'Las señales de los partidos y el catálogo de canales disponibles.':'Elige tu partido, selecciona un canal y disfruta.')+`<div class="toolbar"><label class="search"><input id="search" type="search" aria-label="Buscar partido o canal" placeholder="${channels?'Buscar canal…':'Equipo, liga o canal…'}"></label>${channels?'':`<select id="league" aria-label="Filtrar por competición">${leagueOptions()}</select>`}</div><div class="section-heading"><h2>${channels?'Canales':'Partidos disponibles'}</h2><span id="count"></span></div><div id="results"></div>${data.stale&&data.events.length?'<p role="status">Mostrando la última agenda disponible.</p>':''}`;
  const update=()=>{
    const term=main.querySelector('#search').value.toLocaleLowerCase(),league=main.querySelector('#league')?.value;
    const events=channels?[]:visibleAgendaEvents(data.events);
    const values=channels?data.channels.filter(c=>c.name.toLowerCase().includes(term)):chronologicalEvents(events.filter(e=>(!league||e.league===league)&&`${e.title} ${e.league} ${e.signals.map(s=>s.name).join(' ')}`.toLowerCase().includes(term)));
    main.querySelector('#count').textContent=values.length+(channels?' señales':' partidos');
    let previousDay='';
    main.querySelector('#results').innerHTML=values.length?(channels?`<div class="channel-grid">${values.map(c=>`<a class="channel-card" href="/canal/${c.id}"><h2>${esc(c.name)}</h2><span class="text-link">Elegir señal ↗</span></a>`).join('')}</div>`:`<div class="event-list">${values.map(e=>{const badges=teamBadges(e),day=scheduleDay(e);const heading=day.key!==previousDay?`<h3 class="event-day">${esc(day.label)}<span>Horario de Venezuela · de menor a mayor hora</span></h3>`:'';previousDay=day.key;return `${heading}<a class="event-row${badges?' has-teams':''}" href="${link(e)}"><span class="event-time">${scheduleMarkup(e)}</span>${badges}<div class="event-description"><h3>${esc(e.title)}</h3><p>${esc(e.league)}</p>${liveIndicator(e)}${viewerLabel(e.id)}</div><span class="event-channel-choice"><span>${e.signals.length} canales</span><span>›</span></span></a>`;}).join('')}</div>`):'<div class="empty"><h2>No hay resultados</h2><p>Prueba otra búsqueda o vuelve a consultar la agenda.</p></div>';
    if(!channels&&!events.length)main.querySelector('#results').innerHTML=`<div class="empty"><h2>Agenda pendiente de actualizar</h2><p>${data.stale?'La fuente no está disponible ahora.':'La fuente todavía no ha publicado los partidos de hoy.'} Puedes seguir viendo los canales disponibles.</p><a class="text-link" href="/canales">Ver canales ↗</a></div>`;
  };main.querySelector('#search').oninput=update;if(main.querySelector('#league'))main.querySelector('#league').onchange=update;update();
  refreshListing=()=>{const select=main.querySelector('#league');if(select){const value=select.value;select.innerHTML=leagueOptions();select.value=[...select.options].some(o=>o.value===value)?value:'';}update();};
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
    if(!tracking)tracking=setInterval(()=>{if(document.hidden&&!externalActive)return;void heartbeat().then(refreshViewers);},30000);
  }catch(error){main.innerHTML=intro('Vuelve a intentarlo.',error.message)+'<a class="back-link" href="/">← Ver partidos</a><button id="reload" class="primary-button">Actualizar agenda</button>';main.querySelector('#reload').onclick=()=>{data=null;void render();};}
}
setInterval(()=>updateLiveStatuses(main),15000);
async function refreshAgenda(){
  if(document.hidden||agendaLoading)return;
  agendaLoading=true;
  try{data=await api('agenda');for(const indicator of main.querySelectorAll('[data-provider-live]'))indicator.hidden=!data.events.find(e=>e.id===indicator.dataset.providerLive)?.providerLive;}catch{/* Retain the last working agenda during a temporary outage. */}
  finally{agendaLoading=false;if(data)refreshListing();}
}
setInterval(()=>void refreshAgenda(),60000);
document.addEventListener('visibilitychange',()=>{updateLiveStatuses(main);void refreshAgenda();void heartbeat().then(refreshViewers);});
addEventListener('pagehide',()=>{navigator.sendBeacon(apiURL('presence',phpAPI),new Blob([JSON.stringify({session,match:currentMatch,playing:false})],{type:'application/json'}));});
void render();

