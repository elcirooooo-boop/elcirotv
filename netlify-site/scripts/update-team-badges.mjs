// Refresh the bundled catalogue from ESPN's public team directories.
// Run manually with: node scripts/update-team-badges.mjs
import {writeFile} from 'node:fs/promises';

const soccer = ['esp.1','eng.1','ita.1','ger.1','fra.1','por.1','ned.1','bel.1','sco.1','tur.1','gre.1','aut.1','sui.1','den.1','nor.1','swe.1','cze.1','pol.1','uefa.champions','uefa.europa','uefa.europa.conf','bra.1','bra.2','arg.1','arg.2','chi.1','chi.2','mex.1','mex.2','usa.1','col.1','ecu.1','per.1','uru.1','ven.1','par.1','bol.1','crc.1','hon.1','gua.1','slv.1','fifa.world'];
const directories = [
  ...soccer.map(league=>['soccer',league,'men']),
  ...['eng.w.1','esp.w.1','mex.w.1','usa.nwsl','fifa.wwc'].map(league=>['soccer',league,'women']),
  ['basketball','nba','men'],['basketball','wnba','women'],
  ['football','nfl','men'],['hockey','nhl','men'],['baseball','mlb','men'],
];
const teams = new Map(), failures = [];
let next = 0;
async function worker() {
  while(next < directories.length) {
    const [sport,league,gender] = directories[next++];
    try {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams?limit=1000`,{signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const entries = payload.sports?.[0]?.leagues?.[0]?.teams;
      if(!entries?.length)throw Error('No teams');
      for(const {team} of entries) {
        const logo = team.logos?.find(item=>item.rel?.includes('default'))?.href || team.logos?.[0]?.href;
        if(!logo || !/^https:\/\/a\.espncdn\.com\/(?:i\/teamlogos\/|guid\/[a-f0-9-]+\/logos\/)/.test(logo))continue;
        const key = `${sport}:${gender}:${team.id}`;
        const names = [team.displayName,team.name,team.shortDisplayName].filter(Boolean);
        const existing = teams.get(key);
        if(existing)existing.names = [...new Set([...existing.names,...names])];
        else teams.set(key,{id:key,sport,gender,names:[...new Set(names)],logo});
      }
    } catch(error) { failures.push(`${sport}/${league}: ${error.message}`); }
  }
}
await Promise.all(Array.from({length:6},worker));
const result = [...teams.values()].sort((a,b)=>a.id.localeCompare(b.id));
if(result.length < 500)throw Error(`Only ${result.length} teams received; keeping the previous catalogue.`);
await writeFile(new URL('../public/team-badges-data.js',import.meta.url),`// Public team names and crest URLs from ESPN. Refresh with scripts/update-team-badges.mjs.\nexport default ${JSON.stringify(result)};\n`);
console.log(`Saved ${result.length} teams. Unavailable directories: ${failures.join(', ') || 'none'}`);
