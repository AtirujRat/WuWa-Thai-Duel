import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makePlayer,act,publicRoom} from '../engine.mjs';
import {presetDeck} from '../public/deck-rules.js';
import {resolveTraining,chooseBotCard} from '../bot.mjs';
const cards=JSON.parse(fs.readFileSync(new URL('../public/cards.json',import.meta.url)));
function setup(){const a=makePlayer('A',presetDeck('SD01',cards).entries,cards),b=makePlayer('Bot',presetDeck('SD02',cards).entries,cards);b.isBot=true;b.ready=true;const r={code:'botroom1',mode:'bot',difficulty:'normal',version:1,turn:1,active:0,status:'waiting',players:[a,b],log:[]};return {r,a,b}}
test('Training color cycle, speed ties, damage and pass resolve',()=>{const c=(color,speed,damage)=>({color,speed,damage});assert.equal(resolveTraining(c('แดง',1,2),c('เขียว',99,8)).winner,0);assert.equal(resolveTraining(c('น้ำเงิน',0,0),c('แดง',8,8)).damage,1);assert.equal(resolveTraining(c('เขียว',1,2),c('น้ำเงิน',9,8)).winner,0);assert.equal(resolveTraining(c('แดง',3,2),c('แดง',3,4)).winner,null);assert.equal(resolveTraining(null,c('แดง',1,4)).damage,4);assert.equal(resolveTraining(null,null).winner,null)});
test('Bot precommits, conceals card, enforces cost and blocks manual commands',()=>{const {r,a,b}=setup();act(r,a.token,{type:'ready'},cards);assert.equal(r.botPhase,'choose');assert.ok(b.pending);const view=publicRoom(r,a.token);assert.equal(view.players[1].pending,true);assert.deepEqual(view.players[1].hand,[]);assert.equal(view.players[1].token,undefined);const version=r.version;assert.throws(()=>act(r,a.token,{type:'hp',delta:1},cards));a.hand=['SD01-011'];assert.throws(()=>act(r,a.token,{type:'commit',index:0,version},cards),/พลังงาน/);assert.equal(r.version,version);assert.equal(a.hand.length,1)});
test('Full bot match terminates; stale actions rejected; all cards conserved',()=>{const {r,a,b}=setup();act(r,a.token,{type:'ready'},cards);const version=r.version;act(r,a.token,{type:'pass',version},cards);assert.equal(r.botPhase,'result');assert.throws(()=>act(r,a.token,{type:'pass',version},cards));while(r.status==='playing'){if(r.botPhase==='result')act(r,a.token,{type:'nextRound'},cards);else act(r,a.token,{type:'pass',version:r.version},cards)}assert.ok(r.turn<=40);for(const p of [a,b])assert.equal(p.hand.length+p.deck.length+p.trash.length+p.action.length+(p.pending?1:0),40);assert.throws(()=>act(r,a.token,{type:'nextRound'},cards));});
test('English card names only; Thai effects and character filters retained',()=>{for(const c of cards){assert.doesNotMatch(c.name,/[ก-๙]/);assert.match(c.effectTh,/[ก-๙]/);assert.match(c.character,/[ก-๙]/);assert.ok(c.nameTh)}});
test('Bot choice respects energy and returns pass for no affordable card',()=>{assert.equal(chooseBotCard(['SD01-011'],0,cards),-1);assert.equal(chooseBotCard(['SD01-011','SD01-007'],0,cards),1)});
test('Bot playmat stages, flips and resolves once without losing cards',()=>{
 const {r,a,b}=setup();const send=cmd=>act(r,a.token,{version:r.version,...cmd},cards);send({type:'ready'});
 const pending=b.pending;const index=a.hand.findIndex(code=>Number(cards.find(c=>c.code===code).fee)<=a.energy);assert.ok(index>=0);const code=a.hand[index];
 send({type:'tablePlace',index,code,zone:'concerto',x:.5,y:.5,faceDown:true});const id=a.table[0].id;
 assert.equal(b.pending,pending);assert.equal(a.energy,1);
 send({type:'tableFlip',id});send({type:'tableMove',id,zone:'action',x:.2,y:.3});
 assert.throws(()=>send({type:'pass'}));assert.throws(()=>send({type:'tableTake',id,to:'trash'}));
 const version=r.version;send({type:'resolveTable'});assert.equal(r.botPhase,'result');assert.equal(r.lastDuel.human,code);assert.equal(a.table.length,0);assert.equal(a.energy,1-Number(cards.find(c=>c.code===code).fee));assert.throws(()=>send({type:'resolveTable',version}));
 for(const p of [a,b])assert.equal(p.hand.length+p.deck.length+p.action.length+p.trash.length+(p.table||[]).length+(p.pending?1:0),40);
});
test('Bot allows manual draw and shuffle only during selection, preserving hidden choice and deck',()=>{
 const {r,a,b}=setup();act(r,a.token,{type:'ready'},cards);const pending=b.pending,hand=a.hand.length,deck=a.deck.length;
 act(r,a.token,{type:'draw',version:r.version},cards);assert.equal(a.hand.length,hand+1);assert.equal(a.deck.length,deck-1);assert.equal(b.pending,pending);
 const codes=[...a.deck].sort();act(r,a.token,{type:'shuffle',version:r.version},cards);assert.deepEqual([...a.deck].sort(),codes);assert.equal(b.pending,pending);
 assert.throws(()=>act(r,a.token,{type:'draw',version:0},cards));
 act(r,a.token,{type:'pass',version:r.version},cards);assert.throws(()=>act(r,a.token,{type:'draw',version:r.version},cards));
});
