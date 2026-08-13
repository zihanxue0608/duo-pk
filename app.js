import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js';
import {
  getDatabase, ref, set, get, update, onValue, onChildAdded, onDisconnect,
  push, runTransaction, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js';

const $ = id => document.getElementById(id);
const screens = ['homeScreen','lobbyScreen','gameScreen','resultScreen'];
const ids = [
  'nickname','roomInput','createBtn','joinBtn','homeError','setupHint','netDot','netText','roomCodeText','copyRoomBtn',
  'p1Card','p2Card','p1Name','p2Name','p1State','p2State','readyBtn','leaveBtn','lobbyNote','pickerNote',
  'myScoreName','opScoreName','myScore','opScore','timer','statusText','gameModeTitle','gameHint','gameCard','gameStage',
  'board','panel2048','panelReaction','panelTap','panelMemory','panelNumber','gameOverlay','overlayBig','overlaySmall',
  'visionBlock','visionText','reactionPad','reactionIcon','reactionText','reactionSub','reactionResult','tapBox','tapInfo',
  'memoryBox','memoryInfo','numberLeft','numberRight','numberInfo','opBoard','opGeneric','opGenericScore','opGenericStatus','opProgress','feed',
  'resultEmoji','resultTitle','resultScore','resultGame','rematchBtn','resultLeaveBtn','rematchNote'
];
const els = Object.fromEntries(ids.map(id => [id, $(id)]));

const GAMES = {
  '2048': { name:'2048 对战', icon:'🔢', durationMs:90000, hint:'方向键 / 手机滑动 · 合成数字抢分' },
  reaction: { name:'反应力抢点', icon:'🚦', durationMs:42000, hint:'绿灯亮起再点击 · 抢跑扣分' },
  tap: { name:'极速打地鼠', icon:'🐹', durationMs:40000, hint:'点中不断换位的目标 · 越快越高分' },
  memory: { name:'记忆矩阵', icon:'🧠', durationMs:49000, hint:'先记住亮起格子 · 熄灭后点出来' },
  number: { name:'数字快判', icon:'⚖️', durationMs:45000, hint:'快速点击左右两边更大的数字' }
};
const DEFAULT_GAME = '2048';
const COOLDOWNS = { freeze:12000, blind:14000, garbage:12000, shield:16000 };

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('PASTE_');
if (!configured) {
  els.setupHint.style.display = 'block';
  els.netText.textContent = '需要配置 Firebase';
}

let app, auth, db, uid = null;
let roomCode = null, mySlot = null, roomData = null;
let roomUnsub = null, attackUnsub = null, connectedUnsub = null;
let serverOffset = 0;
let phase = 'idle', roundId = null, activeGame = DEFAULT_GAME, renderTimer = null;
let score = 0, board = [], maxTile = 2, touchStart = null;
let frozenUntil = 0, blindUntil = 0, shieldActive = false;
let cooldownUntil = { freeze:0, blind:0, garbage:0, shield:0 };
let finishInFlight = false;

// Mini-game local state
let reactionAnsweredCycle = -1, reactionFeedback = '';
let tapHitCycle = -1;
let memoryCycle = -1, memorySelected = new Set();
let numberAnsweredCycle = -1, numberFeedback = null;

function showScreen(id){ screens.forEach(s => $(s).classList.toggle('active', s===id)); }
function showError(msg){ els.homeError.textContent = msg; els.homeError.classList.add('show'); }
function clearError(){ els.homeError.classList.remove('show'); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1800); }
function normalizeName(){ return els.nickname.value.trim().slice(0,12); }
function randomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
function serverNow(){ return Date.now()+serverOffset; }
function slotOther(){ return mySlot==='p1'?'p2':'p1'; }
function player(slot=mySlot){ return roomData?.players?.[slot] || null; }
function gameDef(id=activeGame){ return GAMES[id] || GAMES[DEFAULT_GAME]; }
function addFeed(text){ const d=document.createElement('div'); d.className='feed-item'; d.textContent=text; els.feed.prepend(d); while(els.feed.children.length>9) els.feed.lastChild.remove(); }
function friendlyFirebaseError(e){
  const c=e?.code||'';
  if(c.includes('auth/operation-not-allowed')) return '请在 Firebase Authentication 开启 Anonymous 登录。';
  if(c.includes('permission-denied')) return 'Realtime Database Rules 没更新或没有权限。';
  return e?.message||'未知错误';
}

