import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getDatabase, ref, set, get, update, onValue, onChildAdded, onDisconnect,
  push, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js';

const $ = (id) => document.getElementById(id);
const screens = ['homeScreen','lobbyScreen','gameScreen','resultScreen'];
const els = Object.fromEntries([
  'nickname','roomInput','createBtn','joinBtn','homeError','setupHint','netDot','netText','roomCodeText','copyRoomBtn',
  'p1Card','p2Card','p1Name','p2Name','p1State','p2State','readyBtn','leaveBtn','lobbyNote','myScoreName','opScoreName',
  'myScore','opScore','timer','maxTile','statusText','board','gameOverlay','overlayBig','overlaySmall','opBoard','feed',
  'resultEmoji','resultTitle','resultScore','rematchBtn','resultLeaveBtn','rematchNote'
].map(id => [id,$(id)]));

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE_');
if (!configured) {
  els.setupHint.style.display = 'block';
  els.netText.textContent = '需要配置 Firebase';
}

let app, auth, db, uid = null;
let roomCode = null, mySlot = null, roomData = null;
let roomUnsub = null, attackUnsub = null, connectedUnsub = null;
let serverOffset = 0;
let phase = 'idle', roundId = null, endTimer = null, renderTimer = null;
let board = [], score = 0, maxTile = 2, frozenUntil = 0, shieldActive = false;
let lastMoveAt = 0, touchStart = null;
let cooldownUntil = { freeze:0, garbage:0, shield:0 };
const COOLDOWNS = { freeze:10000, garbage:12000, shield:15000 };
const GAME_MS = 90000;

