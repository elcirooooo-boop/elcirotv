import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPlayback} from '../lib/playback.mjs';
const make=id=>({id,name:'Channel',sources:[{id:'primary',url:'https://primary.example.com/a'},{id:'backup',url:'https://backup.example.com/a'}]});
test('failed provider is replaced internally with same channel backup',async()=>{
  const signal=make('fallback'),calls=[];
  const result=await selectPlayback(signal,[],{resolve:async url=>{calls.push(url);if(url.includes('primary'))throw Error('403');return {url:'https://cdn.example.com/live.m3u8'};},probe:async()=>{}});
  assert.equal(result.sourceKey,'backup');assert.equal(calls.length,2);assert.equal(signal.name,'Channel');
});
test('invalid playlist triggers fallback before handing it to the browser',async()=>{
  const result=await selectPlayback(make('invalid'),[],{resolve:async url=>({url}),probe:async value=>{if(value.url.includes('primary'))throw Error('INVALID_MANIFEST');}});
  assert.equal(result.sourceKey,'backup');
});
test('browser exclusion never selects a different channel',async()=>{
  const calls=[];
  await assert.rejects(selectPlayback(make('excluded'),['primary','backup'],{resolve:async url=>{calls.push(url);return {url};},probe:async()=>{}}),/CHANNEL_UNAVAILABLE/);
  assert.equal(calls.length,0);
});
test('healthy source is preferred on subsequent reconnects',async()=>{
  const signal=make('healthy');let primaryFailed=true;const calls=[];
  const deps={resolve:async url=>{calls.push(url);if(primaryFailed&&url.includes('primary'))throw Error('OFFLINE');return {url};},probe:async()=>{}};
  await selectPlayback(signal,[],deps);primaryFailed=false;calls.length=0;
  assert.equal((await selectPlayback(signal,[],deps)).sourceKey,'backup');assert.equal(calls.length,1);
});
