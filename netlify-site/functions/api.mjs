import {Readable} from 'node:stream';
import {getStore} from '@netlify/blobs';
import {agenda} from '../lib/agenda.mjs';
import {publicAgenda,grant,verify,manifest,catalogSignals} from '../lib/core.mjs';
import {request,read} from '../lib/network.mjs';
import {bucket,viewerCounts} from '../lib/viewers.mjs';
import {playbackKey} from '../lib/playback-key.mjs';
import {resolvePlaybackRoute} from '../lib/playback-route.mjs';
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export default async function handler(req) {
  const url=new URL(req.url),action=url.pathname.split('/').filter(Boolean).at(-1);
  const expectedMethod=action==='presence'?'POST':'GET';
  if(req.method!==expectedMethod)return json({error:'Método no permitido.'},405,{'Allow':expectedMethod});
  try {
    if(action==='agenda')return json(publicAgenda(await agenda()),200,{'Netlify-CDN-Cache-Control':'public, max-age=45, stale-while-revalidate=45'});
    if(action==='play'){
      const id=url.searchParams.get('source');
      const source=catalogSignals().find(s=>s.id===id)||(await agenda()).events.flatMap(e=>e.signals).find(s=>s.id===id);
      if(!source)return json({error:'Esta señal ya no está publicada. Actualiza la agenda.'},404);
      const excluded=(url.searchParams.get('exclude')||'').split(',').filter(id=>/^[a-f0-9]{24}$/.test(id)).slice(0,8);
      let route;try{route=await resolvePlaybackRoute(source,excluded,{refresh:url.searchParams.get('refresh')==='1'});}catch{return json({error:'Este canal no tiene una señal disponible en este momento.'},503);}
      if(route.session)return json(route.session);
      const {resolved}=route;
      return json({url:'/api/media?t='+encodeURIComponent(grant(resolved.url,resolved.referer,undefined,await playbackKey())),name:source.name,sourceKey:resolved.sourceKey});
    }
    if(action==='media'){
      const token=url.searchParams.get('t');
      if(!token||!token.includes('.'))return json({error:'La sesión venció. Vuelve a abrir la señal.'},403);
      const key=await playbackKey();
      let permission;try{permission=verify(token,key);}catch{return json({error:'La sesión venció. Vuelve a abrir la señal.'},403);}
      const {response,url:finalURL}=await request(permission.url,permission.referer,req.headers.get('range')||'');
      const type=String(response.headers['content-type']||'application/octet-stream');
      if(response.statusCode<200||response.statusCode>=300||/html|javascript|json|svg/i.test(type)){response.resume();return json({error:'Señal no disponible.'},502);}
      if(/mpegurl/i.test(type)||new URL(finalURL).pathname.endsWith('.m3u8'))return new Response(manifest(await read(response,1000000),finalURL,permission.referer,permission.expiry,key),{headers:{'Content-Type':'application/vnd.apple.mpegurl','Cache-Control':'no-store'}});
      const headers={'Content-Type':type,'Cache-Control':'private, max-age=5','X-Content-Type-Options':'nosniff'};
      for(const key of ['content-range','accept-ranges'])if(response.headers[key])headers[key]=response.headers[key];
      // HLS uses short segments; stop before the platform's streamed response limit.
      let size=0;
      const bounded=Readable.toWeb(response).pipeThrough(new TransformStream({transform(chunk,controller){size+=chunk.byteLength;if(size>19000000)throw Error('SEGMENT_LIMIT');controller.enqueue(chunk);}}));
      return new Response(bounded,{status:response.statusCode,headers});
    }
    if(action==='presence'){
      if(req.headers.get('origin')!==url.origin)return json({error:'Origen no válido.'},403);
      if(Number(req.headers.get('content-length')||0)>2048)return json({error:'Solicitud demasiado grande.'},413);
      const text=await req.text();if(text.length>2048)return json({error:'Solicitud demasiado grande.'},413);
      const body=JSON.parse(text);
      if(!/^[a-f0-9-]{36}$/.test(body.session||''))return json({error:'Sesión no válida.'},400);
      const data=await agenda(),event=data.events.find(e=>e.id===body.match);
      if(body.match&&!event)return json({error:'Partido no válido.'},400);
      const now=Date.now(),store=getStore('live-viewers'),key=`${bucket(now)}/${body.session}`;
      await store.setJSON(key,{session:body.session,match:event?.id||'',playing:body.playing===true,at:now});
      return json({ok:true});
    }
    if(action==='viewers'){
      const now=Date.now(),current=bucket(now),store=getStore('live-viewers');
      const pages=await Promise.all([current,current-1,current-2].map(b=>store.list({prefix:b+'/'})));
      const records=(await Promise.all(pages.flatMap(page=>page.blobs).map(blob=>store.get(blob.key,{type:'json'})))).filter(Boolean);
      return json({counts:viewerCounts(records,now)},200,{'Netlify-CDN-Cache-Control':'public, max-age=10'});
    }
    return json({error:'Ruta no encontrada.'},404);
  }catch{return json({error:action==='agenda'?'No se pudo actualizar la agenda. Intenta de nuevo.':'La señal no está disponible. Prueba otra opción.'},503);}
}
