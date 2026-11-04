import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
import {botChannels,channelSlug,botSourceURLs} from './catalog.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex').slice(0,24);
export const dayOf = date => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Caracas',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const attrs = value => value?.attributes || value || {};
const rows = value => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
export function unwrap(value) {
  try {
    const url = new URL(String(value || '').replaceAll('&amp;','&'), 'https://rojadirectatvplay.org/');
    if (!value) return null;
    const encoded = url.searchParams.get('r');
    const decoded = encoded ? new URL(Buffer.from(encoded,'base64').toString()) : url;
    return ['http:','https:'].includes(decoded.protocol) ? decoded.href : null;
  } catch { return null; }
}
export function normalize(payload, now=new Date(),{utcOffset='-05:00'}={}) {
  const raw = Array.isArray(payload) ? payload : payload?.data ?? payload?.events;
  if (!Array.isArray(raw)) throw Error('INVALID_AGENDA');
  const events=[];
  for (const row of raw) {
    const a=attrs(row), title=String(a.diary_description || a.title || '').trim();
    const hour=String(a.diary_hour || a.time || ''), date=String(a.date_diary || a.date || dayOf(now)).slice(0,10);
    // Both published agenda feeds use UTC-5 wall times. Explicit ISO offsets
    // remain authoritative; never let the server's timezone interpret a date.
    const timestamp=hour.includes('T')?hour:`${date}T${(hour || '12:00:00').slice(0,8)}`;
    const start=new Date(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(timestamp)?timestamp:timestamp+utcOffset);
    if (!title || !Number.isFinite(start.getTime()) || dayOf(start)!==dayOf(now)) continue;
    const colon=title.indexOf(':'), league=colon<0 ? String(a.sport || 'Deportes') : title.slice(0,colon).trim(), match=colon<0 ? title : title.slice(colon+1).trim();
    const id=hash(`${start.toISOString()}|${slug(league)}|${slug(match)}`), seen=new Set(), signals=[];
    for (const [i,rawEmbed] of rows(a.embeds).entries()) {
      const embed=attrs(rawEmbed), url=unwrap(embed.embed_iframe || embed.iframe || embed.url);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      // Identity includes the full published URL: same slug may have several providers.
      signals.push({id:hash(url),name:String(embed.embed_name || embed.name || `Opción ${i+1}`).slice(0,100),url,lang:String(embed.lang || '')});
    }
    const previous=new Date(hour.includes('T')?hour:`${date}T${(hour || '12:00:00').slice(0,8)}${'diary_description' in a?'-05:00':'Z'}`);
    const legacyIds=Number.isFinite(previous.getTime())&&previous.getTime()!==start.getTime()?[hash(`${previous.toISOString()}|${slug(league)}|${slug(match)}`)]:[];
    events.push({id,legacyIds,title:match,league,startsAt:start.toISOString(),time:hour ? start.toLocaleTimeString('en-GB',{timeZone:'America/Caracas',hour:'2-digit',minute:'2-digit'}) : '--:--',signals:withAlternatives(signals)});
  }
  return events;
}
export function withAlternatives(signals) {
  return signals.map(signal=>{
    const slug=channelSlug(signal),urls=[...botSourceURLs(slug),...(signal.sources||[]).map(source=>source.url),signal.url];
    return {...signal,sources:[...new Set(urls)].map(url=>({id:hash(url),url}))};
  });
}
// Only pool players actually published by the feeds, with an exact stream ID.
// Similar labels, regional variants and numbered channels are never inferred.
function publishedChannel(signal) {
  try {
    const url=new URL(signal.url),stream=url.searchParams.get('stream');
    if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    const host=url.hostname.replace(/^www\./,'');
    if(!(host==='tvf90.com'&&/^\/(?:5|1|plus1)\.php$/.test(url.pathname))&&!(host==='la18hd.su'&&url.pathname==='/vivo/canal.php'))return null;
    return /^[a-z0-9_-]{1,80}$/.test(stream||'')?stream:null;
  }catch{return null;}
}
export function withPublishedAlternatives(signals,published=signals) {
  const channels=new Map();
  for(const signal of published){
    const key=publishedChannel(signal);if(!key)continue;
    if(!channels.has(key))channels.set(key,new Set());
    channels.get(key).add(signal.url);
  }
  return withAlternatives(signals.map(signal=>{
    const urls=channels.get(publishedChannel(signal));
    if(!urls)return signal;
    return {...signal,sources:[...(signal.sources||[]),...[...urls].map(url=>({id:hash(url),url}))]};
  }));
}
export function catalogSignals(){
  return withAlternatives(botChannels.map(channel=>({id:hash('catalog:'+channel.slug),name:channel.name,slug:channel.slug,url:botSourceURLs(channel.slug)[0],lang:'Español'})));
}
export function merge(feeds) {
  const events=new Map();
  for (const event of feeds.flat()) {
    const existing=events.get(event.id);
    if (!existing) events.set(event.id,{...event,signals:[...event.signals]});
    else {
      existing.legacyIds=[...new Set([...(existing.legacyIds||[]),...(event.legacyIds||[])])];
      for (const signal of event.signals) if(!existing.signals.some(s=>s.id===signal.id)) existing.signals.push(signal);
    }
  }
  const merged=[...events.values()],published=merged.flatMap(event=>event.signals);
  return merged.map(event=>({...event,signals:withPublishedAlternatives(event.signals,published)})).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.title.localeCompare(b.title));
}
export function publicAgenda(data) {
  const hide = ({url,sources,...signal})=>signal;
  const channels=new Map(catalogSignals().map(signal=>[signal.id,hide(signal)]));
  const events=data.events.map(event=>({...event,signals:event.signals.map(s=>{channels.set(s.id,hide(s));return hide(s);})}));
  return {day:data.day,updatedAt:data.updatedAt,stale:!!data.stale,events,channels:[...channels.values()]};
}
function signingKey() {
  const key=process.env.HLS_PROXY_SECRET;
  if (!key || key.length<32) throw Error('HLS_PROXY_SECRET_REQUIRED');
  return key;
}
export function grant(url,referer='',expiry=Math.floor(Date.now()/1000)+21600,key=signingKey()) {
  const payload=Buffer.from(JSON.stringify({url,referer,expiry})).toString('base64url');
  return payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
export function verify(token,key=signingKey()) {
  if (typeof token!=='string'||token.length>12000) throw Error('INVALID_GRANT');
  const [payload,sig,extra]=token.split('.');
  const expected=createHmac('sha256',key).update(payload || '').digest();
  const actual=Buffer.from(sig || '','base64url');
  if(extra || actual.length!==expected.length || !timingSafeEqual(expected,actual)) throw Error('INVALID_GRANT');
  const value=JSON.parse(Buffer.from(payload,'base64url').toString());
  if(!Number.isFinite(value.expiry)||value.expiry< Date.now()/1000 || typeof value.url!=='string' || typeof value.referer!=='string')throw Error('EXPIRED_GRANT');
  return value;
}
export function manifest(text,base,referer,expiry,key=signingKey()) {
  if(!text.trimStart().startsWith('#EXTM3U')||text.length>1000000)throw Error('INVALID_MANIFEST');
  const local=value=>'/api/media?t='+encodeURIComponent(grant(new URL(value,base).href,referer,expiry,key));
  return text.split(/\r?\n/).map(line=>line.trim()&&!line.startsWith('#') ? local(line.trim()) : line.replace(/URI="([^"]+)"/g,(_,uri)=>`URI="${local(uri)}"`)).join('\n');
}
