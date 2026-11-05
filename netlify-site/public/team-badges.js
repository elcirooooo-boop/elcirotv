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
};
const index = new Map();
for(const team of catalogue) {
  for(const name of [...team.names,...(aliases[team.id] || [])]) {
    const lookup = `${team.sport}:${team.gender}:${key(name)}`;
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
  return index.get(`${sport}:${gender}:${normalized}`) || null;
}

export function teamBadges(event) {
  const names = matchTeams(event);
  if(!names.length)return '';
  const league = /^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/i.exec(event.title)?.[1] || event.league;
  const badge = name => {
    const team = teamBadge(name,league);
    const initials = name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>[...word][0]).join('').toLocaleUpperCase();
    const logo = team && /^https:\/\/a\.espncdn\.com\/(?:i\/teamlogos\/|guid\/[a-f0-9-]+\/logos\/)/.test(team.logo) ? team.logo : '';
    return `<span class="team-badge" title="${escape(name)}">${logo?`<img data-team-badge src="${escape(logo)}" alt="" width="32" height="32" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:''}<span class="team-initials"${logo?' hidden':''}>${escape(initials)}</span></span>`;
  };
  return `<span class="match-badges" aria-hidden="true">${badge(names[0])}<span class="badge-versus">vs</span>${badge(names[1])}</span>`;
}

export function handleBadgeError(event) {
  const image = event.target;
  if(!image?.matches?.('img[data-team-badge]'))return;
  const fallback = image.nextElementSibling;
  if(fallback)fallback.hidden = false;
  image.remove();
}
