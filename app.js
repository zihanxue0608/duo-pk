// V3.3 UX refresh: keep the UI bootable even if a Firebase module/config fails to load.
// The Firebase web config is intentionally client-side configuration; database access
// is still protected by Firebase Authentication + Realtime Database Rules.
const firebaseConfig = {
  apiKey: "AIzaSyCsJ1Pqb5ZL1prB785WN6BgyHPKUKNAIpw",
  authDomain: "duo-pk.firebaseapp.com",
  databaseURL: "https://duo-pk-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "duo-pk",
  storageBucket: "duo-pk.firebasestorage.app",
  messagingSenderId: "435279015745",
  appId: "1:435279015745:web:4995993dd5635db7673bc0"
};

let initializeApp, getAuth, signInAnonymously, onAuthStateChanged;
let getDatabase, ref, set, get, update, onValue, onChildAdded, onDisconnect;
let push, runTransaction, serverTimestamp, remove;

async function loadFirebaseSdk(){
  const [appMod, authMod, dbMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js')
  ]);
  ({ initializeApp } = appMod);
  ({ getAuth, signInAnonymously, onAuthStateChanged } = authMod);
  ({ getDatabase, ref, set, get, update, onValue, onChildAdded, onDisconnect,
     push, runTransaction, serverTimestamp, remove } = dbMod);
}

const $ = id => document.getElementById(id);
const screens = ['homeScreen','soloLobbyScreen','lobbyScreen','gameScreen','soloResultScreen','seriesResultScreen'];
const DIFFS = {
  easy:{name:'简单',factor:.82}, medium:{name:'中等',factor:1}, hard:{name:'难',factor:1.18}, hell:{name:'地狱',factor:1.38}
};
const SKILL_DEFS = {
  freeze:{icon:'❄️',name:'冻结',desc:'短暂锁住对手操作'},
  blind:{icon:'🌫️',name:'黑雾',desc:'遮住对手视野'},
  garbage:{icon:'🧱',name:'干扰块',desc:'2048 塞一个 2；俄罗斯方块追加垃圾行'},
  fake:{icon:'🟢',name:'假信号',desc:'制造一次诱导信号'},
  shuffle:{icon:'🔀',name:'洗牌',desc:'打乱对手当前格子'},
  jam:{icon:'📡',name:'干扰',desc:'短暂干扰射击 / 操作'},
  rush:{icon:'👾',name:'敌袭',desc:'让对手刷出更多敌人'},
  obstacle:{icon:'🪨',name:'路障',desc:'给跑酷增加额外障碍'},
  speed:{icon:'⏩',name:'加速',desc:'让对手节奏突然变快'},
  slip:{icon:'🧼',name:'手滑',desc:'让对手拔河进度后退'},
  shield:{icon:'🛡️',name:'护盾',desc:'抵挡下一次技能'}
};
const GAMES = {
  reaction:{name:'反应力抢点',icon:'⚡',category:'reaction',desc:'等真正信号出现再点；越快分越高，抢跑扣分。',skills:[['fake',550],['blind',1000],['shield',800]]},
  number:{name:'数字快判',icon:'⚖️',category:'brain',desc:'左右两个数字，迅速选更大的一个。',skills:[['blind',500],['freeze',950],['shield',750]]},
  schulte:{name:'经典舒尔特',icon:'🔢',category:'brain',desc:'标准 5×5、1–25 固定随机排列，按 1 → 25 顺序寻找。',skills:[['blind',900],['shield',1200]]},
  schulteDynamic:{name:'转盘动态舒尔特',icon:'🌀',category:'brain',desc:'1–25 分布在多层同心转盘；每层独立旋转，数字固定在自己的环上。',skills:[['freeze',900],['speed',1450],['shield',1100]]},
  color:{name:'色词干扰',icon:'🎨',category:'brain',desc:'上方给出目标颜色汉字；下方选择“字体颜色”匹配目标的色词。',skills:[['blind',550],['speed',1000],['shield',800]]},
  falling:{name:'掉落射击',icon:'🎯',category:'reaction',desc:'追踪并点击掉落目标；避开炸弹，节奏连续不卡顿。',skills:[['jam',650],['rush',1200],['shield',950]]},
  memory:{name:'记忆矩阵',icon:'🧠',category:'brain',desc:'同时记住多个亮格；答题时间更充足，点对加分、点错扣分。',skills:[['blind',900],['shield',750]]},
  memorySequence:{name:'动态记忆矩阵',icon:'✨',category:'brain',desc:'格子一个一个亮起，记住整段序列后复原所有出现过的位置。',skills:[['blind',800],['freeze',1300],['shield',1000]]},
  tracking:{name:'多目标追踪',icon:'🔵',category:'brain',desc:'先记住目标小球，随后所有小球随机运动；停止后找回原目标。',skills:[['speed',800],['blind',1350],['shield',1000]]},
  '2048':{name:'2048 对战',icon:'🔢',category:'brain',desc:'经典合成抢分；干扰只会给对手塞一个普通的 2。',skills:[['garbage',500],['blind',1100],['freeze',1800],['shield',900]]},
  tetris:{name:'俄罗斯方块',icon:'🧱',category:'arcade',desc:'消行抢分；高难度下降更快，还会长垃圾行。',skills:[['garbage',500],['speed',1050],['shield',800]]},
  runner:{name:'渐速恐龙跑酷',icon:'🦖',category:'arcade',desc:'速度会随存活时间持续提高，越到后面越难。',skills:[['obstacle',500],['blind',1000],['shield',750]]},
  plane:{name:'飞机大战',icon:'✈️',category:'arcade',desc:'移动飞机自动射击，击落敌机抢分。',skills:[['jam',550],['rush',1100],['shield',850]]},
  tug:{name:'极速拔河',icon:'🪢',category:'reaction',desc:'疯狂点击或按空格，把绳结拉向自己。',skills:[['slip',450],['freeze',850],['shield',650]]},
  tugRhythm:{name:'节奏拔河',icon:'🎵',category:'reaction',desc:'光标进入高分区时点击；越准拉力越大，乱点反而后退。',skills:[['slip',500],['speed',1000],['shield',800]]},
  duelShooter:{name:'上下射击对战',icon:'🔫',category:'board',desc:'双方在两侧上下移动并射击；子弹命中对手即得分。',skills:[['jam',500],['shield',900]]},
  stackTower:{name:'双人叠积木',icon:'🧊',category:'board',desc:'共用一座塔轮流落块；没有搭住的一方立即输掉本局。',skills:[]},
  needle:{name:'见缝插针',icon:'📍',category:'board',desc:'两人共用旋转圆盘轮流插针；不限时，撞针者立即出局。',skills:[]},
  gomoku:{name:'五子棋',icon:'⚫',category:'board',desc:'不限时直到五子连珠；纯竞技，不使用技能。',skills:[]},
  airstrike:{name:'坐标打飞机',icon:'🛩️',category:'board',desc:'先用 15 秒布置自己的飞机，再轮流轰炸；命中只显示命中，不暴露中心。',skills:[]}
};
const GAME_IDS = Object.keys(GAMES);
const SOLO_GAME_IDS = ['reaction','number','schulte','schulteDynamic','color','falling','memory','memorySequence','tracking','2048','tetris','runner','plane','tug','tugRhythm'];
const DEFAULT_SETTINGS = {mode:'same',rounds:5,difficulty:'medium',durationSec:45,sameGame:'reaction',randomPool:['reaction','number','schulteDynamic','color','falling','memorySequence','tracking','runner','tugRhythm']};

const els = Object.fromEntries([
  'nickname','roomInput','createBtn','joinBtn','soloBtn','homeError','continueCard','continueTitle','continueSub','continueBtn','netDot','netText',
  'soloBackHomeBtn','soloDifficultySeg','soloDurationRange','soloDurationLabel','soloDurationBox','soloGameGrid','soloFilterBar','soloSelectedText','soloBestText','soloStartBtn',
  'roomCodeText','roomHint','copyRoomBtn','historyBtn','leaveBtn','p1Card','p2Card','p1Name','p2Name','p1State','p2State',
  'modeSeg','roundSeg','difficultySeg','difficultyHint','durationRange','durationLabel','durationBox','seriesPreviewTitle','seriesPreviewSub',
  'readyBtn','cancelSeriesBtn','lobbyNote','gameGrid','pickerNote','filterBar','settingOwner',
  'myScoreName','opScoreName','myScore','opScore','timer','roundLabel','roundDots','gameModeTitle','gameHint','difficultyBadge','gameExitBtn','gameStage','gameSurface',
  'effectLayer','effectMsg','gameOverlay','overlayBig','overlaySmall','skills','opGenericScore','opGenericStatus','opProgress','feed',
  'historyDrawer','historyTitle','historyList','closeHistoryBtn','roundResult','roundEmoji','roundResultTitle','roundResultScore','nextGameText',
  'soloResultEmoji','soloResultTitle','soloResultScore','soloResultMeta','soloResultBest','soloReplayBtn','soloSettingsBtn','soloResultHomeBtn',
  'seriesEmoji','seriesTitle','seriesFinal','seriesCaption','roundHistory','backLobbyBtn','resultHistoryBtn','resultLeaveBtn',
  'exitModal','exitContext','resumeGameBtn','forfeitRoundBtn','endSeriesBtn','leaveRoomNowBtn'
].map(id=>[id,$(id)]));

let app,auth,db,uid=null,serverOffset=0,firebaseReady=false;
let roomCode=null,mySlot=null,roomData=null,roomUnsub=null,attackUnsub=null,connectedUnsub=null;
let deviceId=localStorage.getItem('duopk_device') || crypto.randomUUID(); localStorage.setItem('duopk_device',deviceId);
let renderTimer=null,roundId=null,activeGame='reaction',localPhase='idle',roundMounted=false;
let score=0,progress=0,status='等待开局',syncTimer=null,lastSyncAt=0,finishBusy=false,advanceBusy=false,historyBusy=false;
let gameState={},usedSkills=new Set(),shieldActive=false;
let effects={freezeUntil:0,blindUntil:0,jamUntil:0,rushUntil:0,speedUntil:0,obstacleUntil:0,fakeUntil:0};
let activeFilter='all',lastFrameAt=performance.now(),advanceTimeout=null;
let soloMode=false,soloFilter='all',soloSettings={difficulty:'medium',durationSec:45,game:'reaction'},soloSession=null,soloFinishing=false;

function showScreen(id){ screens.forEach(s=>$(s).classList.toggle('active',s===id)); }
function normalizeName(v=els.nickname.value){ return v.trim().replace(/[.#$\[\]/]/g,'').slice(0,12); }
function keyName(v){ return normalizeName(v).trim().toLowerCase().replace(/\s+/g,'_') || 'player'; }
function pairKey(){ const a=keyName(roomData?.players?.p1?.name||'p1'),b=keyName(roomData?.players?.p2?.name||'p2'); return [a,b].sort().join('__'); }
function serverNow(){ return Date.now()+serverOffset; }
function otherSlot(){ return mySlot==='p1'?'p2':'p1'; }
function me(){ if(soloMode)return {name:normalizeName()||localStorage.getItem('duopk_nickname')||'PLAYER',online:true}; return roomData?.players?.[mySlot]||null; }
function opponent(){ if(soloMode)return null; return roomData?.players?.[otherSlot()]||null; }
function settings(){ if(soloMode)return {...DEFAULT_SETTINGS,mode:'same',rounds:1,sameGame:soloSettings.game,difficulty:soloSettings.difficulty,durationSec:soloSettings.durationSec}; return {...DEFAULT_SETTINGS,...(roomData?.settings||{})}; }
function series(){ if(soloMode)return soloSession||{status:'lobby',roundIndex:0,totalRounds:1,difficulty:soloSettings.difficulty,durationSec:soloSettings.durationSec}; return roomData?.series||{status:'lobby'}; }
function isUntimedGame(id){ return ['needle','gomoku','stackTower'].includes(id); }
function roundDurationMs(id,durationSec){ return isUntimedGame(id)?0:(Number(durationSec||45)*1000 + (id==='airstrike'?15000:0)); }
function currentRoundTimeLeft(sr,now=serverNow()){
  if(isUntimedGame(activeGame))return Infinity;
  return Math.max(0,Number(sr.endAt||now)-now);
}
function randomCode(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:5},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
function friendlyError(e){ const c=e?.code||''; if(c.includes('permission-denied'))return 'Firebase Realtime Database Rules 需要更新到项目附带的最新版。'; if(c.includes('auth/operation-not-allowed'))return '请开启 Firebase Anonymous 登录。'; return e?.message||'未知错误'; }
function showError(t){ els.homeError.textContent=t;els.homeError.classList.add('show'); }
function clearError(){ els.homeError.classList.remove('show'); }
function addFeed(t){ const d=document.createElement('div');d.className='feed-item';d.textContent=t;els.feed.prepend(d);while(els.feed.children.length>10)els.feed.lastChild.remove(); }
function withTimeout(p,ms=8000,msg='网络请求超时'){ return Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg)),ms))]); }
function formatTime(ms){ const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function hashString(str){ let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0; }
function random01(key){ let t=hashString(key)+0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296; }
function randInt(key,min,max){ return min+Math.floor(random01(key)*(max-min+1)); }
function shuffleDet(arr,key){ return [...arr].map((v,i)=>({v,r:random01(`${key}:${i}`)})).sort((a,b)=>a.r-b.r).map(x=>x.v); }

async function initFirebase(){
  els.netText.textContent='加载 Firebase…';
  els.createBtn.disabled=true; els.joinBtn.disabled=true;
  await loadFirebaseSdk();
  els.netText.textContent='正在登录…';
  app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);
  onAuthStateChanged(auth,u=>{if(u)uid=u.uid;});
  await withTimeout(signInAnonymously(auth),10000,'Firebase 匿名登录超时');
  if(!auth.currentUser) throw new Error('Firebase 匿名登录没有返回用户');
  uid=auth.currentUser.uid;
  firebaseReady=true;
  els.createBtn.disabled=false; els.joinBtn.disabled=false;
  connectedUnsub=onValue(ref(db,'.info/connected'),s=>{
    const on=s.val()===true;
    els.netDot.classList.toggle('online',on);
    els.netText.textContent=on?'在线':'网络连接中…';
  },e=>{
    console.error('connected listener',e);
    els.netText.textContent='连接状态异常';
  });
  onValue(ref(db,'.info/serverTimeOffset'),s=>serverOffset=s.val()||0);
  renderContinueCard();
}
function blankPlayer(name){ return {uid,deviceId,name,online:true,ready:false,score:0,progress:0,status:'在大厅',lastSeen:serverTimestamp()}; }
function saveRecentRoom(){ if(roomCode){localStorage.setItem('duopk_lastRoom',roomCode);localStorage.setItem('duopk_nickname',normalizeName());renderContinueCard();} }
function renderContinueCard(){ const code=localStorage.getItem('duopk_lastRoom'),name=localStorage.getItem('duopk_nickname');if(code&&name){els.continueCard.classList.add('show');els.continueTitle.textContent=`继续房间 ${code}`;els.continueSub.textContent=`以 ${name} 的昵称重新连接`; }else els.continueCard.classList.remove('show'); }
function requireIdentity(){clearError();if(!firebaseReady||!db||!uid){showError('Firebase 还没有连接完成，请看右上角状态；如果一直不变，请强制刷新页面。');return false;}if(!normalizeName()){showError('先输入昵称。');return false;}return true;}


