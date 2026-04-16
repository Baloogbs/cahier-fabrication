// ============================================================
// CAHIER DE FABRICATION — app.js
// Stockage local (localStorage) — Firebase à brancher ensuite
// ============================================================

// ---- CONSTANTES ----
const USERS_KEY = 'cab_users';
const SESSION_KEY = 'cab_session';
const FABRICATIONS_KEY = 'cab_fabrications';

// Utilisateurs de démo (à remplacer par Firebase Auth)
const DEFAULT_USERS = [
  { email: 'boucher@carrefour.com', password: 'demo1234', nom: 'M. Dupont' },
  { email: 'chef@carrefour.com',    password: 'demo1234', nom: 'Mme Martin' },
  { email: 'olivier@carrefour.com', password: 'admin',    nom: 'Olivier G.' },
];

// ---- INITIALISATION ----
function init() {
  // Forcer la création des utilisateurs si localstorage vide ou corrompu
  const usersStr = localStorage.getItem(USERS_KEY);
  if (!usersStr || usersStr === '[]') {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
    console.log("Utilisateurs de démo initialisés dans localStorage.");
  }
  
  if (!localStorage.getItem(FABRICATIONS_KEY)) {
    localStorage.setItem(FABRICATIONS_KEY, JSON.stringify([]));
  }

  const page = document.body.className;
  console.log("Page détectée :", page);

  if (page === 'page-login') {
    // Si déjà connecté → accueil direct
    if (getSession()) window.location.href = 'accueil.html';
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.focus();
  }

  if (page === 'page-home') {
    requireSession();
    renderHeader();
    renderHistory();
  }

  if (page === 'page-saisie') {
    requireSession();
    initSaisie();
  }

  if (page === 'page-detail') {
    requireSession();
    renderDetail();
  }
}

// ---- SESSION ----
function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
}

function requireSession() {
  if (!getSession()) window.location.href = 'index.html';
}

function handleLogin() {
  console.log("Tentative de connexion...");
  const emailEl = document.getElementById('login-email');
  const passEl  = document.getElementById('login-password');
  
  if (!emailEl || !passEl) {
    console.error("Éléments HTML introuvables : email =", !!emailEl, "pass =", !!passEl);
    return;
  }

  const email    = emailEl.value.trim().toLowerCase();
  const password = passEl.value;
  const errEl    = document.getElementById('login-error');
  
  console.log("Email saisi :", email);
  const usersStr = localStorage.getItem(USERS_KEY);
  console.log("Contenu local (USERS_KEY) :", usersStr);
  
  const users = JSON.parse(usersStr || '[]');
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    console.log("Utilisateur trouvé :", user.nom);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: user.email, nom: user.nom }));
    window.location.href = 'accueil.html';
  } else {
    console.warn("Échec : Identifiant ou mot de passe incorrect.");
    if (errEl) errEl.classList.remove('hidden');
  }
}

function handleLogout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

// Connexion avec touche Entrée
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.body.className === 'page-login') handleLogin();
});

let html5QrCode = null;
let currentIngIdForScan = null;

function startModernScan(ingId) {
  currentIngIdForScan = ingId || null;
  const overlay = document.getElementById('scanner-overlay');
  overlay.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const readerDiv = document.getElementById('reader');

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 200, height: 100 } },
    (decodedText) => {
      html5QrCode.stop().then(() => {
        document.getElementById('scanner-overlay').classList.add('hidden');
        if (currentIngIdForScan) {
          fillIngredientFromCode(currentIngIdForScan, decodedText);
        } else {
          addIngredientFromCode(decodedText);
        }
      });
    },
    () => {}
  ).catch((err) => {
    console.error("Erreur scanner :", err);
    alert("Impossible d'ouvrir le scanner : " + err);
    document.getElementById('scanner-overlay').classList.add('hidden');
  });
}

function stopModernScan() {
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
  }
  document.getElementById('scanner-overlay').classList.add('hidden');
}

// ---- ACCUEIL ----
function renderHeader() {
  const session = getSession();
  const el = document.getElementById('header-user');
  if (el) el.textContent = 'Boucherie Carrefour';
}

function toggleChoices() {
  const panel = document.getElementById('choices-panel');
  panel.classList.toggle('hidden');
}

function goToNew(type) {
  sessionStorage.setItem('new_type', type);
  window.location.href = 'saisie.html';
}

