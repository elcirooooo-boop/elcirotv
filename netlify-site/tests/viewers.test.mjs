import test from 'node:test';
import assert from 'node:assert/strict';
import {viewerCounts} from '../lib/viewers.mjs';
const match='a'.repeat(24),other='b'.repeat(24),now=200000;
const row=(session,at=now,playing=true,id=match)=>({session,at,playing,match:id});
test('counts active playback only and expires absent viewers',()=>{
  assert.deepEqual(viewerCounts([row('a'),row('paused',now,false),row('old',now-75000),row('future',now+1),row('boundary',now-74999)],now),{[match]:2});
});
test('latest heartbeat removes pauses and prevents duplicate buckets',()=>{
  assert.deepEqual(viewerCounts([row('a',now-1000),row('a'),row('b',now-1000),row('b',now,false)],now),{[match]:1});
});
test('a session changing matches is counted only for the latest playback',()=>{
  assert.deepEqual(viewerCounts([row('a',now-1000),row('a',now,true,other),row('b',now,false,'')],now),{[other]:1});
});
test('response contains counts without identities or individual records',()=>{
  const result=viewerCounts([row('private-session')],now);assert.deepEqual(Object.keys(result),[match]);assert.ok(!JSON.stringify(result).includes('private-session'));
});