function showScreen(id){ screens.forEach(s => $(s).classList.toggle('active', s===id)); }
function showError(msg){ els.homeError.textContent = msg; els.homeError.classList.add('show'); }
function clearError(){ els.homeError.classList.remove('show'); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
function normalizeName(){ return els.nickname.value.trim().slice(0,12); }
function randomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
function serverNow(){ return Date.now()+serverOffset; }
function slotOther(){ return mySlot==='p1'?'p2':'p1'; }
function player(pathSlot=mySlot){ return roomData?.players?.[pathSlot] || null; }
function addFeed(text){ const d=document.createElement('div'); d.className='feed-item'; d.textContent=text; els.feed.prepend(d); while(els.feed.children.length>8) els.feed.lastChild.remove(); }

async function initFirebase(){
  if(!configured) return;
  app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
  onAuthStateChanged(auth, user=>{ if(user) uid=user.uid; });
  await signInAnonymously(auth);
  uid=auth.currentUser.uid;
  connectedUnsub=onValue(ref(db,'.info/connected'), snap=>{
    const on=snap.val()===true; els.netDot.classList.toggle('online',on); els.netText.textContent=on?'在线':'网络断开';
  });
  onValue(ref(db,'.info/serverTimeOffset'), snap=>{ serverOffset=snap.val()||0; });
}

function requireReady(){
  clearError();
  if(!configured){ showError('请先在 firebase-config.js 中填入 Firebase Web 配置。'); return false; }
  if(!uid){ showError('Firebase 正在登录，请再点一次。'); return false; }
  if(!normalizeName()){ showError('先给自己起个昵称 😼'); return false; }
  return true;
}

async function createRoom(){
  if(!requireReady()) return;
  els.createBtn.disabled=true;
  try{
    let code, exists=true;
    while(exists){ code=randomCode(); exists=(await get(ref(db,`rooms/${code}`))).exists(); }
    const name=normalizeName();
    // First claim p1, then write sibling nodes. This matches the granular RTDB rules.
    await set(ref(db,`rooms/${code}/players/p1`),{uid,name,ready:false,online:true,score:0,maxTile:2,board:Array(16).fill(0),lastSeen:serverTimestamp()});
    await set(ref(db,`rooms/${code}/meta`),{createdAt:serverTimestamp()});
    await set(ref(db,`rooms/${code}/game`),{phase:'lobby',roundId:null,durationMs:GAME_MS,startAt:null,result:null});
    await enterRoom(code,'p1');
  }catch(e){ console.error(e); showError('创建失败：'+friendlyFirebaseError(e)); }
  finally{ els.createBtn.disabled=false; }
}

async function joinRoom(){
  if(!requireReady()) return;
  const code=els.roomInput.value.trim().toUpperCase();
  if(code.length<5){ showError('房间码看起来不完整。'); return; }
  els.joinBtn.disabled=true;
  try{
    const roomRef=ref(db,`rooms/${code}`);
    const snap=await get(roomRef);
    if(!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    const data=snap.val();
    if(data.players?.p1?.uid===uid) return enterRoom(code,'p1');
    if(data.players?.p2?.uid===uid) return enterRoom(code,'p2');
    const p2Ref=ref(db,`rooms/${code}/players/p2`);
    const tx=await runTransaction(p2Ref,current=>{
      if(current===null) return {uid,name:normalizeName(),ready:false,online:true,score:0,maxTile:2,board:Array(16).fill(0),lastSeen:serverTimestamp()};
      return;
    });
    if(!tx.committed) throw new Error('ROOM_FULL');
    await enterRoom(code,'p2');
  }catch(e){
    console.error(e);
    if(e.message==='ROOM_NOT_FOUND') showError('没有找到这个房间。');
    else if(e.message==='ROOM_FULL') showError('这个房间已经有两个人啦。');
    else showError('加入失败：'+friendlyFirebaseError(e));
  }finally{ els.joinBtn.disabled=false; }
}

function friendlyFirebaseError(e){
  const c=e?.code||'';
  if(c.includes('auth/operation-not-allowed')) return '请在 Firebase Authentication 开启 Anonymous 登录。';
  if(c.includes('permission-denied')) return 'Realtime Database Rules 尚未配置或没有权限。';
  return e?.message||'未知错误';
}

async function enterRoom(code,slot){
  roomCode=code; mySlot=slot; els.roomCodeText.textContent=code; showScreen('lobbyScreen');
  localStorage.setItem('duopk_nickname',normalizeName());
  history.replaceState(null,'',`?room=${code}`);
  const myRef=ref(db,`rooms/${code}/players/${slot}`);
  await update(myRef,{online:true,lastSeen:serverTimestamp(),name:normalizeName()});
  await onDisconnect(ref(db,`rooms/${code}/players/${slot}/online`)).set(false);
  await onDisconnect(ref(db,`rooms/${code}/players/${slot}/lastSeen`)).set(serverTimestamp());
  if(roomUnsub) roomUnsub(); if(attackUnsub) attackUnsub();
  roomUnsub=onValue(ref(db,`rooms/${code}`), snap=>{
    if(!snap.exists()){ toast('房间已关闭'); return leaveRoom(false); }
    roomData=snap.val(); syncRoomUI();
  });
  attackUnsub=onChildAdded(ref(db,`rooms/${code}/attacks`), snap=>handleAttack(snap.key,snap.val()));
}

function syncRoomUI(){
  if(!roomData) return;
  const p1=roomData.players?.p1, p2=roomData.players?.p2;
  els.p1Name.textContent=p1?.name||'等待...'; els.p2Name.textContent=p2?.name||'等待玩家';
  els.p1State.textContent=!p1?.online?'已离线':p1?.ready?'✓ 已准备':'未准备';
  els.p2State.textContent=!p2?'尚未加入':!p2.online?'已离线':p2.ready?'✓ 已准备':'未准备';
  els.p1State.classList.toggle('ready',!!p1?.ready); els.p2State.classList.toggle('ready',!!p2?.ready);
  els.p1Card.classList.toggle('me',mySlot==='p1'); els.p2Card.classList.toggle('me',mySlot==='p2');
  const mine=player(), op=player(slotOther());
  if(mine) els.readyBtn.textContent=mine.ready?'取消准备':'我准备好了';
  els.readyBtn.disabled=!p2;
  els.lobbyNote.textContent=!p2?'等待朋友输入房间码加入…':'两个人都准备后会自动进入 3 秒倒计时。';

  const g=roomData.game||{};
  if(g.phase==='lobby' && p1?.ready && p2?.ready) attemptStartRound();
  if(g.phase==='countdown' || g.phase==='playing') handleGamePhase(g);
  if(g.phase==='finished') showResult(g);

  if(phase==='playing'){
    els.myScore.textContent=(mine?.score||0).toLocaleString();
    els.opScore.textContent=(op?.score||0).toLocaleString();
    els.myScoreName.textContent=mine?.name||'YOU'; els.opScoreName.textContent=op?.name||'RIVAL';
    renderOpponentBoard(op?.board||[]);
  }
}

async function toggleReady(){
  if(!roomCode||!mySlot) return;
  const mine=player();
  await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:!mine?.ready,online:true});
}

