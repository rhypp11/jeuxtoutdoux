const IS_PREVIEW_MODE = location.hostname.includes('--preview-');
window.JTD_PREVIEW_MODE = IS_PREVIEW_MODE;
const PREVIEW_SEED = {
  games: [
    {id:'test-p5r',nom:'Persona 5 Royal',plateforme:'PC',prix:59.99,format:'Numérique',collector:false,type:'Jeu simple',status:'termine',date:'2026-01-15',source:'Steam',image:null},
    {id:'test-fe',nom:'Fire Emblem — Test',plateforme:'Switch 2',prix:59.99,format:'Physique',collector:false,type:null,status:'a_jouer',date:'2026-09-17',source:'Test',image:null},
    {id:'test-party',nom:'Jeu Multi — Test',plateforme:'Switch 2',prix:39.99,format:'Physique',collector:false,type:null,status:'multi',date:'2026-05-01',source:'Test',image:null},
    {id:'test-elsewhere',nom:'Terminé ailleurs — Test',plateforme:'PlayStation 5',prix:24.99,format:'Physique',collector:true,type:null,status:'termine_ailleurs',date:'2025-12-01',source:'Test',image:null}
  ],
  arrivals:[{id:'test-arrival',nom:'Arrivage — Test',plateforme:'Switch 2',prix:49.99,date:'2026-11-20',source:'Test',image:null}],
  wishlist:[{id:'test-wish',nom:'Wishlist — Test',plateforme:'PC',prix:null,date:'2027',source:'Test',image:null}]
};
const SEED_GAMES = [];
const STORAGE_KEY = 'ludotheque:games-v2';
const ARRIVALS_KEY = 'ludotheque:arrivals-v1';
const WISHLIST_KEY = 'ludotheque:wishlist-v1';
const MONTH_NAMES_FULL = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MONTH_COLORS = ['#4F7CD9','#7C6AD9','#A15FBF','#C4508C','#D96A6A','#DD7F35','#D9A441','#B5C93C','#6FAE79','#4FC7B5','#4FA8D9','#6B8FD9'];
function monthIndexOf(iso){
  if(!iso) return 0;
  const m = parseInt(String(iso).slice(5,7),10);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m - 1 : 0;
}
function dateD(iso){
  if(!iso) return '—';
  const d = parseInt(iso.split('-')[2], 10);
  return d ? String(d) : '—';
}
const PROFILE_KEY = 'ludotheque:profile-v1';

// Données Progression historiques : conservées uniquement pour compatibilité des sauvegardes/cloud.
function nameKeyOf(nom, plateforme){ return (nom||'').trim().toLowerCase() + '|' + (plateforme||'').trim().toLowerCase(); }


let PROFILE_NAME = '';
let PROFILE_AVATAR = null;

function loadProfile(){
  try{
    const raw = localStorage.getItem(PROFILE_KEY);
    if(raw){
      const p = JSON.parse(raw);
      PROFILE_NAME = p.name || '';
      PROFILE_AVATAR = p.avatar || null;
    }
  }catch(e){ /* ignore */ }
}
function saveProfile(){
  if(IS_PREVIEW_MODE) return;
  try{ localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: PROFILE_NAME, avatar: PROFILE_AVATAR })); }catch(e){ /* ignore */ }
}
function profileInitials(){
  const trimmed = PROFILE_NAME.trim();
  if(!trimmed) return '';
  return trimmed.split(/\s+/).slice(0,2).map(w => w[0].toUpperCase()).join('');
}
function renderProfileAvatar(){
  const initials = profileInitials();
  document.querySelectorAll('[data-avatar-img]').forEach(el => {
    el.src = PROFILE_AVATAR || '';
    el.classList.toggle('hidden', !PROFILE_AVATAR);
  });
  document.querySelectorAll('[data-avatar-initials]').forEach(el => {
    el.textContent = initials;
    el.classList.toggle('hidden', !!PROFILE_AVATAR || !initials);
  });
  document.querySelectorAll('[data-avatar-fallback]').forEach(el => {
    el.classList.toggle('hidden', !!PROFILE_AVATAR || !!initials);
  });
  const nameInput = document.getElementById('profile-name-input');
  if(nameInput && document.activeElement !== nameInput) nameInput.value = PROFILE_NAME;
}
function resizeImageToDataUrl(file, size){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

const PLATFORM_COLORS = {
  "Nintendo Switch 2": "#C4342B",
  "Nintendo Switch": "#E4483C",
  "Nintendo 3DS": "#6E4FA3",
  "Nintendo Wii": "#C9CCD1",
  "Nintendo Wii U": "#4A6FA5",
  "Nintendo DS": "#6BAED6",
  "Nintendo Gamecube": "#4B3F72",
  "PlayStation 5": "#E5E5E5",
  "PlayStation 4": "#2C4C7C",
  "PlayStation 3": "#5A5D66",
  "PlayStation 2": "#8B95A1",
  "PlayStation Vita": "#3A4A66",
  "PlayStation Portable": "#71787F",
  "PlayStation 1": "#A9A9A9"
};
const FALLBACK_PALETTE = ["#D9A441","#4FC7B5","#8B7CD9","#D97757","#5EA8D9","#C97BB0"];
const PLATFORM_META_KEY = 'ludotheque:platform-meta-v1';
let platformMeta = {}; // { [nom]: { color, logo } }

function loadPlatformMeta(){
  try{
    const raw = localStorage.getItem(PLATFORM_META_KEY);
    platformMeta = raw ? JSON.parse(raw) : {};
  }catch(e){
    platformMeta = {};
  }
}

function savePlatformMeta(){
  if(IS_PREVIEW_MODE) return;
  try{
    localStorage.setItem(PLATFORM_META_KEY, JSON.stringify(platformMeta));
  }catch(e){
    console.error('Erreur de sauvegarde des plateformes', e);
  }
}

function hashColor(name){
  let hash = 0;
  for(let i=0;i<name.length;i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

function getPlatformColor(name){
  if(platformMeta[name] && platformMeta[name].color) return platformMeta[name].color;
  if(PLATFORM_COLORS[name]) return PLATFORM_COLORS[name];
  return hashColor(name);
}

function getPlatformLogo(name){
  return (platformMeta[name] && platformMeta[name].logo) || null;
}

function ensurePlatformMeta(name){
  if(!platformMeta[name]) platformMeta[name] = { color: getPlatformColor(name), logo: null, digital: false };
  return platformMeta[name];
}

function seedPcPlatformOnce(){
  try{
    let changed = false;
    if(!platformMeta['PC']){
      ensurePlatformMeta('PC').color = '#4F7CD9';
      platformMeta['PC'].digital = true;
      changed = true;
    }
    if(!platformMeta['Nintendo Game Boy Advance']){
      ensurePlatformMeta('Nintendo Game Boy Advance').color = '#8B5FBF';
      changed = true;
    }
    if(changed) savePlatformMeta();
  }catch(e){}
}

function renamePlatform(oldName, newName){
  newName = newName.trim();
  if(!newName || newName === oldName) return false;
  GAMES.forEach(g => { if(g.plateforme === oldName) g.plateforme = newName; });
  const meta = platformMeta[oldName];
  delete platformMeta[oldName];
  platformMeta[newName] = meta || { color: getPlatformColor(oldName), logo: null };
  if(state.platform === oldName) state.platform = newName;
  const orderIdx = platformOrder.indexOf(oldName);
  if(orderIdx !== -1) platformOrder[orderIdx] = newName;
  savePlatformOrder();
  saveGames();
  savePlatformMeta();
  return true;
}

function updatePlatformColor(name, color){
  ensurePlatformMeta(name).color = color;
  savePlatformMeta();
  buildPlatformList();
  render();
}

function updatePlatformLogo(name, url){
  ensurePlatformMeta(name).logo = url || null;
  savePlatformMeta();
  buildPlatformList();
  render();
}


/* ---------- Ordre personnalisé des plateformes ---------- */
const PLATFORM_ORDER_KEY = 'ludotheque:platform-order-v1';
let platformOrder = [];

function loadPlatformOrder(){
  try{
    const raw = localStorage.getItem(PLATFORM_ORDER_KEY);
    platformOrder = raw ? JSON.parse(raw) : [];
  }catch(e){
    platformOrder = [];
  }
}

function savePlatformOrder(){
  if(IS_PREVIEW_MODE) return;
  try{
    localStorage.setItem(PLATFORM_ORDER_KEY, JSON.stringify(platformOrder));
  }catch(e){
    console.error('Erreur de sauvegarde de l\'ordre des plateformes', e);
  }
}

function getOrderedPlatformNames(){
  const all = allPlatformNames();
  const known = platformOrder.filter(p => all.includes(p));
  const missing = all.filter(p => !known.includes(p)).sort((a,b) => a.localeCompare(b));
  return [...known, ...missing];
}

function movePlatformOrder(name, direction){
  const order = getOrderedPlatformNames();
  const idx = order.indexOf(name);
  const swapIdx = idx + direction;
  if(idx === -1 || swapIdx < 0 || swapIdx >= order.length) return;
  [order[idx], order[swapIdx]] = [order[swapIdx], order[idx]];
  platformOrder = order;
  savePlatformOrder();
}

/* ---------- Tri de la liste de plateformes (filtres) ---------- */
const PLATFORM_SORT_MODE_KEY = 'ludotheque:platform-sort-mode-v1';
let platformSortMode = 'count'; // 'count' | 'custom'
try{
  const storedMode = localStorage.getItem(PLATFORM_SORT_MODE_KEY);
  if(storedMode === 'count' || storedMode === 'custom') platformSortMode = storedMode;
}catch(e){ /* ignore */ }

function togglePlatformSortMode(){
  platformSortMode = platformSortMode === 'count' ? 'custom' : 'count';
  try{ localStorage.setItem(PLATFORM_SORT_MODE_KEY, platformSortMode); }catch(e){ /* ignore */ }
  buildPlatformList();
}

function updateSortButtonUI(){
  const btn = document.getElementById('sort-platforms-btn');
  if(!btn) return;
  if(platformSortMode === 'custom'){
    btn.classList.add('active-sort');
    btn.title = 'Tri : ordre personnalisé (cliquer pour trier par nombre de jeux)';
  } else {
    btn.classList.remove('active-sort');
    btn.title = 'Tri : nombre de jeux (cliquer pour utiliser l\'ordre personnalisé défini dans la gestion des plateformes)';
  }
}

const ICON_STATUS_TODO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"></circle><line x1="12" y1="9" x2="12" y2="15"></line><rect x="6" y="15" width="12" height="5" rx="1.5"></rect></svg>`;
const ICON_STATUS_PROGRESS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"></polygon></svg>`;
const ICON_STATUS_DONE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
const ICON_STATUS_MULTI = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15c-1.66 0-3-1.34-3-3s1.34-3 3-3c2.5 0 4 3 6 3s3.5-3 6-3c1.66 0 3 1.34 3 3s-1.34 3-3 3c-2.5 0-4-3-6-3s-3.5 3-6 3z"></path></svg>`;
const ICON_TYPE_COMPILATION = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
const ICON_TYPE_SIMPLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"></rect></svg>`;
const ICON_TYPE_PUZZLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h7v5a2 2 0 1 0 4 0V4h5v16h-5v-3a2 2 0 1 0-4 0v3H4z"></path></svg>`;
const ICON_TYPE_UPGRADE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"></rect><path d="M12 16V8"></path><path d="M8.5 11.5 12 8l3.5 3.5"></path></svg>`;
const TYPE_META = {
  'Jeu simple': { icon: ICON_TYPE_SIMPLE, label:'Jeu simple' },
  'DLC extension': { icon: ICON_TYPE_PUZZLE, label:'DLC' },
  'Mise à niveau': { icon: ICON_TYPE_UPGRADE, label:'Mise à niveau' },
  'Complete Edition': { icon: ICON_TYPE_COMPILATION, label:'Complete Edition' }
};


const ICON_BOOKS_VERTICAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"></path><path d="M12 6v14"></path><path d="M8 8v12"></path><path d="M4 4v16"></path></svg>`;
const ICON_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
const ICON_GAMEPAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="12" x2="10" y2="12"></line><line x1="8" y1="10" x2="8" y2="14"></line><circle cx="15" cy="13" r="1"></circle><circle cx="18" cy="11" r="1"></circle><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.207 2 16a2 2 0 0 0 2 2c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 8.828 15h6.344a2 2 0 0 1 1.414.586L18 17c.5.5 1 1 2 1a2 2 0 0 0 2-2c0-1.793-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5Z"></path></svg>`;
const ICON_FLAME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>`;


const STATUS_OPTIONS = [
  { key: "a_jouer", label: "À faire", icon: ICON_STATUS_TODO, color: "var(--status-todo)", bg: "rgba(255,194,14,0.07)", border: "rgba(255,194,14,0.3)" },
  { key: "multi", label: "Multi", icon: ICON_STATUS_MULTI, color: "var(--status-multi)", bg: "rgba(142,111,217,0.07)", border: "rgba(142,111,217,0.3)" },
  { key: "termine", label: "Terminé", icon: ICON_STATUS_DONE, color: "var(--status-done)", bg: "rgba(47,174,74,0.07)", border: "rgba(47,174,74,0.3)" },
  { key: "termine_ailleurs", label: "Terminé ailleurs", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h5v5"></path><path d="m10 14 10-10"></path><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"></path></svg>`, color: "var(--status-done)", bg: "rgba(47,174,74,0.07)", border: "rgba(47,174,74,0.3)" }
];

let GAMES = [];
let ARRIVALS = [];
let WISHLIST = [];
let editingId = null; // null = ajout, sinon id du jeu en édition
let editingArrivalId = null;
let editingWishlistId = null;
let convertingWishlistId = null; // id de l'item wishlist en cours de bascule vers arrivage
let convertingArrivalId = null; // id de l'arrivage en cours de bascule vers la collection
let convertingArrivalToWishlistId = null; // id de l'arrivage en cours de bascule vers la wishlist

let state = {
  platform: null,
  format: null,
  type: null,
  collector: false,
  status: null,
  search: "",
  sort: "name-asc"
};

/* ---------- Toasts & confirmation réutilisables ---------- */
let toastTimer = null;
function showToast(message, actionLabel, onAction, duration){
  const stack = document.getElementById('toast-stack');
  if(!stack) return;
  stack.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  const actionHtml = actionLabel ? `<button type="button" class="toast-action">${actionLabel}</button>` : '';
  toast.innerHTML = `<span class="toast-message">${message}</span>${actionHtml}<button type="button" class="toast-close" aria-label="Fermer">✕</button>`;
  stack.appendChild(toast);

  const remove = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 160);
  };
  if(actionLabel){
    toast.querySelector('.toast-action').addEventListener('click', () => {
      clearTimeout(toastTimer);
      remove();
      onAction && onAction();
    });
  }
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(toastTimer);
    remove();
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(remove, duration || 6000);
}

