import {matchPath,matchIdFromPath,matchShareData,copyShareLink,shareMatch} from './share.js';
import {matchSchedule,scheduleText,chronologicalEvents,scheduleDay,visibleAgendaEvents} from './schedule.js?v=20261112k';
import {teamBadges,handleBadgeError} from './team-badges.js?v=20261114b';
import {liveIndicator,updateLiveStatuses} from './live-status.js?v=20261109n';
import {requestJSON} from './api-client.js?v=20261107h';

document.addEventListener('error',handleBadgeError,true);
const main=document.querySelector('#main');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intro=(title,sub)=>`<section class="intro compact"><p class="eyebrow">EL CIRO TV</p><h1>${esc(title)}</h1><p>${esc(sub)}</p></section>`;
let refreshListing=()=>{},agendaLoading=false;
let data;
const phpAPI=document.querySelector('meta[name="api-runtime"]')?.content==='php';
async function api(path,options){return requestJSON(path,options,{php:phpAPI});}
function link(event){return matchPath(event);}
function scheduleMarkup(event){return matchSchedule(event).map(part=>`<span class="schedule-zone"><span class="schedule-country">${esc(part.label)}</span><time datetime="${esc(event.startsAt)}">${esc(part.date)} · ${esc(part.time)}</time></span>`).join('');}
function navigate(href){history.pushState(null,'',href);render();window.scrollTo(0,0);}
document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.origin===location.origin&&!a.hash&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&event.button===0){event.preventDefault();navigate(a.pathname+a.search);}});
addEventListener('popstate',render);
async function load(){data=await api('agenda');}
function showMatch(event){
  const destination=new URL(event.watchUrl);
  if(destination.origin!=='https://streampk.net')throw Error('El enlace del partido no está disponible.');
  main.innerHTML=`<a class="back-link" href="/">← Todos los partidos</a>${intro(event.title,`${event.league} · ${scheduleText(event)}`)}<a id="watch" class="primary-button" href="${esc(destination.href)}" target="_blank" rel="noopener noreferrer">Ver partido en Streampk.net ↗</a>`;
  main.querySelector('.intro h1').insertAdjacentHTML('afterend',liveIndicator(event));
  const badges=teamBadges(event);
  if(badges)main.querySelector('.intro h1').insertAdjacentHTML('beforebegin',`<div class="match-team-heading">${badges}</div>`);
  const shareData=matchShareData(event,location.origin);
  const sharing=document.createElement('section');
  sharing.className='match-sharing';
  sharing.setAttribute('aria-label','Compartir este partido');
  sharing.innerHTML=`<div class="share-actions"><button type="button" data-share>Compartir partido ↗</button><button type="button" data-copy>Copiar enlace</button></div><p class="share-feedback" role="status" aria-live="polite"></p><label class="share-manual" hidden>Enlace directo al partido<input type="url" readonly aria-label="Enlace directo al partido"></label>`;
  const feedback=sharing.querySelector('.share-feedback'),manual=sharing.querySelector('.share-manual'),input=sharing.querySelector('input');
  input.value=shareData.url;
  const report=result=>{
    if(!sharing.isConnected)return;
    feedback.textContent=result==='copied'?'Enlace del partido copiado.':result==='manual'?'Selecciona el enlace y cópialo para compartirlo.':'';
    manual.hidden=result!=='manual';if(result==='manual'){input.focus();input.select();}
  };
  sharing.querySelector('[data-share]').onclick=async()=>report(await shareMatch(shareData));
  sharing.querySelector('[data-copy]').onclick=async()=>report(await copyShareLink(shareData));
  main.querySelector('#watch').before(sharing);
  document.title=shareData.title;
}

function channelCatalog(){
  main.innerHTML=intro('Canales 24/7','Streampk.net no ofrece un catálogo público de canales 24/7.')+'<a class="back-link" href="/">← Ver partidos</a>';
}

function listing(){
  const leagueOptions=()=>'<option value="">Todas las competiciones</option>'+[...new Set(visibleAgendaEvents(data.events).map(e=>e.league))].map(l=>`<option>${esc(l)}</option>`).join('');
  main.innerHTML=intro('Tu próximo partido.','Consulta la agenda de Streampk.net y abre el partido que quieras ver.')+`<div class="toolbar"><label class="search"><input id="search" type="search" aria-label="Buscar partido" placeholder="Equipo o liga…"></label><select id="league" aria-label="Filtrar por competición">${leagueOptions()}</select></div><div class="section-heading"><h2>Partidos disponibles</h2><span id="count"></span></div><div id="results"></div>${data.stale&&data.events.length?'<p role="status">Mostrando la última agenda disponible.</p>':''}`;
  const update=()=>{
    const term=main.querySelector('#search').value.toLocaleLowerCase(),league=main.querySelector('#league')?.value;
    const events=visibleAgendaEvents(data.events);
    const values=chronologicalEvents(events.filter(e=>(!league||e.league===league)&&`${e.title} ${e.league}`.toLowerCase().includes(term)));
    main.querySelector('#count').textContent=values.length+(values.length===1?' partido':' partidos');
    let previousDay='';
    main.querySelector('#results').innerHTML=values.length?`<div class="event-list">${values.map(e=>{const badges=teamBadges(e),day=scheduleDay(e);const heading=day.key!==previousDay?`<h3 class="event-day">${esc(day.label)}<span>Horario de Venezuela · de menor a mayor hora</span></h3>`:'';previousDay=day.key;return `${heading}<a class="event-row${badges?' has-teams':''}" href="${link(e)}"><span class="event-time">${scheduleMarkup(e)}</span>${badges}<div class="event-description"><h3>${esc(e.title)}</h3><p>${esc(e.league)}</p>${liveIndicator(e)}</div><span class="event-channel-choice"><span>Ver partido</span><span>›</span></span></a>`;}).join('')}</div>`:'<div class="empty"><h2>No hay resultados</h2><p>Prueba otra búsqueda o vuelve a consultar la agenda.</p></div>';
    if(!events.length)main.querySelector('#results').innerHTML=`<div class="empty"><h2>Agenda pendiente de actualizar</h2><p>${data.stale?'La fuente no está disponible ahora.':'La fuente todavía no ha publicado los partidos de hoy.'}</p></div>`;
  };main.querySelector('#search').oninput=update;if(main.querySelector('#league'))main.querySelector('#league').onchange=update;update();
  refreshListing=()=>{const select=main.querySelector('#league');if(select){const value=select.value;select.innerHTML=leagueOptions();select.value=[...select.options].some(o=>o.value===value)?value:'';}update();};
}
async function render(){
  refreshListing=()=>{};
  document.title='El Ciro · Deportes en directo';
  document.querySelectorAll('.main-nav a').forEach(a=>{if(a.pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  try{
    if(!data)await load();
    if(location.pathname==='/')listing();
    else if(location.pathname==='/canales'||location.pathname.startsWith('/canal/'))channelCatalog();
    else if(location.pathname.startsWith('/partido/')){
      const requestedId=matchIdFromPath(location.pathname);
      const event=data.events.find(e=>e.id===requestedId)||data.events.find(e=>e.legacyIds?.includes(requestedId));
      if(!event)throw Error('Este partido ya no está publicado en la agenda de hoy.');
      showMatch(event);
    }else throw Error('No encontramos esta página.');
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
document.addEventListener('visibilitychange',()=>{updateLiveStatuses(main);void refreshAgenda();});
void render();
