import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,merge,hash} from '../lib/core.mjs';
import {matchSchedule,scheduleText} from '../public/schedule.js';
const now=new Date('2026-11-04T16:00:00Z');
test('both feeds agree on Flamengo kick-off and merge channels instead of duplicating the match',()=>{
  const strapi=normalize([{diary_description:'Brasileirão: Flamengo vs Grêmio',date_diary:'2026-11-04',diary_hour:'17:30:00',embeds:[{name:'First',url:'https://tvf90.com/1.php?stream=premiere5'}]}],now);
  const tarjeta=normalize([{title:'Brasileirão: Flamengo vs Grêmio',date:'2026-11-04',time:'17:30:00',embeds:[{name:'Second',url:'https://la18hd.su/vivo/canal.php?stream=premiere5'}]}],now);
  assert.equal(tarjeta[0].startsAt,'2026-11-04T22:30:00.000Z');
  assert.equal(tarjeta[0].time,'18:30');assert.equal(tarjeta[0].id,strapi[0].id);
  const events=merge([strapi,tarjeta]);assert.equal(events.length,1);assert.equal(events[0].signals.length,2);
  assert.ok(events[0].legacyIds.includes(hash('2026-11-04T17:30:00.000Z|brasileirao|flamengo-vs-gremio')));
  const [venezuela,spain]=matchSchedule(events[0]);
  assert.equal(venezuela.time.replace(/\s/g,' '),'6:30 p. m.');assert.equal(spain.time.replace(/\s/g,' '),'11:30 p. m.');
  assert.equal(venezuela.date,spain.date);assert.equal(spain.label,'España peninsular');
});
test('Spain shows its own next-day date for late Venezuelan matches',()=>{
  const [ve,es]=matchSchedule({startsAt:'2026-11-05T02:30:00Z'});
  assert.match(ve.date,/4/);assert.match(es.date,/5/);
  assert.match(scheduleText({startsAt:'2026-11-05T02:30:00Z'}),/Venezuela:.*España peninsular:/);
});
test('Spain daylight saving changes automatically and Venezuela keeps its offset',()=>{
  const winter=matchSchedule({startsAt:'2026-01-15T22:30:00Z'});
  const summer=matchSchedule({startsAt:'2026-07-15T22:30:00Z'});
  assert.equal(winter[0].time,summer[0].time);
  assert.match(winter[1].time,/11:30/);assert.match(summer[1].time,/12:30/);
  assert.match(summer[1].date,/16/);
});
test('explicit ISO zones are retained and zone-less ISO timestamps use the provider offset',()=>{
  const row=time=>[{title:'Liga: A vs B',date:'2026-11-04',time}];
  assert.equal(normalize(row('2026-11-04T17:30:00Z'),now)[0].startsAt,'2026-11-04T17:30:00.000Z');
  assert.equal(normalize(row('2026-11-04T17:30:00-03:00'),now)[0].startsAt,'2026-11-04T20:30:00.000Z');
  assert.equal(normalize(row('2026-11-04T17:30:00'),now)[0].startsAt,'2026-11-04T22:30:00.000Z');
});
test('date filtering happens after conversion and stays independent of server timezone',()=>{
  const events=normalize([{title:'Liga: A vs B',date:'2026-11-03',time:'23:30:00'}],now);
  assert.equal(events.length,1);assert.equal(events[0].startsAt,'2026-11-04T04:30:00.000Z');
  assert.deepEqual(matchSchedule({startsAt:'invalid'}),[]);
});