function renderHistory() {
  const fabrications = getFabrications();
  const container = document.getElementById('history-list');
  if (!fabrications.length) {
    container.innerHTML = '<div class="empty-state" style="text-align: center;">Aucune fabrication enregistrée pour le moment.</div>';
    return;
  }

  // Filtrer pour le mois en cours uniquement
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const fabsDuMois = fabrications.filter(fab => {
    const d = new Date(fab.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  if (!fabsDuMois.length) {
    container.innerHTML = '<div class="empty-state" style="text-align: center; color: #999;">Aucune préparation ce mois-ci.</div>';
    return;
  }

  // Regrouper (ici une seule liste plate)
  container.innerHTML = `
    <div class="month-group">
      ${fabsDuMois.map(fab => `
        <div class="fab-item" onclick="goToDetail('${fab.id}')">
          <div>
            <div class="fab-name">${fab.nom}</div>
            <div class="fab-meta">${formatDate(fab.date)} · ${fab.poids} ${fab.unite || 'kg'}</div>
          </div>
          <span class="fab-badge ${badgeClass(fab.type)}">${typeLabel(fab.type)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function goToDetail(id) {
  sessionStorage.setItem('detail_id', id);
  window.location.href = 'detail.html';
}

// ---- SAISIE ----
let ingredients = [];
let photoData   = null;

function toggleIngChoices() {
  const panel = document.getElementById('ing-choices');
  panel.classList.toggle('hidden');
  document.getElementById('scan-zone').classList.add('hidden');
}

let currentCameraIndex = 0;
let availableCameras = [];

function startScanMode() {
  document.getElementById('ing-choices').classList.add('hidden');
  
  // SOLUTION SPECIFIQUE GALAXY S21 / SAMSUNG
  // Le mode "Live Stream" avec Quagga cause trop d'erreurs Overconstrained
  // On bascule directement sur l'appareil photo haute qualité du S21
  console.log("Mode Samsung S21 : Utilisation de l'appareil photo natif");
  takePhoto();
}

/**
 * Ancienne fonction Quagga conservée au cas où, mais court-circuitée pour le S21
 */
function initQuagga(deviceId) {
  if (typeof Quagga === 'undefined') {
    console.error("Quagga n'est pas chargé");
    return;
  }

  // On essaie de vider TOTALEMENT les contraintes pour laisser le navigateur décider
  const constraints = {};
  if (deviceId && deviceId.exact) {
      constraints.deviceId = deviceId;
  } else {
      constraints.facingMode = "environment";
  }

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#interactive'),
      constraints: constraints
    },
    decoder: {
      readers: ["ean_reader", "ean_8_reader"]
    }
  }, function(err) {
    if (err) {
      console.error("Erreur Quagga Init:", err);
      // SOLUTION DE SECOURS RADICALE : Utiliser l'appareil photo natif si le live stream échoue
      if (err.name === "OverconstrainedError" || err.name === "NotReadableError") {
          alert("Mode de secours : Le scanner fluide ne fonctionne pas sur ce capteur. L'appareil photo standard va être utilisé.");
          takePhoto(); // On bascule sur la photo classique
          return;
      }
      alert("Erreur caméra : " + err.name);
      return;
    }
    Quagga.start();
  });

  Quagga.onDetected(function(result) {
    const code = result.codeResult.code;
    if (code) {
      Quagga.stop();
      addIngredientFromCode(code);
    }
  });
}

/**
 * Version de secours si la HD échoue sur un capteur spécifique
 */
function initQuaggaBasic(deviceId) {
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector('#interactive'),
      constraints: {
        deviceId: deviceId,
        facingMode: deviceId ? undefined : "environment"
      }
    },
    decoder: { readers: ["ean_reader", "ean_8_reader"] }
  }, function(err) {
    if (err) alert("Erreur fatale caméra : " + err);
    else Quagga.start();
  });
}

/**
 * Déclenche le clic sur l'input de fichier (photo)
 */
function takePhoto() {
  const photoInput = document.getElementById('photo-input');
  if (photoInput) photoInput.click();
}