async function initFirebase(){
  if(!configured) return;
  app=initializeApp(firebaseConfig); auth=getAuth(app); db=getDatabase(app);
  onAuthStateChanged(auth,user=>{ if(user) uid=user.uid; });
  await signInAnonymously(auth); uid=auth.currentUser.uid;
  connectedUnsub=onValue(ref(db,'.info/connected'),snap=>{
    const online=snap.val()===true; els.netDot.classList.toggle('online',online); els.netText.textContent=online?'在线':'网络断开';
  });
  onValue(ref(db,'.info/serverTimeOffset'),snap=>{ serverOffset=snap.val()||0; });
}

function requireReady(){
  clearError();
  if(!configured){ showError('请先配置 firebase-config.js。'); return false; }
  if(!uid){ showError('Firebase 正在登录，请稍等一下再点。'); return false; }
  if(!normalizeName()){ showError('先给自己起个昵称 😼'); return false; }
  return true;
}

function blankPlayer(name){
  return { uid, name, ready:false, online:true, score:0, maxTile:2, board:Array(16).fill(0), progress:0, status:'等待开局', lastSeen:serverTimestamp() };
}

async function createRoom(){
  if(!requireReady()) return;
  els.createBtn.disabled=true;
  try{
    let code, exists=true;
    while(exists){ code=randomCode(); exists=(await get(ref(db,`rooms/${code}`))).exists(); }
    await set(ref(db,`rooms/${code}/players/p1`),blankPlayer(normalizeName()));
    await set(ref(db,`rooms/${code}/meta`),{createdAt:serverTimestamp()});
    await set(ref(db,`rooms/${code}/game`),{phase:'lobby',selectedGame:DEFAULT_GAME,gameType:DEFAULT_GAME,roundId:null,durationMs:GAMES[DEFAULT_GAME].durationMs,startAt:null,result:null});
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
    const roomRef=ref(db,`rooms/${code}`); const snap=await get(roomRef);
    if(!snap.exists()) throw new Error('ROOM_NOT_FOUND');
    const data=snap.val();
    if(data.players?.p1?.uid===uid) return enterRoom(code,'p1');
    if(data.players?.p2?.uid===uid) return enterRoom(code,'p2');
    const tx=await runTransaction(ref(db,`rooms/${code}/players/p2`),cur=> cur===null ? blankPlayer(normalizeName()) : undefined);
    if(!tx.committed) throw new Error('ROOM_FULL');
    await enterRoom(code,'p2');
  }catch(e){
    console.error(e);
    if(e.message==='ROOM_NOT_FOUND') showError('没有找到这个房间。');
    else if(e.message==='ROOM_FULL') showError('这个房间已经有两个人啦。');
    else showError('加入失败：'+friendlyFirebaseError(e));
  }finally{ els.joinBtn.disabled=false; }
}

async function enterRoom(code,slot){
  roomCode=code; mySlot=slot; els.roomCodeText.textContent=code; showScreen('lobbyScreen');
  localStorage.setItem('duopk_nickname',normalizeName()); history.replaceState(null,'',`?room=${code}`);
  const myRef=ref(db,`rooms/${code}/players/${slot}`);
  await update(myRef,{online:true,lastSeen:serverTimestamp(),name:normalizeName()});
  await onDisconnect(ref(db,`rooms/${code}/players/${slot}/online`)).set(false);
  await onDisconnect(ref(db,`rooms/${code}/players/${slot}/lastSeen`)).set(serverTimestamp());
  roomUnsub?.(); attackUnsub?.();
  roomUnsub=onValue(ref(db,`rooms/${code}`),snap=>{
    if(!snap.exists()){ toast('房间已关闭'); leaveRoom(false); return; }
    roomData=snap.val(); syncRoomUI();
  });
  attackUnsub=onChildAdded(ref(db,`rooms/${code}/attacks`),snap=>handleAttack(snap.val()));
}

