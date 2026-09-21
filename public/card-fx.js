import {displayPhase} from './phase-track.js';
// Draw and card handling use user-provided local recordings; flips are synthesized.
let context,enabled=true,previous=null,drawBufferPromise,handleBufferPromise,phaseBufferPromise;
function loadDrawSound(){
 if(!context)return null;
 drawBufferPromise??=fetch("/audio/card-draw.mp3").then(r=>{if(!r.ok)throw Error("Draw audio unavailable");return r.arrayBuffer()}).then(data=>context.decodeAudioData(data)).catch(()=>{drawBufferPromise=null;return null});
 return drawBufferPromise;
}
function loadHandleSound(){
 if(!context)return null;
 handleBufferPromise??=fetch('/audio/card-handle.mp3').then(r=>{if(!r.ok)throw Error('Card handling audio unavailable');return r.arrayBuffer()}).then(data=>context.decodeAudioData(data)).catch(()=>{handleBufferPromise=null;return null});
 return handleBufferPromise;
}
function loadPhaseSound(){
 if(!context)return null;
 phaseBufferPromise??=fetch('/audio/phase-change.mp3').then(r=>{if(!r.ok)throw Error('Phase audio unavailable');return r.arrayBuffer()}).then(data=>context.decodeAudioData(data)).catch(()=>{phaseBufferPromise=null;return null});
 return phaseBufferPromise;
}
try{enabled=localStorage.getItem('wuwa-sound')!=='off'}catch{}
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function ensureContext(){
 if(!enabled)return null;
 try{
  context??=new (window.AudioContext||window.webkitAudioContext)();
  if(context.state==='suspended')context.resume().catch(()=>{});
  loadDrawSound();loadHandleSound();loadPhaseSound();
  return context;
 }catch{return null}
}
function unlock(){
 ensureContext();
}
document.addEventListener('pointerdown',unlock,{passive:true});
document.addEventListener('keydown',unlock);
export function sound(kind){
 if(!enabled||document.hidden)return;
 const ctx=ensureContext();
 if(!ctx)return;
 if(ctx.state==='suspended'){
  ctx.resume().then(()=>{if(ctx.state==='running')sound(kind)}).catch(()=>{});
  return;
 }
 if(ctx.state!=='running')return;
 if(['draw','lift','place','phase','card','handle'].includes(kind)){
  const promise=kind==='phase'?loadPhaseSound():kind==='draw'?loadDrawSound():loadHandleSound();
  promise?.then(buffer=>{
   if(!buffer||!enabled||document.hidden||ctx.state!=='running')return;
   const source=ctx.createBufferSource(),gain=ctx.createGain();
   source.buffer=buffer;
   gain.gain.value=kind==='phase'?.55:.7;
   source.connect(gain);
   gain.connect(ctx.destination);
   source.start();
   source.onended=()=>{source.disconnect();gain.disconnect()};
  });
  return;
 }
 const t=ctx.currentTime;
 const notes=kind==='flip'?[[560,900,0,.09],[900,1250,.07,.12]]:kind==='lift'?[[280,620,0,.1]]:[[180,65,0,.13],[420,180,.025,.06]];
 for(const [from,to,delay,duration] of notes){
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=kind==='place'?'triangle':'sine';
  osc.frequency.setValueAtTime(from,t+delay);osc.frequency.exponentialRampToValueAtTime(to,t+delay+duration);
  gain.gain.setValueAtTime(.0001,t+delay);gain.gain.exponentialRampToValueAtTime(.065,t+delay+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+delay+duration);
  osc.connect(gain);gain.connect(ctx.destination);osc.start(t+delay);osc.stop(t+delay+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect()};
 }
}
function animate(el,kind){
 if(!el||reduced()||!el.animate)return;
 // Animate individual scale/rotate properties to retain the card's position transform.
 const frames=kind==='flip'?[{scale:'1 1',filter:'brightness(1)'},{scale:'0.04 1',filter:'brightness(1.6)',offset:.45},{scale:'1 1',filter:'brightness(1)'}]:[{translate:'0 -18px',scale:'1.13',filter:'brightness(1.3)'},{translate:'0 2px',scale:'.97',offset:.7},{translate:'0 0',scale:'1',filter:'brightness(1)'}];
 el.animate(frames,{duration:kind==='flip'?420:330,easing:'ease-out'});
}
export function pickup(el){sound('lift');el?.classList.add('card-held')}
export function release(el){el?.classList.remove('card-held')}
export function installSound(){
 const button=document.createElement('button');button.id='sound-toggle';button.type='button';
 const label=()=>{button.textContent=enabled?'♪ เสียง: เปิด':'♪ เสียง: ปิด';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'ปิดเสียงการ์ด':'เปิดเสียงการ์ด')};
 label();button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem('wuwa-sound',enabled?'on':'off')}catch{}label();if(enabled){unlock();sound('lift')}else context?.suspend().catch(()=>{})});
 document.querySelector('header').append(button);
}
export function updateEffects(room,visible){
 if(!room||!visible){previous=null;return}
 const next=structuredClone(room),old=previous;previous=next;
 if(!old||old.code!==room.code||old.version===room.version)return;
 const beforePhase=displayPhase(old),currentPhase=displayPhase(room);
 const phaseChanged=beforePhase!==currentPhase&&!['setup','finished'].includes(currentPhase)&&['draw','main','battle','combo','end'].includes(currentPhase);
 let effect=null,drew=false;
 room.players.forEach((p,seat)=>{
  const before=old.players[seat];if(!before)return;
  for(const c of p.table||[]){
   const was=(before.table||[]).find(x=>x.id===c.id);
   const kind=!was?'place':was.faceDown!==c.faceDown?'flip':was.x!==c.x||was.y!==c.y||was.zone!==c.zone?'place':null;
   if(kind){animate(document.querySelector(`[data-fx-card="${c.id}"]`),kind);effect=kind==='flip'?'flip':effect||kind}
  }
  if(p.action.length>before.action.length){document.querySelectorAll(`${seat===room.seat?'.own-mat':'.opponent-mat'} .mat-action .mat-card`).forEach(el=>animate(el,'flip'));effect='flip'}
  if(seat===room.seat&&p.hand.length>before.hand.length){document.querySelectorAll('.hand .card').forEach((el,i)=>{if(i>=before.hand.length)animate(el,'place')});if(p.deckCount<before.deckCount||before.deckCount===0&&p.trash.length<before.trash.length)drew=true;else effect??='lift'}
 });
 if(drew){
  sound('draw');
  if(phaseChanged)setTimeout(()=>sound('phase'),220);
 }else{
  if(phaseChanged)sound('phase');
  else if(effect)sound(effect);
 }
}