function initSaisie() {
  const dateInput = document.getElementById('fab-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

function handleScanInput(event) {
  if (event.key === 'Enter') {
    const input = document.getElementById('scan-input');
    const code  = input.value.trim();
    if (!code) return;
    addIngredientFromCode(code);
    input.value = '';
    // Masquer la zone de scan après ajout
    const zone = document.getElementById('scan-zone');
    if (zone) zone.classList.add('hidden');
  }
}

async function addIngredientFromCode(code) {
  const feedback = document.getElementById('scan-feedback');
  if (feedback) { feedback.textContent = 'Recherche du produit...'; feedback.classList.remove('hidden'); }

  const productData = await resolveProductData(code);
  const id = Date.now();
  ingredients.push({ id, code, nom: productData.nom, lot: '', dlc: '', photos: productData.img ? [productData.img] : [], validated: false });
  renderIngredients();

  if (feedback) {
    feedback.textContent = 'Produit ajouté : ' + productData.nom;
    setTimeout(() => feedback.classList.add('hidden'), 3000);
  }
}

async function fillIngredientFromCode(ingId, code) {
  const ing = ingredients.find(i => i.id === ingId);
  if (!ing) return;
  const feedback = document.getElementById('scan-feedback');
  if (feedback) { feedback.textContent = 'Recherche du produit...'; feedback.classList.remove('hidden'); }

  const productData = await resolveProductData(code);
  ing.code = code;
  ing.nom = productData.nom;
  if (productData.img) {
    if (!ing.photos) ing.photos = [];
    ing.photos.push(productData.img);
  }
  renderIngredients();

  if (feedback) {
    feedback.textContent = 'Produit trouvé : ' + productData.nom;
    setTimeout(() => feedback.classList.add('hidden'), 3000);
  }
}

async function resolveProductData(code) {
  const products = {
    '3256540001649': { nom: 'Boeuf haché 15% MG', img: null },
    '3564700012345': { nom: 'Poivrons rouges', img: null },
    '8712100851644': { nom: 'Marinade herbes de Provence', img: null },
    '3256541234567': { nom: 'Oignons rouges', img: null },
  };
  if (products[code]) return products[code];

  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await response.json();
    if (data.status === 1 && data.product) {
      const nom = data.product.product_name_fr || data.product.product_name || ('Produit ' + code);
      const img = data.product.image_front_small_url || data.product.image_front_thumb_url || null;
      return { nom, img };
    }
  } catch (error) {
    console.error("Erreur API OFF:", error);
  }
  return { nom: 'Produit ' + code, img: null };
}

function removeIngredient(id) {
  ingredients = ingredients.filter(i => i.id !== id);
  renderIngredients();
}

let activeIngIdForPhoto = null;

function addNewIngredient() {
  const id = Date.now();
  ingredients.push({ id, code: 'MANUAL', nom: '', lot: '', dlc: '', photos: [], validated: false });
  renderIngredients();
}

function removePhotoFromIng(ingId, photoIdx) {
  const ing = ingredients.find(i => i.id === ingId);
  if (ing && ing.photos) {
    ing.photos.splice(photoIdx, 1);
    renderIngredients();
  }
}

function triggerPhotoForIng(id) {
  activeIngIdForPhoto = id;
  const photoInput = document.getElementById('photo-input');
  if (photoInput) photoInput.click();
}

function updateIngredient(id, field, value) {
  const ing = ingredients.find(i => i.id === id);
  if (ing) {
    ing[field] = value;
  }
}

function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target.result;
    
    if (activeIngIdForPhoto) {
      const ing = ingredients.find(i => i.id === activeIngIdForPhoto);
      if (ing) {
        if (!ing.photos) ing.photos = [];
        ing.photos.push(data);
      }
      activeIngIdForPhoto = null;
    }
    
    renderIngredients();
    event.target.value = '';
  };
  reader.readAsDataURL(file);
}

