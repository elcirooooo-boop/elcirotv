import catalogue from './team-badges-data.js';

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
  const title = String(event.title || '').replace(/^(?:NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]\s*/i,'');
  const parts = title.split(/\s+(?:vs?\.?|versus)\s+/iu).map(name=>name.trim());
  return parts.length === 2 && parts.every(Boolean) ? parts : [];
}

export function teamBadge(name, league='') {
  const competition = key(league);
  // Never give a women's or youth team the men's first-team crest by guessing.
  if(/\b(?:u|sub)\s*\d{2}\b/.test(key(name+' '+league)))return null;
  const gender = /\b(?:femenil|femenino|femenina|women|womens|wnba|nwsl)\b/.test(key(name+' '+league)) ? 'women' : 'men';
  const sport = /\b(?:nhl|hockey)\b/.test(competition) ? 'hockey'
    : /\b(?:nfl|futbol americano)\b/.test(competition) ? 'football'
    : /\b(?:nba|wnba|basket|basketball|baloncesto|euroliga)\b/.test(competition) ? 'basketball'
    : /\b(?:mlb|baseball|beisbol)\b/.test(competition) ? 'baseball'
    : /\b(?:tenis|tennis|atp|wta|rugby|voleibol|volleyball|balonmano|handball|futsal|futbol sala|boxeo|boxing|ufc|mma|formula|motogp)\b/.test(competition) ? null : 'soccer';
  if(!sport)return null;
  const normalized = key(name).replace(/\b(?:femenil|femenino|femenina|women|womens)\b/g,'').replace(/\s+/g,' ').trim();
  const lookup=`${sport}:${gender}:${normalized}`;
  const leagues=[[/liga profesional|argentina/,'arg.1'],[/brasileir|brasil/,'bra.1'],[/primera a|colombia/,'col.1'],[/liga mx/,'mex.1'],[/laliga|liga espan/,'esp.1'],[/premier league/,'eng.1']];
  const leagueCode=leagues.find(([pattern])=>pattern.test(competition))?.[1];
  if(leagueCode){const matches=[...(candidates.get(lookup)||[])].filter(t=>t.leagues?.includes(leagueCode));if(matches.length===1)return matches[0];}
  return index.get(lookup) || null;
}

export function competitionBadge(event){
  const context=key(`${event.league||''} ${event.title||''}`);
  for(const [pattern,label,logo] of [
    [/\bwnba\b/,'WNBA','wnba'],[/\bnba\b/,'NBA','nba'],[/\bnfl\b|futbol americano/,'NFL','nfl'],[/\bnhl\b/,'NHL','nhl'],[/\bmlb\b/,'MLB','mlb'],
    [/\bf1\b|formula 1|formula uno/,'Fórmula 1','f1'],
    [/\bwta\b/,'WTA','tennis'],[/\batp\b|masters 1000/,'ATP Tour','atp'],[/tenis|tennis|wimbledon|roland garros|australian open|us open/,'Tenis','tennis'],
    [/padel/,'Pádel','tennis'],[/golf|pga|abu dhabi championship/,'Golf','golf'],[/ufc/,'UFC','ufc'],
    [/boxeo|boxing|knockout|bxstrs/,'Boxeo','boxing'],[/baloncesto|basket|euroliga/,'Baloncesto','basketball'],
    [/futbol sala|futsal/,'Fútbol sala','soccer'],
    [/laliga smartbank|laliga 2|segunda division/,'LaLiga 2','laliga2'],[/laliga/,'LaLiga','laliga'],
    [/2 bundesliga/,'2. Bundesliga','bundesliga2'],[/bundesliga/,'Bundesliga','bundesliga'],
    [/premier league/,'Premier League','premier'],[/championship/,'Championship','championship'],[/fa cup/,'FA Cup','facup'],
    [/eerste divisie/,'Eerste Divisie','eerstedivisie'],[/eredivisie/,'Eredivisie','eredivisie'],
    [/ligue 1/,'Ligue 1','ligue1'],[/serie a/,'Serie A','seriea'],[/liga profesional/,'Liga Profesional Argentina','argentina'],
    [/brasileirao/,'Brasileirão','brasil'],[/liga mx/,'Liga MX','ligamx'],[/primera a/,'Primera A','colombia'],
  ])if(pattern.test(context))return {label,logo:`/logos/${logo}.png`,individual:/f1|atp|tennis|golf|ufc|boxing/.test(logo)};
  return {label:event.league&&event.league!=='Deportes'?event.league:'Deportes',logo:matchTeams(event).length?'/logos/soccer.png':'',individual:false};
}
function competitionMarkup(competition){
  return `<span class="match-badges competition-badge" aria-hidden="true" title="${escape(competition.label)}">${competition.logo?`<img data-team-badge src="${escape(competition.logo)}" alt="" width="64" height="40" loading="lazy"><span class="team-initials" hidden>DEP</span>`:''}<span class="competition-label">${escape(competition.label)}</span></span>`;
}
export function teamBadges(event) {
  const names = matchTeams(event);
  const competition=competitionBadge(event);
  if(!names.length||competition.individual)return competitionMarkup(competition);
  const league = /^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/i.exec(event.title)?.[1] || event.league;
  const badge = name => {
    const team = teamBadge(name,league);
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>[...word][0]).join('').toLocaleUpperCase();
    const logo = team && /^https:\/\/a\.espncdn\.com\/(?:i\/teamlogos\/|guid\/[a-f0-9-]+\/logos\/)/.test(team.logo) ? team.logo : competition.logo;
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
