const zones=[['Venezuela','America/Caracas'],['España peninsular','Europe/Madrid']];
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
export function scheduleDay(event){
  const date=new Date(event.startsAt);if(!Number.isFinite(date.getTime()))return {key:'unknown',label:'Fecha por confirmar'};
  return {key:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),label:new Intl.DateTimeFormat('es',{timeZone:'America/Caracas',weekday:'long',day:'numeric',month:'long'}).format(date)};
}

export function currentAndUpcomingEvents(events,now=Date.now()){
  const today=scheduleDay({startsAt:new Date(now).toISOString()}).key;
  return events.filter(event=>{const day=scheduleDay(event).key;return day!=='unknown'&&day>=today;});
}
