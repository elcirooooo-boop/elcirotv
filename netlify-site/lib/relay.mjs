import {botChannels,channelSlug} from './catalog.mjs';
import {hash} from './core.mjs';
const registered=new Set(botChannels.map(channel=>channel.slug));
const players=new Set(['tvf90.com','la18hd.su','tarjetadigital.club','rojadirectatvplay.org','rojadirectatvmas.net'].flatMap(host=>[host,'www.'+host]));
export const service='https://web-production-dc68f.up.railway.app';

export function relayPlayback(signal,{refresh=false,now=Date.now}={}){
  let slug;
  if(registered.has(signal.slug))slug=signal.slug;
  else{
    let url;try{url=new URL(signal.url);}catch{return null;}
    if(!players.has(url.hostname)||!['http:','https:'].includes(url.protocol))return null;
    slug=channelSlug(signal);
    // Unknown event players must publish their exact stream identifier. Never
    // guess a different match/channel from a partial name.
    if(!registered.has(slug)&&!url.searchParams.get('stream'))return null;
  }
  if(!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(slug||''))return null;
  return {
    url:'/stream/live/'+encodeURIComponent(slug)+'/master.m3u8'+(refresh?'?refresh='+now():''),
    name:signal.name,sourceKey:hash('relay:'+slug),transport:'relay',
  };
}

export async function openRelaySession(signal,{refresh=false,fetch:load=globalThis.fetch}={}){
  const relay=relayPlayback(signal);
  if(!relay)return null;
  const path=new URL(relay.url,'https://site.invalid').pathname;
  const slug=path.split('/')[3];
  const response=await load(service+'/api/playback/'+encodeURIComponent(slug)+(refresh?'?refresh=1':''),{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('RELAY_UNAVAILABLE');
  const session=await response.json();
  if(typeof session.url!=='string'||!session.url.startsWith('/'))throw Error('INVALID_RELAY_SESSION');
  const target=new URL(session.url,service);
  if(target.origin!==service||target.pathname!=='/stream/live/'+slug+'/sub.m3u8'||!target.searchParams.get('sig'))throw Error('INVALID_RELAY_SESSION');
  return {...relay,url:target.pathname+target.search};
}