async function attemptStartRound(){
  const gameRef=ref(db,`rooms/${roomCode}/game`);
  await runTransaction(gameRef,g=>{
    if(!g || g.phase!=='lobby') return;
    return {...g,phase:'countdown',roundId:crypto.randomUUID(),startAt:serverNow()+3200,durationMs:GAME_MS,result:null};
  });
}

function handleGamePhase(g){
  if(roundId!==g.roundId){
    roundId=g.roundId; phase='countdown'; initializeBoard(); shieldActive=false; frozenUntil=0; cooldownUntil={freeze:0,garbage:0,shield:0};
    set(ref(db,`rooms/${roomCode}/players/${mySlot}/ready`),false);
    updatePlayerState();
    els.feed.innerHTML=''; showScreen('gameScreen');
    els.gameOverlay.classList.add('show');
    addFeed('⚡ 新回合开始');
  }
  const now=serverNow(), diff=g.startAt-now;
  if(diff>0){
    phase='countdown'; els.gameOverlay.classList.add('show'); els.overlayBig.textContent=Math.max(1,Math.ceil(diff/1000)); els.overlaySmall.textContent='准备开战';
    ensureRenderLoop(); return;
  }
  if(g.phase==='countdown') promoteToPlaying(g);
  if(g.phase==='playing' || diff<=0){
    phase='playing'; els.gameOverlay.classList.remove('show'); ensureRenderLoop();
  }
}

async function promoteToPlaying(g){
  const gameRef=ref(db,`rooms/${roomCode}/game`);
  await runTransaction(gameRef,cur=> cur?.phase==='countdown' ? {...cur,phase:'playing'} : cur);
}

function ensureRenderLoop(){
  if(renderTimer) return;
  renderTimer=setInterval(()=>{
    if(!roomData?.game) return;
    const g=roomData.game; const now=serverNow();
    if(g.startAt){
      const left=Math.max(0,(g.startAt+(g.durationMs||GAME_MS))-now);
      els.timer.textContent=formatTime(left);
      if(phase==='playing' && left<=0) finalizeGame();
    }
    updateCooldownUI();
    if(frozenUntil>now){ els.board.classList.add('frozen'); els.statusText.textContent=`❄️ 冻结 ${(Math.max(0,frozenUntil-now)/1000).toFixed(1)}s`; }
    else { els.board.classList.remove('frozen'); els.statusText.textContent=shieldActive?'🛡️ 护盾已激活':'FIGHT!'; }
  },100);
}
function formatTime(ms){ const s=Math.ceil(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

async function finalizeGame(){
  if(phase==='finished') return; phase='finishing';
  const gameRef=ref(db,`rooms/${roomCode}/game`);
  await runTransaction(gameRef,g=>{
    if(!g || g.phase==='finished') return g;
    const p1=roomData?.players?.p1?.score||0,p2=roomData?.players?.p2?.score||0;
    return {...g,phase:'finished',result:{p1,p2,winner:p1===p2?'draw':p1>p2?'p1':'p2',finishedAt:serverNow()}};
  });
}

function showResult(g){
  phase='finished'; showScreen('resultScreen');
  const r=g.result||{p1:0,p2:0,winner:'draw'}; const mine=r[mySlot]||0, op=r[slotOther()]||0;
  const won=r.winner===mySlot, draw=r.winner==='draw';
  els.resultEmoji.textContent=draw?'🤝':won?'🏆':'💀';
  els.resultTitle.textContent=draw?'DRAW':won?'VICTORY':'DEFEAT';
  els.resultScore.textContent=`${mine.toLocaleString()} : ${op.toLocaleString()}`;
  els.rematchNote.textContent='点击“再来一局”后，等待对方也准备。';
}

async function rematch(){
  await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:true,score:0,maxTile:2,board:Array(16).fill(0)});
  const gameRef=ref(db,`rooms/${roomCode}/game`);
  await runTransaction(gameRef,g=> g?.phase==='finished' ? {...g,phase:'lobby',result:null,startAt:null} : g);
  showScreen('lobbyScreen');
}

