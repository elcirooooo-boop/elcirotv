import {isEstimatedLive} from './live-status.js?v=20261109n';

const zones=[['Venezuela','America/Caracas'],['España peninsular','Europe/Madrid']];
const agendaDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'});
function agendaDayKey(date){
  const parts=Object.fromEntries(agendaDay.formatToParts(date).map(({type,value})=>[type,value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function matchSchedule(event){
  const start=new Date(event.startsAt);
  if(!Number.isFinite(start.getTime()))return [];
  return zones.map(([label,timeZone])=>({
    label,timeZone,
    date:new Intl.DateTimeFormat('es',{timeZone,day:'numeric',month:'short'}).format(start),
    time:new Intl.DateTimeFormat('es',{timeZone,hour:'numeric',minute:'2-digit',hour12:true}).format(start),
  }));
}
export function scheduleText(event){
  return matchSchedule(event).map(part=>`${part.label}: ${part.date}, ${part.time}`).join(' · ');
}

export function chronologicalEvents(events){
  const time=event=>{const t=Date.parse(event.startsAt);return Number.isFinite(t)?t:Infinity;};
  return [...events].sort((a,b)=>time(a)-time(b)||String(a.title||'').localeCompare(String(b.title||''),'es'));
}
export function visibleAgendaEvents(events,now=Date.now()){
  const today=agendaDayKey(now);
  return events.filter(event=>{
    const start=Date.parse(event.startsAt);
    if(!Number.isFinite(start)||agendaDayKey(start)>=today)return true;
    return event.providerLive??isEstimatedLive(event,now);
  });
}

export function scheduleDay(event){
  const date=new Date(event.startsAt);if(!Number.isFinite(date.getTime()))return {key:'unknown',label:'Fecha por confirmar'};
  return {key:agendaDayKey(date),label:new Intl.DateTimeFormat('es',{timeZone:'America/Caracas',weekday:'long',day:'numeric',month:'long'}).format(date)};
}
