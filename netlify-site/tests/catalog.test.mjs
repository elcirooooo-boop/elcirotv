import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogSignals,publicAgenda,withAlternatives} from '../lib/core.mjs';
test('full bot one directory is available without relying on today’s agenda',()=>{
  const directory=catalogSignals();assert.equal(directory.length,72);assert.equal(new Set(directory.map(c=>c.id)).size,72);
  for(const slug of ['espn','espn7','dsports','dsportsplus','disney1','disney15','tudn','max1'])assert.ok(directory.some(c=>c.slug===slug));
  assert.equal(publicAgenda({day:'2026-11-03',events:[]}).channels.length,72);
});
test('unknown event does not get a guessed replacement channel',()=>{
  const signal={id:'unknown',name:'Court 99',url:'https://la18hd.su/vivo/canal.php?stream=court99'};
  const result=withAlternatives([signal])[0];assert.equal(result.sources.length,1);assert.equal(result.sources[0].url,signal.url);
});
