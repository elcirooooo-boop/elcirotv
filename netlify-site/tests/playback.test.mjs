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
  assert.equal((await selectPlayback(signal,[],deps,{refresh:true})).sourceKey,'backup');assert.equal(calls.length,1);
});
test('a slow provider cannot hold up a healthy alternative and losing work is aborted',async()=>{
  let primarySignal;
  const result=await selectPlayback(make('slow-primary'),[],{
    resolve:async(url,{signal})=>{if(url.includes('primary')){primarySignal=signal;return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}return {url};},
    probe:async()=>{},
  },{hedgeDelay:5,sourceTimeout:500});
  assert.equal(result.sourceKey,'backup');assert.equal(primarySignal.aborted,true);
});
test('validated playback is reused briefly, expires, and a recovery always refreshes it',async()=>{
  let clock=1000,resolutions=0,probes=0;const signal=make('short-cache');
  const deps={resolve:async url=>{resolutions++;return {url};},probe:async()=>{probes++;}};
  const options={now:()=>clock};
  const first=await selectPlayback(signal,[],deps,options);
  assert.deepEqual(await selectPlayback(signal,[],deps,options),first);assert.equal(resolutions,1);assert.equal(probes,1);
  clock+=16000;await selectPlayback(signal,[],deps,options);assert.equal(resolutions,2);
  await selectPlayback(signal,[],deps,{...options,refresh:true});assert.equal(resolutions,3);
  assert.equal((await selectPlayback(signal,['primary'],deps,options)).sourceKey,'backup');assert.equal(resolutions,4);
});
test('simultaneous viewers share the same pending source verification',async()=>{
  let release,resolutions=0;const signal=make('coalescing');
  const deps={resolve:async url=>{resolutions++;await new Promise(resolve=>release=resolve);return {url};},probe:async()=>{}};
  const first=selectPlayback(signal,[],deps),second=selectPlayback(signal,[],deps);release();
  assert.deepEqual(await first,await second);assert.equal(resolutions,1);
});
test('unresponsive providers have a deadline even if their resolver ignores cancellation',async()=>{
  await assert.rejects(selectPlayback(make('timeout'),[],{resolve:()=>new Promise(()=>{}),probe:async()=>{}},{hedgeDelay:1,sourceTimeout:10}),/CHANNEL_UNAVAILABLE/);
});
