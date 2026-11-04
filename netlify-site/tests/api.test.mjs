import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/api.mjs';
import {catalogSignals,verify} from '../lib/core.mjs';
import {playbackServices} from '../lib/playback-route.mjs';

test('catalog playback returns a Netlify media session without a separate video service',async()=>{
  const original={...playbackServices};
  const key='netlify-test-key-01234567890123456789';
  playbackServices.selectPlayback=async source=>{assert.equal(source.slug,'espn3');return {url:'https://cdn.example/live.m3u8',referer:'https://tvf90.com/',sourceKey:'source'};};
  playbackServices.playbackKey=async()=>key;
  try{
  const source=catalogSignals().find(signal=>signal.slug==='espn3');
  const response=await handler(new Request('https://test.netlify.app/api/play?source='+source.id));
  assert.equal(response.status,200);const data=await response.json();
  assert.ok(data.url.startsWith('/api/media?t='));assert.equal(data.transport,'netlify');
  const permission=verify(new URL(data.url,'https://test.netlify.app').searchParams.get('t'),key);
  assert.equal(permission.url,'https://cdn.example/live.m3u8');
  const fresh=await (await handler(new Request('https://test.netlify.app/api/play?source='+source.id+'&refresh=1'))).json();
  assert.ok(fresh.url.startsWith('/api/media?t='));assert.equal(fresh.sourceKey,data.sourceKey);
  }finally{Object.assign(playbackServices,original);}
});
test('old session paths request a refresh without contacting the retired server',async()=>{
  assert.equal((await handler(new Request('https://test.netlify.app/api/retired'))).status,410);
  assert.equal((await handler(new Request('https://test.netlify.app/stream/live/espn/master.m3u8'))).status,410);
});
test('removed statistics endpoint is unavailable',async()=>{
  assert.equal((await handler(new Request('https://test.netlify.app/api/statistics'))).status,404);
});
test('media rejects unsigned arbitrary targets',async()=>{
  assert.equal((await handler(new Request('https://test.netlify.app/api/media?t=invalid'))).status,403);
});
test('presence rejects cross-origin writes',async()=>{
  assert.equal((await handler(new Request('https://test.netlify.app/api/presence',{method:'POST',body:'{}'}))).status,403);
});
test('agenda rejects unsupported mutations',async()=>{
  assert.equal((await handler(new Request('https://test.netlify.app/api/agenda',{method:'POST'}))).status,405);
});