function syncRoomUI(){
  if(!roomData) return;
  const p1=roomData.players?.p1, p2=roomData.players?.p2;
  els.p1Name.textContent=p1?.name||'等待...'; els.p2Name.textContent=p2?.name||'等待玩家';
  els.p1State.textContent=!p1?.online?'已离线':p1?.ready?'✓ 已准备':'未准备';
  els.p2State.textContent=!p2?'尚未加入':!p2.online?'已离线':p2.ready?'✓ 已准备':'未准备';
  els.p1State.classList.toggle('ready',!!p1?.ready); els.p2State.classList.toggle('ready',!!p2?.ready);
  els.p1Card.classList.toggle('me',mySlot==='p1'); els.p2Card.classList.toggle('me',mySlot==='p2');

  const g=roomData.game||{}; const selected=g.selectedGame||DEFAULT_GAME;
  renderGamePicker(selected,!!p1?.ready||!!p2?.ready);
  const mine=player(), op=player(slotOther());
  if(mine) els.readyBtn.textContent=mine.ready?'取消准备':'我准备好了';
  els.readyBtn.disabled=!p2;
  els.lobbyNote.textContent=!p2?'等待朋友输入房间码加入…':(p1?.ready&&p2?.ready?'正在同步开局…':`当前：${gameDef(selected).icon} ${gameDef(selected).name} · 双方准备后自动开始`);

  if(g.phase==='lobby' && p1?.ready && p2?.ready) attemptStartRound();
  if(g.phase==='countdown' || g.phase==='playing') handleGamePhase(g);
  if(g.phase==='finished') showResult(g);

  if(phase==='countdown' || phase==='playing' || phase==='starting'){
    els.myScore.textContent=(mine?.score||0).toLocaleString(); els.opScore.textContent=(op?.score||0).toLocaleString();
    els.myScoreName.textContent=mine?.name||'YOU'; els.opScoreName.textContent=op?.name||'RIVAL';
    renderOpponent(op);
  }
}

function renderGamePicker(selected,locked){
  document.querySelectorAll('[data-game]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.game===selected); btn.disabled=locked;
  });
  els.pickerNote.textContent=locked?'有人已准备，取消准备后可切换':'双方都未准备时可以切换';
}

async function selectGame(id){
  if(!GAMES[id]||!roomCode) return;
  const p1=roomData?.players?.p1,p2=roomData?.players?.p2;
  if(p1?.ready||p2?.ready) return toast('先取消准备，再切换游戏');
  await update(ref(db,`rooms/${roomCode}/game`),{selectedGame:id,gameType:id,durationMs:GAMES[id].durationMs});
}

async function toggleReady(){
  if(!roomCode||!mySlot) return;
  const mine=player(); await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:!mine?.ready,online:true});
}

async function attemptStartRound(){
  const gameRef=ref(db,`rooms/${roomCode}/game`);
  await runTransaction(gameRef,g=>{
    if(!g||g.phase!=='lobby') return;
    const type=GAMES[g.selectedGame]?g.selectedGame:DEFAULT_GAME;
    return {...g,phase:'countdown',gameType:type,roundId:`${Date.now()}-${Math.random().toString(36).slice(2)}`,startAt:serverNow()+3200,durationMs:GAMES[type].durationMs,result:null};
  });
}

function handleGamePhase(g){
  if(roundId!==g.roundId){
    roundId=g.roundId; activeGame=GAMES[g.gameType]?g.gameType:DEFAULT_GAME; phase='countdown'; finishInFlight=false;
    resetLocalGame(activeGame); shieldActive=false; frozenUntil=0; blindUntil=0; cooldownUntil={freeze:0,blind:0,garbage:0,shield:0};
    set(ref(db,`rooms/${roomCode}/players/${mySlot}/ready`),false).catch(console.error);
    updatePlayerState({status:'准备中',progress:0}).catch(console.error);
    els.feed.innerHTML=''; renderGameShell(activeGame); showScreen('gameScreen'); els.gameOverlay.classList.add('show'); addFeed(`⚡ ${gameDef().name} 新回合开始`); ensureRenderLoop();
  }
  const diff=(g.startAt||0)-serverNow();
  if(diff>0){ phase='countdown'; els.gameOverlay.classList.add('show'); els.overlayBig.textContent=Math.max(1,Math.ceil(diff/1000)); els.overlaySmall.textContent='准备开战'; ensureRenderLoop(); return; }
  if(g.phase==='countdown') promoteToPlaying();
  if(g.phase==='playing'){ phase='playing'; els.gameOverlay.classList.remove('show'); ensureRenderLoop(); }
}

async function promoteToPlaying(){
  await runTransaction(ref(db,`rooms/${roomCode}/game`),cur=>cur?.phase==='countdown'?{...cur,phase:'playing'}:cur);
}

function ensureRenderLoop(){
  if(renderTimer) return;
  renderTimer=setInterval(()=>{
    const g=roomData?.game; if(!g) return;
    const now=serverNow();
    if(g.phase==='countdown'&&g.startAt){
      const diff=g.startAt-now;
      if(diff>0){ phase='countdown'; els.gameOverlay.classList.add('show'); els.overlayBig.textContent=Math.max(1,Math.ceil(diff/1000)); els.overlaySmall.textContent='准备开战'; }
      else if(phase!=='starting'&&phase!=='playing'){ phase='starting'; els.overlayBig.textContent='GO!'; els.overlaySmall.textContent='开战'; promoteToPlaying().catch(console.error); }
    }else if(g.phase==='playing'){
      phase='playing'; els.gameOverlay.classList.remove('show'); renderCurrentGame(now,g);
    }

    const left=g.phase==='countdown'?(g.durationMs||gameDef(g.gameType).durationMs):Math.max(0,(g.startAt+(g.durationMs||gameDef(g.gameType).durationMs))-now);
    els.timer.textContent=formatTime(left);
    if(g.phase==='playing'&&left<=0) finalizeGame();
    updateEffectsUI(now); updateCooldownUI(now);
  },80);
}

