import test from 'node:test';
import assert from 'node:assert/strict';
import {hash,merge,withAlternatives,withPublishedAlternatives,publicAgenda} from '../lib/core.mjs';
import {resolvePlaybackRoute} from '../lib/playback-route.mjs';
const signal=url=>({id:hash(url),name:'Published channel',url});
const first=signal('https://la18hd.su/vivo/canal.php?stream=premiere7');
const second=signal('https://tvf90.com/1.php?stream=premiere7');
test('published backups cross event boundaries while preserving matches and shared channel IDs',()=>{
  const events=merge([[{id:'first',title:'A vs B',startsAt:'2026-11-04T12:00:00Z',signals:[first]}],[{id:'second',title:'C vs D',startsAt:'2026-11-04T18:00:00Z',signals:[second]}]]);
  assert.equal(events.length,2);
  assert.equal(events[0].signals[0].id,first.id);
  assert.equal(events[1].signals[0].id,second.id);
  for(const event of events)assert.deepEqual(new Set(event.signals[0].sources.map(s=>s.url)),new Set([first.url,second.url]));
  assert.deepEqual(merge([events]),events);
  assert.ok(!JSON.stringify(publicAgenda({events})).includes('https://'));
});
test('backup discovery never mixes channel numbers, regions, untrusted hosts or player paths',()=>{
  const unrelated=[
    'https://tvf90.com/1.php?stream=premiere8',
    'https://tvf90.com/1.php?stream=premiere7br',
    'https://untrusted.example/1.php?stream=premiere7',
    'https://tvf90.com/unrelated.php?stream=premiere7',
    'https://la18hd.su:444/vivo/canal.php?stream=premiere7',
    'https://user:pass@la18hd.su/vivo/canal.php?stream=premiere7'
  ].map(signal);
  assert.deepEqual(withPublishedAlternatives([first],unrelated),withAlternatives([first]));
});
test('normal playback starts without waiting for agenda',async()=>{
  const result=await resolvePlaybackRoute(first,[],{}, {selectPlayback:async()=>({url:'working'}),publishedSignals:()=>{throw Error('Must not load agenda');}});
  assert.equal(result.resolved.url,'working');
});
test('failed channel automatically tries newly published exact-channel players only',async()=>{
  const registered=withAlternatives([first])[0],calls=[];
  const result=await resolvePlaybackRoute(registered,[],{refresh:true},{
    publishedSignals:async()=>[first,second],
    selectPlayback:async(source,excluded,deps,options)=>{
      calls.push(source);assert.equal(source.id,first.id);assert.equal(options.refresh,true);
      if(calls.length===1)throw Error('Unavailable');
      assert.deepEqual(source.sources,[{id:second.id,url:second.url}]);
      return {url:'working',sourceKey:second.id};
    }
  });
  assert.equal(calls.length,2);assert.equal(result.resolved.sourceKey,second.id);
});
test('an unavailable agenda or lack of new backups preserves the original failure without retry loops',async()=>{
  for(const publishedSignals of [async()=>[first],async()=>{throw Error('Agenda down');}]){
    let calls=0;const error=Error('Original failure');
    await assert.rejects(resolvePlaybackRoute(withAlternatives([first])[0],[],{}, {publishedSignals,selectPlayback:async()=>{calls++;throw error;}}),e=>e===error);
    assert.equal(calls,1);
  }
});