const SOLO_BEST_KEY='duopk_solo_best_v1';
function getSoloBest(game=soloSettings.game,diff=soloSettings.difficulty,duration=soloSettings.durationSec){
  try{const d=JSON.parse(localStorage.getItem(SOLO_BEST_KEY)||'{}');return Number(d?.[game]?.[diff]?.[String(duration)]?.score||0);}catch{return 0;}
}
function saveSoloBest(game,diff,duration,newScore){
  let d={};try{d=JSON.parse(localStorage.getItem(SOLO_BEST_KEY)||'{}')||{};}catch{}
  d[game]??={};d[game][diff]??={};const k=String(duration),old=Number(d[game][diff]?.[k]?.score||0),best=Math.max(old,Number(newScore||0));
  d[game][diff][k]={score:best,updatedAt:Date.now()};localStorage.setItem(SOLO_BEST_KEY,JSON.stringify(d));return {old,best,isNew:best>old};
}
function openSoloLobby(){
  soloMode=true;stopRenderLoop();soloSession=null;roundId=null;localPhase='idle';roundMounted=false;
  document.getElementById('gameScreen')?.classList.remove('solo-playing');
  showScreen('soloLobbyScreen');renderSoloSettings();renderSoloGameLibrary();
}
function leaveSoloToHome(){
  soloMode=false;soloSession=null;roundId=null;localPhase='idle';roundMounted=false;stopRenderLoop();closeExitModal();
  document.getElementById('gameScreen')?.classList.remove('solo-playing');showScreen('homeScreen');
}
function renderSoloSettings(){
  document.querySelectorAll('[data-solo-diff]').forEach(b=>b.classList.toggle('active',b.dataset.soloDiff===soloSettings.difficulty));
  if(els.soloDurationRange){els.soloDurationRange.value=soloSettings.durationSec;els.soloDurationLabel.textContent=`${soloSettings.durationSec} 秒`;els.soloDurationBox.textContent=`${soloSettings.durationSec}s`;}
  const g=GAMES[soloSettings.game];if(els.soloSelectedText)els.soloSelectedText.textContent=`已选：${g.icon} ${g.name}`;
  if(els.soloBestText)els.soloBestText.textContent=`当前难度最佳：${getSoloBest().toLocaleString()} 分`;
}
function renderSoloGameLibrary(){
  if(!els.soloGameGrid)return;els.soloGameGrid.innerHTML='';
  for(const id of SOLO_GAME_IDS){const g=GAMES[id];if(soloFilter!=='all'&&g.category!==soloFilter)continue;const b=document.createElement('button');b.className='game-option'+(soloSettings.game===id?' selected':'');b.dataset.game=id;b.style.setProperty('--accent',g.category==='brain'?'rgba(168,139,255,.18)':g.category==='reaction'?'rgba(87,231,255,.18)':'rgba(255,122,200,.15)');b.innerHTML=`<div class="game-ico">${g.icon}</div><b>${g.name}</b><small>${g.desc}</small><div class="game-meta"><span class="pill">${({brain:'脑力',reaction:'反应',arcade:'街机'})[g.category]||'训练'}</span><span class="pill">单人可玩</span></div>`;b.addEventListener('click',()=>{soloSettings.game=id;renderSoloSettings();renderSoloGameLibrary();});els.soloGameGrid.appendChild(b);}
}
function startSoloTraining(){
  const nm=normalizeName();if(nm)localStorage.setItem('duopk_nickname',nm);
  const game=soloSettings.game;if(!SOLO_GAME_IDS.includes(game))return;soloMode=true;soloFinishing=false;activeGame=game;roundId=`solo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;const startAt=serverNow()+2200,endAt=startAt+Number(soloSettings.durationSec)*1000;soloSession={status:'round',seriesId:roundId,roundId,roundIndex:0,totalRounds:1,playlist:[game],wins:{p1:0,p2:0},roundResults:[],difficulty:soloSettings.difficulty,durationSec:Number(soloSettings.durationSec),startAt,endAt};
  resetLocalRound(game);showScreen('gameScreen');document.getElementById('gameScreen')?.classList.add('solo-playing');els.roundResult.classList.remove('show');els.opScoreName.textContent='PERSONAL BEST';els.opScore.textContent=getSoloBest(game,soloSettings.difficulty).toLocaleString();mountGame(game);startRenderLoop();
}
function finishSoloTraining(){
  if(!soloMode||soloFinishing||soloSession?.status!=='round')return;soloFinishing=true;soloSession={...soloSession,status:'result',finishedAt:serverNow()};stopRenderLoop();localPhase='result';const rec=saveSoloBest(activeGame,soloSettings.difficulty,soloSettings.durationSec,score);const g=GAMES[activeGame];els.soloResultEmoji.textContent=rec.isNew?'🏆':'✨';els.soloResultTitle.textContent=rec.isNew?'NEW BEST':'训练完成';els.soloResultScore.textContent=score.toLocaleString();els.soloResultMeta.textContent=`${g.icon} ${g.name} · ${DIFFS[soloSettings.difficulty].name} · ${soloSettings.durationSec} 秒`;els.soloResultBest.textContent=rec.isNew?`新纪录！之前 ${rec.old.toLocaleString()} 分`:`个人最佳 ${rec.best.toLocaleString()} 分`;document.getElementById('gameScreen')?.classList.remove('solo-playing');showScreen('soloResultScreen');soloFinishing=false;
}

async function createRoom(){
  if(!requireIdentity())return;els.createBtn.disabled=true;els.createBtn.textContent='正在创建…';
  try{
    let code;for(let i=0;i<8;i++){code=randomCode();const s=await withTimeout(get(ref(db,`rooms/${code}/meta`)));if(!s.exists())break;}
    await withTimeout(set(ref(db,`rooms/${code}/meta`),{ownerUid:uid,createdAt:serverTimestamp(),persistent:true}));
    await set(ref(db,`rooms/${code}/players/p1`),blankPlayer(normalizeName()));
    await set(ref(db,`rooms/${code}/settings`),DEFAULT_SETTINGS);
    await set(ref(db,`rooms/${code}/series`),{status:'lobby',seriesId:null,roundIndex:0,totalRounds:0,wins:{p1:0,p2:0},roundResults:[]});
    await enterRoom(code,'p1');
  }catch(e){console.error(e);showError(`创建失败：${friendlyError(e)}`);}finally{els.createBtn.disabled=false;els.createBtn.textContent='创建长期房间';}
}
async function claimSlot(code,slot,name){
  const pRef=ref(db,`rooms/${code}/players/${slot}`);
  const tx=await withTimeout(runTransaction(pRef,cur=>{
    if(cur===null)return blankPlayer(name);
    const sameUid=cur.uid===uid,sameDevice=cur.deviceId===deviceId,sameName=keyName(cur.name)===keyName(name);
    if(sameUid||sameDevice||sameName) return {...cur,...blankPlayer(name),ready:false};
    return;
  }),9000,'加入房间超时');
  return tx.committed;
}
async function joinRoom(forceCode=null){
  if(!requireIdentity())return;const code=(forceCode||els.roomInput.value).trim().toUpperCase();if(code.length!==5){showError('请输入 5 位房间码。');return;}
  els.joinBtn.disabled=true;els.joinBtn.textContent='正在连接…';
  try{
    const snap=await withTimeout(get(ref(db,`rooms/${code}`)),7000,'读取房间超时');if(!snap.exists())throw new Error('房间不存在');const d=snap.val();const name=normalizeName();
    let slot=null;
    for(const s of ['p1','p2']){const p=d.players?.[s];if(p&&(p.uid===uid||p.deviceId===deviceId||keyName(p.name)===keyName(name))){if(await claimSlot(code,s,name)){slot=s;break;}}}
    if(!slot&&!d.players?.p2){if(await claimSlot(code,'p2',name))slot='p2';}
    if(!slot)throw new Error('房间已有固定的两位玩家；如果这是你原来的房间，请使用原昵称重新进入。');
    await enterRoom(code,slot);
  }catch(e){console.error(e);showError(`加入失败：${friendlyError(e)}`);}finally{els.joinBtn.disabled=false;els.joinBtn.textContent='加入 / 回到房间';}
}
async function enterRoom(code,slot){
  roomCode=code;mySlot=slot;saveRecentRoom();els.roomCodeText.textContent=code;history.replaceState(null,'',`?room=${code}`);showScreen('lobbyScreen');
  const myRef=ref(db,`rooms/${code}/players/${slot}`);await update(myRef,{uid,deviceId,name:normalizeName(),online:true,lastSeen:serverTimestamp()});
  await onDisconnect(ref(db,`rooms/${code}/players/${slot}/online`)).set(false);await onDisconnect(ref(db,`rooms/${code}/players/${slot}/lastSeen`)).set(serverTimestamp());
  const migration=(await get(ref(db,`rooms/${code}`))).val()||{};if(!migration.settings)await set(ref(db,`rooms/${code}/settings`),DEFAULT_SETTINGS);if(!migration.series)await set(ref(db,`rooms/${code}/series`),{status:'lobby',seriesId:null,roundIndex:0,totalRounds:0,wins:{p1:0,p2:0},roundResults:[]});
  roomUnsub?.();attackUnsub?.();
  roomUnsub=onValue(ref(db,`rooms/${code}`),s=>{if(!s.exists()){leaveRoom(true);return;}roomData=s.val();syncRoom();});
  attackUnsub=onChildAdded(ref(db,`rooms/${code}/attacks`),s=>handleAttack(s.val()));
}
async function leaveRoom(goHome=true){
  try{if(roomCode&&mySlot)await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{online:false,ready:false,lastSeen:serverTimestamp()});}catch{}
  roomUnsub?.();attackUnsub?.();roomUnsub=attackUnsub=null;stopRenderLoop();roomData=null;roomCode=null;mySlot=null;roundId=null;localPhase='idle';roundMounted=false;
  history.replaceState(null,'',location.pathname);if(goHome)showScreen('homeScreen');
}

function normalizePool(v){ if(Array.isArray(v))return v.filter(x=>GAMES[x]); if(v&&typeof v==='object')return Object.values(v).filter(x=>GAMES[x]); return [...DEFAULT_SETTINGS.randomPool]; }
function renderGameLibrary(){
  const s=settings(),pool=normalizePool(s.randomPool);els.gameGrid.innerHTML='';
  for(const [id,g] of Object.entries(GAMES)){
    if(activeFilter!=='all'&&g.category!==activeFilter)continue;
    const b=document.createElement('button');b.className='game-option';b.dataset.game=id;b.style.setProperty('--accent',g.category==='brain'?'rgba(168,139,255,.18)':g.category==='reaction'?'rgba(87,231,255,.18)':g.category==='arcade'?'rgba(255,122,200,.15)':'rgba(255,209,106,.16)');
    if(s.mode==='same'&&s.sameGame===id)b.classList.add('selected');if(s.mode==='random'&&pool.includes(id))b.classList.add('pool','selected');
    b.innerHTML=`<div class="game-ico">${g.icon}</div><b>${g.name}</b><small>${g.desc}</small><div class="game-meta"><span class="pill">${({brain:'脑力',reaction:'反应',arcade:'街机',board:'对战'})[g.category]}</span><span class="pill">${g.skills.length?`${g.skills.length} 技能`:'纯竞技'}</span></div>`;
    b.addEventListener('click',()=>pickGame(id));els.gameGrid.appendChild(b);
  }
}
function syncRoom(){
  if(!roomData)return;const p1=roomData.players?.p1,p2=roomData.players?.p2,s=settings(),sr=series();
  els.p1Name.textContent=p1?.name||'等待…';els.p2Name.textContent=p2?.name||'等待玩家';
  els.p1State.textContent=!p1?.online?'离线 · 可用原昵称回来':p1?.ready?'✓ 已准备':'未准备';els.p2State.textContent=!p2?'尚未加入':!p2.online?'离线 · 等待回来':p2.ready?'✓ 已准备':'未准备';
  els.p1State.classList.toggle('ready',!!p1?.ready);els.p2State.classList.toggle('ready',!!p2?.ready);els.p1Card.classList.toggle('me',mySlot==='p1');els.p2Card.classList.toggle('me',mySlot==='p2');
  if(sr.status==='lobby'){renderSettingsUI(s,sr);renderGameLibrary();}
  const mine=me();els.readyBtn.textContent=mine?.ready?'取消准备':'我准备好了';els.readyBtn.disabled=!p2||sr.status!=='lobby';
  if(!p2)els.lobbyNote.textContent='等待朋友加入；房间码之后也可以一直复用。';
  else if(!p2.online||!p1.online)els.lobbyNote.textContent='有人暂时离线，重新打开同一房间即可继续。';
  else if(sr.status==='lobby')els.lobbyNote.textContent=p1.ready&&p2.ready?'双方已准备，正在生成系列赛…':'双方准备一次，就会连续打完整套系列赛。';
  else els.lobbyNote.textContent=`系列赛进行中 · ${Math.min((sr.roundIndex||0)+1,sr.totalRounds||s.rounds)}/${sr.totalRounds||s.rounds}`;
  els.cancelSeriesBtn.style.display=sr.status!=='lobby'?'inline-flex':'none';
  if(sr.status==='lobby'){showScreen('lobbyScreen');if(p1?.ready&&p2?.ready)tryStartSeries();}
  if(sr.status==='round')handleRoundState(sr);
  if(sr.status==='round_result')handleRoundResult(sr);
  if(sr.status==='series_result')showSeriesResult(sr);
}
function renderSettingsUI(s,sr){
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===s.mode));
  document.querySelectorAll('[data-rounds]').forEach(b=>b.classList.toggle('active',Number(b.dataset.rounds)===Number(s.rounds)));
  document.querySelectorAll('[data-diff]').forEach(b=>b.classList.toggle('active',b.dataset.diff===s.difficulty));
  els.difficultyHint.textContent=DIFFS[s.difficulty]?.name||'中等';els.durationRange.value=s.durationSec;els.durationLabel.textContent=`${s.durationSec} 秒`;els.durationBox.textContent=`${s.durationSec}s`;
  const locked=sr.status!=='lobby'||!!roomData.players?.p1?.ready||!!roomData.players?.p2?.ready;document.querySelectorAll('#modeSeg button,#roundSeg button,#difficultySeg button').forEach(b=>b.disabled=locked);els.durationRange.disabled=locked;
  els.seriesPreviewTitle.textContent=`${s.rounds} 局 · ${s.mode==='random'?'🎲 随机游戏':'同一游戏'}`;
  els.seriesPreviewSub.textContent=s.mode==='random'?`当前随机池 ${normalizePool(s.randomPool).length} 个游戏；每局 ${s.durationSec}s · ${DIFFS[s.difficulty].name}。`:`${GAMES[s.sameGame]?.icon||''} ${GAMES[s.sameGame]?.name||''} 连打 ${s.rounds} 局；每局 ${s.durationSec}s。`;
  els.pickerNote.textContent=locked?'有人已准备 / 系列赛进行中，设置暂时锁定':s.mode==='random'?'点击游戏卡加入或移出随机池':'点击一个游戏作为整套系列赛项目';
}
async function updateSetting(patch){
  const sr=series();if(sr.status!=='lobby'||roomData.players?.p1?.ready||roomData.players?.p2?.ready)return;
  await update(ref(db,`rooms/${roomCode}/settings`),patch);
}
async function pickGame(id){
  const s=settings();if(series().status!=='lobby'||roomData.players?.p1?.ready||roomData.players?.p2?.ready)return;
  if(s.mode==='same')await updateSetting({sameGame:id});
  else{let pool=normalizePool(s.randomPool);pool=pool.includes(id)?pool.filter(x=>x!==id):[...pool,id];if(pool.length<2)return addFeed('🎲 随机池至少保留 2 个游戏');await updateSetting({randomPool:pool});}
}
async function toggleReady(){if(!roomCode||series().status!=='lobby')return;await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:!me()?.ready,status:me()?.ready?'在大厅':'已准备'});}
function buildPlaylist(s,seriesId){
  if(s.mode==='same')return Array(Number(s.rounds)).fill(s.sameGame||'reaction');
  const pool=normalizePool(s.randomPool);const out=[];for(let i=0;i<Number(s.rounds);i++){const choices=pool.filter(x=>x!==out[out.length-1]);out.push(choices[randInt(`${seriesId}:playlist:${i}`,0,choices.length-1)]||pool[0]);}return out;
}
async function tryStartSeries(){
  const sr=series();if(sr.status!=='lobby'||finishBusy)return;finishBusy=true;
  try{
    const s=settings(),seriesId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,playlist=buildPlaylist(s,seriesId),startAt=serverNow()+3200,firstGame=playlist[0]||'reaction',durationMs=roundDurationMs(firstGame,s.durationSec);
    await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>{
      if(!cur||cur.status!=='lobby')return;return {status:'round',seriesId,roundIndex:0,totalRounds:Number(s.rounds),playlist,wins:{p1:0,p2:0},roundResults:[],difficulty:s.difficulty,durationSec:Number(s.durationSec),roundId:`${seriesId}-0`,startAt,endAt:durationMs?startAt+durationMs:null,historySaved:false};
    });
  }finally{finishBusy=false;}
}
function handleRoundState(sr){
  const newRound=sr.roundId&&sr.roundId!==roundId;if(newRound){els.roundResult.classList.remove('show');roundId=sr.roundId;activeGame=(Array.isArray(sr.playlist)?sr.playlist:Object.values(sr.playlist||{}))[sr.roundIndex]||'reaction';resetLocalRound(activeGame);showScreen('gameScreen');startRenderLoop();}
  if(newRound||!roundMounted)mountGame(activeGame);
}
function isCoordinator(){return !!mySlot;}
function startRenderLoop(){
  if(renderTimer)return;
  lastFrameAt=performance.now();
  const tick=()=>{
    if(!renderTimer)return;
    renderFrame();
    renderTimer=requestAnimationFrame(tick);
  };
  renderTimer=requestAnimationFrame(tick);
}
function stopRenderLoop(){if(renderTimer){cancelAnimationFrame(renderTimer);renderTimer=null;}}
function renderFrame(){
  const sr=series();if(sr.status!=='round')return;const now=serverNow(),perf=performance.now(),dt=Math.min(.1,(perf-lastFrameAt)/1000);lastFrameAt=perf;
  const untimed=isUntimedGame(activeGame),ended=!untimed&&now>=Number(sr.endAt||0),live=now>=sr.startAt&&!ended;localPhase=now<sr.startAt?'countdown':live?'playing':'ending';
  els.gameOverlay.classList.toggle('show',!live);
  if(now<sr.startAt){els.overlayBig.textContent=Math.max(1,Math.ceil((sr.startAt-now)/1000));els.overlaySmall.textContent=`第 ${sr.roundIndex+1}/${sr.totalRounds} 局 · ${GAMES[activeGame].name}`;}
  else if(ended){els.overlayBig.textContent='TIME';els.overlaySmall.textContent='正在结算本局';}
  if(activeGame==='airstrike'&&live&&now<sr.startAt+15000){els.timer.textContent=`布阵 ${formatTime(sr.startAt+15000-now)}`;}
  else els.timer.textContent=untimed?'∞':formatTime(Number(sr.endAt||now)-now);
  els.roundLabel.textContent=`ROUND ${sr.roundIndex+1}/${sr.totalRounds}`;renderRoundDots(sr);updateEffectUI(now);syncOpponentUI();
  if(live){renderActiveGame(now,dt,sr);els.myScore.textContent=score.toLocaleString();scheduleSync();}
  if(ended&&now>=Number(sr.endAt||0)+450){if(soloMode)finishSoloTraining();else if(isCoordinator())finalizeRound(sr);}
  if(!soloMode&&(isUntimedGame(activeGame)||activeGame==='airstrike')&&roomData?.shared?.roundId===roundId&&roomData.shared.winner&&isCoordinator())finalizeRound(sr,true);
}
function renderRoundDots(sr){
  const rr=Array.isArray(sr.roundResults)?sr.roundResults:Object.values(sr.roundResults||{});els.roundDots.innerHTML='';for(let i=0;i<sr.totalRounds;i++){const d=document.createElement('i');d.className='round-dot';const r=rr[i];if(r)d.classList.add(r.winner==='draw'?'draw':r.winner===mySlot?'me':'op');if(i===sr.roundIndex)d.classList.add('current');els.roundDots.appendChild(d);}
}
function resetLocalRound(type){
  score=0;progress=0;status='准备中';roundMounted=false;usedSkills=new Set();shieldActive=false;effects={freezeUntil:0,blindUntil:0,jamUntil:0,rushUntil:0,speedUntil:0,obstacleUntil:0,fakeUntil:0};gameState={};els.feed.innerHTML='';els.myScore.textContent='0';els.opScore.textContent='0';
  if(!soloMode)update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{score:0,progress:0,status:'准备中',ready:false}).catch(()=>{});
  if(type==='2048')init2048();if(type==='tetris')initTetris();if(type==='runner')initRunner();if(type==='plane')initPlane();if(type==='schulte')initSchulte(false);if(type==='schulteDynamic')initSchulteWheel();if(type==='memory')initMemory();if(type==='memorySequence')initMemorySequence();if(type==='tracking')initTracking();if(type==='color')initColor();if(type==='tugRhythm')initTugRhythm();if(type==='duelShooter')initDuelShooter();if(type==='stackTower')initStackTower();if(type==='airstrike')initAirstrike();
}
async function finalizeRound(sr,early=false){
  if(finishBusy||series().status!=='round')return;finishBusy=true;
  try{
    await flushPlayerState();if(!early)await new Promise(r=>setTimeout(r,220));const ps=(await get(ref(db,`rooms/${roomCode}/players`))).val()||{};let p1=Number(ps.p1?.score||0),p2=Number(ps.p2?.score||0);
    const sh=(await get(ref(db,`rooms/${roomCode}/shared`))).val();if((activeGame==='gomoku'||activeGame==='needle')&&sh?.roundId===roundId){if(sh.winner){p1=sh.winner==='p1'?1000:0;p2=sh.winner==='p2'?1000:0;}else if(activeGame==='gomoku'){p1=0;p2=0;}}
    const winner=p1===p2?'draw':p1>p2?'p1':'p2',result={index:sr.roundIndex,game:activeGame,p1,p2,winner,finishedAt:serverNow()};
    await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>{
      if(!cur||cur.status!=='round'||cur.roundId!==sr.roundId)return;const arr=Array.isArray(cur.roundResults)?[...cur.roundResults]:Object.values(cur.roundResults||{}),wins={p1:Number(cur.wins?.p1||0),p2:Number(cur.wins?.p2||0)};arr[cur.roundIndex]=result;if(winner!=='draw')wins[winner]++;return {...cur,status:'round_result',roundResults:arr,wins,roundResult:result,resultAt:serverNow()};
    });
  }catch(e){console.error(e);}finally{finishBusy=false;}
}
function handleRoundResult(sr){
  stopRenderLoop();localPhase='round_result';const r=sr.roundResult;if(!r)return;const mine=r[mySlot]||0,op=r[otherSlot()]||0,won=r.winner===mySlot,draw=r.winner==='draw',forfeitMine=r.forfeit===mySlot,forfeitOp=r.forfeit===otherSlot();els.roundResult.classList.add('show');els.roundEmoji.textContent=draw?'🤝':forfeitMine?'🏳️':forfeitOp?'🎁':won?'⚡':'💥';els.roundResultTitle.textContent=forfeitMine?'你已认输本局':forfeitOp?'对手退出 · 本局胜利':draw?'本局平局':won?'本局胜利':'本局失利';els.roundResultScore.textContent=`${mine.toLocaleString()} : ${op.toLocaleString()}`;
  const playlist=Array.isArray(sr.playlist)?sr.playlist:Object.values(sr.playlist||{}),next=playlist[sr.roundIndex+1];els.nextGameText.textContent=next?`下一局：${GAMES[next].icon} ${GAMES[next].name} · 即将自动开始`:'系列赛完成 · 正在生成总战绩';
  if(isCoordinator()&&!advanceTimeout){const wait=Math.max(120,(sr.resultAt||serverNow())+3300-serverNow());advanceTimeout=setTimeout(()=>{advanceTimeout=null;if(series().status==='round_result')advanceSeries(series());},wait);}
}
async function advanceSeries(sr){
  if(advanceTimeout){clearTimeout(advanceTimeout);advanceTimeout=null;}
  if(advanceBusy||series().status!=='round_result')return;advanceBusy=true;
  try{
    await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>{
      if(!cur||cur.status!=='round_result')return;if(cur.roundIndex+1>=cur.totalRounds)return {...cur,status:'series_result',finishedAt:serverNow(),roundResult:null};
      const idx=cur.roundIndex+1,startAt=serverNow()+3000,playlist=Array.isArray(cur.playlist)?cur.playlist:Object.values(cur.playlist||{}),nextGame=playlist[idx]||'reaction',durationMs=roundDurationMs(nextGame,cur.durationSec);return {...cur,status:'round',roundIndex:idx,roundId:`${cur.seriesId}-${idx}`,startAt,endAt:durationMs?startAt+durationMs:null,roundResult:null,resultAt:null};
    });
    await remove(ref(db,`rooms/${roomCode}/shared`)).catch(()=>{});
  }finally{advanceBusy=false;}
}
async function cancelSeries(){
  if(!roomCode)return;await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:false,status:'在大厅'});await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>cur?.status!=='lobby'?{status:'lobby',seriesId:null,roundIndex:0,totalRounds:0,wins:{p1:0,p2:0},roundResults:[]}:cur);els.roundResult.classList.remove('show');stopRenderLoop();showScreen('lobbyScreen');
}
function showSeriesResult(sr){
  stopRenderLoop();els.roundResult.classList.remove('show');showScreen('seriesResultScreen');const w1=Number(sr.wins?.p1||0),w2=Number(sr.wins?.p2||0),mine=mySlot==='p1'?w1:w2,op=mySlot==='p1'?w2:w1,won=mine>op,draw=mine===op;els.seriesEmoji.textContent=draw?'🤝':won?'🏆':'🫠';els.seriesTitle.textContent=draw?'DRAW':won?'SERIES WIN':'SERIES LOST';els.seriesFinal.textContent=`${mine} : ${op}`;els.seriesCaption.textContent=`${sr.totalRounds} 局 · ${DIFFS[sr.difficulty]?.name||''} · 每局 ${sr.durationSec}s · 房间 ${roomCode}`;
  const rr=Array.isArray(sr.roundResults)?sr.roundResults:Object.values(sr.roundResults||{});els.roundHistory.innerHTML='';rr.forEach((r,i)=>{const d=document.createElement('div');d.className='rh '+(r.winner==='draw'?'':r.winner===mySlot?'win':'lose');d.textContent=`${i+1}. ${GAMES[r.game]?.icon||''} ${r[mySlot]||0}:${r[otherSlot()]||0}`;els.roundHistory.appendChild(d);});
  if(isCoordinator()&&!sr.historySaved)saveSeriesHistory(sr);
}
async function saveSeriesHistory(sr){
  if(historyBusy)return;historyBusy=true;try{const p1=roomData.players?.p1?.name||'P1',p2=roomData.players?.p2?.name||'P2',record={seriesId:sr.seriesId,roomCode,p1,p2,wins:sr.wins,totalRounds:sr.totalRounds,difficulty:sr.difficulty,durationSec:sr.durationSec,playlist:sr.playlist,roundResults:sr.roundResults,finishedAt:sr.finishedAt||serverNow()};await set(ref(db,`pairHistory/${pairKey()}/${sr.seriesId}`),record);await update(ref(db,`rooms/${roomCode}/series`),{historySaved:true});}catch(e){console.error(e);}finally{historyBusy=false;}
}
async function backToLobby(){
  await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:false,status:'在大厅',score:0,progress:0});await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>cur?.status==='series_result'?{status:'lobby',seriesId:null,roundIndex:0,totalRounds:0,wins:{p1:0,p2:0},roundResults:[]}:cur);showScreen('lobbyScreen');
}

function mountGame(type){
  roundMounted=true;els.gameSurface.innerHTML='';const g=GAMES[type];els.gameModeTitle.textContent=`${g.icon} ${g.name}`;els.gameHint.textContent=g.desc;els.difficultyBadge.textContent=DIFFS[series().difficulty]?.name||'中等';els.myScoreName.textContent=me()?.name||'YOU';els.opScoreName.textContent=soloMode?'PERSONAL BEST':(opponent()?.name||'RIVAL');if(soloMode)els.opScore.textContent=getSoloBest(type,soloSettings.difficulty).toLocaleString();
  if(type==='reaction')mountReaction();else if(type==='number')mountNumber();else if(type==='schulte')mountSchulte();else if(type==='schulteDynamic')mountSchulteWheel();else if(type==='color')mountColor();else if(type==='falling')mountFalling();else if(type==='memory')mountMemory();else if(type==='memorySequence')mountMemorySequence();else if(type==='tracking')mountTracking();else if(type==='2048')mount2048();else if(type==='tetris')mountTetris();else if(type==='runner')mountRunner();else if(type==='plane')mountPlane();else if(type==='tug')mountTug();else if(type==='tugRhythm')mountTugRhythm();else if(type==='duelShooter')mountDuelShooter();else if(type==='stackTower')mountStackTower();else if(type==='needle')mountNeedle();else if(type==='gomoku')mountGomoku();else if(type==='airstrike')mountAirstrike();
  renderSkills();
}
function renderActiveGame(now,dt,sr){
  if(typeDisabled())return;
  if(activeGame==='reaction')renderReaction(now,sr);else if(activeGame==='number')renderNumber(now,sr);else if(activeGame==='schulte')renderSchulte(now,sr);else if(activeGame==='schulteDynamic')renderSchulteWheel(now,sr);else if(activeGame==='color')renderColor(now,sr);else if(activeGame==='falling')renderFalling(now,sr);else if(activeGame==='memory')renderMemory(now,sr);else if(activeGame==='memorySequence')renderMemorySequence(now,sr);else if(activeGame==='tracking')renderTracking(now,sr);else if(activeGame==='2048')render2048(now,sr);else if(activeGame==='tetris')renderTetris(now,dt,sr);else if(activeGame==='runner')renderRunner(now,dt,sr);else if(activeGame==='plane')renderPlane(now,dt,sr);else if(activeGame==='tug')renderTug(now,sr);else if(activeGame==='tugRhythm')renderTugRhythm(now,sr);else if(activeGame==='duelShooter')renderDuelShooter(now,sr);else if(activeGame==='stackTower')renderStackTower(now,sr);else if(activeGame==='needle')renderNeedle(now,sr);else if(activeGame==='gomoku')renderGomoku(now,sr);else if(activeGame==='airstrike')renderAirstrike(now,sr);
}
function typeDisabled(){return false;}
function canInteract(){return localPhase==='playing'&&serverNow()>=effects.freezeUntil;}
function setScore(n,st=null,prog=null){const old=score;score=Math.max(0,Math.round(n));if(st!==null)status=st;if(prog!==null)progress=clamp(prog,0,100);els.myScore.textContent=score.toLocaleString();scheduleSync(true);const crossed=(GAMES[activeGame]?.skills||[]).some(([,base])=>{const at=skillThreshold(base);return (old<at&&score>=at)||(old>=at&&score<at);});if(crossed)renderSkills();}
function addScore(n,st=null,prog=null){setScore(score+n,st,prog);}
function scheduleSync(immediate=false){
  if(!roomCode||!mySlot)return;const now=Date.now();if(immediate&&now-lastSyncAt>130)return flushPlayerState();if(syncTimer)return;syncTimer=setTimeout(()=>{syncTimer=null;flushPlayerState();},180);
}
async function flushPlayerState(){if(!roomCode||!mySlot)return;lastSyncAt=Date.now();try{await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{score,progress,status,online:true});}catch(e){console.error(e);}}
function syncOpponentUI(){if(soloMode){const best=getSoloBest(activeGame,soloSettings.difficulty);els.opScore.textContent=best.toLocaleString();els.opGenericScore.textContent=best.toLocaleString();els.opGenericStatus.textContent='个人最佳';els.opProgress.style.width=`${clamp(best?score/best*100:0,0,100)}%`;return;}const op=opponent();els.opScore.textContent=Number(op?.score||0).toLocaleString();els.opGenericScore.textContent=Number(op?.score||0).toLocaleString();els.opGenericStatus.textContent=op?.status||'正在战斗';els.opProgress.style.width=`${clamp(Number(op?.progress||0),0,100)}%`;}

// ---------- skills ----------
function skillThreshold(base){return Math.round(base*(Number(series().durationSec||45)/45));}
function renderSkills(){
  syncOpponentUI();els.skills.innerHTML='';if(soloMode){els.skills.innerHTML='<div class="empty" style="padding:22px 10px">🧠 单人训练模式<br><small>关闭对战技能，只记录你的纯净成绩</small></div>';return;}const cfg=GAMES[activeGame]?.skills||[];if(!cfg.length){els.skills.innerHTML='<div class="empty" style="padding:22px 10px">♟ 纯竞技模式<br><small>本游戏不使用技能</small></div>';return;}
  cfg.forEach(([id,base])=>{const def=SKILL_DEFS[id],at=skillThreshold(base),ready=score>=at&&!usedSkills.has(id),used=usedSkills.has(id);const b=document.createElement('button');b.className='skill'+(ready?' ready':'')+(used?' used':'');b.disabled=!ready||localPhase!=='playing';b.innerHTML=`<span class="skill-ico">${def.icon}</span><span><div class="skill-name">${def.name}</div><div class="skill-desc">${def.desc}</div></span><span class="skill-state">${used?'USED':ready?'可使用':`${score}/${at}`}</span>`;b.addEventListener('click',()=>useSkill(id,at));els.skills.appendChild(b);});
}
async function useSkill(type,at){
  if(soloMode)return;
  if(!canInteract()||score<at||usedSkills.has(type))return;if(type==='shield'){usedSkills.add(type);shieldActive=true;addFeed('🛡️ 护盾已激活');renderSkills();return;}
  if(!opponent()?.online)return addFeed('对手离线，技能保留');usedSkills.add(type);renderSkills();await push(ref(db,`rooms/${roomCode}/attacks`),{from:mySlot,to:otherSlot(),type,roundId,game:activeGame,createdAt:serverTimestamp()});addFeed(`${SKILL_DEFS[type].icon} 已发动 ${SKILL_DEFS[type].name}`);
}
function handleAttack(a){
  if(!a||a.to!==mySlot||a.roundId!==roundId||a.game!==activeGame)return;const now=serverNow();if(a.createdAt&&typeof a.createdAt==='number'&&Math.abs(now-a.createdAt)>9000)return;if(shieldActive){shieldActive=false;addFeed('🛡️ 护盾挡住了对手技能');return;}
  const t=a.type;addFeed(`${SKILL_DEFS[t]?.icon||'⚠️'} 对手发动 ${SKILL_DEFS[t]?.name||t}`);
  if(t==='freeze')effects.freezeUntil=Math.max(effects.freezeUntil,now+2300);
  else if(t==='blind')effects.blindUntil=Math.max(effects.blindUntil,now+2800);
  else if(t==='fake')effects.fakeUntil=Math.max(effects.fakeUntil,now+2800);
  else if(t==='jam')effects.jamUntil=Math.max(effects.jamUntil,now+2500);
  else if(t==='rush')effects.rushUntil=Math.max(effects.rushUntil,now+4200);
  else if(t==='speed')effects.speedUntil=Math.max(effects.speedUntil,now+4500);
  else if(t==='obstacle'){effects.obstacleUntil=Math.max(effects.obstacleUntil,now+4500);if(activeGame==='runner'){gameState.forceObstacle=true;gameState.forcedBorn=now;}}
  else if(t==='slip'){addScore(-140,'🧼 被对手拉回去');effects.freezeUntil=Math.max(effects.freezeUntil,now+700);}
  else if(t==='shuffle'){if(activeGame==='schulte')shuffleSchulte(true);if(activeGame==='memory')gameState.attackShuffle=(gameState.attackShuffle||0)+1;}
  else if(t==='garbage'){if(activeGame==='2048')add2048Block();if(activeGame==='tetris')addTetrisGarbage();}
}
function updateEffectUI(now){
  const fr=effects.freezeUntil>now,bl=effects.blindUntil>now;els.effectLayer.classList.toggle('freeze',fr);els.effectLayer.classList.toggle('blind',bl);els.gameStage.classList.toggle('frozen',fr);if(bl)els.effectMsg.innerHTML=`<div>🌫️<br><span style="font-size:14px">视线干扰 ${((effects.blindUntil-now)/1000).toFixed(1)}s</span></div>`;
}

// ---------- reaction ----------
function mountReaction(){els.gameSurface.innerHTML='<div class="stage-inner"><button class="reaction-pad" id="reactionPad"><span class="reaction-icon" id="reactionIcon">🛑</span><span class="reaction-text" id="reactionText">等信号</span><span class="reaction-sub" id="reactionSub">太早点击会扣分</span></button></div>';$('reactionPad').addEventListener('click',hitReaction);gameState.answered=-1;gameState.feedback='';}
function reactionCfg(){const d=series().difficulty;return {cycle:{easy:5200,medium:4500,hard:3800,hell:3200}[d],min:{easy:1600,medium:1300,hard:1000,hell:800}[d],spread:{easy:2100,medium:1800,hard:1500,hell:1200}[d]};}
function reactionInfo(now){const sr=series(),cfg=reactionCfg(),el=now-sr.startAt,cycle=Math.floor(el/cfg.cycle),within=el%cfg.cycle,goAt=cfg.min+randInt(`${roundId}:react:${cycle}`,0,cfg.spread);return{cycle,within,goAt,cfg};}
function renderReaction(now){const x=reactionInfo(now),pad=$('reactionPad'),fake=effects.fakeUntil>now&&x.within<x.goAt&&x.within>x.goAt-900;pad.className='reaction-pad'+(x.within>=x.goAt?' go':fake?' fake':'');$('reactionIcon').textContent=x.within>=x.goAt?'⚡':fake?'🟢':'🛑';$('reactionText').textContent=gameState.answered===x.cycle?'本轮完成':x.within>=x.goAt?'现在点！':fake?'看起来像绿灯…':'别点';$('reactionSub').textContent=gameState.feedback||'越快分越高';progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status=`反应训练 · ${Math.round(progress)}%`;}
function hitReaction(){if(!canInteract())return;const x=reactionInfo(serverNow());if(gameState.answered===x.cycle)return;gameState.answered=x.cycle;if(x.within<x.goAt){addScore(-110,'抢跑 -110');gameState.feedback='🚫 抢跑 -110';}else{const rt=Math.round(x.within-x.goAt),pts=Math.max(130,900-rt);addScore(pts,`${rt}ms +${pts}`);gameState.feedback=`⚡ ${rt}ms +${pts}`;}setTimeout(()=>gameState.feedback='',650);}

// ---------- number compare ----------
function mountNumber(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info">快速点击更大的数字</div><div class="choice-row"><button class="big-choice" id="numberL">0</button><button class="big-choice" id="numberR">0</button></div><div class="info" id="numberInfo"></div></div></div>';$('numberL').addEventListener('click',()=>hitNumber('L'));$('numberR').addEventListener('click',()=>hitNumber('R'));gameState.answered=-1;}
function numberInfo(now){const d=series().difficulty,len={easy:1700,medium:1350,hard:1050,hell:780}[d],el=now-series().startAt,cycle=Math.floor(el/len),digits={easy:99,medium:999,hard:9999,hell:99999}[d];let l=randInt(`${roundId}:nL:${cycle}`,1,digits),r=randInt(`${roundId}:nR:${cycle}`,1,digits);if(l===r)r++;return{cycle,l,r,ans:l>r?'L':'R',len};}
function renderNumber(now){const x=numberInfo(now);$('numberL').textContent=x.l;$('numberR').textContent=x.r;$('numberInfo').textContent=`速度越快，题目刷新越快 · ${DIFFS[series().difficulty].name}`;progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status='数字快判';}
function hitNumber(c){if(!canInteract())return;const x=numberInfo(serverNow());if(gameState.answered===x.cycle)return;gameState.answered=x.cycle;if(c===x.ans)addScore(90,'判断正确 +90');else addScore(-35,'判断错误 -35');}

// ---------- Schulte ----------
function schulteSize(){return 5;}
function schultePenalty(){return {easy:0,medium:10,hard:20,hell:35}[series().difficulty]||10;}
function schulteMoveInterval(){return {easy:2600,medium:1900,hard:1350,hell:900}[series().difficulty]||1900;}
function schulteOrder(sheet=0,salt=0){return shuffleDet(Array.from({length:25},(_,i)=>i+1),`${roundId}:schulte-sheet:${sheet}:${salt}`);}
function initSchulte(dynamic){
  gameState={dynamic,n:5,total:25,next:1,sheet:0,tables:0,order:schulteOrder(0,0),salt:0,lastCorrectAt:serverNow(),tableStartedAt:serverNow(),mistakes:0,dynamicCycle:-1,wrongNum:null,wrongUntil:0,completeUntil:0};
}
function mountSchulte(){
  els.gameSurface.innerHTML=`<div class="stage-inner"><div class="schulte-wrap"><div class="schulte-topline"><div><b id="schulteMode">${gameState.dynamic?'动态数字追踪':'经典舒尔特表'}</b><span id="schulteProgress">1 / 25</span></div><div class="schulte-rule">按 1 → 25 升序寻找 · 视线尽量停在表格中心</div></div><div class="schulte-board-wrap"><div class="grid-game schulte-grid" id="schulteGrid" style="grid-template-columns:repeat(5,1fr)"></div><div class="schulte-focus" aria-hidden="true"><i></i></div></div><div class="schulte-footer"><span id="schulteInfo">不要追着数字逐格扫；用周边视野去找。</span><span id="schulteStats">0 张 · 0 误触</span></div></div></div>`;
  drawSchulte();
}
function drawSchulte(){
  const grid=$('schulteGrid');if(!grid)return;grid.innerHTML='';
  for(const num of gameState.order){
    const b=document.createElement('button');b.className='grid-cell schulte-cell';b.textContent=num;b.dataset.num=num;b.setAttribute('aria-label',`数字 ${num}`);
    if(gameState.wrongNum===num&&serverNow()<gameState.wrongUntil)b.classList.add('wrong');
    b.addEventListener('click',()=>hitSchulte(num));grid.appendChild(b);
  }
  const p=$('schulteProgress'),s=$('schulteStats'),i=$('schulteInfo');
  if(p)p.textContent=gameState.next<=25?`${gameState.next} / 25`:'完成';
  if(s)s.textContent=`${gameState.tables} 张 · ${gameState.mistakes} 误触`;
  if(i)i.textContent=gameState.dynamic?'衍生玩法：数字会定时换位，但点击顺序仍是 1 → 25。':'经典规则：数字位置保持不变，整张完成后才生成下一张。';
}
function shuffleSchulte(fromAttack=false){
  if(!gameState.dynamic&&fromAttack)return;
  gameState.salt=(gameState.salt||0)+1;
  gameState.order=shuffleDet(gameState.order,`${roundId}:schulte-move:${gameState.sheet}:${gameState.salt}:${fromAttack?'atk':'cycle'}`);
  drawSchulte();
}
function startNextSchulteTable(now=serverNow()){
  gameState.sheet++;gameState.next=1;gameState.salt=0;gameState.order=schulteOrder(gameState.sheet,0);gameState.lastCorrectAt=now;gameState.tableStartedAt=now;gameState.dynamicCycle=-1;gameState.completeUntil=0;gameState.wrongNum=null;drawSchulte();
}
function hitSchulte(num){
  if(!canInteract()||gameState.next>25||serverNow()<gameState.completeUntil)return;
  const now=serverNow();
  if(num!==gameState.next){
    gameState.mistakes++;gameState.wrongNum=num;gameState.wrongUntil=now+280;
    const penalty=schultePenalty();if(penalty)addScore(-penalty,`误触 ${num} -${penalty}`);else status=`误触 ${num} · 顺序不变`;
    drawSchulte();setTimeout(()=>{if(gameState.wrongNum===num&&serverNow()>=gameState.wrongUntil){gameState.wrongNum=null;drawSchulte();}},300);return;
  }
  const reaction=Math.max(0,now-gameState.lastCorrectAt),speedBonus=Math.max(0,Math.round(35-reaction/90));
  gameState.lastCorrectAt=now;gameState.next++;
  addScore(35+speedBonus,`找到 ${num} +${35+speedBonus}`,((gameState.next-1)/25)*100);
  if(gameState.next>25){
    const elapsed=now-gameState.tableStartedAt,finishBonus=clamp(900-Math.floor(elapsed/45),180,760);
    gameState.tables++;addScore(finishBonus,`完成一张 · ${(elapsed/1000).toFixed(1)}s +${finishBonus}`,100);gameState.completeUntil=now+720;drawSchulte();
  }else drawSchulte();
}
function renderSchulte(now){
  if(gameState.next>25&&gameState.completeUntil&&now>=gameState.completeUntil){startNextSchulteTable(now);}
  if(gameState.dynamic&&gameState.next<=25){
    const cycle=Math.floor((now-gameState.tableStartedAt)/schulteMoveInterval());
    if(cycle>0&&cycle!==gameState.dynamicCycle){gameState.dynamicCycle=cycle;shuffleSchulte(false);}
  }
  progress=clamp(((Math.min(gameState.next,26)-1)/25)*100,0,100);
  status=gameState.next>25?'✅ 完成一张':`${gameState.dynamic?'动态追踪':'经典舒尔特'} · ${gameState.next}/25 · ${gameState.tables} 张`;
  const p=$('schulteProgress'),s=$('schulteStats');if(p)p.textContent=gameState.next<=25?`${gameState.next} / 25`:'完成';if(s)s.textContent=`${gameState.tables} 张 · ${gameState.mistakes} 误触`;
}

// ---------- Rotating-ring dynamic Schulte ----------
function schulteWheelCfg(){
  const d=series().difficulty;
  return {
    rings:3,
    radii:{easy:[82,145,205],medium:[78,145,212],hard:[75,145,218],hell:[72,145,222]}[d],
    speeds:{easy:[.16,-.12,.09],medium:[.22,-.17,.13],hard:[.31,-.24,.18],hell:[.42,-.34,.26]}[d]
  };
}
function initSchulteWheel(){
  const slots=[7,8,10],nums=shuffleDet(Array.from({length:25},(_,i)=>i+1),`${roundId}:wheel:nums`);
  let k=0;const items=[];
  slots.forEach((count,ring)=>{for(let slot=0;slot<count;slot++)items.push({num:nums[k++],ring,slot,count,base:random01(`${roundId}:wheel:${ring}:base`)*TAU});});
  gameState={next:1,items,wrongNum:null,wrongUntil:0,lastCorrectAt:serverNow(),completed:0};
}
function mountSchulteWheel(){
  els.gameSurface.innerHTML=`<div class="stage-inner"><div class="wheel-schulte"><div class="schulte-topline"><div><b>转盘动态舒尔特</b><span id="wheelProgress">1 / 25</span></div><div class="schulte-rule">每一层独立旋转 · 数字固定在自己的环上</div></div><canvas id="wheelCanvas" class="game-canvas wheel-canvas" width="640" height="520"></canvas><div class="schulte-footer"><span>按 1 → 25 寻找；不要追某一层，让视线回到中心。</span><span id="wheelStats">0 误触</span></div></div></div>`;
  const cv=$('wheelCanvas');cv.addEventListener('pointerdown',hitSchulteWheel);
}
function schulteWheelPositions(now){
  const cfg=schulteWheelCfg(),t=Math.max(0,(now-series().startAt)/1000),speedBoost=effects.speedUntil>now?1.65:1,cx=320,cy=260;
  return gameState.items.map(it=>{const rot=it.base+cfg.speeds[it.ring]*speedBoost*t,a=rot+it.slot*TAU/it.count,r=cfg.radii[it.ring];return {...it,a,x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});
}
function renderSchulteWheel(now){
  const cv=$('wheelCanvas');if(!cv)return;const ctx=cv.getContext('2d'),cfg=schulteWheelCfg(),cx=320,cy=260,pos=schulteWheelPositions(now);
  ctx.clearRect(0,0,640,520);const bg=ctx.createRadialGradient(cx,cy,10,cx,cy,300);bg.addColorStop(0,'#111a2e');bg.addColorStop(1,'#070b14');ctx.fillStyle=bg;ctx.fillRect(0,0,640,520);
  cfg.radii.forEach((r,i)=>{ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.strokeStyle=`rgba(${i===1?'168,139,255':'87,231,255'},${.15+i*.025})`;ctx.lineWidth=24;ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,r,0,TAU);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=1;ctx.stroke();});
  ctx.beginPath();ctx.arc(cx,cy,16,0,TAU);ctx.fillStyle='rgba(87,231,255,.12)';ctx.fill();ctx.strokeStyle='rgba(87,231,255,.5)';ctx.stroke();
  for(const p of pos){const bad=gameState.wrongNum===p.num&&now<gameState.wrongUntil;ctx.beginPath();ctx.arc(p.x,p.y,22,0,TAU);ctx.fillStyle=bad?'rgba(255,114,133,.35)':'rgba(12,17,31,.94)';ctx.fill();ctx.strokeStyle=bad?'#ff7285':'rgba(255,255,255,.14)';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#f7f8fc';ctx.font='900 17px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(p.num),p.x,p.y+1);}
  $('wheelProgress').textContent=gameState.next<=25?`${gameState.next} / 25`:'完成';$('wheelStats').textContent=`${gameState.mistakes||0} 误触`;
  progress=clamp((gameState.next-1)/25*100,0,100);status=`转盘舒尔特 · 找 ${Math.min(gameState.next,25)}`;
  if(gameState.next>25&&!gameState.doneAt){gameState.doneAt=now;addScore(550,'完成转盘 +550',100);}
}
function hitSchulteWheel(e){
  if(!canInteract()||gameState.next>25)return;const cv=$('wheelCanvas'),r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*520/r.height,pos=schulteWheelPositions(serverNow());let hit=null,best=1e9;for(const p of pos){const d=Math.hypot(x-p.x,y-p.y);if(d<best){best=d;hit=p;}}if(!hit||best>34)return;
  const now=serverNow();if(hit.num!==gameState.next){gameState.mistakes=(gameState.mistakes||0)+1;gameState.wrongNum=hit.num;gameState.wrongUntil=now+300;addScore(-schultePenalty(),`误触 ${hit.num}`);return;}
  const rt=Math.max(0,now-gameState.lastCorrectAt),bonus=Math.max(0,Math.round(30-rt/120));gameState.lastCorrectAt=now;gameState.next++;addScore(42+bonus,`找到 ${hit.num} +${42+bonus}`,((gameState.next-1)/25)*100);
}

// ---------- Stroop color ----------
const COLORS=[['红','#ef5363'],['蓝','#458cff'],['绿','#35c98b'],['黄','#f0c44f'],['紫','#9c6cff'],['橙','#ff914d'],['粉','#ef70b7'],['青','#49d5dc']];
function initColor(){gameState={cycle:-1,answered:-1};}
function mountColor(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap stroop-wrap"><div class="info">找到字体颜色与目标汉字含义一致的选项</div><div class="stroop-target">目标：<b id="colorTargetName">绿</b></div><div class="color-options" id="colorOptions"></div><div class="info">例：上方是「绿」→ 请选择“绿色字体”的词，即使那个词写的是「红」。</div></div></div>';}
function colorInfo(now){const d=series().difficulty,baseLen={easy:2400,medium:1900,hard:1500,hell:1150}[d],len=effects.speedUntil>now?baseLen*.58:baseLen,count={easy:4,medium:6,hard:6,hell:8}[d],cycle=Math.floor((now-series().startAt)/len),target=randInt(`${roundId}:color:t:${cycle}`,0,COLORS.length-1),opts=shuffleDet(Array.from({length:COLORS.length},(_,i)=>i),`${roundId}:color:o:${cycle}`).slice(0,count);if(!opts.includes(target))opts[0]=target;return{cycle,target,opts,len};}
function renderColor(now){const x=colorInfo(now);if(gameState.cycle===x.cycle)return;gameState.cycle=x.cycle;gameState.answered=-1;const [name]=COLORS[x.target];$('colorTargetName').textContent=name;const box=$('colorOptions');box.innerHTML='';x.opts.forEach((ci,i)=>{const [,ink]=COLORS[ci];let wi=randInt(`${roundId}:color:w:${x.cycle}:${i}`,0,COLORS.length-1);if(wi===ci)wi=(wi+1+randInt(`${roundId}:color:w2:${x.cycle}:${i}`,0,COLORS.length-2))%COLORS.length;const word=COLORS[wi][0],b=document.createElement('button');b.className='color-btn stroop-btn';b.style.color=ink;b.textContent=word;b.addEventListener('click',()=>hitColor(ci));box.appendChild(b);});progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`色词干扰 · 找「${name}」的颜色`; }
function hitColor(ci){if(!canInteract())return;const x=colorInfo(serverNow());if(gameState.answered===x.cycle)return;gameState.answered=x.cycle;if(ci===x.target)addScore(105,'字体颜色正确 +105');else addScore(-45,'被字义骗到了 -45');}

// ---------- Falling target shooter ----------
function mountFalling(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap"><canvas class="game-canvas" id="fallCanvas" width="760" height="500"></canvas><div class="info" style="position:absolute;top:10px;left:14px">点击掉落目标 · 红色炸弹不要点</div></div></div>';$('fallCanvas').addEventListener('pointerdown',hitFalling);gameState.hit=new Set();}
function fallingCfg(){const d=series().difficulty;return{spawn:{easy:950,medium:760,hard:590,hell:430}[d],fall:{easy:3000,medium:2500,hard:2050,hell:1650}[d],radius:{easy:30,medium:26,hard:22,hell:18}[d]};}
function fallingObjects(now){const cfg=fallingCfg(),spawn=effects.rushUntil>now?cfg.spawn*.58:cfg.spawn,el=now-series().startAt,cycle=Math.floor(el/spawn),out=[];for(let c=Math.max(0,cycle-7);c<=cycle;c++){const age=el-c*spawn;if(age<0||age>cfg.fall)continue;const bomb=series().difficulty!=='easy'&&random01(`${roundId}:fall:b:${c}`)<(series().difficulty==='hell'?.25:.14),x=45+random01(`${roundId}:fall:x:${c}`)*670,y=-30+(age/cfg.fall)*570;out.push({c,bomb,x,y,r:cfg.radius});}return out;}
function renderFalling(now){const cv=$('fallCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);const bg=ctx.createLinearGradient(0,0,0,500);bg.addColorStop(0,'#0b1729');bg.addColorStop(1,'#070b14');ctx.fillStyle=bg;ctx.fillRect(0,0,760,500);for(let i=0;i<26;i++){ctx.fillStyle=`rgba(255,255,255,${.05+(i%3)*.025})`;ctx.fillRect((i*113)%760,(i*67+Math.floor(now/35))%500,1.2,1.2);}for(const o of fallingObjects(now)){if(gameState.hit.has(o.c))continue;const col=o.bomb?'#ff6577':'#55e4ff';for(let t=3;t>=1;t--){ctx.beginPath();ctx.arc(o.x,o.y-t*13,o.r*(1-t*.12),0,Math.PI*2);ctx.fillStyle=o.bomb?`rgba(255,101,119,${.04*t})`:`rgba(85,228,255,${.04*t})`;ctx.fill();}ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);const g=ctx.createRadialGradient(o.x-o.r*.25,o.y-o.r*.3,2,o.x,o.y,o.r);g.addColorStop(0,'#ffffff');g.addColorStop(.15,col);g.addColorStop(1,o.bomb?'#a92d43':'#167894');ctx.fillStyle=g;ctx.shadowBlur=24;ctx.shadowColor=col;ctx.fill();ctx.shadowBlur=0;ctx.font=`900 ${Math.round(o.r*1.08)}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#08101b';ctx.fillText(o.bomb?'✕':'◎',o.x,o.y+1);}progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=effects.jamUntil>now?'📡 瞄准受干扰':'掉落射击';}
function hitFalling(e){if(!canInteract()||effects.jamUntil>serverNow())return;const cv=$('fallCanvas'),r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*760/r.width,y=(e.clientY-r.top)*500/r.height,objs=fallingObjects(serverNow()).reverse();for(const o of objs){if(gameState.hit.has(o.c))continue;if(Math.hypot(x-o.x,y-o.y)<=o.r*1.3){gameState.hit.add(o.c);if(o.bomb)addScore(-130,'误击炸弹 -130');else addScore(120,'命中 +120');return;}}}

// ---------- Memory ----------
function initMemory(){gameState={cycle:-1,selected:new Set(),attackShuffle:0};}
function memoryCfg(){
  const d=series().difficulty;
  const n={easy:4,medium:5,hard:6,hell:7}[d],count={easy:3,medium:5,hard:8,hell:11}[d],flash={easy:2300,medium:2000,hard:1700,hell:1400}[d],answer={easy:5600,medium:5200,hard:4800,hell:4400}[d],reveal=900;
  return{n,count,flash,answer,reveal,cycle:flash+answer+reveal};
}
function mountMemory(){const cfg=memoryCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap memory-wrap"><div class="info" id="memoryInfo">记住亮起的格子</div><div class="memory-score-note">✓ 点对 +70　✕ 点错 -45　·　答题阶段有充足时间</div><div class="grid-game memory-grid" id="memoryGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div></div></div>`;const grid=$('memoryGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell';b.dataset.i=i;b.addEventListener('click',()=>hitMemory(i));grid.appendChild(b);}}
function memoryInfo(now){const cfg=memoryCfg(),el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cfg.cycle),within=el%cfg.cycle,targetCount=Math.min(cfg.count+(cycle%2),cfg.n*cfg.n-2),targets=[];let k=0;while(targets.length<targetCount&&k<160){const v=randInt(`${roundId}:mem:${cycle}:${gameState.attackShuffle}:${k++}`,0,cfg.n*cfg.n-1);if(!targets.includes(v))targets.push(v);}return{cfg,cycle,within,targets};}
function renderMemory(now){const x=memoryInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.selected=new Set();}const show=x.within<x.cfg.flash,answer=x.within>=x.cfg.flash&&x.within<x.cfg.flash+x.cfg.answer,reveal=x.within>=x.cfg.flash+x.cfg.answer;[...$('memoryGrid').children].forEach((b,i)=>{b.className='grid-cell';if(show&&x.targets.includes(i))b.classList.add('target');if(answer&&gameState.selected.has(i))b.classList.add(x.targets.includes(i)?'correct':'wrong');if(reveal&&x.targets.includes(i))b.classList.add('target');if(reveal&&gameState.selected.has(i)&&!x.targets.includes(i))b.classList.add('wrong');});const remain=Math.ceil(Math.max(0,x.cfg.flash+x.cfg.answer-x.within)/1000);$('memoryInfo').textContent=show?`👀 记住 ${x.targets.length} 个位置 · ${(Math.max(0,x.cfg.flash-x.within)/1000).toFixed(1)}s`:answer?`🧠 现在复原 · 还有 ${remain}s`:'答案揭晓 · 下一组马上开始';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`记忆矩阵 · ${gameState.selected.size}/${x.targets.length}`;}
function hitMemory(i){if(!canInteract())return;const x=memoryInfo(serverNow());const answer=x.within>=x.cfg.flash&&x.within<x.cfg.flash+x.cfg.answer;if(!answer||gameState.selected.has(i))return;gameState.selected.add(i);if(x.targets.includes(i))addScore(70,'记忆正确 +70');else addScore(-45,'记忆错误 -45');}

// ---------- Sequential / dynamic memory ----------
function memorySequenceCfg(){const d=series().difficulty;return{n:{easy:4,medium:5,hard:6,hell:7}[d],count:{easy:4,medium:6,hard:8,hell:11}[d],beat:{easy:820,medium:680,hard:540,hell:430}[d],answer:{easy:6000,medium:5600,hard:5200,hell:4800}[d],reveal:900};}
function initMemorySequence(){gameState={cycle:-1,selected:new Set()};}
function memorySequenceInfo(now){const cfg=memorySequenceCfg(),showTotal=cfg.count*cfg.beat,cycleLen=showTotal+cfg.answer+cfg.reveal,el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cycleLen),within=el%cycleLen,targets=[];let k=0;while(targets.length<cfg.count&&k<180){const v=randInt(`${roundId}:mseq:${cycle}:${k++}`,0,cfg.n*cfg.n-1);if(!targets.includes(v))targets.push(v);}return{cfg,cycle,within,targets,showTotal,cycleLen};}
function mountMemorySequence(){const cfg=memorySequenceCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap memory-wrap"><div class="info" id="mseqInfo">一个一个记住亮起的位置</div><div class="memory-score-note">亮格会依次出现 · 全部播放完后再点击你记住的位置</div><div class="grid-game memory-grid" id="mseqGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div></div></div>`;const grid=$('mseqGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell';b.dataset.i=i;b.addEventListener('click',()=>hitMemorySequence(i));grid.appendChild(b);}}
function renderMemorySequence(now){const x=memorySequenceInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.selected=new Set();}const showing=x.within<x.showTotal,answer=x.within>=x.showTotal&&x.within<x.showTotal+x.cfg.answer,reveal=x.within>=x.showTotal+x.cfg.answer,activeIndex=showing?Math.min(x.targets.length-1,Math.floor(x.within/x.cfg.beat)):-1;[...$('mseqGrid').children].forEach((b,i)=>{b.className='grid-cell';if(showing&&i===x.targets[activeIndex])b.classList.add('target','sequence-pop');if(answer&&gameState.selected.has(i))b.classList.add(x.targets.includes(i)?'correct':'wrong');if(reveal&&x.targets.includes(i))b.classList.add('target');if(reveal&&gameState.selected.has(i)&&!x.targets.includes(i))b.classList.add('wrong');});$('mseqInfo').textContent=showing?`✨ 第 ${activeIndex+1}/${x.targets.length} 个`:answer?`🧠 现在点击所有记住的位置 · ${Math.ceil((x.showTotal+x.cfg.answer-x.within)/1000)}s`:'答案揭晓';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`动态记忆 · ${gameState.selected.size}/${x.targets.length}`;}
function hitMemorySequence(i){if(!canInteract())return;const x=memorySequenceInfo(serverNow());if(x.within<x.showTotal||x.within>=x.showTotal+x.cfg.answer||gameState.selected.has(i))return;gameState.selected.add(i);if(x.targets.includes(i))addScore(75,'记对 +75');else addScore(-50,'记错 -50');}

