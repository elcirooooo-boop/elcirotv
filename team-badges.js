import baseCatalogue from './team-badges-data.js?v=20261107';
import extraCatalogue from './team-badges-extra.js?v=20261107e';
const catalogue=[...baseCatalogue,...extraCatalogue];
import countryFlags from './country-flags-data.js';

const escape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const key = value => String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[øłđæß]/g,char=>({'ø':'o','ł':'l','đ':'d','æ':'ae','ß':'ss'}[char])).replace(/[^a-z0-9]+/g,' ').trim();
const aliases = {
  'soccer:men:167':['Olympique Lyonnais','Olympique Lyon'],
  'soccer:men:2994':['Sporting Braga'],
  'soccer:men:2528':['Kairat'],
  'soccer:men:2790':['Salzburg','Red Bull Salzburg'],
  'soccer:men:7239':['CS Cartagines'],
  'soccer:men:4139':['Universidad Chile'],
  'soccer:men:5362':['Univ. Concepción'],
  'soccer:men:858':['Deportivo Saprissa'],
  'soccer:men:862':['CS Herediano'],
  'soccer:men:10129':['Leones Negros UdeG','Leones Negros UDG'],
  'soccer:men:96':['Deportivo Alavés'],
  'soccer:men:268':["Borussia M'gladbach"],
  'soccer:men:127':['Hamburger SV'],
  'soccer:men:15720':['Atlético San Luis'],
  'soccer:men:2690':['Medellín'],
  'soccer:men:4438':['CD Castellon'],
  'soccer:men:3731':['VVV'],
  'soccer:men:9983':['PSV II'],
  'soccer:men:3067':['Eintracht Braunschweig'],
  'soccer:men:10158':['Sarmiento'],
  'soccer:men:225':['Santos Laguna'],
  'soccer:men:17530':['Venecia'],
  'soccer:men:132':['Bayern München','Bayern Múnich'],
  'soccer:men:2950':['Mainz 05'],
  'soccer:men:269':['Nürnberg','Núremberg'],
  'soccer:men:3812':['Darmstadt 98'],
  'soccer:men:104':['Roma'],
  'soccer:men:129':['Hertha BSC'],
  'soccer:men:90':['Deportivo La Coruña','Deportivo de A Coruña'],
  'soccer:men:271':['Den Bosch'],
  'soccer:men:18278':['Utrecht II'],
  'soccer:men:131858':['Celta de Vigo II','Celta de Vigo B'],
  'soccer:men:132335':['Amed SK','Amedspor'],
  'soccer:men:19685':['Estudiantes Río Cuarto'],
  'soccer:men:7632':['Atlético Mineiro'],
  'soccer:men:9762':['Rionegro Águilas'],
  'soccer:men:11124':['Guayaquil City'],
  'soccer:men:22534':['Juan Pablo II College'],
  'soccer:men:221':['Atlético Morelia','Atl. Morelia'],
  'soccer:men:7884':['Kiel'],
  'soccer:men:381':['Norwich'],
  'soccer:men:357':['Leeds Utd'],
  'soccer:men:367':['Tottenham'],
  'soccer:men:12597':['Burgos CF'],
  'soccer:men:87':['R. Racing Club'],
  'soccer:men:125':['Eintracht Fráncfort'],
  'soccer:men:3841':['Augsburgo'],
  'soccer:men:21607':['Academico Viseu'],
  'soccer:men:143':['Sittard'],
  'soccer:men:7914':['Başakşehir'],
  'soccer:men:107':['Bolonia'],
  'soccer:men:5404':['AD Ceuta'],
  'soccer:men:2726':['Den Haag'],
  'soccer:men:21314':['AD Tarma'],
  'soccer:men:6851':['Paris'],
  'soccer:men:8':['Estudiantes L.P.'],
  'soccer:men:138':['Wolfsburgo'],
  'soccer:men:3706':['G.A. Eagles'],
  'soccer:men:3':['Argentinos Jrs.'],
  'soccer:men:8110':['Dep. Concepción'],
  'soccer:men:182':['Chicago Fire'],
  'soccer:men:193':['DC United'],
  'soccer:men:17606':['New York City'],
  'soccer:men:20232':['Inter Miami'],
  'soccer:men:18418':['Atlanta Utd'],
  'soccer:men:12011':['Orlando City'],
  'soccer:men:131702':['Leones del Norte'],
  'soccer:men:6077':['Houston Dynamo'],
  'soccer:men:21812':['St. Louis City'],
  'soccer:men:17362':['Minnesota United'],
  'soccer:men:187':['Los Angeles Galaxy'],
  'soccer:men:9726':['Seattle Sounders'],
  'soccer:men:18966':['Los Angeles FC'],
  'soccer:men:20705':['Sporting FC'],
  'soccer:men:21533':['Atl. La Paz'],
  'soccer:men:227':['Club América'],
  'soccer:men:261':['Dundee FC'],
  'soccer:men:314':['Lincoln'],
  'soccer:men:190':['New York Red Bulls'],
};
const index = new Map();
const candidates = new Map();
for(const team of catalogue) {
  for(const name of [...team.names,...(aliases[team.id] || [])]) {
    const lookup = `${team.sport}:${team.gender}:${key(name)}`;
    if(!candidates.has(lookup))candidates.set(lookup,new Set());
    candidates.get(lookup).add(team);
    if(index.has(lookup) && index.get(lookup)?.id !== team.id)index.set(lookup,null);
    else if(!index.has(lookup))index.set(lookup,team);
  }
}

