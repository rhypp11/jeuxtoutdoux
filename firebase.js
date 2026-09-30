import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
  import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signOut
  } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
  import {
    getFirestore, doc, getDoc, setDoc
  } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDFzVeQx7mw37Fk4mXr3odu9H57xpSXmdg",
    authDomain: "jeux-tout-doux.firebaseapp.com",
    projectId: "jeux-tout-doux",
    storageBucket: "jeux-tout-doux.firebasestorage.app",
    messagingSenderId: "367742323465",
    appId: "1:367742323465:web:ad01acd9274d4d6ca2e1d8"
  };
  const fbApp = initializeApp(firebaseConfig);
  const auth = getAuth(fbApp);
  const db = getFirestore(fbApp);

  let currentUser = null;
  let syncTimer = null;
  // Reste à true tant que le chargement initial (local + cloud) n'est pas terminé,
  // pour qu'aucune sauvegarde locale déclenchée pendant l'init ne parte écraser
  // le document Firestore avant qu'on ait pu lire les vraies données du compte.
  let suppressSync = true;
  let appInitialized = false;

  /* ---------- Construction / application du paquet de données cloud ---------- */
  function buildCloudPayload(){
    const raw = {
      games: GAMES,
      arrivals: ARRIVALS,
      wishlist: WISHLIST,
      platformMeta: platformMeta,
      platformOrder: platformOrder,
      profileName: PROFILE_NAME,
      profileAvatar: PROFILE_AVATAR,
      updatedAt: Date.now()
    };
    // Firestore refuse toute valeur "undefined" explicite : ce passage par JSON
    // nettoie automatiquement les éventuels champs jamais initialisés sur d'anciennes entrées.
    return JSON.parse(JSON.stringify(raw));
  }

  function applyCloudPayload(data){
    if(Array.isArray(data.games)) GAMES = data.games;
    if(Array.isArray(data.arrivals)) ARRIVALS = data.arrivals;
    if(Array.isArray(data.wishlist)) WISHLIST = data.wishlist;
    if(data.platformMeta && typeof data.platformMeta === 'object') platformMeta = data.platformMeta;
    if(Array.isArray(data.platformOrder)) platformOrder = data.platformOrder;
    if(typeof data.profileName === 'string') PROFILE_NAME = data.profileName;
    if(typeof data.profileAvatar === 'string' || data.profileAvatar === null) PROFILE_AVATAR = data.profileAvatar;
    saveProfile();
  }

  function refreshAllViews(){
    migrateGameTypes();
    buildPlatformList();
    buildFormatToggles();
    buildTypeToggles();
    buildStatusToggles();
    render();
    renderArrivals();
    renderWishlist();
    renderProfileAvatar();
    updateExportNote();
  }

  /* ---------- Indicateur de synchronisation ---------- */
  function setSyncStatus(status, message){
    const el = document.getElementById('cloud-sync-status');
    if(!el) return;
    el.className = 'cloud-sync-status ' + status;
    el.title = message || '';
    el.textContent = status === 'error' ? '⚠ Sync' : (status === 'syncing' || status === 'pending' ? '☁ …' : '☁ Sync');
  }

  async function doCloudSync(){
    if(!currentUser) return;
    setSyncStatus('syncing', 'Synchronisation...');
    try{
      await setDoc(doc(db, 'users', currentUser.uid), buildCloudPayload());
      setSyncStatus('ok', 'Synchronisé avec le cloud');
    }catch(err){
      console.error('Erreur de synchronisation Firebase', err);
      setSyncStatus('error', 'Erreur de synchronisation : ' + err.message);
    }
  }

  function scheduleCloudSync(){
    if(!currentUser || suppressSync) return;
    setSyncStatus('pending', 'Synchronisation en attente...');
    clearTimeout(syncTimer);
    syncTimer = setTimeout(doCloudSync, 900);
  }

  // Branche la synchro cloud sur toutes les fonctions de sauvegarde existantes, sans y toucher
  [
    'saveGames','saveArrivals','saveWishlist','savePlatformMeta','savePlatformOrder','saveProfile'
  ].forEach(name => {
    const orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(...args){
      const result = orig.apply(this, args);
      scheduleCloudSync();
      return result;
    };
  });

  async function loadFromCloudOrSeed(uid){
    const ref = doc(db, 'users', uid);
    try{
      const snap = await getDoc(ref);
      suppressSync = true;
      const cloudData = snap.exists() ? snap.data() : null;
      const cloudIsEmpty = !cloudData || !Array.isArray(cloudData.games) || cloudData.games.length === 0;
      const localHasData = Array.isArray(GAMES) && GAMES.length > 0;
      if(cloudData && !(cloudIsEmpty && localHasData)){
        applyCloudPayload(cloudData);
      } else {
        // Cloud vide/absent mais des données locales existent (ou premier lancement) :
        // on considère le local comme référence et on le pousse, plutôt que d'écraser
        // silencieusement une vraie collection locale avec un cloud vide.
        await setDoc(ref, buildCloudPayload());
      }
      suppressSync = false;
      refreshAllViews();
      setSyncStatus('ok', 'Synchronisé avec le cloud');
    }catch(err){
      suppressSync = false;
      console.error('Erreur de chargement Firebase', err);
      setSyncStatus('error', 'Erreur de chargement : ' + err.message);
    }
  }

  /* ---------- Écran de connexion ---------- */
  function showLoginGate(){
    document.getElementById('login-gate').classList.remove('hidden');
    document.getElementById('app-shell').classList.add('hidden');
  }
  function hideLoginGate(){
    document.getElementById('login-gate').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
  }
  function setLoginError(msg){
    const el = document.getElementById('login-error');
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }
  function translateAuthError(code){
    const map = {
      'auth/invalid-email': "Adresse email invalide.",
      'auth/user-not-found': "Aucun compte avec cet email.",
      'auth/wrong-password': "Mot de passe incorrect.",
      'auth/invalid-credential': "Email ou mot de passe incorrect.",
      'auth/email-already-in-use': "Un compte existe déjà avec cet email.",
      'auth/weak-password': "Le mot de passe doit faire au moins 6 caractères."
    };
    return map[code] || "Une erreur est survenue. Réessaie.";
  }

  document.getElementById('login-submit-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const isSignup = document.getElementById('login-gate').dataset.mode === 'signup';
    setLoginError('');
    if(!email || !password){ setLoginError('Renseigne un email et un mot de passe.'); return; }
    const btn = document.getElementById('login-submit-btn');
    btn.disabled = true;
    try{
      if(isSignup){
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    }catch(err){
      setLoginError(translateAuthError(err.code));
    }finally{
      btn.disabled = false;
    }
  });

  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if(e.key === 'Enter') document.getElementById('login-submit-btn').click();
  });

  document.getElementById('login-toggle-mode').addEventListener('click', () => {
    const gate = document.getElementById('login-gate');
    const isSignup = gate.dataset.mode === 'signup';
    gate.dataset.mode = isSignup ? 'signin' : 'signup';
    document.getElementById('login-title').textContent = isSignup ? 'Connexion' : 'Créer un compte';
    document.getElementById('login-submit-btn').textContent = isSignup ? 'Se connecter' : 'Créer le compte';
    document.getElementById('login-toggle-mode').textContent = isSignup ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter";
    setLoginError('');
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    if(confirm('Se déconnecter ?')) signOut(auth);
  });

  function hideAuthLoading(){
    const el = document.getElementById('auth-loading');
    if(el) el.classList.add('hidden');
  }

  if(window.JTD_PREVIEW_MODE){
    currentUser = null;
    document.getElementById('logout-btn').classList.add('hidden');
    document.getElementById('profile-menu-divider').classList.add('hidden');
    document.getElementById('cloud-sync-status').classList.add('hidden');
    await initApp();
    appInitialized = true;
    hideAuthLoading();
    hideLoginGate();
  } else {
  onAuthStateChanged(auth, async (user) => {
    if(user){
      currentUser = user;
      document.getElementById('logout-btn').classList.remove('hidden');
      document.getElementById('profile-menu-divider').classList.remove('hidden');
      document.getElementById('cloud-sync-status').classList.remove('hidden');
      if(!appInitialized){
        await initApp();
        appInitialized = true;
      }
      hideAuthLoading();
      hideLoginGate();
      await loadFromCloudOrSeed(user.uid);
    } else {
      currentUser = null;
      document.getElementById('logout-btn').classList.add('hidden');
      document.getElementById('profile-menu-divider').classList.add('hidden');
      document.getElementById('cloud-sync-status').classList.add('hidden');
      hideAuthLoading();
      showLoginGate();
    }
  });
  }
