const normalize=value=>String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function estimatedDuration(event){
  const context=normalize(`${event.league||''} ${event.title||''}`);
  if(/\bf1\b|formula 1|formula uno/.test(context)){
    if(/sprint/.test(context)&&!/clasific|qualif/.test(context))return 75;
    if(/practica|entrenamiento|libres|clasific|qualif/.test(context))return 90;
    return 150;
  }
  if(/\bnfl\b|futbol americano/.test(context))return 240;
  if(/\bnba\b|\bwnba\b|baloncesto|basket|euroliga/.test(context))return 180;
  if(/\bnhl\b|hockey/.test(context))return 180;
  if(/\bmlb\b|beisbol|baseball/.test(context))return 210;
  if(/tenis|tennis|\batp\b|\bwta\b|masters 1000|wimbledon|roland garros|australian open|us open/.test(context))return 240;
  if(/padel/.test(context))return 180;
  if(/golf|\bpga\b/.test(context))return 360;
  if(/boxeo|boxing|knockout|bxstrs|\bufc\b|\bmma\b/.test(context))return 240;
  if(/voleibol|volleyball|rugby/.test(context))return 150;
  if(/futbol sala|futsal|balonmano|handball/.test(context))return 100;
  if(/motogp|automovilismo|ciclismo/.test(context))return 180;
  // Football includes the break, added time, and a margin for stoppages.
  return 135;
}
export function liveWindow(event){
  const start=Date.parse(event.startsAt);
  return Number.isFinite(start)?{start,end:start+estimatedDuration(event)*60000}:null;
}
export function isEstimatedLive(event,now=Date.now()){
  const window=liveWindow(event);
  return !!window&&now>=window.start&&now<window.end;
}
export function liveIndicator(event,now=Date.now()){
  if(typeof event.providerLive==='boolean')return `<span class="event-live" data-provider-live="${String(event.id).replace(/[^a-f0-9]/g,'')}" title="Estado publicado por el proveedor"${event.providerLive?'':' hidden'}><span class="live-pill">EN VIVO</span></span>`;
  const window=liveWindow(event);if(!window)return '';
  const ends=[['Venezuela','America/Caracas'],['España','Europe/Madrid']].map(([label,timeZone])=>`${label}: ${new Intl.DateTimeFormat('es',{timeZone,day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(window.end)}`).join(' · ');
  return `<span class="event-live" data-live-start="${window.start}" data-live-end="${window.end}" title="Según el horario de inicio. Final estimado — ${ends}"${isEstimatedLive(event,now)?'':' hidden'}><span class="live-pill">EN VIVO</span><span class="live-estimate">horario estimado</span></span>`;
}
export function updateLiveStatuses(root,now=Date.now()){
  for(const indicator of root.querySelectorAll('[data-live-start][data-live-end]')){
    const start=Number(indicator.dataset.liveStart),end=Number(indicator.dataset.liveEnd);
    indicator.hidden=!(Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end);
  }
}
