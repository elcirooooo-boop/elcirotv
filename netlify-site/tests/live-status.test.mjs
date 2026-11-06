import test from 'node:test';
import assert from 'node:assert/strict';
import {estimatedDuration,liveWindow,isEstimatedLive,liveIndicator,updateLiveStatuses} from '../public/live-status.js';
const event={title:'España vs Argentina',league:'Fútbol',startsAt:'2026-11-06T22:00:00Z'};
test('starts exactly at kickoff, ends at the estimated boundary, and crosses midnight',()=>{
  const {start,end}=liveWindow(event);
  assert.equal(new Date(end).toISOString(),'2026-11-07T00:15:00.000Z');
  assert.equal(isEstimatedLive(event,start-1),false);assert.equal(isEstimatedLive(event,start),true);
  assert.equal(isEstimatedLive(event,end-1),true);assert.equal(isEstimatedLive(event,end),false);
  assert.equal(liveWindow({...event,startsAt:'invalid'}),null);
  assert.equal(liveIndicator({...event,startsAt:'invalid'}),'');
});
test('durations follow sport and session instead of the same end time for every event',()=>{
  for(const [league,title,minutes] of [['NBA','Lakers vs Celtics',180],['NFL','Ravens vs Jaguars',240],['MLB','A vs B',210],['ATP','A vs B',240],['Deportes','Tenis – Masters 1000 París',240],['F1','GP Brasil – Práctica 1',90],['F1','GP Brasil – Carrera',150],['F1','GP Brasil – Sprint',75],['Fútbol Sala','España vs Portugal',100],['Deportes','Golf – Segunda ronda',360]])assert.equal(estimatedDuration({league,title}),minutes,title);
});
test('updating a page activates and removes only the badge without rerendering playback',()=>{
  const {start,end}=liveWindow(event);
  const node={dataset:{liveStart:String(start),liveEnd:String(end)},hidden:true};
  const root={querySelectorAll:()=>[node]};
  updateLiveStatuses(root,start);assert.equal(node.hidden,false);
  updateLiveStatuses(root,end);assert.equal(node.hidden,true);
  assert.ok(liveIndicator(event,start-1).includes(' hidden'));
  assert.ok(!liveIndicator(event,start).includes(' hidden'));
  assert.ok(liveIndicator(event,start).includes('Final estimado'));
});
