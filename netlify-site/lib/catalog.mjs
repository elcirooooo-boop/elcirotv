import catalog from './bot-catalog.json' with {type:'json'};
export const botChannels=catalog.channels;
export function channelSlug(signal){
  const url=new URL(signal.url),published=url.searchParams.get('stream');
  if(published)return catalog.aliases[published]||published;
  const name=signal.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const simple=name.replace(/\([^)]*\)/g,'').replace(/\b(hd|movil)\b/g,'').replace(/[^a-z0-9]/g,'');
  const disney=simple.match(/^disney0*(\d+)$/);
  if(disney&&catalog.aliases['disney'+Number(disney[1])])return 'disney'+Number(disney[1]);
  return catalog.aliases[simple]||null;
}
export function botSourceURLs(slug){
  if(!botChannels.some(c=>c.slug===slug))return [];
  const encoded=encodeURIComponent(slug);
  const sources=[`https://tvf90.com/5.php?stream=${encoded}`,`https://tvf90.com/plus1.php?stream=${encoded}`,`https://la18hd.su/vivo/canal.php?stream=${encoded}`];
  const page=catalog.pages[slug];if(page)sources.push('https://rojadirectatvplay.org/en-vivo/'+page);
  return sources;
}
