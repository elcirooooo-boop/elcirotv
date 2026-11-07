// Prepare only the selected/first channel's metadata, never video fragments.
export function createPreparedPlayback(fetchSource,{now=Date.now,timers=globalThis,ttl=30000}={}){
  const entries=new Map();
  function prepare(id){
    for(const [key,value] of entries)if(value.until<=now())entries.delete(key);
    if(entries.has(id))return entries.get(id).promise;
    const controller=new AbortController(),entry={until:now()+ttl};
    const timeout=timers.setTimeout(()=>controller.abort(),25000);
    entry.promise=Promise.resolve().then(()=>fetchSource(id,{excluded:[],refresh:false,signal:controller.signal})).then(value=>{
      entry.until=now()+ttl;return value;
    },error=>{if(entries.get(id)===entry)entries.delete(id);throw error;}).finally(()=>timers.clearTimeout(timeout));
    entries.set(id,entry);
    entry.promise.catch(()=>{}); // Background preparation failures surface on selection/retry.
    return entry.promise;
  }
  function read(id,{excluded=[],refresh=false,signal}={}){
    if(signal?.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
    if(refresh||excluded.length){entries.delete(id);return fetchSource(id,{excluded,refresh,signal});}
    const promise=prepare(id);
    if(!signal)return promise;
    return new Promise((resolve,reject)=>{
      const abort=()=>reject(signal.reason||new DOMException('Aborted','AbortError'));
      signal.addEventListener('abort',abort,{once:true});
      promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
    });
  }
  return {prepare,read};
}