// ---------- Multiple-object tracking ----------
function trackingCfg(){const d=series().difficulty;return{count:{easy:4,medium:5,hard:7,hell:9}[d],intro:1600,move:{easy:5200,medium:6000,hard:6800,hell:7600}[d],choose:3800,speed:{easy:105,medium:135,hard:170,hell:205}[d],r:{easy:25,medium:23,hard:20,hell:18}[d]};}
function initTracking(){gameState={cycle:-1,answered:false};}
function trackingInfo(now){const cfg=trackingCfg(),cycleLen=cfg.intro+cfg.move+cfg.choose+700,el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cycleLen),within=el%cycleLen,target=randInt(`${roundId}:track:target:${cycle}`,0,cfg.count-1);return{cfg,cycle,within,target,cycleLen};}
function tri01(x){x=((x%2)+2)%2;return x<=1?x:2-x;}
function trackingBalls(now,x){const tMove=Math.min(Math.max(0,x.within-x.cfg.intro),x.cfg.move)/1000,freezeT=x.cfg.move/1000;return Array.from({length:x.cfg.count},(_,i)=>{const phaseX=random01(`${roundId}:track:px:${x.cycle}:${i}`)*2,phaseY=random01(`${roundId}:track:py:${x.cycle}:${i}`)*2,vx=x.cfg.speed*(.72+random01(`${roundId}:track:vx:${x.cycle}:${i}`)*.65),vy=x.cfg.speed*(.65+random01(`${roundId}:track:vy:${x.cycle}:${i}`)*.7),tt=x.within>=x.cfg.intro+x.cfg.move?freezeT:tMove,px=55+tri01(phaseX+tt*vx/310)*530,py=55+tri01(phaseY+tt*vy/210)*310;return{i,x:px,y:py};});}
function mountTracking(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="tracking-wrap"><div class="info" id="trackInfo">先记住发光的目标球</div><canvas id="trackCanvas" class="game-canvas tracking-canvas" width="640" height="420"></canvas><div class="memory-score-note">目标消失标记后继续追踪；所有球停下时点回原来的目标球</div></div></div>`;$('trackCanvas').addEventListener('pointerdown',hitTracking);}
function renderTracking(now){const x=trackingInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.answered=false;}const cv=$('trackCanvas');if(!cv)return;const ctx=cv.getContext('2d'),balls=trackingBalls(now,x),intro=x.within<x.cfg.intro,moving=x.within>=x.cfg.intro&&x.within<x.cfg.intro+x.cfg.move,choose=x.within>=x.cfg.intro+x.cfg.move&&x.within<x.cfg.intro+x.cfg.move+x.cfg.choose;ctx.clearRect(0,0,640,420);const bg=ctx.createLinearGradient(0,0,640,420);bg.addColorStop(0,'#091526');bg.addColorStop(1,'#080b14');ctx.fillStyle=bg;ctx.fillRect(0,0,640,420);for(const b of balls){ctx.beginPath();ctx.arc(b.x,b.y,x.cfg.r,0,TAU);const target=intro&&b.i===x.target;ctx.fillStyle=target?'#ffd16a':'#62ddff';ctx.shadowBlur=target?28:10;ctx.shadowColor=ctx.fillStyle;ctx.fill();ctx.shadowBlur=0;ctx.beginPath();ctx.arc(b.x-6,b.y-7,4,0,TAU);ctx.fillStyle='rgba(255,255,255,.75)';ctx.fill();if(target){ctx.strokeStyle='#fff1b8';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,x.cfg.r+8,0,TAU);ctx.stroke();}}
  $('trackInfo').textContent=intro?'👁️ 记住黄色目标球':moving?'🔵 追住它！标记已经消失':choose?(gameState.answered?'已作答，等待下一轮':'🎯 现在点原来的目标球'):'下一轮准备中';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`多目标追踪 · ${x.cfg.count} 球`;}
function hitTracking(e){if(!canInteract())return;const now=serverNow(),x=trackingInfo(now),choose=x.within>=x.cfg.intro+x.cfg.move&&x.within<x.cfg.intro+x.cfg.move+x.cfg.choose;if(!choose||gameState.answered)return;const cv=$('trackCanvas'),r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*640/r.width,py=(e.clientY-r.top)*420/r.height,balls=trackingBalls(now,x);let hit=null,best=1e9;for(const b of balls){const d=Math.hypot(px-b.x,py-b.y);if(d<best){best=d;hit=b;}}if(!hit||best>x.cfg.r*1.7)return;gameState.answered=true;if(hit.i===x.target)addScore(220,'追踪正确 +220');else addScore(-90,'追错目标 -90');}

// ---------- 2048 ----------
function init2048(){gameState={board:Array(16).fill(0),max:2,lastBlockCycle:-1};add2048Tile();add2048Tile();}
function mount2048(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="board2048" id="board2048"></div><div class="info" style="position:absolute;bottom:10px">方向键 / WASD · 手机可滑动</div></div>';draw2048();let sx=0,sy=0;els.gameSurface.ontouchstart=e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY;};els.gameSurface.ontouchend=e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;move2048(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));};}
function add2048Tile(){const b=gameState.board,empty=b.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(!empty.length)return;const idx=empty[Math.floor(Math.random()*empty.length)];b[idx]=Math.random()<.9?2:4;}
function add2048Block(){const b=gameState.board,empty=b.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(empty.length){b[empty[Math.floor(Math.random()*empty.length)]]=2;draw2048();addFeed('🧱 对手给你塞了一个 2');}}
function mergeSegment(seg){const vals=seg.filter(v=>v>0),out=[],res={gain:0};for(let i=0;i<vals.length;i++){if(vals[i]===vals[i+1]){const n=vals[i]*2;out.push(n);res.gain+=n;gameState.max=Math.max(gameState.max,n);i++;}else out.push(vals[i]);}while(out.length<seg.length)out.push(0);res.arr=out;return res;}
function compress2048Line(line){const out=[0,0,0,0];let gain=0,start=0;for(let i=0;i<=4;i++){if(i===4||line[i]===-1){const seg=line.slice(start,i),m=mergeSegment(seg);for(let j=0;j<m.arr.length;j++)out[start+j]=m.arr[j];gain+=m.gain;if(i<4)out[i]=-1;start=i+1;}}return{arr:out,gain};}
function rotateBoard(b){const n=Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)n[c*4+(3-r)]=b[r*4+c];return n;}
function move2048(dir){if(!canInteract())return;const turns={left:0,up:3,right:2,down:1}[dir];let b=[...gameState.board];for(let i=0;i<turns;i++)b=rotateBoard(b);let out=[],gain=0;for(let r=0;r<4;r++){const m=compress2048Line(b.slice(r*4,r*4+4));out.push(...m.arr);gain+=m.gain;}b=out;for(let i=0;i<(4-turns)%4;i++)b=rotateBoard(b);if(b.every((v,i)=>v===gameState.board[i]))return;gameState.board=b;addScore(gain,`MAX ${gameState.max}`);add2048Tile();draw2048();}
function draw2048(){const box=$('board2048');if(!box)return;box.innerHTML='';gameState.board.forEach(v=>{const d=document.createElement('div');d.className='tile'+(v===-1?' block':'');d.dataset.v=v;d.textContent=v===-1?'▦':v||'';box.appendChild(d);});}
function render2048(now){const d=series().difficulty,interval={easy:999999,medium:22,hard:14,hell:9}[d]*1000,cycle=Math.floor((now-series().startAt)/interval);if(interval<900000&&cycle>0&&cycle!==gameState.lastBlockCycle){gameState.lastBlockCycle=cycle;add2048Block();}progress=clamp(Math.log2(Math.max(2,gameState.max))/11*100,0,100);status=`MAX ${gameState.max}`;}

// ---------- Tetris ----------
const TETROS=[
  [[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[0,1,1],[1,1,0]],[[1,1,0],[0,1,1]]
];
function initTetris(){gameState={board:Array.from({length:20},()=>Array(10).fill(0)),piece:null,pieceCount:0,dropAcc:0,lastGarbage:-1,lines:0};spawnTetrisPiece();}
function cloneM(m){return m.map(r=>[...r]);}
function rotateM(m){return m[0].map((_,i)=>m.map(r=>r[i]).reverse());}
function spawnTetrisPiece(){const idx=randInt(`${roundId}:tet:${gameState.pieceCount++}`,0,TETROS.length-1);gameState.piece={m:cloneM(TETROS[idx]),x:3,y:0,c:idx+1};if(tetrisCollide(gameState.piece,0,0,gameState.piece.m)){gameState.board=Array.from({length:20},()=>Array(10).fill(0));addScore(-150,'堆满重置 -150');}}
function tetrisCollide(p,dx,dy,m=p.m){for(let r=0;r<m.length;r++)for(let c=0;c<m[r].length;c++)if(m[r][c]){const x=p.x+c+dx,y=p.y+r+dy;if(x<0||x>=10||y>=20||y>=0&&gameState.board[y][x])return true;}return false;}
function tetrisMove(dx){if(!canInteract())return;const p=gameState.piece;if(!tetrisCollide(p,dx,0))p.x+=dx;}
function tetrisRotate(){if(!canInteract())return;const p=gameState.piece,m=rotateM(p.m);if(!tetrisCollide(p,0,0,m))p.m=m;}
function tetrisDrop(){if(!canInteract())return;const p=gameState.piece;if(!tetrisCollide(p,0,1))p.y++;else lockTetris();}
function lockTetris(){const p=gameState.piece;for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c]&&p.y+r>=0)gameState.board[p.y+r][p.x+c]=p.c;let cleared=0;gameState.board=gameState.board.filter(row=>{if(row.every(Boolean)){cleared++;return false;}return true;});while(gameState.board.length<20)gameState.board.unshift(Array(10).fill(0));if(cleared){gameState.lines+=cleared;addScore([0,120,300,520,850][cleared]||900,`消除 ${cleared} 行`);}else addScore(8,'方块落定');spawnTetrisPiece();}
function addTetrisGarbage(){const b=gameState.board,hole=randInt(`${roundId}:garb:${Date.now()}`,0,9);b.shift();b.push(Array.from({length:10},(_,i)=>i===hole?0:8));addFeed('🧱 底部增加垃圾行');}
function mountTetris(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap" style="width:min(390px,86%);height:min(540px,94%)"><canvas class="game-canvas" id="tetrisCanvas" width="360" height="600"></canvas><div class="mobile-controls"><button data-tc="left">←</button><button data-tc="rotate">↻</button><button data-tc="down">↓</button><button data-tc="right">→</button></div></div></div>';document.querySelectorAll('[data-tc]').forEach(b=>b.addEventListener('click',()=>{const x=b.dataset.tc;x==='left'?tetrisMove(-1):x==='right'?tetrisMove(1):x==='rotate'?tetrisRotate():tetrisDrop();}));}
function renderTetris(now,dt){const d=series().difficulty,base={easy:.75,medium:.56,hard:.38,hell:.22}[d],interval=effects.speedUntil>now?base*.52:base;gameState.dropAcc+=dt;if(gameState.dropAcc>interval){gameState.dropAcc=0;tetrisDrop();}const garbageEvery={easy:999,medium:22,hard:13,hell:8}[d],cy=Math.floor((now-series().startAt)/(garbageEvery*1000));if(garbageEvery<900&&cy>0&&cy!==gameState.lastGarbage){gameState.lastGarbage=cy;addTetrisGarbage();}drawTetris();progress=clamp(gameState.lines/20*100,0,100);status=`消行 ${gameState.lines}`;}
function drawTetris(){const cv=$('tetrisCanvas');if(!cv)return;const ctx=cv.getContext('2d'),W=36,H=30;ctx.clearRect(0,0,360,600);ctx.fillStyle='#080d18';ctx.fillRect(0,0,360,600);const cols=['','#5fe5ff','#ffd05e','#a88bff','#ff7ac8','#61e6a9','#ff8b63','#7197ff','#596176'];for(let y=0;y<20;y++)for(let x=0;x<10;x++)if(gameState.board[y][x]){ctx.fillStyle=cols[gameState.board[y][x]];ctx.fillRect(x*W+2,y*H+2,W-4,H-4);}const p=gameState.piece;if(p)for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c]){ctx.fillStyle=cols[p.c];ctx.fillRect((p.x+c)*W+2,(p.y+r)*H+2,W-4,H-4);}ctx.strokeStyle='rgba(255,255,255,.04)';for(let x=1;x<10;x++){ctx.beginPath();ctx.moveTo(x*W,0);ctx.lineTo(x*W,600);ctx.stroke();}}

// ---------- Runner ----------
function initRunner(){gameState={y:0,vy:0,onGround:true,invUntil:0,lastPass:-1,forceObstacle:false};}
function mountRunner(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap"><canvas class="game-canvas" id="runnerCanvas" width="760" height="500"></canvas><div class="mobile-controls"><button id="jumpBtn" style="width:110px">JUMP</button></div></div></div>';$('jumpBtn').addEventListener('click',runnerJump);$('runnerCanvas').addEventListener('pointerdown',runnerJump);}
function runnerJump(){if(!canInteract()||!gameState.onGround)return;gameState.vy=-650;gameState.onGround=false;}
function runnerCfg(){const d=series().difficulty;return{speed:{easy:205,medium:245,hard:285,hell:330}[d],gap:{easy:2100,medium:1750,hard:1450,hell:1200}[d],accel:{easy:.010,medium:.013,hard:.016,hell:.020}[d]};}
function runnerDistance(cfg,bornSec,nowSec){const age=Math.max(0,nowSec-bornSec);return cfg.speed*(age+cfg.accel*(nowSec*nowSec-bornSec*bornSec)/2);}
function runnerObstacles(now){const cfg=runnerCfg(),el=Math.max(0,now-series().startAt),t=el/1000,cy=Math.floor(el/cfg.gap),out=[];for(let c=Math.max(0,cy-3);c<=cy+1;c++){const bornMs=c*cfg.gap,bornSec=bornMs/1000,x=820-runnerDistance(cfg,bornSec,t),w=30+randInt(`${roundId}:run:w:${c}`,0,26),h=35+randInt(`${roundId}:run:h:${c}`,0,40);out.push({c,x,w,h});}if(gameState.forceObstacle){const bornSec=Math.max(0,((gameState.forcedBorn||now)-series().startAt)/1000),fx=820-runnerDistance({...cfg,speed:cfg.speed*1.25},bornSec,t);out.push({c:999999,x:fx,w:42,h:78});if(fx<-60)gameState.forceObstacle=false;}return out;}
function renderRunner(now,dt){gameState.vy+=1650*dt;gameState.y+=gameState.vy*dt;if(gameState.y>=0){gameState.y=0;gameState.vy=0;gameState.onGround=true;}const obs=runnerObstacles(now),px=100,py=400+gameState.y,pw=36,ph=48;for(const o of obs){const oy=448-o.h;if(px+pw>o.x&&px<o.x+o.w&&py+ph>oy&&py<448&&now>gameState.invUntil){gameState.invUntil=now+900;addScore(-120,'撞到障碍 -120');}if(o.x+o.w<px&&o.c>gameState.lastPass&&o.c<999999){gameState.lastPass=o.c;addScore(80,'越过障碍 +80');}}
  if(effects.obstacleUntil<=now)gameState.forceObstacle=false;const elapsed=(now-series().startAt)/1000,mult=1+runnerCfg().accel*Math.max(0,elapsed);score=Math.max(score,Math.floor((now-series().startAt)/110));drawRunner(obs,px,py,pw,ph,now);progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=now<gameState.invUntil?'💥 碰撞恢复中':`跑酷加速 ×${mult.toFixed(2)}`;}
function drawRunner(obs,px,py,pw,ph,now){const cv=$('runnerCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);const grad=ctx.createLinearGradient(0,0,0,500);grad.addColorStop(0,'#0c1830');grad.addColorStop(1,'#09101c');ctx.fillStyle=grad;ctx.fillRect(0,0,760,500);ctx.fillStyle='#1f2b3a';ctx.fillRect(0,448,760,52);ctx.fillStyle=now<gameState.invUntil?'#ff778b':'#61e6a9';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#0a121d';ctx.fillRect(px+23,py+9,6,6);for(const o of obs){ctx.fillStyle='#ffb05f';ctx.fillRect(o.x,448-o.h,o.w,o.h);}ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='14px sans-serif';ctx.fillText('SPACE / 点击跳跃',18,28);}

// ---------- Plane shooter ----------
function initPlane(){gameState={x:380,enemies:[],bullets:[],spawnAcc:0,shotAcc:0,kills:0};}
function mountPlane(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap"><canvas class="game-canvas" id="planeCanvas" width="760" height="500"></canvas><div class="info" style="position:absolute;left:12px;top:10px">移动鼠标 / 手指 / ← → 控制飞机 · 自动射击</div></div></div>';const cv=$('planeCanvas');cv.addEventListener('pointermove',e=>{if(!canInteract())return;const r=cv.getBoundingClientRect();gameState.x=clamp((e.clientX-r.left)*760/r.width,28,732);});cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect();gameState.x=clamp((e.clientX-r.left)*760/r.width,28,732);});}
function planeCfg(){const d=series().difficulty;return{spawn:{easy:.95,medium:.72,hard:.52,hell:.37}[d],enemy:{easy:105,medium:135,hard:170,hell:210}[d]};}
function renderPlane(now,dt){const cfg=planeCfg(),rush=effects.rushUntil>now?1.8:1;gameState.spawnAcc+=dt*rush;while(gameState.spawnAcc>cfg.spawn){gameState.spawnAcc-=cfg.spawn;gameState.enemies.push({x:30+Math.random()*700,y:-20,v:cfg.enemy*(.8+Math.random()*.5),hp:1});}gameState.shotAcc+=dt;if(effects.jamUntil<=now&&gameState.shotAcc>.22){gameState.shotAcc=0;gameState.bullets.push({x:gameState.x,y:430});}for(const b of gameState.bullets)b.y-=430*dt;for(const e of gameState.enemies)e.y+=e.v*dt;for(const b of gameState.bullets)for(const e of gameState.enemies)if(e.hp>0&&Math.abs(b.x-e.x)<22&&Math.abs(b.y-e.y)<22){e.hp=0;b.y=-99;gameState.kills++;addScore(65,'击落敌机 +65');}gameState.bullets=gameState.bullets.filter(b=>b.y>-30);gameState.enemies=gameState.enemies.filter(e=>e.hp>0&&e.y<540);drawPlane(now);progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status=effects.jamUntil>now?'📡 武器受干扰':`击落 ${gameState.kills}`;}
function drawPlane(now){const cv=$('planeCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);ctx.fillStyle='#07101d';ctx.fillRect(0,0,760,500);for(let i=0;i<35;i++){ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect((i*97)%760,(i*53+Math.floor(now/25))%500,1.5,1.5);}ctx.fillStyle='#5ce4ff';ctx.beginPath();ctx.moveTo(gameState.x,440);ctx.lineTo(gameState.x-22,478);ctx.lineTo(gameState.x,470);ctx.lineTo(gameState.x+22,478);ctx.closePath();ctx.fill();ctx.fillStyle='#ffd16a';for(const b of gameState.bullets)ctx.fillRect(b.x-2,b.y,4,12);for(const e of gameState.enemies){ctx.fillStyle='#ff748a';ctx.beginPath();ctx.moveTo(e.x,e.y+22);ctx.lineTo(e.x-20,e.y-12);ctx.lineTo(e.x,e.y-5);ctx.lineTo(e.x+20,e.y-12);ctx.closePath();ctx.fill();}}

// ---------- Tug ----------
function mountTug(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="tug"><div class="info">疯狂点击 / 按空格，把绳结拉向自己</div><div class="rope"><div class="rope-dot" id="ropeDot"></div></div><button class="tug-btn" id="tugBtn">🪢 PULL!</button><div class="info" id="tugInfo">每次 +10</div></div></div>';$('tugBtn').addEventListener('click',hitTug);}
function hitTug(){if(!canInteract())return;addScore(10,'持续发力');}
function renderTug(){const op=Number(opponent()?.score||0),diff=clamp((score-op)/1000,-.45,.45);$('ropeDot').style.left=`${50+diff*100}%`;$('tugInfo').textContent=soloMode?`当前 ${score} · 继续冲高分`:`你 ${score} · 对手 ${op}`;progress=soloMode?clamp(score/1000*100,0,100):clamp(50+diff*100,0,100);status=soloMode?'极速手速训练':'极速拔河';}

// ---------- Rhythm tug ----------
function initTugRhythm(){gameState={lastHit:0,combo:0};}
function mountTugRhythm(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="tug rhythm-tug"><div class="info">等光标进入发光区域再点击 / 按空格</div><div class="rhythm-track"><div class="rhythm-zone" id="rhythmZone"></div><div class="rhythm-marker" id="rhythmMarker"></div></div><button class="tug-btn" id="rhythmBtn">🎵 HIT</button><div class="info" id="rhythmInfo">PERFECT +35 · GOOD +20 · MISS -12</div></div></div>`;$('rhythmBtn').addEventListener('click',hitTugRhythm);}
function tugRhythmState(now){const d=series().difficulty,base={easy:.85,medium:1.05,hard:1.3,hell:1.62}[d]*(effects.speedUntil>now?1.45:1),t=(now-series().startAt)/1000,marker=50+46*Math.sin(t*base*TAU),cycle=Math.floor(t/4),center=20+randInt(`${roundId}:rhythm:${cycle}`,0,60),width={easy:24,medium:19,hard:15,hell:11}[d];return{marker,center,width};}
function renderTugRhythm(now){const x=tugRhythmState(now);$('rhythmMarker').style.left=`${x.marker}%`;$('rhythmZone').style.left=`${x.center-x.width/2}%`;$('rhythmZone').style.width=`${x.width}%`;const op=Number(opponent()?.score||0),diff=clamp((score-op)/1000,-.45,.45);progress=clamp(50+diff*100,0,100);status=`节奏拔河 · Combo ${gameState.combo||0}`;}
function hitTugRhythm(){if(!canInteract())return;const now=serverNow();if(now-(gameState.lastHit||0)<160)return;gameState.lastHit=now;const x=tugRhythmState(now),dist=Math.abs(x.marker-x.center),half=x.width/2;if(dist<=half*.38){gameState.combo=(gameState.combo||0)+1;addScore(35,'PERFECT +35');}else if(dist<=half){gameState.combo=(gameState.combo||0)+1;addScore(20,'GOOD +20');}else{gameState.combo=0;addScore(-12,'MISS -12');}}

