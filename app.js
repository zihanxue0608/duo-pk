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
  ,connect4:{name:'四子棋',icon:'🔴',category:'board',desc:'轮流向七列落子，率先横、竖或斜向连成四枚获胜。',skills:[]}
  ,reversi:{name:'翻转棋',icon:'⚪',category:'board',desc:'轻量 6×6 黑白棋，占据更多棋格的一方获胜。',skills:[]}
  ,climber:{name:'左右爬楼',icon:'🧗',category:'arcade',desc:'左右移动、逐层向上，避开落石与破损平台。',skills:[['obstacle',650],['blind',1100],['shield',850]]}
  ,racer:{name:'迷你赛车',icon:'🏎️',category:'arcade',desc:'三车道竞速，左右变道躲开车辆和路障。',skills:[['obstacle',600],['speed',1100],['shield',850]]}
  ,fighter:{name:'像素格斗',icon:'🥊',category:'board',desc:'左右移动、防御、轻拳和重拳；先把对方生命值打空。',skills:[]}
  ,drum:{name:'架子鼓节奏',icon:'🥁',category:'reaction',desc:'音符落到判定线时按对应键，4–6 轨随难度增加。',skills:[['speed',900],['blind',1300],['shield',900]]}
  ,digitMemory:{name:'数字记忆',icon:'🔐',category:'brain',desc:'逐个展示一串数字，随后完整输入；连续答对会逐渐加长。',skills:[['blind',800],['freeze',1200],['shield',900]]}
  ,dotCount:{name:'小球计数',icon:'🟢',category:'brain',desc:'屏幕随机闪现不同数量小球，凭观察输入数量。',skills:[['blind',750],['shield',950]]}
  ,numberErase:{name:'数字划消',icon:'🔎',category:'brain',desc:'在数字墙中快速找出并划掉所有指定数字。',skills:[['blind',750],['shuffle',1100],['shield',900]]}
  ,numberLink:{name:'数字连线',icon:'🧵',category:'brain',desc:'在彩色圆点中按数字顺序快速连接目标。',skills:[['blind',800],['shuffle',1200],['shield',900]]}
  ,klotski:{name:'经典华容道',icon:'🧩',category:'brain',desc:'移动曹操、关羽与将士，让曹操从底部出口脱身。',skills:[['blind',1000],['shield',1200]]}
  ,sudoku:{name:'数独',icon:'✏️',category:'brain',desc:'单人 9×9 数独，选择空格后用数字键填写。',skills:[]}
};
const GAME_IDS = Object.keys(GAMES);
const SOLO_GAME_IDS = ['reaction','number','schulte','schulteDynamic','color','falling','memory','memorySequence','tracking','2048','tetris','runner','plane','tug','tugRhythm','climber','racer','drum','digitMemory','dotCount','numberErase','numberLink','klotski','sudoku'];
const GAME_DEFAULTS = Object.fromEntries(GAME_IDS.map(id=>[id,{difficulty:'medium',durationSec:45,inheritDuration:true,timed:!['needle','gomoku','stackTower','airstrike','connect4','reversi','fighter'].includes(id)}]));
Object.assign(GAME_DEFAULTS['2048'],{timed:true});
Object.assign(GAME_DEFAULTS.tracking,{collisions:true});
Object.assign(GAME_DEFAULTS.runner,{doubleJump:true,crouch:true,variableGaps:true});
Object.assign(GAME_DEFAULTS.runner,{lives:3});
Object.assign(GAME_DEFAULTS.plane,{lives:3});
Object.assign(GAME_DEFAULTS.schulte,{variant:'static',size:5});
Object.assign(GAME_DEFAULTS.needle,{speedScale:.78});
Object.assign(GAME_DEFAULTS.tugRhythm,{speedScale:.72});
const DEFAULT_SETTINGS = {mode:'same',rounds:5,difficulty:'medium',durationSec:45,sameGame:'reaction',randomPool:['reaction','number','schulteDynamic','color','falling','memorySequence','tracking','runner','tugRhythm','connect4','climber','racer'],gameSettings:GAME_DEFAULTS};

