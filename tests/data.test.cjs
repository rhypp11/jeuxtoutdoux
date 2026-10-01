const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const D = require('../jtd-data.js');
const game = (extra = {}) => ({id:'g',nom:'Persona',plateforme:'PC',format:'Numérique',...extra});
function memory(){
  const values = new Map();
  return {values,getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
}
test('v2 backup preserves flags, purchases and partial dates', () => {
  const result = D.parseBackup({app:'Jeux Tout Doux',version:2,data:{games:[game({collector:true,japanese:true,prix:12.5,date:'2026-10-01',source:'Steam'})],wishlist:[game({id:'w',date:'2027',lien:'https://example.com'})],arrivals:[],profile:{name:'Rom',avatar:null}}});
  assert.equal(result.games[0].japanese,true);
  assert.equal(result.games[0].prix,12.5);
  assert.equal(result.games[0].source,'Steam');
  assert.equal(result.wishlist[0].date,'2027');
  assert.equal(result.profileName,'Rom');
});
test('legacy arrays migrate collector and numeric, missing or duplicate ids', () => {
  const data = D.parseBackup([game({id:12,format:'Collector'}),game({id:12}),game({id:undefined})]);
  assert.equal(data.games[0].id,'12');
  assert.equal(data.games[0].collector,true);
  assert.equal(data.games[0].format,'Physique');
  assert.equal(new Set(data.games.map(g=>g.id)).size,3);
});
test('malformed sections, profile, prices, metadata and future versions are rejected', () => {
  for(const data of [{games:[],wishlist:'bad'},{games:[game({nom:''})]},{games:[game({prix:'20'})]},{games:[game({date:{}})]},{games:[],platformMeta:{PC:'bad'}},{games:[],platformMeta:{PC:{color:'red;display:none'}}},{games:[],platformOrder:[{}]},{games:[],profile:[]}]) assert.throws(()=>D.parseBackup(data));
  for(const version of [3,'3','2',null]) assert.throws(()=>D.parseBackup({app:'Jeux Tout Doux',version,data:{games:[]}}));
});
test('text and URLs do not become markup or script protocols', () => {
  assert.equal(D.escapeHTML('<img src=x onerror="x"> & \'x\''),'&lt;img src=x onerror=&quot;x&quot;&gt; &amp; &#39;x&#39;');
  for(const url of ['javascript:alert(1)','data:text/html,test','https://user:pass@example.com','<img>']) assert.equal(D.safeURL(url),'');
  assert.equal(D.safeURL('data:image/png;base64,AAAA',true),'data:image/png;base64,AAAA');
  assert.equal(D.safeURL('data:image/svg+xml;base64,AAAA',true),'');
  const item = D.parseBackup([game({image:'javascript:alert(1)',lien:'javascript:alert(1)'})]).games[0];
  assert.equal(item.image,null); assert.equal(item.lien,null);
});
test('account storage never falls back to legacy or another account', () => {
  const raw = memory(), storage = D.createStorage(raw);
  raw.setItem('games','legacy');
  storage.setAccount('A'); assert.equal(storage.getItem('games'),null);
  storage.setItem('games','A-data');
  storage.setAccount('B'); assert.equal(storage.getItem('games'),null);
  storage.setItem('games','B-data');
  storage.setAccount('A'); assert.equal(storage.getItem('games'),'A-data');
  assert.equal(raw.getItem('games'),'legacy');
  storage.setAccount(null); assert.throws(()=>storage.setItem('games','oops'));
});
test('a quota error rolls back all writes instead of persisting a partial restore', () => {
  const raw = memory(), storage = D.createStorage(raw);storage.setAccount('A');
  storage.setItem('games','old-games');storage.setItem('wishlist','old-wishes');
  const original = raw.setItem; raw.setItem = (key,value) => {if(value==='new-wishes') throw new Error('quota');original(key,value);};
  assert.throws(()=>storage.atomicWrite([['games','new-games'],['wishlist','new-wishes']]),/annulée/);
  assert.equal(storage.getItem('games'),'old-games');assert.equal(storage.getItem('wishlist'),'old-wishes');
});
test('old sessions remain invalid after logout and login with the same UID', () => {
  const sessions = D.createSession(), old = sessions.start('A');
  sessions.start(null);const next = sessions.start('A');
  assert.equal(sessions.isCurrent(old),false);assert.equal(sessions.isCurrent(next),true);
});

async function cloudHarness(){
  const raw = memory(), storage = D.createStorage(raw), writes = [];
  const element = {classList:{add(){},remove(){},toggle(){}},addEventListener(){},dataset:{}};
  const ctx = {
    console,JSON,Date,Uint8Array,crypto:require('node:crypto').webcrypto,
    setTimeout,clearTimeout,URL,window:{JTD_PREVIEW_MODE:false,cancelPendingConfirmation(){}},state:{platform:null,search:''},JTDData:D,accountStorage:storage,
    document:{getElementById:()=>element},navigator:{clipboard:{writeText:async()=>{}}},
    GAMES:[],ARRIVALS:[],WISHLIST:[],platformMeta:{},platformOrder:[],PROFILE_NAME:'',PROFILE_AVATAR:null,SHARE_TOKEN:null,STORAGE_KEY:'games',
    initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),doc:(_db,collection,id)=>({collection,id}),
    getDoc:async()=>({exists:()=>false}),setDoc:async(ref,data)=>writes.push({ref,data}),deleteDoc:async()=>{},
    onAuthStateChanged:(_auth,callback)=>{ctx.authCallback=callback;},signInWithEmailAndPassword(){},createUserWithEmailAndPassword(){},signOut(){},
    showToast(){},migrateGameTypes(){},buildPlatformList(){},buildFormatToggles(){},buildTypeToggles(){},buildStatusToggles(){},render(){},renderArrivals(){},renderWishlist(){},renderProfileAvatar(){},updateBackupNote(){},closeModal(){},closeArrivalModal(){},closeWishlistModal(){},closePlatformModal(){},closeMobileDrawers(){}
  };
  ctx.replaceAppData = data => {for(const [key,value] of Object.entries(data)){const names={games:'GAMES',arrivals:'ARRIVALS',wishlist:'WISHLIST',profileName:'PROFILE_NAME',profileAvatar:'PROFILE_AVATAR'};ctx[names[key]||key]=value;}};
  ctx.persistAppData = data => storage.atomicWrite([['games',JSON.stringify(data.games)]]);
  ctx.initApp = async () => {const games=storage.getItem('games');ctx.GAMES=games?JSON.parse(games):[];};
  vm.createContext(ctx);
  const file = fs.readFileSync(require.resolve('../firebase.js'),'utf8');
  const source = file.slice(file.indexOf('  const firebaseConfig'));
  await vm.runInContext('(async()=>{'+source+'\nwindow.testCloud={scheduleCloudSync,doCloudSync,sessions};})()',ctx);
  return {ctx,writes,storage};
}
test('existing empty cloud collection stays authoritative despite stale scoped games', async () => {
  const {ctx,writes,storage}=await cloudHarness();storage.setAccount('A');storage.setItem('games',JSON.stringify([game()]));
  ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[],wishlist:[game({id:'w'})],arrivals:[]})});
  await ctx.authCallback({uid:'A'});
  assert.equal(ctx.GAMES.length,0);assert.equal(ctx.WISHLIST.length,1);assert.equal(writes.length,0);
  assert.equal(storage.getItem('games'),'[]');
});
test('new account does not import another account or unscoped legacy data', async () => {
  const {ctx,writes,storage}=await cloudHarness();storage.setAccount('A');storage.setItem('games',JSON.stringify([game()]));
  await ctx.authCallback({uid:'A'});await ctx.authCallback(null);await ctx.authCallback({uid:'B'});
  const b=writes.filter(write=>write.ref.id==='B');assert.equal(b.length,1);assert.equal(b[0].data.games.length,0);
});
test('a slow cloud read for A cannot apply after login to B', async () => {
  const {ctx}=await cloudHarness();let release;
  ctx.getDoc=ref=>ref.id==='A'?new Promise(resolve=>{release=resolve;}):Promise.resolve({exists:()=>true,data:()=>({games:[game({nom:'B-game'})]})});
  const first=ctx.authCallback({uid:'A'});await new Promise(resolve=>setImmediate(resolve));
  await ctx.authCallback({uid:'B'});release({exists:()=>true,data:()=>({games:[game({nom:'A-game'})]})});await first;
  assert.equal(ctx.GAMES[0].nom,'B-game');
});
test('logout cancels a pending cloud write', async () => {
  const {ctx,writes}=await cloudHarness();ctx.getDoc=async()=>({exists:()=>true,data:()=>({games:[]})});
  await ctx.authCallback({uid:'A'});ctx.window.JTDDataChanged();await ctx.authCallback(null);
  await new Promise(resolve=>setTimeout(resolve,950));assert.equal(writes.length,0);
});
test('cloud read failure blocks automatic writes', async () => {
  const {ctx,writes}=await cloudHarness();ctx.getDoc=async()=>{throw new Error('offline');};ctx.console={error(){}};
  await ctx.authCallback({uid:'A'});ctx.window.JTDDataChanged();
  await new Promise(resolve=>setTimeout(resolve,950));assert.equal(writes.length,0);
});
test('renaming updates all three lists and preserves flags and purchases', () => {
  const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
  const fn=source.slice(source.indexOf('function renamePlatform('),source.indexOf('function updatePlatformColor('));
  const ctx={GAMES:[game({japanese:true,prix:20})],ARRIVALS:[game({collector:true})],WISHLIST:[game()],platformMeta:{PC:{color:'#123456'}},platformOrder:['PC'],state:{platform:'PC'},getPlatformColor:()=> '#123456'};
  for(const name of ['savePlatformOrder','saveGames','saveArrivals','saveWishlist','savePlatformMeta','renderArrivals','renderWishlist'])ctx[name]=()=>{};
  vm.createContext(ctx);vm.runInContext(fn,ctx);assert.equal(ctx.renamePlatform('PC','Ordinateur'),true);
  for(const items of [ctx.GAMES,ctx.ARRIVALS,ctx.WISHLIST])assert.equal(items[0].plateforme,'Ordinateur');
  assert.equal(ctx.GAMES[0].prix,20);assert.equal(ctx.GAMES[0].japanese,true);assert.equal(ctx.ARRIVALS[0].collector,true);
});