async function leaveRoom(goHome=true){
  try{ if(roomCode&&mySlot&&db) await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{online:false,ready:false,lastSeen:serverTimestamp()}); }catch{}
  roomUnsub?.(); attackUnsub?.(); roomUnsub=attackUnsub=null;
  roomCode=null; mySlot=null; roomData=null; roundId=null; phase='idle';
  if(renderTimer){clearInterval(renderTimer);renderTimer=null;} if(endTimer){clearTimeout(endTimer);endTimer=null;}
  history.replaceState(null,'',location.pathname); if(goHome) showScreen('homeScreen'); else showScreen('homeScreen');
}

function initializeBoard(){ board=Array(16).fill(0); score=0; maxTile=2; addRandomTile(); addRandomTile(); renderBoard(); }
function addRandomTile(){ const empty=board.map((v,i)=>v===0?i:-1).filter(i=>i>=0); if(!empty.length) return false; board[empty[Math.floor(Math.random()*empty.length)]]=Math.random()<.9?2:4; return true; }
function addGarbage(){ const ok=addRandomTile(); if(ok){ renderBoard(); updatePlayerState(); } return ok; }
function arraysEqual(a,b){ return a.length===b.length&&a.every((v,i)=>v===b[i]); }

function compressLine(line){
  const vals=line.filter(Boolean); let gained=0; const out=[];
  for(let i=0;i<vals.length;i++){
    if(vals[i]===vals[i+1]){ const n=vals[i]*2; out.push(n); gained+=n; maxTile=Math.max(maxTile,n); i++; }
    else out.push(vals[i]);
  }
  while(out.length<4) out.push(0); return {line:out,gained};
}
function rotate(b){ const n=Array(16).fill(0); for(let r=0;r<4;r++)for(let c=0;c<4;c++)n[c*4+(3-r)]=b[r*4+c]; return n; }
function moveLeft(b){ let out=[],gained=0; for(let r=0;r<4;r++){ const x=compressLine(b.slice(r*4,r*4+4)); out.push(...x.line); gained+=x.gained; } return {board:out,gained}; }
function move(dir){
  if(phase!=='playing'||serverNow()<frozenUntil) return;
  let turns={left:0,up:3,right:2,down:1}[dir]; let b=[...board]; for(let i=0;i<turns;i++) b=rotate(b);
  const res=moveLeft(b); b=res.board; for(let i=0;i<(4-turns)%4;i++) b=rotate(b);
  if(arraysEqual(board,b)) return;
  board=b; score+=res.gained; addRandomTile(); lastMoveAt=Date.now(); renderBoard(true); updatePlayerState();
  if(!canMove()) addFeed('😵 棋盘已满，继续看对手表演');
}
function canMove(){ if(board.includes(0)) return true; for(let r=0;r<4;r++)for(let c=0;c<4;c++){ const i=r*4+c; if(c<3&&board[i]===board[i+1]) return true; if(r<3&&board[i]===board[i+4]) return true; } return false; }
function renderBoard(pop=false){
  els.board.innerHTML=''; board.forEach(v=>{const d=document.createElement('div'); d.className='tile'+(pop?' pop':''); d.dataset.v=String(v); d.textContent=v||''; els.board.appendChild(d);});
  els.myScore.textContent=score.toLocaleString(); els.maxTile.textContent=maxTile;
}
function renderOpponentBoard(b){ els.opBoard.innerHTML=''; const arr=Array.isArray(b)?b:Object.values(b||{}); for(let i=0;i<16;i++){const d=document.createElement('div');d.className='mini'+(arr[i]?' on':'');d.textContent=arr[i]||'';els.opBoard.appendChild(d);} }
async function updatePlayerState(){ if(!roomCode||!mySlot) return; await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{score,maxTile,board,online:true,lastMoveAt:serverTimestamp()}); }