function renderIngredients() {
  const list = document.getElementById('ingredients-list');
  if (!list) return;

  // Masquer le bouton "Ajouter" si un ingrédient est en cours de saisie
  const hasInProgress = ingredients.some(ing => !ing.validated);
  const addBtnZone = document.getElementById('ingredient-actions');
  if (addBtnZone) {
    addBtnZone.classList.toggle('hidden', hasInProgress);
  }

  if (!ingredients.length) { list.innerHTML = ''; return; }

  list.innerHTML = ingredients.map(ing => {
    if (ing.validated) {
      return `
        <div class="ingredient-item validated" style="padding: 10px; background: #f0f7f4; border: 1px solid #1D9E75; opacity: 0.9;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="background: #1D9E75; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;">✓</div>
              <div style="font-weight: 500; font-size: 14px; color: #00695c;">${ing.nom || 'Sans nom'}</div>
              <div style="font-size: 12px; color: #666; margin-left: 5px;">(Lot: ${ing.lot || '—'})</div>
            </div>
            <button onclick="toggleValidateIngredient(${ing.id})" style="background: none; border: none; color: #1D9E75; font-size: 12px; text-decoration: underline; font-weight: 500;">Modifier</button>
          </div>
        </div>
      `;
    }

    return `
    <div class="ingredient-item">
      <div class="ing-header">
        <div style="flex:1;">
          <label class="field-label" style="font-size:11px; margin-bottom:4px; display:block; color:#666;">Nom de l'ingrédient</label>
          <input type="text" class="ing-name-input" placeholder="Ex: Boeuf, Sel, Marinade..." value="${ing.nom}"
            oninput="updateIngredient(${ing.id}, 'nom', this.value)"
            style="width:100%; height:36px; font-weight:500; border: 1px solid #ccc; border-radius: 6px; padding: 0 10px; background:#fff;" />
        </div>
        <button class="ing-delete" onclick="removeIngredient(${ing.id})" style="margin-top:20px;">&#10005;</button>
      </div>

      <!-- Boutons Scanner / Photo -->
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button onclick="startModernScan(${ing.id})"
          style="flex:1; height:44px; background:#1D9E75; color:white; border:none; border-radius:10px; font-size:13px; font-weight:500; display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"></path>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Scanner
        </button>
        <button onclick="triggerPhotoForIng(${ing.id})"
          style="flex:1; height:44px; background:#0C447C; color:white; border:none; border-radius:10px; font-size:13px; font-weight:500; display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
          Photo
        </button>
      </div>

      <div class="ing-fields" style="margin-top:15px;">
        <div class="ing-field">
          <label style="font-size:11px; color:#666;">n° de Lot</label>
          <input type="text" placeholder="Ex: LOT2026A" value="${ing.lot}"
            oninput="updateIngredient(${ing.id}, 'lot', this.value)"
            style="height:36px;" />
        </div>
        <div class="ing-field">
          <label style="font-size:11px; color:#666;">DLC</label>
          <input type="date" value="${ing.dlc}"
            oninput="updateIngredient(${ing.id}, 'dlc', this.value)"
            style="height:36px;" />
        </div>
      </div>

      <!-- Photos -->
      <div style="margin: 15px 0 10px 0;">
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${(ing.photos || []).map((p, idx) => `
            <div style="position:relative;">
              <img src="${p}" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #ddd;" />
              <button onclick="removePhotoFromIng(${ing.id}, ${idx})" style="position:absolute; top:-5px; right:-5px; background:#d32f2f; color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:9px; display:flex; align-items:center; justify-content:center;">✕</button>
            </div>
          `).join('')}
        </div>
      </div>

      <button onclick="toggleValidateIngredient(${ing.id})"
        style="width:100%; margin-top:5px; padding:12px; border-radius:8px; border:none; background:#0C447C; color:white; font-weight:500; font-size:15px;">
        ✓ Valider l'ingrédient
      </button>
    </div>
    `;
  }).join('');
}

function toggleValidateIngredient(id) {
  const ing = ingredients.find(i => i.id === id);
  if (ing) {
    ing.validated = !ing.validated;
    renderIngredients();
  }
}

function saveFabrication() {
  const nom          = document.getElementById('fab-nom').value.trim();
  const preparateur  = document.getElementById('fab-preparateur').value.trim();
  const poids        = document.getElementById('fab-poids').value;
  const unite        = document.getElementById('fab-unite').value;
  const date         = document.getElementById('fab-date').value;
  const type         = sessionStorage.getItem('new_type') || 'preparation';
  const errEl        = document.getElementById('save-error');
  const session      = getSession();

  if (!preparateur) { showError(errEl, 'Veuillez saisir le nom du préparateur.'); return; }
  if (!nom) { showError(errEl, 'Veuillez saisir un nom de préparation.'); return; }
  if (!poids) { showError(errEl, 'Veuillez saisir la quantité.'); return; }
  if (!date) { showError(errEl, 'Veuillez saisir une date.'); return; }

  const fab = {
    id: 'fab_' + Date.now(),
    type,
    nom,
    preparateur: preparateur || (session ? session.nom : 'Inconnu'),
    poids: parseFloat(poids).toFixed(1),
    unite,
    date,
    heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    auteur: session ? session.nom : 'Inconnu',
    ingredients: ingredients.slice(),
    createdAt: new Date().toISOString(),
  };

  const fabs = getFabrications();
  fabs.push(fab);
  localStorage.setItem(FABRICATIONS_KEY, JSON.stringify(fabs));

  // Réinitialiser
  ingredients = [];
  photoData   = null;

  window.location.href = 'accueil.html';
}

