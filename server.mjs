import {initRules} from './rules-core.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {key,makePlayer,publicRoom,act,isBotPending,getBotStepDelay,stepBot} from './engine.mjs';
import {presetDeck} from './public/deck-rules.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.mp3':'audio/mpeg'};
const dataDir=process.env.DATA_DIR||path.join(root,'data');fs.mkdirSync(dataDir,{recursive:true});const dataFile=path.join(dataDir,'demo-v2.json');
const legacyFile=path.join(dataDir,'demo.json');if(!fs.existsSync(dataFile)&&fs.existsSync(legacyFile))fs.copyFileSync(legacyFile,dataFile);
const state=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):{profiles:{},rooms:{}};
const save=()=>{fs.writeFileSync(dataFile+'.tmp',JSON.stringify(state));fs.renameSync(dataFile+'.tmp',dataFile)};
const cards=JSON.parse(fs.readFileSync(path.join(root,'public/cards.json'),'utf8'));
const botTimers=new Map();
function scheduleBot(code,delay=1000){
 if(botTimers.has(code))clearTimeout(botTimers.get(code));
 const t=setTimeout(()=>{
  botTimers.delete(code);
  const room=state.rooms[code];
  if(!room||room.status!=='playing'||room.mode!=='bot')return;
  const stepped=stepBot(room,cards);
  if(stepped){
   save();
   if(isBotPending(room))scheduleBot(code,getBotStepDelay(room));
  }
 },delay);
 botTimers.set(code,t);
}
function body(req){return new Promise((resolve,reject)=>{let text='';req.on('data',chunk=>{text+=chunk;if(text.length>50000){reject(Error('ข้อมูลมากเกินไป'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(text||'{}'))}catch{reject(Error('ข้อมูลไม่ถูกต้อง'))}});req.on('error',reject)})}
const json=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data))};
const buckets=new Map();
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
  if(!['GET','POST','DELETE'].includes(req.method))return json(res,{error:'Method not allowed'},405);
  if(req.headers.origin&&!['http:','https:'].some(protocol=>req.headers.origin===`${protocol}//${req.headers.host}`))return json(res,{error:'Origin not allowed'},403);
  let id=(req.headers.cookie||'').match(/(?:^|;\s*)wuwa=([A-Za-z0-9_-]+)/)?.[1];
  if(!id||!Object.hasOwn(state.profiles,id)){id=key();state.profiles[id]={decks:[]};save();res.setHeader('Set-Cookie',`wuwa=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`)}
  const profile=state.profiles[id];let b={};if(req.method==='POST'){
   const address=req.socket.remoteAddress;const bucket=buckets.get(address)||{time:Date.now(),n:0};if(Date.now()-bucket.time>60000){bucket.time=Date.now();bucket.n=0}bucket.n++;buckets.set(address,bucket);if(bucket.n>300)return json(res,{error:'กรุณารอสักครู่'},429);b=await body(req);
  }
  if(url.pathname==='/api/decks'){
   if(req.method==='GET')return json(res,profile.decks);
   if(typeof b.name!=='string'||b.name.length>80||!b.entries||typeof b.entries!=='object'||Array.isArray(b.entries))throw Error('รูปแบบเด็คไม่ถูกต้อง');
   for(const [code,n] of Object.entries(b.entries)){const c=cards.find(c=>c.code===code);if(!c||!Number.isInteger(n)||n<1||n>(c.type==='character'?1:3))throw Error('การ์ดหรือจำนวนไม่ถูกต้อง')}
   const old=b.id?profile.decks.find(d=>d.id===b.id):null;if(b.id&&!old)throw Error('ไม่พบเด็ค');if(!old&&profile.decks.length>=100)throw Error('เก็บได้ไม่เกิน 100 เด็ค');const deck={id:old?.id||key(),name:b.name.trim()||'เด็คของฉัน',entries:b.entries};if(old)profile.decks[profile.decks.indexOf(old)]=deck;else profile.decks.push(deck);save();return json(res,deck);
  }
  const dm=url.pathname.match(/^\/api\/decks\/([A-Za-z0-9_-]+)$/);
  if(dm){
   if(req.method!=='DELETE')return json(res,{error:'Method not allowed'},405);
   const idx=profile.decks.findIndex(d=>d.id===dm[1]);
   if(idx===-1)return json(res,{error:'ไม่พบเด็ค'},404);
   profile.decks.splice(idx,1);save();return json(res,{ok:true});
  }
  if(url.pathname==='/api/rooms/bot'&&req.method==='POST'){
   if(typeof b.name!=='string'||!['easy','normal'].includes(b.difficulty)||!['SD01','SD02'].includes(b.botDeck))throw Error('ตัวเลือกบอทไม่ถูกต้อง');
   let code;do{code=key().slice(0,8)}while(Object.hasOwn(state.rooms,code));
   const p=makePlayer(b.name,b.entries,cards),bot=makePlayer('บอท '+b.botDeck,presetDeck(b.botDeck,cards).entries,cards);bot.isBot=true;bot.ready=true;
   const room={rulesVersion:1,code,mode:'bot',difficulty:b.difficulty,version:1,turn:1,active:0,status:'waiting',created:Date.now(),players:[p,bot],log:[]};
   if(room.rulesVersion)initRules(room);state.rooms[code]=room;save();if(room.mode==='bot'&&isBotPending(room))scheduleBot(code,getBotStepDelay(room));return json(res,{token:p.token,room:publicRoom(room,p.token)});
  }
  if(url.pathname==='/api/rooms/create'&&req.method==='POST'){

   if(typeof b.name!=='string')throw Error('กรอกชื่อผู้เล่น');let code;do{code=key().slice(0,8)}while(Object.hasOwn(state.rooms,code));const p=makePlayer(b.name,b.entries,cards);const room={rulesVersion:1,code,version:1,turn:1,active:0,status:'waiting',created:Date.now(),players:[p],log:[]};state.rooms[code]=room;save();return json(res,{token:p.token,room:publicRoom(room,p.token)});
  }
  if(url.pathname==='/api/rooms/join'&&req.method==='POST'){
   if(typeof b.code!=='string'||!Object.hasOwn(state.rooms,b.code))throw Error('ไม่พบรหัสห้อง');const room=state.rooms[b.code];if(room.players.length>=2)throw Error('ห้องนี้มีผู้เล่นครบแล้ว');if(typeof b.name!=='string')throw Error('กรอกชื่อผู้เล่น');const p=makePlayer(b.name,b.entries,cards);room.players.push(p);if(room.rulesVersion)initRules(room);room.version++;save();return json(res,{token:p.token,room:publicRoom(room,p.token)});
  }
  const m=url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]{8})$/);if(m){const room=Object.hasOwn(state.rooms,m[1])?state.rooms[m[1]]:null;if(!room)return json(res,{error:'ไม่พบห้อง'},404);const token=req.headers.authorization?.replace(/^Bearer /,'');if(!room.players.some(p=>p.token===token))return json(res,{error:'คุณไม่มีสิทธิ์เข้าห้องนี้'},403);if(req.method==='GET'){if(room.mode==='bot'&&isBotPending(room)&&!botTimers.has(m[1]))scheduleBot(m[1],getBotStepDelay(room));return json(res,publicRoom(room,token))}if(botTimers.has(m[1])){clearTimeout(botTimers.get(m[1]));botTimers.delete(m[1])}const draft=structuredClone(room);const result=act(draft,token,b,cards,{pacedBot:draft.mode==='bot'});state.rooms[m[1]]=draft;save();if(draft.mode==='bot'&&isBotPending(draft))scheduleBot(m[1],getBotStepDelay(draft));return json(res,result)}
  return json(res,{error:'Not found'},404);
 }
 if(req.method!=='GET'){res.writeHead(405);return res.end()}
 const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);const file=path.resolve(root,'public',rel);
 if(!file.startsWith(path.join(root,'public')+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found')}
 res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-cache'});fs.createReadStream(file).pipe(res);
 }catch(e){if(!res.headersSent)json(res,{error:e.message||'เกิดข้อผิดพลาด'},400)}});
const port=Number(process.env.PORT||4174);server.listen(port,'0.0.0.0',()=>{console.log('WuWa Thai Duel: http://localhost:'+port);for(const list of Object.values(os.networkInterfaces()))for(const n of list||[])if(n.family==='IPv4'&&!n.internal)console.log('LAN: http://'+n.address+':'+port)});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port is already in use. Open http://localhost:'+port:e.message);process.exitCode=1});