function confirmAction(message, onConfirm, opts){
  const overlay = document.getElementById('confirm-modal-overlay');
  document.getElementById('confirm-modal-title').textContent = (opts && opts.title) || 'Confirmer la suppression';
  document.getElementById('confirm-modal-message').textContent = message;
  const confirmBtn = document.getElementById('confirm-modal-confirm-btn');
  confirmBtn.textContent = (opts && opts.confirmLabel) || 'Supprimer';
  overlay.classList.remove('hidden');

  const cleanup = () => {
    overlay.classList.add('hidden');
    confirmBtn.removeEventListener('click', onConfirmClick);
    cancelBtn.removeEventListener('click', onCancelClick);
  };
  const onConfirmClick = () => { cleanup(); onConfirm(); };
  const onCancelClick = () => { cleanup(); };
  const cancelBtn = document.getElementById('confirm-modal-cancel-btn');
  confirmBtn.addEventListener('click', onConfirmClick);
  cancelBtn.addEventListener('click', onCancelClick);
}

function euros(n){
  if(n === null || n === undefined) return "—";
  return n.toLocaleString('fr-FR', {minimumFractionDigits:2, maximumFractionDigits:2}) + " €";
}

function dateFR(iso){
  if(!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parsePriceInput(s){
  if(!s) return null;
  s = s.trim().replace(',', '.').replace('€','').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

async function loadGames(){
  if(IS_PREVIEW_MODE){ GAMES = PREVIEW_SEED.games.map(g => ({...g})); return; }
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      GAMES = JSON.parse(raw);
      return;
    }
  }catch(e){ console.error('Lecture locale impossible', e); }
  // Premier lancement (ou stockage local vide) : on part des données du CSV
  GAMES = SEED_GAMES.map(g => ({...g, image: null, status:null}));
  await saveGames();
}

function migrateTypeValue(type){
  if(type === 'Compilation') return 'Jeu simple';
  if(type === 'Jeu + DLC') return 'Complete Edition';
  return type;
}

function migrateGameTypes(){
  GAMES.forEach(g => {
    if(g.format === 'Collector'){
      g.format = 'Physique';
      g.collector = true;
    } else if(g.collector === undefined){
      g.collector = false;
    }
    g.type = migrateTypeValue(g.type);
    if(g.format === 'Numérique' && !g.type) g.type = 'Jeu simple';
    if(g.format !== 'Numérique') g.type = null;
  });
}

async function saveGames(){
  if(IS_PREVIEW_MODE) return;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(GAMES));
  }catch(e){
    console.error('Erreur de sauvegarde locale', e);
  }
}


const LAST_EXPORT_KEY = 'ludotheque:last-export-v1';

function updateExportNote(){
  const el = document.getElementById('export-note');
  if(!el) return;
  const raw = localStorage.getItem(LAST_EXPORT_KEY);
  if(!raw){
    el.textContent = 'Jamais exporté';
    return;
  }
  const d = new Date(raw);
  el.textContent = 'Dernier export : ' + d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
}

async function loadArrivals(){
  if(IS_PREVIEW_MODE){ ARRIVALS = PREVIEW_SEED.arrivals.map(g => ({...g})); return; }
  try{
    const raw = localStorage.getItem(ARRIVALS_KEY);
    ARRIVALS = raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Lecture des arrivages impossible', e);
    ARRIVALS = [];
  }
}

function saveArrivals(){
  if(IS_PREVIEW_MODE) return;
  try{
    localStorage.setItem(ARRIVALS_KEY, JSON.stringify(ARRIVALS));
  }catch(e){
    console.error('Erreur de sauvegarde des arrivages', e);
  }
}

async function loadWishlist(){
  if(IS_PREVIEW_MODE){ WISHLIST = PREVIEW_SEED.wishlist.map(g => ({...g})); return; }
  try{
    const raw = localStorage.getItem(WISHLIST_KEY);
    WISHLIST = raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Lecture de la wishlist impossible', e);
    WISHLIST = [];
  }
}

function saveWishlist(){
  if(IS_PREVIEW_MODE) return;
  try{
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(WISHLIST));
  }catch(e){
    console.error('Erreur de sauvegarde de la wishlist', e);
  }
}

function exportGames(){
  const payload = {
    games: GAMES,
    arrivals: ARRIVALS,
    wishlist: WISHLIST,
    platformMeta: platformMeta,
    platformOrder: platformOrder
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ma-ludotheque-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  try{
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString());
  }catch(e){ /* ignore */ }
  updateExportNote();
}

function mergeImportGames(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const parsed = JSON.parse(e.target.result);
      const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.games) ? parsed.games : null);
      if(!incoming) throw new Error('Format invalide');

      const existingKeys = new Set(GAMES.map(g => nameKeyOf(g.nom, g.plateforme)));
      let added = 0, skipped = 0;
      incoming.forEach((g, i) => {
        if(!g || !g.nom || !g.plateforme) return;
        const key = nameKeyOf(g.nom, g.plateforme);
        if(existingKeys.has(key)){ skipped++; return; }
        existingKeys.add(key);
        const incomingFormat = g.format === 'Collector' ? 'Physique' : (g.format || 'Physique');
        GAMES.push({
          id: 'imp-' + Date.now() + '-' + i,
          nom: g.nom,
          plateforme: g.plateforme,
          date: g.date || null,
          source: g.source || null,
          prix: typeof g.prix === 'number' ? g.prix : null,
          format: incomingFormat,
          collector: g.collector === true || g.format === 'Collector',
          type: incomingFormat === 'Numérique' ? migrateTypeValue(g.type) || 'Jeu simple' : null,
          image: g.image || null,
          status: g.status || null
        });
        added++;
      });

      saveGames();
      buildPlatformList();
      render();
      alert(`${added} jeu(x) ajouté(s).` + (skipped ? ` ${skipped} déjà présent(s) dans ta collection ont été ignorés (même nom + plateforme).` : ''));
    }catch(err){
      alert("Ce fichier n'a pas pu être lu. Vérifie qu'il s'agit bien d'un JSON de jeux valide.");
    }
  };
  reader.readAsText(file);
}

function importGames(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const parsed = JSON.parse(e.target.result);
      if(Array.isArray(parsed)){
        // Ancien format : juste un tableau de jeux
        GAMES = parsed;
      } else if(parsed && typeof parsed === 'object'){
        GAMES = Array.isArray(parsed.games) ? parsed.games : GAMES;
        ARRIVALS = Array.isArray(parsed.arrivals) ? parsed.arrivals : ARRIVALS;
        WISHLIST = Array.isArray(parsed.wishlist) ? parsed.wishlist : WISHLIST;
        if(parsed.platformMeta && typeof parsed.platformMeta === 'object') platformMeta = parsed.platformMeta;
        if(Array.isArray(parsed.platformOrder)) platformOrder = parsed.platformOrder;
      } else {
        throw new Error('Format invalide');
      }
      saveGames();
      saveArrivals();
      saveWishlist();
      savePlatformMeta();
      savePlatformOrder();
        migrateGameTypes();
      saveGames();
      buildPlatformList();
      render();
      renderArrivals();
      renderWishlist();
      alert('Bibliothèque importée : ' + GAMES.length + ' jeux.');
    }catch(err){
      alert("Ce fichier n'a pas pu être lu comme une sauvegarde valide.");
    }
  };
  reader.readAsText(file);
}

