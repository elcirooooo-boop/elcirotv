import test from 'node:test';
import assert from 'node:assert/strict';
import {withAlternatives,grant,verify,manifest} from '../lib/core.mjs';
test('known channel gets a distinct labelled alternative without replacing the original',()=>{
  const original={id:'original',name:'ESPN3',url:'https://la18hd.su/vivo/canal.php?stream=espn3',lang:'Español'};
  const result=withAlternatives([original]);assert.equal(result.length,2);assert.equal(result[0].name,'ESPN3 · alternativa');assert.equal(result[0].url,'https://tvf90.com/5.php?stream=espn3');assert.deepEqual(result[1],original);
  assert.equal(withAlternatives(result).length,2);
});
test('numbered event feeds never get guessed channel replacements',()=>{
  const disney={id:'disney',name:'Disney 09',url:'https://la18hd.su/vivo/canal.php?stream=disney9'};
  assert.deepEqual(withAlternatives([disney]),[disney]);
});
test('persisted signing key signs both manifest and media without environment configuration',()=>{
  const key='a'.repeat(64),other='b'.repeat(64),expiry=Math.floor(Date.now()/1000)+60;
  const token=grant('https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(token,key).url,'https://cdn.example.com/master.m3u8');assert.throws(()=>verify(token,other));
  const rewritten=manifest('#EXTM3U\nsegment.ts','https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(decodeURIComponent(rewritten.split('?t=')[1]),key).url,'https://cdn.example.com/segment.ts');
});
