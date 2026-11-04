export function matchPath(event){
  const name=event.title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120).replace(/-$/,'')||'partido';
  return '/partido/'+encodeURIComponent(event.id)+'/'+name;
}
export function matchIdFromPath(path){
  const match=path.match(/^\/partido\/([^/]+)(?:\/[^/]+)?\/?$/);
  if(!match)return null;
  try{return decodeURIComponent(match[1]);}catch{return null;}
}
export function sharedSignal(event,search){
  const id=new URLSearchParams(search).get('canal');
  return id?event.signals.find(signal=>signal.id===id)||null:null;
}
export function matchShareData(event,origin,signal){
  const url=new URL(matchPath(event),origin);
  const channel=event.signals?.find(s=>s.id===signal?.id);
  if(channel)url.searchParams.set('canal',channel.id);
  return {
    title:event.title+(channel?' · '+channel.name:'')+' · El Ciro TV',
    text:event.title+' · '+event.league+' · '+event.time+(channel?' · Ver por '+channel.name:''),
    url:url.href
  };
}
export async function copyShareLink(data,platform=navigator){
  try{
    if(!platform.clipboard?.writeText)return 'manual';
    await platform.clipboard.writeText(data.url);return 'copied';
  }catch{return 'manual';}
}
export async function shareMatch(data,platform=navigator){
  if(platform.share){
    try{await platform.share(data);return 'shared';}
    catch(error){if(error.name==='AbortError')return 'cancelled';}
  }
  return copyShareLink(data,platform);
}
