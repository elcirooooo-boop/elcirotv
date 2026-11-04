import {selectPlayback} from './playback.mjs';
import {playbackKey} from './playback-key.mjs';
import {agenda} from './agenda.mjs';
import {withPublishedAlternatives} from './core.mjs';
export const playbackServices={selectPlayback,playbackKey,publishedSignals:async()=>(await agenda()).events.flatMap(event=>event.signals)};
export async function resolvePlaybackRoute(source,excluded=[],options={},deps=playbackServices){
  // Resolution, validation and signed media delivery all run in Netlify.
  try{return {resolved:await deps.selectPlayback(source,excluded,undefined,options)};}
  catch(error){
    // Consult the agenda only after registered players fail, keeping normal
    // channel startup independent of agenda refresh latency or availability.
    if(!deps.publishedSignals)throw error;
    let enhanced;
    try{enhanced=withPublishedAlternatives([source],await deps.publishedSignals())[0];}catch{throw error;}
    const existing=new Set((source.sources||[{url:source.url}]).map(item=>item.url));
    const added=enhanced.sources.filter(item=>!existing.has(item.url));
    if(!added.length)throw error;
    return {resolved:await deps.selectPlayback({...enhanced,sources:added},excluded,undefined,options)};
  }
}
