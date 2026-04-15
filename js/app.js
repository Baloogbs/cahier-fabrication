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
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
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

// ---- ACCUEIL ----
function renderHeader() {
  const session = getSession();
  const el = document.getElementById('header-user');
  if (el && session) el.textContent = session.nom + ' — Boucherie Carrefour';
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
    container.innerHTML = '<div class="empty-state">Aucune fabrication enregistrée pour le moment.</div>';
    return;
  }

  // Grouper par mois
  const groups = {};
  fabrications.slice().reverse().forEach(fab => {
    const d = new Date(fab.date);
    const key = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(fab);
  });

  container.innerHTML = Object.entries(groups).map(([mois, fabs]) => `
    <div class="month-group">
      <div class="month-label">${capitalize(mois)}</div>
      ${fabs.map(fab => `
        <div class="fab-item" onclick="goToDetail('${fab.id}')">
          <div>
            <div class="fab-name">${fab.nom}</div>
            <div class="fab-meta">${formatDate(fab.date)} · ${fab.poids} kg</div>
          </div>
          <span class="fab-badge ${badgeClass(fab.type)}">${typeLabel(fab.type)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
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
  // Identification produit via API Open Food Facts (réel) ou démo
  const feedback = document.getElementById('scan-feedback');
  if (feedback) {
    feedback.textContent = 'Recherche du produit...';
    feedback.classList.remove('hidden');
  }

  const nomProduit = await resolveProductName(code);
  const id = Date.now();
  ingredients.push({ id, code, nom: nomProduit, lot: '', dlc: '' });
  renderIngredients();

  if (feedback) {
    feedback.textContent = 'Produit ajouté : ' + nomProduit;
    setTimeout(() => feedback.classList.add('hidden'), 3000);
  }

  // Masquer la zone de scan après ajout
  const zone = document.getElementById('scan-zone');
  if (zone) zone.classList.add('hidden');
}

async function resolveProductName(code) {
  // 1. Table de correspondance locale (démo rapide)
  const products = {
    '3256540001649': 'Boeuf haché 15% MG',
    '3564700012345': 'Poivrons rouges',
    '8712100851644': 'Marinade herbes de Provence',
    '3256541234567': 'Oignons rouges',
  };
  
  if (products[code]) return products[code];

  // 2. Appel à l'API Open Food Facts si non trouvé en local
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await response.json();
    
    if (data.status === 1 && data.product && data.product.product_name_fr) {
      return data.product.product_name_fr;
    } else if (data.status === 1 && data.product && data.product.product_name) {
      return data.product.product_name;
    }
  } catch (error) {
    console.error("Erreur API OFF:", error);
  }

  return 'Produit ' + code; // Par défaut si non trouvé
}

function removeIngredient(id) {
  ingredients = ingredients.filter(i => i.id !== id);
  renderIngredients();
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
    const id = Date.now();
    // On ajoute directement l'ingrédient de type photo
    ingredients.push({ 
      id, 
      code: 'PHOTO', 
      nom: '', 
      lot: '', 
      dlc: '', 
      photo: data 
    });
    renderIngredients();
    
    // Masquer le menu de choix après la capture
    const choices = document.getElementById('ing-choices');
    if (choices) choices.classList.add('hidden');
    
    // Réinitialiser l'input pour permettre une nouvelle photo identique (si besoin)
    event.target.value = '';
  };
  reader.readAsDataURL(file);
}