function setStatus(id, statusKey){
  const g = GAMES.find(x => x.id === id);
  if(!g) return;
  g.status = (g.status === statusKey) ? null : statusKey;
  saveGames();
  render();
}

function buildPlatformList(){
  const scoped = state.format ? GAMES.filter(g => g.format === state.format) : GAMES;
  const counts = {};
  scoped.forEach(g => { counts[g.plateforme] = (counts[g.plateforme]||0) + 1; });
  const platforms = platformSortMode === 'custom'
    ? getOrderedPlatformNames().filter(p => counts[p])
    : Object.keys(counts).sort((a,b) => counts[b]-counts[a]);

  updateSortButtonUI();

  const container = document.getElementById('platform-list');
  container.innerHTML = "";

  const allItem = document.createElement('div');
  allItem.className = 'plat-item' + (state.platform === null ? ' active' : '');
  allItem.style.setProperty('--spine', 'var(--muted)');
  allItem.tabIndex = 0;
  const isNumeriqueScope = state.format === 'Numérique';
  const allIconSvg = isNumeriqueScope
    ? `<svg class="gamepad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--teal);"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M4 19h16"></path></svg>`
    : `<svg class="gamepad-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.5"></circle></svg>`;
  allItem.innerHTML = `${allIconSvg}<span class="plat-name">Toutes</span><span class="plat-count">${scoped.length}</span>`;
  allItem.onclick = () => { state.platform = null; buildPlatformList(); render(); closeMobileDrawers(); };
  container.appendChild(allItem);

  platforms.forEach(p => {
    const item = document.createElement('div');
    const color = getPlatformColor(p);
    const logo = getPlatformLogo(p);
    item.className = 'plat-item' + (state.platform === p ? ' active' : '');
    item.style.setProperty('--spine', color);
    item.tabIndex = 0;
    const iconHtml = logo
      ? `<img class="mini-logo" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'spine-chip\\'></span>'">`
      : `<span class="spine-chip"></span>`;
    item.innerHTML = `${iconHtml}<span class="plat-name">${p}</span><span class="plat-count">${counts[p]}</span>`;
    item.onclick = () => { state.platform = (state.platform === p ? null : p); buildPlatformList(); render(); closeMobileDrawers(); };
    container.appendChild(item);
  });
}

function applyCollectionSupportUI(format){
  const isPhysical = format !== 'Numérique';
  document.getElementById('collector-filter-section').classList.toggle('hidden', !isPhysical);
  document.getElementById('type-filter-section').classList.toggle('hidden', isPhysical);
  const addBtn = document.getElementById('add-btn');
  if(addBtn){
    addBtn.textContent = isPhysical ? '+ Ajouter un jeu physique' : '+ Ajouter un jeu numérique';
    addBtn.style.background = isPhysical ? 'var(--muted)' : '';
  }
}

function buildFormatToggles(){
  const container = document.getElementById('format-toggles');
  container.innerHTML = "";
  const collectorChip = document.createElement('div');
  collectorChip.className = 'toggle-chip' + (state.collector ? ' active' : '');
  collectorChip.tabIndex = 0;
  collectorChip.innerHTML = `<span class="toggle-chip-label">${FORMAT_ICON_STAR}<span>Collector</span></span>`;
  collectorChip.onclick = () => { state.collector = !state.collector; buildFormatToggles(); render(); };
  container.appendChild(collectorChip);
}

function buildTypeToggles(){
  const container = document.getElementById('type-toggles');
  if(!container) return;
  container.innerHTML = "";
  Object.keys(TYPE_META).forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'toggle-chip' + (state.type === t ? ' active' : '');
    chip.tabIndex = 0;
    chip.innerHTML = `<span class="toggle-chip-label">${TYPE_META[t].icon}<span>${TYPE_META[t].label}</span></span>`;
    chip.onclick = () => { state.type = (state.type === t ? null : t); buildTypeToggles(); render(); };
    container.appendChild(chip);
  });
}

function buildStatusToggles(){
  const container = document.getElementById('status-toggles');
  container.innerHTML = "";
  STATUS_OPTIONS.forEach(s => {
    const chip = document.createElement('div');
    const isActive = state.status === s.key;
    chip.className = 'toggle-chip status-chip' + (isActive ? ' active' : '');
    chip.tabIndex = 0;
    chip.innerHTML = `<span class="toggle-chip-label"><span class="status-chip-icon" style="color:${s.color}">${s.icon}</span><span>${s.label}</span></span>`;
    if(isActive){
      chip.style.borderColor = s.border;
      chip.style.background = s.bg;
    }
    chip.onclick = () => { state.status = (state.status === s.key ? null : s.key); buildStatusToggles(); render(); };
    container.appendChild(chip);
  });

  const noneChip = document.createElement('div');
  const noneActive = state.status === '__none__';
  noneChip.className = 'toggle-chip status-chip' + (noneActive ? ' active' : '');
  noneChip.tabIndex = 0;
  noneChip.innerHTML = `<span class="toggle-chip-label"><span class="status-chip-icon" style="color:var(--muted)">—</span><span>Sans statut</span></span>`;
  if(noneActive){
    noneChip.style.borderColor = 'var(--hairline)';
    noneChip.style.background = 'var(--surface-raised)';
  }
  noneChip.onclick = () => { state.status = (state.status === '__none__' ? null : '__none__'); buildStatusToggles(); render(); };
  container.appendChild(noneChip);
}

function getEffectiveStatus(g){
  return g.status;
}

function filteredGames(){
  const q = state.search.trim().toLowerCase();
  return GAMES.filter(g => {
      if(state.platform && g.plateforme !== state.platform) return false;
      if(state.format && g.format !== state.format) return false;
      if(state.collector && !g.collector) return false;
      if(state.type && (g.type || 'Jeu simple') !== state.type) return false;
      if(q && !g.nom.toLowerCase().includes(q)) return false;
      if(state.status){
        if(state.status === '__none__'){
          if(getEffectiveStatus(g)) return false;
        } else if(getEffectiveStatus(g) !== state.status){
          return false;
        }
      }
      return true;
    });
}

function sortGames(games){
  const arr = [...games];
  switch(state.sort){
    case 'name-asc': arr.sort((a,b) => a.nom.localeCompare(b.nom)); break;
    case 'name-desc': arr.sort((a,b) => b.nom.localeCompare(a.nom)); break;
    case 'price-desc': arr.sort((a,b) => (b.prix ?? -1) - (a.prix ?? -1)); break;
    case 'price-asc': arr.sort((a,b) => (a.prix ?? 999999) - (b.prix ?? 999999)); break;
    case 'date-desc': arr.sort((a,b) => (b.date || '').localeCompare(a.date || '')); break;
    case 'date-asc': arr.sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999')); break;
  }
  return arr;
}

function renderPlatformBanner(games){
  const banner = document.getElementById('platform-banner');
  if(!banner) return;

  const total = games.length;
  const spent = games.reduce((sum,g) => sum + (g.prix || 0), 0);
  const collectors = games.filter(g => g.collector).length;
  const platformsCount = new Set(games.map(g => g.plateforme)).size;
  const termineCount = games.filter(g => g.status === 'termine' || g.status === 'termine_ailleurs').length;

  const stat = (value, label, extraClass='') =>
    `<span class="library-stat ${extraClass}"><strong>${value}</strong><span>${label}</span></span>`;

  const statsHtml = [
    stat(total, total > 1 ? 'jeux' : 'jeu'),
    !state.platform ? stat(platformsCount, platformsCount > 1 ? 'plateformes' : 'plateforme') : '',
    stat(spent.toLocaleString('fr-FR',{maximumFractionDigits:0}) + ' €', 'collection'),
    collectors ? stat(collectors, collectors > 1 ? 'collectors' : 'collector', 'library-stat-collector') : '',
    termineCount ? stat(termineCount, 'terminés', 'library-stat-done') : ''
  ].filter(Boolean).join('<span class="library-stat-sep">·</span>');

  if(!state.platform){
    banner.classList.remove('hidden');
    banner.classList.add('neutral');
    banner.style.background = '';
    banner.style.color = '';
    banner.style.setProperty('--platform-accent','var(--teal)');
    banner.innerHTML = `
      <div class="platform-banner-head">
        <span class="platform-banner-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12a4 4 0 0 1 3.7 5.5l-1.2 3a2 2 0 0 1-3.2.8L15 15H9l-2.3 2.3a2 2 0 0 1-3.2-.8l-1.2-3A4 4 0 0 1 6 8Z"></path><path d="M7 12h4M9 10v4"></path><circle cx="16.5" cy="11.5" r=".7" fill="currentColor" stroke="none"></circle><circle cx="18.5" cy="13.5" r=".7" fill="currentColor" stroke="none"></circle></svg></span>
        <div><span class="platform-banner-kicker">Ma collection</span><span class="platform-banner-title">Tous les jeux</span></div>
      </div>
      <div class="platform-banner-stats">${statsHtml}</div>
    `;
    return;
  }

  const color = getPlatformColor(state.platform);
  const logo = getPlatformLogo(state.platform);
  const initials = state.platform.slice(0,2).toUpperCase();
  banner.classList.remove('hidden', 'neutral');
  banner.style.background = '';
  banner.style.color = '';
  banner.style.setProperty('--platform-accent',color);
  const logoHtml = logo
    ? `<img class="platform-banner-logo" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'platform-banner-fallback\\'>${initials}</span>'">`
    : `<span class="platform-banner-fallback">${initials}</span>`;
  banner.innerHTML = `
    <div class="platform-banner-head">${logoHtml}<div><span class="platform-banner-kicker">Ma collection</span><span class="platform-banner-title">${state.platform}</span></div></div>
    <div class="platform-banner-stats">${statsHtml}</div>
  `;
}

