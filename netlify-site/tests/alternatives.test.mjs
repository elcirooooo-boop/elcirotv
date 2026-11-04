import test from 'node:test';
import assert from 'node:assert/strict';
import {withAlternatives,grant,verify,manifest} from '../lib/core.mjs';
test('known channel keeps one public choice and registers backups internally',()=>{
  const original={id:'original',name:'ESPN3',url:'https://la18hd.su/vivo/canal.php?stream=espn3',lang:'Español'};
  const result=withAlternatives([original]);assert.equal(result.length,1);assert.equal(result[0].name,'ESPN3');assert.equal(result[0].url,original.url);assert.ok(result[0].sources.length>=3);assert.equal(result[0].sources[0].url,'https://tvf90.com/5.php?stream=espn3');
  assert.equal(withAlternatives(result).length,1);
});
test('numbered Disney feeds use only the exact alias registered by bot one',()=>{
  const disney={id:'disney',name:'Disney 09',url:'https://la18hd.su/vivo/canal.php?stream=disney9'};
  const result=withAlternatives([disney])[0];assert.ok(result.sources.some(s=>s.url==='https://tvf90.com/5.php?stream=disney9'));assert.ok(result.sources.every(s=>s.url.includes('disney9')));
});
test('explicit ESPN mobile label uses backups of that exact numbered channel',()=>{
  const result=withAlternatives([{id:'mobile',name:'ESPN3 Movil',url:'https://www.golperutv.xyz/repro/espn3tv.html'}]);
  assert.equal(result.length,1);assert.equal(result[0].sources[0].url,'https://tvf90.com/5.php?stream=espn3');
});
test('Premiere 5 BR uses its published player variant without changing the match channel',()=>{
  const original={id:'2496ec766ba7a12b5ae725cb',name:'Premiere 5 BR',url:'https://la18hd.su/vivo/canal.php?stream=premiere5',sources:[{id:'old',url:'https://la18hd.su/vivo/canal.php?stream=premiere5'}]};
  const result=withAlternatives([original])[0];
  assert.equal(result.id,original.id);assert.equal(result.name,original.name);assert.equal(result.url,original.url);
  assert.equal(result.sources[0].url,'https://tvf90.com/1.php?stream=premiere5');assert.equal(result.sources.length,2);
  assert.ok(result.sources.every(source=>new URL(source.url).searchParams.get('stream')==='premiere5'));
  assert.deepEqual(withAlternatives([result])[0].sources,result.sources);
});
test('a published Premiere 5 player is deduplicated and unknown Premiere numbers are not guessed',()=>{
  const result=withAlternatives([{id:'published',name:'Premiere 5 BR ',url:'https://tvf90.com/1.php?stream=premiere5'}])[0];
  assert.equal(result.sources.length,1);
  const unknown=withAlternatives([{id:'unknown',name:'Premiere 99 BR',url:'https://la18hd.su/vivo/canal.php?stream=premiere99'}])[0];
  assert.equal(unknown.sources.length,1);assert.equal(unknown.sources[0].url,'https://la18hd.su/vivo/canal.php?stream=premiere99');
});
test('persisted signing key signs both manifest and media without environment configuration',()=>{
  const key='a'.repeat(64),other='b'.repeat(64),expiry=Math.floor(Date.now()/1000)+60;
  const token=grant('https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(token,key).url,'https://cdn.example.com/master.m3u8');assert.throws(()=>verify(token,other));
  const rewritten=manifest('#EXTM3U\nsegment.ts','https://cdn.example.com/master.m3u8','',expiry,key);
  assert.equal(verify(decodeURIComponent(rewritten.split('?t=')[1]),key).url,'https://cdn.example.com/segment.ts');
});
