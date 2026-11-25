import {scheduleText} from './schedule.js';
function shortId(id){
  if(!/^[a-f0-9]{24}$/i.test(id))return null;
  const bytes=id.match(/../g).map(pair=>String.fromCharCode(parseInt(pair,16))).join('');
  return btoa(bytes).replace(/\+/g,'-').replace(/\//g,'_');
}
function fullId(token){
  if(!/^[A-Za-z0-9_-]{16}$/.test(token))return null;
  const bytes=atob(token.replace(/-/g,'+').replace(/_/g,'/'));
  return Array.from(bytes,byte=>byte.charCodeAt(0).toString(16).padStart(2,'0')).join('');
}
function legacyId(value){
  if(!value)return null;
  try{return decodeURIComponent(value);}catch{return null;}
}
export function matchPath(event){
  const token=shortId(event.id);
  return token?'/p/'+token:'/partido/'+encodeURIComponent(event.id);
}
export function matchIdFromPath(path){
  const compact=path.match(/^\/p\/([^/]+)\/?$/);
  return compact?fullId(compact[1]):legacyId(path.match(/^\/partido\/([^/]+)(?:\/[^/]+)?\/?$/)?.[1]);
}
export function channelPath(channel){
  const token=shortId(channel.id);
  return token?'/c/'+token:'/canal/'+encodeURIComponent(channel.id);
}
export function channelIdFromPath(path){
  const compact=path.match(/^\/c\/([^/]+)\/?$/);
  return compact?fullId(compact[1]):legacyId(path.match(/^\/canal\/([^/]+)\/?$/)?.[1]);
}
export function hasSharedSignal(search){
  const params=new URLSearchParams(search);
  return params.has('c')||params.has('canal');
}
export function sharedSignal(event,search){
  const params=new URLSearchParams(search);
  const id=params.has('c')?fullId(params.get('c')):params.get('canal');
  return id?event.signals.find(signal=>signal.id===id)||null:null;
}
export function matchShareData(event,origin,signal){
  const url=new URL(matchPath(event),origin);
  const channel=event.signals?.find(s=>s.id===signal?.id);
  if(channel){
    const token=shortId(channel.id);
    url.searchParams.set(token?'c':'canal',token||channel.id);
  }
  return {
    title:event.title+(channel?' · '+channel.name:'')+' · El Ciro TV',
    text:event.title+' · '+event.league+' · '+scheduleText(event)+(channel?' · Ver por '+channel.name:''),
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
