import catalog from './bot-catalog.json' with {type:'json'};
export const botChannels=catalog.channels;
// Exact additional channel/provider published by the match agenda. Keep the
// numbered stream unchanged; /1.php is the player variant, not Premiere 1.
const supplementalSources={
  premiere5:['https://tvf90.com/1.php?stream=premiere5'],
};
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
  if(Object.hasOwn(supplementalSources,slug))return [...supplementalSources[slug]];
  if(!botChannels.some(c=>c.slug===slug))return [];
  const clean=slug.replaceAll('_','-'),encoded=encodeURIComponent(clean);
  const sources=[`https://tvf90.com/5.php?stream=${encoded}`,`https://tvf90.com/plus1.php?stream=${encoded}`];
  const compact=clean.replaceAll('-','');if(compact!==clean)sources.push(`https://tvf90.com/5.php?stream=${encodeURIComponent(compact)}`);
  const providerSlug=catalog.providerAliases?.[slug]||catalog.providerAliases?.[clean]||slug;
  sources.push(`https://la18hd.su/vivo/canal.php?stream=${encodeURIComponent(providerSlug)}`);
  const page=catalog.pages[slug];if(page)sources.push('https://rojadirectatvplay.org/en-vivo/'+page);
  return sources;
}
