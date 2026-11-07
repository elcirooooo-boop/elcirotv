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