function renderCard(g){
  const color = getPlatformColor(g.plateforme);
  const logo = getPlatformLogo(g.plateforme);

  const card = document.createElement('div');
  card.className = 'card' + (g.collector ? ' collector' : '');
  card.style.setProperty('--spine', color);

  const activeStatus = STATUS_OPTIONS.find(s => s.key === g.status);
  const statusIcon = activeStatus ? activeStatus.icon : '<span class="card-status-empty-dot"></span>';
  const statusTitle = activeStatus ? activeStatus.label : 'Définir le statut';
  const statusColor = activeStatus ? activeStatus.color : 'var(--muted)';
  const statusMenu = STATUS_OPTIONS.map(s => `
    <button type="button" class="card-status-option${g.status === s.key ? ' active' : ''}" data-status="${s.key}" style="--option-color:${s.color};" title="${s.label}" aria-label="${s.label}">
      ${s.icon}<span>${s.label}</span>
    </button>`).join('');

  const statusBadgeHtml = `<div class="card-status-control">
      <button type="button" class="card-status-badge" style="--status-color:${statusColor};" title="${statusTitle}" aria-label="Statut : ${statusTitle}" aria-expanded="false">
        ${statusIcon}
      </button>
      <div class="card-status-menu hidden">${statusMenu}</div>
    </div>`;

  const collectorBadgeHtml = g.collector
    ? `<div class="card-special-badge" title="Édition collector">${FORMAT_ICON_STAR}</div>`
    : '';

  const bannerInner = g.image
    ? `<img src="${g.image}" alt="${g.nom}" onerror="this.style.display='none';this.parentElement.classList.add('placeholder');this.parentElement.querySelector('.card-fallback').classList.remove('hidden')">`
    : '';

  const bannerHtml = `<div class="card-banner${g.image ? '' : ' placeholder'}">
      ${bannerInner}
      <span class="card-fallback${g.image ? ' hidden' : ''}">${g.plateforme.slice(0,2).toUpperCase()}</span>
      <div class="card-badge-layer">${collectorBadgeHtml}${statusBadgeHtml}</div>
    </div>`;

  const platformHtml = `${logo
    ? `<img class="mini-logo" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'dot\\' style=\\'--spine:${color}\\'></span>'">`
    : `<span class="dot" style="--spine:${color}"></span>`}<span>${g.plateforme}</span>`;

  const purchaseBits = [];
  if(g.source) purchaseBits.push(`<span class="card-source" title="${g.source}">${g.source}</span>`);
  if(g.prix != null) purchaseBits.push(`<span class="card-price">${euros(g.prix)}</span>`);
  const purchaseHtml = purchaseBits.length ? `<div class="card-purchase">${purchaseBits.join('<span class="card-meta-sep">·</span>')}</div>` : '';

  card.innerHTML = `
    ${bannerHtml}
    <div class="card-body">
      <div class="card-name" title="${g.nom}">${g.nom}</div>
      <div class="card-summary">
        <span class="card-platform">${platformHtml}</span>
        ${purchaseHtml}
      </div>
    </div>
  `;

  const badge = card.querySelector('.card-status-badge');
  const menu = card.querySelector('.card-status-menu');
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !willOpen);
    badge.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  menu.querySelectorAll('.card-status-option').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setStatus(g.id, btn.dataset.status);
    });
  });
  card.addEventListener('click', () => openModal(g.id));
  return card;
}

function renderResultsBar(count){
  const bar = document.getElementById('results-bar');
  if(!bar) return;

  const filters = [];
  if(state.platform) filters.push(state.platform);
  if(state.collector) filters.push('⭐ Collector');
  if(state.type) filters.push((TYPE_META[state.type] || {}).label || state.type);
  if(state.status){
    const s = STATUS_OPTIONS.find(x => x.key === state.status);
    filters.push(state.status === '__none__' ? 'Sans statut' : (s ? s.label : state.status));
  }
  if(state.search.trim()) filters.push(`« ${state.search.trim()} »`);

  let html = `<span class="results-count">${count} jeu${count > 1 ? 'x' : ''}</span>`;
  if(filters.length){
    html += `<span class="results-filters">${filters.map(f => `<b>${f}</b>`).join(' · ')}</span>`;
    html += `<button type="button" class="results-reset-btn" id="results-reset-btn">Réinitialiser</button>`;
  }
  bar.innerHTML = html;
  const resetBtn = document.getElementById('results-reset-btn');
  if(resetBtn) resetBtn.addEventListener('click', () => document.getElementById('reset-btn').click());
}

function render(){
  const games = sortGames(filteredGames());
  renderPlatformBanner(games);
  renderResultsBar(games.length);

  const grid = document.getElementById('grid');
  grid.innerHTML = "";

  if(games.length === 0){
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.style.gridColumn = '1 / -1';
    empty.innerHTML = `<div class="big">Aucun jeu ne correspond</div>Essaie d'élargir tes filtres ou ta recherche.`;
    grid.appendChild(empty);
    return;
  }

  games.forEach(g => grid.appendChild(renderCard(g)));
  renderHomeStats();
}

/* ---------- Modal ajout / édition ---------- */

function allPlatformNames(){
  const names = new Set(GAMES.map(g => g.plateforme));
  Object.keys(platformMeta).forEach(p => names.add(p));
  return [...names].sort();
}

/* ---------- Combo avec icône (plateforme / format) ---------- */
/* Le <select> natif reste la source de vérité (valeur, focus clavier, formulaire) ;
   on l'habille visuellement d'un déclencheur + liste custom pour pouvoir y afficher
   des icônes (logos de plateforme, pictos Collector/Physique), ce qu'un <select> natif
   ne permet pas. */

const iconSelectRegistry = {};

function getPlatformOptionIconHtml(name){
  const color = getPlatformColor(name);
  const logo = getPlatformLogo(name);
  return logo
    ? `<img class="icon-select-icon" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'icon-select-dot\\' style=\\'background:${color}\\'></span>'">`
    : `<span class="icon-select-dot" style="background:${color}"></span>`;
}

const FORMAT_ICON_STAR = `<svg class="format-icon star-icon icon-select-icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" title="Collector"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
const FORMAT_ICON_DISC = `<svg class="format-icon disc-icon icon-select-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" title="Physique"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="2.5"></circle></svg>`;
const FORMAT_ICON_DOWNLOAD = `<svg class="format-icon download-icon icon-select-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" title="Numérique"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M4 19h16"></path></svg>`;

function iconSelectify(selectId, getIcon){
  iconSelectRegistry[selectId] = { getIcon };
  const select = document.getElementById(selectId);
  if(!select || select.dataset.iconified){
    rebuildIconSelectList(selectId);
    syncIconSelectTrigger(selectId);
    return;
  }
  select.dataset.iconified = '1';

  const wrap = document.createElement('div');
  wrap.className = 'icon-select-wrap';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'icon-select-trigger';
  wrap.appendChild(trigger);

  const list = document.createElement('div');
  list.className = 'icon-select-list hidden';
  wrap.appendChild(list);

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = list.classList.contains('hidden');
    document.querySelectorAll('.icon-select-list').forEach(l => l.classList.add('hidden'));
    if(willOpen) list.classList.remove('hidden');
  });
  document.addEventListener('click', (e) => {
    if(!wrap.contains(e.target)) list.classList.add('hidden');
  });

  select.addEventListener('change', () => syncIconSelectTrigger(selectId));

  rebuildIconSelectList(selectId);
  syncIconSelectTrigger(selectId);
}

function rebuildIconSelectList(selectId){
  const cfg = iconSelectRegistry[selectId];
  const select = document.getElementById(selectId);
  if(!cfg || !select) return;
  const wrap = select.closest('.icon-select-wrap');
  if(!wrap) return;
  const list = wrap.querySelector('.icon-select-list');
  list.innerHTML = '';
  Array.from(select.options).forEach(opt => {
    const row = document.createElement('div');
    row.className = 'icon-select-option';
    row.innerHTML = `${cfg.getIcon(opt.value)}<span>${opt.textContent}</span>`;
    row.onclick = () => {
      select.value = opt.value;
      select.dispatchEvent(new Event('change'));
      list.classList.add('hidden');
    };
    list.appendChild(row);
  });
}

function syncIconSelectTrigger(selectId){
  const cfg = iconSelectRegistry[selectId];
  const select = document.getElementById(selectId);
  if(!cfg || !select) return;
  const wrap = select.closest('.icon-select-wrap');
  if(!wrap) return;
  const trigger = wrap.querySelector('.icon-select-trigger');
  const val = select.value;
  const opt = select.options[select.selectedIndex];
  const label = opt ? opt.textContent : 'Choisir...';
  trigger.innerHTML = `${cfg.getIcon(val)}<span class="icon-select-trigger-label">${label}</span><svg class="icon-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
}

function populatePlatformSelect(selectId, digitalOnly){
  const select = document.getElementById(selectId);
  if(!select) return;
  let platforms = allPlatformNames();
  if(digitalOnly) platforms = platforms.filter(isDigitalCapable);
  const current = select.value;
  select.innerHTML = platforms.map(p => `<option value="${p}">${p}</option>`).join('');
  if(current && platforms.includes(current)) select.value = current;
  else if(platforms.length) select.value = platforms[0];
  rebuildIconSelectList(selectId);
  syncIconSelectTrigger(selectId);
}

const TYPE_OPTIONS_DIGITAL = ['Jeu simple','DLC extension','Mise à niveau','Complete Edition'];

function populateTypeSelect(selectId, format){
  const select = document.getElementById(selectId);
  if(!select) return;
  const options = TYPE_OPTIONS_DIGITAL;
  const current = select.value;
  select.innerHTML = options.map(t => `<option value="${t}">${TYPE_META[t].label}</option>`).join('');
  if(current && options.includes(current)) select.value = current;
  else select.value = options[0];
  rebuildIconSelectList(selectId);
  syncIconSelectTrigger(selectId);
}

function setSelectValueAndSync(selectId, value){
  const select = document.getElementById(selectId);
  if(!select) return;
  select.value = value;
  syncIconSelectTrigger(selectId);
}

function getLastUsed(key, fallback){
  try {
    const v = localStorage.getItem('jtd-last-'+key);
    return (v !== null && v !== '') ? v : fallback;
  } catch(e){ return fallback; }
}
function setLastUsed(key, value){
  try { localStorage.setItem('jtd-last-'+key, value); } catch(e){}
}

function openModal(id){
  editingId = id || null;
  convertingArrivalId = null; // ouverture normale (pas une bascule depuis les arrivages)

  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('delete-btn');

  if(editingId){
    const g = GAMES.find(x => x.id === editingId);
    title.textContent = 'Modifier ce jeu';
    deleteBtn.classList.remove('hidden');
    document.getElementById('f-quick-hide-fields').classList.remove('hidden');
    document.getElementById('f-nom').value = g.nom || '';
    const lockedFormat = state.format || g.format || 'Physique';
    setSelectValueAndSync('f-format', lockedFormat);
    populatePlatformSelect('f-plateforme', lockedFormat === 'Numérique');
    setSelectValueAndSync('f-plateforme', g.plateforme);
    populateTypeSelect('f-type', lockedFormat);
    setSelectValueAndSync('f-type', g.type || 'Jeu simple');
    document.getElementById('f-collector').checked = !!g.collector;
    toggleFormatDependentFields(lockedFormat);
    document.getElementById('f-prix').value = g.prix != null ? String(g.prix).replace('.',',') : '';
    document.getElementById('f-date').value = g.date || '';
    document.getElementById('f-source').value = g.source || '';
    document.getElementById('f-image').value = g.image || '';
  } else {
    title.textContent = 'Ajouter un jeu';
    deleteBtn.classList.add('hidden');
    document.getElementById('f-nom').value = '';
    const lastFormat = state.format || getLastUsed('format', 'Physique');
    setSelectValueAndSync('f-format', lastFormat);
    populatePlatformSelect('f-plateforme', lastFormat === 'Numérique');
    if(state.platform){
      setSelectValueAndSync('f-plateforme', state.platform);
    } else {
      const lastPlatform = getLastUsed('platform', '');
      if(lastPlatform) setSelectValueAndSync('f-plateforme', lastPlatform);
    }
    populateTypeSelect('f-type', lastFormat);
    setSelectValueAndSync('f-type', 'Jeu simple');
    document.getElementById('f-collector').checked = false;
    toggleFormatDependentFields(lastFormat);
    document.getElementById('f-prix').value = '';
    document.getElementById('f-date').value = '';
    document.getElementById('f-source').value = '';
    document.getElementById('f-image').value = '';
  }
  updateImagePreview();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-nom').focus();
}

function closeModal(){
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
  convertingArrivalId = null; // annuler = l'arrivage reste où il était
}

function updateImagePreview(){
  const url = document.getElementById('f-image').value.trim();
  const preview = document.getElementById('image-preview');
  if(url){
    preview.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<span>Image introuvable</span>'">`;
  } else {
    preview.innerHTML = `<span>Aperçu de l'image</span>`;
  }
}