const els = Object.fromEntries([
  'nickname','roomInput','createBtn','joinBtn','soloBtn','homeError','continueCard','continueTitle','continueSub','continueBtn','netDot','netText','themeBtn',
  'soloBackHomeBtn','soloDifficultySeg','soloDurationRange','soloDurationLabel','soloDurationBox','soloGameGrid','soloFilterBar','soloSelectedText','soloBestText','soloStartBtn',
  'roomCodeText','roomHint','copyRoomBtn','historyBtn','leaveBtn','p1Card','p2Card','p1Name','p2Name','p1State','p2State',
  'modeSeg','roundSeg','difficultySeg','difficultyHint','durationRange','durationLabel','durationBox','seriesPreviewTitle','seriesPreviewSub',
  'readyBtn','cancelSeriesBtn','lobbyNote','gameGrid','pickerNote','filterBar','settingOwner',
  'myScoreName','opScoreName','myScore','opScore','timer','roundLabel','roundDots','gameModeTitle','gameHint','difficultyBadge','gameExitBtn','gameStage','gameSurface',
  'effectLayer','effectMsg','gameOverlay','overlayBig','overlaySmall','skills','opGenericScore','opGenericStatus','opProgress','feed',
  'historyDrawer','historyTitle','historyList','closeHistoryBtn','roundResult','roundEmoji','roundResultTitle','roundResultScore','nextGameText',
  'soloResultEmoji','soloResultTitle','soloResultScore','soloResultMeta','soloResultBest','soloReplayBtn','soloSettingsBtn','soloResultHomeBtn',
  'seriesEmoji','seriesTitle','seriesFinal','seriesCaption','roundHistory','backLobbyBtn','resultHistoryBtn','resultLeaveBtn',
  'exitModal','exitContext','resumeGameBtn','forfeitRoundBtn','endSeriesBtn','leaveRoomNowBtn',
  'gameSettingsModal','gameSettingsTitle','gameSettingsCopy','gameSettingsForm','resetGameSettingsBtn','closeGameSettingsBtn','saveGameSettingsBtn'
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
let editingGameId=null;

function showScreen(id){ screens.forEach(s=>$(s).classList.toggle('active',s===id)); }
function normalizeName(v=els.nickname.value){ return v.trim().replace(/[.#$\[\]/]/g,'').slice(0,12); }
function keyName(v){ return normalizeName(v).trim().toLowerCase().replace(/\s+/g,'_') || 'player'; }
function pairKey(){ const a=keyName(roomData?.players?.p1?.name||'p1'),b=keyName(roomData?.players?.p2?.name||'p2'); return [a,b].sort().join('__'); }
function serverNow(){ return Date.now()+serverOffset; }
function otherSlot(){ return mySlot==='p1'?'p2':'p1'; }
function me(){ if(soloMode)return {name:normalizeName()||localStorage.getItem('duopk_nickname')||'PLAYER',online:true}; return roomData?.players?.[mySlot]||null; }
function opponent(){ if(soloMode)return null; return roomData?.players?.[otherSlot()]||null; }
function settings(){ if(soloMode)return {...DEFAULT_SETTINGS,mode:'same',rounds:1,sameGame:soloSettings.game,difficulty:soloSettings.difficulty,durationSec:soloSettings.durationSec,gameSettings:loadSoloGameSettings()}; const raw=roomData?.settings||{};return {...DEFAULT_SETTINGS,...raw,gameSettings:{...GAME_DEFAULTS,...(raw.gameSettings||{})}}; }
function series(){ if(soloMode)return soloSession||{status:'lobby',roundIndex:0,totalRounds:1,difficulty:soloSettings.difficulty,durationSec:soloSettings.durationSec}; return roomData?.series||{status:'lobby'}; }
function gameOptions(id=activeGame,source=settings()){return {...(GAME_DEFAULTS[id]||{}),...(source.gameSettings?.[id]||{})};}
function gameDifficulty(id=activeGame){return gameOptions(id,series()).difficulty||series().difficulty||'medium';}
function gameDurationSec(id=activeGame){const o=gameOptions(id,series());return Number(o.inheritDuration!==false?(series().durationSec||45):(o.durationSec||series().durationSec||45));}
function isUntimedGame(id){ return gameOptions(id,series()).timed===false; }
function roundDurationMs(id,durationSec,source=settings()){const o=gameOptions(id,source),sec=o.inheritDuration!==false?Number(durationSec||source.durationSec||45):Number(o.durationSec||durationSec||45);return o.timed===false?0:(sec*1000 + (id==='airstrike'?15000:0)); }
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
function applyTheme(theme){document.body.dataset.theme=theme;localStorage.setItem('duopk_theme',theme);if(els.themeBtn)els.themeBtn.textContent=theme==='beige'?'🌙':'☀️';}
function toggleTheme(){applyTheme(document.body.dataset.theme==='beige'?'dark':'beige');}
function loadSoloGameSettings(){try{return {...GAME_DEFAULTS,...JSON.parse(localStorage.getItem('duopk_game_settings_v6')||localStorage.getItem('duopk_game_settings_v5')||'{}')}}catch{return {...GAME_DEFAULTS}}}
function saveSoloGameSettings(v){localStorage.setItem('duopk_game_settings_v6',JSON.stringify(v));}

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
function gameNow(){return soloMode?Date.now():serverNow();}
function bindFastPress(el,handler){if(!el)return;let lastPointer=0;el.addEventListener('pointerup',e=>{lastPointer=performance.now();e.preventDefault();handler(e);});el.addEventListener('click',e=>{if(performance.now()-lastPointer<450)return;handler(e);});}
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
  const current=gameOptions(soloSettings.game,{gameSettings:loadSoloGameSettings()});soloSettings.difficulty=current.difficulty||soloSettings.difficulty;if(current.inheritDuration===false)soloSettings.durationSec=Number(current.durationSec||soloSettings.durationSec);
  document.querySelectorAll('[data-solo-diff]').forEach(b=>b.classList.toggle('active',b.dataset.soloDiff===soloSettings.difficulty));
  if(els.soloDurationRange){els.soloDurationRange.value=soloSettings.durationSec;els.soloDurationLabel.textContent=`${soloSettings.durationSec} 秒`;els.soloDurationBox.textContent=`${soloSettings.durationSec}s`;}
  const g=GAMES[soloSettings.game];if(els.soloSelectedText)els.soloSelectedText.textContent=`已选：${g.icon} ${g.name}`;
  if(els.soloBestText)els.soloBestText.textContent=`当前难度最佳：${getSoloBest().toLocaleString()} 分`;
}
function renderSoloGameLibrary(){
  if(!els.soloGameGrid)return;els.soloGameGrid.innerHTML='';
  for(const id of SOLO_GAME_IDS){const g=GAMES[id];if(soloFilter!=='all'&&g.category!==soloFilter)continue;const b=document.createElement('div');b.className='game-option'+(soloSettings.game===id?' selected':'');b.dataset.game=id;b.style.setProperty('--accent',g.category==='brain'?'rgba(168,139,255,.18)':g.category==='reaction'?'rgba(87,231,255,.18)':'rgba(255,122,200,.15)');const o=gameOptions(id,{gameSettings:loadSoloGameSettings()});b.innerHTML=`<div class="game-option-main"><div class="game-ico">${g.icon}</div><b>${g.name}</b><small>${g.desc}</small><div class="game-meta"><span class="pill">${({brain:'脑力',reaction:'反应',arcade:'街机'})[g.category]||'训练'}</span><span class="pill">单人可玩</span></div><div class="settings-summary">${DIFFS[o.difficulty]?.name||'中等'} · ${o.timed===false?'不限时':o.inheritDuration!==false?'跟随统一时间':`${o.durationSec}s`}</div></div><button class="game-setting-btn">⚙</button>`;b.querySelector('.game-option-main').addEventListener('click',()=>{soloSettings.game=id;renderSoloSettings();renderSoloGameLibrary();});b.querySelector('.game-setting-btn').addEventListener('click',e=>{e.stopPropagation();openGameSettings(id,true);});els.soloGameGrid.appendChild(b);}
}
function gameExtraFields(id,o){
  if(id==='tracking')return `<div class="toggle-row"><span>小球碰撞后弹开</span><input id="cfgCollisions" type="checkbox" ${o.collisions!==false?'checked':''}></div>`;
  if(id==='runner')return `<div class="toggle-row"><span>允许二段跳</span><input id="cfgDoubleJump" type="checkbox" ${o.doubleJump!==false?'checked':''}></div><div class="toggle-row"><span>允许趴下</span><input id="cfgCrouch" type="checkbox" ${o.crouch!==false?'checked':''}></div><div class="toggle-row"><span>随机障碍间距</span><input id="cfgVariableGaps" type="checkbox" ${o.variableGaps!==false?'checked':''}></div><div class="settings-field"><label>生命值</label><select id="cfgLives"><option value="3">3 格</option><option value="5">5 格</option></select></div>`;
  if(id==='plane')return `<div class="settings-field"><label>生命值</label><select id="cfgLives"><option value="3">3 格</option><option value="5">5 格</option></select></div>`;
  if(id==='schulte')return `<div class="settings-field"><label>舒尔特类型</label><select id="cfgSchulteVariant"><option value="static">静态</option><option value="horizontal">左右移动</option><option value="colorful">彩色</option><option value="honeycomb">不规则蜂窝</option><option value="reverse">反向</option></select></div><div class="settings-field"><label>表格尺寸</label><select id="cfgSchulteSize"><option value="5">5×5</option><option value="6">6×6</option><option value="7">7×7</option></select></div>`;
  if(id==='needle'||id==='tugRhythm')return `<div class="settings-field"><label>速度倍率</label><select id="cfgSpeedScale"><option value="0.55">舒缓</option><option value="0.72">偏慢</option><option value="0.9">标准</option><option value="1.1">快速</option></select></div>`;
  return '';
}
function openGameSettings(id,solo=soloMode){editingGameId={id,solo};const source=solo?{gameSettings:loadSoloGameSettings()}:settings(),o=gameOptions(id,source),g=GAMES[id],timeSwitch=id==='2048';els.gameSettingsTitle.textContent=`${g.icon} ${g.name}`;els.gameSettingsCopy.textContent=solo?'只影响本机单人训练。':'保存后同步到当前双人房间；双方准备后会锁定。';els.gameSettingsForm.innerHTML=`<div class="settings-field"><label>独立难度</label><select id="cfgDifficulty">${Object.entries(DIFFS).map(([k,v])=>`<option value="${k}">${v.name}</option>`).join('')}</select></div><div class="toggle-row"><span>${timeSwitch?'限时模式（关闭即不限时）':o.timed===false?'固定不限时':'固定限时'}</span><input id="cfgTimed" type="checkbox" ${o.timed!==false?'checked':''} ${timeSwitch?'':'disabled'}></div>${o.timed===false&&!timeSwitch?'':`<div class="toggle-row"><span>跟随统一时间</span><input id="cfgInheritDuration" type="checkbox" ${o.inheritDuration!==false?'checked':''}></div><div class="settings-field"><label>特别时长（关闭跟随后生效）</label><input id="cfgDuration" type="number" min="20" max="180" step="5" value="${o.durationSec||45}" ${o.inheritDuration!==false?'disabled':''}></div>`}${gameExtraFields(id,o)}`;$('cfgDifficulty').value=o.difficulty||'medium';if($('cfgInheritDuration'))$('cfgInheritDuration').onchange=()=>{$('cfgDuration').disabled=$('cfgInheritDuration').checked};if($('cfgSpeedScale'))$('cfgSpeedScale').value=String(o.speedScale||GAME_DEFAULTS[id].speedScale||.9);if($('cfgLives'))$('cfgLives').value=String(o.lives||3);if($('cfgSchulteVariant'))$('cfgSchulteVariant').value=o.variant||'static';if($('cfgSchulteSize'))$('cfgSchulteSize').value=String(o.size||5);els.gameSettingsModal.classList.add('show');
}
function closeGameSettings(){editingGameId=null;els.gameSettingsModal.classList.remove('show');}
async function persistGameSettings(reset=false){if(!editingGameId)return;const {id,solo}=editingGameId;let next=reset?{...GAME_DEFAULTS[id]}:{...gameOptions(id,solo?{gameSettings:loadSoloGameSettings()}:settings()),difficulty:$('cfgDifficulty').value,timed:$('cfgTimed').checked,inheritDuration:$('cfgInheritDuration')?$('cfgInheritDuration').checked:true,durationSec:$('cfgDuration')?clamp(Number($('cfgDuration').value||45),20,180):45};if(!reset){if($('cfgCollisions'))next.collisions=$('cfgCollisions').checked;if($('cfgDoubleJump'))next.doubleJump=$('cfgDoubleJump').checked;if($('cfgCrouch'))next.crouch=$('cfgCrouch').checked;if($('cfgVariableGaps'))next.variableGaps=$('cfgVariableGaps').checked;if($('cfgSpeedScale'))next.speedScale=Number($('cfgSpeedScale').value);if($('cfgLives'))next.lives=Number($('cfgLives').value);if($('cfgSchulteVariant'))next.variant=$('cfgSchulteVariant').value;if($('cfgSchulteSize'))next.size=Number($('cfgSchulteSize').value);}if(solo){const all=loadSoloGameSettings();all[id]=next;saveSoloGameSettings(all);soloSettings.difficulty=next.difficulty;soloSettings.durationSec=next.inheritDuration!==false?soloSettings.durationSec:next.durationSec;renderSoloSettings();renderSoloGameLibrary();}else{if(series().status!=='lobby'||roomData.players?.p1?.ready||roomData.players?.p2?.ready)return addFeed('先取消准备，再修改游戏设置');await updateSetting({[`gameSettings/${id}`]:next});}closeGameSettings();}
function startSoloTraining(){
  const nm=normalizeName();if(nm)localStorage.setItem('duopk_nickname',nm);
  const game=soloSettings.game;if(!SOLO_GAME_IDS.includes(game))return;soloMode=true;soloFinishing=false;activeGame=game;roundId=`solo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;const o=gameOptions(game),startAt=Date.now()+1500,durationMs=roundDurationMs(game,soloSettings.durationSec,settings()),endAt=durationMs?startAt+durationMs:null;soloSession={status:'round',seriesId:roundId,roundId,roundIndex:0,totalRounds:1,playlist:[game],wins:{p1:0,p2:0},roundResults:[],difficulty:o.difficulty||soloSettings.difficulty,durationSec:Number(soloSettings.durationSec),gameSettings:loadSoloGameSettings(),startAt,endAt};
  resetLocalRound(game);showScreen('gameScreen');document.getElementById('gameScreen')?.classList.add('solo-playing');els.roundResult.classList.remove('show');els.feed.innerHTML='';mountGame(game);startRenderLoop();
}
function finishSoloTraining(){
  if(!soloMode||soloFinishing||soloSession?.status!=='round')return;soloFinishing=true;soloSession={...soloSession,status:'result',finishedAt:Date.now()};stopRenderLoop();localPhase='result';const diff=gameDifficulty(activeGame),duration=gameDurationSec(activeGame),rec=saveSoloBest(activeGame,diff,duration,score),g=GAMES[activeGame];els.soloResultEmoji.textContent=rec.isNew?'🏆':'✨';els.soloResultTitle.textContent=rec.isNew?'NEW BEST':'训练完成';els.soloResultScore.textContent=score.toLocaleString();els.soloResultMeta.textContent=`${g.icon} ${g.name} · ${DIFFS[diff].name} · ${isUntimedGame(activeGame)?'不限时':`${duration} 秒`}`;els.soloResultBest.textContent=rec.isNew?`新纪录！之前 ${rec.old.toLocaleString()} 分`:`个人最佳 ${rec.best.toLocaleString()} 分`;document.getElementById('gameScreen')?.classList.remove('solo-playing');showScreen('soloResultScreen');soloFinishing=false;
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
    if(id==='sudoku')continue;
    if(activeFilter!=='all'&&g.category!==activeFilter)continue;
    const b=document.createElement('div');b.className='game-option';b.dataset.game=id;b.setAttribute('role','button');b.tabIndex=0;b.style.setProperty('--accent',g.category==='brain'?'rgba(168,139,255,.18)':g.category==='reaction'?'rgba(87,231,255,.18)':g.category==='arcade'?'rgba(255,122,200,.15)':'rgba(255,209,106,.16)');
    if(s.mode==='same'&&s.sameGame===id)b.classList.add('selected');if(s.mode==='random'&&pool.includes(id))b.classList.add('pool','selected');
    const o=gameOptions(id,s);b.innerHTML=`<div class="game-option-main"><div class="game-ico">${g.icon}</div><b>${g.name}</b><small>${g.desc}</small><div class="game-meta"><span class="pill">${({brain:'脑力',reaction:'反应',arcade:'街机',board:'对战'})[g.category]}</span><span class="pill">${g.skills.length?`${g.skills.length} 技能`:'纯竞技'}</span></div><div class="settings-summary">${DIFFS[o.difficulty]?.name||'中等'} · ${o.timed===false?'不限时':o.inheritDuration!==false?'跟随统一时间':`${o.durationSec}s`}</div></div><button class="game-setting-btn" title="单独设置 ${g.name}">⚙</button>`;
    b.querySelector('.game-option-main').addEventListener('click',()=>pickGame(id));b.querySelector('.game-setting-btn').addEventListener('click',e=>{e.stopPropagation();openGameSettings(id,false);});b.addEventListener('keydown',e=>{if(e.key==='Enter')pickGame(id);});els.gameGrid.appendChild(b);
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
async function updateAllGameSettings(patch){const all={};for(const id of GAME_IDS)all[id]={...gameOptions(id,settings()),...patch};await updateSetting({gameSettings:all,...(('difficulty'in patch)?{difficulty:patch.difficulty}:{}),...(('durationSec'in patch)?{durationSec:patch.durationSec}:{})});}
function updateSoloQuick(patch){const all=loadSoloGameSettings(),id=soloSettings.game;all[id]={...gameOptions(id,{gameSettings:all}),...patch};saveSoloGameSettings(all);if('difficulty'in patch)soloSettings.difficulty=patch.difficulty;if('durationSec'in patch)soloSettings.durationSec=patch.durationSec;renderSoloSettings();renderSoloGameLibrary();}
async function pickGame(id){
  const s=settings();if(series().status!=='lobby'||roomData.players?.p1?.ready||roomData.players?.p2?.ready)return;
  if(s.mode==='same')await updateSetting({sameGame:id});
  else{let pool=normalizePool(s.randomPool);pool=pool.includes(id)?pool.filter(x=>x!==id):[...pool,id];if(pool.length<2)return addFeed('🎲 随机池至少保留 2 个游戏');await updateSetting({randomPool:pool});}
}
async function toggleReady(){if(!roomCode||series().status!=='lobby')return;await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{ready:!me()?.ready,status:me()?.ready?'在大厅':'已准备'});}
function buildPlaylist(s,seriesId){
  if(s.mode==='same')return Array(Number(s.rounds)).fill(s.sameGame||'reaction');
  const pool=normalizePool(s.randomPool),out=[];let bagNo=0;while(out.length<Number(s.rounds)){let bag=shuffleDet(pool,`${seriesId}:bag:${bagNo++}`);if(out.length&&bag.length>1&&bag[0]===out.at(-1))bag.push(bag.shift());out.push(...bag);}return out.slice(0,Number(s.rounds));
}
async function tryStartSeries(){
  const sr=series();if(sr.status!=='lobby'||finishBusy)return;finishBusy=true;
  try{
    const s=settings(),seriesId=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,playlist=buildPlaylist(s,seriesId),startAt=serverNow()+3200,firstGame=playlist[0]||'reaction',durationMs=roundDurationMs(firstGame,s.durationSec,s);
    await runTransaction(ref(db,`rooms/${roomCode}/series`),cur=>{
      if(!cur||cur.status!=='lobby')return;return {status:'round',seriesId,roundIndex:0,totalRounds:Number(s.rounds),playlist,wins:{p1:0,p2:0},roundResults:[],difficulty:s.difficulty,durationSec:Number(s.durationSec),gameSettings:s.gameSettings,roundId:`${seriesId}-0`,startAt,endAt:durationMs?startAt+durationMs:null,historySaved:false};
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
  const sr=series();if(sr.status!=='round')return;const now=gameNow(),perf=performance.now(),dt=Math.min(.1,(perf-lastFrameAt)/1000);lastFrameAt=perf;
  const untimed=isUntimedGame(activeGame),ended=!untimed&&now>=Number(sr.endAt||0),live=now>=sr.startAt&&!ended;localPhase=now<sr.startAt?'countdown':live?'playing':'ending';
  els.gameOverlay.classList.toggle('show',!live);
  if(now<sr.startAt){els.overlayBig.textContent=Math.max(1,Math.ceil((sr.startAt-now)/1000));els.overlaySmall.textContent=`第 ${sr.roundIndex+1}/${sr.totalRounds} 局 · ${GAMES[activeGame].name}`;}
  else if(ended){els.overlayBig.textContent='TIME';els.overlaySmall.textContent='正在结算本局';}
  if(activeGame==='airstrike'&&live&&now<sr.startAt+15000){els.timer.textContent=`布阵 ${formatTime(sr.startAt+15000-now)}`;}
  else els.timer.textContent=untimed?'∞':formatTime(Number(sr.endAt||now)-now);
  if(soloMode){els.roundLabel.textContent='SOLO';els.roundDots.innerHTML='';}else{els.roundLabel.textContent=`ROUND ${sr.roundIndex+1}/${sr.totalRounds}`;renderRoundDots(sr);}updateEffectUI(now);syncOpponentUI();
  if(live){renderActiveGame(now,dt,sr);els.myScore.textContent=score.toLocaleString();scheduleSync();}
  if(ended&&now>=Number(sr.endAt||0)+450){if(soloMode)finishSoloTraining();else if(isCoordinator())finalizeRound(sr);}
  if(!soloMode&&(isUntimedGame(activeGame)||['airstrike','runner','plane'].includes(activeGame))&&roomData?.shared?.roundId===roundId&&roomData.shared.winner&&isCoordinator())finalizeRound(sr,true);
  if(!soloMode&&activeGame==='2048'&&isUntimedGame('2048')&&gameState.over&&String(opponent()?.status||'').includes('2048 已结束')&&isCoordinator())finalizeRound(sr,true);
}
function renderRoundDots(sr){
  const rr=Array.isArray(sr.roundResults)?sr.roundResults:Object.values(sr.roundResults||{});els.roundDots.innerHTML='';for(let i=0;i<sr.totalRounds;i++){const d=document.createElement('i');d.className='round-dot';const r=rr[i];if(r)d.classList.add(r.winner==='draw'?'draw':r.winner===mySlot?'me':'op');if(i===sr.roundIndex)d.classList.add('current');els.roundDots.appendChild(d);}
}
function resetLocalRound(type){
  score=0;progress=0;status='准备中';roundMounted=false;usedSkills=new Set();shieldActive=false;effects={freezeUntil:0,blindUntil:0,jamUntil:0,rushUntil:0,speedUntil:0,obstacleUntil:0,fakeUntil:0};gameState={};els.feed.innerHTML='';els.myScore.textContent='0';els.opScore.textContent='0';
  if(!soloMode)update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{score:0,progress:0,status:'准备中',ready:false}).catch(()=>{});
  if(type==='2048')init2048();if(type==='tetris')initTetris();if(type==='runner')initRunner();if(type==='plane')initPlane();if(type==='schulte')initSchulte(false);if(type==='schulteDynamic')initSchulteWheel();if(type==='memory')initMemory();if(type==='memorySequence')initMemorySequence();if(type==='tracking')initTracking();if(type==='color')initColor();if(type==='tugRhythm')initTugRhythm();if(type==='duelShooter')initDuelShooter();if(type==='stackTower')initStackTower();if(type==='airstrike')initAirstrike();if(type==='connect4')initConnect4();if(type==='climber')initClimber();if(type==='racer')initRacer();if(type==='fighter')initFighter();if(type==='drum')initDrum();if(type==='digitMemory')initDigitMemory();if(type==='dotCount')initDotCount();if(type==='numberErase')initNumberErase();if(type==='numberLink')initNumberLink();if(type==='klotski')initKlotski();if(type==='sudoku')initSudoku();
}
async function finalizeRound(sr,early=false){
  if(finishBusy||series().status!=='round')return;finishBusy=true;
  try{
    await flushPlayerState();if(!early)await new Promise(r=>setTimeout(r,220));const ps=(await get(ref(db,`rooms/${roomCode}/players`))).val()||{};let p1=Number(ps.p1?.score||0),p2=Number(ps.p2?.score||0);
    const sh=(await get(ref(db,`rooms/${roomCode}/shared`))).val();if(['gomoku','needle','stackTower','airstrike','connect4','reversi','fighter','runner','plane'].includes(activeGame)&&sh?.roundId===roundId){if(sh.winner){p1=sh.winner==='p1'?1000:sh.winner==='draw'?500:0;p2=sh.winner==='p2'?1000:sh.winner==='draw'?500:0;}else{p1=0;p2=0;}}
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
      const idx=cur.roundIndex+1,startAt=serverNow()+3000,playlist=Array.isArray(cur.playlist)?cur.playlist:Object.values(cur.playlist||{}),nextGame=playlist[idx]||'reaction',durationMs=roundDurationMs(nextGame,cur.durationSec,cur);return {...cur,status:'round',roundIndex:idx,roundId:`${cur.seriesId}-${idx}`,startAt,endAt:durationMs?startAt+durationMs:null,roundResult:null,resultAt:null};
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
  roundMounted=true;els.gameSurface.innerHTML='';const g=GAMES[type];els.gameModeTitle.textContent=`${g.icon} ${g.name}`;els.gameHint.textContent=soloMode?`${g.desc} · 个人最佳 ${getSoloBest(type,gameDifficulty(type),gameDurationSec(type)).toLocaleString()} 分`:g.desc;els.difficultyBadge.textContent=`${DIFFS[gameDifficulty(type)]?.name||'中等'} · ${isUntimedGame(type)?'不限时':`${gameDurationSec(type)}s`}`;els.myScoreName.textContent=soloMode?`${me()?.name||'PLAYER'} · SCORE`:(me()?.name||'YOU');els.opScoreName.textContent=opponent()?.name||'RIVAL';if(soloMode)els.opScore.textContent='';
  if(type==='reaction')mountReaction();else if(type==='number')mountNumber();else if(type==='schulte')mountSchulte();else if(type==='schulteDynamic')mountSchulteWheel();else if(type==='color')mountColor();else if(type==='falling')mountFalling();else if(type==='memory')mountMemory();else if(type==='memorySequence')mountMemorySequence();else if(type==='tracking')mountTracking();else if(type==='2048')mount2048();else if(type==='tetris')mountTetris();else if(type==='runner')mountRunner();else if(type==='plane')mountPlane();else if(type==='tug')mountTug();else if(type==='tugRhythm')mountTugRhythm();else if(type==='duelShooter')mountDuelShooter();else if(type==='stackTower')mountStackTower();else if(type==='needle')mountNeedle();else if(type==='gomoku')mountGomoku();else if(type==='airstrike')mountAirstrike();else if(type==='connect4')mountConnect4();else if(type==='reversi')mountReversi();else if(type==='climber')mountClimber();else if(type==='racer')mountRacer();else if(type==='fighter')mountFighter();else if(type==='drum')mountDrum();else if(type==='digitMemory')mountDigitMemory();else if(type==='dotCount')mountDotCount();else if(type==='numberErase')mountNumberErase();else if(type==='numberLink')mountNumberLink();else if(type==='klotski')mountKlotski();else if(type==='sudoku')mountSudoku();
  renderSkills();
}
function renderActiveGame(now,dt,sr){
  if(typeDisabled())return;
  if(activeGame==='reaction')renderReaction(now,sr);else if(activeGame==='number')renderNumber(now,sr);else if(activeGame==='schulte')renderSchulte(now,sr);else if(activeGame==='schulteDynamic')renderSchulteWheel(now,sr);else if(activeGame==='color')renderColor(now,sr);else if(activeGame==='falling')renderFalling(now,sr);else if(activeGame==='memory')renderMemory(now,sr);else if(activeGame==='memorySequence')renderMemorySequence(now,sr);else if(activeGame==='tracking')renderTracking(now,sr);else if(activeGame==='2048')render2048(now,sr);else if(activeGame==='tetris')renderTetris(now,dt,sr);else if(activeGame==='runner')renderRunner(now,dt,sr);else if(activeGame==='plane')renderPlane(now,dt,sr);else if(activeGame==='tug')renderTug(now,sr);else if(activeGame==='tugRhythm')renderTugRhythm(now,sr);else if(activeGame==='duelShooter')renderDuelShooter(now,sr);else if(activeGame==='stackTower')renderStackTower(now,sr);else if(activeGame==='needle')renderNeedle(now,sr);else if(activeGame==='gomoku')renderGomoku(now,sr);else if(activeGame==='airstrike')renderAirstrike(now,sr);else if(activeGame==='connect4')renderConnect4(now,sr);else if(activeGame==='reversi')renderReversi(now,sr);else if(activeGame==='climber')renderClimber(now,dt,sr);else if(activeGame==='racer')renderRacer(now,dt,sr);else if(activeGame==='fighter')renderFighter(now,sr);else if(activeGame==='drum')renderDrum(now,dt,sr);else if(activeGame==='digitMemory')renderDigitMemory(now,sr);else if(activeGame==='dotCount')renderDotCount(now,sr);else if(activeGame==='numberErase')renderNumberErase(now,sr);else if(activeGame==='numberLink')renderNumberLink(now,sr);else if(activeGame==='klotski')renderKlotski(now,sr);else if(activeGame==='sudoku')renderSudoku(now,sr);
}
function typeDisabled(){return false;}
function canInteract(){return localPhase==='playing'&&gameNow()>=effects.freezeUntil;}
function setScore(n,st=null,prog=null){const old=score;score=Math.max(0,Math.round(n));if(st!==null)status=st;if(prog!==null)progress=clamp(prog,0,100);els.myScore.textContent=score.toLocaleString();scheduleSync(true);const crossed=(GAMES[activeGame]?.skills||[]).some(([,base])=>{const at=skillThreshold(base);return (old<at&&score>=at)||(old>=at&&score<at);});if(crossed)renderSkills();}
function flashElement(el,good=true){if(!el)return;el.classList.remove('hit-good','hit-bad');void el.offsetWidth;el.classList.add(good?'hit-good':'hit-bad');setTimeout(()=>el.classList.remove('hit-good','hit-bad'),520);}
function addScore(n,st=null,prog=null){setScore(score+n,st,prog);}
async function declareArcadeKO(){
  if(gameState.koSent)return;gameState.koSent=true;
  if(soloMode){setTimeout(()=>finishSoloTraining(),420);return;}
  await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{
    if(cur?.roundId===roundId&&cur.winner)return cur;
    return {roundId,game:activeGame,winner:otherSlot(),loser:mySlot,at:serverNow()};
  }).catch(console.error);
}
function scheduleSync(immediate=false){
  if(!roomCode||!mySlot)return;const now=Date.now();if(immediate&&now-lastSyncAt>130)return flushPlayerState();if(syncTimer)return;syncTimer=setTimeout(()=>{syncTimer=null;flushPlayerState();},180);
}
async function flushPlayerState(){if(!roomCode||!mySlot)return;lastSyncAt=Date.now();try{await update(ref(db,`rooms/${roomCode}/players/${mySlot}`),{score,progress,status,online:true});}catch(e){console.error(e);}}
function syncOpponentUI(){if(soloMode)return;const op=opponent();els.opScore.textContent=Number(op?.score||0).toLocaleString();els.opGenericScore.textContent=Number(op?.score||0).toLocaleString();els.opGenericStatus.textContent=op?.status||'正在战斗';els.opProgress.style.width=`${clamp(Number(op?.progress||0),0,100)}%`;}

// ---------- skills ----------
function skillThreshold(base){return Math.round(base*(gameDurationSec()/45));}
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
function mountReaction(){els.gameSurface.innerHTML='<div class="stage-inner"><button class="reaction-pad" id="reactionPad" aria-label="反应力抢点区域"><span class="reaction-kicker">REACTION TEST</span><span class="reaction-icon" id="reactionIcon">🛑</span><span class="reaction-text" id="reactionText">等真正信号</span><span class="reaction-sub" id="reactionSub">红灯别点 · 绿灯出现立刻按下</span><span class="reaction-tap-hint">点击整个区域</span></button></div>';bindFastPress($('reactionPad'),hitReaction);gameState.answered=-1;gameState.feedback='';}
function reactionCfg(){const d=gameDifficulty();return {cycle:{easy:5200,medium:4500,hard:3800,hell:3200}[d],min:{easy:1600,medium:1300,hard:1000,hell:800}[d],spread:{easy:2100,medium:1800,hard:1500,hell:1200}[d]};}
function reactionInfo(now){const sr=series(),cfg=reactionCfg(),el=now-sr.startAt,cycle=Math.floor(el/cfg.cycle),within=el%cfg.cycle,goAt=cfg.min+randInt(`${roundId}:react:${cycle}`,0,cfg.spread);return{cycle,within,goAt,cfg};}
function renderReaction(now){const x=reactionInfo(now),pad=$('reactionPad'),fake=effects.fakeUntil>now&&x.within<x.goAt&&x.within>x.goAt-900;pad.className='reaction-pad'+(x.within>=x.goAt?' go':fake?' fake':'');$('reactionIcon').textContent=x.within>=x.goAt?'⚡':fake?'🟢':'🛑';$('reactionText').textContent=gameState.answered===x.cycle?'本轮完成':x.within>=x.goAt?'现在点！':fake?'看起来像绿灯…':'别点';$('reactionSub').textContent=gameState.feedback||'越快分越高';progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status=`反应训练 · ${Math.round(progress)}%`;}
function hitReaction(){const pad=$('reactionPad');if(!canInteract()){gameState.feedback='倒计时结束后开始';pad?.classList.add('nudge');setTimeout(()=>pad?.classList.remove('nudge'),180);return;}const x=reactionInfo(gameNow());if(gameState.answered===x.cycle){gameState.feedback='这一轮信号已完成，等下一次';return;}gameState.answered=x.cycle;pad?.classList.remove('tap-ok','tap-bad');if(x.within<x.goAt){addScore(-110,'抢跑 -110');gameState.feedback='🚫 抢跑 -110';pad?.classList.add('tap-bad');}else{const rt=Math.round(x.within-x.goAt),pts=Math.max(130,900-rt);addScore(pts,`${rt}ms +${pts}`);gameState.feedback=`⚡ ${rt}ms +${pts}`;pad?.classList.add('tap-ok');}setTimeout(()=>{gameState.feedback='';pad?.classList.remove('tap-ok','tap-bad');},700);}

// ---------- number compare ----------
function mountNumber(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info">快速选择更大的数字 · A / 1 选左，D / 2 选右</div><div class="choice-row"><button class="big-choice" id="numberL">0</button><button class="big-choice" id="numberR">0</button></div><div class="info" id="numberInfo"></div></div></div>';bindFastPress($('numberL'),()=>hitNumber('L'));bindFastPress($('numberR'),()=>hitNumber('R'));gameState.answered=-1;}
function numberInfo(now){const d=gameDifficulty(),len={easy:1700,medium:1350,hard:1050,hell:780}[d],el=now-series().startAt,cycle=Math.floor(el/len),digits={easy:99,medium:999,hard:9999,hell:99999}[d];let l=randInt(`${roundId}:nL:${cycle}`,1,digits),r=randInt(`${roundId}:nR:${cycle}`,1,digits);if(l===r)r++;return{cycle,l,r,ans:l>r?'L':'R',len};}
function renderNumber(now){const x=numberInfo(now);$('numberL').textContent=x.l;$('numberR').textContent=x.r;$('numberInfo').textContent=`按 A / ← 选左，D / → 选右 · ${DIFFS[gameDifficulty()].name}`;progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status='数字快判';}
function hitNumber(c){if(!canInteract())return;const x=numberInfo(gameNow());if(gameState.answered===x.cycle)return;gameState.answered=x.cycle;const el=$(c==='L'?'numberL':'numberR'),good=c===x.ans;flashElement(el,good);if(good)addScore(90,'判断正确 +90');else addScore(-35,'判断错误 -35');}

// ---------- Schulte ----------
function schulteOptions(){const o=gameOptions('schulte',series());return{size:clamp(Number(o.size||5),5,7),variant:o.variant||'static'};}
function schulteSize(){return schulteOptions().size;}
function schultePenalty(){return {easy:0,medium:10,hard:20,hell:35}[gameDifficulty()]||10;}
function schulteMoveInterval(){return {easy:2600,medium:1900,hard:1350,hell:900}[gameDifficulty()]||1900;}
function schulteOrder(sheet=0,salt=0){const total=schulteSize()**2;return shuffleDet(Array.from({length:total},(_,i)=>i+1),`${roundId}:schulte-sheet:${sheet}:${salt}`);}
function initSchulte(dynamic){
  const o=schulteOptions(),total=o.size**2,reverse=o.variant==='reverse';gameState={dynamic:dynamic||o.variant==='horizontal',variant:o.variant,n:o.size,total,next:reverse?total:1,step:reverse?-1:1,sheet:0,tables:0,order:schulteOrder(0,0),salt:0,lastCorrectAt:gameNow(),tableStartedAt:gameNow(),mistakes:0,dynamicCycle:-1,wrongNum:null,wrongUntil:0,completeUntil:0};
}
function mountSchulte(){
  const labels={static:'静态舒尔特',horizontal:'左右移动舒尔特',colorful:'彩色舒尔特',honeycomb:'蜂窝舒尔特',reverse:'反向舒尔特'},direction=gameState.step<0?`${gameState.total} → 1`:`1 → ${gameState.total}`;els.gameSurface.innerHTML=`<div class="stage-inner"><div class="schulte-wrap"><div class="schulte-topline"><div><b id="schulteMode">${labels[gameState.variant]||'舒尔特表'}</b><span id="schulteProgress">${gameState.next} / ${gameState.total}</span></div><div class="schulte-rule">按 ${direction} 寻找 · ${gameState.n}×${gameState.n}</div></div><div class="schulte-board-wrap"><div class="grid-game schulte-grid size-${gameState.n} ${gameState.variant}" id="schulteGrid" style="grid-template-columns:repeat(${gameState.n},1fr)"></div><div class="schulte-focus" aria-hidden="true"><i></i></div></div><div class="schulte-footer"><span id="schulteInfo">视线尽量停在表格中心，用周边视野搜索。</span><span id="schulteStats">0 张 · 0 误触</span></div></div></div>`;
  drawSchulte();
}
function drawSchulte(){
  const grid=$('schulteGrid');if(!grid)return;grid.innerHTML='';
  for(const num of gameState.order){
    const b=document.createElement('button');b.className='grid-cell schulte-cell';b.textContent=num;b.dataset.num=num;b.setAttribute('aria-label',`数字 ${num}`);
    if(gameState.wrongNum===num&&gameNow()<gameState.wrongUntil)b.classList.add('wrong');
    bindFastPress(b,()=>hitSchulte(num,b));grid.appendChild(b);
  }
  const p=$('schulteProgress'),s=$('schulteStats'),i=$('schulteInfo');
  const done=gameState.step>0?gameState.next>gameState.total:gameState.next<1;if(p)p.textContent=done?'完成':`${gameState.next} / ${gameState.total}`;
  if(s)s.textContent=`${gameState.tables} 张 · ${gameState.mistakes} 误触`;
  if(i)i.textContent=gameState.dynamic?'数字会定时左右换位，保持视线稳定。':gameState.variant==='reverse'?'从最大数字反向找到 1。':'数字位置保持不变，完成整张后生成下一张。';
}
function shuffleSchulte(fromAttack=false){
  if(!gameState.dynamic&&fromAttack)return;
  gameState.salt=(gameState.salt||0)+1;
  gameState.order=shuffleDet(gameState.order,`${roundId}:schulte-move:${gameState.sheet}:${gameState.salt}:${fromAttack?'atk':'cycle'}`);
  drawSchulte();
}
function startNextSchulteTable(now=gameNow()){
  gameState.sheet++;gameState.next=gameState.step>0?1:gameState.total;gameState.salt=0;gameState.order=schulteOrder(gameState.sheet,0);gameState.lastCorrectAt=now;gameState.tableStartedAt=now;gameState.dynamicCycle=-1;gameState.completeUntil=0;gameState.wrongNum=null;drawSchulte();
}
function hitSchulte(num,el=null){
  const isDone=gameState.step>0?gameState.next>gameState.total:gameState.next<1;if(!canInteract()||isDone||gameNow()<gameState.completeUntil)return;
  const now=gameNow();
  if(num!==gameState.next){
    gameState.mistakes++;gameState.wrongNum=num;gameState.wrongUntil=now+280;flashElement(el,false);
    const penalty=schultePenalty();if(penalty)addScore(-penalty,`误触 ${num} -${penalty}`);else status=`误触 ${num} · 顺序不变`;
    drawSchulte();setTimeout(()=>{if(gameState.wrongNum===num&&gameNow()>=gameState.wrongUntil){gameState.wrongNum=null;drawSchulte();}},300);return;
  }
  const reaction=Math.max(0,now-gameState.lastCorrectAt),speedBonus=Math.max(0,Math.round(35-reaction/90));
  gameState.lastCorrectAt=now;gameState.next+=gameState.step;flashElement(el,true);const answered=gameState.step>0?gameState.next-1:gameState.total-gameState.next;
  addScore(35+speedBonus,`找到 ${num} +${35+speedBonus}`,(answered/gameState.total)*100);
  const done=gameState.step>0?gameState.next>gameState.total:gameState.next<1;if(done){
    const elapsed=now-gameState.tableStartedAt,finishBonus=clamp(900-Math.floor(elapsed/45),180,760);
    gameState.tables++;addScore(finishBonus,`完成一张 · ${(elapsed/1000).toFixed(1)}s +${finishBonus}`,100);gameState.completeUntil=now+720;drawSchulte();
  }else drawSchulte();
}
function renderSchulte(now){
  const done=gameState.step>0?gameState.next>gameState.total:gameState.next<1;if(done&&gameState.completeUntil&&now>=gameState.completeUntil){startNextSchulteTable(now);}
  if(gameState.dynamic&&!done){
    const cycle=Math.floor((now-gameState.tableStartedAt)/schulteMoveInterval());
    if(cycle>0&&cycle!==gameState.dynamicCycle){gameState.dynamicCycle=cycle;shuffleSchulte(false);}
  }
  const answered=gameState.step>0?gameState.next-1:gameState.total-gameState.next;progress=clamp(answered/gameState.total*100,0,100);
  status=done?'✅ 完成一张':`${gameState.variant==='horizontal'?'左右移动':'舒尔特'} · ${gameState.next}/${gameState.total} · ${gameState.tables} 张`;
  const p=$('schulteProgress'),s=$('schulteStats');if(p)p.textContent=done?'完成':`${gameState.next} / ${gameState.total}`;if(s)s.textContent=`${gameState.tables} 张 · ${gameState.mistakes} 误触`;
}

// ---------- Rotating-ring dynamic Schulte ----------
function schulteWheelCfg(){
  const d=gameDifficulty();
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
  gameState={next:1,items,wrongNum:null,wrongUntil:0,lastCorrectAt:gameNow(),completed:0};
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
  if(!canInteract()||gameState.next>25)return;const cv=$('wheelCanvas'),r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*640/r.width,y=(e.clientY-r.top)*520/r.height,pos=schulteWheelPositions(gameNow());let hit=null,best=1e9;for(const p of pos){const d=Math.hypot(x-p.x,y-p.y);if(d<best){best=d;hit=p;}}if(!hit||best>34)return;
  const now=gameNow();if(hit.num!==gameState.next){gameState.mistakes=(gameState.mistakes||0)+1;gameState.wrongNum=hit.num;gameState.wrongUntil=now+300;addScore(-schultePenalty(),`误触 ${hit.num}`);return;}
  const rt=Math.max(0,now-gameState.lastCorrectAt),bonus=Math.max(0,Math.round(30-rt/120));gameState.lastCorrectAt=now;gameState.next++;addScore(42+bonus,`找到 ${hit.num} +${42+bonus}`,((gameState.next-1)/25)*100);
}

// ---------- Stroop color ----------
const COLORS=[['红','#ef5363'],['蓝','#458cff'],['绿','#35c98b'],['黄','#f0c44f'],['紫','#9c6cff'],['橙','#ff914d'],['粉','#ef70b7'],['青','#49d5dc']];
function initColor(){gameState={cycle:-1,answered:-1};}
function mountColor(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap stroop-wrap"><div class="info">找到字体颜色与目标汉字含义一致的选项</div><div class="stroop-target">目标：<b id="colorTargetName">绿</b></div><div class="color-options" id="colorOptions"></div><div class="info">例：上方是「绿」→ 请选择“绿色字体”的词，即使那个词写的是「红」。</div></div></div>';}
function colorInfo(now){const d=gameDifficulty(),baseLen={easy:2400,medium:1900,hard:1500,hell:1150}[d],len=effects.speedUntil>now?baseLen*.58:baseLen,count={easy:4,medium:6,hard:6,hell:8}[d],cycle=Math.floor((now-series().startAt)/len),target=randInt(`${roundId}:color:t:${cycle}`,0,COLORS.length-1),opts=shuffleDet(Array.from({length:COLORS.length},(_,i)=>i),`${roundId}:color:o:${cycle}`).slice(0,count);if(!opts.includes(target))opts[0]=target;return{cycle,target,opts,len};}
function renderColor(now){const x=colorInfo(now);if(gameState.cycle===x.cycle)return;gameState.cycle=x.cycle;gameState.answered=-1;const [name]=COLORS[x.target];$('colorTargetName').textContent=name;const box=$('colorOptions');box.innerHTML='';x.opts.forEach((ci,i)=>{const [,ink]=COLORS[ci];let wi=randInt(`${roundId}:color:w:${x.cycle}:${i}`,0,COLORS.length-1);if(wi===ci)wi=(wi+1+randInt(`${roundId}:color:w2:${x.cycle}:${i}`,0,COLORS.length-2))%COLORS.length;const word=COLORS[wi][0],b=document.createElement('button');b.className='color-btn stroop-btn';b.style.color=ink;b.textContent=`${i+1} · ${word}`;bindFastPress(b,()=>hitColor(ci,b));box.appendChild(b);});progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`色词干扰 · 找「${name}」的颜色`; }
function hitColor(ci,el=null){if(!canInteract())return;const x=colorInfo(gameNow());if(gameState.answered===x.cycle)return;gameState.answered=x.cycle;const good=ci===x.target;flashElement(el||[...$('colorOptions').children][x.opts.indexOf(ci)],good);if(good)addScore(105,'字体颜色正确 +105');else addScore(-45,'被字义骗到了 -45');}

// ---------- Falling target shooter ----------
function mountFalling(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap"><canvas class="game-canvas" id="fallCanvas" width="760" height="500"></canvas><div class="info" style="position:absolute;top:10px;left:14px">同色目标：点击「＋」靶，避开「×」炸弹</div></div></div>';$('fallCanvas').addEventListener('pointerdown',hitFalling);gameState.hit=new Set();gameState.fallFlash=null;}
function fallingCfg(){const d=gameDifficulty();return{spawn:{easy:950,medium:760,hard:590,hell:430}[d],fall:{easy:3000,medium:2500,hard:2050,hell:1650}[d],radius:{easy:30,medium:26,hard:22,hell:18}[d]};}
function fallingObjects(now){const cfg=fallingCfg(),spawn=effects.rushUntil>now?cfg.spawn*.58:cfg.spawn,el=now-series().startAt,cycle=Math.floor(el/spawn),out=[];for(let c=Math.max(0,cycle-7);c<=cycle;c++){const age=el-c*spawn;if(age<0||age>cfg.fall)continue;const bomb=gameDifficulty()!=='easy'&&random01(`${roundId}:fall:b:${c}`)<(gameDifficulty()==='hell'?.25:.14),x=45+random01(`${roundId}:fall:x:${c}`)*670,y=-30+(age/cfg.fall)*570;out.push({c,bomb,x,y,r:cfg.radius});}return out;}
function renderFalling(now){const cv=$('fallCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);ctx.fillStyle=document.body.dataset.theme==='beige'?'#eee2d2':'#08111e';ctx.fillRect(0,0,760,500);for(const o of fallingObjects(now)){if(gameState.hit.has(o.c))continue;const flashed=gameState.fallFlash?.c===o.c&&now<gameState.fallFlash.until,bad=flashed&&gameState.fallFlash.bad,col=bad?'#ff6479':flashed?'#5aeba8':'#56d9ef';ctx.lineWidth=Math.max(3,o.r*.16);for(let ring=1;ring>=0;ring--){ctx.beginPath();ctx.arc(o.x,o.y,o.r*(1-ring*.38),0,TAU);ctx.strokeStyle=ring?'rgba(86,217,239,.48)':col;ctx.stroke();}ctx.beginPath();ctx.arc(o.x,o.y,o.r*.22,0,TAU);ctx.fillStyle=col;ctx.fill();ctx.font=`900 ${Math.round(o.r*.95)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=document.body.dataset.theme==='beige'?'#42372d':'#f7fbff';ctx.fillText(o.bomb?'×':'+',o.x,o.y+1);}progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=effects.jamUntil>now?'📡 瞄准受干扰':'掉落射击';}
function hitFalling(e){if(!canInteract()||effects.jamUntil>gameNow())return;const cv=$('fallCanvas'),r=cv.getBoundingClientRect(),x=(e.clientX-r.left)*760/r.width,y=(e.clientY-r.top)*500/r.height,objs=fallingObjects(gameNow()).reverse();for(const o of objs){if(gameState.hit.has(o.c))continue;if(Math.hypot(x-o.x,y-o.y)<=o.r*1.3){gameState.fallFlash={c:o.c,bad:o.bomb,until:gameNow()+180};if(o.bomb)addScore(-130,'误击炸弹 -130');else addScore(120,'命中 +120');setTimeout(()=>gameState.hit.add(o.c),170);return;}}}

// ---------- Memory ----------
function initMemory(){gameState={cycle:-1,selected:new Set(),attackShuffle:0};}
function memoryCfg(){
  const d=gameDifficulty();
  const n={easy:4,medium:5,hard:6,hell:7}[d],count={easy:3,medium:5,hard:8,hell:11}[d],flash={easy:2300,medium:2000,hard:1700,hell:1400}[d],answer={easy:5600,medium:5200,hard:4800,hell:4400}[d],reveal=900;
  return{n,count,flash,answer,reveal,cycle:flash+answer+reveal};
}
function mountMemory(){const cfg=memoryCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap memory-wrap"><div class="info" id="memoryInfo">记住亮起的格子</div><div class="memory-score-note">✓ 点对 +70　✕ 点错 -45　·　答题阶段有充足时间</div><div class="grid-game memory-grid" id="memoryGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div></div></div>`;const grid=$('memoryGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell';b.dataset.i=i;bindFastPress(b,()=>hitMemory(i));grid.appendChild(b);}}
function memoryInfo(now){const cfg=memoryCfg(),el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cfg.cycle),within=el%cfg.cycle,targetCount=Math.min(cfg.count+(cycle%2),cfg.n*cfg.n-2),targets=[];let k=0;while(targets.length<targetCount&&k<160){const v=randInt(`${roundId}:mem:${cycle}:${gameState.attackShuffle}:${k++}`,0,cfg.n*cfg.n-1);if(!targets.includes(v))targets.push(v);}return{cfg,cycle,within,targets};}
function renderMemory(now){const x=memoryInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.selected=new Set();}const show=x.within<x.cfg.flash,answer=x.within>=x.cfg.flash&&x.within<x.cfg.flash+x.cfg.answer,reveal=x.within>=x.cfg.flash+x.cfg.answer;[...$('memoryGrid').children].forEach((b,i)=>{b.className='grid-cell';if(show&&x.targets.includes(i))b.classList.add('target');if(answer&&gameState.selected.has(i))b.classList.add(x.targets.includes(i)?'correct':'wrong');if(reveal&&x.targets.includes(i))b.classList.add('target');if(reveal&&gameState.selected.has(i)&&!x.targets.includes(i))b.classList.add('wrong');});const remain=Math.ceil(Math.max(0,x.cfg.flash+x.cfg.answer-x.within)/1000);$('memoryInfo').textContent=show?`👀 记住 ${x.targets.length} 个位置 · ${(Math.max(0,x.cfg.flash-x.within)/1000).toFixed(1)}s`:answer?`🧠 现在复原 · 还有 ${remain}s`:'答案揭晓 · 下一组马上开始';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`记忆矩阵 · ${gameState.selected.size}/${x.targets.length}`;}
function hitMemory(i){if(!canInteract())return;const x=memoryInfo(gameNow());const answer=x.within>=x.cfg.flash&&x.within<x.cfg.flash+x.cfg.answer;if(!answer||gameState.selected.has(i))return;gameState.selected.add(i);const good=x.targets.includes(i);flashElement($('memoryGrid')?.children[i],good);if(good)addScore(70,'记忆正确 +70');else addScore(-45,'记忆错误 -45');}

// ---------- Sequential / dynamic memory ----------
function memorySequenceCfg(){const d=gameDifficulty();return{n:{easy:4,medium:5,hard:6,hell:7}[d],count:{easy:4,medium:6,hard:8,hell:11}[d],beat:{easy:820,medium:680,hard:540,hell:430}[d],answer:{easy:6000,medium:5600,hard:5200,hell:4800}[d],reveal:900};}
function initMemorySequence(){gameState={cycle:-1,selected:new Set()};}
function memorySequenceInfo(now){const cfg=memorySequenceCfg(),showTotal=cfg.count*cfg.beat,cycleLen=showTotal+cfg.answer+cfg.reveal,el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cycleLen),within=el%cycleLen,targets=[];let k=0;while(targets.length<cfg.count&&k<180){const v=randInt(`${roundId}:mseq:${cycle}:${k++}`,0,cfg.n*cfg.n-1);if(!targets.includes(v))targets.push(v);}return{cfg,cycle,within,targets,showTotal,cycleLen};}
function mountMemorySequence(){const cfg=memorySequenceCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap memory-wrap"><div class="info" id="mseqInfo">一个一个记住亮起的位置</div><div class="memory-score-note">亮格会依次出现 · 全部播放完后再点击你记住的位置</div><div class="grid-game memory-grid" id="mseqGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div></div></div>`;const grid=$('mseqGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell';b.dataset.i=i;bindFastPress(b,()=>hitMemorySequence(i));grid.appendChild(b);}}
function renderMemorySequence(now){const x=memorySequenceInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.selected=new Set();}const showing=x.within<x.showTotal,answer=x.within>=x.showTotal&&x.within<x.showTotal+x.cfg.answer,reveal=x.within>=x.showTotal+x.cfg.answer,activeIndex=showing?Math.min(x.targets.length-1,Math.floor(x.within/x.cfg.beat)):-1;[...$('mseqGrid').children].forEach((b,i)=>{b.className='grid-cell';if(showing&&i===x.targets[activeIndex])b.classList.add('target','sequence-pop');if(answer&&gameState.selected.has(i))b.classList.add(x.targets.includes(i)?'correct':'wrong');if(reveal&&x.targets.includes(i))b.classList.add('target');if(reveal&&gameState.selected.has(i)&&!x.targets.includes(i))b.classList.add('wrong');});$('mseqInfo').textContent=showing?`✨ 第 ${activeIndex+1}/${x.targets.length} 个`:answer?`🧠 现在点击所有记住的位置 · ${Math.ceil((x.showTotal+x.cfg.answer-x.within)/1000)}s`:'答案揭晓';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`动态记忆 · ${gameState.selected.size}/${x.targets.length}`;}
function hitMemorySequence(i){if(!canInteract())return;const x=memorySequenceInfo(gameNow());if(x.within<x.showTotal||x.within>=x.showTotal+x.cfg.answer||gameState.selected.has(i))return;gameState.selected.add(i);const good=x.targets.includes(i);flashElement($('mseqGrid')?.children[i],good);if(good)addScore(75,'记对 +75');else addScore(-50,'记错 -50');}

// ---------- Multiple-object tracking ----------
function trackingCfg(){const d=gameDifficulty();return{count:{easy:4,medium:5,hard:7,hell:9}[d],intro:1600,move:{easy:5200,medium:6000,hard:6800,hell:7600}[d],choose:3800,speed:{easy:105,medium:135,hard:170,hell:205}[d],r:{easy:25,medium:23,hard:20,hell:18}[d]};}
function initTracking(){gameState={cycle:-1,answered:false};}
function trackingInfo(now){const cfg=trackingCfg(),cycleLen=cfg.intro+cfg.move+cfg.choose+700,el=Math.max(0,now-series().startAt),cycle=Math.floor(el/cycleLen),within=el%cycleLen,target=randInt(`${roundId}:track:target:${cycle}`,0,cfg.count-1);return{cfg,cycle,within,target,cycleLen};}
function tri01(x){x=((x%2)+2)%2;return x<=1?x:2-x;}
function trackingBalls(now,x){const tMove=Math.min(Math.max(0,x.within-x.cfg.intro),x.cfg.move)/1000,freezeT=x.cfg.move/1000,balls=Array.from({length:x.cfg.count},(_,i)=>{const phaseX=random01(`${roundId}:track:px:${x.cycle}:${i}`)*2,phaseY=random01(`${roundId}:track:py:${x.cycle}:${i}`)*2,vx=x.cfg.speed*(.72+random01(`${roundId}:track:vx:${x.cycle}:${i}`)*.65),vy=x.cfg.speed*(.65+random01(`${roundId}:track:vy:${x.cycle}:${i}`)*.7),tt=x.within>=x.cfg.intro+x.cfg.move?freezeT:tMove,px=55+tri01(phaseX+tt*vx/310)*530,py=55+tri01(phaseY+tt*vy/210)*310;return{i,x:px,y:py};});if(gameOptions('tracking',series()).collisions!==false){for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,dist=Math.max(1,Math.hypot(dx,dy)),min=x.cfg.r*2+4;if(dist<min){const push=(min-dist)/2,nx=dx/dist,ny=dy/dist;a.x=clamp(a.x-nx*push,45,595);a.y=clamp(a.y-ny*push,45,375);b.x=clamp(b.x+nx*push,45,595);b.y=clamp(b.y+ny*push,45,375);}}}return balls;}
function mountTracking(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="tracking-wrap"><div class="info" id="trackInfo">先记住发光的目标球</div><canvas id="trackCanvas" class="game-canvas tracking-canvas" width="640" height="420"></canvas><div class="memory-score-note">球带清晰白边 · 停下后可按数字 1–9 选择对应小球 · ${gameOptions('tracking',series()).collisions===false?'穿透模式':'碰撞弹开'}</div></div></div>`;$('trackCanvas').addEventListener('pointerdown',hitTracking);}
function renderTracking(now){const x=trackingInfo(now);if(gameState.cycle!==x.cycle){gameState.cycle=x.cycle;gameState.answered=false;}const cv=$('trackCanvas');if(!cv)return;const ctx=cv.getContext('2d'),balls=trackingBalls(now,x),intro=x.within<x.cfg.intro,moving=x.within>=x.cfg.intro&&x.within<x.cfg.intro+x.cfg.move,choose=x.within>=x.cfg.intro+x.cfg.move&&x.within<x.cfg.intro+x.cfg.move+x.cfg.choose;ctx.clearRect(0,0,640,420);const bg=ctx.createLinearGradient(0,0,640,420);bg.addColorStop(0,'#091526');bg.addColorStop(1,'#080b14');ctx.fillStyle=bg;ctx.fillRect(0,0,640,420);for(const b of balls){ctx.beginPath();ctx.arc(b.x,b.y,x.cfg.r,0,TAU);const target=intro&&b.i===x.target;ctx.fillStyle=target?'#ffd16a':'#39d7ff';ctx.strokeStyle=target?'#fff3b8':'rgba(255,255,255,.92)';ctx.lineWidth=3;ctx.shadowBlur=target?24:5;ctx.shadowColor=ctx.fillStyle;ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.beginPath();ctx.arc(b.x-6,b.y-7,4,0,TAU);ctx.fillStyle='#fff';ctx.fill();if(choose){ctx.fillStyle='#07101d';ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(b.i+1),b.x,b.y+1);}if(target){ctx.strokeStyle='#fff1b8';ctx.lineWidth=4;ctx.beginPath();ctx.arc(b.x,b.y,x.cfg.r+8,0,TAU);ctx.stroke();}}
  $('trackInfo').textContent=intro?'👁️ 记住黄色目标球':moving?'🔵 追住它！标记已经消失':choose?(gameState.answered?'已作答，等待下一轮':'🎯 现在点原来的目标球'):'下一轮准备中';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`多目标追踪 · ${x.cfg.count} 球`;}
function hitTracking(e){if(!canInteract())return;const now=gameNow(),x=trackingInfo(now),choose=x.within>=x.cfg.intro+x.cfg.move&&x.within<x.cfg.intro+x.cfg.move+x.cfg.choose;if(!choose||gameState.answered)return;const cv=$('trackCanvas'),r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*640/r.width,py=(e.clientY-r.top)*420/r.height,balls=trackingBalls(now,x);let hit=null,best=1e9;for(const b of balls){const d=Math.hypot(px-b.x,py-b.y);if(d<best){best=d;hit=b;}}if(!hit||best>x.cfg.r*1.7)return;gameState.answered=true;if(hit.i===x.target)addScore(220,'追踪正确 +220');else addScore(-90,'追错目标 -90');}
function hitTrackingByIndex(i){const x=trackingInfo(gameNow());if(i<0||i>=x.cfg.count||gameState.answered)return;const fake={clientX:0,clientY:0};const cv=$('trackCanvas'),r=cv.getBoundingClientRect(),b=trackingBalls(gameNow(),x)[i];fake.clientX=r.left+b.x*r.width/640;fake.clientY=r.top+b.y*r.height/420;hitTracking(fake);}

// ---------- 2048 ----------
function init2048(){gameState={board:Array(16).fill(0),max:2,lastBlockCycle:-1};add2048Tile();add2048Tile();}
function mount2048(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="board2048" id="board2048"></div><div class="info" style="position:absolute;bottom:10px">方向键 / WASD · 手机可滑动</div></div>';draw2048();let sx=0,sy=0;els.gameSurface.ontouchstart=e=>{sx=e.changedTouches[0].clientX;sy=e.changedTouches[0].clientY;};els.gameSurface.ontouchend=e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;move2048(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));};}
function add2048Tile(){const b=gameState.board,empty=b.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(!empty.length)return;const idx=empty[Math.floor(Math.random()*empty.length)];b[idx]=Math.random()<.9?2:4;}
function add2048Block(){const b=gameState.board,empty=b.map((v,i)=>v===0?i:-1).filter(i=>i>=0);if(empty.length){b[empty[Math.floor(Math.random()*empty.length)]]=2;draw2048();addFeed('🧱 对手给你塞了一个 2');}}
function mergeSegment(seg){const vals=seg.filter(v=>v>0),out=[],res={gain:0};for(let i=0;i<vals.length;i++){if(vals[i]===vals[i+1]){const n=vals[i]*2;out.push(n);res.gain+=n;gameState.max=Math.max(gameState.max,n);i++;}else out.push(vals[i]);}while(out.length<seg.length)out.push(0);res.arr=out;return res;}
function compress2048Line(line){const out=[0,0,0,0];let gain=0,start=0;for(let i=0;i<=4;i++){if(i===4||line[i]===-1){const seg=line.slice(start,i),m=mergeSegment(seg);for(let j=0;j<m.arr.length;j++)out[start+j]=m.arr[j];gain+=m.gain;if(i<4)out[i]=-1;start=i+1;}}return{arr:out,gain};}
function rotateBoard(b){const n=Array(16).fill(0);for(let r=0;r<4;r++)for(let c=0;c<4;c++)n[c*4+(3-r)]=b[r*4+c];return n;}
function canMove2048(){const b=gameState.board;if(b.includes(0))return true;for(let r=0;r<4;r++)for(let c=0;c<4;c++){const v=b[r*4+c];if(v>0&&((c<3&&b[r*4+c+1]===v)||(r<3&&b[(r+1)*4+c]===v)))return true;}return false;}
function move2048(dir){if(!canInteract()||gameState.over)return;const turns={left:0,up:3,right:2,down:1}[dir];let b=[...gameState.board];for(let i=0;i<turns;i++)b=rotateBoard(b);let out=[],gain=0;for(let r=0;r<4;r++){const m=compress2048Line(b.slice(r*4,r*4+4));out.push(...m.arr);gain+=m.gain;}b=out;for(let i=0;i<(4-turns)%4;i++)b=rotateBoard(b);if(b.every((v,i)=>v===gameState.board[i]))return;gameState.board=b;addScore(gain,gain?`合成 +${gain}`:`MAX ${gameState.max}`);add2048Tile();draw2048();if(!canMove2048()){gameState.over=true;status='2048 已结束';scheduleSync(true);addFeed('棋盘已满');if(soloMode)setTimeout(finishSoloTraining,700);}}
function draw2048(){const box=$('board2048');if(!box)return;box.innerHTML='';gameState.board.forEach(v=>{const d=document.createElement('div');d.className='tile'+(v===-1?' block':'');d.dataset.v=v;d.textContent=v===-1?'▦':v||'';box.appendChild(d);});}
function render2048(now){const d=gameDifficulty(),interval={easy:999999,medium:22,hard:14,hell:9}[d]*1000,cycle=Math.floor((now-series().startAt)/interval);if(interval<900000&&cycle>0&&cycle!==gameState.lastBlockCycle){gameState.lastBlockCycle=cycle;add2048Block();}progress=clamp(Math.log2(Math.max(2,gameState.max))/11*100,0,100);status=`MAX ${gameState.max} · ${isUntimedGame('2048')?'不限时':'限时'}`;}

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
function mountTetris(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="canvas-wrap" style="width:min(390px,86%);height:min(540px,94%)"><canvas class="game-canvas" id="tetrisCanvas" width="360" height="600"></canvas><div class="mobile-controls"><button data-tc="left">←</button><button data-tc="rotate">↻</button><button data-tc="down">↓</button><button data-tc="right">→</button></div></div></div>';document.querySelectorAll('[data-tc]').forEach(b=>bindFastPress(b,()=>{const x=b.dataset.tc;x==='left'?tetrisMove(-1):x==='right'?tetrisMove(1):x==='rotate'?tetrisRotate():tetrisDrop();}));}
function renderTetris(now,dt){const d=gameDifficulty(),base={easy:.75,medium:.56,hard:.38,hell:.22}[d],interval=effects.speedUntil>now?base*.52:base;gameState.dropAcc+=dt;if(gameState.dropAcc>interval){gameState.dropAcc=0;tetrisDrop();}const garbageEvery={easy:999,medium:22,hard:13,hell:8}[d],cy=Math.floor((now-series().startAt)/(garbageEvery*1000));if(garbageEvery<900&&cy>0&&cy!==gameState.lastGarbage){gameState.lastGarbage=cy;addTetrisGarbage();}drawTetris();progress=clamp(gameState.lines/20*100,0,100);status=`消行 ${gameState.lines}`;}
function drawTetris(){const cv=$('tetrisCanvas');if(!cv)return;const ctx=cv.getContext('2d'),W=36,H=30;ctx.clearRect(0,0,360,600);ctx.fillStyle='#080d18';ctx.fillRect(0,0,360,600);const cols=['','#5fe5ff','#ffd05e','#a88bff','#ff7ac8','#61e6a9','#ff8b63','#7197ff','#596176'];for(let y=0;y<20;y++)for(let x=0;x<10;x++)if(gameState.board[y][x]){ctx.fillStyle=cols[gameState.board[y][x]];ctx.fillRect(x*W+2,y*H+2,W-4,H-4);}const p=gameState.piece;if(p)for(let r=0;r<p.m.length;r++)for(let c=0;c<p.m[r].length;c++)if(p.m[r][c]){ctx.fillStyle=cols[p.c];ctx.fillRect((p.x+c)*W+2,(p.y+r)*H+2,W-4,H-4);}ctx.strokeStyle='rgba(255,255,255,.04)';for(let x=1;x<10;x++){ctx.beginPath();ctx.moveTo(x*W,0);ctx.lineTo(x*W,600);ctx.stroke();}}

// ---------- Runner ----------
function initRunner(){const lives=gameOptions('runner',series()).lives||3;gameState={y:0,vy:0,onGround:true,jumps:0,crouching:false,invUntil:0,lastPass:-1,forceObstacle:false,lives,maxLives:lives,dead:false};}
function mountRunner(){const o=gameOptions('runner',series());els.gameSurface.innerHTML=`<div class="stage-inner"><div class="canvas-wrap runner-compact"><canvas class="game-canvas" id="runnerCanvas" width="760" height="420"></canvas><div class="life-hud" id="runnerLife">${'♥'.repeat(gameState.lives)}</div><div class="mobile-controls runner-controls"><button id="jumpBtn" style="width:110px">JUMP${o.doubleJump!==false?' ×2':''}</button>${o.crouch!==false?'<button id="crouchBtn">趴下</button>':''}</div></div></div>`;bindFastPress($('jumpBtn'),runnerJump);$('runnerCanvas').addEventListener('pointerdown',runnerJump);if($('crouchBtn')){const down=()=>runnerCrouch(true),up=()=>runnerCrouch(false);$('crouchBtn').addEventListener('pointerdown',down);$('crouchBtn').addEventListener('pointerup',up);$('crouchBtn').addEventListener('pointercancel',up);}}
function runnerJump(){if(!canInteract())return;const max=gameOptions('runner',series()).doubleJump===false?1:2;if(gameState.jumps>=max)return;gameState.vy=gameState.jumps? -560:-650;gameState.onGround=false;gameState.jumps++;gameState.crouching=false;}
function runnerCrouch(v){if(gameOptions('runner',series()).crouch===false)return;gameState.crouching=!!v;}
function runnerCfg(){const d=gameDifficulty();return{speed:{easy:205,medium:245,hard:285,hell:330}[d],gap:{easy:1950,medium:1550,hard:1180,hell:880}[d],accel:{easy:.008,medium:.011,hard:.016,hell:.022}[d]};}
function runnerDistance(cfg,bornSec,nowSec){const age=Math.max(0,nowSec-bornSec);return cfg.speed*(age+cfg.accel*(nowSec*nowSec-bornSec*bornSec)/2);}
function runnerObstacles(now){const cfg=runnerCfg(),el=Math.max(0,now-series().startAt),t=el/1000,variable=gameOptions('runner',series()).variableGaps!==false,cy=Math.floor(el/cfg.gap),out=[];for(let c=Math.max(0,cy-4);c<=cy+2;c++){const jitter=variable?(random01(`${roundId}:run:gap:${c}`)-.5)*cfg.gap*.62:0,bornMs=Math.max(0,c*cfg.gap+jitter),bornSec=bornMs/1000,x=820-runnerDistance(cfg,bornSec,t),type=gameDifficulty()==='easy'?'ground':(random01(`${roundId}:run:type:${c}`)<.24?'overhead':'ground'),w=30+randInt(`${roundId}:run:w:${c}`,0,34),h=type==='overhead'?22:35+randInt(`${roundId}:run:h:${c}`,0,58);out.push({c,x,w,h,type});}if(gameState.forceObstacle){const bornSec=Math.max(0,((gameState.forcedBorn||now)-series().startAt)/1000),fx=820-runnerDistance({...cfg,speed:cfg.speed*1.25},bornSec,t);out.push({c:999999,x:fx,w:42,h:78,type:'ground'});if(fx<-60)gameState.forceObstacle=false;}return out;}
function renderRunner(now,dt){if(gameState.dead)return drawRunner([],100,372,36,48,now);gameState.vy+=1650*dt;gameState.y+=gameState.vy*dt;if(gameState.y>=0){gameState.y=0;gameState.vy=0;gameState.onGround=true;gameState.jumps=0;}const obs=runnerObstacles(now),ground=390,px=100,ph=gameState.crouching&&gameState.onGround?24:48,py=ground-ph+gameState.y,pw=36;for(const o of obs){const oy=o.type==='overhead'?60:ground-o.h,oh=o.type==='overhead'?300:o.h;if(px+pw>o.x&&px<o.x+o.w&&py+ph>oy&&py<oy+oh&&now>gameState.invUntil){gameState.invUntil=now+900;gameState.lives--;addScore(-120,`撞到障碍 · 剩 ${gameState.lives} 命`);if(gameState.lives<=0){gameState.dead=true;status='生命耗尽';declareArcadeKO();}}if(o.x+o.w<px&&o.c>gameState.lastPass&&o.c<999999){gameState.lastPass=o.c;addScore(80,'漂亮闪避 +80');}}
  if(effects.obstacleUntil<=now)gameState.forceObstacle=false;const elapsed=(now-series().startAt)/1000,mult=1+runnerCfg().accel*Math.max(0,elapsed);score=Math.max(score,Math.floor((now-series().startAt)/110));drawRunner(obs,px,py,pw,ph,now);progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=now<gameState.invUntil?'💥 碰撞恢复中':`跑酷加速 ×${mult.toFixed(2)}`;}
function drawRunner(obs,px,py,pw,ph,now){const cv=$('runnerCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,420);const grad=ctx.createLinearGradient(0,0,0,420);grad.addColorStop(0,'#0c1830');grad.addColorStop(1,'#09101c');ctx.fillStyle=grad;ctx.fillRect(0,0,760,420);ctx.fillStyle='#1f2b3a';ctx.fillRect(0,390,760,30);ctx.fillStyle=gameState.dead?'#777':now<gameState.invUntil?'#ff778b':'#61e6a9';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#0a121d';ctx.fillRect(px+23,py+Math.min(9,ph/3),6,6);for(const o of obs){ctx.fillStyle=o.type==='overhead'?'#c48cff':'#ffb05f';ctx.fillRect(o.x,o.type==='overhead'?60:390-o.h,o.w,o.type==='overhead'?300:o.h);}ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='14px sans-serif';ctx.fillText('SPACE/W 二段跳 · S/↓ 趴过紫色墙',18,28);if($('runnerLife'))$('runnerLife').textContent='♥'.repeat(Math.max(0,gameState.lives))+'♡'.repeat(Math.max(0,gameState.maxLives-gameState.lives));}

// ---------- Plane shooter ----------
function initPlane(){const lives=gameOptions('plane',series()).lives||3;gameState={x:380,enemies:[],bullets:[],spawnAcc:0,shotAcc:0,kills:0,lives,maxLives:lives,dead:false};}
function mountPlane(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="canvas-wrap"><canvas class="game-canvas" id="planeCanvas" width="760" height="500"></canvas><div class="info" style="position:absolute;left:12px;top:10px">移动鼠标 / 手指 / ← → 控制飞机 · 漏掉敌机会掉生命</div><div class="life-hud" id="planeLife">${'♥'.repeat(gameState.lives)}</div></div></div>`;const cv=$('planeCanvas');cv.addEventListener('pointermove',e=>{if(!canInteract())return;const r=cv.getBoundingClientRect();gameState.x=clamp((e.clientX-r.left)*760/r.width,28,732);});cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect();gameState.x=clamp((e.clientX-r.left)*760/r.width,28,732);});}
function planeCfg(){const d=gameDifficulty();return{spawn:{easy:.95,medium:.72,hard:.52,hell:.37}[d],enemy:{easy:105,medium:135,hard:170,hell:210}[d]};}
function renderPlane(now,dt){if(gameState.dead)return drawPlane(now);const cfg=planeCfg(),rush=effects.rushUntil>now?1.8:1;gameState.spawnAcc+=dt*rush;while(gameState.spawnAcc>cfg.spawn){gameState.spawnAcc-=cfg.spawn;gameState.enemies.push({x:30+Math.random()*700,y:-20,v:cfg.enemy*(.8+Math.random()*.5),hp:1});}gameState.shotAcc+=dt;if(effects.jamUntil<=now&&gameState.shotAcc>.22){gameState.shotAcc=0;gameState.bullets.push({x:gameState.x,y:430});}for(const b of gameState.bullets)b.y-=430*dt;for(const e of gameState.enemies)e.y+=e.v*dt;for(const b of gameState.bullets)for(const e of gameState.enemies)if(e.hp>0&&Math.abs(b.x-e.x)<22&&Math.abs(b.y-e.y)<22){e.hp=0;b.y=-99;gameState.kills++;addScore(65,'击落敌机 +65');}for(const e of gameState.enemies)if(e.hp>0&&e.y>=505){e.hp=0;gameState.lives--;addScore(-80,`漏掉敌机 · 剩 ${gameState.lives} 命`);if(gameState.lives<=0){gameState.dead=true;status='生命耗尽';declareArcadeKO();}}gameState.bullets=gameState.bullets.filter(b=>b.y>-30);gameState.enemies=gameState.enemies.filter(e=>e.hp>0&&e.y<540);drawPlane(now);progress=clamp((now-series().startAt)/(series().endAt-series().startAt)*100,0,100);status=effects.jamUntil>now?'📡 武器受干扰':gameState.dead?'生命耗尽':`击落 ${gameState.kills}`;}
function drawPlane(now){const cv=$('planeCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);ctx.fillStyle='#07101d';ctx.fillRect(0,0,760,500);for(let i=0;i<35;i++){ctx.fillStyle='rgba(255,255,255,.5)';ctx.fillRect((i*97)%760,(i*53+Math.floor(now/25))%500,1.5,1.5);}ctx.fillStyle=gameState.dead?'#777':'#5ce4ff';ctx.beginPath();ctx.moveTo(gameState.x,440);ctx.lineTo(gameState.x-22,478);ctx.lineTo(gameState.x,470);ctx.lineTo(gameState.x+22,478);ctx.closePath();ctx.fill();ctx.fillStyle='#ffd16a';for(const b of gameState.bullets)ctx.fillRect(b.x-2,b.y,4,12);for(const e of gameState.enemies){ctx.fillStyle='#ff748a';ctx.beginPath();ctx.moveTo(e.x,e.y+22);ctx.lineTo(e.x-20,e.y-12);ctx.lineTo(e.x,e.y-5);ctx.lineTo(e.x+20,e.y-12);ctx.closePath();ctx.fill();}if($('planeLife'))$('planeLife').textContent='♥'.repeat(Math.max(0,gameState.lives))+'♡'.repeat(Math.max(0,gameState.maxLives-gameState.lives));}

// ---------- Tug ----------
function mountTug(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="tug"><div class="info">疯狂点击 / 按空格，把绳结拉向自己</div><div class="rope"><div class="rope-dot" id="ropeDot"></div></div><button class="tug-btn" id="tugBtn">🪢 PULL!</button><div class="info" id="tugInfo">每次 +10</div></div></div>';bindFastPress($('tugBtn'),hitTug);}
function hitTug(){if(!canInteract())return;addScore(10,'持续发力');}
function renderTug(){const op=Number(opponent()?.score||0),diff=clamp((score-op)/1000,-.45,.45);$('ropeDot').style.left=`${50+diff*100}%`;$('tugInfo').textContent=soloMode?`当前 ${score} · 继续冲高分`:`你 ${score} · 对手 ${op}`;progress=soloMode?clamp(score/1000*100,0,100):clamp(50+diff*100,0,100);status=soloMode?'极速手速训练':'极速拔河';}

// ---------- Rhythm tug ----------
function initTugRhythm(){gameState={lastHit:0,combo:0};}
function mountTugRhythm(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="tug rhythm-tug"><div class="info">等光标进入发光区域再点击 / 按空格</div><div class="rhythm-track"><div class="rhythm-zone" id="rhythmZone"></div><div class="rhythm-marker" id="rhythmMarker"></div></div><button class="tug-btn" id="rhythmBtn">🎵 HIT</button><div class="info" id="rhythmInfo">PERFECT +35 · GOOD +20 · MISS -12</div></div></div>`;bindFastPress($('rhythmBtn'),hitTugRhythm);}
function tugRhythmState(now){const d=gameDifficulty(),scale=gameOptions('tugRhythm',series()).speedScale||.72,base={easy:.72,medium:.88,hard:1.08,hell:1.32}[d]*scale*(effects.speedUntil>now?1.28:1),t=(now-series().startAt)/1000,marker=50+46*Math.sin(t*base*TAU),cycle=Math.floor(t/5),center=20+randInt(`${roundId}:rhythm:${cycle}`,0,60),width={easy:28,medium:23,hard:18,hell:14}[d];return{marker,center,width};}
function renderTugRhythm(now){const x=tugRhythmState(now);$('rhythmMarker').style.left=`${x.marker}%`;$('rhythmZone').style.left=`${x.center-x.width/2}%`;$('rhythmZone').style.width=`${x.width}%`;const op=Number(opponent()?.score||0),diff=clamp((score-op)/1000,-.45,.45);progress=soloMode?clamp(score/1200*100,0,100):clamp(50+diff*100,0,100);status=soloMode?`节奏训练 · Combo ${gameState.combo||0}`:`节奏拔河 · Combo ${gameState.combo||0}`;}
function hitTugRhythm(){if(!canInteract())return;const now=gameNow();if(now-(gameState.lastHit||0)<90)return;gameState.lastHit=now;const x=tugRhythmState(now),dist=Math.abs(x.marker-x.center),half=x.width/2;if(dist<=half*.42){gameState.combo=(gameState.combo||0)+1;addScore(35,'PERFECT +35');}else if(dist<=half){gameState.combo=(gameState.combo||0)+1;addScore(20,'GOOD +20');}else{gameState.combo=0;addScore(-12,'MISS -12');}}

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
function stackCfg(){const d=gameDifficulty();return{speed:{easy:.34,medium:.45,hard:.59,hell:.76}[d],startW:{easy:.62,medium:.58,hard:.54,hell:.50}[d]};}
function initStackTower(){gameState={};}
async function ensureStackShared(){const cfg=stackCfg();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'stackTower',blocks:[{x:.5-cfg.startW/2,w:cfg.startW,owner:'base'}],turn:(Number(series().roundIndex||0)%2===0?'p1':'p2'),moveNo:0,moveAt:serverNow(),winner:null,loser:null});}
function stackMovingX(sh,now){const cfg=stackCfg(),w=arrVal(sh.blocks).at(-1)?.w||cfg.startW,t=Math.max(0,(now-Number(sh.moveAt||now))/1000),phase=random01(`${roundId}:stack:${Number(sh.moveNo||0)}`)*2;return tri01(phase+t*cfg.speed)*Math.max(.02,1-w);}
function mountStackTower(){els.gameSurface.innerHTML=`<div class="stage-inner"><div class="stack-wrap"><div class="info" id="stackInfo">等待积木塔初始化…</div><canvas id="stackCanvas" class="game-canvas stack-canvas" width="700" height="500"></canvas><button id="stackDrop" class="needle-fire">🧊 落 下</button><div class="needle-tip">轮流落块；只保留与上一层重叠的部分。完全没搭住 = 立即输。</div></div></div>`;$('stackDrop').addEventListener('click',dropStackBlock);$('stackCanvas').addEventListener('pointerdown',dropStackBlock);ensureStackShared();}
async function dropStackBlock(){if(!canInteract())return;const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='stackTower'||sh.winner||sh.turn!==mySlot)return;const now=serverNow();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='stackTower'||cur.winner||cur.turn!==mySlot)return;const blocks=arrVal(cur.blocks),top=blocks[blocks.length-1],w=Number(top.w),x=stackMovingX(cur,now),left=Math.max(x,Number(top.x)),right=Math.min(x+w,Number(top.x)+w),overlap=right-left;if(overlap<=.012)return{...cur,winner:otherSlot(),loser:mySlot,failedX:x};const next={x:left,w:overlap,owner:mySlot};return{...cur,blocks:[...blocks,next],turn:otherSlot(),moveNo:Number(cur.moveNo||0)+1,moveAt:serverNow()};});}
function renderStackTower(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='stackTower'){ensureStackShared();return;}const cv=$('stackCanvas');if(!cv)return;const ctx=cv.getContext('2d'),blocks=arrVal(sh.blocks),W=700,H=500,blockH=28,visible=14,start=Math.max(0,blocks.length-visible),baseY=H-40;ctx.clearRect(0,0,W,H);const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#11152a');bg.addColorStop(1,'#070b13');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);for(let i=start;i<blocks.length;i++){const b=blocks[i],y=baseY-(i-start)*blockH,x=45+Number(b.x)*610,w=Number(b.w)*610;ctx.fillStyle=b.owner==='p1'?'#57e7ff':b.owner==='p2'?'#ff7ac8':'#59647e';ctx.fillRect(x,y,w,blockH-3);}if(!sh.winner){const top=blocks[blocks.length-1],x=45+stackMovingX(sh,now)*610,w=Number(top.w)*610,y=baseY-(blocks.length-start)*blockH;ctx.fillStyle=sh.turn==='p1'?'rgba(87,231,255,.82)':'rgba(255,122,200,.82)';ctx.fillRect(x,y,w,blockH-3);}const drop=$('stackDrop');if(drop){drop.disabled=!!sh.winner||sh.turn!==mySlot;drop.classList.toggle('your-turn',!drop.disabled);}if(sh.winner){score=sh.winner===mySlot?1000:0;progress=sh.winner===mySlot?100:0;status=sh.winner===mySlot?'对手没叠上':'积木掉落';$('stackInfo').textContent=sh.winner===mySlot?'🏆 对手没有搭住，你赢了！':'💥 没搭住，本局失败';scheduleSync(true);}else{score=blocks.filter(b=>b.owner===mySlot).length*100;progress=clamp(blocks.length/18*100,0,95);status=sh.turn===mySlot?'轮到你落块':'等待对手';$('stackInfo').textContent=sh.turn===mySlot?'轮到你 · 看准重叠区域再落':'等待对手落块';}}

// ---------- Gomoku ----------
function gomokuSize(){return gameDifficulty()==='easy'?13:15;}
function mountGomoku(){const n=gomokuSize();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="choice-wrap"><div class="info" id="gomokuInfo">等待棋局初始化…</div><div class="gomoku" id="gomokuBoard" style="grid-template-columns:repeat(${n},1fr)"></div></div></div>`;for(let i=0;i<n*n;i++){const b=document.createElement('button');b.className='gcell';b.dataset.i=i;b.addEventListener('click',()=>gomokuMove(i));$('gomokuBoard').appendChild(b);}ensureGomokuShared();}
async function ensureGomokuShared(){if(!isCoordinator())return;const n=gomokuSize();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'gomoku',n,board:'0'.repeat(n*n),turn:'p1',winner:null,lastMoveAt:serverNow()});}
function checkFive(board,n,idx,val){const r=Math.floor(idx/n),c=idx%n,dirs=[[1,0],[0,1],[1,1],[1,-1]];for(const[dR,dC]of dirs){let count=1;for(const s of [-1,1]){let rr=r+dR*s,cc=c+dC*s;while(rr>=0&&rr<n&&cc>=0&&cc<n&&board[rr*n+cc]===val){count++;rr+=dR*s;cc+=dC*s;}}if(count>=5)return true;}return false;}
async function gomokuMove(i){if(!canInteract())return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{const n=gomokuSize();if(!cur||cur.roundId!==roundId||cur.winner||cur.turn!==mySlot)return;const arr=(cur.board||'0'.repeat(n*n)).split('');if(arr[i]!=='0')return;const val=mySlot==='p1'?'1':'2';arr[i]=val;const winner=checkFive(arr,n,i,val)?mySlot:null;return{...cur,board:arr.join(''),turn:winner?cur.turn:otherSlot(),winner,lastMoveAt:serverNow()};});}
function renderGomoku(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId){ensureGomokuShared();return;}const n=sh.n||gomokuSize(),arr=(sh.board||'').split('');[...$('gomokuBoard').children].forEach((b,i)=>{let s=b.querySelector('.stone');if(arr[i]==='1'||arr[i]==='2'){if(!s){s=document.createElement('i');s.className='stone';b.appendChild(s);}s.className=`stone ${arr[i]==='1'?'black':'white'}`;}else s?.remove();});$('gomokuInfo').textContent=sh.winner?`${roomData.players?.[sh.winner]?.name||''} 五子连珠！`:sh.turn===mySlot?'轮到你 · 不限时':'等待对手落子 · 不限时';if(sh.winner){score=sh.winner===mySlot?1000:0;progress=sh.winner===mySlot?100:0;status=sh.winner===mySlot?'五子连珠':'对手五子连珠';scheduleSync(true);}else{score=arr.filter(v=>v===(mySlot==='p1'?'1':'2')).length*10;progress=clamp(score/6,0,90);status=sh.turn===mySlot?'你的回合 · 不限时':'等待对手';}}



