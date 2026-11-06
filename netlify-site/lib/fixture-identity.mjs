import {matchTeams,teamBadge} from '../public/team-badges.js';

const text = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[øłđæß]/g,char=>({'ø':'o','ł':'l','đ':'d','æ':'ae','ß':'ss'}[char])).replace(/[^a-z0-9]+/g,' ').trim();
const competitions = new Map([
  ['liga profesional','liga profesional argentina'],
  ['liga profesional argentina','liga profesional argentina'],
]);

// Only known aliases are equivalent. A cup, women's competition, age group,
// or another kickoff must not disappear just because the club names match.
export function fixtureIdentity(event) {
  const names = matchTeams(event);
  if(names.length !== 2)return null;
  const league = /^(NFL|NBA|WNBA|NHL|MLB)\s*[-–—:]/i.exec(event.title)?.[1] || event.league;
  const competition = competitions.get(text(league)) || text(league);
  const teams = names.map(name=>teamBadge(name,league)?.id || `name:${text(name)}`);
  return JSON.stringify([competition,...teams]);
}
