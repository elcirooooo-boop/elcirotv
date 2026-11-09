export function providerPlayerURL(value){
  const url=new URL(value);
  const legacy=['streamxhd.sbs','stream-xhd.com'].includes(url.hostname)&&url.pathname==='/live1.php'&&/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||'');
  const page={'/latin/us.html':'us','/latin/latin.html':'latin','/latin/soccer.html':'soccer'}[url.pathname];
  const direct=url.hostname==='streamec.st'&&/^\/embed\/ch[0-9]{1,8}\.php$/.test(url.pathname)||url.hostname==='redirectus.net'&&(url.pathname==='/streameast.html'&&/^[1-9][0-9]{0,12}$/.test(url.searchParams.get('id')||'')||url.pathname==='/streame.html'&&/^sc-ch[0-9]{1,8}$/.test(url.searchParams.get('key')||''));
  const latin=['tvf90.com','futbollibre.ch'].includes(url.hostname)&&/^\/(?:1|2|3|5|hd|canal|plus1|online)\.php$/.test(url.pathname)&&/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||'')||url.hostname==='tv-90.com'&&['/drm/dsports.php','/drm/clarosports.php'].includes(url.pathname)||url.hostname==='redirectus.net'&&url.pathname==='/streamlat.html'&&/^n[0-9]+-[a-f0-9]{16}$/.test(url.searchParams.get('id')||'');
  const classic=url.hostname==='la18hd.su'&&url.pathname==='/vivo/canal.php'&&/^[-a-z0-9_]{1,80}$/i.test(url.searchParams.get('stream')||'');
  const futbolvivo=classic||latin||direct||url.hostname==='redirectus.net'&&page&&url.searchParams.get('p')===page&&url.searchParams.get('d')==='redirectus.net'&&/^[1-9][0-9]{0,12}$/.test(url.searchParams.get(page==='soccer'?'m':'id')||'');
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
  const open=()=>{if(disposed)return;const url=new URL(urls[index]);
    // These published embeds require a standard cross-origin iframe.
    // Keep browser same-origin isolation and never change CSP or frame policies.
    if(['streamec.st','tvf90.com','la18hd.su','tv-90.com','futbollibre.ch','redirectus.net'].includes(url.hostname))frame.removeAttribute('sandbox');
    else frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation allow-popups');
    frame.src=urls[index];onChange({url:urls[index],index,total:urls.length});};
  open();
  return {next(){if(disposed)return;index=(index+1)%urls.length;open();},destroy(){disposed=true;frame.src='about:blank';frame.remove();}};
}