// ---------- Needle Gap / 见缝插针 ----------
const TAU=Math.PI*2;
function needleCfg(){
  const base={
    easy:{speed:.62,minGap:.245,seeds:4,reverseEvery:0},
    medium:{speed:.86,minGap:.27,seeds:5,reverseEvery:0},
    hard:{speed:1.18,minGap:.30,seeds:6,reverseEvery:4800},
    hell:{speed:1.52,minGap:.33,seeds:7,reverseEvery:3200}
  }[gameDifficulty()]||{speed:.86,minGap:.27,seeds:5,reverseEvery:0};
  return {...base,speed:base.speed*(gameOptions('needle',series()).speedScale||.78)};
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
  els.gameSurface.innerHTML=`<div class="stage-inner"><div class="needle-wrap"><div class="needle-headline"><b id="needleInfo">正在同步圆盘…</b><span id="needleCount">0 针</span></div><canvas class="game-canvas needle-canvas" id="needleCanvas" width="760" height="440"></canvas><button class="needle-fire" id="needleFire">📍 插 针</button><div class="needle-tip">简洁模式 · 点击圆盘 / 按空格 · 不限时 · 撞针立即出局</div></div></div>`;
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
  const d=gameDifficulty();
  return {
    n:{easy:8,medium:9,hard:10,hell:11}[d],
    planes:{easy:2,medium:3,hard:4,hell:5}[d],
    shape:[[0,0],[-1,0],[1,0],[0,-1],[0,1]],
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
function mountAirstrike(){const cfg=airstrikeCfg();els.gameSurface.innerHTML=`<div class="stage-inner"><div class="air-wrap"><div class="air-head"><b id="airInfo">15 秒布置自己的十字飞机</b><span id="airCount">0 / ${cfg.planes}</span></div><div class="grid-game air-grid" id="airGrid" style="grid-template-columns:repeat(${cfg.n},1fr)"></div><div class="air-legend" id="airLegend">每架飞机固定为“十字形”5 格。开战后不限时，谁先打完对方全部飞机谁赢；按数字键 1–9 可快速选择当前行格子。</div></div></div>`;const grid=$('airGrid');for(let i=0;i<cfg.n*cfg.n;i++){const b=document.createElement('button');b.className='grid-cell air-cell';b.dataset.i=i;b.addEventListener('click',()=>airstrikeClick(i));grid.appendChild(b);}ensureAirstrikeShared();}
async function airstrikeClick(i){if(!canInteract())return;const now=serverNow(),sr=series(),cfg=airstrikeCfg(),placing=now<sr.startAt+cfg.placeMs,sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='airstrike'||sh.winner)return;
  if(placing){await runTransaction(ref(db,`rooms/${roomCode}/shared/placements/${mySlot}`),cur=>{const arr=arrVal(cur).map(Number);if(arr.length>=cfg.planes||!airCanPlace(arr,i,cfg))return;return [...arr,i];});return;}
  if(sh.turn!==mySlot)return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='airstrike'||cur.winner||cur.turn!==mySlot)return;const myShots=arrVal(cur.shots?.[mySlot]).map(Number);if(myShots.includes(i))return;const op=otherSlot(),opCenters=arrVal(cur.placements?.[op]).map(Number),target=airOccupied(opCenters,cfg.n,cfg.shape),nextShots=[...myShots,i],hit=target.has(i),allHit=[...target].every(x=>nextShots.includes(x)),shots={...(cur.shots||{}),[mySlot]:nextShots};return {...cur,shots,turn:allHit?cur.turn:op,winner:allHit?mySlot:null,lastShot:{by:mySlot,i,hit,at:serverNow()}};});
}
async function autoFillAirstrikeIfNeeded(){const cfg=airstrikeCfg();await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='airstrike')return;let changed=false,placements={...(cur.placements||{})};for(const slot of ['p1','p2']){const arr=arrVal(placements[slot]).map(Number);if(arr.length<cfg.planes){placements[slot]=deterministicAirPlacements(slot,cfg,arr);changed=true;}}return changed?{...cur,placements}:cur;});}
function renderAirstrike(now){const sr=series(),cfg=airstrikeCfg(),sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='airstrike'){ensureAirstrikeShared();return;}const placing=now<sr.startAt+cfg.placeMs;if(!placing&&(arrVal(sh.placements?.p1).length<cfg.planes||arrVal(sh.placements?.p2).length<cfg.planes))autoFillAirstrikeIfNeeded().catch(()=>{});const grid=$('airGrid');if(!grid)return;const ownCenters=arrVal(sh.placements?.[mySlot]).map(Number),ownCells=airOccupied(ownCenters,cfg.n,cfg.shape),myShots=arrVal(sh.shots?.[mySlot]).map(Number),opCenters=arrVal(sh.placements?.[otherSlot()]).map(Number),opCells=airOccupied(opCenters,cfg.n,cfg.shape);[...grid.children].forEach((b,i)=>{b.className='grid-cell air-cell';b.textContent='';if(placing&&ownCells.has(i)){b.classList.add('air-own');b.textContent='✈';}if(!placing&&myShots.includes(i)){if(opCells.has(i)){b.classList.add('correct');b.textContent='💥';}else{b.classList.add('air-miss');b.textContent='·';}}});
  if(placing){const remain=Math.ceil((sr.startAt+cfg.placeMs-now)/1000);$('airInfo').textContent=`🛩️ 布阵 ${remain}s · 点击空白区域放飞机`;$('airCount').textContent=`${ownCenters.length} / ${cfg.planes}`;status=`布阵 ${ownCenters.length}/${cfg.planes}`;progress=clamp(ownCenters.length/cfg.planes*100,0,100);return;}
  const hits=myShots.filter(x=>opCells.has(x)).length,total=opCells.size;$('airCount').textContent=`命中 ${hits}/${total}`;$('airInfo').textContent=sh.winner?(sh.winner===mySlot?'🏆 对方飞机全部击落':'💥 你的飞机已被全部击落'):sh.turn===mySlot?'🎯 轮到你轰炸 · 不会提示飞机中心':`等待 ${opponent()?.name||'对手'} 轰炸`;score=hits*100;progress=total?clamp(hits/total*100,0,100):0;status=sh.turn===mySlot?'你的轰炸回合':'等待对手';if(sh.winner){score=sh.winner===mySlot?1000:score;progress=sh.winner===mySlot?100:progress;scheduleSync(true);}
}

