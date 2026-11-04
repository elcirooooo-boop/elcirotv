import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const code=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/void render\(\);\s*$/,'');
function harness({mse=false}={}){
  const calls=[],elements=new Map(),intervals=new Set(),players=[];let currentVideo;
  class Video{
    constructor(){this.handlers={};this.dataset={};this.plays=0;this.paused=false;this.readyState=4;this.ended=false;this.currentTime=0;}
    cloneNode(){return new Video();}replaceWith(video){currentVideo=video;}pause(){this.paused=true;}load(){}removeAttribute(){}
    addEventListener(name,fn){this.handlers[name]=fn;}canPlayType(){return 'maybe';}play(){this.plays++;this.paused=false;return Promise.resolve();}
  }
  currentVideo=new Video();
  const document={querySelector:selector=>selector==='video'?currentVideo:(elements.has(selector)?elements.get(selector):(elements.set(selector,{textContent:'',scrollIntoView(){}}),elements.get(selector))),querySelectorAll:()=>[],addEventListener(){}};
  class Hls{
    static isSupported(){return mse;}static Events={ERROR:'error',MEDIA_ATTACHED:'attached',MANIFEST_PARSED:'manifest'};static ErrorTypes={MEDIA_ERROR:'media'};
    constructor(){this.handlers={};this.recoveries=0;players.push(this);}on(name,fn){this.handlers[name]=fn;}attachMedia(v){this.video=v;this.handlers.attached();}loadSource(url){this.url=url;}recoverMediaError(){this.recoveries++;}destroy(){this.destroyed=true;}
  }
  const context=vm.createContext({document,crypto:{randomUUID:()=> 'session'},Date,URL,Blob,history:{},location:{},window:{Hls,scrollTo(){}},navigator:{sendBeacon(){}},addEventListener(){},setInterval:fn=>{intervals.add(fn);return fn;},clearInterval:fn=>intervals.delete(fn),fetch:async url=>{
    if(!url.startsWith('/api/play'))return {ok:true,json:async()=>({counts:{}})};
    calls.push(url);return {ok:true,json:async()=>({url:'/api/media?t=valid',sourceKey:url.includes('exclude=first')?'second':'first'})};
  }});
  vm.runInContext(code,context);
  return {calls,elements,context,video:()=>currentVideo,intervals,players};
}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('video errors reconnect and then exclude the failed provider without another user selection',async()=>{
  const h=harness();await vm.runInContext("play({id:'channel',name:'ESPN3'},[])",h.context);
  h.video().handlers.error();await settle();assert.equal(h.calls.length,2);
  h.video().handlers.error();await settle();assert.equal(h.calls.length,3);assert.ok(h.calls[2].includes('exclude=first'));
  assert.equal(vm.runInContext('selected',h.context),'channel');
});
test('recovery is bounded and stops when the viewer leaves the player',async()=>{
  const h=harness();await vm.runInContext("play({id:'channel',name:'ESPN3'},[])",h.context);
  for(let i=0;i<8;i++){h.video().handlers.error();await settle();}
  assert.equal(h.calls.length,5);assert.ok(h.elements.get('#signalStatus').textContent.includes('no está disponible'));
  vm.runInContext('stop()',h.context);assert.equal(h.intervals.size,0);
  h.video().handlers.error();await settle();assert.equal(h.calls.length,5);
});
test('Chromium native maybe support uses HLS.js and waits for its manifest',async()=>{
  const h=harness({mse:true});await vm.runInContext("play({id:'channel',name:'ESPN1'},[])",h.context);
  assert.equal(h.players.length,1);assert.equal(h.video().dataset.engine,'hls.js');assert.equal(h.video().src,undefined);assert.equal(h.video().plays,0);
  h.players[0].handlers.manifest();assert.equal(h.video().plays,1);
});
test('Safari style native playback remains available without MSE',async()=>{
  const h=harness();await vm.runInContext("play({id:'channel',name:'ESPN1'},[])",h.context);
  assert.equal(h.video().dataset.engine,'native');assert.equal(h.video().src,'/api/media?t=valid');assert.equal(h.video().plays,1);
});
test('decoder error recovers MediaSource once before changing provider',async()=>{
  const h=harness({mse:true});await vm.runInContext("play({id:'channel',name:'ESPN1'},[])",h.context);
  const instance=h.players[0];instance.handlers.error(null,{fatal:true,type:'media'});assert.equal(instance.recoveries,1);assert.equal(h.calls.length,1);
  instance.handlers.error(null,{fatal:true,type:'media'});await settle();assert.equal(h.calls.length,2);assert.ok(instance.destroyed);
});
