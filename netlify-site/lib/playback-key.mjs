import {randomBytes} from 'node:crypto';
import {getStore} from '@netlify/blobs';
let cached;
export async function playbackKey() {
  if(process.env.HLS_PROXY_SECRET?.length>=32)return process.env.HLS_PROXY_SECRET;
  if(cached)return cached;
  const store=getStore('playback-keys');
  let key=await store.get('hls-v1',{consistency:'strong'});
  if(!key){
    await store.set('hls-v1',randomBytes(32).toString('hex'),{onlyIfNew:true});
    key=await store.get('hls-v1',{consistency:'strong'});
  }
  if(typeof key!=='string'||key.length<32)throw Error('PLAYBACK_KEY_UNAVAILABLE');
  cached=key;return key;
}
