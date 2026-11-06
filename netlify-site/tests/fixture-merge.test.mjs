import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,merge} from '../lib/core.mjs';

const now=new Date('2026-11-05T22:00:00Z');
const event=(title,time='17:15:00',channel='first')=>normalize([{title,date:'2026-11-05',time,embeds:[{name:channel,url:`https://example.com/${channel}`}]}],now)[0];

test('competition aliases produce one fixture with every distinct channel and both old links',()=>{
  const first=event('Liga Profesional: Gimnasia La Plata vs Belgrano');
  const second=event('Liga Profesional Argentina: Gimnasia La Plata vs Belgrano','17:15:00','second');
  const [merged]=merge([[first],[second]]);
  assert.equal(merge([[first],[second]]).length,1);
  assert.equal(merged.id,first.id);
  assert.ok(merged.legacyIds.includes(second.id));
  assert.equal(merged.signals.length,2);
  assert.deepEqual(first.signals.length,1);
});

test('known club aliases, vs punctuation, accents, and extra spaces merge without guessing',()=>{
  for(const [a,b] of [
    ['Copa Chile: Universidad Chile vs Antofagasta','Copa Chile: Universidad de Chile vs. Antofagasta'],
    ['Primera División: Inter San Carlos vs Cartaginés','Primera División: Inter San Carlos vs CS Cartagines'],
    ['Primera División: CS Herediano vs Deportivo Saprissa','Primera División: Herediano vs Saprissa'],
    ['Liga MX Femenil: Necaxa Femenil vs Atlas Femenil','Liga MX Femenil: Necaxa vs Atlas'],
    ['NHL: Edmonton Oilers  vs Anaheim Ducks','NHL: Edmonton Oilers vs Anaheim Ducks'],
  ])assert.equal(merge([[event(a)],[event(b)]]).length,1,`${a} / ${b}`);
});
test('translated Venezia and Colombian sponsored competitions merge every source and link',()=>{
  for(const [a,b] of [
    ['Serie A: Venecia vs Udinese','Serie A: Venezia vs Udinese'],
    ['Primera A: Boyacá Chicó vs Inter Bogotá','Liga BetPlay: Boyacá Chicó vs Internacional de Bogotá'],
    ['Primera A: Fortaleza CEIF vs Medellín','Liga BetPlay: Fortaleza CEIF vs Independiente Medellín'],
  ]){
    const first=event(a),second=event(b,'17:15:00','second');
    const merged=merge([[first],[second]]);
    assert.equal(merged.length,1,`${a} / ${b}`);
    assert.equal(merged[0].signals.length,2);
    assert.ok(merged[0].legacyIds.includes(second.id));
  }
});

test('a small cross-feed NFL time discrepancy keeps the first schedule and the second link',()=>{
  const first=event('NFL – Baltimore Ravens vs. Jacksonville Jaguars','20:00:00');
  const second=event('NFL: Baltimore Ravens vs Jacksonville Jaguars','20:15:00','second');
  const merged=merge([[first],[second]]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].startsAt,first.startsAt);
  assert.ok(merged[0].legacyIds.includes(second.id));
});

test('different competitions, categories, teams, home order, dates, and later games stay separate',()=>{
  const base=event('Liga: Arsenal vs Chelsea');
  for(const other of [
    event('Copa: Arsenal vs Chelsea'),
    event('Liga Femenina: Arsenal vs Chelsea'),
    event('Liga: Arsenal Sub-20 vs Chelsea Sub-20'),
    event('Liga: Arsenal vs Liverpool'),
    event('Liga: Chelsea vs Arsenal'),
    event('Liga: Arsenal vs Chelsea','19:15:00'),
    {...base,id:'another-day',startsAt:'2026-11-06T22:15:00.000Z'},
  ])assert.equal(merge([[base],[other]]).length,2,other.title);
});

test('time tolerance cannot merge same-feed doubleheaders or ambiguous and chained schedules',()=>{
  const a=event('MLB: A vs B','18:00:00'),b=event('MLB: A vs B','18:15:00','second');
  const between=event('MLB: A vs B','18:07:00','third');
  assert.equal(merge([[a,b],[between]]).length,3);
  assert.equal(merge([[a,b]]).length,2);
  assert.equal(merge([[a],[b],[event('MLB: A vs B','18:30:00','third')]]).length,2);
});

test('merging is repeatable, preserves legacy links, and deduplicates the same player',()=>{
  const first=event('Liga Profesional: Gimnasia La Plata vs Belgrano');
  const second={...event('Liga Profesional Argentina: Gimnasia La Plata vs Belgrano'),legacyIds:['old-link']};
  const merged=merge([[first],[second]]);
  assert.equal(merged[0].signals.length,1);
  assert.ok(merged[0].legacyIds.includes(second.id));assert.ok(merged[0].legacyIds.includes('old-link'));
  assert.deepEqual(merge([merged]),merged);
});
