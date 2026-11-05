import test from 'node:test';
import assert from 'node:assert/strict';
import {matchTeams,teamBadge,teamBadges,handleBadgeError} from '../public/team-badges.js';

test('splits published matchup titles without breaking hyphenated team names',()=>{
  assert.deepEqual(matchTeams({title:'Paris Saint-Germain vs Real Madrid'}),['Paris Saint-Germain','Real Madrid']);
  assert.deepEqual(matchTeams({title:'Milan VS. Ferencváros'}),['Milan','Ferencváros']);
  assert.deepEqual(matchTeams({title:'Fórmula 1: Clasificación'}),[]);
  assert.deepEqual(matchTeams({title:'A vs B vs C'}),[]);
});
test('matches official crests across accents and published club aliases',()=>{
  assert.equal(teamBadge('Real Sociedad','UEFA Europa League')?.id,'soccer:men:89');
  assert.equal(teamBadge('Olympique Lyonnais')?.id,'soccer:men:167');
  assert.equal(teamBadge('Lillestrøm')?.id,'soccer:men:987');
  assert.equal(teamBadge('Viktoria Plzeň')?.id,'soccer:men:11706');
  assert.equal(teamBadge('Sporting Braga')?.id,'soccer:men:2994');
  assert.equal(teamBadge('Univ. Concepción')?.id,'soccer:men:5362');
  assert.equal(teamBadge('Deportivo Saprissa')?.id,'soccer:men:858');
});
test('unknown, youth, and distinct sports do not borrow another team crest',()=>{
  assert.equal(teamBadge('Equipo sin identificar'),null);
  assert.equal(teamBadge('Real Madrid Sub-20'),null);
  assert.equal(teamBadge('Real Madrid','Euroliga'),null);
  assert.equal(teamBadge('Barcelona','Balonmano'),null);
  assert.equal(teamBadge('Arsenal','Premier League Femenina')?.gender,'women');
  assert.equal(teamBadge('Arsenal','Premier League')?.gender,'men');
  assert.equal(teamBadge('Necaxa Femenil','Liga MX Femenil')?.id,'soccer:women:133983');
  assert.equal(teamBadge('Edmonton Oilers','NHL')?.sport,'hockey');
});
test('renders two real crests, keeps titles safe, and supplies neutral fallbacks',()=>{
  const markup = teamBadges({title:'Real Sociedad vs Olympique Lyonnais',league:'UEFA Europa League'});
  assert.equal((markup.match(/<img /g)||[]).length,2);
  assert.ok(markup.includes('loading="lazy"'));
  const unknown = teamBadges({title:'<script> vs Equipo nuevo'});
  assert.ok(!unknown.includes('<img '));
  assert.ok(!unknown.includes('<script>'));
  assert.ok(unknown.includes('&lt;script&gt;'));
  assert.equal(teamBadges({title:'Carrera de Fórmula 1'}),'');
  assert.equal((teamBadges({title:'NFL – Baltimore Ravens vs. Jacksonville Jaguars',league:'Deportes'}).match(/<img /g)||[]).length,2);
});
test('a failed image reveals the initials and removes the broken image',()=>{
  const fallback = {hidden:true}; let removed = false;
  handleBadgeError({target:{matches:()=>true,nextElementSibling:fallback,remove:()=>{removed=true;}}});
  assert.equal(fallback.hidden,false);assert.equal(removed,true);
  assert.doesNotThrow(()=>handleBadgeError({target:{}}));
});
