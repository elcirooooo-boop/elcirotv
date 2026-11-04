import {hash} from './core.mjs';
import {resolve,request,read} from './network.mjs';
const healthy=new Map();
async function probe(resolved) {
  let target=resolved.url;
  for(let depth=0;depth<3;depth++){
    const {response,url}=await request(target,resolved.referer);
    if(response.statusCode!==200){response.resume();throw Error('SOURCE_HTTP');}
    const text=await read(response,1000000);
    const lines=text.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
    if(!text.trimStart().startsWith('#EXTM3U')||!lines.length)throw Error('INVALID_MANIFEST');
    if(text.includes('#EXT-X-STREAM-INF')){target=new URL(lines[0],url).href;continue;}
    // Validate a recent live segment, matching the player's live starting position.
    const segment=new URL(lines[Math.max(0,lines.length-3)],url).href;
    const media=(await request(segment,resolved.referer,'bytes=0-187')).response;
    if(media.statusCode<200||media.statusCode>=300||/html|javascript|json|svg/i.test(String(media.headers['content-type']||''))){media.resume();throw Error('SEGMENT_HTTP');}
    let received=false;
    for await(const chunk of media){received=chunk.length>0;break;}
    if(!received)throw Error('EMPTY_SEGMENT');
    return;
  }
  throw Error('PLAYLIST_DEPTH');
}
export async function selectPlayback(signal,excluded=[],deps={resolve,probe}) {
  const sources=signal.sources||[{id:hash(signal.url),url:signal.url}];
  const last=healthy.get(signal.id);
  const ordered=[...sources].sort((a,b)=>(b.id===last?.id?1:0)-(a.id===last?.id?1:0));
  for(const source of ordered){
    if(excluded.includes(source.id))continue;
    try{
      const resolved=await deps.resolve(source.url);
      await deps.probe(resolved);
      healthy.set(signal.id,{id:source.id});
      if(healthy.size>1000)healthy.delete(healthy.keys().next().value);
      return {...resolved,sourceKey:source.id};
    }catch{/* Try another registered source of this same channel only. */}
  }
  throw Error('CHANNEL_UNAVAILABLE');
}
