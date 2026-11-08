export function providerPlayerURL(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!['streamxhd.sbs','stream-xhd.com'].includes(url.hostname)||url.pathname!=='/live1.php'||!/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||''))throw Error('El reproductor del proveedor no es válido.');
  return url.href;
}
export function createExternalPlayer({container,sources,name,onChange=()=>{},document=globalThis.document}){
  const urls=[...new Set(sources.map(s=>providerPlayerURL(s.url)))];
  if(!urls.length)throw Error('Este canal no tiene un reproductor publicado.');
  let index=0,disposed=false;
  const frame=document.createElement('iframe');
  frame.title='Reproductor del proveedor · '+name;
  frame.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');
  frame.setAttribute('allowfullscreen','');
  frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation allow-popups');
  frame.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
  frame.className='external-player';
  container.replaceChildren(frame);
  const open=()=>{if(disposed)return;frame.src=urls[index];onChange({url:urls[index],index,total:urls.length});};
  open();
  return {next(){if(disposed)return;index=(index+1)%urls.length;open();},destroy(){disposed=true;frame.src='about:blank';frame.remove();}};
}