// ---------- Vertical duel shooter ----------
function initDuelShooter(){gameState={duelY:.5,lastMoveSync:0,lastFire:0,resolved:new Set()};}
async function ensureDuelShared(){await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'duelShooter',players:{p1:{y:.5},p2:{y:.5}},shots:{},createdAt:serverNow()});}
function mountDuelShooter(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="duel-wrap"><div class="info">上下移动躲子弹 · 点击 FIRE / 空格射击 · 命中 +150</div><canvas id="duelCanvas" class="game-canvas duel-canvas" width="760" height="480"></canvas><div class="duel-controls"><button id="duelUp">↑</button><button class="duel-fire" id="duelFire">FIRE</button><button id="duelDown">↓</button></div></div></div>`;const cv=$('duelCanvas');cv.addEventListener('pointermove',e=>{if(!canInteract())return;const r=cv.getBoundingClientRect();setDuelY(clamp((e.clientY-r.top)/r.height,.08,.92));});$('duelUp').addEventListener('click',()=>setDuelY(gameState.duelY-.09));$('duelDown').addEventListener('click',()=>setDuelY(gameState.duelY+.09));$('duelFire').addEventListener('click',fireDuel);ensureDuelShared();}
function setDuelY(y){gameState.duelY=clamp(y,.08,.92);const now=Date.now();if(now-(gameState.lastMoveSync||0)>70){gameState.lastMoveSync=now;update(ref(db,`rooms/${roomCode}/shared/players/${mySlot}`),{y:gameState.duelY}).catch(()=>{});}}
async function fireDuel(){if(!canInteract()||effects.jamUntil>serverNow())return;const now=serverNow();if(now-(gameState.lastFire||0)<520)return;gameState.lastFire=now;const shotRef=push(ref(db,`rooms/${roomCode}/shared/shots`));await set(shotRef,{owner:mySlot,y:gameState.duelY,at:serverTimestamp(),resolved:false});}
function renderDuelShooter(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='duelShooter'){ensureDuelShared();return;}const cv=$('duelCanvas');if(!cv)return;const ctx=cv.getContext('2d'),p1y=Number(sh.players?.p1?.y??.5),p2y=Number(sh.players?.p2?.y??.5),mineY=mySlot==='p1'?p1y:p2y;gameState.duelY=mineY;ctx.clearRect(0,0,760,480);const bg=ctx.createLinearGradient(0,0,760,0);bg.addColorStop(0,'#08192a');bg.addColorStop(.5,'#080b14');bg.addColorStop(1,'#211025');ctx.fillStyle=bg;ctx.fillRect(0,0,760,480);ctx.strokeStyle='rgba(255,255,255,.08)';ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(380,20);ctx.lineTo(380,460);ctx.stroke();ctx.setLineDash([]);
  const drawPlayer=(slot,y)=>{const x=slot==='p1'?70:690,py=y*480;ctx.fillStyle=slot==='p1'?'#57e7ff':'#ff7ac8';ctx.beginPath();ctx.roundRect(x-22,py-32,44,64,13);ctx.fill();ctx.fillStyle='#07101b';ctx.beginPath();ctx.arc(x+(slot==='p1'?10:-10),py-8,4,0,TAU);ctx.fill();};drawPlayer('p1',p1y);drawPlayer('p2',p2y);
  const shots=Object.entries(sh.shots||{}),flight=900;for(const [key,b] of shots){const age=now-Number(b.at||now);if(age<0||age>1250)continue;const t=clamp(age/flight,0,1),sx=b.owner==='p1'?95:665,ex=b.owner==='p1'?665:95,x=sx+(ex-sx)*t,y=Number(b.y||.5)*480;ctx.fillStyle=b.owner==='p1'?'#aef6ff':'#ffd0e9';ctx.shadowBlur=16;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(x,y,7,0,TAU);ctx.fill();ctx.shadowBlur=0;if(b.owner===mySlot&&age>=flight&&!b.resolved&&!gameState.resolved.has(key)){gameState.resolved.add(key);const targetY=Number(sh.players?.[otherSlot()]?.y??.5);const hit=Math.abs(Number(b.y||.5)-targetY)<.09;update(ref(db,`rooms/${roomCode}/shared/shots/${key}`),{resolved:true,hit}).catch(()=>{});if(hit)addScore(150,'命中对手 +150');}}
  progress=clamp(score/(Math.max(1,score+Number(opponent()?.score||0)))*100,0,100);status=effects.jamUntil>now?'📡 武器被干扰':'上下射击对战';}

// ---------- Shared stack tower ----------
function stackCfg(){const d=series().difficulty;return{speed:{easy:.34,medium:.45,hard:.59,hell:.76}[d],startW:{easy:.62,medium:.58,hard:.54,hell:.50}[d]};}
function initStackTower(){gameState={};}
async function ensureStackShared(){const cfg=stackCfg();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'stackTower',blocks:[{x:.5-cfg.startW/2,w:cfg.startW,owner:'base'}],turn:(Number(series().roundIndex||0)%2===0?'p1':'p2'),moveNo:0,moveAt:serverNow(),winner:null,loser:null});}
function stackMovingX(sh,now){const cfg=stackCfg(),w=arrVal(sh.blocks).at(-1)?.w||cfg.startW,t=Math.max(0,(now-Number(sh.moveAt||now))/1000),phase=random01(`${roundId}:stack:${Number(sh.moveNo||0)}`)*2;return tri01(phase+t*cfg.speed)*Math.max(.02,1-w);}
function mountStackTower(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="stack-wrap"><div class="info" id="stackInfo">等待积木塔初始化…</div><canvas id="stackCanvas" class="game-canvas stack-canvas" width="700" height="500"></canvas><button id="stackDrop" class="needle-fire">🧊 落 下</button><div class="needle-tip">轮流落块；只保留与上一层重叠的部分。完全没搭住 = 立即输。</div></div></div>`;$('stackDrop').addEventListener('click',dropStackBlock);$('stackCanvas').addEventListener('pointerdown',dropStackBlock);ensureStackShared();}
async function dropStackBlock(){if(!canInteract())return;const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='stackTower'||sh.winner||sh.turn!==mySlot)return;const now=serverNow();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='stackTower'||cur.winner||cur.turn!==mySlot)return;const blocks=arrVal(cur.blocks),top=blocks[blocks.length-1],w=Number(top.w),x=stackMovingX(cur,now),left=Math.max(x,Number(top.x)),right=Math.min(x+w,Number(top.x)+w),overlap=right-left;if(overlap<=.012)return{...cur,winner:otherSlot(),loser:mySlot,failedX:x};const next={x:left,w:overlap,owner:mySlot};return{...cur,blocks:[...blocks,next],turn:otherSlot(),moveNo:Number(cur.moveNo||0)+1,moveAt:serverNow()};});}
function renderStackTower(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='stackTower'){ensureStackShared();return;}const cv=$('stackCanvas');if(!cv)return;const ctx=cv.getContext('2d'),blocks=arrVal(sh.blocks),W=700,H=500,blockH=28,visible=14,start=Math.max(0,blocks.length-visible),baseY=H-40;ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#11152a');bg.addColorStop(1,'#070b13');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);for(let i=start;i<blocks.length;i++){const b=blocks[i],y=baseY-(i-start)*blockH,x=45+Number(b.x)*610,w=Number(b.w)*610;ctx.fillStyle=b.owner==='p1'?'#57e7ff':b.owner==='p2'?'#ff7ac8':'#59647e';ctx.fillRect(x,y,w,blockH-3);}if(!sh.winner){const top=blocks[blocks.length-1],x=45+stackMovingX(sh,now)*610,w=Number(top.w)*610,y=baseY-(blocks.length-start)*blockH;ctx.fillStyle=sh.turn==='p1'?'rgba(87,231,255,.82)':'rgba(255,122,200,.82)';ctx.fillRect(x,y,w,blockH-3);}const drop=$('stackDrop');if(drop){drop.disabled=!!sh.winner||sh.turn!==mySlot;drop.classList.toggle('your-turn',!drop.disabled);}if(sh.winner){score=sh.winner===mySlot?1000:0;progress=sh.winner===mySlot?100:0;status=sh.winner===mySlot?'对手没叠上':'积木掉落';$('stackInfo').textContent=sh.winner===mySlot?'🏆 对手没有搭住，你赢了！':'💥 没搭住，本局失败';scheduleSync(true);}else{score=blocks.filter(b=>b.owner===mySlot).length*100;progress=clamp(blocks.length/18*100,0,95);status=sh.turn===mySlot?'轮到你落块':'等待对手';$('stackInfo').textContent=sh.turn===mySlot?'轮到你 · 看准重叠区域再落':'等待对手落块';}}

