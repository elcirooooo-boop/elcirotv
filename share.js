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
export function nameSlug(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100).replace(/-$/,'');
}
function signalSlug(signal){
  const name=nameSlug(signal.name);
  const stream=nameSlug(new URLSearchParams((signal.playerUrl||'').split('?')[1]).get('stream'));
  if(!name)return stream;
  return stream&&stream.replace(/-/g,'')!==name.replace(/-/g,'')?name+'-'+stream:name;
}
function namedPath(prefix,slug,item,ambiguous){
  const token=shortId(item.id);
  if(!slug)return prefix+'/'+(token||encodeURIComponent(item.id));
  return prefix+'/'+slug+(ambiguous&&token?'/'+token:'');
}
export function matchPath(event,events=[]){
  const slug=nameSlug(event.title);
  const duplicate=events.some(other=>other.id!==event.id&&nameSlug(other.title)===slug);
  return namedPath('/p',slug,event,duplicate);
}
export function matchFromPath(events,path){
  const short=path.match(/^\/p\/([^/]+)(?:\/([^/]+))?\/?$/);
  const legacy=path.match(/^\/partido\/([^/]+)(?:\/[^/]+)?\/?$/);
  const id=short?fullId(short[2]||short[1]):legacyId(legacy?.[1]);
  const byID=id&&(events.find(event=>event.id===id)||events.find(event=>event.legacyIds?.includes(id)));
  if(byID)return byID;
  if(!short||short[2])return null;
  const matches=events.filter(event=>nameSlug(event.title)===short[1]);
  return matches.length===1?matches[0]:null;
}
export function channelPath(channel,channels=[]){
  const slug=signalSlug(channel);
  const duplicate=channels.some(other=>other.id!==channel.id&&other.playerUrl!==channel.playerUrl&&signalSlug(other)===slug);
  return namedPath('/c',slug,channel,duplicate);
}
export function channelFromPath(channels,path){
  const short=path.match(/^\/c\/([^/]+)(?:\/([^/]+))?\/?$/);
  const legacy=path.match(/^\/canal\/([^/]+)\/?$/);
  const id=short?fullId(short[2]||short[1]):legacyId(legacy?.[1]);
  const byID=id&&channels.find(channel=>channel.id===id);
  if(byID)return byID;
  if(!short||short[2])return null;
  const matches=channels.filter(channel=>signalSlug(channel)===short[1]);
  return matches.length&&matches.every(channel=>channel.playerUrl===matches[0].playerUrl)?matches[0]:null;
}
export function hasSharedSignal(search){
  const params=new URLSearchParams(search);
  return params.has('c')||params.has('canal');
}
export function sharedSignal(event,search){
  const params=new URLSearchParams(search);
  const token=params.get('c');
  const id=token?fullId(token):params.get('canal');
  const byID=id&&event.signals.find(signal=>signal.id===id);
  if(byID)return byID;
  const matches=token?event.signals.filter(signal=>signalSlug(signal)===token):[];
  return matches.length===1?matches[0]:null;
}
export function matchShareData(event,origin,signal,events=[]){
  const url=new URL(matchPath(event,events),origin);
  const channel=event.signals?.find(s=>s.id===signal?.id);
  if(channel){
    const slug=signalSlug(channel);
    const unique=slug&&event.signals.filter(signal=>signalSlug(signal)===slug).length===1;
    const token=unique?slug:shortId(channel.id);
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
