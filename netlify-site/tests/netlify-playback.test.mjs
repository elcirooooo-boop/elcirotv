import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolvePlaybackRoute} from '../lib/playback-route.mjs';

test('playback resolves the exact selected channel with no preliminary external service check',async()=>{
  const source={id:'exact-channel'},options={refresh:true},excluded=['failed-provider'];let calls=0;
  const result=await resolvePlaybackRoute(source,excluded,options,{
    selectPlayback:async(s,e,_,o)=>{calls++;assert.equal(s,source);assert.equal(e,excluded);assert.equal(o,options);return {url:'https://cdn.example/live.m3u8'};},
  });
  assert.equal(calls,1);assert.equal(result.resolved.url,'https://cdn.example/live.m3u8');assert.equal(result.session,undefined);
});
test('an unavailable source remains an error rather than switching to an unrelated channel',async()=>{
  await assert.rejects(resolvePlaybackRoute({id:'exact'},[],{}, {selectPlayback:async()=>{throw Error('CHANNEL_UNAVAILABLE');}}),/CHANNEL_UNAVAILABLE/);
});
test('deployment routes stay inside Netlify',async()=>{
  const config=await readFile(new URL('../../netlify.toml',import.meta.url),'utf8');
  for(const match of config.matchAll(/^\s*to\s*=\s*"([^"]+)"/gm))assert.ok(match[1].startsWith('/'),match[1]);
  const redirects=await readFile(new URL('../public/_redirects',import.meta.url),'utf8');
  for(const line of redirects.split('\n').filter(l=>l.trim()&&!l.startsWith('#')))assert.ok(line.trim().split(/\s+/)[1].startsWith('/'));
});
test('runtime code contains no connection to the retired hosting service',async()=>{
  async function inspect(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
      const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
      if(entry.isDirectory())await inspect(path);
      else if(/\.(m?js|html|json)$/.test(entry.name))assert.doesNotMatch(await readFile(path,'utf8'),/railway|openRelaySession|createRelayHealthCheck/i,path.pathname);
    }
  }
  for(const dir of ['../lib/','../functions/','../public/'])await inspect(new URL(dir,import.meta.url));
});