function updateEffectsUI(now){
  const frozen=frozenUntil>now, blinded=blindUntil>now;
  els.gameStage.classList.toggle('frozen-filter',frozen);
  els.visionBlock.classList.toggle('show',blinded);
  if(blinded) els.visionText.textContent=`还有 ${((blindUntil-now)/1000).toFixed(1)} 秒`;
  if(frozen) els.statusText.textContent=`❄️ 冻结 ${((frozenUntil-now)/1000).toFixed(1)}s`;
  else if(blinded) els.statusText.textContent='🌫️ 黑雾干扰中';
  else els.statusText.textContent=shieldActive?'🛡️ 护盾已激活':'FIGHT!';
}
function formatTime(ms){ const s=Math.max(0,Math.ceil(ms/1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function canInteract(){ return phase==='playing'&&serverNow()>=frozenUntil; }

async function finalizeGame(){
  if(finishInFlight||phase==='finished') return; finishInFlight=true;
  try{
    await updatePlayerState({status:'已结束',progress:100});
    const ps=(await get(ref(db,`rooms/${roomCode}/players`))).val()||{};
    const p1=ps.p1?.score||0,p2=ps.p2?.score||0;
    await runTransaction(ref(db,`rooms/${roomCode}/game`),g=>{
      if(!g||g.phase==='finished') return g;
      return {...g,phase:'finished',result:{p1,p2,winner:p1===p2?'draw':p1>p2?'p1':'p2',finishedAt:serverNow()}};
    });
  }catch(e){ console.error(e); finishInFlight=false; }
}

function showResult(g){
  if(phase==='finished'&&document.getElementById('resultScreen').classList.contains('active')) return;
  phase='finished'; showScreen('resultScreen');
  const r=g.result||{p1:0,p2:0,winner:'draw'}, mine=r[mySlot]||0, op=r[slotOther()]||0;
  const won=r.winner===mySlot,draw=r.winner==='draw';
  els.resultEmoji.textContent=draw?'🤝':won?'🏆':'💀'; els.resultTitle.textContent=draw?'DRAW':won?'VICTORY':'DEFEAT';
  els.resultScore.textContent=`${mine.toLocaleString()} : ${op.toLocaleString()}`; els.resultGame.textContent=`${gameDef(g.gameType).icon} ${gameDef(g.gameType).name}`;
  els.rematchNote.textContent='点“再来一局”会直接准备；想换游戏可以回大厅后取消准备再选择。';
}

async function rematch(){
  await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:true,score:0,maxTile:2,board:Array(16).fill(0),progress:0,status:'等待再战'});
  await runTransaction(ref(db,`rooms/${roomCode}/game`),g=>g?.phase==='finished'?{...g,phase:'lobby',result:null,startAt:null,roundId:null}:g);
  showScreen('lobbyScreen');
}

async function leaveRoom(goHome=true){
  try{ if(roomCode&&mySlot&&db) await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{online:false,ready:false,lastSeen:serverTimestamp()}); }catch{}
  roomUnsub?.(); attackUnsub?.(); roomUnsub=attackUnsub=null; roomCode=null; mySlot=null; roomData=null; roundId=null; phase='idle'; activeGame=DEFAULT_GAME;
  if(renderTimer){ clearInterval(renderTimer); renderTimer=null; }
  history.replaceState(null,'',location.pathname); if(goHome) showScreen('homeScreen'); else showScreen('homeScreen');
}

function resetLocalGame(type){
  score=0; maxTile=2; board=Array(16).fill(0); reactionAnsweredCycle=-1; reactionFeedback=''; tapHitCycle=-1; memoryCycle=-1; memorySelected=new Set(); numberAnsweredCycle=-1; numberFeedback=null;
  if(type==='2048'){ addRandomTile(); addRandomTile(); }
}

