(() => {
  const $ = id => document.getElementById(id);
  const overlay = $('cemetery-import-overlay');
  if(!overlay) return;
  let rows = [];
  let accountGeneration = 0;

  const normalize = value => String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g,' ').trim();
  const keyOf = item => normalize(item.nom) + '|' + platformKey(item.plateforme);
  const platformAliases = new Map([
    ['switch','Nintendo Switch'],['nintendo switch','Nintendo Switch'],['ns','Nintendo Switch'],['n switch','Nintendo Switch'],['nsw','Nintendo Switch'],
    ['switch 2','Nintendo Switch 2'],['switch2','Nintendo Switch 2'],['nintendo switch 2','Nintendo Switch 2'],['ns2','Nintendo Switch 2'],
    ['3ds','Nintendo 3DS'],['nintendo 3ds','Nintendo 3DS'],['ds','Nintendo DS'],['nintendo ds','Nintendo DS'],
    ['wii u','Nintendo Wii U'],['wii','Nintendo Wii'],['gamecube','Nintendo Gamecube'],['game cube','Nintendo Gamecube'],
    ['ps5','PlayStation 5'],['playstation 5','PlayStation 5'],['ps4','PlayStation 4'],['playstation 4','PlayStation 4'],
    ['ps3','PlayStation 3'],['playstation 3','PlayStation 3'],['ps2','PlayStation 2'],['playstation 2','PlayStation 2'],
    ['ps vita','PlayStation Vita'],['psvita','PlayStation Vita'],['vita','PlayStation Vita'],['psv','PlayStation Vita'],['playstation vita','PlayStation Vita'],['psp','PlayStation Portable'],
    ['xbox one','Xbox One'],['xbox series x','Xbox Series X'],['pc','PC'],['steam','PC']
  ]);
  const platformName = value => {
    const raw = String(value ?? '').trim();
    return platformAliases.get(normalize(raw)) || raw;
  };
  function platformKey(value){
    const key = normalize(value);
    if(['switch 2','switch2','nintendo switch 2','ns2'].includes(key)) return 'nintendo switch 2';
    if(['switch','nintendo switch','ns','n switch','nsw'].includes(key)) return 'nintendo switch';
    if(['ps5','playstation 5'].includes(key)) return 'playstation 5';
    if(['ps4','playstation 4'].includes(key)) return 'playstation 4';
    if(['ps3','playstation 3'].includes(key)) return 'playstation 3';
    if(['ps2','playstation 2'].includes(key)) return 'playstation 2';
    if(['ps vita','psvita','vita','psv','playstation vita'].includes(key)) return 'playstation vita';
    return key;
  }
  function parseMoney(value){
    let raw = String(value ?? '').trim().replace(/[€\s\u00a0]/g,'');
    if(!raw) return null;
    if(raw.includes(',') && raw.includes('.')) raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,'');
    else raw = raw.replace(',','.');
    const amount = Number(raw);
    if(!Number.isFinite(amount) || amount < 0) throw new Error('Montant invalide : ' + value);
    return amount;
  }
  function parseDate(value){
    const raw = String(value ?? '').trim();
    if(!raw) return null;
    const fr = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if(fr) return fr[3] + '-' + fr[2].padStart(2,'0') + '-' + fr[1].padStart(2,'0');
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : raw;
  }
  function parseDelimited(text, delimiter){
    const records = [];
    let row = [], field = '', quoted = false;
    for(let i=0;i<text.length;i++){
      const ch = text[i];
      if(quoted){
        if(ch === '"' && text[i+1] === '"'){field+='"';i++;}
        else if(ch === '"') quoted = false;
        else field += ch;
      } else if(ch === '"' && field === '') quoted = true;
      else if(ch === delimiter){row.push(field);field='';}
      else if(ch === '\n' || ch === '\r'){
        if(ch === '\r' && text[i+1] === '\n') i++;
        row.push(field); field=''; records.push(row); row=[];
      } else field += ch;
    }
    if(field || row.length){row.push(field);records.push(row);}
    return records.filter(record => record.some(value => String(value).trim()));
  }
  function fromCSV(text, fileName){
    const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/,3);
    const delimiter = fileName.toLowerCase().endsWith('.tsv') || lines[0].split('\t').length > lines[0].split(';').length
      ? '\t' : (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',');
    const matrix = parseDelimited(text, delimiter);
    if(matrix.length < 2) throw new Error('Le fichier ne contient aucune ligne de jeu.');
    const headers = matrix[0].map(normalize);
    const find = names => headers.findIndex(header => names.includes(header));
    const titleCol = find(['titre','titre du jeu','nom','nom jeu','jeu video','nom du jeu','game','title']);
    const platformCol = find(['jeu','plateforme','console','support','platform']);
    if(titleCol < 0 || platformCol < 0) throw new Error('Colonnes de titre et de plateforme introuvables. Vérifie que le CSV contient les en-têtes du cimetière.');
    const dateCol = find(['date','date achat','date d achat']);
    const sourceCol = find(['source','provenance','magasin']);
    const purchaseCol = find(['prix','prix achat','prix d achat']);
    const channelCol = find(['canal','lieu','lieu de vente','type de vente','mode de vente','vente']);
    const estimateCol = find(['valeur','estimation','prix estime','prix estimatif']);
    const gainCol = find(['gain','prix vente','prix reel','gain reel']);
    const imageCol = find(['image','url image','jaquette']);
    const saleVenueCol = find(['plateforme de vente','vendeur','site de vente']);
    const lotCol = find(['lot','lot id','id lot','lot vente','groupe vente','sale id']);
    const saleOrderCol = find(['ordre vente','sale order']);
    const entries = [];
    for(const cells of matrix.slice(1)){
      const get = index => index < 0 ? '' : (cells[index] ?? '').trim();
      const nom = get(titleCol), rawPlatform = get(platformCol);
      if(!nom || !rawPlatform) continue;
      const gain = parseMoney(get(gainCol));
      const item = {
        id:'import-' + Math.random().toString(36).slice(2,12),
        nom, plateforme:platformName(rawPlatform), saleStatus:gain == null ? 'pending' : 'sold'
      };
      const date = parseDate(get(dateCol)); if(date) item.date = date;
      const source = get(sourceCol); if(source) item.source = source;
      const purchase = parseMoney(get(purchaseCol)); if(purchase != null) item.prix = purchase;
      const estimate = parseMoney(get(estimateCol)); if(estimate != null) item.estimatedPrice = estimate;
      if(gain != null) item.salePrice = gain;
      const channel = normalize(get(channelCol));
      if(channel.includes('online') || channel.includes('internet') || channel.includes('reseau') || get(channelCol).includes('🛜')) item.saleChannel = 'online';
      else if(channel.includes('boutique') || channel.includes('magasin') || channel.includes('store') || get(channelCol).includes('🏪')) item.saleChannel = 'store';
      const venue = get(saleVenueCol); if(venue) item.saleVenue = venue;
      const lot = get(lotCol); if(lot) item.saleId = lot;
      const order = get(saleOrderCol); if(order && Number.isFinite(Number(order))) item.saleOrder = Number(order);
      const image = get(imageCol); if(image && /^https?:\/\//i.test(image)) item.image = image;
      entries.push(item);
    }
    return entries;
  }
  async function readEntries(file){
    const content = await file.text();
    if(/\.json$/i.test(file.name) || file.type.includes('json')){
      const parsed = JSON.parse(content);
      if(parsed && parsed.app === 'Jeux Tout Doux' && (!Number.isInteger(parsed.version) || parsed.version < 1 || parsed.version > 3)) throw new Error('Version de sauvegarde incompatible.');
      const entries = Array.isArray(parsed) ? parsed : parsed?.data?.cemetery || parsed?.cemetery;
      if(!Array.isArray(entries)) throw new Error('Aucune liste de cimetière trouvée dans ce fichier.');
      return entries;
    }
    return fromCSV(content, file.name);
  }
  function setStatus(message){ $('cemetery-import-summary').textContent = message; }
  function renderPreview(){
    const list = $('cemetery-import-list');
    list.replaceChildren();
    const state = window.JTDGetCemeteryImportState();
    const cemeteryKeys = new Set(state.cemetery.map(keyOf));
    const gameKeys = new Map(state.games.map(game => [keyOf(game), game]));
    const seenInput = new Set();
    let added = 0, alreadyThere = 0, conflicts = 0, repeated = 0;
    for(const entry of rows){
      const key = keyOf(entry);
      if(seenInput.has(key)){ entry.kind='repeat'; repeated++; continue; }
      seenInput.add(key);
      if(cemeteryKeys.has(key)){ entry.kind='existing'; alreadyThere++; continue; }
      const match = gameKeys.get(key);
      if(match){ entry.kind='match'; entry.gameId=match.id; entry.choice=''; conflicts++; }
      else { entry.kind='new'; entry.choice='add'; added++; }
    }
    const selected = added + conflicts;
    setStatus(rows.length + ' ligne(s) lue(s) · ' + added + ' ajout(s) direct(s) · ' + conflicts + ' correspondance(s) à trancher · ' + (alreadyThere + repeated) + ' doublon(s) ignoré(s).');
    $('cemetery-import-error').textContent = '';
    for(const entry of rows){
      const line = document.createElement('div');
      line.className = 'cemetery-import-row';
      const identity = document.createElement('div');
      identity.className = 'cemetery-import-identity';
      const title = document.createElement('strong'); title.textContent = entry.nom;
      const detail = document.createElement('span'); detail.textContent = entry.plateforme + (entry.saleStatus === 'sold' ? ' · encaissé ' + entry.salePrice + ' €' : ' · à vendre');
      identity.append(title,detail); line.append(identity);
      const action = document.createElement('div');
      action.className = 'cemetery-import-action';
      if(entry.kind === 'match'){
        action.innerHTML = '<label>Déjà dans la collection</label><select aria-label="Action pour ' + escapeHTML(entry.nom) + '"><option value="">Choisir une action…</option><option value="keep">Ajouter au cimetière et garder dans la collection</option><option value="transfer">Transférer ce jeu au cimetière</option><option value="skip">Ignorer cette ligne</option></select>';
        const select = action.querySelector('select'); select.value = entry.choice;
        select.addEventListener('change',() => { entry.choice=select.value; validateChoices(); });
      } else {
        const label = document.createElement('span');
        label.className = 'cemetery-import-status';
        label.textContent = entry.kind === 'new' ? 'Ajouté au cimetière' : entry.kind === 'existing' ? 'Déjà au cimetière · conservé tel quel' : 'Répétition dans le fichier · ignorée';
        action.append(label);
      }
      line.append(action); list.append(line);
    }
    $('cemetery-import-apply').disabled = conflicts > 0;
    $('cemetery-import-apply').textContent = 'Ajouter au cimetière';
    if(!selected) $('cemetery-import-apply').disabled = true;
  }
  function validateChoices(){
    const unresolved = rows.some(entry => entry.kind === 'match' && !entry.choice);
    $('cemetery-import-apply').disabled = unresolved || !rows.some(entry => entry.kind === 'new' || entry.kind === 'match' && entry.choice !== 'skip');
  }
  function open(){overlay.classList.remove('hidden');}
  function close(){overlay.classList.add('hidden');rows=[];}
  $('cemetery-import-input').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value='';
    if(!file) return;
    accountGeneration = window.JTDAccountGeneration || 0;
    try{
      const input = await readEntries(file);
      const normalized = window.JTDData.normalizeData({games:[],cemetery:input});
      rows = normalized.cemetery.map(entry => ({...entry, plateforme:platformName(entry.plateforme)}));
      if(!rows.length) throw new Error('Aucun jeu avec un titre et une plateforme valides.');
      renderPreview(); open();
    }catch(error){
      window.showToast?.(error.message || 'Import impossible.');
      console.error('Import du cimetière impossible',error);
    }
  });
  $('cemetery-import-cancel').addEventListener('click',close);
  overlay.addEventListener('click',event => { if(event.target === overlay) close(); });
  $('cemetery-import-apply').addEventListener('click',() => {
    if(accountGeneration !== (window.JTDAccountGeneration || 0)){ $('cemetery-import-error').textContent='Le compte a changé. Relance l’import depuis le bon compte.'; return; }
    const state = window.JTDGetCemeteryImportState();
    const games = state.games.slice(), cemetery = state.cemetery.slice();
    const remaining = rows.filter(entry => entry.kind === 'new' || entry.kind === 'match' && entry.choice !== 'skip');
    const decisions = rows.filter(entry => entry.kind === 'match');
    if(decisions.some(entry => !entry.choice)){ validateChoices(); return; }
    const transfers = new Set(decisions.filter(entry => entry.choice === 'transfer').map(entry => entry.gameId));
    const uniqueId = base => {
      let id = base || 'import-' + Math.random().toString(36).slice(2,10), n=1;
      const used = new Set([...games,...cemetery].map(item=>item.id));
      while(used.has(id)) id = (base || 'import') + '-' + n++;
      return id;
    };
    for(const entry of remaining){
      const {kind,gameId,choice,...incoming} = entry;
      if(entry.kind === 'match' && entry.choice === 'transfer'){
        const game = games.find(item=>item.id===entry.gameId);
        if(!game) continue;
        const merged = {...incoming,...game,id:game.id,nom:game.nom,plateforme:game.plateforme,saleStatus:incoming.saleStatus};
        for(const field of ['saleVenue','saleChannel','estimatedPrice','salePrice','saleId','saleOrder']){
          if(incoming[field] !== undefined) merged[field] = incoming[field];
          else delete merged[field];
        }
        games.splice(games.indexOf(game),1);
        cemetery.push(merged);
      } else cemetery.push({...incoming,id:uniqueId(entry.id)});
    }
    try{
      window.JTDApplyCemeteryImport(games,cemetery);
      const added = remaining.length;
      close();
      window.showToast?.(added + ' entrée(s) ajoutée(s) au cimetière. La collection et les autres listes ont été conservées.');
    }catch(error){
      $('cemetery-import-error').textContent=error.message || 'Enregistrement impossible. Aucune modification appliquée.';
    }
  });
})();