// ---------- Gomoku ----------
function gomokuSize(){return series().difficulty==='easy'?13:15;}
function mountGomoku(){const n=gomokuSize();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap"><div class="info" id="gomokuInfo">等待棋局初始化…</div><div class="gomoku" id="gomokuBoard" style="grid-template-columns:repeat(${n},1fr)"></div></div></div>`;for(let i=0;i<n*n;i++){const b=document.createElement('button');b.className='gcell';b.dataset.i=i;b.addEventListener('click',()=>gomokuMove(i));$('gomokuBoard').appendChild(b);}ensureGomokuShared();}
async function ensureGomokuShared(){if(!isCoordinator())return;const n=gomokuSize();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'gomoku',n,board:'0'.repeat(n*n),turn:'p1',winner:null,lastMoveAt:serverNow()});}
function checkFive(board,n,idx,val){const r=Math.floor(idx/n),c=idx%n,dirs=[[1,0],[0,1],[1,1],[1,-1]];for(const[dR,dC]of dirs){let count=1;for(const s of [-1,1]){let rr=r+dR*s,cc=c+dC*s;while(rr>=0&&rr<n&&cc>=0&&cc<n&&board[rr*n+cc]===val){count++;rr+=dR*s;cc+=dC*s;}}if(count>=5)return true;}return false;}
async function gomokuMove(i){if(!canInteract())return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{const n=gomokuSize();if(!cur||cur.roundId!==roundId||cur.winner||cur.turn!==mySlot)return;const arr=(cur.board||'0'.repeat(n*n)).split('');if(arr[i]!=='0')return;const val=mySlot==='p1'?'1':'2';arr[i]=val;const winner=checkFive(arr,n,i,val)?mySlot:null;return{...cur,board:arr.join(''),turn:winner?cur.turn:otherSlot(),winner,lastMoveAt:serverNow()};});}
function renderGomoku(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId){ensureGomokuShared();return;}const n=sh.n||gomokuSize(),arr=(sh.board||'').split('');[...$('gomokuBoard').children].forEach((b,i)=>{let s=b.querySelector('.stone');if(arr[i]==='1'||arr[i]==='2'){if(!s){s=document.createElement('i');s.className='stone';b.appendChild(s);}s.className=`stone ${arr[i]==='1'?'black':'white'}`;}else s?.remove();});$('gomokuInfo').textContent=sh.winner?`${roomData.players?.[sh.winner]?.name||''} 五子连珠！`:sh.turn===mySlot?'轮到你 · 不限时':'等待对手落子 · 不限时';if(sh.winner){score=sh.winner===mySlot?1000:0;progress=sh.winner===mySlot?100:0;status=sh.winner===mySlot?'五子连珠':'对手五子连珠';scheduleSync(true);}else{score=arr.filter(v=>v===(mySlot==='p1'?'1':'2')).length*10;progress=clamp(score/6,0,90);status=sh.turn===mySlot?'你的回合 · 不限时':'等待对手';}}



