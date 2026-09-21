import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makePlayer,act,publicRoom} from '../engine.mjs';
import {initRules,judgeCards} from '../rules-core.mjs';
import {presetDeck} from '../public/deck-rules.js';
const cards=JSON.parse(fs.readFileSync(new URL('../public/cards.json',import.meta.url)));
const map=new Map(cards.map(c=>[c.code,c]));
function setup(bot=false){const r={code:'rules123',rulesVersion:1,mode:bot?'bot':'friend',difficulty:'normal',version:1,turn:1,active:0,status:'waiting',players:[makePlayer('A',presetDeck('SD01',cards).entries,cards),makePlayer('B',presetDeck('SD02',cards).entries,cards)],log:[]};r.players[1].isBot=bot;initRules(r);return r}
function send(r,s,cmd){return act(r,r.players[s].token,{version:r.version,...cmd},cards)}
function start(r){r.phase='order';r.orderWinner=0;send(r,0,{type:'chooseOrder',first:true});send(r,0,{type:'ready'});if(r.status==='waiting')send(r,1,{type:'ready'});return r}
function conserve(r){for(const p of r.players){assert.equal(p.hand.length+p.deck.length+p.trash.length+p.table.length,40);assert.equal(p.reserve.length+Object.values(p.stacks).flat().length,9)}}
test('Official color rules: blue always ties; red/green ties favor turn owner; no damage floor',()=>{const c=(color,speed)=>({color,speed});assert.equal(judgeCards(c('น้ำเงิน',1),c('น้ำเงิน',99),0).winner,null);assert.equal(judgeCards(c('แดง',5),c('แดง',5),1).winner,1);assert.equal(judgeCards(c('เขียว',5),c('เขียว',5),0).winner,0);assert.equal(judgeCards(c('แดง',1),c('เขียว',99)).winner,0)});
test('Bot-selected first order never leaves setup waiting for an impossible human action',()=>{for(let i=0;i<20;i++){const r=setup(true);if(r.first===1){assert.equal(r.players[1].ready,true);assert.equal(r.setupSeat,0);send(r,0,{type:'ready'});assert.equal(r.status,'playing');assert.ok(['defense','action'].includes(r.phase));return}}});
test('Two human seats conceal commitments, then reveal together and apply blue victory',()=>{
 const r=start(setup());const put=(s,code)=>{const p=r.players[s];let i=p.hand.indexOf(code);if(i<0){const j=p.deck.indexOf(code);assert.ok(j>=0);[p.hand[0],p.deck[j]]=[p.deck[j],p.hand[0]];i=0}send(r,s,{type:'tablePlace',index:i,code,zone:'action',x:.2,y:.5});};
 put(0,'SD01-007');send(r,0,{type:'resolveTable',payment:[]});assert.equal(r.phase,'defense');const v=publicRoom(r,r.players[1].token);assert.equal(v.players[0].table[0].code,null);assert.equal(v.players[0].hand.length,0);assert.throws(()=>send(r,0,{type:'pass'}));
 put(1,'SD02-008');send(r,1,{type:'resolveTable',payment:[]});assert.equal(r.lastDuel.winner,1);assert.equal(r.players[0].hp,20-Number(map.get('SD02-008').damage));assert.ok(r.players.every(p=>p.table.filter(c=>c.zone==='action').every(c=>!c.faceDown)));conserve(r);
});
test('Setup order, unrestricted one-time mulligan, hidden leader, first draw 1 then 2',()=>{const r=setup();r.orderWinner=0;send(r,0,{type:'chooseOrder',first:true});assert.deepEqual(publicRoom(r,r.players[1].token).players[0].field,[]);assert.throws(()=>send(r,1,{type:'mulligan',indices:[0]}));send(r,0,{type:'mulligan',indices:[0,1,2,3,4]});assert.equal(r.players[0].hand.length,5);assert.throws(()=>send(r,0,{type:'mulligan',indices:[]}));send(r,0,{type:'ready'});send(r,1,{type:'ready'});assert.equal(r.players[0].hand.length,6);assert.equal(r.players[1].hand.length,5);send(r,0,{type:'pass'});assert.equal(r.turn,2);assert.equal(r.players[1].hand.length,7);conserve(r)});
test('Charge once, only owner; facedown cannot be revealed early; staged privacy',()=>{const r=start(setup());const p=r.players[0];send(r,0,{type:'tablePlace',index:0,code:p.hand[0],zone:'concerto',x:.5,y:.5,faceDown:true});assert.equal(p.table[0].faceDown,false);assert.throws(()=>send(r,0,{type:'tablePlace',index:0,code:p.hand[0],zone:'concerto',x:.5,y:.5}));assert.throws(()=>send(r,1,{type:'draw'}));const i=p.hand.findIndex(code=>Number(map.get(code).fee)<=1&&!map.get(code).info.includes('リーダースキル'));if(i>=0){send(r,0,{type:'tablePlace',index:i,code:p.hand[i],zone:'action',x:.5,y:.5});const x=p.table.find(c=>c.zone==='action');assert.equal(publicRoom(r,r.players[1].token).players[0].table.find(c=>c.id===x.id).code,null);assert.throws(()=>send(r,0,{type:'tableFlip',id:x.id}));}conserve(r)});
test('Level cost uses destination level, stacks old card, max once; no 0 to 2 jump',()=>{const r=start(setup());const p=r.players[0];assert.throws(()=>send(r,0,{type:'level',code:'SD01-001',indices:[0,1]}));send(r,0,{type:'level',code:'SD01-002',indices:[0]});assert.equal(p.trash.length,1);assert.deepEqual(p.stacks['SD01-002'],['BP01-018','SD01-002']);assert.throws(()=>send(r,0,{type:'level',code:'SD01-001',indices:[0,1]}));conserve(r)});
test('Refresh empty deck from trash; deck and trash both empty loses',()=>{const r=start(setup());const p=r.players[1];p.trash.push(...p.deck.splice(0));send(r,0,{type:'pass'});assert.ok(p.deck.length>0);assert.equal(r.status,'playing');const r2=start(setup());r2.players[1].hand.push(...r2.players[1].deck.splice(0));send(r2,0,{type:'pass'});assert.equal(r2.status,'finished');assert.equal(r2.winner,0)});
test('End discards only active hand down to 8',()=>{const r=start(setup());const p=r.players[0];p.hand.push(...p.deck.splice(0,5));send(r,0,{type:'pass'});assert.equal(r.choice.type,'discard');assert.equal(r.choice.count,3);send(r,0,{type:'answer',id:r.choice.id,indices:[0,1,2]});assert.equal(p.hand.length,8);assert.equal(r.active,1);conserve(r)});
test('Full starter bot game advances with effects and conserves all cards',()=>{
 const r=start(setup(true));for(let step=0;step<600&&r.status!=='finished';step++){
  const q=r.choice,p=r.players[0];
  if(q){if(q.type==='discard')send(r,0,{type:'answer',id:q.id,indices:Array.from({length:q.count},(_,i)=>i)});else send(r,0,{type:'answer',id:q.id,value:q.options[0].value});}
  else if(r.phase==='action'||r.phase==='defense'){
   if(r.phase==='action'&&!p.used.charge&&p.hand.length){send(r,0,{type:'tablePlace',index:0,code:p.hand[0],zone:'concerto',x:.5,y:.5});continue}
   const energy=p.table.filter(c=>c.zone==='concerto').length;const i=p.hand.findIndex(code=>Number(map.get(code).fee)+(map.get(code).color==='แดง'&&p.flags.redTaxTurn===r.turn?1:0)<=energy&&!map.get(code).info.includes('リーダースキル'));
   if(i<0)send(r,0,{type:'pass'});else{send(r,0,{type:'tablePlace',index:i,code:p.hand[i],zone:'action',x:.5,y:.5});send(r,0,{type:'resolveTable'});}
  }else if(r.phase==='combo'||r.phase==='result')send(r,0,{type:'end'});else throw Error('Stuck '+r.phase);
  conserve(r);
 }
 assert.equal(r.status,'finished');assert.ok(r.turn>1);
});

 test('Automatic payment: zero cost reserves nothing, positive cost takes oldest concerto first',()=>{
 for(const fee of [0,1,2]){
  const r=start(setup()),p=r.players[0];
  const c=cards.find(c=>c.type==='action'&&Number(c.fee)===fee&&!c.info.includes('【リーダースキル】'));
  p.table=[0,1,2].map(i=>({id:'energy'+i,code:'SD01-007',zone:'concerto',faceDown:false,x:0,y:i/3}));
  p.table.push({id:'staged',code:c.code,zone:'action',faceDown:true,x:0,y:0});
  send(r,0,{type:'resolveTable'});
  assert.deepEqual(p.payment,['energy0','energy1','energy2'].slice(0,fee));
  send(r,1,{type:'pass'});
  assert.deepEqual(p.table.filter(c=>c.zone==='concerto').map(c=>c.id),['energy0','energy1','energy2'].slice(fee));
 }
 });

 test('All color matchups: combo buttons ignore the original commitment lock and respect pursuit',async()=>{
 const {actionUnavailable}=await import('../public/rules-ui.js');
 const palette=['แดง','เขียว','น้ำเงิน'];
 for(const a of palette)for(const b of palette)for(const pursuit of [0,1]){
  const r=start(setup());
  const custom=structuredClone(cards);for(const c of custom)c.info='';
  const find=code=>custom.find(c=>c.code===code);
  Object.assign(find('SD01-007'),{color:a,fee:'0',speed:'5',damage:'1'});
  Object.assign(find('SD02-007'),{color:b,fee:'0',speed:'5',damage:'1'});
  Object.assign(find('SD01-012'),{color:'แดง',fee:'0',damage:'1'});
  for(let s=0;s<2;s++){const p=r.players[s];p.table=[{id:'staged'+s,code:s?'SD02-007':'SD01-007',zone:'action',faceDown:true,x:0,y:0}];p.hand=['SD01-012','SD01-012'];p.flags.pursuit=pursuit;p.hp=20;p.field=[];p.stacks={};}
  const go=(seat,cmd)=>act(r,r.players[seat].token,{version:r.version,...cmd},custom);
  go(0,{type:'resolveTable'});go(1,{type:'resolveTable'});
  const winner=judgeCards(find('SD01-007'),find('SD02-007'),0).winner;
  const canCombo=winner!==null&&((winner===0?a:b)==='แดง'||pursuit>0);
  assert.equal(r.phase,canCombo?'combo':'result',a+' vs '+b);
  if(!canCombo)continue;
  assert.equal(r.comboSeat,winner);assert.equal(r.players[winner].locked,true);
  const view=publicRoom(r,r.players[winner].token);
  assert.equal(actionUnavailable(view,'SD01-012',find),'');
  const hp=r.players[1-winner].hp;
  go(winner,{type:'combo',index:0});assert.equal(r.players[1-winner].hp,hp-1);
  if((winner===0?a:b)!=='แดง'){
   assert.equal(r.comboLeft,0);
   assert.notEqual(actionUnavailable(publicRoom(r,r.players[winner].token),'SD01-012',find),'');
   assert.throws(()=>go(winner,{type:'combo',index:0}));
  }else{assert.equal(r.comboLeft,-1);go(winner,{type:'combo',index:0});assert.equal(r.players[1-winner].hp,hp-2)}
 }
 });