async function useSkill(type){
  if(phase!=='playing') return toast('比赛开始后才能用技能');
  const now=serverNow(); if(cooldownUntil[type]>now) return;
  const op=player(slotOther()); if(!op?.online) return toast('对手不在线');
  if(type==='shield'){
    shieldActive=true; cooldownUntil[type]=now+COOLDOWNS[type]; addFeed('🛡️ 你开启了护盾'); updateCooldownUI(); return;
  }
  cooldownUntil[type]=now+COOLDOWNS[type]; updateCooldownUI();
  await push(ref(db,`rooms/${roomCode}/attacks`),{from:mySlot,to:slotOther(),type,roundId,createdAt:serverTimestamp()});
  addFeed(type==='freeze'?'❄️ 你冻结了对手':'🧱 你给对手塞了垃圾块');
}
function updateCooldownUI(){
  const now=serverNow(); for(const type of Object.keys(COOLDOWNS)){ const el=$(`cd-${type}`); const left=cooldownUntil[type]-now; el.textContent=left>0?`${Math.ceil(left/1000)}s`:'READY'; const btn=document.querySelector(`[data-skill="${type}"]`); btn.disabled=phase!=='playing'||left>0; }
}
function handleAttack(id,a){
  if(!a||a.to!==mySlot||a.roundId!==roundId||phase!=='playing') return;
  const created=typeof a.createdAt==='number'?a.createdAt:0; if(created&&Math.abs(serverNow()-created)>5000) return;
  if(shieldActive){ shieldActive=false; addFeed('🛡️ 护盾抵挡了一次攻击'); toast('护盾挡住了攻击！'); return; }
  if(a.type==='freeze'){ frozenUntil=Math.max(frozenUntil,serverNow()+3000); addFeed('❄️ 对手冻结了你 3 秒'); toast('❄️ 被冻结了！'); }
  if(a.type==='garbage'){ addGarbage(); addFeed('🧱 对手给你塞了一个垃圾块'); toast('🧱 垃圾块来了'); }
}

function bindInput(){
  window.addEventListener('keydown',e=>{ const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}; if(map[e.key]){e.preventDefault();move(map[e.key]);} });
  els.board.addEventListener('touchstart',e=>{const t=e.changedTouches[0];touchStart={x:t.clientX,y:t.clientY};},{passive:true});
  els.board.addEventListener('touchend',e=>{if(!touchStart)return;const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y;touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<28)return;move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));},{passive:true});
}

els.createBtn.addEventListener('click',createRoom); els.joinBtn.addEventListener('click',joinRoom); els.readyBtn.addEventListener('click',toggleReady);
els.leaveBtn.addEventListener('click',()=>leaveRoom(true)); els.resultLeaveBtn.addEventListener('click',()=>leaveRoom(true)); els.rematchBtn.addEventListener('click',rematch);
els.copyRoomBtn.addEventListener('click',async()=>{await navigator.clipboard.writeText(roomCode||'');toast('房间码已复制');});
els.roomInput.addEventListener('input',()=>els.roomInput.value=els.roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
document.querySelectorAll('[data-skill]').forEach(b=>b.addEventListener('click',()=>useSkill(b.dataset.skill)));
bindInput();

const savedName=localStorage.getItem('duopk_nickname'); if(savedName) els.nickname.value=savedName;
initFirebase().then(async()=>{
  const q=new URLSearchParams(location.search), code=q.get('room')?.toUpperCase();
  if(code) els.roomInput.value=code;
}).catch(e=>{console.error(e);els.netText.textContent='Firebase 连接失败';els.netDot.classList.remove('online');showError(friendlyFirebaseError(e));});
