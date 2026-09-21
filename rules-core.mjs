import {randomInt,randomBytes} from 'node:crypto';
const uid=()=>randomBytes(12).toString('hex');
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const colors={แดง:'เขียว',เขียว:'น้ำเงิน',น้ำเงิน:'แดง'};
export function judgeCards(a,b,active=0){
 if(!a&&!b)return {winner:null,reason:'ทั้งสองฝ่ายไม่ลงการ์ด'};
 if(!a||!b)return {winner:a?0:1,reason:'อีกฝ่ายไม่ลงการ์ด'};
 if(a.color!==b.color)return {winner:colors[a.color]===b.color?0:1,reason:'ตัดสินด้วยสี'};
 if(a.color==='น้ำเงิน')return {winner:null,reason:'ฟ้าปะทะฟ้า เสมอโดยไม่เทียบความเร็ว'};
 const x=Number(a.speed),y=Number(b.speed);
 return {winner:x===y?active:x>y?0:1,reason:x===y?'ความเร็วเท่ากัน เจ้าของเทิร์นชนะ':'ตัดสินด้วยความเร็ว'};
}
export function initRules(r){
 if(r.players.length!==2||r.phase)return;
 r.phase='order';r.orderWinner=randomInt(2);r.first=null;r.queue=[];r.choice=null;r.lastWinner=null;r.ruleNotice='กฎพื้นฐานอัตโนมัติ · เอฟเฟกต์ SD01/SD02 และ Lv.0 ทีมเริ่มต้นอัตโนมัติ · เอฟเฟกต์อื่นใช้แผงจัดการและยืนยัน';
 for(const p of r.players){p.ready=false;p.table=[];p.stacks=Object.fromEntries(p.field.map(c=>[c,[c]]));p.used={};p.locked=false;p.payment=[];p.flags={};p.effectsDone=false}
 if(r.players[r.orderWinner].isBot){r.first=r.orderWinner;r.active=r.first;r.players[r.first].ready=true;r.setupSeat=1-r.first;r.phase='setup'}
}
export function rulesView(r,seat){
 const choice=r.choice;
 return {rulesVersion:r.rulesVersion,phase:r.phase||'waiting',previousWinner:r.previousWinner,first:r.first,orderWinner:r.orderWinner,setupSeat:r.setupSeat,comboSeat:r.comboSeat,comboLeft:r.comboLeft,ruleNotice:r.ruleNotice,
  choice:choice?{...choice,options:choice.seat===seat||r.players[choice.seat]?.isBot?choice.options:[],canAnswer:choice.seat===seat||r.players[choice.seat]?.isBot}:null,
  turnOwner:r.active,canAct:['draw','action','battle'].includes(r.phase)&&r.active===seat||r.phase==='defense'&&r.active!==seat||r.phase==='combo'&&r.comboSeat===seat,
 };
}
export function rulesAct(room,seat,cmd,cards){const g=new Game(room,cards);g.command(seat,cmd);g.advance();room.version++;return room}
class Game{
 constructor(r,cards){this.r=r;this.cards=new Map(cards.map(c=>[c.code,c]));initRules(r)}
 p(s){return this.r.players[s]} c(code){return this.cards.get(code)}
 log(text){this.r.log.push({time:new Date().toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'}),text});this.r.log=this.r.log.slice(-100)}
 all(s){return Object.values(this.p(s).stacks).flat()}
 leader(s,code){return (this.p(s).stacks[this.p(s).leader]||[]).includes(code)}
 energy(s){return this.p(s).table.filter(c=>c.zone==='concerto')}
 staged(s){return this.p(s).table.find(c=>c.zone==='action'&&c.faceDown)}
 enqueue(...ops){this.r.queue.push(...ops)}
 op(type,seat,n,extra={}){return {type,seat,n,...extra}}
 check(){
  const losers=this.r.players.map((p,i)=>p.hp<=0||(!p.deck.length&&!p.trash.length)?i:-1).filter(i=>i>=0);
  if(losers.length){this.r.status='finished';this.r.phase='finished';this.r.winner=losers.length===2?null:1-losers[0];this.r.choice=null;this.r.queue=[];this.log(this.r.winner===null?'จบเกม · เสมอ':'จบเกม · '+this.p(this.r.winner).name+' ชนะ');return false}
  for(const p of this.r.players)if(!p.deck.length){p.deck=shuffle(p.trash.splice(0));this.log(p.name+' · รีเฟรชเด็คจากกองทิ้ง')}
  return true;
 }
 takeTop(s,n,to='hand',reveal=false){const p=this.p(s);for(let i=0;i<n;i++){if(!this.check())return;const code=p.deck.shift();if(to==='concerto')p.table.push({id:uid(),code,zone:to,x:.5,y:Math.min(.85,this.energy(s).length*.14),faceDown:false});else p[to].push(code);if(reveal)this.log(p.name+' · เปิด '+this.c(code).name);if(!this.check())return}}
 cost(s,code){const p=this.p(s),c=this.c(code);return Math.max(0,Number(c.fee)+(p.flags.costBonus||0)+(c.color==='แดง'&&p.flags.redTaxTurn===this.r.turn?1:0)-(code==='BP01-062'&&this.r.previousWinner===s?1:0))}
 legal(s,code,combo=false){const c=this.c(code);return !!c&&c.type==='action'&&(!combo||c.color==='แดง')&&this.cost(s,code)<=this.energy(s).length&&(!c.info.includes('【リーダースキル】')||this.c(this.p(s).leader).character===c.character)&&(!(c.feature_name||'').includes('音骸')||!this.p(s).table.some(x=>x.zone==='action'&&!x.faceDown&&(this.c(x.code).feature_name||'').includes('音骸')))}
 payment(s,code,ids){const n=this.cost(s,code),pool=this.energy(s);ids=ids??pool.slice(0,n).map(c=>c.id);assert(Array.isArray(ids)&&ids.length===n&&new Set(ids).size===n&&ids.every(id=>pool.some(c=>c.id===id)),'เลือกการ์ดคอนแชร์โตให้ครบค่าร่าย '+n+' ใบ');return ids}
 pay(s,ids){const p=this.p(s);for(const id of ids){const i=p.table.findIndex(c=>c.id===id&&c.zone==='concerto');assert(i>=0,'การ์ดค่าร่ายไม่อยู่ในสนาม');p.trash.push(p.table.splice(i,1)[0].code)}}
 discard(s,indices,n){const p=this.p(s);assert(Array.isArray(indices)&&indices.length===n&&new Set(indices).size===n&&indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.hand.length),'เลือกการ์ดจากมือ '+n+' ใบ');for(const i of [...indices].sort((a,b)=>b-a))p.trash.push(p.hand.splice(i,1)[0])}
 request(type,seat,label,options,extra={}){this.r.choice={id:uid(),type,seat,label,options,...extra}}
 fieldEvents(event,ctx={}){for(const seat of [this.r.active,1-this.r.active])for(const source of this.all(seat))this.enqueue({type:'effect',event,seat,source,ctx})}
 cardEvents(event,ctx={}){for(const seat of [this.r.active,1-this.r.active]){const source=this.r.duel?.[seat];if(source)this.enqueue({type:'effect',event,seat,source,ctx})}}
 begin(){this.r.status='playing';this.r.turn=1;this.r.active=this.r.first;this.startTurn()}
 startTurn(){const r=this.r;r.phase='start';r.hadBattle=false;r.previousWinner=r.lastWinner;r.lastDuel=null;r.duel=[null,null];r.comboLeft=0;r.comboSeat=null;for(const p of r.players){p.used={};p.locked=false;p.payment=[];p.flags.damageTaken=false;p.flags.heals=0;p.flags.encoreBasic=false;p.flags.usedTags=[];p.flags.pursuit=0;p.flags.switchLock=false;p.flags.bonusDamage=0;p.flags.speedBonus=0;p.flags.costBonus=0;p.flags.introDraw=0;p.flags.peek=false;p.revealHand=false}this.log('เทิร์น '+r.turn+' · '+this.p(r.active).name);this.fieldEvents('start');this.enqueue({type:'drawPhase'})}
 openDuel(){const r=this.r;r.phase='reveal';r.hadBattle=true;r.duel=r.players.map(p=>p.table.find(c=>c.zone==='action'&&c.faceDown)?.code||null);for(let s=0;s<2;s++){const card=this.staged(s);if(card)card.faceDown=false;this.pay(s,this.p(s).payment);this.p(s).payment=[]}this.log('เปิดการ์ดพร้อมกัน · '+r.duel.map(c=>c?this.c(c).name:'ไม่ลงการ์ด').join(' / '));this.fieldEvents('confront');this.cardEvents('confront');this.enqueue({type:'judge'})}
 end(){this.r.phase='end';if(this.r.hadBattle)this.fieldEvents('battleEnd');for(let s=0;s<2;s++)for(const x of this.p(s).table.filter(c=>c.zone==='action'))this.enqueue({type:'effect',seat:s,source:x.code,event:'battleEnd',ctx:{}});this.fieldEvents('end');this.enqueue({type:'cleanup'})}
 upgrade(s,code,free=false,indices=[]){const p=this.p(s),c=this.c(code),old=p.field.find(x=>this.c(x).character===c?.character);assert(old&&p.reserve.includes(code),'ไม่พบตัวละคร');assert(free||code!=='BP01-011','ตัวละครนี้อัปเลเวลด้วยเอฟเฟกต์เท่านั้น');assert(Number(c.level)===Number(this.c(old).level)||Number(c.level)===Number(this.c(old).level)+1,'อัปได้เลเวลเดิมหรือเพิ่ม 1 เท่านั้น');if(!free)this.discard(s,indices,Number(c.level));const stack=p.stacks[old];p.reserve.splice(p.reserve.indexOf(code),1);p.field[p.field.indexOf(old)]=code;if(p.leader===old)p.leader=code;delete p.stacks[old];p.stacks[code]=[...stack,code];p.flags.entered??={};p.flags.entered[code]=this.r.turn;this.log(p.name+' · อัปเลเวล '+c.name+' Lv.'+c.level);this.enqueue({type:'effect',event:'enter',seat:s,source:code,ctx:{}});for(const source of stack)this.enqueue({type:'effect',event:'level',seat:s,source,ctx:{}})}
 switch(s,code){const p=this.p(s);assert(p.field.includes(code)&&p.leader!==code,'เลือกตัวสำรอง');assert(!p.flags.switchLock,'เอฟเฟกต์ห้ามเปลี่ยนผู้นำในเทิร์นนี้');const old=p.leader;p.leader=code;this.log(p.name+' · เปลี่ยนผู้นำเป็น '+this.c(code).name);this.r.queue.unshift(...[...p.stacks[old],...p.stacks[code]].map(source=>({type:'effect',event:'switch',seat:s,source,ctx:{}})))}
 command(s,cmd){const r=this.r,p=this.p(s);assert(!p.isBot,'ไม่สามารถควบคุมบอทโดยตรง');assert(cmd.version===r.version,'สถานะเปลี่ยนแล้ว กรุณาลองใหม่');
  if(cmd.type==='surrender'){assert(r.status!=='finished','เกมจบแล้ว');r.status='finished';r.phase='finished';r.winner=1-s;r.queue=[];r.choice=null;this.log(p.name+' · ยอมแพ้');return}
  assert(r.status!=='finished','เกมจบแล้ว');
  if(cmd.type==='answer'){const q=r.choice;assert(q&&(q.seat===s||this.p(q.seat).isBot)&&cmd.id===q.id,'ไม่ใช่ตัวเลือกของคุณ');this.answer(cmd);return}
  assert(!r.choice,'จัดการตัวเลือกเอฟเฟกต์ก่อน');
  if(cmd.type==='chooseOrder'){assert(r.phase==='order'&&r.orderWinner===s,'รอผู้ชนะการสุ่มเลือกลำดับ');assert(typeof cmd.first==='boolean','เลือกลำดับ');r.first=cmd.first?s:1-s;r.active=r.first;r.setupSeat=r.first;r.phase='setup';this.log(p.name+' · เลือก'+(cmd.first?'เล่นก่อน':'เล่นหลัง'));return}
  if(cmd.type==='leader'&&r.status==='waiting'){assert(!p.ready&&p.field.includes(cmd.code),'เลือกผู้นำก่อนกดพร้อม');p.leader=cmd.code;return}
  if(cmd.type==='ready'||cmd.type==='mulligan'){assert(r.phase==='setup'&&r.setupSeat===s&&!p.ready,'รอจัดมือเริ่มต้นตามลำดับ');if(cmd.type==='mulligan'){assert(!p.mulligan,'เปลี่ยนมือได้ครั้งเดียว');const ids=cmd.indices;assert(Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(i=>Number.isInteger(i)&&i>=0&&i<p.hand.length),'เลือกไพ่ไม่ถูกต้อง');const old=[...ids].sort((a,b)=>b-a).map(i=>p.hand.splice(i,1)[0]);p.deck.push(...old);p.hand.push(...p.deck.splice(0,old.length));shuffle(p.deck);p.mulligan=true;this.log(p.name+' · มัลลิแกน '+old.length+' ใบ')}else{p.ready=true;if(r.players.every(x=>x.ready))this.begin();else r.setupSeat=1-s}return}
  assert(r.status==='playing','รอเริ่มเกม');
  if(cmd.type==='draw'){assert(r.phase==='draw'&&r.active===s,'จั่วได้ครั้งเดียวใน Draw ของคุณ');this.drawTurn();return}
  if(cmd.type==='beginBattle'){assert(r.phase==='action'&&r.active===s,'เข้า Battle ได้หลัง Main ของคุณเท่านั้น');this.enterBattle();return}
  if(cmd.type==='tableMove'){const c=p.table.find(x=>x.id===cmd.id);assert(c&&c.zone===cmd.zone,'ย้ายตำแหน่งได้ในเขตเดิมเท่านั้น');this.position(c,cmd);return}
  if(cmd.type==='tableTake'){const c=this.staged(s);assert(c&&c.id===cmd.id&&!p.locked&&cmd.to==='hand'&&(r.phase==='battle'&&r.active===s||r.phase==='defense'&&r.active!==s),'เก็บกลับมือได้เฉพาะการ์ดที่ยังไม่ยืนยัน');p.hand.push(c.code);p.table=p.table.filter(x=>x.id!==c.id);return}
  assert(cmd.type!=='tableFlip','แอ็กชันต้องเปิดพร้อมกัน และคอนแชร์โตต้องหงายเสมอ');
  if(cmd.type==='tablePlace'){assert(Number.isInteger(cmd.index)&&p.hand[cmd.index]===cmd.code,'การ์ดบนมือเปลี่ยนแล้ว');assert(['action','concerto'].includes(cmd.zone),'พื้นที่ไม่ถูกต้อง');
   if(cmd.zone==='concerto'){assert(r.phase==='action'&&r.active===s&&!p.used.charge,'ชาร์จได้ครั้งเดียวในแอ็กชันเฟสของคุณ');p.used.charge=true}
   else{assert(r.phase==='battle'&&r.active===s||r.phase==='defense'&&r.active!==s,'ยังไม่ถึงช่วงลงแอ็กชันของคุณ');assert(!this.staged(s)&&!p.locked,'ลงแอ็กชันได้ 1 ใบ');assert(this.legal(s,cmd.code),'ค่าร่ายไม่พอ หรือผู้นำไม่ตรงเงื่อนไขการ์ด')}
   const c={id:uid(),code:p.hand[cmd.index],zone:cmd.zone,faceDown:cmd.zone==='action'};this.position(c,cmd);p.hand.splice(cmd.index,1);p.table.push(c);this.log(p.name+(cmd.zone==='action'?' · เซ็ตการ์ดคว่ำ':' · ชาร์จ '+this.c(cmd.code).name));return;
  }
  if(cmd.type==='leader'){assert(r.phase==='action'&&r.active===s&&!p.used.switch,'เปลี่ยนผู้นำได้ครั้งเดียวในแอ็กชันเฟส');this.switch(s,cmd.code);p.used.switch=true;return}
  if(cmd.type==='level'){assert(r.phase==='action'&&r.active===s&&!p.used.level,'อัปเลเวลได้ครั้งเดียวในแอ็กชันเฟส');this.upgrade(s,cmd.code,false,cmd.indices);p.used.level=true;return}
  if(cmd.type==='resolveTable'){const c=this.staged(s);assert(c&&!p.locked,'ลงการ์ดแอ็กชันก่อน');assert(r.phase==='battle'&&r.active===s||r.phase==='defense'&&r.active!==s,'ยังไม่ใช่ช่วงยืนยันของคุณ');assert(this.legal(s,c.code),'ไม่สามารถใช้การ์ดนี้ได้');p.payment=this.payment(s,c.code,cmd.payment);p.locked=true;if(r.phase==='battle'){r.phase='defense'}else this.openDuel();return}
  if(cmd.type==='pass'){assert(!this.staged(s),'เก็บการ์ดที่เซ็ตกลับมือก่อน');if(r.phase==='battle'&&r.active===s){r.lastWinner=1-s;this.log(p.name+' · ข้ามการประลอง');this.end()}else{assert(r.phase==='defense'&&r.active!==s,'ผ่านได้เมื่อรอตอบโต้');p.locked=true;this.openDuel()}return}
  if(cmd.type==='combo'){assert(r.phase==='combo'&&r.comboSeat===s,'ยังไม่ถึงคอมโบของคุณ');this.combo(s,cmd.index,cmd.payment);return}
  if(cmd.type==='end'||cmd.type==='nextRound'){assert(r.phase==='combo'&&r.comboSeat===s||r.phase==='result'&&(r.active===s||this.p(r.active).isBot),'ยังจบเทิร์นไม่ได้');this.end();return}
  throw Error('กฎจริงกำหนดการจั่ว/สับตามเฟสและเอฟเฟกต์ ไม่สามารถใช้คำสั่งอิสระนี้');
 }
 position(c,cmd){assert([cmd.x,cmd.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1),'ตำแหน่งไม่ถูกต้อง');c.x=cmd.x;c.y=cmd.y}
 combo(s,index,payment){const r=this.r,p=this.p(s),code=p.hand[index];assert(Number.isInteger(index)&&code&&this.legal(s,code,true),'ต้องเป็นสีแดงที่จ่ายค่าร่ายและใช้ได้');assert(r.comboLeft!==0&&p.flags.noComboTurn!==r.turn,'ไม่สามารถคอมโบต่อได้');this.pay(s,this.payment(s,code,payment));p.hand.splice(index,1);if(r.comboLeft>0)r.comboLeft--;p.table.push({id:uid(),code,zone:'action',faceDown:false,x:Math.min(.9,p.table.filter(c=>c.zone==='action').length*.15),y:.5});p.flags.bonusDamage=0;r.phase='comboEffects';this.enqueue({type:'effect',event:'combo',seat:s,source:code,ctx:{}},{type:'comboDamage',seat:s,source:code});this.log(p.name+' · คอมโบ '+this.c(code).name)}
 baseDamage(s,code,combo=false){const p=this.p(s),c=this.c(code);let n=Number(c.damage)||0;for(const source of this.all(s)){if(source==='SD01-005'&&c.character==='ฉือเสีย'&&c.info.includes('【リーダースキル】'))n+=3;if(source==='SD02-005'&&this.leader(s,source)&&combo)n++;if(source==='BP01-001'&&this.leader(s,source)&&c.character==='คาเมลเลีย'&&c.color==='แดง')n++;if(source==='BP01-011'&&c.character==='อังกอร์'&&c.color==='แดง')n++;}return Math.max(0,n+(p.flags.bonusDamage||0))}
 damage(s,n){const p=this.p(s);n=Math.max(0,n);for(const code of this.all(s)){if(this.leader(s,code)&&code==='BP01-001')n++;if(this.leader(s,code)&&code==='BP01-002'&&!p.flags.damageTaken)n=Math.max(0,n-1)}if(n>0){p.hp=Math.max(0,p.hp-n);p.flags.damageTaken=true;this.log(p.name+' · รับความเสียหาย '+n)}this.check()}
 advance(){const r=this.r;for(let guard=0;guard<300&&r.status!=='finished';guard++){
  if(r.choice){if(this.p(r.choice.seat).isBot&&r.choice.type!=='manual'){this.botAnswer();continue}return}
  if(r.queue.length){this.process(r.queue.shift());continue}
  if(r.phase==='setup'&&this.p(r.setupSeat).isBot){this.p(r.setupSeat).ready=true;if(r.players.every(p=>p.ready))this.begin();else r.setupSeat=1-r.setupSeat;continue}
  if(r.status!=='playing')return;
  if(r.phase==='draw'&&this.p(r.active).isBot){this.drawTurn();continue}
  if(r.phase==='action'&&this.p(r.active).isBot){this.botAction(r.active);continue}
  if(r.phase==='battle'&&this.p(r.active).isBot){this.botBattle(r.active);continue}
  if(r.phase==='defense'&&this.p(1-r.active).isBot){this.botDefend(1-r.active);continue}
  if(r.phase==='combo'&&this.p(r.comboSeat).isBot){const s=r.comboSeat,i=this.p(s).hand.findIndex(code=>this.legal(s,code,true));if(i>=0&&r.comboLeft!==0&&this.p(s).flags.noComboTurn!==r.turn)this.combo(s,i);else this.end();continue}
  if(r.phase==='result'&&this.p(r.active).isBot){this.end();continue}
  return;
 }assert(r.status==='finished','ขั้นตอนเอฟเฟกต์ยาวเกินไป กรุณาตรวจสอบ')}
 process(o){const r=this.r,p=this.p(o.seat);switch(o.type){
  case 'drawPhase':if(r.status==='playing')r.phase='draw';break;
  case 'draw':this.takeTop(o.seat,o.n,'hand',o.reveal);break;
  case 'drawUpTo':this.request('drawUpTo',o.seat,'เลือกจำนวนการ์ดที่จะเปิดขึ้นมือ',Array.from({length:o.n+1},(_,n)=>({value:String(n),label:n+' ใบ'})));break;
  case 'charge':this.takeTop(o.seat,o.n,'concerto',true);break;
  case 'damage':this.damage(o.seat,o.n);break;
  case 'heal':p.hp+=o.n;this.log(p.name+' · ฟื้นไลฟ์ '+o.n);break;
  case 'pursuit':p.flags.pursuit+=o.n;break;
  case 'flag':p.flags[o.key]=o.value;break;
  case 'effect':this.effect(o);break;
  case 'optional':this.request('optional',o.seat,o.label,[{value:'yes',label:'ใช้เอฟเฟกต์'},{value:'no',label:'ไม่ใช้'}],{ops:o.ops});break;
  case 'discard':{const n=Math.min(o.n,p.hand.length);if(n)this.request('discard',o.seat,'เลือกทิ้งการ์ด '+n+' ใบ',p.hand.map((code,i)=>({value:String(i),code})),{count:n,after:o.after||[]});break}
  case 'switch':{if(p.flags.switchLock)break;const options=p.field.filter(c=>c!==p.leader).map(code=>({value:code,code}));if(options.length)this.request('switch',o.seat,'เลือกผู้นำใหม่',options,{after:o.after||[],expected:o.expected,bonus:o.bonus});break}
  case 'returnAction':{const x=p.table.findIndex(c=>c.zone==='action'&&c.code===o.source);if(x>=0)p.hand.push(p.table.splice(x,1)[0].code);break}
  case 'peek':p.flags.peek=true;this.log(p.name+' · ดูมือฝ่ายตรงข้ามจากเอฟเฟกต์');break;
  case 'tax':this.p(1-o.seat).flags[o.key]=r.turn+1;break;
  case 'payOrDamage':{const opts=[{value:'damage',label:'รับความเสียหาย 3'}];if(this.energy(o.seat).length)opts.unshift({value:'pay',label:'จ่ายคอนแชร์โต 1 ใบ'});this.request('payOrDamage',o.seat,'จ่าย 1 หรือรับความเสียหาย 3',opts);break}
  case 'judge':{const outcome=judgeCards(...r.duel.map((c,s)=>c?{...this.c(c),speed:Number(this.c(c).speed)+(this.p(s).flags.speedBonus||0)}:null),r.active);r.lastDuel={human:r.duel[0],bot:r.duel[1],...outcome,damage:0};r.phase='judgment';this.fieldEvents('judgment');this.cardEvents('judgment');this.enqueue({type:'duelDamage'});break}
  case 'duelDamage':{const s=r.lastDuel.winner;r.lastWinner=s;if(s!==null){const n=this.baseDamage(s,r.duel[s]);r.lastDuel.damage=n;this.damage(1-s,n);r.comboSeat=s;r.comboLeft=this.c(r.duel[s]).color==='แดง'?-1:this.p(s).flags.pursuit;if(this.p(s).flags.noComboTurn===r.turn)r.comboLeft=0;}if(r.status==='playing')r.phase=s!==null&&r.comboLeft!==0?'combo':'result';break}
  case 'comboDamage':this.damage(1-o.seat,this.baseDamage(o.seat,o.source,true));if(r.status==='playing')r.phase='combo';break;
  case 'cleanup':{for(const x of r.players){x.trash.push(...x.table.filter(c=>c.zone==='action').map(c=>c.code));x.table=x.table.filter(c=>c.zone!=='action')}const n=Math.max(0,this.p(r.active).hand.length-8);if(n)this.enqueue({type:'discard',seat:r.active,n});this.enqueue({type:'nextTurn'});break}
  case 'nextTurn':if(this.check()){r.active=1-r.active;r.turn++;this.startTurn()}break;
  case 'manual':this.request('manual',o.seat,'เอฟเฟกต์ที่ต้องจัดการและยืนยัน: '+this.c(o.source).name,[{value:'done',label:'จัดการเอฟเฟกต์แล้ว'}],{source:o.source,event:o.event});break;
 }}
 answer(cmd){const r=this.r,q=r.choice,p=this.p(q.seat),v=cmd.value;assert(q,'ไม่มีตัวเลือก');
  if(q.type==='manual'&&cmd.adjust){const a=cmd.adjust;assert(['life','draw','charge','pursuit','damageBonus','speedBonus','costBonus','noCombo'].includes(a.type),'คำสั่งเอฟเฟกต์ไม่ถูกต้อง');assert([0,1].includes(a.seat)&&Number.isInteger(a.n)&&Math.abs(a.n)<=20,'ค่าเอฟเฟกต์ไม่ถูกต้อง');if(a.type==='life'){this.p(a.seat).hp=Math.max(0,this.p(a.seat).hp+a.n);this.check()}else if(a.type==='draw'||a.type==='charge'){assert(a.n>=0,'จำนวนไม่ถูกต้อง');this.takeTop(a.seat,a.n,a.type==='draw'?'hand':'concerto')}else if(a.type==='pursuit')this.p(a.seat).flags.pursuit+=a.n;else if(a.type==='noCombo')this.p(a.seat).flags.noComboTurn=r.turn+(a.n>0?1:0);else{const key=a.type==='damageBonus'?'bonusDamage':a.type;this.p(a.seat).flags[key]=(this.p(a.seat).flags[key]||0)+a.n}this.log('จัดการเอฟเฟกต์ด้วยตนเอง · '+this.c(q.source).name+' · '+a.type+' '+a.n);return}
  if(q.type==='manual'&&cmd.operation){const a=cmd.operation;assert(q.seat===cmd.actor,'จัดการการ์ดของเจ้าของเอฟเฟกต์เท่านั้น');
   if(a.type==='switch')this.switch(q.seat,a.code);
   else if(a.type==='level')this.upgrade(q.seat,a.code,true);
   else if(a.type==='move'){assert(['hand','trash','reserve'].includes(a.from)&&['hand','trash','concerto','deck'].includes(a.to),'เขตไม่ถูกต้อง');assert(a.from!=='reserve','ตัวละครต้องใช้ปุ่มอัปเลเวล');assert(Number.isInteger(a.index)&&a.index>=0&&a.index<p[a.from].length,'ไม่พบการ์ด');const code=p[a.from].splice(a.index,1)[0];if(a.to==='concerto')p.table.push({id:uid(),code,zone:'concerto',faceDown:false,x:.5,y:.5});else p[a.to].push(code);}
   else throw Error('คำสั่งไม่ถูกต้อง');this.log(p.name+' · จัดการการ์ดตามเอฟเฟกต์ '+this.c(q.source).name);return;
  }
  if(q.type==='discard'){this.discard(q.seat,cmd.indices,q.count);r.choice=null;r.queue.unshift(...q.after);return}
  assert(q.options.some(x=>x.value===v),'ตัวเลือกไม่ถูกต้อง');r.choice=null;
  if(q.type==='optional'&&v==='yes')r.queue.unshift(...q.ops);
  if(q.type==='drawUpTo')this.takeTop(q.seat,Number(v),'hand',true);
  if(q.type==='switch'){const old=this.c(p.leader).character;this.switch(q.seat,v);if(q.expected&&(old===q.expected||this.c(v).character===q.expected))r.queue.unshift(...(q.bonus||[]));r.queue.unshift(...q.after)}
  if(q.type==='payOrDamage'){if(v==='pay')this.pay(q.seat,this.energy(q.seat).slice(0,1).map(x=>x.id));else this.damage(q.seat,3)}
  if(q.type==='manual')this.log(p.name+' · ยืนยันเอฟเฟกต์ '+this.c(q.source).name+' ('+q.event+')');
 }
 botAnswer(){const q=this.r.choice;if(q.type==='discard'){const p=this.p(q.seat);const ids=p.hand.map((code,i)=>({i,c:this.c(code)})).sort((a,b)=>Number(b.c.fee)-Number(a.c.fee)).slice(0,q.count).map(x=>x.i);this.answer({indices:ids});return}let value=q.type==='drawUpTo'?q.options.at(-1).value:q.options[0].value;if(q.type==='switch'&&q.expected)value=q.options.find(x=>this.c(x.value).character===q.expected)?.value||value;this.answer({value})}
 botAction(s){const p=this.p(s);if(!p.used.charge&&p.hand.length){const i=p.hand.map((code,i)=>({code,i,fee:this.cost(s,code)})).sort((a,b)=>b.fee-a.fee)[0].i;const code=p.hand.splice(i,1)[0];p.table.push({id:uid(),code,zone:'concerto',x:.5,y:Math.min(.85,this.energy(s).length*.14),faceDown:false});p.used.charge=true;this.log(p.name+' · ชาร์จ '+this.c(code).name)}
  if(!p.used.level){const target=p.reserve.find(code=>{const c=this.c(code),old=p.field.find(x=>this.c(x).character===c.character);return code!=='BP01-011'&&old&&Number(c.level)===Number(this.c(old).level)+1&&p.hand.length>=Number(c.level)+2&&code.startsWith('SD')});if(target){this.upgrade(s,target,false,Array.from({length:Number(this.c(target).level)},(_,i)=>p.hand.length-1-i));p.used.level=true;return}}
  this.enterBattle();
 }
 drawTurn(){const r=this.r,n=r.turn===1?1:2;this.takeTop(r.active,n);this.log(this.p(r.active).name+' · จั่ว '+n+' ใบใน Draw');if(r.status==='playing')r.phase='action'}
 enterBattle(){this.r.phase='battle';this.log(this.p(this.r.active).name+' · เข้าสู่ Battle');this.fieldEvents('battleStart')}
 botBattle(s){const p=this.p(s);
  const legal=p.hand.map((code,i)=>({code,i})).filter(x=>this.legal(s,x.code));if(!legal.length){this.r.lastWinner=1-s;this.end();return}legal.sort((a,b)=>this.baseDamage(s,b.code)-this.baseDamage(s,a.code));const pick=this.r.difficulty==='easy'?legal[randomInt(legal.length)]:legal[0];this.botSet(s,pick);this.r.phase='defense';
 }
 botSet(s,pick){const p=this.p(s);p.hand.splice(pick.i,1);p.table.push({id:uid(),code:pick.code,zone:'action',x:.3,y:.5,faceDown:true});p.payment=this.payment(s,pick.code);p.locked=true;this.log(p.name+' · เซ็ตการ์ดคว่ำ')}
 botDefend(s){const legal=this.p(s).hand.map((code,i)=>({code,i})).filter(x=>this.legal(s,x.code));if(legal.length){legal.sort((a,b)=>this.baseDamage(s,b.code)-this.baseDamage(s,a.code));this.botSet(s,this.r.difficulty==='easy'?legal[randomInt(legal.length)]:legal[0])}this.openDuel()}
 effect(o){const {seat:s,source:code,event:e}=o,p=this.p(s),r=this.r,c=this.c(code),won=r.lastDuel?.winner===s,own=this.c(r.duel?.[s]),other=this.c(r.duel?.[1-s]);const ops=[],add=(type,n,extra={})=>ops.push(this.op(type,s,n,extra)),optional=(label,inner)=>ops.push({type:'optional',seat:s,label,ops:inner}),isLeader=this.leader(s,code);
  // Exact source-code handlers. Other printed effects are never silently discarded.
  const supported=code.startsWith('SD')||['BP01-018','BP01-021','BP01-024','BP01-027','BP01-030','BP01-033'].includes(code);
  if(!supported){if(c.info&&c.info!=='-'&&this.triggerMatches(c,e,isLeader)&&!(e==='start'&&s!==r.active)&&!(e==='end'&&c.info.includes('【自分のターン終了時】')&&s!==r.active))ops.push({type:'manual',seat:s,source:code,event:e});r.queue.unshift(...ops);return}
  if(c.type==='character'){
   if(e==='start'&&s===r.active&&code==='SD01-001')add('draw',1);
   if(e==='end'&&isLeader&&code==='SD02-001')add('draw',1);
   if(e==='end'&&isLeader&&code==='SD02-003')add('charge',1);
   if(e==='confront'&&isLeader){if(['BP01-018','BP01-021'].includes(code)&&own?.color==='เขียว')add('drawUpTo',2);if(['BP01-024','BP01-033'].includes(code)&&own?.color==='น้ำเงิน'){if(code==='BP01-024')optional(c.name+' · ชาร์จใบบนสุด',[this.op('charge',s,1)]);else add('charge',1)};if(['BP01-027','BP01-030'].includes(code)&&own?.color==='แดง')ops.push(this.op('damage',1-s,1));if(code==='SD01-003'&&other?.color==='แดง')ops.push({type:'payOrDamage',seat:1-s})}
   if(e==='judgment'&&isLeader&&!won&&r.lastDuel.winner!==null){const matches={ 'SD01-002':['เขียว','แดง'],'SD02-002':['เขียว','แดง'],'SD01-004':['น้ำเงิน','เขียว'],'SD02-004':['น้ำเงิน','เขียว'],'SD01-006':['แดง','น้ำเงิน'],'SD02-006':['แดง','น้ำเงิน']};const m=matches[code];if(m&&own?.color===m[0]&&other?.color===m[1]){if(code==='SD02-006')add('draw',1,{reveal:true});else optional(c.name+' · เปิดการ์ดบนสุดขึ้นมือ',[this.op('draw',s,1,{reveal:true})])}}
  }else{
   if(e==='confront'&&code==='SD02-010')add('flag',0,{key:'switchLock',value:true});
   if(e==='judgment'){
    if(code==='SD01-010'&&!won&&other?.color==='น้ำเงิน')optional('นำ '+c.name+' กลับมือ',[{type:'returnAction',seat:s,source:code}]);
    if(won){const num=Number(code.slice(-3));if([13,15,21].includes(num)&&!(code==='SD02-015')){if(num!==13)add('draw',1);add('pursuit',num===15?1:2)}if(num===18){add('draw',1);add('discard',1)}if(num===20){add('draw',1);add('peek',0)}if(code==='SD01-023')add('heal',5);if(code==='SD01-016')add('tax',0,{key:'redTaxTurn'});if(code==='SD02-016')add('tax',0,{key:'noComboTurn'});if(code==='SD02-015')add('charge',2);if(code==='SD02-010'){add('draw',3);add('pursuit',8)}}
   }
   if(e==='combo'){
    const num=Number(code.slice(-3));if([9,14,19].includes(num)){const expected=num===9?(code.startsWith('SD01')?'ฉือเสีย':'จินซี'):num===14?(code.startsWith('SD01')?'หยางหยาง':'ซานฮวา'):(code.startsWith('SD01')?'โรเวอร์ (หญิง)':'โรเวอร์ (ชาย)');const bonus=num===9?[this.op('flag',s,0,{key:'bonusDamage',value:2})]:[this.op(num===14?'charge':'draw',s,1)];ops.push({type:'switch',seat:s,expected,bonus})}if(code==='SD02-011'&&p.table.filter(c=>c.zone==='action').length>=3)add('flag',0,{key:'bonusDamage',value:3});
   }
  }
  r.queue.unshift(...ops);
 }
 triggerMatches(c,event,isLeader){if(c.info.includes('【リーダー】')&&!isLeader)return false;const keys={start:['【自分のターン開始時】'],end:['【各ターン終了時】','【自分のターン終了時】'],battleStart:['【自分の対抗フェイズ開始時】'],battleEnd:['【各対抗フェイズ終了時】'],confront:['【対抗】'],judgment:['【判定】'],combo:['【連撃】'],enter:['【登場】'],level:['【レベルアップ】'],switch:['【切り替え】']};return (keys[event]||[]).some(k=>c.info.includes(k))||c.type==='action'&&['confront','combo'].includes(event)&&!Object.values(keys).flat().some(k=>c.info.includes(k))&&!!c.info.trim()}
}