function renderGameShell(type){
  ['panel2048','panelReaction','panelTap','panelMemory','panelNumber'].forEach(id=>els[id].classList.remove('active'));
  const panelMap={'2048':'panel2048',reaction:'panelReaction',tap:'panelTap',memory:'panelMemory',number:'panelNumber'};
  els[panelMap[type]].classList.add('active');
  const def=gameDef(type); els.gameModeTitle.textContent=`${def.icon} ${def.name}`; els.gameHint.textContent=def.hint;
  els.myScore.textContent='0'; els.opScore.textContent='0'; els.statusText.textContent='FIGHT!';
  els.visionBlock.classList.remove('show'); els.gameStage.classList.remove('frozen-filter');
  if(type==='2048') renderBoard();
  if(type==='tap') buildTapGrid();
  if(type==='memory') buildMemoryGrid();
  if(type==='reaction'){ els.reactionPad.className='reaction-pad'; els.reactionIcon.textContent='🛑'; els.reactionText.textContent='等绿灯'; els.reactionResult.textContent=''; }
  if(type==='number'){ els.numberLeft.className='number-choice'; els.numberRight.className='number-choice'; els.numberInfo.textContent=''; }
}

function renderCurrentGame(now,g){
  if(activeGame==='reaction') renderReaction(now,g);
  else if(activeGame==='tap') renderTap(now,g);
  else if(activeGame==='memory') renderMemory(now,g);
  else if(activeGame==='number') renderNumber(now,g);
}

// ---------- 2048 ----------
function addRandomTile(){ const empty=board.map((v,i)=>v===0?i:-1).filter(i=>i>=0); if(!empty.length) return false; board[empty[Math.floor(Math.random()*empty.length)]]=Math.random()<.9?2:4; return true; }
function addGarbage(){ const ok=addRandomTile(); if(ok){ renderBoard(); updatePlayerState({status:'遭到干扰'}); } return ok; }
function arraysEqual(a,b){ return a.length===b.length&&a.every((v,i)=>v===b[i]); }
function compressLine(line){
  const vals=line.filter(Boolean),out=[]; let gained=0;
  for(let i=0;i<vals.length;i++){ if(vals[i]===vals[i+1]){ const n=vals[i]*2; out.push(n); gained+=n; maxTile=Math.max(maxTile,n); i++; } else out.push(vals[i]); }
  while(out.length<4) out.push(0); return {line:out,gained};
}
function rotate(b){ const n=Array(16).fill(0); for(let r=0;r<4;r++)for(let c=0;c<4;c++)n[c*4+(3-r)]=b[r*4+c]; return n; }
function moveLeft(b){ let out=[],gained=0; for(let r=0;r<4;r++){ const x=compressLine(b.slice(r*4,r*4+4)); out.push(...x.line); gained+=x.gained; } return {board:out,gained}; }
function move(dir){
  if(activeGame!=='2048'||!canInteract()) return;
  const turns={left:0,up:3,right:2,down:1}[dir]; let b=[...board]; for(let i=0;i<turns;i++) b=rotate(b);
  const res=moveLeft(b); b=res.board; for(let i=0;i<(4-turns)%4;i++) b=rotate(b);
  if(arraysEqual(board,b)) return; board=b; score+=res.gained; addRandomTile(); renderBoard(true); updatePlayerState({status:`MAX ${maxTile}`});
}
function renderBoard(pop=false){
  els.board.innerHTML=''; board.forEach(v=>{ const d=document.createElement('div'); d.className='tile'+(pop?' pop':''); d.dataset.v=String(v); d.textContent=v||''; els.board.appendChild(d); });
  els.myScore.textContent=score.toLocaleString();
}

