import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/api.mjs';
import {catalogSignals} from '../lib/core.mjs';

test('catalog playback uses the persistent route without resolving a CDN token in Functions',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({url:'/stream/live/espn3/sub.m3u8?sig=test-session'});
  try{
  const source=catalogSignals().find(signal=>signal.slug==='espn3');
  const response=await handler(new Request('https://test.netlify.app/api/play?source='+source.id));
  assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.url,'/stream/live/espn3/sub.m3u8?sig=test-session');assert.equal(data.transport,'relay');
  const fresh=await (await handler(new Request('https://test.netlify.app/api/play?source='+source.id+'&refresh=1'))).json();
  assert.equal(fresh.url,data.url);assert.equal(fresh.sourceKey,data.sourceKey);
  }finally{globalThis.fetch=original;}
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