function saveModal(){
  const nom = document.getElementById('f-nom').value.trim();
  if(!nom){
    document.getElementById('f-nom').focus();
    return;
  }
  const plateforme = document.getElementById('f-plateforme').value;
  const prix = parsePriceInput(document.getElementById('f-prix').value);
  const date = document.getElementById('f-date').value || null;
  const source = document.getElementById('f-source').value.trim() || null;
  const format = document.getElementById('f-format').value;
  const collector = document.getElementById('f-collector').checked;
  const type = format === 'Numérique' ? document.getElementById('f-type').value : null;
  const image = document.getElementById('f-image').value.trim() || null;

  if(editingId){
    const g = GAMES.find(x => x.id === editingId);
    Object.assign(g, { nom, plateforme, prix, date, source, format, collector, type, image });
  } else {
    GAMES.push({
      id: 'custom-' + Date.now(),
      nom, plateforme, prix, date, source, format, collector, type, image,
      status:null
    });
  }

  if(convertingArrivalId){
    ARRIVALS = ARRIVALS.filter(x => x.id !== convertingArrivalId);
    saveArrivals();
    convertingArrivalId = null;
    renderArrivals();
  }

  saveGames();
  setLastUsed('platform', plateforme);
  setLastUsed('format', format);
  closeModal();
  buildPlatformList();
  render();
}

function deleteGame(){
  if(!editingId) return;
  const g = GAMES.find(x => x.id === editingId);
  if(!g) return;
  confirmAction(`Supprimer « ${g.nom} » de la ludothèque ?`, () => {
    const idx = GAMES.indexOf(g);
    GAMES = GAMES.filter(x => x.id !== editingId);
    saveGames();
    closeModal();
    buildPlatformList();
    render();
    showToast(`« ${g.nom} » supprimé`, 'Annuler', () => {
      GAMES.splice(Math.min(idx, GAMES.length), 0, g);
      saveGames();
      buildPlatformList();
      render();
    });
  });
}

/* ---------- Accueil : Stats ---------- */

function renderHomeStats(){
  const total = GAMES.length;
  const spent = GAMES.reduce((sum,g) => sum + (g.prix || 0), 0);
  const collectors = GAMES.filter(g => g.collector).length;
  const platformsCount = new Set(GAMES.map(g => g.plateforme)).size;

  const totalEl = document.getElementById('home-total-games');
  if(totalEl) totalEl.textContent = total;
  const metaEl = document.getElementById('home-summary-meta');
  if(metaEl){
    const bits = [
      `<span><strong>${platformsCount}</strong> plateformes</span>`,
      collectors ? `<span><strong>${collectors}</strong> collectors</span>` : '',
      spent ? `<span><strong>${spent.toLocaleString('fr-FR',{maximumFractionDigits:0})} €</strong> investis</span>` : ''
    ].filter(Boolean);
    metaEl.innerHTML = bits.join('<span class="home-summary-sep">·</span>');
  }

  const barsEl = document.getElementById('home-platform-bars');
  if(!barsEl) return;
  const counts = {};
  GAMES.forEach(g => { counts[g.plateforme] = (counts[g.plateforme] || 0) + 1; });
  const rows = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  barsEl.innerHTML = rows.map(([platform, count]) => {
    const logo = getPlatformLogo(platform);
    const color = getPlatformColor(platform);
    const icon = logo
      ? `<img class="home-plat-icon" src="${logo}" alt="">`
      : `<span class="home-plat-icon-fallback" style="background:${color};"></span>`;
    return `<div class="home-platform-bar-row" style="--home-platform-color:${color}">
      <div class="plat-bar-label">${icon}<span class="plat-name">${platform}</span><span class="count">${count}</span></div>
    </div>`;
  }).join('');
}

/* ---------- Accueil : Arrivages & Wishlist ---------- */

const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`;
const ICON_PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;


function boardThumb(item){
  const initials = (item.plateforme || item.nom || '??').slice(0,2).toUpperCase();
  const logo = getPlatformLogo(item.plateforme);
  const color = getPlatformColor(item.plateforme);
  const fallback = logo
    ? `<img src="${logo}" alt="" style="width:44px;height:44px;object-fit:contain;border-radius:8px;">`
    : `<span style="color:${color};font-weight:700;">${initials}</span>`;
  if(item.image){
    return `<div class="board-thumb" data-fallback="${logo ? 'logo' : 'initials'}"><img src="${item.image}" alt="" onerror='this.parentElement.innerHTML=${JSON.stringify(fallback)}'></div>`;
  }
  return `<div class="board-thumb">${fallback}</div>`;
}

function arrivalRowHtml(item){
  const color = getPlatformColor(item.plateforme);
  const logo = getPlatformLogo(item.plateforme);
  const platIconHtml = logo
    ? `<img class="mini-logo-sm" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'dot\\'></span>'">`
    : `<span class="dot"></span>`;
  const monthColor = item.date ? MONTH_COLORS[monthIndexOf(item.date)] : null;
  const purchaseBits = [];
  if(item.source) purchaseBits.push(`<span class="arrival-source" title="${item.source}">${item.source}</span>`);
  if(item.prix != null) purchaseBits.push(`<span class="arrival-price">${euros(item.prix)}</span>`);
  const purchaseHtml = purchaseBits.length
    ? `<div class="arrival-purchase">${purchaseBits.join('<span class="arrival-meta-sep">·</span>')}</div>`
    : '';
  return `
    <div class="board-row" data-id="${item.id}" style="--spine:${color}">
      <div class="board-date" style="color:${monthColor || 'var(--muted)'}">${dateD(item.date)}</div>
      ${boardThumb(item)}
      <div class="board-info">
        <div class="board-name" title="${item.nom}">${item.nom}</div>
        <div class="board-plat">${platIconHtml}${item.plateforme}</div>
      </div>
      ${purchaseHtml}
      <div class="arrival-actions">
        <button class="icon-btn to-wishlist-btn" data-action="to-wishlist" title="Basculer vers la wishlist" aria-label="Basculer vers la wishlist">${ICON_STAR}</button>
        <button class="icon-btn add-to-collection-btn" data-action="to-collection" title="Ajouter à la collection" aria-label="Ajouter à la collection">${ICON_PLUS}</button>
      </div>
    </div>`;
}

function renderArrivals(){
  const container = document.getElementById('arrivals-rows');
  if(!container) return;
  container.innerHTML = "";

  const countEl = document.getElementById('arrivals-count');
  if(countEl) countEl.textContent = ARRIVALS.length;

  const totalEl = document.getElementById('arrivals-total');
  if(totalEl){
    const total = ARRIVALS.reduce((sum,a) => sum + (a.prix || 0), 0);
    totalEl.textContent = total > 0 ? `≈ ${total.toLocaleString('fr-FR',{maximumFractionDigits:0})} € estimés` : '';
  }

  renderHomeStats();
  wireArrivalsDropZone();

  if(ARRIVALS.length === 0){
    container.innerHTML = `<div class="board-empty">Aucun jeu en précommande pour l'instant.</div>`;
    return;
  }

  const sorted = [...ARRIVALS].sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999'));

  const groups = [];
  const groupMap = new Map();
  sorted.forEach(item => {
    const rawDate = String(item.date || '');
    const m = rawDate.match(/^(\d{4})-(\d{2})/);
    const y = rawDate.match(/^(\d{4})$/);
    const isTbd = rawDate.toUpperCase() === 'TBD';
    const key = m ? `${m[1]}-${m[2]}` : y ? `year-${y[1]}` : isTbd ? 'tbd' : '__none__';
    const label = m ? `${MONTH_NAMES_FULL[parseInt(m[2],10)-1]} ${m[1]}` : y ? y[1] : isTbd ? 'TBD' : 'Date à préciser';
    const color = m ? MONTH_COLORS[parseInt(m[2],10)-1] : null;
    if(!groupMap.has(key)){
      const g = { key, label, color, items: [] };
      groupMap.set(key, g);
      groups.push(g);
    }
    groupMap.get(key).items.push(item);
  });

  container.innerHTML = groups.map(g => `
    <div class="board-month-head${g.color ? ' month-accent' : ''}"${g.color ? ` style="--spine:${g.color}"` : ''}>${g.label} <span class="board-month-count">${g.items.length}</span></div>
    ${g.items.map(arrivalRowHtml).join('')}
  `).join('');

  container.querySelectorAll('.board-row').forEach(row => {
    const id = row.dataset.id;
    row.addEventListener('click', (e) => {
      if(e.target.closest('[data-action="to-collection"], [data-action="to-wishlist"]')) return;
      openArrivalModal(id);
    });
    row.querySelector('[data-action="to-collection"]').onclick = (e) => {
      e.stopPropagation();
      addArrivalToCollection(id);
    };
    row.querySelector('[data-action="to-wishlist"]').onclick = (e) => {
      e.stopPropagation();
      moveArrivalToWishlist(id);
    };
  });
}

let homeDragWishlistId = null;

function wireArrivalsDropZone(){
  const zone = document.getElementById('arrivals-board');
  if(!zone) return;
  zone.ondragover = (e) => {
    if(!homeDragWishlistId) return;
    e.preventDefault();
    zone.classList.add('drag-over');
  };
  zone.ondragleave = () => zone.classList.remove('drag-over');
  zone.ondrop = (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if(homeDragWishlistId) moveWishlistToArrivals(homeDragWishlistId);
    homeDragWishlistId = null;
  };
}

