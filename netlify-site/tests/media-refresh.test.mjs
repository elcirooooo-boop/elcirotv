import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshDeniedMedia} from '../lib/media-refresh.mjs';
const ref='https://tvf90.com/5.php?stream=espn';
const response={statusCode:200,resume(){}};
test('a denied playlist can renew its public session inside the same Netlify request',async()=>{
  const calls=[];
  const result=await refreshDeniedMedia({url:'https://old.example/espn/mono.m3u8?token=old',referer:ref},'',{
    resolve:async url=>{assert.equal(url,ref);return {url:'https://new.example/espn/mono.m3u8?token=fresh',referer:ref};},
    request:async url=>{calls.push(url);return {response,url};},
  });
  assert.equal(result.response,response);assert.equal(calls[0],'https://new.example/espn/mono.m3u8?token=fresh');
});
test('segment renewal selects only an exact file published by that channel',async()=>{
  const calls=[];
  const result=await refreshDeniedMedia({url:'https://old.example/espn/42.ts?sequence=42&token=old',referer:ref},'bytes=0-187',{
    resolve:async()=>({url:'https://new.example/espn/mono.m3u8?token=fresh',referer:ref}),
    request:async(url,_,range)=>{calls.push({url,range});return {response,url};},
    read:async()=> '#EXTM3U\n42.ts?sequence=41&token=fresh\n42.ts?sequence=42&token=fresh\n',
  });
  assert.ok(result);assert.equal(calls[1].url,'https://new.example/espn/42.ts?sequence=42&token=fresh');assert.equal(calls[1].range,'bytes=0-187');
});
test('renewal never substitutes another match, segment number or quality path',async()=>{
  for(const url of ['https://old.example/other/mono.m3u8?token=old','https://old.example/espn/99.ts']){
    const result=await refreshDeniedMedia({url,referer:ref},'',{
      resolve:async()=>({url:'https://new.example/espn/mono.m3u8?token=fresh',referer:ref}),
      request:async url=>({response,url}),read:async()=> '#EXTM3U\n42.ts\n',
    });
    assert.equal(result,null);
  }
});
test('untrusted players and unsupported resources are not renewed',async()=>{
  for(const permission of [{url:'https://old.example/espn/mono.m3u8',referer:'https://evil.example/5.php?stream=espn'},{url:'https://old.example/espn/key',referer:ref}]){
    assert.equal(await refreshDeniedMedia(permission,'',{resolve:async()=>{throw Error('must not be called');}}),null);
  }
});
test('an unavailable fresh session does not cause an endless renewal loop',async()=>{
  let calls=0;
  const result=await refreshDeniedMedia({url:'https://old.example/espn/mono.m3u8',referer:ref},'',{resolve:async()=>{calls++;throw Error('unavailable');}});
  assert.equal(result,null);assert.equal(calls,1);
});
test('ambiguous segment endpoints are not guessed from changing tokens',async()=>{
  const result=await refreshDeniedMedia({url:'https://old.example/espn/segment.ts?token=old',referer:ref},'',{
    resolve:async()=>({url:'https://new.example/espn/mono.m3u8',referer:ref}),request:async url=>({response,url}),
    read:async()=> '#EXTM3U\nsegment.ts?token=one\nsegment.ts?token=two\n',
  });
  assert.equal(result,null);
});
