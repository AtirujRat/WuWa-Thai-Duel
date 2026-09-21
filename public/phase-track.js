export function displayPhase(room){
const current=room.status==='finished'?'finished':room.status==='waiting'||['waiting','order','setup'].includes(room.phase)?'setup':room.rulesVersion?({start:'draw',draw:'draw',action:'main',battle:'battle',defense:'battle',reveal:'battle',judgment:'battle',combo:'combo',comboEffects:'combo',result:'end',end:'end'}[room.phase]||'main'):room.botPhase==='result'?'end':'main';
 
}
export function phaseTrack(room){
 const steps=[['draw','Draw','จั่ว'],['main','Main','เตรียมการ์ด'],['battle','Battle','ตัดสิน'],['combo','Combo','โจมตีต่อ'],['end','End','จบเทิร์น']];
  const current=displayPhase(room);const index=steps.findIndex(([key])=>key===current);
 return '<div class="phase-track" aria-label="ลำดับเฟสการเล่น"><span class="phase-caption">'+(current==='setup'?'เตรียมเริ่มเกม':current==='finished'?'จบเกม':'ลำดับเฟส')+'</span><ol>'+steps.map(([key,en,th],i)=>'<li class="'+(key===current?'current':i<index?'complete':'')+'" '+(key===current?'aria-current="step"':'')+'><span>'+en+'</span><small>'+th+'</small></li>').join('')+'</ol><span class="phase-note">'+(room.rulesVersion?'Draw กดจั่วเพื่อเข้า Main · Combo เมื่อเข้าเงื่อนไข':'ห้องเดิม: แสดงลำดับอ้างอิง')+'</span></div>';
}

