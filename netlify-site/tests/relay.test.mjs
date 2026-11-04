import test from 'node:test';
import assert from 'node:assert/strict';
import {relayPlayback,openRelaySession} from '../lib/relay.mjs';
import {catalogSignals} from '../lib/core.mjs';
test('all catalog channels use the persistent relay under the website origin',()=>{
  for(const signal of catalogSignals()){
    const source=relayPlayback(signal);
    assert.equal(source.url,'/stream/live/'+signal.slug+'/master.m3u8');assert.equal(source.transport,'relay');assert.equal(source.name,signal.name);
  }
});
test('published numbered and regional channels keep their exact identity',()=>{
  const get=(name,slug)=>relayPlayback({name,url:'https://tvf90.com/5.php?stream='+slug}).url;
  assert.equal(get('ESPN 3 MOVIL','espn3'),'/stream/live/espn3/master.m3u8');
  assert.equal(get('ESPN 1 México','espnmx'),'/stream/live/espnmx/master.m3u8');
  assert.equal(get('Evento especial','evento_23'),'/stream/live/evento_23/master.m3u8');
});
test('arbitrary hosts, paths and unknown events cannot choose a relay target',()=>{
  for(const url of ['https://evil.example/5.php?stream=espn','https://tvf90.com/5.php?stream=../../admin','https://tvf90.com/evento-sin-identificador','javascript:alert(1)']){
    assert.equal(relayPlayback({name:'Evento desconocido',url}),null);
  }
});
test('recovery bypasses intermediary playlist caching without switching channels',()=>{
  const signal=catalogSignals()[0],normal=relayPlayback(signal),fresh=relayPlayback(signal,{refresh:true,now:()=>1234});
  assert.equal(fresh.url,normal.url+'?refresh=1234');assert.equal(fresh.sourceKey,normal.sourceKey);
});
test('viewers receive a pinned signed playlist instead of a resolver that changes CDN',async()=>{
  const calls=[];
  const source=await openRelaySession(catalogSignals()[0],{refresh:true,fetch:async(url)=>{calls.push(url);return {ok:true,json:async()=>({url:'/stream/live/espn/sub.m3u8?target=encoded&sig=signed'})};}});
  assert.equal(source.url,'/stream/live/espn/sub.m3u8?target=encoded&sig=signed');assert.equal(source.transport,'relay');
  assert.equal(calls[0],'https://web-production-dc68f.up.railway.app/api/playback/espn?refresh=1');
});
test('a relay response cannot redirect the viewer to another website or another channel',async()=>{
  for(const url of ['https://evil.example/live.m3u8','//evil.example/stream/live/espn/sub.m3u8?sig=x','/stream/live/espn2/sub.m3u8?sig=x','/stream/live/espn/sub.m3u8']){
    await assert.rejects(openRelaySession(catalogSignals()[0],{fetch:async()=>({ok:true,json:async()=>({url})})}),/INVALID_RELAY_SESSION/);
  }
});
