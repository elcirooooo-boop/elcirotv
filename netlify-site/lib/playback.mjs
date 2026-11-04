import {hash} from './core.mjs';
import {resolve,request,read} from './network.mjs';
const healthy=new Map();
const cached=new Map(),inflight=new Map();
async function probe(resolved,options={}) {
  let target=resolved.url;
  for(let depth=0;depth<3;depth++){
    const {response,url}=await request(target,resolved.referer,'',0,options);
    if(response.statusCode!==200){response.resume();throw Error('SOURCE_HTTP');}
    const text=await read(response,1000000);
    const lines=text.split(/\r?\n/).filter(line=>line.trim()&&!line.startsWith('#'));
    if(!text.trimStart().startsWith('#EXTM3U')||!lines.length)throw Error('INVALID_MANIFEST');
    if(text.includes('#EXT-X-STREAM-INF')){target=new URL(lines[0],url).href;continue;}
    // Validate a recent live segment, matching the player's live starting position.
    const segment=new URL(lines[Math.max(0,lines.length-3)],url).href;
    const media=(await request(segment,resolved.referer,'bytes=0-187',0,options)).response;
    if(media.statusCode<200||media.statusCode>=300||/html|javascript|json|svg/i.test(String(media.headers['content-type']||''))){media.resume();throw Error('SEGMENT_HTTP');}
    let received=false;
    for await(const chunk of media){received=chunk.length>0;break;}
    if(!received)throw Error('EMPTY_SEGMENT');
    return;
  }
  throw Error('PLAYLIST_DEPTH');
}
const runtime={resolve,probe};
export async function selectPlayback(signal,excluded=[],deps=runtime,{refresh=false,now=Date.now,hedgeDelay=600,sourceTimeout=8000}={}) {
  const sources=signal.sources||[{id:hash(signal.url),url:signal.url}];
  const previous=cached.get(signal.id);
  if(!refresh&&previous?.deps===deps&&previous.until>now()&&!excluded.includes(previous.result.sourceKey)&&sources.some(s=>s.id===previous.result.sourceKey&&s.url===previous.input))return previous.result;
  if(refresh)cached.delete(signal.id);
  const key=signal.id+'|'+[...excluded].sort().join(',')+'|'+refresh;
  if(inflight.get(key)?.deps===deps)return inflight.get(key).promise;
  const last=healthy.get(signal.id);
  const ordered=sources.filter(s=>!excluded.includes(s.id)).sort((a,b)=>(b.id===last?.id?1:0)-(a.id===last?.id?1:0));
  // Start with the last healthy provider, then race at most one alternative.
  // Abort losing work, including its sockets, once a validated source wins.
  const promise=new Promise((accept,reject)=>{
    let next=0,active=0,settled=false,hedge;
    const attempts=new Set();
    const finish=(error,result)=>{
      if(settled)return;settled=true;clearTimeout(hedge);
      for(const attempt of attempts){clearTimeout(attempt.timer);attempt.controller.abort();}
      if(error)reject(error);else accept(result);
    };
    function launch(){
      if(settled||active>=2)return;
      if(next>=ordered.length){if(!active)finish(Error('CHANNEL_UNAVAILABLE'));return;}
      const source=ordered[next++],controller=new AbortController(),attempt={controller};
      attempts.add(attempt);active++;
      const deadline=new Promise((_,fail)=>{attempt.timer=setTimeout(()=>{controller.abort();fail(Error('SOURCE_TIMEOUT'));},sourceTimeout);});
      const work=(async()=>{const resolved=await deps.resolve(source.url,{signal:controller.signal,timeout:sourceTimeout});await deps.probe(resolved,{signal:controller.signal,timeout:sourceTimeout});return {...resolved,sourceKey:source.id};})();
      void Promise.race([work,deadline]).then(result=>{
        if(settled)return;
        healthy.set(signal.id,{id:source.id});
        cached.set(signal.id,{deps,input:source.url,result,until:now()+15000});
        for(const map of [healthy,cached])if(map.size>1000)map.delete(map.keys().next().value);
        finish(null,result);
      },()=>{
        clearTimeout(attempt.timer);controller.abort();attempts.delete(attempt);active--;
        if(!settled)launch();
      });
    }
    launch();
    if(!settled)hedge=setTimeout(launch,hedgeDelay);
  });
  const entry={deps,promise};inflight.set(key,entry);
  try{return await promise;}finally{if(inflight.get(key)===entry)inflight.delete(key);}
}
