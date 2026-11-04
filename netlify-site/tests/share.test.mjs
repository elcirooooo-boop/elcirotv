import test from 'node:test';
import assert from 'node:assert/strict';
import {matchShareData,telegramShareURL,copyShareLink,shareMatch} from '../public/share.js';
const event={id:'abc123',title:'Perú vs México',league:'Copa América',time:'20:30'};
const data=matchShareData(event,'https://elcirotv.netlify.app');
test('link opens the exact match and Telegram preserves accents and the direct URL',()=>{
  assert.equal(data.url,'https://elcirotv.netlify.app/partido/abc123');
  const telegram=new URL(telegramShareURL(data));assert.equal(telegram.searchParams.get('url'),data.url);assert.ok(telegram.searchParams.get('text').includes('Perú vs México'));
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
