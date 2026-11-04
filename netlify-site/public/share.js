export function matchShareData(event,origin){
  return {
    title:event.title+' · El Ciro TV',
    text:event.title+' · '+event.league+' · '+event.time,
    url:new URL('/partido/'+encodeURIComponent(event.id),origin).href
  };
}
export function telegramShareURL(data){
  const url=new URL('https://t.me/share/url');
  url.searchParams.set('url',data.url);url.searchParams.set('text',data.text+' · El Ciro TV');
  return url.href;
}
export async function copyShareLink(data,platform=navigator){
  try{
    if(!platform.clipboard?.writeText)return 'manual';
    await platform.clipboard.writeText(data.url);return 'copied';
  }catch{return 'manual';}
}
export async function shareMatch(data,platform=navigator){
  if(platform.share){
    try{await platform.share(data);return 'shared';}
    catch(error){if(error.name==='AbortError')return 'cancelled';}
  }
  return copyShareLink(data,platform);
}