// ---- DETAIL ----
function renderDetail() {
  const id   = sessionStorage.getItem('detail_id');
  const fab  = getFabrications().find(f => f.id === id);
  const cont = document.getElementById('detail-content');

  if (!fab) {
    cont.innerHTML = '<div class="empty-state">Fabrication introuvable.</div>';
    return;
  }

  const today   = new Date(); today.setHours(0,0,0,0);
  const warn3   = new Date(today); warn3.setDate(warn3.getDate() + 3);
  let allOk     = true;
  let hasWarn   = false;

  const ingsHtml = fab.ingredients.map(ing => {
    let dlcClass = 'dlc-ok';
    let dlcLabel = ing.dlc ? formatDate(ing.dlc) : '—';
    if (ing.dlc) {
      const dlcDate = new Date(ing.dlc);
      if (dlcDate < today)         { dlcClass = 'dlc-expired'; allOk = false; }
      else if (dlcDate <= warn3)   { dlcClass = 'dlc-warn';    hasWarn = true; }
    }
    
    // Affichage multi-photos dans le détail
    const photosArr = ing.photos || (ing.photo ? [ing.photo] : []);
    const photosHtml = photosArr.length > 0 ? `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
        ${photosArr.map(p => `<img src="${p}" style="width: 100%; max-height: 250px; object-fit: cover; border-radius: 8px; border: 1px solid #eee;" />`).join('')}
      </div>
    ` : '';

    return `
      <div class="ing-row">
        ${photosHtml}
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="ing-row-name">${ing.nom || 'Sans nom'}</div>
            <div class="ing-row-meta">Lot : ${ing.lot || '—'}</div>
          </div>
          <span class="dlc-badge ${dlcClass}">DLC ${dlcLabel}</span>
        </div>
      </div>
    `;
  }).join('');

  const conformityClass  = allOk && !hasWarn ? '' : (allOk ? 'warn' : 'warn');
  const conformityText   = allOk && !hasWarn
    ? 'Toutes les DLC sont conformes'
    : hasWarn && allOk
      ? 'Attention : certaines DLC sont proches'
      : 'Attention : DLC dépassée détectée';

  const photoHtml = fab.photo
    ? `<img src="${fab.photo}" alt="Photo" style="width:100%;border-radius:10px;display:block;" />`
    : `<div class="photo-zone">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.4;">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <span>Aucune photo enregistrée</span>
      </div>`;

  cont.innerHTML = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <span class="type-badge ${fab.type === 'marinade' ? 'mar' : fab.type === 'farce' ? 'farce' : ''}">${typeLabel(fab.type)}</span>
        <button onclick="deleteFabrication('${fab.id}')" style="background: none; border: none; color: #d32f2f; cursor: pointer; padding: 5px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
      <div class="detail-name">${fab.nom}</div>
      <div class="info-grid">
        <div class="info-block">
          <span class="info-label">Date de fabrication</span>
          <span class="info-value">${formatDate(fab.date)}</span>
        </div>
        <div class="info-block">
          <span class="info-label">Quantité finale</span>
          <span class="info-value">${fab.poids} ${fab.unite || 'kg'}</span>
        </div>
        <div class="info-block" style="margin-top:8px;">
          <span class="info-label">Heure</span>
          <span class="info-value">${fab.heure}</span>
        </div>
      </div>
      ${fab.ingredients.length ? `
        <div class="conformity-row">
          <div class="conformity-dot ${conformityClass}"></div>
          <span class="conformity-text ${conformityClass}">${conformityText}</span>
        </div>` : ''}
      <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 14px; color: #555;">
        Préparé par : <strong>${fab.preparateur || fab.auteur}</strong>
      </div>
    </div>

    ${fab.ingredients.length ? `
    <div class="card">
      <div class="card-title">Ingrédients &amp; traçabilité</div>
      ${ingsHtml}
    </div>` : ''}
  `;
}

// ---- UTILITAIRES ----
function getFabrications() {
  try { return JSON.parse(localStorage.getItem(FABRICATIONS_KEY) || '[]'); } catch { return []; }
}

function deleteFabrication(id) {
  if (!confirm("Voulez-vous vraiment supprimer cette fabrication ? Cette action est irréversible.")) return;
  
  const fabs = getFabrications();
  const updatedFabs = fabs.filter(f => f.id !== id);
  localStorage.setItem(FABRICATIONS_KEY, JSON.stringify(updatedFabs));
  
  window.location.href = 'accueil.html';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function typeLabel(type) {
  return type === 'marinade' ? 'Viandes marinées' : type === 'farce' ? 'Farces' : 'Préparation bouchère';
}

function badgeClass(type) {
  return type === 'marinade' ? 'badge-mar' : type === 'farce' ? 'badge-farce' : 'badge-prep';
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ---- LANCEMENT ----
window.onload = init;