// ---------- Needle Gap / 见缝插针 ----------
const TAU=Math.PI*2;
function needleCfg(){
  return {
    easy:{speed:.78,minGap:.255,seeds:4,reverseEvery:0},
    medium:{speed:1.12,minGap:.285,seeds:5,reverseEvery:0},
    hard:{speed:1.62,minGap:.315,seeds:6,reverseEvery:4200},
    hell:{speed:2.18,minGap:.345,seeds:7,reverseEvery:2700}
  }[series().difficulty]||{speed:1.12,minGap:.285,seeds:5,reverseEvery:0};
}
function normAngle(a){a%=TAU;if(a<0)a+=TAU;return a;}
function angleGap(a,b){const d=Math.abs(normAngle(a)-normAngle(b));return Math.min(d,TAU-d);}
function needlePins(sh){return Array.isArray(sh?.pins)?sh.pins:Object.values(sh?.pins||{});}
function needleRotation(now){
  const c=needleCfg(),sr=series(),t=Math.max(0,(now-(sr.startAt||now))/1000),base=random01(`${roundId}:needle:offset`)*TAU;
  if(!c.reverseEvery)return normAngle(base+t*c.speed);
  const period=c.reverseEvery/1000,cycles=Math.floor(t/period),rem=t%period,integrated=(cycles%2?period:0)+(cycles%2?-rem:rem);
  return normAngle(base+integrated*c.speed);
}
function needleStartPins(){
  const c=needleCfg(),offset=random01(`${roundId}:needle:seed`)*TAU;
  return Array.from({length:c.seeds},(_,i)=>({a:normAngle(offset+i*TAU/c.seeds),owner:'seed',n:i}));
}
function mountNeedle(){
  els.gameSurface.innerHTML=`<div class="stage-inner"><div class="needle-wrap"><div class="needle-headline"><b id="needleInfo">正在同步圆盘…</b><span id="needleCount">0 针</span></div><canvas class="game-canvas needle-canvas" id="needleCanvas" width="760" height="440"></canvas><button class="needle-fire" id="needleFire">📍 插 针</button><div class="needle-tip">轮到你时点击圆盘 / 按空格。撞上任意已有针 = 💀 立即出局</div></div></div>`;
  $('needleCanvas').addEventListener('pointerdown',e=>{e.preventDefault();insertNeedle();});
  $('needleFire').addEventListener('click',insertNeedle);
  ensureNeedleShared();
}
async function ensureNeedleShared(){
  const startTurn=(Number(series().roundIndex||0)%2===0)?'p1':'p2';
  await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'needle',pins:needleStartPins(),turn:startTurn,winner:null,loser:null,lastMoveAt:serverNow(),moveNo:0});
}
async function insertNeedle(){
  if(!canInteract())return;
  const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='needle'||sh.winner||sh.turn!==mySlot)return;
  const now=serverNow(),sr=series(),relative=normAngle(Math.PI/2-needleRotation(now));
  gameState.needleFlash=now;
  await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{
    if(!cur||cur.roundId!==roundId||cur.game!=='needle'||cur.winner||cur.turn!==mySlot)return;
    const pins=needlePins(cur),c=needleCfg();
    const hit=pins.some(p=>angleGap(relative,Number(p.a||0))<c.minGap);
    if(hit)return {...cur,winner:otherSlot(),loser:mySlot,deathAngle:relative,deathAt:serverNow(),lastMoveAt:serverNow()};
    return {...cur,pins:[...pins,{a:relative,owner:mySlot,n:Number(cur.moveNo||0)+1}],turn:otherSlot(),moveNo:Number(cur.moveNo||0)+1,lastMoveAt:serverNow(),lastBy:mySlot};
  });
}
function drawNeedleGame(now,sh){
  const canvas=$('needleCanvas');if(!canvas)return;const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,cx=W/2,cy=190,R=82,rot=needleRotation(now),pins=needlePins(sh);
  ctx.clearRect(0,0,W,H);
  // soft arena glow
  const glow=ctx.createRadialGradient(cx,cy,20,cx,cy,220);glow.addColorStop(0,'rgba(87,231,255,.08)');glow.addColorStop(1,'rgba(6,9,18,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
  // pins rotate with the wheel
  for(const p of pins){const a=normAngle(Number(p.a||0)+rot),x1=cx+Math.cos(a)*(R+4),y1=cy+Math.sin(a)*(R+4),x2=cx+Math.cos(a)*(R+70),y2=cy+Math.sin(a)*(R+70);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=4;ctx.lineCap='round';ctx.strokeStyle=p.owner==='p1'?'#57e7ff':p.owner==='p2'?'#ff7ac8':'#727b94';ctx.stroke();ctx.beginPath();ctx.arc(x2,y2,8,0,TAU);ctx.fillStyle=p.owner==='p1'?'#b7f6ff':p.owner==='p2'?'#ffd1eb':'#a1a9bb';ctx.fill();}
  // wheel
  const g=ctx.createRadialGradient(cx-24,cy-30,12,cx,cy,R+10);g.addColorStop(0,'#263556');g.addColorStop(.65,'#151d31');g.addColorStop(1,'#090e19');ctx.beginPath();ctx.arc(cx,cy,R,0,TAU);ctx.fillStyle=g;ctx.fill();ctx.lineWidth=3;ctx.strokeStyle='rgba(255,255,255,.12)';ctx.stroke();
  ctx.fillStyle='#f4f7ff';ctx.textAlign='center';ctx.font='900 31px system-ui';ctx.fillText(String(Math.max(0,28-pins.length)),cx,cy+7);ctx.font='700 11px system-ui';ctx.fillStyle='#8e99b1';ctx.fillText('GAPS LEFT',cx,cy+28);
  // insertion rail at six o'clock
  const entryY=H-42;ctx.beginPath();ctx.moveTo(cx,entryY);ctx.lineTo(cx,cy+R+10);ctx.lineWidth=4;ctx.strokeStyle=sh?.turn===mySlot?'rgba(87,231,255,.78)':'rgba(120,130,155,.3)';ctx.stroke();ctx.beginPath();ctx.arc(cx,entryY,9,0,TAU);ctx.fillStyle=sh?.turn===mySlot?'#57e7ff':'#5b6376';ctx.fill();
  if(sh?.loser){ctx.save();ctx.font='900 58px system-ui';ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillText('💥',cx,cy+18);ctx.restore();}
}
function renderNeedle(now){
  const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='needle'){ensureNeedleShared();return;}
  drawNeedleGame(now,sh);const pins=needlePins(sh),myPins=pins.filter(p=>p.owner===mySlot).length,opPins=pins.filter(p=>p.owner===otherSlot()).length,c=needleCfg();
  const fire=$('needleFire');if(fire){fire.disabled=!!sh.winner||sh.turn!==mySlot||!canInteract();fire.classList.toggle('your-turn',!fire.disabled);fire.textContent=sh.winner?'本局结束':sh.turn===mySlot?'📍 插 针':'等待对手…';}
  if($('needleCount'))$('needleCount').textContent=`${Math.max(0,pins.length-c.seeds)} 次成功`;
  if(sh.winner){
    const won=sh.winner===mySlot;score=won?1000:0;progress=won?100:0;status=won?'对手撞针 · 你存活！':'撞针出局';if($('needleInfo'))$('needleInfo').textContent=won?'🏆 对手撞针，你赢了！':'💀 你撞针了，本局出局';scheduleSync(true);return;
  }
  score=myPins*100;progress=clamp((myPins+opPins)/20*100,0,95);status=sh.turn===mySlot?'轮到你插针 · 不限时':'等待对手插针';
  if($('needleInfo'))$('needleInfo').textContent=sh.turn===mySlot?'轮到你 · 不限时，找准空隙再插':`${roomData.players?.[sh.turn]?.name||'对手'} 的回合 · 不限时`;
}

