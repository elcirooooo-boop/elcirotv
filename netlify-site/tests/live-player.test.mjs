import test from 'node:test';
import assert from 'node:assert/strict';
import {createLivePlayer} from '../public/live-player.js';
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
function harness({mse=true,resolve,autoplay=true}={}){
  let clock=1000,next=1;const jobs=new Map(),players=[],calls=[],statuses=[];
  const timers={setTimeout(fn,ms){const id=next++;jobs.set(id,{fn,at:clock+ms});return id;},clearTimeout(id){jobs.delete(id);},setInterval(fn,ms){const id=next++;jobs.set(id,{fn,at:clock+ms,repeat:ms});return id;},clearInterval(id){jobs.delete(id);}};
  async function advance(ms){const end=clock+ms;while(true){const due=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;const [id,j]=due;clock=j.at;if(j.repeat)j.at+=j.repeat;else jobs.delete(id);j.fn();await settle();}clock=end;await settle();}
  const handlers=new Map();
  const video={dataset:{},currentTime:0,paused:true,ended:false,error:null,volume:.4,muted:true,loads:0,plays:0,
    addEventListener(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},
    emit(name){for(const fn of handlers.get(name)||[])fn();},
    removeAttribute(){},load(){this.loads++;if(!this.paused){this.paused=true;this.emit('pause');}this.currentTime=0;},
    canPlayType(){return 'maybe';},play(){this.plays++;if(!autoplay)return Promise.reject(Object.assign(new Error(),{name:'NotAllowedError'}));this.paused=false;this.emit('play');return Promise.resolve();},
  };
  class Hls{
    static isSupported(){return mse;}static Events={ERROR:'error',MEDIA_ATTACHED:'attached',MANIFEST_PARSED:'manifest'};static ErrorTypes={MEDIA_ERROR:'media',NETWORK_ERROR:'network'};
    constructor(config){this.config=config;this.handlers={};this.recoveries=0;this.starts=[];this.levels=[{}];players.push(this);}
    on(name,fn){this.handlers[name]=fn;}attachMedia(v){this.video=v;this.handlers.attached();}loadSource(url){this.loads=(this.loads||0)+1;this.url=url;}
    startLoad(...args){this.starts.push(args);}recoverMediaError(){this.recoveries++;this.handlers.attached();this.video.paused=true;this.video.emit('pause');}stopLoad(){this.stopped=true;}destroy(){this.destroyed=true;}
    error(type='network',code=502){this.handlers.error(null,{fatal:true,type,response:{code}});}
  }
  const requests=[];
  const player=createLivePlayer({video,Hls,timers,now:()=>clock,onStatus:s=>statuses.push(s),resolveSource:async(excluded,signal,options)=>{calls.push([...excluded]);requests.push(options);return resolve?resolve(excluded,signal):{url:'/api/media?t=test',sourceKey:excluded.includes('first')?'second':'first'};}});
  return {player,video,players,calls,requests,statuses,advance,jobs};
}
async function start(h){await h.player.start();h.players[0]?.handlers.manifest();await settle();}
test('temporary network failures retain the video, buffer timeline and HLS instance',async()=>{
  const h=harness();await start(h);h.video.currentTime=83;const engine=h.players[0];
  engine.error();engine.error();
  assert.equal(h.calls.length,1);assert.equal(h.players.length,1);assert.equal(h.video.currentTime,83);assert.equal(h.video.loads,1);assert.equal(engine.destroyed,undefined);
  assert.deepEqual(engine.starts,[[83,true],[83,true]]);
});
test('only sustained failure re-resolves with backoff and eventually another provider',async()=>{
  const h=harness();await start(h);const engine=h.players[0];
  engine.error();engine.error();engine.error();engine.error();assert.equal(h.calls.length,1);
  await h.advance(999);assert.equal(h.calls.length,1);await h.advance(1);assert.equal(h.calls.length,2);assert.deepEqual(h.calls[1],[]);
  h.players[1].error('network',403);await h.advance(2000);assert.deepEqual(h.calls[2],['first']);
  assert.equal(h.requests[0].refresh,false);assert.equal(h.requests[1].refresh,true);
  assert.equal(h.video.volume,.4);assert.equal(h.video.muted,true);
});
test('decoder recovery retains the player before a delayed source refresh',async()=>{
  const h=harness();await start(h);const engine=h.players[0];engine.error('media');
  assert.equal(engine.recoveries,1);assert.equal(h.calls.length,1);engine.error('media');await h.advance(1000);
  assert.equal(h.calls.length,2);assert.equal(engine.destroyed,true);assert.equal(engine.loads,1);
});
test('watchdog resumes downloads before considering a full reconnect',async()=>{
  const h=harness();await start(h);await h.advance(18000);
  assert.equal(h.players[0].starts.length,1);assert.equal(h.calls.length,1);assert.equal(h.video.loads,1);
});
test('a signal that resumes during backoff cancels the unnecessary source reset',async()=>{
  const h=harness();await start(h);h.video.currentTime=50;h.video.emit('timeupdate');
  h.players[0].error('network',403);h.video.currentTime=51;h.video.emit('timeupdate');await h.advance(2000);
  assert.equal(h.calls.length,1);assert.equal(h.players[0].destroyed,undefined);assert.equal(h.statuses.at(-1),'Reproduciendo');
});
test('a source that ends is excluded instead of replaying the same short clip',async()=>{
  const h=harness();await start(h);h.video.ended=true;h.video.emit('ended');await h.advance(1000);
  assert.deepEqual(h.calls[1],['first']);
});
test('queued pause from the previous channel does not cancel the new selection',async()=>{
  let ready;const h=harness({resolve:()=>new Promise(resolve=>ready=resolve)});const opening=h.player.start();
  h.video.emit('pause');ready({url:'/api/media?t=test',sourceKey:'first'});await opening;h.players[0].handlers.manifest();
  assert.equal(h.video.plays,1);
});
test('pause is respected even when a recovery was scheduled',async()=>{
  const h=harness();await start(h);h.players[0].error('network',403);h.video.paused=true;h.video.emit('pause');
  await h.advance(120000);assert.equal(h.calls.length,1);assert.equal(h.players[0].starts.length,0);assert.equal(h.statuses.at(-1),'En pausa');
  h.players[0].handlers.manifest();assert.equal(h.video.plays,1);
});
test('leaving cancels retries and removes listeners so the previous channel stays stopped',async()=>{
  const h=harness();await start(h);h.players[0].error('network',403);h.player.destroy();
  await h.advance(120000);h.video.emit('ended');h.players[0].handlers.manifest();
  assert.equal(h.calls.length,1);assert.equal(h.jobs.size,0);assert.equal(h.video.plays,1);assert.equal(h.players[0].destroyed,true);
});
test('repeated unavailable sources stop after a bounded number of retries',async()=>{
  const h=harness({resolve:async()=>{throw Error('offline');}});await h.player.start();await h.advance(60000);
  assert.equal(h.calls.length,6);assert.match(h.statuses.at(-1),/interrumpida/);
});
test('a healthy continuous interval restores the transient recovery budget',async()=>{
  const h=harness();await start(h);const engine=h.players[0];engine.error();engine.error();
  for(let i=0;i<36;i++){await h.advance(1000);h.video.currentTime++;h.video.emit('timeupdate');}
  engine.error();assert.equal(engine.starts.length,3);assert.equal(h.calls.length,1);
});
test('MSE waits for its manifest and native Safari fallback remains available',async()=>{
  const h=harness();await h.player.start();assert.equal(h.video.plays,0);h.players[0].handlers.manifest();assert.equal(h.video.plays,1);
  const native=harness({mse:false});await native.player.start();assert.equal(native.video.src,'/api/media?t=test');assert.equal(native.video.plays,1);
});
test('autoplay blocked by the browser waits for the viewer without reconnect loops',async()=>{
  const h=harness({autoplay:false});await start(h);await h.advance(120000);
  assert.equal(h.calls.length,1);assert.equal(h.video.plays,1);assert.match(h.statuses.at(-1),/Toca reproducir/);
});
test('a stuck source resolution times out and retries instead of waiting forever',async()=>{
  const h=harness({resolve:(_,signal)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))});
  const opening=h.player.start();await h.advance(30000);await opening;await h.advance(1000);assert.equal(h.calls.length,2);
  h.player.destroy();await settle();assert.equal(h.jobs.size,0);
});