function renderIngredients() {
  const list = document.getElementById('ingredients-list');
  if (!list) return;
  if (!ingredients.length) { list.innerHTML = ''; return; }
  
  list.innerHTML = ingredients.map(ing => `
    <div class="ingredient-item ${ing.validated ? 'validated' : ''}">
      <div class="ing-header">
        ${ing.photo 
          ? `<input type="text" class="ing-name-input" placeholder="Nom du produit" value="${ing.nom}" 
              oninput="updateIngredient(${ing.id}, 'nom', this.value)" 
              ${ing.validated ? 'disabled' : ''}
              style="flex:1; margin-right:10px; height:32px; font-weight:500; border: 1px solid #ccc; border-radius: 4px; padding: 0 8px;" />`
          : `<span class="ing-name-label">${ing.nom}</span>`
        }
        <button class="ing-delete" onclick="removeIngredient(${ing.id})">&#10005;</button>
      </div>
      
      ${ing.photo ? `
        <div style="margin: 10px 0;">
          <img src="${ing.photo}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border: 1px solid #eee;" />
        </div>` : ''
      }

      <div class="ing-fields">
        <div class="ing-field">
          <label>N° de lot</label>
          <input type="text" placeholder="Ex: LOT2026A" value="${ing.lot}"
            oninput="updateIngredient(${ing.id}, 'lot', this.value)"
            ${ing.validated ? 'disabled' : ''} />
        </div>
        <div class="ing-field">
          <label>DLC</label>
          <input type="date" value="${ing.dlc}"
            oninput="updateIngredient(${ing.id}, 'dlc', this.value)"
            ${ing.validated ? 'disabled' : ''} />
        </div>
      </div>

      <button class="btn-validate-ing ${ing.validated ? 'btn-validated' : ''}" 
        onclick="toggleValidateIngredient(${ing.id})" 
        style="width:100%; margin-top:10px; padding: 8px; border-radius: 6px; border: none; 
               background: ${ing.validated ? '#e0f2f1' : '#1D9E75'}; 
               color: ${ing.validated ? '#00695c' : 'white'};
               font-weight: 500;">
        ${ing.validated ? '✓ Validé' : 'Valider cet ingrédient'}
      </button>
    </div>
  `).join('');
}

function toggleValidateIngredient(id) {
  const ing = ingredients.find(i => i.id === id);
  if (ing) {
    ing.validated = !ing.validated;
    renderIngredients();
  }
}

function saveFabrication() {
  const nom   = document.getElementById('fab-nom').value.trim();
  const poids = document.getElementById('fab-poids').value;
  const date  = document.getElementById('fab-date').value;
  const type  = sessionStorage.getItem('new_type') || 'preparation';
  const errEl = document.getElementById('save-error');
  const session = getSession();

  if (!nom) { showError(errEl, 'Veuillez saisir un nom de préparation.'); return; }
  if (!poids) { showError(errEl, 'Veuillez saisir le poids final.'); return; }
  if (!date) { showError(errEl, 'Veuillez saisir une date.'); return; }

  const fab = {
    id: 'fab_' + Date.now(),
    type,
    nom,
    poids: parseFloat(poids).toFixed(1),
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
    return `
      <div class="ing-row">
        ${ing.photo ? `
          <div style="margin-bottom: 8px;">
            <img src="${ing.photo}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #eee;" />
          </div>
        ` : ''}
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
      <span class="type-badge ${fab.type === 'marinade' ? 'mar' : fab.type === 'farce' ? 'farce' : ''}">${typeLabel(fab.type)}</span>
      <div class="detail-name">${fab.nom}</div>
      <div class="info-grid">
        <div class="info-block">
          <span class="info-label">Date de fabrication</span>
          <span class="info-value">${formatDate(fab.date)}</span>
        </div>
        <div class="info-block">
          <span class="info-label">Poids final</span>
          <span class="info-value">${fab.poids} kg</span>
        </div>
        <div class="info-block" style="margin-top:8px;">
          <span class="info-label">Fabriqué par</span>
          <span class="info-value">${fab.auteur}</span>
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
    </div>

    ${fab.ingredients.length ? `
    <div class="card">
      <div class="card-title">Ingrédients &amp; traçabilité</div>
      ${ingsHtml}
    </div>` : ''}

    <div class="card">
      <div class="card-title">Photo</div>
      ${photoHtml}
    </div>
  `;
}

// ---- UTILITAIRES ----
function getFabrications() {
  try { return JSON.parse(localStorage.getItem(FABRICATIONS_KEY) || '[]'); } catch { return []; }
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