// ---------- Connect Four / 四子棋 ----------
function initConnect4(){gameState={};}
async function ensureConnect4Shared(){await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'connect4',board:'0'.repeat(42),turn:Number(series().roundIndex||0)%2?'p2':'p1',winner:null});}
function mountConnect4(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="connectInfo">等待棋盘同步…</div><div class="connect-board" id="connectBoard"></div><div class="keyboard-guide">按数字键 <span class="key-chip">1</span>–<span class="key-chip">7</span> 快速落子</div></div></div>';for(let i=0;i<42;i++){const b=document.createElement('button');b.className='connect-cell';b.addEventListener('click',()=>connect4Move(i%7));$('connectBoard').appendChild(b);}ensureConnect4Shared();}
function connect4Win(a,idx,v){const r=Math.floor(idx/7),c=idx%7;for(const[dr,dc]of[[1,0],[0,1],[1,1],[1,-1]]){let n=1;for(const s of[-1,1]){let rr=r+dr*s,cc=c+dc*s;while(rr>=0&&rr<6&&cc>=0&&cc<7&&a[rr*7+cc]===v){n++;rr+=dr*s;cc+=dc*s;}}if(n>=4)return true;}return false;}
async function connect4Move(col){if(!canInteract())return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='connect4'||cur.winner||cur.turn!==mySlot)return;const a=(cur.board||'0'.repeat(42)).split('');let idx=-1;for(let r=5;r>=0;r--)if(a[r*7+col]==='0'){idx=r*7+col;break;}if(idx<0)return;const v=mySlot==='p1'?'1':'2';a[idx]=v;const winner=connect4Win(a,idx,v)?mySlot:a.every(x=>x!=='0')?'draw':null;return{...cur,board:a.join(''),turn:winner?cur.turn:otherSlot(),winner,lastMove:idx};});}
function renderConnect4(){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='connect4'){ensureConnect4Shared();return;}const a=(sh.board||'').split('');[...$('connectBoard').children].forEach((b,i)=>b.className=`connect-cell${a[i]==='1'?' p1':a[i]==='2'?' p2':''}`);$('connectInfo').textContent=sh.winner?(sh.winner==='draw'?'棋盘已满 · 平局':`${roomData.players?.[sh.winner]?.name||''} 四子连线！`):sh.turn===mySlot?'轮到你落子 · 不限时':'等待对手落子 · 不限时';if(sh.winner){score=sh.winner===mySlot?1000:sh.winner==='draw'?500:0;progress=sh.winner===mySlot?100:50;status=sh.winner===mySlot?'四子连线':'棋局结束';scheduleSync(true);}else{score=a.filter(x=>x===(mySlot==='p1'?'1':'2')).length*20;progress=clamp(a.filter(x=>x!=='0').length/42*90,0,90);status=sh.turn===mySlot?'你的回合':'等待对手';}}

