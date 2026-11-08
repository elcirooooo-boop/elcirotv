export function providerPlayerURL(value){
  const url=new URL(value);
  const legacy=['streamxhd.sbs','stream-xhd.com'].includes(url.hostname)&&url.pathname==='/live1.php'&&/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||'');
  const page={'/latin/us.html':'us','/latin/latin.html':'latin','/latin/soccer.html':'soccer'}[url.pathname];
  const futbolvivo=url.hostname==='redirectus.net'&&page&&url.searchParams.get('p')===page&&url.searchParams.get('d')==='redirectus.net'&&/^[1-9][0-9]{0,12}$/.test(url.searchParams.get(page==='soccer'?'m':'id')||'');
  if(url.protocol!=='https:'||url.username||url.password||url.port||!legacy&&!futbolvivo)throw Error('El reproductor del proveedor no es válido.');
  return url.href;
}
export function createExternalPlayer({container,sources,name,openInNewTab=false,onChange=()=>{},document=globalThis.document}){
  const urls=[...new Set(sources.map(s=>providerPlayerURL(s.url)))];
  if(!urls.length)throw Error('Este canal no tiene un reproductor publicado.');
  let index=0,disposed=false;
  if(openInNewTab){
    const link=document.createElement('a');link.className='primary-button';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir transmisión en el proveedor ↗';
    container.classList.add('external-launch');container.replaceChildren(link);link.href=urls[0];onChange({url:urls[0],index,total:urls.length});
    return {next(){},destroy(){disposed=true;link.remove();container.classList.remove('external-launch');}};
  }
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
