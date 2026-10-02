/* Shared data boundary: no DOM or Firebase dependency. */
(function(root){
  'use strict';
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, field, nullable = true) => {
    if(value == null && nullable) return null;
    if(typeof value !== 'string') throw new Error('Champ invalide : ' + field);
    return value;
  };
  function escapeHTML(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function safeURL(value, image = false){
    if(typeof value !== 'string' || !value.trim()) return '';
    if(image && /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
    try{
      const url = new URL(value);
      return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    }catch(e){ return ''; }
  }
  function normalizeData(data, defaults = {}){
    if(!isRecord(data) || !Array.isArray(data.games)) throw new Error('Collection invalide');
    const used = new Set();
    let sequence = 0;
    const list = (key) => {
      if(data[key] === undefined && key !== 'games') return [];
      if(!Array.isArray(data[key])) throw new Error('Liste invalide : ' + key);
      return data[key].map(value => {
        if(!isRecord(value)) throw new Error('Entrée invalide');
        const nom = text(value.nom, 'nom', false).trim();
        const plateforme = text(value.plateforme, 'plateforme', false).trim();
        if(!nom || !plateforme) throw new Error('Nom ou plateforme vide');
        let id = value.id;
        if(id != null && typeof id !== 'string' && typeof id !== 'number') throw new Error('Identifiant invalide');
        if(typeof id === 'number' && !Number.isFinite(id)) throw new Error('Identifiant invalide');
        id = id == null ? '' : String(id);
        if(!id || used.has(id)){
          do { id = 'restored-' + key + '-' + (++sequence); } while(used.has(id));
        }
        used.add(id);
        const item = {id, nom, plateforme};
        for(const field of ['date','source','image','lien','format','type','status']){
          if(value[field] !== undefined) item[field] = text(value[field], field);
        }
        for(const field of ['collector','japanese']){
          if(value[field] != null && typeof value[field] !== 'boolean') throw new Error('Édition invalide');
          item[field] = value[field] === true;
        }
        if(value.prix != null && (typeof value.prix !== 'number' || !Number.isFinite(value.prix))) throw new Error('Prix invalide');
        if(value.prix !== undefined) item.prix = value.prix;
        if(item.image) item.image = safeURL(item.image, true) || null;
        if(item.lien) item.lien = safeURL(item.lien) || null;
        if(key === 'games'){
          if(item.format === 'Collector'){ item.format = 'Physique'; item.collector = true; }
          if(!item.format) item.format = 'Physique';
          if(!['Physique','Numérique'].includes(item.format)) throw new Error('Format invalide');
          if(item.type === 'Compilation') item.type = 'Jeu simple';
          if(item.type === 'Jeu + DLC') item.type = 'Complete Edition';
          if(item.format !== 'Numérique') item.type = null;
          else if(!item.type) item.type = 'Jeu simple';
        }
        return item;
      });
    };
    const games = list('games'), arrivals = list('arrivals'), wishlist = list('wishlist');
    if(data.platformMeta !== undefined && !isRecord(data.platformMeta)) throw new Error('Métadonnées invalides');
    const platformMeta = Object.create(null);
    for(const [name, meta] of Object.entries(data.platformMeta || {})){
      if(!name.trim() || !isRecord(meta)) throw new Error('Plateforme invalide');
      const color = text(meta.color, 'couleur');
      if(color && !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color)) throw new Error('Couleur invalide');
      platformMeta[name] = {color, logo: safeURL(text(meta.logo, 'logo'), true) || null};
    }
    if(data.platformOrder !== undefined && (!Array.isArray(data.platformOrder) || !data.platformOrder.every(p => typeof p === 'string' && p.trim()))) throw new Error('Ordre des plateformes invalide');
    if(data.profile !== undefined && !isRecord(data.profile)) throw new Error('Profil invalide');
    const profile = data.profile || {};
    const profileName = text(profile.name ?? data.profileName ?? defaults.profileName ?? '', 'profil', false);
    const avatar = text(profile.avatar !== undefined ? profile.avatar : (data.profileAvatar !== undefined ? data.profileAvatar : defaults.profileAvatar), 'avatar');
    return {games, arrivals, wishlist, platformMeta, platformOrder:[...new Set(data.platformOrder || [])], profileName, profileAvatar:safeURL(avatar, true) || null};
  }
  function parseBackup(parsed, defaults){
    let data;
    if(Array.isArray(parsed)) data = {games:parsed};
    else if(isRecord(parsed) && parsed.app === 'Jeux Tout Doux'){
      if(!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > 2) throw new Error('Version de sauvegarde incompatible');
      data = parsed.data;
    }else data = parsed;
    return normalizeData(data, defaults);
  }
  function transferItem(source, target, id, draft){
    if(!source.some(item => item.id === id)) throw new Error('Élément introuvable');
    if(target.some(item => item.id === id)) throw new Error('Élément déjà transféré');
    return {source:source.filter(item => item.id !== id), target:[...target, {...draft, id}]};
  }
  function createStorage(storage){
    let uid = null;
    const keyFor = key => {
      if(!uid) throw new Error('Compte non chargé');
      return 'jtd-account:' + encodeURIComponent(uid) + ':' + key;
    };
    return {
      setAccount(value){ uid = value || null; },
      getItem(key){ return storage.getItem(keyFor(key)); },
      setItem(key, value){ storage.setItem(keyFor(key), value); },
      // Old unscoped data stays untouched: it is never attributed to a new account.
      hasLegacy(key){ return storage.getItem(key) !== null; },
      consumeLegacyNotice(key){
        const marker = keyFor('legacy-notice-v1');
        try {
          if(storage.getItem(key) === null || storage.getItem(marker) === 'seen') return false;
          storage.setItem(marker, 'seen');
          return true;
        } catch { return false; }
      },
      atomicWrite(entries){
        const previous = entries.map(([key]) => [keyFor(key), storage.getItem(keyFor(key))]);
        try { for(const [key,value] of entries) storage.setItem(keyFor(key), value); }
        catch(error){
          let rollbackFailed = false;
          for(const [key,value] of previous){
            try { if(value === null) storage.removeItem(key); else storage.setItem(key,value); }
            catch(e){ rollbackFailed = true; }
          }
          throw new Error(rollbackFailed ? 'Stockage indisponible ; retour local incomplet. Les données en mémoire sont conservées.' : 'Stockage indisponible ; restauration annulée.');
        }
      }
    };
  }
  function createSession(){
    let generation = 0, uid = null;
    return {
      start(nextUid){ uid = nextUid || null; return {uid, generation:++generation}; },
      current(){ return {uid, generation}; },
      isCurrent(session){ return !!session.uid && session.uid === uid && session.generation === generation; }
    };
  }
  const api = {escapeHTML, safeURL, normalizeData, parseBackup, transferItem, createStorage, createSession};
  root.JTDData = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
