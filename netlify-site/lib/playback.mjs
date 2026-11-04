import {hash} from './core.mjs';
import {resolve,request,read} from './network.mjs';
const healthy=new Map();
async function probe(resolved) {
  const {response}=await request(resolved.url,resolved.referer);
  if(response.statusCode!==200){response.resume();throw Error('SOURCE_HTTP');}
  const text=await read(response,1000000);
  if(!text.trimStart().startsWith('#EXTM3U')||!text.split(/\r?\n/).some(line=>line.trim()&&!line.startsWith('#')))throw Error('INVALID_MANIFEST');
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