// ---------- Coordinate Airstrike ----------
function airstrikeCfg(){
  const d=series().difficulty;
  return {
    n:{easy:8,medium:9,hard:10,hell:11}[d],
    planes:{easy:2,medium:3,hard:4,hell:5}[d],
    shape:(d==='easy'||d==='medium')?[[0,0],[-1,0],[1,0],[0,-1],[0,1]]:[[0,0],[-1,0],[1,0]],
    placeMs:15000
  };
}
function initAirstrike(){gameState={airLastPhase:null};}
function arrVal(v){return Array.isArray(v)?v:Object.values(v||{});}
function airCellsForCenter(center,n,shape){const r=Math.floor(center/n),c=center%n,out=[];for(const [dr,dc] of shape){const rr=r+dr,cc=c+dc;if(rr<0||rr>=n||cc<0||cc>=n)return null;out.push(rr*n+cc);}return out;}
function airOccupied(centers,n,shape){const out=new Set();for(const c of arrVal(centers)){const cells=airCellsForCenter(Number(c),n,shape);if(cells)cells.forEach(x=>out.add(x));}return out;}
function airCanPlace(centers,center,cfg){const cells=airCellsForCenter(center,cfg.n,cfg.shape);if(!cells)return false;const used=airOccupied(centers,cfg.n,cfg.shape);return cells.every(x=>!used.has(x));}
function deterministicAirPlacements(slot,cfg,existing=[]){const out=arrVal(existing).map(Number);for(let a=0;a<500&&out.length<cfg.planes;a++){const idx=randInt(`${roundId}:air:auto:${slot}:${a}`,0,cfg.n*cfg.n-1);if(airCanPlace(out,idx,cfg))out.push(idx);}return out;}
async function ensureAirstrikeShared(){
  const cfg=airstrikeCfg();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'airstrike',n:cfg.n,placements:{p1:[],p2:[]},shots:{p1:[],p2:[]},turn:'p1',winner:null,createdAt:serverNow()});
}
function mountAirstrike(){const cfg=airstrikeCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="air-wrap"><div class="air-head"><b id="airInfo">15 秒布置自己的飞机</b><span id="airCount">0 / ${cfg.planes}</span></div><div class="grid-game air-grid" id="airGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div><div class="air-legend" id="airLegend">布阵阶段只展示你自己的飞机；进入轰炸后，不显示中心，也不区分机头和机身。</div></div></div>`;const grid=$('airGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell air-cell';b.dataset.i=i;b.addEventListener('click',()=>airstrikeClick(i));grid.appendChild(b);}ensureAirstrikeShared();}
async function airstrikeClick(i){if(!canInteract())return;const now=serverNow(),sr=series(),cfg=airstrikeCfg(),placing=now<sr.startAt+cfg.placeMs,sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='airstrike'||sh.winner)return;
  if(placing){await runTransaction(ref(db,`rooms/${roomCode}/shared/placements/${mySlot}`),cur=>{const arr=arrVal(cur).map(Number);if(arr.length>=cfg.planes||!airCanPlace(arr,i,cfg))return;return [...arr,i];});return;}
  if(sh.turn!==mySlot)return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='airstrike'||cur.winner||cur.turn!==mySlot)return;const myShots=arrVal(cur.shots?.[mySlot]).map(Number);if(myShots.includes(i))return;const op=otherSlot(),opCenters=arrVal(cur.placements?.[op]).map(Number),target=airOccupied(opCenters,cfg.n,cfg.shape),nextShots=[...myShots,i],hit=target.has(i),allHit=[...target].every(x=>nextShots.includes(x)),shots={...(cur.shots||{}),[mySlot]:nextShots};return {...cur,shots,turn:allHit?cur.turn:op,winner:allHit?mySlot:null,lastShot:{by:mySlot,i,hit,at:serverNow()}};});
}
async function autoFillAirstrikeIfNeeded(){const cfg=airstrikeCfg();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='airstrike')return;let changed=false,placements={...(cur.placements||{})};for(const slot of ['p1','p2']){const arr=arrVal(placements[slot]).map(Number);if(arr.length<cfg.planes){placements[slot]=deterministicAirPlacements(slot,cfg,arr);changed=true;}}return changed?{...cur,placements}:cur;});}
function renderAirstrike(now){const sr=series(),cfg=airstrikeCfg(),sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='airstrike'){ensureAirstrikeShared();return;}const placing=now<sr.startAt+cfg.placeMs;if(!placing&&(arrVal(sh.placements?.p1).length<cfg.planes||arrVal(sh.placements?.p2).length<cfg.planes))autoFillAirstrikeIfNeeded().catch(()=>{});const grid=$('airGrid');if(!grid)return;const ownCenters=arrVal(sh.placements?.[mySlot]).map(Number),ownCells=airOccupied(ownCenters,cfg.n,cfg.shape),myShots=arrVal(sh.shots?.[mySlot]).map(Number),opCenters=arrVal(sh.placements?.[otherSlot()]).map(Number),opCells=airOccupied(opCenters,cfg.n,cfg.shape);[...grid.children].forEach((b,i)=>{b.className='grid-cell air-cell';b.textContent='';if(placing&&ownCells.has(i)){b.classList.add('air-own');b.textContent='✈';}if(!placing&&myShots.includes(i)){if(opCells.has(i)){b.classList.add('correct');b.textContent='💥';}else{b.classList.add('air-miss');b.textContent='·';}}});
  if(placing){const remain=Math.ceil((sr.startAt+cfg.placeMs-now)/1000);$('airInfo').textContent=`🛩️ 布阵 ${remain}s · 点击空白区域放飞机`;$('airCount').textContent=`${ownCenters.length} / ${cfg.planes}`;status=`布阵 ${ownCenters.length}/${cfg.planes}`;progress=clamp(ownCenters.length/cfg.planes*100,0,100);return;}
  const hits=myShots.filter(x=>opCells.has(x)).length,total=opCells.size;$('airCount').textContent=`命中 ${hits}/${total}`;$('airInfo').textContent=sh.winner?(sh.winner===mySlot?'🏆 对方飞机全部击落':'💥 你的飞机已被全部击落'):sh.turn===mySlot?'🎯 轮到你轰炸 · 不会提示飞机中心':`等待 ${opponent()?.name||'对手'} 轰炸`;score=hits*100;progress=total?clamp(hits/total*100,0,100):0;status=sh.turn===mySlot?'你的轰炸回合':'等待对手';if(sh.winner){score=sh.winner===mySlot?1000:score;progress=sh.winner===mySlot?100:progress;scheduleSync(true);}
}