// ---------- deterministic helpers ----------
function hashString(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function random01(key){ let t=hashString(key)+0x6D2B79F5; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function randInt(key,min,max){ return min+Math.floor(random01(key)*(max-min+1)); }
function elapsedFrom(g,now=serverNow()){ return Math.max(0,now-(g.startAt||now)); }

// ---------- Reaction ----------
function reactionInfo(g,now=serverNow()){
  const elapsed=elapsedFrom(g,now), cycle=Math.floor(elapsed/6000), within=elapsed%6000;
  const goAt=1800+randInt(`${roundId}:react:${cycle}`,0,2200);
  return {elapsed,cycle,within,goAt,total:Math.ceil((g.durationMs||42000)/6000)};
}
function renderReaction(now,g){
  const x=reactionInfo(g,now); const answered=reactionAnsweredCycle===x.cycle;
  els.reactionPad.className='reaction-pad';
  if(answered){ els.reactionPad.classList.add('done'); els.reactionIcon.textContent='✅'; els.reactionText.textContent='本轮已完成'; els.reactionSub.textContent='等下一轮信号'; }
  else if(x.within<x.goAt){ els.reactionIcon.textContent='🛑'; els.reactionText.textContent='别点'; els.reactionSub.textContent='等它变绿'; }
  else{ els.reactionPad.classList.add('go'); els.reactionIcon.textContent='⚡'; els.reactionText.textContent='现在点！'; els.reactionSub.textContent='越快分越高'; }
  els.reactionResult.textContent=reactionFeedback;
}
function hitReaction(){
  if(activeGame!=='reaction'||!canInteract()) return;
  const g=roomData?.game;if(!g)return; const x=reactionInfo(g);
  if(reactionAnsweredCycle===x.cycle) return;
  reactionAnsweredCycle=x.cycle;
  if(x.within<x.goAt){ score=Math.max(0,score-120); reactionFeedback='🚫 抢跑 -120'; addFeed('🚫 你抢跑了 -120'); }
  else{ const rt=Math.max(0,Math.round(x.within-x.goAt)); const pts=Math.max(120,1100-rt); score+=pts; reactionFeedback=`⚡ ${rt}ms  +${pts}`; addFeed(`⚡ 反应 ${rt}ms，+${pts}`); }
  els.myScore.textContent=score.toLocaleString(); updatePlayerState({status:`第 ${Math.min(x.cycle+1,x.total)}/${x.total} 轮`,progress:Math.min(100,(x.cycle+1)/x.total*100)});
}

// ---------- Tap ----------
function buildTapGrid(){ els.tapBox.innerHTML=''; for(let i=0;i<9;i++){ const b=document.createElement('button'); b.className='tap-cell'; b.dataset.index=i; b.textContent=''; els.tapBox.appendChild(b); } }
function tapInfoFor(g,now=serverNow()){
  const elapsed=elapsedFrom(g,now), cycle=Math.floor(elapsed/700), within=elapsed%700, target=randInt(`${roundId}:tap:${cycle}`,0,8), total=Math.ceil((g.durationMs||40000)/700);
  return {elapsed,cycle,within,target,total};
}
function renderTap(now,g){
  const x=tapInfoFor(g,now); [...els.tapBox.children].forEach((cell,i)=>{ const active=i===x.target&&tapHitCycle!==x.cycle; cell.classList.toggle('target',active); cell.textContent=active?'🐹':''; });
  els.tapInfo.textContent=tapHitCycle===x.cycle?'✨ 命中！等下一个目标':`目标 ${x.cycle+1}/${x.total} · 快点！`;
}
function hitTap(index){
  if(activeGame!=='tap'||!canInteract()) return; const g=roomData?.game;if(!g)return; const x=tapInfoFor(g);
  if(tapHitCycle===x.cycle) return;
  if(index===x.target){ const pts=70+Math.max(0,Math.floor((700-x.within)/14)); score+=pts; tapHitCycle=x.cycle; addFeed(`🐹 命中 +${pts}`); els.myScore.textContent=score.toLocaleString(); updatePlayerState({status:`命中第 ${x.cycle+1} 个`,progress:Math.min(100,(x.cycle+1)/x.total*100)}); }
  else{ score=Math.max(0,score-8); els.myScore.textContent=score.toLocaleString(); }
}

// ---------- Memory ----------
function buildMemoryGrid(){ els.memoryBox.innerHTML=''; for(let i=0;i<16;i++){ const b=document.createElement('button'); b.className='mem-cell'; b.dataset.index=i; els.memoryBox.appendChild(b); } }
function memoryInfoFor(g,now=serverNow()){
  const elapsed=elapsedFrom(g,now), cycle=Math.floor(elapsed/7000), within=elapsed%7000, count=3+(cycle%3), total=Math.ceil((g.durationMs||49000)/7000);
  return {elapsed,cycle,within,count,total};
}
function memoryTargets(cycle,count){ const out=[]; let step=0; while(out.length<count&&step<50){ const n=randInt(`${roundId}:mem:${cycle}:${step++}`,0,15); if(!out.includes(n))out.push(n); } return out; }
function renderMemory(now,g){
  const x=memoryInfoFor(g,now); if(memoryCycle!==x.cycle){ memoryCycle=x.cycle; memorySelected=new Set(); }
  const targets=memoryTargets(x.cycle,x.count),show=x.within<1800,answer=x.within>=1800&&x.within<6000,result=x.within>=6000;
  [...els.memoryBox.children].forEach((cell,i)=>{
    cell.className='mem-cell';
    if(show&&targets.includes(i)) cell.classList.add('flash');
    if(answer&&memorySelected.has(i)) cell.classList.add('selected');
    if(result&&targets.includes(i)) cell.classList.add('correct');
    if(result&&memorySelected.has(i)&&!targets.includes(i)) cell.classList.add('wrong');
    cell.textContent=result&&targets.includes(i)?'✓':(result&&memorySelected.has(i)&&!targets.includes(i)?'×':'');
  });
  els.memoryInfo.textContent=show?`👀 记住这 ${x.count} 个格子`:answer?'🧠 现在点出刚才亮过的格子':`答案揭晓 · 第 ${x.cycle+1}/${x.total} 轮`;
}
function hitMemory(index){
  if(activeGame!=='memory'||!canInteract()) return; const g=roomData?.game;if(!g)return; const x=memoryInfoFor(g);
  if(x.within<1800||x.within>=6000||memorySelected.has(index)) return;
  const targets=memoryTargets(x.cycle,x.count); memorySelected.add(index);
  if(targets.includes(index)){ score+=55; addFeed('🧠 记忆正确 +55'); } else { score=Math.max(0,score-25); addFeed('🧠 点错 -25'); }
  els.myScore.textContent=score.toLocaleString(); updatePlayerState({status:`记忆第 ${x.cycle+1}/${x.total} 轮`,progress:Math.min(100,(x.cycle+1)/x.total*100)});
}

// ---------- Number ----------
function numberInfoFor(g,now=serverNow()){
  const elapsed=elapsedFrom(g,now), cycle=Math.floor(elapsed/1600), within=elapsed%1600, total=Math.ceil((g.durationMs||45000)/1600);
  let left=randInt(`${roundId}:num:L:${cycle}`,1,99),right=randInt(`${roundId}:num:R:${cycle}`,1,99); if(left===right) right=right===99?98:right+1;
  return {elapsed,cycle,within,total,left,right,answer:left>right?'left':'right'};
}
function renderNumber(now,g){
  const x=numberInfoFor(g,now); els.numberLeft.textContent=x.left; els.numberRight.textContent=x.right;
  els.numberLeft.className='number-choice'; els.numberRight.className='number-choice';
  if(numberAnsweredCycle===x.cycle&&numberFeedback){ els[numberFeedback.choice==='left'?'numberLeft':'numberRight'].classList.add(numberFeedback.correct?'correct':'wrong'); els.numberInfo.textContent=numberFeedback.correct?'✅ 正确 +80':'❌ 错误 -30'; }
  else els.numberInfo.textContent=`第 ${x.cycle+1}/${x.total} 题`;
}
function hitNumber(choice){
  if(activeGame!=='number'||!canInteract()) return; const g=roomData?.game;if(!g)return; const x=numberInfoFor(g);
  if(numberAnsweredCycle===x.cycle) return; numberAnsweredCycle=x.cycle; const correct=choice===x.answer; numberFeedback={choice,correct};
  score=Math.max(0,score+(correct?80:-30)); addFeed(correct?'⚖️ 判断正确 +80':'⚖️ 判断错误 -30'); els.myScore.textContent=score.toLocaleString();
  updatePlayerState({status:`第 ${x.cycle+1}/${x.total} 题`,progress:Math.min(100,(x.cycle+1)/x.total*100)});
}

async function updatePlayerState(extra={}){
  if(!roomCode||!mySlot) return;
  const payload={score,online:true,...extra};
  if(activeGame==='2048'){ payload.maxTile=maxTile; payload.board=board; payload.progress=Math.min(100,Math.log2(Math.max(2,maxTile))/11*100); }
  await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),payload);
}

