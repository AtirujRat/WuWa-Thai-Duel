import {randomInt} from 'node:crypto';

// Training rules are deliberately separate from the manual, two-player table.
const beats={แดง:'เขียว',เขียว:'น้ำเงิน',น้ำเงิน:'แดง'};
const log=(r,text)=>{r.log.push({time:new Date().toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'}),text});r.log=r.log.slice(-100)};
export function chooseBotCard(hand,energy,cards,difficulty='normal'){
 const map=new Map(cards.map(c=>[c.code,c]));
 const legal=hand.map((code,index)=>({c:map.get(code),index})).filter(x=>Number(x.c.fee)<=energy);
 if(!legal.length)return -1;
 if(difficulty==='easy')return legal[randomInt(legal.length)].index;
 // Only the bot's own hand is provided; neither the human hand nor selection is inspected.
 const scored=legal.map(x=>({...x,score:Math.max(1,Number(x.c.damage))*2+Number(x.c.speed||0)/5-Number(x.c.fee)/2}));
 scored.sort((a,b)=>b.score-a.score);
 const best=scored.filter(x=>x.score>=scored[0].score-1);
 return best[randomInt(best.length)].index;
}
export function prepareBotRound(room,cards){
 room.active=0;room.botPhase='choose';room.lastDuel=null;
 for(const p of room.players){p.trash.push(...p.action);p.action=[];p.energy=Math.min(3,(p.energy||0)+1);if(room.turn>1&&p.deck.length)p.hand.push(p.deck.shift());}
 const bot=room.players[1];const index=chooseBotCard(bot.hand,bot.energy,cards,room.difficulty);
 bot.pending=index<0?null:bot.hand.splice(index,1)[0];
 log(room,`รอบ ${room.turn} · บอทเลือกการ์ดไว้แล้ว เลือกการ์ดของคุณเพื่อเปิดพร้อมกัน`);
}
export function resolveTraining(a,b){
 if(!a&&!b)return {winner:null,damage:0,reason:'ทั้งสองฝ่ายผ่าน'};
 let winner,reason;
 if(!a||!b){winner=a?0:1;reason='อีกฝ่ายผ่านรอบนี้'}
 else if(a.color===b.color){const av=Number(a.speed||0),bv=Number(b.speed||0);if(av===bv)return {winner:null,damage:0,reason:'สีและความเร็วเท่ากัน เสมอ'};winner=av>bv?0:1;reason='สีเดียวกัน ตัดสินด้วยความเร็ว'}
 else {winner=beats[a.color]===b.color?0:1;reason=`${winner===0?a.color:b.color} ชนะ ${winner===0?b.color:a.color}`}
 return {winner,damage:Math.max(1,Number((winner===0?a:b).damage)||0),reason};
}
export function botAction(room,seat,cmd,cards){
 if(seat!==0)throw Error('ที่นั่งนี้ควบคุมโดยบอท');
 if(room.status!=='playing')throw Error('เริ่มเกมก่อน หรือสร้างเกมใหม่เมื่อจบแล้ว');
 const me=room.players[0],bot=room.players[1],map=new Map(cards.map(c=>[c.code,c]));
 if(cmd.type==='surrender'){room.status='finished';room.winner=1;log(room,'คุณยอมแพ้ · บอทชนะ');}
 else if(cmd.type==='draw'||cmd.type==='shuffle'){
  if(room.botPhase!=='choose'||cmd.version!==room.version)throw Error('จั่วและสับได้ในช่วงเลือกการ์ด');
  if(cmd.type==='draw'){if(!me.deck.length)throw Error('เด็คหมดแล้ว');me.hand.push(me.deck.shift());log(room,'คุณ · จั่ว 1 ใบ')}
  else{for(let i=me.deck.length-1;i>0;i--){const j=randomInt(i+1);[me.deck[i],me.deck[j]]=[me.deck[j],me.deck[i]]}log(room,'คุณ · สับเด็ค')}
 }
 else if(cmd.type==='resolveTable'){
  if(room.botPhase!=='choose'||cmd.version!==room.version)throw Error('สถานะเปลี่ยนแล้ว กรุณาลองใหม่');
  const selected=(me.table||[]).find(c=>c.zone==='action');
  if(!selected)throw Error('ลากการ์ดลงสนามแอ็กชันก่อน');
  if(Number(map.get(selected.code).fee)>me.energy)throw Error('พลังงานไม่พอ');
  me.table=me.table.filter(c=>c.id!==selected.id);me.hand.push(selected.code);
  return botAction(room,seat,{type:'commit',index:me.hand.length-1,version:cmd.version},cards);
 }
 else if(cmd.type==='nextRound'){
  if(room.botPhase!=='result')throw Error('เล่นรอบนี้ให้จบก่อน');
  room.turn++;prepareBotRound(room,cards);
 }else if(cmd.type==='commit'||cmd.type==='pass'){
  if(room.botPhase!=='choose')throw Error('กดรอบถัดไปก่อนเล่นการ์ด');
  // Version guards make retried or stale clicks incapable of playing an extra card.
  if(cmd.version!==room.version)throw Error('สถานะเปลี่ยนแล้ว กรุณาลองใหม่');
  if((me.table||[]).some(c=>c.zone==='action'))throw Error('เปิดการ์ดในสนาม หรือเก็บกลับมือก่อน');
  let code=null;
  if(cmd.type==='commit'){
   if(!Number.isInteger(cmd.index)||cmd.index<0||cmd.index>=me.hand.length)throw Error('ไม่พบการ์ด');
   code=me.hand[cmd.index];if(Number(map.get(code).fee)>me.energy)throw Error('พลังงานไม่พอ');
   me.hand.splice(cmd.index,1);me.energy-=Number(map.get(code).fee);me.action.push(code);
  }
  const other=bot.pending;bot.pending=null;
  if(other){bot.energy-=Number(map.get(other).fee);bot.action.push(other)}
  const outcome=resolveTraining(code?map.get(code):null,other?map.get(other):null);
  if(outcome.winner!==null){const loser=room.players[1-outcome.winner];loser.hp=Math.max(0,loser.hp-outcome.damage)}
  room.lastDuel={human:code,bot:other,...outcome};room.botPhase='result';
  log(room,`คุณ: ${code?map.get(code).name:'ผ่าน'} · บอท: ${other?map.get(other).name:'ผ่าน'} · ${outcome.reason}${outcome.damage?' · ความเสียหาย '+outcome.damage:''}`);
  if(me.hp===0||bot.hp===0||room.turn>=40){room.status='finished';room.winner=me.hp===bot.hp?null:me.hp>bot.hp?0:1;log(room,room.winner===null?'จบเกม · เสมอ':room.winner===0?'จบเกม · คุณชนะ!':'จบเกม · บอทชนะ');}
 }else throw Error('โหมดบอทคำนวณการเล่นให้เอง ไม่รองรับคำสั่งโต๊ะจำลอง');
 room.version++;
}
