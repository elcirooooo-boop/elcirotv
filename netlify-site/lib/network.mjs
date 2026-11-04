import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP, BlockList} from 'node:net';
const blocked=new BlockList();
for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['100.64.0.0',10],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]])blocked.addSubnet(ip,bits);
export function safeURL(value) {
  const url=new URL(value),host=url.hostname.toLowerCase();
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||(url.port&&!['80','443'].includes(url.port))||isIP(host)||!host.includes('.')||!/^[a-z0-9.-]+$/.test(host)||/(^|\.)(localhost|local|internal)$/.test(host))throw Error('INVALID_URL');
  return url;
}
export function pinnedLookup(address) {
  return (_host,options,callback)=>{
    // Node's automatic family selection requests all addresses (Node 20+).
    // Keep the already validated DNS address pinned in either callback format.
    if(options?.all)callback(null,[{address,family:4}]);
    else callback(null,address,4);
  };
}
export function playbackHeaders(referer='') {
  const headers={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36','Accept':'*/*','Accept-Encoding':'identity'};
  if(referer&&!/[\r\n]/.test(referer)){
    headers.Referer=referer;
    try{headers.Origin=safeURL(referer).origin;}catch{/* No invalid origin header. */}
  }
  return headers;
}
export async function request(value,referer='',range='',hop=0,{signal,timeout=12000}={}) {
  signal?.throwIfAborted();
  const url=safeURL(value);
  const addresses=await lookup(url.hostname,{all:true,family:4});
  signal?.throwIfAborted();
  const address=addresses.find(x=>!blocked.check(x.address));
  if(!address)throw Error('PRIVATE_ADDRESS');
  const headers=playbackHeaders(referer);
  if(/^bytes=\d+-\d*$/.test(range))headers.Range=range;
  const response=await new Promise((resolve,reject)=>{
    const req=(url.protocol==='https:'?https:http).get(url,{headers,lookup:pinnedLookup(address.address),signal},resolve);
    req.setTimeout(timeout,()=>req.destroy(Error('TIMEOUT')));req.on('error',reject);
  });
  if([301,302,303,307,308].includes(response.statusCode)) {
    response.resume();if(hop>=3||!response.headers.location)throw Error('REDIRECT_LIMIT');
    return request(new URL(response.headers.location,url).href,referer,range,hop+1,{signal,timeout});
  }
  return {response,url:url.href};
}
export async function read(response,limit=1500000) {
  const chunks=[];let size=0;
  for await(const chunk of response){size+=chunk.length;if(size>limit){response.destroy();throw Error('BODY_LIMIT');}chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
const players=new Set(['rojadirectatvmas.net','rojadirectatvplay.org','tarjetadigital.club','la18hd.su','tvf90.com'].flatMap(h=>[h,'www.'+h]));
export async function resolve(initial,options={}) {
  const pending=[[initial,'https://tarjetadigital.club/',0]],seen=new Set();
  const deadline=Date.now()+23000;
  while(pending.length&&seen.size<6&&Date.now()<deadline){
    options.signal?.throwIfAborted();
    const [value,referer,depth]=pending.shift(),target=safeURL(value);
    if(/\.m3u8$/i.test(target.pathname))return {url:target.href,referer};
    if(!players.has(target.hostname)||seen.has(target.href)||depth>3)continue;
    seen.add(target.href);
    try{
      const {response,url}=await request(target.href,referer,'',0,options);
      // Redirects are allowed only among the published player hosts.
      if(!players.has(new URL(url).hostname)||response.statusCode!==200){response.resume();continue;}
      const html=(await read(response)).replaceAll('\\/','/').replaceAll('&amp;','&');
      const hls=html.match(/\b(?:var|let|const)\s+playbackURL\s*=\s*["']([^"']+)["']/)?.[1] || html.match(/["']((?:https?:)?\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)["']/i)?.[1];
      if(hls){const media=safeURL(new URL(hls,url).href);if(/\.m3u8$/i.test(media.pathname))return {url:media.href,referer:url};}
      for(const match of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi))pending.push([new URL(match[1],url).href,url,depth+1]);
      const wrapped=new URL(url).searchParams.get('url');if(wrapped)pending.push([wrapped,url,depth+1]);
    }catch{/* Continue only with other frames from this exact selected source. */}
  }
  throw Error('SOURCE_UNAVAILABLE');
}
