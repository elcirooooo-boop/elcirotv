import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelayHealthCheck,resolvePlaybackRoute} from '../lib/playback-route.mjs';

test('a missing relay is skipped and the same channel is handed to registered backups',async()=>{
  const source={id:'exact-channel'},options={refresh:true},excluded=['failed-provider'];let relayCalled=false;
  const result=await resolvePlaybackRoute(source,excluded,options,{
    available:async()=>false,openRelaySession:async()=>{relayCalled=true;},
    selectPlayback:async(s,e,_,o)=>{assert.equal(s,source);assert.equal(e,excluded);assert.equal(o,options);return {url:'https://cdn.example/live.m3u8'};},
  });
  assert.equal(relayCalled,false);assert.equal(result.resolved.url,'https://cdn.example/live.m3u8');
});
test('a session failure after a good health response also falls back',async()=>{
  const result=await resolvePlaybackRoute({id:'same'},[],{}, {available:async()=>true,openRelaySession:async()=>{throw Error('SERVICE_GONE');},selectPlayback:async()=>({sourceKey:'registered-backup'})});
  assert.equal(result.resolved.sourceKey,'registered-backup');
});
test('a healthy relay retains its existing player session',async()=>{
  const session={transport:'relay',url:'/stream/live/espn/sub.m3u8?sig=signed'};
  const result=await resolvePlaybackRoute({id:'same'},[],{}, {available:async()=>true,openRelaySession:async()=>session,selectPlayback:async()=>{throw Error('must not run');}});
  assert.equal(result.session,session);
});
test('service health is cached briefly and a restored service is detected',async()=>{
  let clock=1000,calls=0,healthy=false;
  const health=createRelayHealthCheck({now:()=>clock,load:async()=>{calls++;return Response.json({status:healthy?'ok':'error'},{status:healthy?200:404});}});
  assert.equal(await health(),false);assert.equal(await health(),false);assert.equal(calls,1);
  healthy=true;clock+=10001;assert.equal(await health(),true);assert.equal(calls,2);
});
test('an unreachable service is unavailable rather than an uncaught playback error',async()=>{
  const health=createRelayHealthCheck({load:async()=>{throw Error('unreachable');}});
  assert.equal(await health(),false);
});