function renderOpponent(op){
  if(activeGame==='2048'){
    els.opBoard.style.display='grid'; els.opGeneric.classList.remove('show'); const arr=Array.isArray(op?.board)?op.board:Object.values(op?.board||{}); els.opBoard.innerHTML='';
    for(let i=0;i<16;i++){ const d=document.createElement('div'); d.className='mini'+(arr[i]?' on':''); d.textContent=arr[i]||''; els.opBoard.appendChild(d); }
  }else{
    els.opBoard.style.display='none'; els.opGeneric.classList.add('show'); els.opGenericScore.textContent=(op?.score||0).toLocaleString(); els.opGenericStatus.textContent=op?.status||'正在战斗'; els.opProgress.style.width=`${Math.max(0,Math.min(100,op?.progress||0))}%`;
  }
}

async function useSkill(type){
  if(phase!=='playing') return toast('比赛开始后才能用技能');
  const now=serverNow(); if(cooldownUntil[type]>now) return;
  const op=player(slotOther()); if(!op?.online) return toast('对手不在线');
  if(type==='shield'){ shieldActive=true; cooldownUntil[type]=now+COOLDOWNS[type]; addFeed('🛡️ 你开启了护盾'); updateCooldownUI(now); return; }
  cooldownUntil[type]=now+COOLDOWNS[type]; updateCooldownUI(now);
  await push(ref(db,`rooms/${roomCode}/attacks`),{from:mySlot,to:slotOther(),type,roundId,createdAt:serverTimestamp()});
  const text={freeze:'❄️ 你冻结了对手',blind:'🌫️ 你放出黑雾遮挡对手',garbage:activeGame==='2048'?'🧱 你给对手塞了垃圾块':'🧱 你让对手掉了 50 分'}[type]; addFeed(text);
}