function parseWishlistDate(str){
  const s = (str || '').trim();
  if(!s) return { priority:2, key:'zzz', label:'—' };

  // Date ISO : AAAA-MM-JJ
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m){
    const iso = `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    return { priority:0, key:iso, label:dateFR(iso) };
  }
  // Date JJ/MM/AAAA
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m){
    const iso = `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    return { priority:0, key:iso, label:`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[3]}` };
  }
  // Date JJ/MM (année manquante) : on la considère plus précise qu'une simple année,
  // donc juste après les dates complètes et avant les années.
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(m){
    return { priority:1, key:`${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`, label:`${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}` };
  }
  // Année seule : AAAA
  m = s.match(/^(\d{4})$/);
  if(m) return { priority:2, key:m[1], label:m[1] };

  // Tout le reste (TBD, texte libre...)
  return { priority:3, key:s.toLowerCase(), label:s };
}

function wishlistMonthColor(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0){
    const m = parseInt(parsed.key.split('-')[1], 10);
    return (m >= 1 && m <= 12) ? MONTH_COLORS[m-1] : null;
  }
  if(parsed.priority === 1){
    const m = parseInt(parsed.key.split('-')[0], 10);
    return (m >= 1 && m <= 12) ? MONTH_COLORS[m-1] : null;
  }
  return null;
}

function wishlistDayLabel(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0) return String(parseInt(parsed.key.split('-')[2], 10));
  if(parsed.priority === 1) return String(parseInt(parsed.key.split('-')[1], 10));
  return parsed.label;
}

function wishlistGroupInfo(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0){
    const [y, m] = parsed.key.split('-');
    const mi = parseInt(m, 10) - 1;
    return { key:`${y}-${m}`, label:`${MONTH_NAMES_FULL[mi]} ${y}`, color: MONTH_COLORS[mi], order:0 };
  }
  if(parsed.priority === 1){
    const m = parsed.key.split('-')[0];
    const mi = parseInt(m, 10) - 1;
    return { key:`month-${m}`, label:MONTH_NAMES_FULL[mi], color: MONTH_COLORS[mi], order:1 };
  }
  if(parsed.priority === 2){
    return { key:`year-${parsed.key}`, label:parsed.key, color:null, order:2 };
  }
  return { key:'__none__', label:'Date à préciser', color:null, order:3 };
}

function wishlistIsReleased(str){
  const parsed = parseWishlistDate(str);
  if(parsed.priority === 0) return parsed.key <= new Date().toISOString().slice(0,10);
  if(parsed.priority === 2) return parseInt(parsed.key, 10) < new Date().getFullYear();
  return false;
}

function renderWishlist(){
  const container = document.getElementById('wishlist-rows');
  if(!container) return;
  container.innerHTML = "";

  const countEl = document.getElementById('wishlist-count');
  if(countEl) countEl.textContent = WISHLIST.length;

  const totalEl = document.getElementById('wishlist-total');
  if(totalEl){
    const total = WISHLIST.reduce((sum,w) => sum + (w.prix || 0), 0);
    totalEl.textContent = total > 0 ? `≈ ${total.toLocaleString('fr-FR',{maximumFractionDigits:0})} € estimés` : '';
  }

  renderHomeStats();

  if(WISHLIST.length === 0){
    container.innerHTML = `<div class="board-empty">La wishlist est vide pour l'instant.</div>`;
    return;
  }

  function makeWishlistRow(item, released){
    const color = getPlatformColor(item.plateforme);
    const logo = getPlatformLogo(item.plateforme);
    const platIconHtml = logo
      ? `<img class="mini-logo-sm" src="${logo}" alt="" onerror="this.outerHTML='<span class=\\'dot\\'></span>'">`
      : `<span class="dot"></span>`;
    const row = document.createElement('div');
    row.className = 'board-row';
    row.style.setProperty('--spine', color);
    row.draggable = true;
    row.title = 'Glisse ce jeu vers les Arrivages pour le basculer';
    const linkHtml = item.lien
      ? `<a class="board-link" href="${item.lien}" target="_blank" rel="noopener noreferrer" title="${item.lien}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h5v5"></path><path d="m10 14 10-10"></path><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"></path></svg><span>Voir le lien</span></a>`
      : `<span class="board-link" style="color:var(--muted);">—</span>`;
    const dateHtml = released
      ? `<div class="board-date board-date-released" title="Déjà sorti">–</div>`
      : `<div class="board-date"${wishlistMonthColor(item.date) ? ` style="color:${wishlistMonthColor(item.date)}"` : ''}>${wishlistDayLabel(item.date)}</div>`;
    row.innerHTML = `
      ${dateHtml}
      ${boardThumb(item)}
      <div class="board-info">
        <div class="board-name" title="${item.nom}">${item.nom}</div>
        <div class="board-plat">${platIconHtml}${item.plateforme}</div>
      </div>
      ${linkHtml}
    `;
    row.addEventListener('click', (e) => {
      if(e.target.closest('.board-link')) return;
      openWishlistModal(item.id);
    });
    row.addEventListener('dragstart', () => {
      homeDragWishlistId = item.id;
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      homeDragWishlistId = null;
      const zone = document.getElementById('arrivals-board');
      if(zone) zone.classList.remove('drag-over');
    });
    return row;
  }

  const pending = WISHLIST.filter(w => !wishlistIsReleased(w.date));
  const released = WISHLIST.filter(w => wishlistIsReleased(w.date));

  const sortedPending = [...pending].sort((a,b) => {
    const ga = wishlistGroupInfo(a.date), gb = wishlistGroupInfo(b.date);
    if(ga.order !== gb.order) return ga.order - gb.order;
    if(ga.key !== gb.key) return ga.key.localeCompare(gb.key);
    return (a.nom||'').localeCompare(b.nom||'');
  });
  const sortedReleased = [...released].sort((a,b) => parseWishlistDate(b.date).key.localeCompare(parseWishlistDate(a.date).key));

  let lastGroupKey = null;
  sortedPending.forEach(item => {
    const group = wishlistGroupInfo(item.date);
    if(group.key !== lastGroupKey){
      lastGroupKey = group.key;
      const head = document.createElement('div');
      head.className = 'board-month-head' + (group.color ? ' month-accent' : '');
      if(group.color) head.style.setProperty('--spine', group.color);
      head.textContent = group.label;
      container.appendChild(head);
    }
    container.appendChild(makeWishlistRow(item, false));
  });

  if(sortedReleased.length){
    const head = document.createElement('div');
    head.className = 'board-month-head';
    head.textContent = 'Déjà sorti';
    container.appendChild(head);
    sortedReleased.forEach(item => container.appendChild(makeWishlistRow(item, true)));
  }
}

function flexibleDateMode(prefix, mode){
  const wrap = document.querySelector('[data-date-mode="'+prefix+'"]');
  if(!wrap) return;
  wrap.querySelectorAll('.date-mode-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
  document.getElementById(prefix+'-date').classList.toggle('hidden', mode !== 'date');
  document.getElementById(prefix+'-year').classList.toggle('hidden', mode !== 'year');
  wrap.dataset.currentMode = mode;
}
function setFlexibleDate(prefix, value){
  const v = String(value || '').trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){
    flexibleDateMode(prefix,'date'); document.getElementById(prefix+'-date').value=v; document.getElementById(prefix+'-year').value='';
  }else if(/^\d{4}$/.test(v)){
    flexibleDateMode(prefix,'year'); document.getElementById(prefix+'-year').value=v; document.getElementById(prefix+'-date').value='';
  }else if(v.toUpperCase()==='TBD'){
    flexibleDateMode(prefix,'tbd'); document.getElementById(prefix+'-date').value=''; document.getElementById(prefix+'-year').value='';
  }else{
    flexibleDateMode(prefix,'date'); document.getElementById(prefix+'-date').value=''; document.getElementById(prefix+'-year').value='';
  }
}
function getFlexibleDate(prefix){
  const wrap=document.querySelector('[data-date-mode="'+prefix+'"]');
  const mode=(wrap && wrap.dataset.currentMode) || 'date';
  if(mode==='year') return document.getElementById(prefix+'-year').value.trim() || null;
  if(mode==='tbd') return 'TBD';
  return document.getElementById(prefix+'-date').value || null;
}
document.querySelectorAll('.date-mode').forEach(group => {
  group.addEventListener('click', e => {
    const btn=e.target.closest('.date-mode-btn'); if(!btn) return;
    flexibleDateMode(group.dataset.dateMode, btn.dataset.mode);
  });
});

/* ----- Modal Arrivage ----- */