// ---------- in-match exit / forfeit ----------
function openExitModal(){
  const sr=series();
  if(soloMode){
    els.exitContext.textContent='单人训练可以随时结束，不会影响任何双人房间或战绩。';
    els.forfeitRoundBtn.style.display='none';
    els.endSeriesBtn.style.display='flex';
    els.endSeriesBtn.textContent='结束训练 · 回到单人设置';
    els.leaveRoomNowBtn.textContent='结束训练 · 回到首页';
    els.exitModal.classList.add('show');return;
  }
  if(!roomCode)return;
  els.endSeriesBtn.textContent='结束系列赛 · 回到大厅';els.leaveRoomNowBtn.textContent='离开房间 · 稍后再回来';
  els.exitContext.textContent=sr.status==='round'?`第 ${(sr.roundIndex||0)+1}/${sr.totalRounds||settings().rounds} 局进行中。你可以只认输本局，也可以结束整套系列赛；长期房间不会被删除。`:'你可以回到大厅或暂时离开，长期房间和房间码都会保留。';
  els.forfeitRoundBtn.style.display=sr.status==='round'?'flex':'none';
  els.endSeriesBtn.style.display=sr.status!=='lobby'?'flex':'none';
  els.exitModal.classList.add('show');
}
function closeExitModal(){els.exitModal.classList.remove('show');}
async function forfeitCurrentRound(){
  const sr=series();if(!roomCode||sr.status!=='round')return closeExitModal();
  closeExitModal();
  try{
    await flushPlayerState();
    const op=otherSlot(),mineScore=Math.max(0,Number(score||0)),opScore=Math.max(0,Number(opponent()?.score||0));
    const result={index:sr.roundIndex,game:activeGame,p1:mySlot==='p1'?mineScore:opScore,p2:mySlot==='p2'?mineScore:opScore,winner:op,forfeit:mySlot,finishedAt:serverNow()};
    await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>{
      if(!cur||cur.status!=='round'||cur.roundId!==sr.roundId)return;
      const arr=Array.isArray(cur.roundResults)?[...cur.roundResults]:Object.values(cur.roundResults||{}),wins={p1:Number(cur.wins?.p1||0),p2:Number(cur.wins?.p2||0)};
      arr[cur.roundIndex]=result;wins[op]++;return {...cur,status:'round_result',roundResults:arr,wins,roundResult:result,resultAt:serverNow()};
    });
    await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{status:'本局认输',score:mineScore,progress});
  }catch(e){console.error(e);addFeed(`退出失败：${friendlyError(e)}`);}
}
async function endSeriesToLobby(){if(soloMode){closeExitModal();stopRenderLoop();soloSession=null;roundMounted=false;localPhase='idle';document.getElementById('gameScreen')?.classList.remove('solo-playing');showScreen('soloLobbyScreen');renderSoloSettings();renderSoloGameLibrary();return;}closeExitModal();await cancelSeries();}
async function leaveRoomNow(){
  if(soloMode){leaveSoloToHome();return;}
  closeExitModal();
  try{if(roomCode&&series().status!=='lobby')await cancelSeries();}catch(e){console.error(e);}
  await leaveRoom(true);
}

// ---------- history ----------
async function openHistory(){
  if(!roomData?.players?.p1||!roomData?.players?.p2){els.historyDrawer.classList.add('show');els.historyTitle.textContent='历史战绩';els.historyList.innerHTML='<div class="empty">等朋友加入后，这里会显示你们两个人的长期战绩。</div>';return;}
  els.historyDrawer.classList.add('show');els.historyTitle.textContent=`${roomData.players.p1.name} × ${roomData.players.p2.name}`;els.historyList.innerHTML='<div class="empty">正在读取历史记录…</div>';
  try{const snap=await get(ref(db,`pairHistory/${pairKey()}`)),data=snap.val()||{},list=Object.values(data).sort((a,b)=>Number(b.finishedAt||0)-Number(a.finishedAt||0));if(!list.length){els.historyList.innerHTML='<div class="empty">还没有完成过系列赛。第一场战绩会自动保存在这里 ✨</div>';return;}els.historyList.innerHTML='';for(const h of list){const mineName=me()?.name,asP1=keyName(h.p1)===keyName(mineName),mine=asP1?Number(h.wins?.p1||0):Number(h.wins?.p2||0),op=asP1?Number(h.wins?.p2||0):Number(h.wins?.p1||0),won=mine>op,draw=mine===op,icons=(Array.isArray(h.playlist)?h.playlist:Object.values(h.playlist||{})).slice(0,5).map(x=>GAMES[x]?.icon||'🎮').join(' '),d=document.createElement('div');d.className='history-item';d.innerHTML=`<div class="hist-icon">${draw?'🤝':won?'🏆':'🫠'}</div><div><div class="hist-title">${h.totalRounds} 局 · ${DIFFS[h.difficulty]?.name||''} · ${h.durationSec}s/局</div><div class="hist-sub">${icons} · ${new Date(Number(h.finishedAt||Date.now())).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div></div><div class="hist-score">${mine}:${op}</div>`;els.historyList.appendChild(d);}}
  catch(e){els.historyList.innerHTML=`<div class="empty">读取失败：${friendlyError(e)}</div>`;}
}

// ---------- bindings ----------
function bind(){
  els.soloBtn.addEventListener('click',openSoloLobby);els.soloBackHomeBtn.addEventListener('click',leaveSoloToHome);els.soloStartBtn.addEventListener('click',startSoloTraining);els.soloReplayBtn.addEventListener('click',startSoloTraining);els.soloSettingsBtn.addEventListener('click',openSoloLobby);els.soloResultHomeBtn.addEventListener('click',leaveSoloToHome);
  els.createBtn.addEventListener('click',createRoom);els.joinBtn.addEventListener('click',()=>joinRoom());els.readyBtn.addEventListener('click',toggleReady);els.cancelSeriesBtn.addEventListener('click',cancelSeries);els.leaveBtn.addEventListener('click',()=>leaveRoom(true));els.resultLeaveBtn.addEventListener('click',()=>leaveRoom(true));els.backLobbyBtn.addEventListener('click',backToLobby);
  els.gameExitBtn.addEventListener('click',openExitModal);els.resumeGameBtn.addEventListener('click',closeExitModal);els.forfeitRoundBtn.addEventListener('click',forfeitCurrentRound);els.endSeriesBtn.addEventListener('click',endSeriesToLobby);els.leaveRoomNowBtn.addEventListener('click',leaveRoomNow);els.exitModal.addEventListener('click',e=>{if(e.target===els.exitModal)closeExitModal();});
  els.copyRoomBtn.addEventListener('click',async()=>{const url=`${location.origin}${location.pathname}?room=${roomCode}`;try{await navigator.clipboard.writeText(`${url}\n房间码：${roomCode}`);els.roomHint.textContent='邀请链接 + 房间码已复制';setTimeout(()=>els.roomHint.textContent='房间会保留，之后可以继续用同一个房间码回来',1700);}catch{els.roomHint.textContent=`房间码：${roomCode}`;}});
  els.historyBtn.addEventListener('click',openHistory);els.resultHistoryBtn.addEventListener('click',openHistory);els.closeHistoryBtn.addEventListener('click',()=>els.historyDrawer.classList.remove('show'));els.historyDrawer.addEventListener('click',e=>{if(e.target===els.historyDrawer)els.historyDrawer.classList.remove('show');});
  els.continueBtn.addEventListener('click',()=>{const name=localStorage.getItem('duopk_nickname'),code=localStorage.getItem('duopk_lastRoom');if(name)els.nickname.value=name;if(code)joinRoom(code);});
  els.roomInput.addEventListener('input',()=>els.roomInput.value=els.roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>updateSetting({mode:b.dataset.mode})));
  document.querySelectorAll('[data-rounds]').forEach(b=>b.addEventListener('click',()=>updateSetting({rounds:Number(b.dataset.rounds)})));
  document.querySelectorAll('[data-diff]').forEach(b=>b.addEventListener('click',()=>updateSetting({difficulty:b.dataset.diff})));
  els.durationRange.addEventListener('input',()=>{els.durationLabel.textContent=`${els.durationRange.value} 秒`;els.durationBox.textContent=`${els.durationRange.value}s`;});els.durationRange.addEventListener('change',()=>updateSetting({durationSec:Number(els.durationRange.value)}));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderGameLibrary();}));
  document.querySelectorAll('[data-solo-diff]').forEach(b=>b.addEventListener('click',()=>{soloSettings.difficulty=b.dataset.soloDiff;renderSoloSettings();renderSoloGameLibrary();}));
  els.soloDurationRange.addEventListener('input',()=>{soloSettings.durationSec=Number(els.soloDurationRange.value);renderSoloSettings();});
  document.querySelectorAll('[data-solo-filter]').forEach(b=>b.addEventListener('click',()=>{soloFilter=b.dataset.soloFilter;document.querySelectorAll('[data-solo-filter]').forEach(x=>x.classList.toggle('active',x===b));renderSoloGameLibrary();}));
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(els.exitModal.classList.contains('show'))closeExitModal();else if((soloMode&&series().status==='round')||(roomCode&&series().status!=='lobby'))openExitModal();return;}
    if(localPhase!=='playing')return;const k=e.key.toLowerCase();if(activeGame==='2048'){const m={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down'}[k];if(m){e.preventDefault();move2048(m);}}
    else if(activeGame==='tetris'){if(k==='arrowleft'||k==='a')tetrisMove(-1);else if(k==='arrowright'||k==='d')tetrisMove(1);else if(k==='arrowup'||k==='w')tetrisRotate();else if(k==='arrowdown'||k==='s')tetrisDrop();}
    else if(activeGame==='runner'&&(k===' '||k==='arrowup'||k==='w')){e.preventDefault();runnerJump();}
    else if(activeGame==='plane'){if(k==='arrowleft'||k==='a')gameState.x=clamp(gameState.x-30,28,732);else if(k==='arrowright'||k==='d')gameState.x=clamp(gameState.x+30,28,732);}
    else if(activeGame==='tug'&&(k===' '||k==='enter')){e.preventDefault();hitTug();}
    else if(activeGame==='tugRhythm'&&(k===' '||k==='enter')){e.preventDefault();hitTugRhythm();}
    else if(activeGame==='duelShooter'){if(k==='arrowup'||k==='w'){e.preventDefault();setDuelY(gameState.duelY-.07);}else if(k==='arrowdown'||k==='s'){e.preventDefault();setDuelY(gameState.duelY+.07);}else if(k===' '||k==='enter'){e.preventDefault();fireDuel();}}
    else if(activeGame==='stackTower'&&(k===' '||k==='enter')){e.preventDefault();dropStackBlock();}
    else if(activeGame==='needle'&&(k===' '||k==='enter')){e.preventDefault();insertNeedle();}
  });
}

window.addEventListener('error',e=>{
  console.error('DUO PK runtime error:',e.error||e.message);
  if(els?.netText && !firebaseReady) els.netText.textContent='脚本运行失败';
  if(els?.homeError) showError(`页面脚本错误：${e.message||'未知错误'}`);
});
window.addEventListener('unhandledrejection',e=>{
  console.error('DUO PK unhandled rejection:',e.reason);
  if(els?.homeError) showError(`网络/脚本错误：${friendlyError(e.reason)}`);
});

bind();renderGameLibrary();renderSoloSettings();renderSoloGameLibrary();
const savedName=localStorage.getItem('duopk_nickname');if(savedName)els.nickname.value=savedName;
els.netText.textContent='初始化中…';
initFirebase().then(()=>{
  const q=new URLSearchParams(location.search),code=q.get('room')?.toUpperCase();
  if(code)els.roomInput.value=code;
  if(code&&savedName)setTimeout(()=>{if(!soloMode)joinRoom(code);},250);
}).catch(e=>{
  console.error(e);
  firebaseReady=false;
  els.createBtn.disabled=false; els.joinBtn.disabled=false;
  els.netDot.classList.remove('online');
  els.netText.textContent='Firebase 连接失败';
  showError(`Firebase 连接失败：${friendlyError(e)}`);
});