export function matchTeams(event) {
  let title = String(event.title || '').replace(/^(?:NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]\s*/i,'');
  title=title.replace(/^Mexico City Game\s*[-–—:]\s*/i,'');
  // Feed headings precede the actual national-team matchup.
  if(/^(?:Rugby|Voleibol|Volleyball|Baloncesto)\s*[-–—:]/i.test(title))title=title.split(/\s+[-–—]\s+/).at(-1);
  const parts = title.split(/\s+(?:vs?\.?|versus)\s+/iu).map(name=>name.trim());
  return parts.length === 2 && parts.every(Boolean) ? parts : [];
}

export function teamBadge(name, league='') {
  const competition = key(league);
  // Never give a women's or youth team the men's first-team crest by guessing.
  if(/\b(?:u|sub)\s*\d{2}\b/.test(key(name+' '+league)))return null;
  const gender = /\b(?:femenil|femenino|femenina|women|womens|wnba|nwsl)\b/.test(key(name+' '+league)) ? 'women' : 'men';
  const sport = /\b(?:nhl|hockey)\b/.test(competition) ? 'hockey'
    : /\b(?:nfl|futbol americano|ncaa football|college football)\b/.test(competition) ? 'football'
    : /\b(?:nba|wnba|basket|basketball|baloncesto|euroliga)\b/.test(competition) ? 'basketball'
    : /\b(?:mlb|baseball|beisbol)\b/.test(competition) ? 'baseball'
    : /\b(?:tenis|tennis|atp|wta|rugby|voleibol|volleyball|balonmano|handball|futsal|futbol sala|boxeo|boxing|ufc|mma|formula|motogp)\b/.test(competition) ? null : 'soccer';
  if(!sport)return null;
  const normalized = key(String(name).replace(/^#\d+\s*/, '')).replace(/\b(?:femenil|femenino|femenina|women|womens)\b/g,'').replace(/\s+/g,' ').trim();
  const lookup=`${sport}:${gender}:${normalized}`;
  const strictLeague=[[/\bwnba\b/,'wnba'],[/\bnba\b/,'nba'],[/\bnfl\b/,'nfl'],[/\bnhl\b/,'nhl'],[/\bmlb\b/,'mlb'],[/liga endesa|\bacb\b/,'acb']].find(([pattern])=>pattern.test(competition))?.[1];
  if(strictLeague){const matches=[...(candidates.get(lookup)||[])].filter(t=>t.leagues?.includes(strictLeague));return matches.length===1?matches[0]:null;}
  const leagues=[[/liga profesional|argentina/,'arg.1'],[/brasileir|brasil/,'bra.1'],[/primera a|colombia/,'col.1'],[/liga mx/,'mex.1'],[/laliga|liga espan/,'esp.1'],[/premier league/,'eng.1'],[/serie a/,'ita.1'],[/bundesliga/,'ger.1'],[/portugal|primeira liga/,'por.1'],[/ecuador/,'ecu.1'],[/paraguay/,'par.1'],[/costa rica/,'crc.1'],[/mls/,'usa.1']];
  if(normalized==='san carlos'&&/costa rica/.test(competition))return [...(candidates.get(lookup)||[])].find(t=>t.id==='soccer:men:859')||null;
  const leagueCode=leagues.find(([pattern])=>pattern.test(competition))?.[1];
  if(leagueCode){const matches=[...(candidates.get(lookup)||[])].filter(t=>t.leagues?.includes(leagueCode));if(matches.length===1)return matches[0];}
  return index.get(lookup) || null;
}

export function competitionBadge(event){
  const context=key(`${event.league||''} ${event.title||''}`);
  for(const [pattern,label,logo] of [
    [/motogp|moto2|moto3/,'MotoGP','motorsport'],[/rugby|six nations|nations championship/,'Rugby','rugby'],
    [/ncaa.*football|college football/,'NCAA Football','american-football'],
    [/voleibol|volleyball/,'Voleibol','volleyball'],[/balonmano|handball/,'Balonmano','handball'],
    [/\bpolo\b/,'Polo','polo'],[/ciclismo|cycling/,'Ciclismo','cycling'],
    [/\bwnba\b/,'WNBA','wnba'],[/\bnba\b/,'NBA','nba'],[/\bnfl\b|futbol americano/,'NFL','nfl'],[/\bnhl\b/,'NHL','nhl'],[/\bmlb\b/,'MLB','mlb'],
    [/\bf1\b|formula 1|formula uno/,'Fórmula 1','f1'],
    [/\bwta\b/,'WTA','tennis'],[/\batp\b|masters 1000/,'ATP Tour','atp'],[/tenis|tennis|wimbledon|roland garros|australian open|us open/,'Tenis','tennis'],
    [/padel/,'Pádel','tennis'],[/golf|pga|abu dhabi championship/,'Golf','golf'],[/ufc/,'UFC','ufc'],
    [/boxeo|boxing|knockout|bxstrs/,'Boxeo','boxing'],[/baloncesto|basket|euroliga/,'Baloncesto','basketball'],
    [/futbol sala|futsal/,'Fútbol sala','soccer'],
    [/laliga smartbank|laliga 2|segunda division/,'LaLiga 2','laliga2'],[/laliga/,'LaLiga','laliga'],
    [/2 bundesliga/,'2. Bundesliga','bundesliga2'],[/bundesliga/,'Bundesliga','bundesliga'],
    [/canadian premier league/,'Canadian Premier League','soccer'],
    [/premier league/,'Premier League','premier'],[/championship/,'Championship','championship'],[/fa cup/,'FA Cup','facup'],
    [/eerste divisie/,'Eerste Divisie','eerstedivisie'],[/eredivisie/,'Eredivisie','eredivisie'],
    [/ligue 1/,'Ligue 1','ligue1'],[/serie a/,'Serie A','seriea'],[/liga profesional/,'Liga Profesional Argentina','argentina'],
    [/brasileirao/,'Brasileirão','brasil'],[/liga mx/,'Liga MX','ligamx'],[/primera a/,'Primera A','colombia'],
  ])if(pattern.test(context))return {label,logo:`/logos/${logo === 'motorsport' ? 'motogp' : logo}.${['motorsport','rugby','american-football','volleyball','handball','polo','cycling'].includes(logo)?'svg':'png'}`,individual:/f1|atp|tennis|golf|ufc|boxing|motorsport|polo|cycling/.test(logo)};
  return {label:event.league&&event.league!=='Deportes'?event.league:'Deportes',logo:matchTeams(event).length?'/logos/soccer.png':'/logos/sports.svg',individual:false};
}
function competitionMarkup(competition){
  return `<span class="match-badges competition-badge" aria-hidden="true" title="${escape(competition.label)}">${competition.logo?`<img data-team-badge src="${escape(competition.logo)}" alt="" width="64" height="40" loading="lazy"><span class="team-initials" hidden>DEP</span>`:''}<span class="competition-label">${escape(competition.label)}</span></span>`;
}
export function countryCode(name){
  const country=key(name).replace(/^seleccion (?:nacional )?(?:de )?/,'').replace(/\b(?:sub|u)\s*\d{1,2}\b/g,'').replace(/\b(?:femenil|femenino|femenina|women|womens|masculino|masculina)\b/g,'').replace(/\s+/g,' ').trim();
  return countryFlags[country] || null;
}
export function teamBadges(event) {
  const names = matchTeams(event);
  const competition=competitionBadge(event);
  const countries=names.map(countryCode);
  if(names.length===2&&countries.every(Boolean)){
    const flags=names.map((name,i)=>`<span class="team-badge country-badge" title="${escape(name)}"><img data-team-badge class="country-flag" src="/flags/${countries[i]}.svg" alt="" width="32" height="24" loading="lazy" decoding="async"><span class="team-initials" hidden>${countries[i].slice(0,2).toUpperCase()}</span></span>`);
    return `<span class="match-badges national-teams" aria-hidden="true">${flags[0]}<span class="badge-versus">vs</span>${flags[1]}</span>`;
  }
  if(!names.length||competition.individual)return competitionMarkup(competition);
  const league = /^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/i.exec(event.title)?.[1] || event.league;
  const badge = name => {
    const team = teamBadge(name,league);
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>[...word][0]).join('').toLocaleUpperCase();
    const logo = team && (/^https:\/\/a\.espncdn\.com\/(?:i\/teamlogos\/|guid\/[a-f0-9-]+\/logos\/)/.test(team.logo)||/^\/logos\/teams\/[a-z0-9-]+\.png$/.test(team.logo)) ? team.logo : competition.logo;
    return `<span class="team-badge" title="${escape(team?name:competition.label)}">${logo?`<img data-team-badge data-fallback="${escape(competition.logo)}" src="${escape(logo)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<span class="team-initials"${logo?' hidden':''}>${escape(initials)}</span></span>`;
  };
  return `<span class="match-badges" aria-hidden="true">${badge(names[0])}<span class="badge-versus">vs</span>${badge(names[1])}</span>`;
}

export function handleBadgeError(event) {
  const image = event.target;
  if(!image?.matches?.('img[data-team-badge]'))return;
  if(image.dataset?.fallback&&image.getAttribute('src')!==image.dataset.fallback){image.src=image.dataset.fallback;delete image.dataset.fallback;return;}
  const fallback = image.nextElementSibling;
  if(fallback)fallback.hidden = false;
  image.remove();
}