// ---------- Reversi / 6×6 翻转棋 ----------
function reversiStart(){const a=Array(36).fill('0');a[14]=a[21]='1';a[15]=a[20]='2';return a.join('');}
function reversiFlips(a,i,v){if(a[i]!=='0')return[];const r=Math.floor(i/6),c=i%6,op=v==='1'?'2':'1',all=[];for(const[dr,dc]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let rr=r+dr,cc=c+dc,line=[];while(rr>=0&&rr<6&&cc>=0&&cc<6&&a[rr*6+cc]===op){line.push(rr*6+cc);rr+=dr;cc+=dc;}if(line.length&&rr>=0&&rr<6&&cc>=0&&cc<6&&a[rr*6+cc]===v)all.push(...line);}return all;}
function reversiHasMove(a,v){return a.some((x,i)=>x==='0'&&reversiFlips(a,i,v).length);}
async function ensureReversiShared(){await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'reversi',board:reversiStart(),turn:'p1',winner:null});}
function mountReversi(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="reversiInfo">等待棋盘同步…</div><div class="grid-game" id="reversiBoard" style="grid-template-columns:repeat(6,1fr);width:min(540px,92%);background:#174b3b;padding:10px;border-radius:18px"></div><div class="keyboard-guide">可点击落子；合法位置会显示圆点</div></div></div>';for(let i=0;i<36;i++){const b=document.createElement('button');b.className='grid-cell';b.addEventListener('click',()=>reversiMove(i));$('reversiBoard').appendChild(b);}ensureReversiShared();}
async function reversiMove(i){if(!canInteract())return;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='reversi'||cur.winner||cur.turn!==mySlot)return;const a=(cur.board||reversiStart()).split(''),v=mySlot==='p1'?'1':'2',flips=reversiFlips(a,i,v);if(!flips.length)return;a[i]=v;flips.forEach(x=>a[x]=v);const op=v==='1'?'2':'1';let turn=otherSlot(),winner=null;if(!reversiHasMove(a,op)){if(reversiHasMove(a,v))turn=mySlot;else{const n1=a.filter(x=>x==='1').length,n2=a.filter(x=>x==='2').length;winner=n1===n2?'draw':n1>n2?'p1':'p2';}}return{...cur,board:a.join(''),turn,winner,lastMove:i};});}
function renderReversi(){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='reversi'){ensureReversiShared();return;}const a=(sh.board||reversiStart()).split(''),v=mySlot==='p1'?'1':'2';[...$('reversiBoard').children].forEach((b,i)=>{b.className='grid-cell';b.textContent=a[i]==='1'?'●':a[i]==='2'?'○':(!sh.winner&&sh.turn===mySlot&&reversiFlips(a,i,v).length?'·':'');b.style.fontSize=a[i]==='0'?'24px':'34px';b.style.color=a[i]==='1'?'#101318':a[i]==='2'?'#fff':'rgba(255,255,255,.34)';b.style.background=a[i]==='0'?'rgba(255,255,255,.035)':'rgba(255,255,255,.08)';});const mine=a.filter(x=>x===v).length,op=a.filter(x=>x===(v==='1'?'2':'1')).length;$('reversiInfo').textContent=sh.winner?`棋局结束 · 你 ${mine} : ${op} 对手`:sh.turn===mySlot?`你的回合 · ${mine}:${op}`:`等待对手 · ${mine}:${op}`;score=mine*25;progress=clamp(mine/36*100,0,100);status=sh.turn===mySlot?'你的回合':'等待对手';if(sh.winner){score=sh.winner===mySlot?1000:sh.winner==='draw'?500:0;scheduleSync(true);}}

