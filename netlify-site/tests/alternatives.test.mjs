import test from 'node:test';
import assert from 'node:assert/strict';
import {withAlternatives,grant,verify,manifest} from '../lib/core.mjs';
test('known channel keeps one public choice and registers backups internally',()=>{
  const original={id:'original',name:'ESPN3',url:'https://la18hd.su/vivo/canal.php?stream=espn3',lang:'Español'};
  const result=withAlternatives([original]);assert.equal(result.length,1);assert.equal(result[0].name,'ESPN3');assert.equal(result[0].url,original.url);assert.equal(result[0].sources.length,3);assert.equal(result[0].sources[0].url,'https://tvf90.com/5.php?stream=espn3');
  assert.equal(withAlternatives(result).length,1);
});
test('numbered event feeds never get guessed channel replacements',()=>{
  const disney={id:'disney',name:'Disney 09',url:'https://la18hd.su/vivo/canal.php?stream=disney9'};
  assert.equal(withAlternatives([disney])[0].sources.length,1);assert.equal(withAlternatives([disney])[0].sources[0].url,disney.url);
});
test('explicit ESPN mobile label uses backups of that exact numbered channel',()=>{
  const result=withAlternatives([{id:'mobile',name:'ESPN3 Movil',url:'https://www.golperutv.xyz/repro/espn3tv.html'}]);
  assert.equal(result.length,1);assert.equal(result[0].sources[0].url,'https://tvf90.com/5.php?stream=espn3');
});
test('persisted signing key signs both manifest and media without environment configuration',()=>{
  const key='a'.repeat(64),other='b'.repeat(64),expiry=Math.floor(Date.now()/1000)+60;
  const token=grant('https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(token,key).url,'https://cdn.example.com/master.m3u8');assert.throws(()=>verify(token,other));
  const rewritten=manifest('#EXTM3U\nsegment.ts','https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(decodeURIComponent(rewritten.split('?t=')[1]),key).url,'https://cdn.example.com/segment.ts');
});