function updateCooldownUI(now=serverNow()){
  for(const type of Object.keys(COOLDOWNS)){
    const el=$(`cd-${type}`),left=cooldownUntil[type]-now; el.textContent=left>0?`${Math.ceil(left/1000)}s`:'READY';
    const btn=document.querySelector(`[data-skill="${type}"]`); btn.disabled=phase!=='playing'||left>0;
  }
}

function handleAttack(a){
  if(!a||a.to!==mySlot||a.roundId!==roundId||phase!=='playing') return;
  const created=typeof a.createdAt==='number'?a.createdAt:0; if(created&&Math.abs(serverNow()-created)>6000) return;
  if(shieldActive){ shieldActive=false; addFeed('🛡️ 护盾抵挡了一次攻击'); toast('护盾挡住了攻击！'); return; }
  if(a.type==='freeze'){ frozenUntil=Math.max(frozenUntil,serverNow()+3000); addFeed('❄️ 对手冻结了你 3 秒'); toast('❄️ 被冻结了！'); }
  if(a.type==='blind'){ blindUntil=Math.max(blindUntil,serverNow()+3500); addFeed('🌫️ 对手遮住了你的视野'); toast('🌫️ 黑雾来了！'); }
  if(a.type==='garbage'){
    if(activeGame==='2048'){ addGarbage(); addFeed('🧱 对手给你塞了一个垃圾块'); toast('🧱 垃圾块来了'); }
    else{ score=Math.max(0,score-50); els.myScore.textContent=score.toLocaleString(); updatePlayerState({status:'受到干扰 -50'}); addFeed('🧱 对手干扰你 -50'); toast('🧱 -50 分'); }
  }
}

function bindInputs(){
  window.addEventListener('keydown',e=>{ const map={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}; if(map[e.key]){ e.preventDefault(); move(map[e.key]); } });
  els.board.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; touchStart={x:t.clientX,y:t.clientY}; },{passive:true});
  els.board.addEventListener('touchend',e=>{ if(!touchStart)return; const t=e.changedTouches[0],dx=t.clientX-touchStart.x,dy=t.clientY-touchStart.y; touchStart=null; if(Math.max(Math.abs(dx),Math.abs(dy))<28)return; move(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up')); },{passive:true});
  els.reactionPad.addEventListener('click',hitReaction);
  els.tapBox.addEventListener('click',e=>{ const cell=e.target.closest('.tap-cell'); if(cell) hitTap(Number(cell.dataset.index)); });
  els.memoryBox.addEventListener('click',e=>{ const cell=e.target.closest('.mem-cell'); if(cell) hitMemory(Number(cell.dataset.index)); });
  els.numberLeft.addEventListener('click',()=>hitNumber('left')); els.numberRight.addEventListener('click',()=>hitNumber('right'));
}

els.createBtn.addEventListener('click',createRoom); els.joinBtn.addEventListener('click',joinRoom); els.readyBtn.addEventListener('click',toggleReady);
els.leaveBtn.addEventListener('click',()=>leaveRoom(true)); els.resultLeaveBtn.addEventListener('click',()=>leaveRoom(true)); els.rematchBtn.addEventListener('click',rematch);
els.copyRoomBtn.addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(roomCode||''); toast('房间码已复制'); }catch{ toast(`房间码：${roomCode}`); } });
els.roomInput.addEventListener('input',()=>els.roomInput.value=els.roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
document.querySelectorAll('[data-skill]').forEach(b=>b.addEventListener('click',()=>useSkill(b.dataset.skill)));
document.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>selectGame(b.dataset.game)));
bindInputs();

const savedName=localStorage.getItem('duopk_nickname'); if(savedName) els.nickname.value=savedName;
initFirebase().then(()=>{ const q=new URLSearchParams(location.search),code=q.get('room')?.toUpperCase(); if(code) els.roomInput.value=code; }).catch(e=>{ console.error(e); els.netText.textContent='Firebase 连接失败'; els.netDot.classList.remove('online'); showError(friendlyFirebaseError(e)); });
