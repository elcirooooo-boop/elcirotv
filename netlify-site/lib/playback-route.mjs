import {openRelaySession,service} from './relay.mjs';
import {selectPlayback} from './playback.mjs';

export function createRelayHealthCheck({load=(...args)=>fetch(...args),now=Date.now,ttl=10000}={}){
  let result=false,until=0,pending;
  return async()=>{
    if(now()<until)return result;
    if(pending)return pending;
    pending=(async()=>{
      try{
        const response=await load(service+'/health',{signal:AbortSignal.timeout(2000),headers:{Accept:'application/json'}});
        result=response.ok&&(await response.json()).status==='ok';
      }catch{result=false;}
      until=now()+ttl;
      return result;
    })();
    try{return await pending;}finally{pending=undefined;}
  };
}
const available=createRelayHealthCheck();
export const playbackServices={available,openRelaySession,selectPlayback};
export async function resolvePlaybackRoute(source,excluded=[],options={},deps=playbackServices){
  // A stopped/missing relay must not prevent the registered same-channel
  // backup path from running. Recheck health so recovery is automatic, too.
  if(await deps.available()){
    try{
      const session=await deps.openRelaySession(source,options);
      if(session)return {session};
    }catch{/* Continue with the registered source of this exact channel. */}
  }
  return {resolved:await deps.selectPlayback(source,excluded,undefined,options)};
}
