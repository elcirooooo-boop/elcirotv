import {resolve,request,read,safeURL} from './network.mjs';
const players=new Set(['tvf90.com','www.tvf90.com','la18hd.su','www.la18hd.su']);
const authorization=new Set(['token','auth','expires','expiry','signature','sig','hdntl','hdnts']);
function identity(url){
  const query=[...url.searchParams].filter(([key])=>!authorization.has(key.toLowerCase())).sort(([a,av],[b,bv])=>a.localeCompare(b)||av.localeCompare(bv));
  return url.pathname+'?'+JSON.stringify(query);
}
export async function refreshDeniedMedia(permission,range='',deps={resolve,request,read}){
  try{
    const player=safeURL(permission.referer),original=safeURL(permission.url);
    if(!players.has(player.hostname)||!/^[-a-z0-9_]{1,80}$/i.test(player.searchParams.get('stream')||''))return null;
    if(!/\.(m3u8|ts|m4s|aac)$/i.test(original.pathname))return null;
    const options={signal:AbortSignal.timeout(8000),timeout:5000};
    // Obtain a normal, fresh public-player session in this same invocation.
    // Never reuse a denied token, change channels, or guess a segment URL.
    const fresh=await deps.resolve(player.href,options);
    let target=safeURL(fresh.url);
    if(/\.m3u8$/i.test(original.pathname)){
      if(identity(original)!==identity(target))return null;
      return {...await deps.request(target.href,fresh.referer,range,0,options),referer:fresh.referer};
    }
    for(let depth=0;depth<3;depth++){
      const upstream=await deps.request(target.href,fresh.referer,'',0,options);
      if(upstream.response.statusCode!==200){upstream.response.resume();return null;}
      const text=await deps.read(upstream.response,1000000);
      if(!text.trimStart().startsWith('#EXTM3U'))return null;
      const entries=text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')).map(line=>safeURL(new URL(line,upstream.url).href));
      if(text.includes('#EXT-X-STREAM-INF')){if(!entries.length)return null;target=entries[0];continue;}
      const matches=entries.filter(entry=>identity(entry)===identity(original));
      if(matches.length!==1)return null;
      return {...await deps.request(matches[0].href,fresh.referer,range,0,options),referer:fresh.referer};
    }
  }catch{/* Leave an unavailable source unavailable; client recovery is bounded. */}
  return null;
}
