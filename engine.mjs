import {initRules,rulesAct,rulesView} from './rules-core.mjs';
import {randomInt,randomBytes} from 'node:crypto';
import {prepareBotRound,botAction} from './bot.mjs';
import {validateDeck} from './public/deck-rules.js';
export const key=()=>randomBytes(24).toString('base64url');
export const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
export function makePlayer(name,entries,cards){const v=validateDeck(entries,cards);if(!v.valid)throw Error(v.errors.join(' · '));const list=Object.entries(entries).flatMap(([code,n])=>Array(n).fill(code));const map=new Map(cards.map(c=>[c.code,c]));const characters=list.filter(c=>map.get(c).type==='character');const draw=shuffle(list.filter(c=>map.get(c).type==='action'));const field=characters.filter(c=>map.get(c).level==='0');return {token:key(),name:name.trim().slice(0,32)||'ผู้เล่น',hp:20,ready:false,hand:draw.splice(0,5),deck:draw,field,reserve:characters.filter(c=>!field.includes(c)),leader:field[0],table:[],action:[],concerto:[],trash:[],pending:null,mulligan:false,revealHand:false};}
export function publicRoom(room,token){const seat=room.players.findIndex(p=>p.token===token);if(seat<0)throw Error('คุณไม่มีสิทธิ์เข้าห้องนี้');return {...(room.rulesVersion?rulesView(room,seat):{}),mode:room.mode||'friend',difficulty:room.difficulty,botPhase:room.botPhase,lastDuel:room.lastDuel,winner:room.winner,code:room.code,version:room.version,turn:room.turn,active:room.active,status:room.status,seat,log:room.log,players:room.players.map((p,i)=>({name:p.name,hp:p.hp,energy:p.energy||0,isBot:!!p.isBot,ready:p.ready,leader:room.rulesVersion&&room.status==='waiting'&&i!==seat?null:p.leader,field:room.rulesVersion&&room.status==='waiting'&&i!==seat?[]:p.field,stacks:room.rulesVersion&&room.status==='waiting'&&i!==seat?{}:p.stacks,used:p.used,locked:p.locked,flags:i===seat?p.flags:undefined,table:(p.table||[]).map(c=>({...c,code:c.faceDown&&i!==seat?null:c.code})),action:p.action,concerto:p.concerto,trash:p.trash,handCount:p.hand.length,deckCount:p.deck.length,reserveCount:p.reserve.length,hand:i===seat||p.revealHand||room.players[seat].flags?.peek?p.hand:[],reserve:i===seat?p.reserve:[],pending:i===seat?p.pending:!!p.pending,mulligan:p.mulligan,revealHand:p.revealHand}))};}
export function act(room,token,cmd,cards){const seat=room.players.findIndex(p=>p.token===token);if(seat<0)throw Error('คุณไม่มีสิทธิ์เข้าห้องนี้');if(room.rulesVersion){rulesAct(room,seat,cmd,cards);return publicRoom(room,token)}if(room.mode==='bot'&&!['ready','mulligan','tablePlace','tableMove','tableFlip','tableTake'].includes(cmd.type)){botAction(room,seat,cmd,cards);return publicRoom(room,token)}const p=room.players[seat],map=new Map(cards.map(c=>[c.code,c]));let note='';const live=()=>{if(room.status!=='playing')throw Error('รอผู้เล่นทั้งสองกดพร้อมก่อน')};const move=(from,to,index)=>{if(!Array.isArray(p[from])||!Array.isArray(p[to])||!Number.isInteger(index)||index<0||index>=p[from].length)throw Error('ไม่พบการ์ด');const c=p[from].splice(index,1)[0];p[to].push(c);return c};
 if(cmd.type==='ready'){if(room.status!=='waiting')throw Error('เริ่มเกมไปแล้ว');p.ready=true;note='พร้อมเล่น';if(room.players.length===2&&room.players.every(x=>x.ready)){room.status='playing';room.active=randomInt(2);note+=' · เริ่มดวล';if(room.mode==='bot')prepareBotRound(room,cards)}}
 else if(cmd.type==='mulligan'){if(room.status!=='waiting'||p.ready||p.mulligan)throw Error('เปลี่ยนมือได้ครั้งเดียวก่อนกดพร้อม');if(!Array.isArray(cmd.indices)||new Set(cmd.indices).size!==cmd.indices.length||cmd.indices.some(i=>!Number.isInteger(i)||i<0||i>=p.hand.length))throw Error('เลือกการ์ดไม่ถูกต้อง');const old=cmd.indices.sort((a,b)=>b-a).map(i=>p.hand.splice(i,1)[0]);p.hand.push(...p.deck.splice(0,old.length));p.deck.push(...old);shuffle(p.deck);p.mulligan=true;note='เปลี่ยนมือเริ่มต้น '+old.length+' ใบ'}
 else{live();switch(cmd.type){
 case 'tablePlace':case 'tableMove':case 'tableFlip':case 'tableTake':{
 if(cmd.version!==room.version)throw Error('สนามเปลี่ยนแล้ว กรุณาลองอีกครั้ง');
 const items=p.table||[];
 if(room.mode==='bot'){
  if(seat!==0||room.botPhase!=='choose')throw Error('จัดสนามได้ในช่วงเลือกการ์ดเท่านั้น');
  if(cmd.type==='tableTake'&&cmd.to!=='hand')throw Error('นำการ์ดกลับมือเพื่อเลือกใหม่ได้');
  if(['tablePlace','tableMove'].includes(cmd.type)&&cmd.zone==='action'){
   if(items.some(c=>c.zone==='action'&&c.id!==cmd.id))throw Error('เลือกการ์ดแอ็กชันได้รอบละ 1 ใบ');
   const code=cmd.type==='tablePlace'?p.hand[cmd.index]:items.find(c=>c.id===cmd.id)?.code;
   if(!map.has(code)||Number(map.get(code).fee)>p.energy)throw Error('พลังงานไม่พอ');
  }
 }

 const item=items.find(c=>c.id===cmd.id);
 if(cmd.type!=='tablePlace'&&!item)throw Error('ไม่พบการ์ดในสนามของคุณ');
 if(['tablePlace','tableMove'].includes(cmd.type)){
  if(!['action','concerto'].includes(cmd.zone)||![cmd.x,cmd.y].every(n=>Number.isFinite(n)&&n>=0&&n<=1))throw Error('ตำแหน่งไม่ถูกต้อง');
  if(cmd.type==='tablePlace'){
   if(typeof cmd.faceDown!=='boolean'||!Number.isInteger(cmd.index)||cmd.index<0||cmd.index>=p.hand.length||p.hand[cmd.index]!==cmd.code)throw Error('การ์ดบนมือเปลี่ยนแล้ว');
   items.push({id:key(),code:p.hand.splice(cmd.index,1)[0],zone:cmd.zone,x:cmd.x,y:cmd.y,faceDown:cmd.faceDown});
   note=cmd.faceDown?'ลงการ์ดคว่ำ':'ลงการ์ดหงาย · '+map.get(cmd.code).name;
  }else{Object.assign(item,{zone:cmd.zone,x:cmd.x,y:cmd.y});note='ย้ายตำแหน่งการ์ดในสนาม'}
 }else if(cmd.type==='tableFlip'){item.faceDown=!item.faceDown;note=item.faceDown?'คว่ำการ์ด':'หงายการ์ด · '+map.get(item.code).name}
 else{if(!['hand','trash'].includes(cmd.to))throw Error('เขตการ์ดไม่ถูกต้อง');items.splice(items.indexOf(item),1);p[cmd.to].push(item.code);note='นำการ์ด'+(cmd.to==='hand'?'กลับมือ':'ไปกองทิ้ง')}
 p.table=items;break;
 }
 case 'draw':if(!p.deck.length)throw Error('เด็คหมดแล้ว');p.hand.push(p.deck.shift());note='จั่ว 1 ใบ';break;
 case 'shuffle':shuffle(p.deck);note='สับเด็ค';break;
 case 'hp':if(!Number.isInteger(cmd.delta)||Math.abs(cmd.delta)!==1)throw Error('ค่าไลฟ์ไม่ถูกต้อง');p.hp=Math.max(0,Math.min(20,p.hp+cmd.delta));note='ปรับไลฟ์เป็น '+p.hp;break;
 case 'leader':if(!p.field.includes(cmd.code))throw Error('ตัวละครไม่อยู่ในสนาม');p.leader=cmd.code;note='เปลี่ยนผู้นำเป็น '+map.get(cmd.code).name;break;
 case 'level':{const c=map.get(cmd.code);const old=p.field.find(x=>map.get(x).character===c?.character);if(!old||!p.reserve.includes(cmd.code))throw Error('ไม่พบตัวละครในเด็คตัวละคร');p.reserve.splice(p.reserve.indexOf(cmd.code),1);p.reserve.push(old);p.field[p.field.indexOf(old)]=cmd.code;if(p.leader===old)p.leader=cmd.code;note='เปลี่ยนเลเวล '+c.name+' เป็น '+c.level;break}
 case 'move':{const allowed=['hand','deck','action','concerto','trash'];if(!allowed.includes(cmd.from)||!allowed.includes(cmd.to)||cmd.from===cmd.to)throw Error('เขตการ์ดไม่ถูกต้อง');if(cmd.from==='deck'&&cmd.index!==0)throw Error('เลือกได้เฉพาะใบบนสุด');const c=move(cmd.from,cmd.to,cmd.index);note='ย้ายการ์ด '+cmd.from+' → '+cmd.to;if(!['hand','deck'].includes(cmd.to))note+=' · '+map.get(c).name;break}
 case 'commit':if(p.pending)throw Error('วางคว่ำไว้แล้ว');if(!Number.isInteger(cmd.index)||cmd.index<0||cmd.index>=p.hand.length)throw Error('ไม่พบการ์ด');p.pending=p.hand.splice(cmd.index,1)[0];note='วางการ์ดคว่ำ';if(room.players.every(x=>x.pending)){for(const x of room.players){x.action.push(x.pending);x.pending=null}note='ทั้งสองฝ่ายเปิดการ์ดพร้อมกัน'}break;
 case 'cancel':if(!p.pending)throw Error('ไม่มีการ์ดคว่ำ');p.hand.push(p.pending);p.pending=null;note='นำการ์ดคว่ำกลับมือ';break;
 case 'reveal':p.revealHand=!p.revealHand;note=p.revealHand?'เปิดมือให้คู่เล่นดู':'ซ่อนมือ';break;
 case 'end':if(room.active!==seat)throw Error('ยังไม่ใช่เทิร์นของคุณ');if(room.players.some(x=>x.pending))throw Error('ยังมีการ์ดคว่ำรอเปิด');room.turn++;room.active=1-seat;note='ส่งเทิร์น';break;
 case 'clear':p.trash.push(...(p.table||[]).filter(c=>c.zone==='action').map(c=>c.code));p.table=(p.table||[]).filter(c=>c.zone!=='action');p.trash.push(...p.action);p.action=[];note='นำการ์ดแอ็กชันทั้งหมดไปกองทิ้ง';break;
 case 'surrender':room.status='finished';note='ยอมแพ้ · '+room.players[1-seat].name+' ชนะ';break;
 default:throw Error('คำสั่งไม่ถูกต้อง');}}
 room.version++;room.log.push({time:new Date().toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok'}),text:p.name+' · '+note});room.log=room.log.slice(-100);return publicRoom(room,token);
}
