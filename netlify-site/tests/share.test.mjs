import test from 'node:test';
import assert from 'node:assert/strict';
import {matchPath,matchIdFromPath,sharedSignal,matchShareData,copyShareLink,shareMatch} from '../public/share.js';
const event={id:'abc123',title:'Perú vs México',league:'Copa América',time:'20:30',signals:[{id:'source1',name:'ESPN'},{id:'source2',name:'Win Sports + | OP2'}]};
const data=matchShareData(event,'https://elcirotv.netlify.app');
test('link opens the exact match and preserves the match title',()=>{
  assert.equal(data.url,'https://elcirotv.netlify.app/partido/abc123/peru-vs-mexico');
  assert.ok(data.text.includes('Perú vs México'));
});
test('sharing a selected variant preserves exact channel and team names',()=>{
  const selected=event.signals[1],share=matchShareData(event,'https://elcirotv.netlify.app',selected),url=new URL(share.url);
  assert.equal(url.pathname,matchPath(event));assert.equal(url.searchParams.get('canal'),'source2');assert.equal(sharedSignal(event,url.search),selected);assert.ok(share.title.includes('Perú vs México'));assert.ok(share.text.includes('Win Sports + | OP2'));
});
test('legacy links still resolve and a descriptive suffix never changes the match identity',()=>{
  assert.equal(matchIdFromPath('/partido/abc123'),'abc123');assert.equal(matchIdFromPath('/partido/abc123/peru-vs-mexico'),'abc123');assert.equal(matchIdFromPath('/partido/abc123/other-name'),'abc123');assert.equal(matchIdFromPath('/partido/abc123/x/y'),null);
});
test('shared channel must belong to this exact match and URLs cannot inject another source',()=>{
  assert.equal(sharedSignal(event,'?canal=unrelated'),null);assert.equal(sharedSignal(event,'?canal=https://other.example/video'),null);assert.ok(!matchShareData(event,'https://elcirotv.netlify.app',{id:'unrelated'}).url.includes('canal='));
});
test('native sharing receives the direct match URL',async()=>{
  let received;assert.equal(await shareMatch(data,{share:async payload=>{received=payload;}}),'shared');assert.equal(received.url,data.url);
});
test('desktop sharing copies the direct link and denied clipboard offers manual copy',async()=>{
  let copied;assert.equal(await shareMatch(data,{clipboard:{writeText:async value=>{copied=value;}}}),'copied');assert.equal(copied,data.url);
  assert.equal(await copyShareLink(data,{clipboard:{writeText:async()=>{throw Error('denied');}}}),'manual');
});
test('cancelling the share sheet does not copy or send anything',async()=>{
  let copied=false;assert.equal(await shareMatch(data,{share:async()=>{throw Object.assign(Error(),{name:'AbortError'});},clipboard:{writeText:async()=>{copied=true;}}}),'cancelled');assert.equal(copied,false);
});