// ---------- Wall-to-wall climber ----------
function initClimber(){gameState={side:'left',fromX:112,toX:112,x:112,jumpAt:0,height:0,obstacles:[],spawn:0,hits:0,invUntil:0};}
function mountClimber(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="new-game-wrap"><div class="info">点击左 / 右墙来回蹬墙跳 · 躲开墙上的障碍</div><canvas id="climberCanvas" class="game-canvas new-game-canvas" width="760" height="500"></canvas><div class="runner-controls"><button id="climbLeft">← 左墙</button><button id="climbRight">右墙 →</button></div></div></div>';$('climbLeft').onclick=()=>setClimberDir(-1);$('climbRight').onclick=()=>setClimberDir(1);$('climberCanvas').onclick=e=>setClimberDir(e.offsetX<380?-1:1);}
function setClimberDir(d){if(!canInteract())return;const side=d<0?'left':'right';if(side===gameState.side&&gameNow()-gameState.jumpAt<260)return;gameState.side=side;gameState.fromX=gameState.x;gameState.toX=side==='left'?112:648;gameState.jumpAt=gameNow();addScore(12,'蹬墙上升');}
function renderClimber(now,dt){const d=gameDifficulty(),speed={easy:115,medium:145,hard:178,hell:215}[d],t=clamp((now-gameState.jumpAt)/330,0,1),ease=1-(1-t)*(1-t);gameState.x=gameState.fromX+(gameState.toX-gameState.fromX)*ease;gameState.spawn+=dt;const gap={easy:1.35,medium:1.05,hard:.82,hell:.65}[d];while(gameState.spawn>gap){gameState.spawn-=gap;gameState.obstacles.push({side:Math.random()<.5?'left':'right',y:-35,v:speed*(.9+Math.random()*.35),hit:false});}for(const o of gameState.obstacles){o.y+=o.v*dt;if(!o.hit&&o.y>385&&o.y<470&&o.side===gameState.side&&t>.82&&now>gameState.invUntil){o.hit=true;gameState.invUntil=now+850;gameState.hits++;addScore(-100,'撞到墙刺');}}gameState.obstacles=gameState.obstacles.filter(o=>o.y<530);gameState.height+=dt*18;score=Math.max(score,Math.floor(gameState.height*10));progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`已爬 ${Math.floor(gameState.height)} 层`;const cv=$('climberCanvas'),ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);ctx.fillStyle='#081322';ctx.fillRect(0,0,760,500);ctx.fillStyle='#27364c';ctx.fillRect(38,0,58,500);ctx.fillRect(664,0,58,500);ctx.strokeStyle='rgba(87,231,255,.25)';ctx.setLineDash([10,12]);ctx.beginPath();ctx.moveTo(96,0);ctx.lineTo(96,500);ctx.moveTo(664,0);ctx.lineTo(664,500);ctx.stroke();ctx.setLineDash([]);for(const o of gameState.obstacles){const x=o.side==='left'?96:664;ctx.fillStyle=o.hit?'#693744':'#ff8b63';ctx.beginPath();ctx.moveTo(x,o.y-22);ctx.lineTo(x+(o.side==='left'?32:-32),o.y);ctx.lineTo(x,o.y+22);ctx.fill();}const arc=Math.sin(Math.PI*t)*92,py=420-arc;ctx.fillStyle=now<gameState.invUntil?'#ff778b':'#61e6a9';ctx.fillRect(gameState.x-17,py,34,44);ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='14px sans-serif';ctx.fillText('A / ← 左墙　　D / → 右墙',275,28);}

