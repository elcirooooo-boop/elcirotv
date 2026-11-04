import {selectPlayback} from './playback.mjs';
import {playbackKey} from './playback-key.mjs';
export const playbackServices={selectPlayback,playbackKey};
export async function resolvePlaybackRoute(source,excluded=[],options={},deps=playbackServices){
  // Resolution, validation and signed media delivery all run in Netlify.
  return {resolved:await deps.selectPlayback(source,excluded,undefined,options)};
}