function openArrivalModal(id){
  editingArrivalId = id || null;
  convertingWishlistId = null; // ouverture normale (pas une bascule depuis la wishlist)
  populatePlatformSelect('a-plateforme');
  const title = document.getElementById('arrival-modal-title');
  const deleteBtn = document.getElementById('a-delete-btn');
  const toWishlistBtn = document.getElementById('a-to-wishlist-btn');

  if(editingArrivalId){
    const item = ARRIVALS.find(x => x.id === editingArrivalId);
    title.textContent = 'Modifier cet arrivage';
    deleteBtn.classList.remove('hidden');
    toWishlistBtn.classList.remove('hidden');
    document.getElementById('a-nom').value = item.nom || '';
    setSelectValueAndSync('a-plateforme', item.plateforme || '');
    setFlexibleDate('a', item.date);
    document.getElementById('a-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
    document.getElementById('a-source').value = item.source || '';
    document.getElementById('a-image').value = item.image || '';
  } else {
    title.textContent = 'Ajouter un arrivage';
    deleteBtn.classList.add('hidden');
    toWishlistBtn.classList.add('hidden');
    document.getElementById('a-nom').value = '';
    document.getElementById('a-plateforme').value = '';
    setFlexibleDate('a', '');
    document.getElementById('a-prix').value = '';
    document.getElementById('a-source').value = '';
    document.getElementById('a-image').value = '';
  }
  updateImagePreviewFor('a-image', 'a-image-preview');
  document.getElementById('arrival-modal-overlay').classList.remove('hidden');
  document.getElementById('a-nom').focus();
}

function closeArrivalModal(){
  document.getElementById('arrival-modal-overlay').classList.add('hidden');
  editingArrivalId = null;
  convertingWishlistId = null; // annuler = l'item reste dans la wishlist
}

function saveArrivalModal(){
  const nom = document.getElementById('a-nom').value.trim();
  const plateforme = document.getElementById('a-plateforme').value.trim();
  if(!nom){ document.getElementById('a-nom').focus(); return; }
  if(!plateforme){ document.getElementById('a-plateforme').focus(); return; }

  const date = getFlexibleDate('a');
  const prix = parsePriceInput(document.getElementById('a-prix').value);
  const source = document.getElementById('a-source').value.trim() || null;
  const image = document.getElementById('a-image').value.trim() || null;

  if(editingArrivalId){
    const item = ARRIVALS.find(x => x.id === editingArrivalId);
    Object.assign(item, { nom, plateforme, date, prix, source, image });
  } else {
    ARRIVALS.push({ id: 'arr-' + Date.now(), nom, plateforme, date, prix, source, image });
  }

  if(convertingWishlistId){
    WISHLIST = WISHLIST.filter(x => x.id !== convertingWishlistId);
    saveWishlist();
    convertingWishlistId = null;
    renderWishlist();
  }

  ensurePlatformMeta(plateforme);
  savePlatformMeta();
  saveArrivals();
  closeArrivalModal();
  buildPlatformList();
  renderArrivals();
}

function deleteArrival(){
  if(!editingArrivalId) return;
  const item = ARRIVALS.find(x => x.id === editingArrivalId);
  if(!item) return;
  confirmAction(`Supprimer l'arrivage « ${item.nom} » ?`, () => {
    const idx = ARRIVALS.indexOf(item);
    ARRIVALS = ARRIVALS.filter(x => x.id !== editingArrivalId);
    saveArrivals();
    closeArrivalModal();
    renderArrivals();
    showToast(`« ${item.nom} » supprimé`, 'Annuler', () => {
      ARRIVALS.splice(Math.min(idx, ARRIVALS.length), 0, item);
      saveArrivals();
      renderArrivals();
    });
  });
}

function addArrivalToCollection(id){
  const item = ARRIVALS.find(x => x.id === id);
  if(!item) return;

  convertingArrivalId = id;
  editingId = null;
  populatePlatformSelect('f-plateforme');

  document.getElementById('modal-title').textContent = 'Ajouter à la collection';
  document.getElementById('delete-btn').classList.add('hidden');
  document.getElementById('f-nom').value = item.nom || '';
  setSelectValueAndSync('f-plateforme', item.plateforme || '');
  document.getElementById('f-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
  document.getElementById('f-date').value = item.date || '';
  document.getElementById('f-source').value = item.source || '';
  setSelectValueAndSync('f-format', 'Physique');
  populateTypeSelect('f-type', 'Physique');
  setSelectValueAndSync('f-type', 'Jeu simple');
  document.getElementById('f-collector').checked = false;
  toggleFormatDependentFields('Physique');
  document.getElementById('f-image').value = item.image || '';
  updateImagePreview();
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('f-nom').focus();
}

/* ----- Modal Wishlist ----- */

function openWishlistModal(id){
  editingWishlistId = id || null;
  convertingArrivalToWishlistId = null; // ouverture normale (pas une bascule depuis les arrivages)
  populatePlatformSelect('w-plateforme');
  const title = document.getElementById('wishlist-modal-title');
  const deleteBtn = document.getElementById('w-delete-btn');
  const toArrivalBtn = document.getElementById('w-to-arrival-btn');

  if(editingWishlistId){
    const item = WISHLIST.find(x => x.id === editingWishlistId);
    title.textContent = 'Modifier cet élément';
    deleteBtn.classList.remove('hidden');
    toArrivalBtn.classList.remove('hidden');
    document.getElementById('w-nom').value = item.nom || '';
    setSelectValueAndSync('w-plateforme', item.plateforme || '');
    setFlexibleDate('w', item.date);
    document.getElementById('w-lien').value = item.lien || '';
    document.getElementById('w-image').value = item.image || '';
    document.getElementById('w-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
  } else {
    title.textContent = 'Ajouter à la wishlist';
    deleteBtn.classList.add('hidden');
    toArrivalBtn.classList.add('hidden');
    document.getElementById('w-nom').value = '';
    document.getElementById('w-plateforme').value = '';
    setFlexibleDate('w', '');
    document.getElementById('w-lien').value = '';
    document.getElementById('w-image').value = '';
    document.getElementById('w-prix').value = '';
  }
  updateImagePreviewFor('w-image', 'w-image-preview');
  document.getElementById('wishlist-modal-overlay').classList.remove('hidden');
  document.getElementById('w-nom').focus();
}

function closeWishlistModal(){
  document.getElementById('wishlist-modal-overlay').classList.add('hidden');
  editingWishlistId = null;
  convertingArrivalToWishlistId = null; // annuler = l'arrivage reste où il était
}

function saveWishlistModal(){
  const nom = document.getElementById('w-nom').value.trim();
  const plateforme = document.getElementById('w-plateforme').value.trim();
  if(!nom){ document.getElementById('w-nom').focus(); return; }
  if(!plateforme){ document.getElementById('w-plateforme').focus(); return; }

  const date = getFlexibleDate('w');
  const lien = document.getElementById('w-lien').value.trim() || null;
  const image = document.getElementById('w-image').value.trim() || null;
  const prix = parsePriceInput(document.getElementById('w-prix').value);

  if(editingWishlistId){
    const item = WISHLIST.find(x => x.id === editingWishlistId);
    Object.assign(item, { nom, plateforme, date, lien, image, prix });
  } else {
    WISHLIST.push({ id: 'wish-' + Date.now(), nom, plateforme, date, lien, image, prix });
  }

  if(convertingArrivalToWishlistId){
    ARRIVALS = ARRIVALS.filter(x => x.id !== convertingArrivalToWishlistId);
    saveArrivals();
    convertingArrivalToWishlistId = null;
    renderArrivals();
  }

  ensurePlatformMeta(plateforme);
  savePlatformMeta();
  saveWishlist();
  closeWishlistModal();
  buildPlatformList();
  renderWishlist();
}

function deleteWishlist(){
  if(!editingWishlistId) return;
  const item = WISHLIST.find(x => x.id === editingWishlistId);
  if(!item) return;
  confirmAction(`Retirer « ${item.nom} » de la wishlist ?`, () => {
    const idx = WISHLIST.indexOf(item);
    WISHLIST = WISHLIST.filter(x => x.id !== editingWishlistId);
    saveWishlist();
    closeWishlistModal();
    renderWishlist();
    showToast(`« ${item.nom} » retiré de la wishlist`, 'Annuler', () => {
      WISHLIST.splice(Math.min(idx, WISHLIST.length), 0, item);
      saveWishlist();
      renderWishlist();
    });
  });
}

function moveWishlistToArrivals(id){
  const item = WISHLIST.find(x => x.id === id);
  if(!item) return;

  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') ? item.date : null;

  convertingWishlistId = id;
  editingArrivalId = null;
  populatePlatformSelect('a-plateforme');

  document.getElementById('arrival-modal-title').textContent = 'Basculer vers les arrivages';
  document.getElementById('a-delete-btn').classList.add('hidden');
  document.getElementById('a-nom').value = item.nom || '';
  setSelectValueAndSync('a-plateforme', item.plateforme || '');
  setFlexibleDate('a', item.date || '');
  document.getElementById('a-prix').value = '';
  document.getElementById('a-source').value = '';
  document.getElementById('a-image').value = item.image || '';
  updateImagePreviewFor('a-image', 'a-image-preview');
  document.getElementById('arrival-modal-overlay').classList.remove('hidden');
  document.getElementById('a-nom').focus();
}

function moveArrivalToWishlist(id){
  const item = ARRIVALS.find(x => x.id === id);
  if(!item) return;

  convertingArrivalToWishlistId = id;
  editingWishlistId = null;
  populatePlatformSelect('w-plateforme');

  document.getElementById('wishlist-modal-title').textContent = 'Basculer vers la wishlist';
  document.getElementById('w-delete-btn').classList.add('hidden');
  document.getElementById('w-to-arrival-btn').classList.add('hidden');
  document.getElementById('w-nom').value = item.nom || '';
  setSelectValueAndSync('w-plateforme', item.plateforme || '');
  setFlexibleDate('w', item.date);
  document.getElementById('w-lien').value = '';
  document.getElementById('w-image').value = item.image || '';
  document.getElementById('w-prix').value = item.prix != null ? String(item.prix).replace('.',',') : '';
  updateImagePreviewFor('w-image', 'w-image-preview');
  document.getElementById('wishlist-modal-overlay').classList.remove('hidden');
  document.getElementById('w-nom').focus();
}

function updateImagePreviewFor(inputId, previewId){
  const url = document.getElementById(inputId).value.trim();
  const preview = document.getElementById(previewId);
  if(url){
    preview.innerHTML = `<img src="${url}" onerror="this.parentElement.innerHTML='<span>Image introuvable</span>'">`;
  } else {
    preview.innerHTML = `<span>Aperçu de l'image</span>`;
  }
}

document.getElementById('add-arrival-btn').addEventListener('click', () => openArrivalModal(null));
document.getElementById('a-cancel-btn').addEventListener('click', closeArrivalModal);
document.getElementById('a-save-btn').addEventListener('click', saveArrivalModal);
document.getElementById('a-delete-btn').addEventListener('click', deleteArrival);
document.getElementById('a-image').addEventListener('input', () => updateImagePreviewFor('a-image','a-image-preview'));
document.getElementById('a-to-wishlist-btn').addEventListener('click', () => {
  if(!editingArrivalId) return;
  const id = editingArrivalId;
  closeArrivalModal();
  moveArrivalToWishlist(id);
});
/* Un clic en dehors de la fenêtre d'édition d'un arrivage ne la ferme plus (évite les pertes accidentelles) */

document.getElementById('add-wishlist-btn').addEventListener('click', () => openWishlistModal(null));
document.getElementById('w-cancel-btn').addEventListener('click', closeWishlistModal);
document.getElementById('w-save-btn').addEventListener('click', saveWishlistModal);
document.getElementById('w-delete-btn').addEventListener('click', deleteWishlist);
document.getElementById('w-to-arrival-btn').addEventListener('click', () => {
  if(!editingWishlistId) return;
  const id = editingWishlistId;
  closeWishlistModal();
  moveWishlistToArrivals(id);
});
document.getElementById('w-image').addEventListener('input', () => updateImagePreviewFor('w-image','w-image-preview'));
/* Un clic en dehors de la fenêtre d'édition d'un élément wishlist ne la ferme plus (évite les pertes accidentelles) */

/* ---------- Modal gestion des plateformes ---------- */

function openPlatformModal(){
  buildPlatformRows();
  document.getElementById('platform-modal-overlay').classList.remove('hidden');
}

function closePlatformModal(){
  document.getElementById('platform-modal-overlay').classList.add('hidden');
  buildPlatformList();
  render();
}

function buildPlatformRows(){
  const counts = {};
  GAMES.forEach(g => { counts[g.plateforme] = (counts[g.plateforme]||0) + 1; });
  allPlatformNames().forEach(p => { if(!(p in counts)) counts[p] = 0; });
  const platforms = getOrderedPlatformNames();

  const container = document.getElementById('platform-rows');
  container.innerHTML = "";

  platforms.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'platform-row';
    row.dataset.currentName = p;

    const color = getPlatformColor(p);
    const logo = getPlatformLogo(p);

    row.innerHTML = `
      <div class="row-order-btns">
        <button type="button" class="order-btn" data-dir="-1" title="Monter" aria-label="Monter dans l'ordre"${idx === 0 ? ' disabled' : ''}>▲</button>
        <button type="button" class="order-btn" data-dir="1" title="Descendre" aria-label="Descendre dans l'ordre"${idx === platforms.length - 1 ? ' disabled' : ''}>▼</button>
      </div>
      <div class="swatch-preview" data-role="swatch">${logo ? `<img src="${logo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='${p.slice(0,2).toUpperCase()}';this.parentElement.style.background='${color}';">` : ''}</div>
      <div class="row-fields">
        <div class="top-line">
          <input type="text" class="name-input" data-role="name" value="${p}">
          <input type="color" data-role="color" value="${toHexColor(color)}">
        </div>
        <input type="text" class="logo-input" data-role="logo" placeholder="URL du logo (facultatif)" value="${logo || ''}">
      </div>
      <span class="row-count">${counts[p]} jeu${counts[p] > 1 ? 'x' : ''}</span>
    `;

    row.querySelector('[data-dir="-1"]').addEventListener('click', () => {
      movePlatformOrder(p, -1);
      buildPlatformRows();
    });
    row.querySelector('[data-dir="1"]').addEventListener('click', () => {
      movePlatformOrder(p, 1);
      buildPlatformRows();
    });

    if(!logo){
      row.querySelector('[data-role="swatch"]').style.background = color;
      row.querySelector('[data-role="swatch"]').textContent = p.slice(0,2).toUpperCase();
    }

    const nameInput = row.querySelector('[data-role="name"]');
    const colorInput = row.querySelector('[data-role="color"]');
    const logoInput = row.querySelector('[data-role="logo"]');

    nameInput.addEventListener('blur', () => {
      const current = row.dataset.currentName;
      if(renamePlatform(current, nameInput.value)){
        row.dataset.currentName = nameInput.value.trim();
      } else {
        nameInput.value = current;
      }
    });

    colorInput.addEventListener('input', () => {
      updatePlatformColor(row.dataset.currentName, colorInput.value);
      const swatch = row.querySelector('[data-role="swatch"]');
      if(!logoInput.value.trim()) swatch.style.background = colorInput.value;
    });

    logoInput.addEventListener('input', () => {
      updatePlatformLogo(row.dataset.currentName, logoInput.value.trim());
      const swatch = row.querySelector('[data-role="swatch"]');
      const url = logoInput.value.trim();
      if(url){
        swatch.style.background = 'var(--surface-raised)';
        swatch.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.innerHTML='${row.dataset.currentName.slice(0,2).toUpperCase()}';this.parentElement.style.background='${colorInput.value}';">`;
      } else {
        swatch.innerHTML = row.dataset.currentName.slice(0,2).toUpperCase();
        swatch.style.background = colorInput.value;
      }
    });


    container.appendChild(row);
  });
}

function toHexColor(color){
  // Les couleurs sont déjà en hex dans ce projet ; on sécurise au cas où.
  if(/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#8B8FA3';
}

function addPlatform(){
  const input = document.getElementById('new-platform-name');
  const name = input.value.trim();
  if(!name) { input.focus(); return; }
  const existing = allPlatformNames().find(p => p.toLowerCase() === name.toLowerCase());
  if(existing){
    alert('Cette plateforme existe déjà.');
    input.focus();
    return;
  }
  ensurePlatformMeta(name);
  savePlatformMeta();
  input.value = '';
  buildPlatformRows();
}

document.getElementById('add-platform-btn').addEventListener('click', addPlatform);
document.getElementById('new-platform-name').addEventListener('keydown', (e) => {
  if(e.key === 'Enter'){ e.preventDefault(); addPlatform(); }
});

document.getElementById('sort-platforms-btn').addEventListener('click', togglePlatformSortMode);
document.getElementById('manage-platforms-btn').addEventListener('click', openPlatformModal);
document.getElementById('close-platform-modal-btn').addEventListener('click', closePlatformModal);
document.getElementById('platform-modal-overlay').addEventListener('click', (e) => {
  if(e.target.id === 'platform-modal-overlay') closePlatformModal();
});

document.getElementById('export-btn').addEventListener('click', exportGames);
document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-input').click());
document.getElementById('import-input').addEventListener('change', (e) => {
  if(e.target.files && e.target.files[0]) importGames(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('import-merge-btn').addEventListener('click', () => document.getElementById('import-merge-input').click());
document.getElementById('import-merge-input').addEventListener('change', (e) => {
  if(e.target.files && e.target.files[0]) mergeImportGames(e.target.files[0]);
  e.target.value = '';
});

document.getElementById('profile-menu-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('profile-menu').classList.toggle('hidden');
});
document.getElementById('profile-menu').addEventListener('click', (e) => {
  if(e.target.closest('.profile-menu-item')) document.getElementById('profile-menu').classList.add('hidden');
});
document.addEventListener('click', (e) => {
  const menu = document.getElementById('profile-menu');
  if(!menu.classList.contains('hidden') && !e.target.closest('.profile-menu-wrap')){
    menu.classList.add('hidden');
  }
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') document.getElementById('profile-menu').classList.add('hidden');
});

document.getElementById('profile-name-input').addEventListener('click', (e) => e.stopPropagation());
document.getElementById('profile-name-input').addEventListener('change', (e) => {
  PROFILE_NAME = e.target.value.trim();
  saveProfile();
  renderProfileAvatar();
});
document.getElementById('profile-avatar-edit-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  document.getElementById('profile-avatar-input').click();
});
document.getElementById('profile-avatar-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    PROFILE_AVATAR = await resizeImageToDataUrl(file, 160);
    saveProfile();
    renderProfileAvatar();
  }catch(err){
    console.error('Impossible de traiter cette image', err);
  }
  e.target.value = '';
});

document.getElementById('add-btn').addEventListener('click', () => openModal(null));
document.getElementById('cancel-btn').addEventListener('click', closeModal);
document.getElementById('save-btn').addEventListener('click', saveModal);
document.getElementById('delete-btn').addEventListener('click', deleteGame);
document.getElementById('f-image').addEventListener('input', updateImagePreview);
function toggleFormatDependentFields(format){
  const isPhysical = format !== 'Numérique';
  document.getElementById('f-collector-field').classList.toggle('hidden', !isPhysical);
  document.getElementById('f-type-field').classList.toggle('hidden', isPhysical);
}
/* Un clic en dehors de la fenêtre d'édition d'un jeu ne la ferme plus (évite les pertes accidentelles) */
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeModal();
});