// ---------- Mini racer ----------
function initRacer(){gameState={lane:1,x:380,obstacles:[],spawn:0,passed:0};}
function mountRacer(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="new-game-wrap"><div class="info">A/D 或 ←/→ 变道 · 躲车与路障</div><canvas id="racerCanvas" class="game-canvas new-game-canvas" width="760" height="500"></canvas><div class="runner-controls"><button id="raceLeft">←</button><button id="raceRight">→</button></div></div></div>';$('raceLeft').onclick=()=>racerMove(-1);$('raceRight').onclick=()=>racerMove(1);}
function racerMove(d){if(canInteract())gameState.lane=clamp(gameState.lane+d,0,2);}
function renderRacer(now,dt){const d=gameDifficulty(),cfg={easy:[150,1.15],medium:[190,.92],hard:[235,.7],hell:[285,.52]}[d];gameState.spawn+=dt;while(gameState.spawn>cfg[1]){gameState.spawn-=cfg[1];gameState.obstacles.push({lane:Math.floor(Math.random()*3),y:-80,v:cfg[0]*(.85+Math.random()*.35),hit:false});}const lanes=[260,380,500];gameState.x+=(lanes[gameState.lane]-gameState.x)*Math.min(1,dt*12);for(const o of gameState.obstacles){o.y+=o.v*dt;if(!o.hit&&o.y>390&&o.y<490&&o.lane===gameState.lane){o.hit=true;addScore(-120,'碰撞 -120');}if(!o.counted&&o.y>500){o.counted=true;gameState.passed++;addScore(55,'安全超车 +55');}}gameState.obstacles=gameState.obstacles.filter(o=>o.y<570);progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`安全通过 ${gameState.passed}`;const cv=$('racerCanvas'),ctx=cv.getContext('2d');ctx.clearRect(0,0,760,500);ctx.fillStyle='#10151d';ctx.fillRect(0,0,760,500);ctx.fillStyle='#252b35';ctx.fillRect(190,0,380,500);ctx.strokeStyle='rgba(255,255,255,.42)';ctx.setLineDash([24,22]);for(const x of[320,440]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,500);ctx.stroke();}ctx.setLineDash([]);ctx.fillStyle='#57e7ff';ctx.fillRect(gameState.x-24,410,48,76);for(const o of gameState.obstacles){ctx.fillStyle=o.hit?'#55323a':'#ff7ac8';ctx.fillRect(lanes[o.lane]-24,o.y,48,70);}}

// ---------- Simple fighter ----------
function initFighter(){gameState={fighterX:.22,lastMoveSync:0};}
async function ensureFighterShared(){await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>cur?.roundId===roundId?cur:{roundId,game:'fighter',players:{p1:{x:.22,hp:100,block:false},p2:{x:.78,hp:100,block:false}},winner:null,lastAttackAt:{}});}
function mountFighter(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="new-game-wrap"><div class="info" id="fighterInfo">靠近对手后攻击 · 防御可减伤</div><canvas id="fighterCanvas" class="game-canvas new-game-canvas" width="760" height="430"></canvas><div class="fighter-controls"><button id="fightLeft">←</button><button id="fightRight">→</button><button id="fightBlock">防御</button><button id="fightLight" class="attack">轻拳</button><button id="fightHeavy" class="attack">重拳</button></div></div></div>';$('fightLeft').onclick=()=>moveFighter(-1);$('fightRight').onclick=()=>moveFighter(1);$('fightLight').onclick=()=>fighterAttack('light');$('fightHeavy').onclick=()=>fighterAttack('heavy');const b=$('fightBlock');b.addEventListener('pointerdown',()=>fighterBlock(true));b.addEventListener('pointerup',()=>fighterBlock(false));b.addEventListener('pointercancel',()=>fighterBlock(false));ensureFighterShared();}
function moveFighter(d){const sh=roomData?.shared;if(!canInteract()||!sh?.players?.[mySlot])return;const x=clamp(Number(sh.players[mySlot].x)+d*.055,.08,.92);update(ref(db,`rooms/${roomCode}/shared/players/${mySlot}`),{x}).catch(()=>{});}
function fighterBlock(v){if(canInteract())update(ref(db,`rooms/${roomCode}/shared/players/${mySlot}`),{block:!!v}).catch(()=>{});}
async function fighterAttack(kind){if(!canInteract())return;const now=serverNow(),cool=kind==='heavy'?850:430,base=kind==='heavy'?20:9;await runTransaction(ref(db,`rooms/${roomCode}/shared`),cur=>{if(!cur||cur.roundId!==roundId||cur.game!=='fighter'||cur.winner)return;const last=Number(cur.lastAttackAt?.[mySlot]||0);if(now-last<cool)return;const meP=cur.players?.[mySlot],op=otherSlot(),opP=cur.players?.[op];if(!meP||!opP)return;const hit=Math.abs(Number(meP.x)-Number(opP.x))<.23,damage=hit?Math.round(base*(opP.block?.35:1)):0,hp=Math.max(0,Number(opP.hp)-damage),players={...cur.players,[op]:{...opP,hp}},lastAttackAt={...(cur.lastAttackAt||{}),[mySlot]:now};return{...cur,players,lastAttackAt,winner:hp<=0?mySlot:null,lastAttack:{by:mySlot,kind,hit,damage,at:now}};});}
function renderFighter(now){const sh=roomData?.shared;if(!sh||sh.roundId!==roundId||sh.game!=='fighter'){ensureFighterShared();return;}const p1=sh.players?.p1||{x:.22,hp:100},p2=sh.players?.p2||{x:.78,hp:100},mine=sh.players?.[mySlot]||p1,op=sh.players?.[otherSlot()]||p2,cv=$('fighterCanvas');if(!cv)return;const ctx=cv.getContext('2d');ctx.clearRect(0,0,760,430);ctx.fillStyle='#0a1020';ctx.fillRect(0,0,760,430);ctx.fillStyle='#1b2233';ctx.fillRect(0,365,760,65);for(const [slot,p] of Object.entries({p1,p2})){const x=Number(p.x)*760,col=slot==='p1'?'#57e7ff':'#ff7ac8';ctx.fillStyle=col;ctx.fillRect(x-25,275,50,90);ctx.beginPath();ctx.arc(x,250,28,0,TAU);ctx.fill();if(p.block){ctx.strokeStyle='#ffd16a';ctx.lineWidth=7;ctx.beginPath();ctx.arc(x,305,48,-1.1,1.1);ctx.stroke();}}ctx.fillStyle='#263047';ctx.fillRect(35,25,300,18);ctx.fillRect(425,25,300,18);ctx.fillStyle='#57e7ff';ctx.fillRect(35,25,300*Number(p1.hp)/100,18);ctx.fillStyle='#ff7ac8';ctx.fillRect(725-300*Number(p2.hp)/100,25,300*Number(p2.hp)/100,18);$('fighterInfo').textContent=sh.winner?(sh.winner===mySlot?'🏆 KO！你赢了':'💥 你被 KO 了'):`你 ${mine.hp} HP · 对手 ${op.hp} HP · J轻拳 K重拳 L防御`;score=Math.max(0,(100-Number(op.hp))*10);progress=clamp(score/10,0,100);status=sh.winner?'KO':`生命 ${mine.hp}`;if(sh.winner)scheduleSync(true);}

// ---------- Drum rhythm ----------
function drumKeys(){return ['easy','medium'].includes(gameDifficulty())?['d','f','j','k']:['s','d','f','j','k','l'];}
function initDrum(){gameState={keys:drumKeys(),notes:[],spawn:0,combo:0,hits:0,miss:0};}
function mountDrum(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="new-game-wrap"><div class="info">音符到达判定线时按对应键</div><canvas id="drumCanvas" class="game-canvas new-game-canvas" width="760" height="500"></canvas><div id="drumKeys" class="drum-keys"></div></div></div>';$('drumKeys').innerHTML=gameState.keys.map(k=>`<button class="drum-key" data-drum="${k}">${k.toUpperCase()}</button>`).join('');document.querySelectorAll('[data-drum]').forEach(b=>bindFastPress(b,()=>hitDrum(b.dataset.drum)));}
function hitDrum(k){if(!canInteract())return;const lane=gameState.keys.indexOf(k);if(lane<0)return;let best=null,dist=999;for(const n of gameState.notes)if(!n.hit&&n.lane===lane){const d=Math.abs(n.y-425);if(d<dist){dist=d;best=n;}}const key=document.querySelector(`[data-drum="${k}"]`);if(best&&dist<72){best.hit=true;gameState.combo++;gameState.hits++;addScore(dist<25?120:80,dist<25?'PERFECT':'GOOD');flashElement(key,true);}else{gameState.combo=0;addScore(-20,'MISS');flashElement(key,false);}}
function renderDrum(now,dt){const cfg={easy:[145,.72],medium:[180,.56],hard:[220,.43],hell:[270,.34]}[gameDifficulty()],rush=effects.speedUntil>now?1.35:1;gameState.spawn+=dt*rush;while(gameState.spawn>cfg[1]){gameState.spawn-=cfg[1];gameState.notes.push({lane:Math.floor(Math.random()*gameState.keys.length),y:-25,hit:false,missed:false});}for(const n of gameState.notes){n.y+=cfg[0]*dt*rush;if(!n.hit&&!n.missed&&n.y>485){n.missed=true;gameState.combo=0;gameState.miss++;addScore(-15,'MISS');}}gameState.notes=gameState.notes.filter(n=>n.y<530&&!n.hit);const cv=$('drumCanvas'),ctx=cv.getContext('2d'),lanes=gameState.keys.length,w=700/lanes;ctx.clearRect(0,0,760,500);ctx.fillStyle='#09111f';ctx.fillRect(0,0,760,500);for(let i=0;i<lanes;i++){const x=30+i*w;ctx.fillStyle=i%2?'rgba(255,255,255,.025)':'rgba(87,231,255,.035)';ctx.fillRect(x,0,w,500);ctx.strokeStyle='rgba(255,255,255,.1)';ctx.strokeRect(x,0,w,500);}ctx.fillStyle='rgba(255,209,106,.28)';ctx.fillRect(30,420,700,12);for(const n of gameState.notes){const x=30+n.lane*w+w/2;ctx.fillStyle='#57e7ff';ctx.beginPath();ctx.arc(x,n.y,22,0,TAU);ctx.fill();ctx.fillStyle='#07111b';ctx.font='900 16px sans-serif';ctx.textAlign='center';ctx.fillText(gameState.keys[n.lane].toUpperCase(),x,n.y+6);}ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 24px sans-serif';ctx.fillText(`COMBO ${gameState.combo}`,34,38);progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`命中 ${gameState.hits} · 连击 ${gameState.combo}`;}

// ---------- Sequential digit memory ----------
function digitSequence(round,len){return Array.from({length:len},(_,i)=>randInt(`${roundId}:digit:${round}:${i}`,0,9)).join('');}
function initDigitMemory(){gameState={round:0,streak:0,startAt:Number(series().startAt||gameNow()),sequence:'',submitted:false};}
function newDigitRound(delay=650){gameState.round++;const len=Math.min(12,3+gameState.streak+Math.floor(gameState.round/3));gameState.sequence=digitSequence(gameState.round,len);gameState.startAt=gameNow()+delay;gameState.submitted=false;if($('brainAnswer')){$('brainAnswer').value='';$('brainAnswer').disabled=true;}}
function mountDigitMemory(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="brainPrompt">准备记忆</div><div class="big-number" id="brainDisplay">·</div><div class="brain-input"><input id="brainAnswer" inputmode="numeric" autocomplete="off" placeholder="按顺序输入"><button id="brainSubmit">确认</button></div></div></div>';$('brainSubmit').onclick=submitDigitMemory;$('brainAnswer').onkeydown=e=>{if(e.key==='Enter')submitDigitMemory();};newDigitRound(0);}
function submitDigitMemory(){if(!canInteract()||$('brainAnswer').disabled)return;const good=$('brainAnswer').value===gameState.sequence;flashElement($('brainAnswer'),good);if(good){gameState.streak++;addScore(140+gameState.sequence.length*18,'记忆正确');}else{gameState.streak=Math.max(0,gameState.streak-1);addScore(-45,`正确答案 ${gameState.sequence}`);}gameState.submitted=true;newDigitRound(850);}
function renderDigitMemory(now){const elapsed=now-gameState.startAt,len=gameState.sequence.length,showMs=len*620;if(elapsed<0){$('brainDisplay').textContent='·';$('brainPrompt').textContent='准备';}else if(elapsed<showMs){$('brainDisplay').textContent=gameState.sequence[Math.floor(elapsed/620)];$('brainPrompt').textContent=`记住第 ${Math.floor(elapsed/620)+1}/${len} 位`;$('brainAnswer').disabled=true;}else{$('brainDisplay').textContent='？';$('brainPrompt').textContent=`输入刚才的 ${len} 位数字`;$('brainAnswer').disabled=false;if(document.activeElement!==$('brainAnswer'))$('brainAnswer').focus({preventScroll:true});}progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`连续答对 ${gameState.streak}`;}

// ---------- Dot count ----------
function initDotCount(){gameState={round:0,count:0,startAt:Number(series().startAt||gameNow()),answered:false};}
function newDotRound(delay=500){gameState.round++;const max={easy:9,medium:14,hard:20,hell:28}[gameDifficulty()];gameState.count=randInt(`${roundId}:dots:${gameState.round}`,3,max);gameState.startAt=gameNow()+delay;gameState.answered=false;if($('dotAnswer')){$('dotAnswer').value='';$('dotAnswer').disabled=true;}}
function mountDotCount(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="dotPrompt">数一数有几个小球</div><canvas id="dotCanvas" class="game-canvas" width="680" height="350"></canvas><div class="brain-input"><input id="dotAnswer" type="number" inputmode="numeric" min="0" placeholder="输入数量"><button id="dotSubmit">确认</button></div></div></div>';$('dotSubmit').onclick=submitDotCount;$('dotAnswer').onkeydown=e=>{if(e.key==='Enter')submitDotCount();};newDotRound(0);}
function submitDotCount(){if(!canInteract()||$('dotAnswer').disabled)return;const good=Number($('dotAnswer').value)===gameState.count;flashElement($('dotAnswer'),good);addScore(good?120:-35,good?'数量正确':`正确数量是 ${gameState.count}`);newDotRound(650);}
function renderDotCount(now){const reveal=now-gameState.startAt<1900,cv=$('dotCanvas'),ctx=cv.getContext('2d');ctx.clearRect(0,0,680,350);ctx.fillStyle='#09131e';ctx.fillRect(0,0,680,350);if(reveal&&now>=gameState.startAt)for(let i=0;i<gameState.count;i++){const x=35+random01(`${roundId}:dx:${gameState.round}:${i}`)*610,y=35+random01(`${roundId}:dy:${gameState.round}:${i}`)*280;ctx.fillStyle='#61e6a9';ctx.beginPath();ctx.arc(x,y,10,0,TAU);ctx.fill();}const answer=!reveal&&now>=gameState.startAt;$('dotAnswer').disabled=!answer;$('dotPrompt').textContent=answer?'刚才有几个小球？':'快速数清小球';progress=clamp((now-series().startAt)/(Number(series().endAt||now+1)-series().startAt)*100,0,100);status=`第 ${gameState.round} 组`;}

// ---------- Number cancellation and linking ----------
function initNumberErase(){gameState={round:0,target:0,values:[],done:new Set()};nextNumberErase();}
function nextNumberErase(){gameState.round++;gameState.target=randInt(`${roundId}:erase:t:${gameState.round}`,0,9);gameState.values=Array.from({length:80},(_,i)=>i<12?gameState.target:randInt(`${roundId}:erase:${gameState.round}:${i}`,0,9));gameState.values=shuffleDet(gameState.values,`${roundId}:erase:s:${gameState.round}`);gameState.done=new Set();}
function mountNumberErase(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="eraseInfo"></div><div class="number-wall" id="eraseWall"></div></div></div>';renderNumberErase();}
function hitNumberErase(i,b){if(!canInteract()||gameState.done.has(i))return;const good=gameState.values[i]===gameState.target;flashElement(b,good);if(good){gameState.done.add(i);b.classList.add('selected');addScore(22,'找到目标');if(gameState.done.size===gameState.values.filter(x=>x===gameState.target).length){addScore(160,'全部找完');nextNumberErase();renderNumberErase();}}else addScore(-18,'不是目标');}
function renderNumberErase(){const wall=$('eraseWall');if(!wall)return;$('eraseInfo').textContent=`划掉所有数字「${gameState.target}」 · 已找到 ${gameState.done.size}`;if(wall.dataset.round!==String(gameState.round)){wall.dataset.round=gameState.round;wall.innerHTML='';gameState.values.forEach((v,i)=>{const b=document.createElement('button');b.className='grid-cell';b.textContent=v;b.onclick=()=>hitNumberErase(i,b);wall.appendChild(b);});}progress=clamp(gameState.done.size/Math.max(1,gameState.values.filter(x=>x===gameState.target).length)*100,0,100);status=`目标 ${gameState.target}`;}
function initNumberLink(){gameState={round:0,next:1,total:20,values:[]};nextNumberLink();}
function nextNumberLink(){gameState.round++;gameState.next=1;gameState.values=shuffleDet(Array.from({length:20},(_,i)=>i+1),`${roundId}:link:${gameState.round}`);}
function mountNumberLink(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="linkInfo"></div><div class="grid-game schulte-grid size-5 colorful" id="linkGrid" style="grid-template-columns:repeat(5,1fr)"></div></div></div>';renderNumberLink();}
function hitNumberLink(v,b){if(!canInteract())return;const good=v===gameState.next;flashElement(b,good);if(good){b.disabled=true;gameState.next++;addScore(38,'顺序正确');if(gameState.next>20){addScore(240,'完成连线');nextNumberLink();renderNumberLink();}}else addScore(-22,`下一个是 ${gameState.next}`);}
function renderNumberLink(){const grid=$('linkGrid');if(!grid)return;$('linkInfo').textContent=`按 1 → 20 连接 · 下一个 ${gameState.next}`;if(grid.dataset.round!==String(gameState.round)){grid.dataset.round=gameState.round;grid.innerHTML='';gameState.values.forEach((v,i)=>{const b=document.createElement('button');b.className='schulte-cell';b.textContent=v;b.style.setProperty('--cellHue',String((i*47)%360));b.onclick=()=>hitNumberLink(v,b);grid.appendChild(b);});}progress=(gameState.next-1)/20*100;status=`${gameState.next-1}/20`;}

// ---------- Classic Klotski ----------
function initKlotski(){gameState={selected:'cao',moves:0,blocks:[{id:'cao',name:'曹操',x:1,y:0,w:2,h:2},{id:'zhao',name:'赵云',x:0,y:0,w:1,h:2},{id:'huang',name:'黄忠',x:3,y:0,w:1,h:2},{id:'guan',name:'关羽',x:1,y:2,w:2,h:1},{id:'ma',name:'马超',x:0,y:2,w:1,h:2},{id:'zhang',name:'张飞',x:3,y:2,w:1,h:2},{id:'s1',name:'兵',x:1,y:3,w:1,h:1},{id:'s2',name:'兵',x:2,y:3,w:1,h:1},{id:'s3',name:'兵',x:0,y:4,w:1,h:1},{id:'s4',name:'兵',x:3,y:4,w:1,h:1}]};}
function mountKlotski(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="klotskiInfo">选择棋子，用方向键移动</div><div class="klotski-board" id="klotskiBoard"></div><div class="runner-controls"><button data-kl="0,-1">↑</button><button data-kl="-1,0">←</button><button data-kl="1,0">→</button><button data-kl="0,1">↓</button></div></div></div>';document.querySelectorAll('[data-kl]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.kl.split(',').map(Number);moveKlotski(x,y);});renderKlotski();}
function moveKlotski(dx,dy){if(!canInteract())return;const p=gameState.blocks.find(x=>x.id===gameState.selected);if(!p)return;const nx=p.x+dx,ny=p.y+dy;if(nx<0||ny<0||nx+p.w>4||ny+p.h>5){flashElement(document.querySelector(`[data-block="${p.id}"]`),false);return;}const hit=gameState.blocks.some(o=>o!==p&&nx<o.x+o.w&&nx+p.w>o.x&&ny<o.y+o.h&&ny+p.h>o.y);if(hit){flashElement(document.querySelector(`[data-block="${p.id}"]`),false);return;}p.x=nx;p.y=ny;gameState.moves++;addScore(8,'移动棋子');renderKlotski();flashElement(document.querySelector(`[data-block="${p.id}"]`),true);if(p.id==='cao'&&p.x===1&&p.y===3){addScore(900,'曹操脱身！');status='华容道完成';}}
function renderKlotski(){const board=$('klotskiBoard');if(!board)return;board.innerHTML='';for(const p of gameState.blocks){const b=document.createElement('button');b.dataset.block=p.id;b.className='klotski-block '+(p.id==='cao'?'boss ':'')+(gameState.selected===p.id?'selected':'');b.textContent=p.name;b.style.gridColumn=`${p.x+1}/span ${p.w}`;b.style.gridRow=`${p.y+1}/span ${p.h}`;b.onclick=()=>{gameState.selected=p.id;renderKlotski();};board.appendChild(b);}$('klotskiInfo').textContent=`${gameState.blocks.find(x=>x.id===gameState.selected)?.name||''} · ${gameState.moves} 步 · 让曹操到底部中间`;progress=clamp(gameState.blocks.find(x=>x.id==='cao').y/3*100,0,100);status=`华容道 ${gameState.moves} 步`;}

// ---------- Solo Sudoku ----------
function sudokuSolution(){return Array.from({length:81},(_,i)=>(Math.floor(i/9)*3+Math.floor(Math.floor(i/9)/3)+i%9)%9+1);}
function initSudoku(){const sol=sudokuSolution(),board=[...sol],fixed=new Set();for(let i=0;i<81;i++){const keep=random01(`${roundId}:sdk:${i}`)>.53;if(keep)fixed.add(i);else board[i]=0;}gameState={solution:sol,board,fixed,selected:null,errors:0};}
function mountSudoku(){els.gameSurface.innerHTML='<div class="stage-inner"><div class="choice-wrap"><div class="info" id="sudokuInfo">选择空格，再按 1–9</div><div class="sudoku" id="sudokuBoard"></div><div class="keyboard-guide">数字键填写 · Backspace 清除</div></div></div>';renderSudoku();}
function selectSudoku(i){if(!gameState.fixed.has(i)){gameState.selected=i;renderSudoku();}}
function fillSudoku(n){const i=gameState.selected;if(i==null||gameState.fixed.has(i)||!canInteract())return;if(n===0){gameState.board[i]=0;renderSudoku();return;}const good=n===gameState.solution[i];if(good){gameState.board[i]=n;addScore(35,'填写正确');const next=gameState.board.findIndex((v,j)=>!v&&!gameState.fixed.has(j));gameState.selected=next<0?i:next;if(gameState.board.every((v,j)=>v===gameState.solution[j]))addScore(800,'数独完成');}else{gameState.errors++;addScore(-20,'数字不对');}renderSudoku();flashElement($('sudokuBoard').children[i],good);}
function renderSudoku(){const board=$('sudokuBoard');if(!board)return;board.innerHTML='';gameState.board.forEach((v,i)=>{const b=document.createElement('button');b.className='sudoku-cell'+(gameState.fixed.has(i)?' given':'')+(gameState.selected===i?' selected':'');b.textContent=v||'';b.onclick=()=>selectSudoku(i);board.appendChild(b);});$('sudokuInfo').textContent=`错误 ${gameState.errors} · 已填 ${gameState.board.filter(Boolean).length}/81`;progress=gameState.board.filter(Boolean).length/81*100;status=`数独 ${Math.round(progress)}%`;}

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
  els.themeBtn.addEventListener('click',toggleTheme);
  els.soloBtn.addEventListener('click',openSoloLobby);els.soloBackHomeBtn.addEventListener('click',leaveSoloToHome);els.soloStartBtn.addEventListener('click',startSoloTraining);els.soloReplayBtn.addEventListener('click',startSoloTraining);els.soloSettingsBtn.addEventListener('click',openSoloLobby);els.soloResultHomeBtn.addEventListener('click',leaveSoloToHome);
  els.createBtn.addEventListener('click',createRoom);els.joinBtn.addEventListener('click',()=>joinRoom());els.readyBtn.addEventListener('click',toggleReady);els.cancelSeriesBtn.addEventListener('click',cancelSeries);els.leaveBtn.addEventListener('click',()=>leaveRoom(true));els.resultLeaveBtn.addEventListener('click',()=>leaveRoom(true));els.backLobbyBtn.addEventListener('click',backToLobby);
  els.gameExitBtn.addEventListener('click',openExitModal);els.resumeGameBtn.addEventListener('click',closeExitModal);els.forfeitRoundBtn.addEventListener('click',forfeitCurrentRound);els.endSeriesBtn.addEventListener('click',endSeriesToLobby);els.leaveRoomNowBtn.addEventListener('click',leaveRoomNow);els.exitModal.addEventListener('click',e=>{if(e.target===els.exitModal)closeExitModal();});
  els.copyRoomBtn.addEventListener('click',async()=>{const url=`${location.origin}${location.pathname}?room=${roomCode}`;try{await navigator.clipboard.writeText(`${url}\n房间码：${roomCode}`);els.roomHint.textContent='邀请链接 + 房间码已复制';setTimeout(()=>els.roomHint.textContent='房间会保留，之后可以继续用同一个房间码回来',1700);}catch{els.roomHint.textContent=`房间码：${roomCode}`;}});
  els.historyBtn.addEventListener('click',openHistory);els.resultHistoryBtn.addEventListener('click',openHistory);els.closeHistoryBtn.addEventListener('click',()=>els.historyDrawer.classList.remove('show'));els.historyDrawer.addEventListener('click',e=>{if(e.target===els.historyDrawer)els.historyDrawer.classList.remove('show');});
  els.continueBtn.addEventListener('click',()=>{const name=localStorage.getItem('duopk_nickname'),code=localStorage.getItem('duopk_lastRoom');if(name)els.nickname.value=name;if(code)joinRoom(code);});
  els.roomInput.addEventListener('input',()=>els.roomInput.value=els.roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>updateSetting({mode:b.dataset.mode})));
  document.querySelectorAll('[data-rounds]').forEach(b=>b.addEventListener('click',()=>updateSetting({rounds:Number(b.dataset.rounds)})));
  document.querySelectorAll('[data-diff]').forEach(b=>b.addEventListener('click',()=>updateAllGameSettings({difficulty:b.dataset.diff})));
  els.durationRange.addEventListener('input',()=>{els.durationLabel.textContent=`${els.durationRange.value} 秒`;els.durationBox.textContent=`${els.durationRange.value}s`;});els.durationRange.addEventListener('change',()=>updateAllGameSettings({durationSec:Number(els.durationRange.value)}));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderGameLibrary();}));
  document.querySelectorAll('[data-solo-diff]').forEach(b=>b.addEventListener('click',()=>updateSoloQuick({difficulty:b.dataset.soloDiff})));
  els.soloDurationRange.addEventListener('input',()=>updateSoloQuick({durationSec:Number(els.soloDurationRange.value)}));
  document.querySelectorAll('[data-solo-filter]').forEach(b=>b.addEventListener('click',()=>{soloFilter=b.dataset.soloFilter;document.querySelectorAll('[data-solo-filter]').forEach(x=>x.classList.toggle('active',x===b));renderSoloGameLibrary();}));
  els.closeGameSettingsBtn.addEventListener('click',closeGameSettings);els.saveGameSettingsBtn.addEventListener('click',()=>persistGameSettings(false));els.resetGameSettingsBtn.addEventListener('click',()=>persistGameSettings(true));els.gameSettingsModal.addEventListener('click',e=>{if(e.target===els.gameSettingsModal)closeGameSettings();});
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(els.exitModal.classList.contains('show'))closeExitModal();else if((soloMode&&series().status==='round')||(roomCode&&series().status!=='lobby'))openExitModal();return;}
    if(localPhase!=='playing')return;const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)&&['tetris','runner','plane','climber','racer','2048'].includes(activeGame))e.preventDefault();if(activeGame==='reaction'&&(k===' '||k==='enter')){e.preventDefault();hitReaction();}
    else if(activeGame==='number'){if(k==='a'||k==='arrowleft'||k==='1')hitNumber('L');else if(k==='d'||k==='arrowright'||k==='2')hitNumber('R');}
    else if(activeGame==='color'&&/^[1-8]$/.test(k)){const x=colorInfo(gameNow()),i=Number(k)-1;if(i<x.opts.length)hitColor(x.opts[i]);}
    else if(activeGame==='tracking'&&/^[1-9]$/.test(k)){hitTrackingByIndex(Number(k)-1);}
    else if(activeGame==='memory'&&/^[1-9]$/.test(k)){hitMemory(Number(k)-1);}
    else if(activeGame==='memorySequence'&&/^[1-9]$/.test(k)){hitMemorySequence(Number(k)-1);}
    else if(activeGame==='2048'){const m={arrowleft:'left',a:'left',arrowright:'right',d:'right',arrowup:'up',w:'up',arrowdown:'down',s:'down'}[k];if(m){e.preventDefault();move2048(m);}}
    else if(activeGame==='tetris'){if(k==='arrowleft'||k==='a')tetrisMove(-1);else if(k==='arrowright'||k==='d')tetrisMove(1);else if(k==='arrowup'||k==='w')tetrisRotate();else if(k==='arrowdown'||k==='s')tetrisDrop();}
    else if(activeGame==='runner'){if(k===' '||k==='arrowup'||k==='w'){e.preventDefault();runnerJump();}else if(k==='arrowdown'||k==='s')runnerCrouch(true);}
    else if(activeGame==='plane'){if(k==='arrowleft'||k==='a')gameState.x=clamp(gameState.x-30,28,732);else if(k==='arrowright'||k==='d')gameState.x=clamp(gameState.x+30,28,732);}
    else if(activeGame==='tug'&&(k===' '||k==='enter')){e.preventDefault();hitTug();}
    else if(activeGame==='tugRhythm'&&(k===' '||k==='enter')){e.preventDefault();hitTugRhythm();}
    else if(activeGame==='duelShooter'){if(k==='arrowup'||k==='w'){e.preventDefault();setDuelY(gameState.duelY-.07);}else if(k==='arrowdown'||k==='s'){e.preventDefault();setDuelY(gameState.duelY+.07);}else if(k===' '||k==='enter'){e.preventDefault();fireDuel();}}
    else if(activeGame==='stackTower'&&(k===' '||k==='enter')){e.preventDefault();dropStackBlock();}
    else if(activeGame==='needle'&&(k===' '||k==='enter')){e.preventDefault();insertNeedle();}
    else if(activeGame==='connect4'&&/^[1-7]$/.test(k))connect4Move(Number(k)-1);
    else if(activeGame==='climber'){if(k==='a'||k==='arrowleft')setClimberDir(-1);else if(k==='d'||k==='arrowright')setClimberDir(1);}
    else if(activeGame==='racer'){if(k==='a'||k==='arrowleft')racerMove(-1);else if(k==='d'||k==='arrowright')racerMove(1);}
    else if(activeGame==='fighter'){if(k==='a'||k==='arrowleft')moveFighter(-1);else if(k==='d'||k==='arrowright')moveFighter(1);else if(k==='j')fighterAttack('light');else if(k==='k')fighterAttack('heavy');else if(k==='l')fighterBlock(true);}
    else if(activeGame==='drum'&&gameState.keys?.includes(k)){e.preventDefault();hitDrum(k);}
    else if(activeGame==='klotski'){const m={arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0],arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1]}[k];if(m){e.preventDefault();moveKlotski(...m);}}
    else if(activeGame==='sudoku'){if(/^[1-9]$/.test(k))fillSudoku(Number(k));else if(k==='backspace'||k==='delete')fillSudoku(0);}
  });
  window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(activeGame==='runner'&&(k==='s'||k==='arrowdown'))runnerCrouch(false);if(activeGame==='fighter'&&k==='l')fighterBlock(false);});
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

applyTheme(localStorage.getItem('duopk_theme')||'dark');bind();renderGameLibrary();renderSoloSettings();renderSoloGameLibrary();
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