document.getElementById('search-input').addEventListener('input', (e) => {
  state.search = e.target.value;
  render();
});

document.getElementById('sort-select').addEventListener('change', (e) => {
  state.sort = e.target.value;
  render();
});

document.getElementById('reset-btn').addEventListener('click', () => {
  const keepFormat = state.format;
  state = { platform:null, format:keepFormat, type:null, collector:false, status:null, search:"", sort:"name-asc" };
  document.getElementById('search-input').value = "";
  document.getElementById('sort-select').value = "name-asc";
  buildPlatformList();
  buildFormatToggles();
  buildTypeToggles();
  buildStatusToggles();
  render();
});

const PAGE_TITLES = {
  home: 'Accueil',
  'collection-Physique': 'Collection physique'
};
function goToPage(page, format){
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });
  const titleKey = page === 'collection' ? `collection-${format || 'Physique'}` : page;
  document.title = `JTD | ${PAGE_TITLES[titleKey] || 'Accueil'}`;
  document.getElementById('page-home').classList.toggle('hidden', page !== 'home');
  document.getElementById('page-collection').classList.toggle('hidden', page !== 'collection');
  if(page === 'collection'){
    const fmt = format || 'Physique';
    if(state.format !== fmt){
      state.format = fmt;
      state.platform = null;
      state.collector = false;
      state.type = null;
    }
    applyCollectionSupportUI(fmt);
    buildPlatformList();
    buildFormatToggles();
    buildTypeToggles();
    buildStatusToggles();
    render();
  }
  closeMobileDrawers();
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    goToPage(btn.dataset.page, btn.dataset.format);
    window.scrollTo({top: 0, behavior: 'smooth'});
  });
});

/* ---------- Navigation mobile ---------- */
function closeMobileDrawers(){
  document.querySelectorAll('.sidebar.mobile-open').forEach(el => el.classList.remove('mobile-open'));
  document.getElementById('mobile-backdrop').classList.remove('visible');
  document.body.classList.remove('mobile-drawer-open');
}
function openMobileDrawer(el){
  if(!el) return;
  closeMobileDrawers();
  el.classList.add('mobile-open');
  document.getElementById('mobile-backdrop').classList.add('visible');
  document.body.classList.add('mobile-drawer-open');
}
function toggleMobileDrawer(el){
  if(!el) return;
  if(el.classList.contains('mobile-open')) closeMobileDrawers();
  else openMobileDrawer(el);
}
document.getElementById('mobile-backdrop').addEventListener('click', closeMobileDrawers);

const PAGE_SIDEBAR_IDS = { home: 'home-sidebar', collection: 'collection-sidebar' };
document.getElementById('global-filter-toggle')?.addEventListener('click', () => {
  const activePage = document.querySelector('.nav-tab.active')?.dataset.page || 'home';
  toggleMobileDrawer(document.getElementById(PAGE_SIDEBAR_IDS[activePage]));
});

function updateTopnavHeightVar(){
  const h = document.querySelector('.topnav')?.offsetHeight || 50;
  document.documentElement.style.setProperty('--topnav-h', h + 'px');
}
updateTopnavHeightVar();
const topnavEl = document.querySelector('.topnav');
if(topnavEl && window.ResizeObserver){
  // Recalcule à chaque changement réel de hauteur du nav (chargement de police,
  // passage 1/2 lignes, rotation d'écran...) plutôt que de deviner le bon moment.
  new ResizeObserver(updateTopnavHeightVar).observe(topnavEl);
} else {
  window.addEventListener('load', updateTopnavHeightVar);
}
window.addEventListener('resize', () => {
  if(window.innerWidth > 1100) closeMobileDrawers();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') closeMobileDrawers();
});

/* ---------- Sélecteur mobile Wishlist / Arrivages ---------- */
document.querySelectorAll('.home-boards-switch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.home-boards-switch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const homeBoards = document.getElementById('home-boards');
    homeBoards.classList.remove('show-wishlist', 'show-arrivals');
    homeBoards.classList.add('show-' + btn.dataset.target);
  });
});

async function initApp(){
  loadProfile();
  renderProfileAvatar();
  loadPlatformMeta();
  loadPlatformOrder();
  await loadGames();
  await loadArrivals();
  await loadWishlist();
  migrateGameTypes();
  seedPcPlatformOnce();
  iconSelectify('f-plateforme', getPlatformOptionIconHtml);
  iconSelectify('a-plateforme', getPlatformOptionIconHtml);
  iconSelectify('w-plateforme', getPlatformOptionIconHtml);
  buildPlatformList();
  buildFormatToggles();
  buildTypeToggles();
  buildStatusToggles();
  render();
  renderArrivals();
  renderWishlist();
  updateExportNote();
}
