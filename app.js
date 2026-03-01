// ===== AUTHENTIFICATION =====
const AUTH_KEY    = 'tabac_credentials';
const SESSION_KEY = 'tabac_session';
const COMPANY_KEY = 'tabac_company';
const COMPANY_LOGO_KEY = 'tabac_company_logo';
const SALT        = 'TabacPro@2026!#$';

// Hash SHA-256 via Web Crypto API
async function hashPwd(password) {
  const data   = new TextEncoder().encode(password + SALT);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// Initialisation : créer les identifiants par défaut si absents
async function initAuth() {
  if (!localStorage.getItem(AUTH_KEY)) {
    const defaultHash = await hashPwd('admin123');
    localStorage.setItem(AUTH_KEY, JSON.stringify({ username: 'admin', hash: defaultHash }));
  }
  // Vérifier session active
  if (sessionStorage.getItem(SESSION_KEY)) {
    hideLoginOverlay();
  } else {
    showLoginOverlay();
  }
}

function showLoginOverlay() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function hideLoginOverlay() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  refreshSidebarUser();
  refreshCompanyInfo();
}

async function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');
  const btnTxt   = document.getElementById('login-btn-text');

  btn.disabled = true;
  btnTxt.textContent = 'Connexion...';
  errEl.style.display = 'none';

  // Anti-brute-force : délai minimal
  await new Promise(r => setTimeout(r, 600));

  const creds    = JSON.parse(localStorage.getItem(AUTH_KEY));
  const inputHash = await hashPwd(password);

  if (username === creds.username && inputHash === creds.hash) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user: username,
      loginAt: new Date().toISOString()
    }));
    localStorage.setItem('tabac_last_login', new Date().toLocaleString('fr-FR'));
    hideLoginOverlay();
    addLog('connexion', 'Connexion réussie', `Utilisateur : ${username}`);
    initApp();
  } else {
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    document.getElementById('login-password').focus();
    btn.disabled = false;
    btnTxt.textContent = 'Se connecter';
  }
}

function doLogout() {
  if (!confirm('Voulez-vous vous déconnecter ?')) return;
  addLog('connexion', 'Déconnexion', `Utilisateur : ${currentUser()}`);
  sessionStorage.removeItem(SESSION_KEY);
  // Reset les champs de connexion
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  showLoginOverlay();
}

function togglePwdVis(btn) {
  const input = btn.previousElementSibling;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

function refreshSidebarUser() {
  const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  const creds   = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
  const name    = session.user || creds.username || 'admin';
  const nameEl  = document.getElementById('sidebar-username');
  const avatarEl= document.getElementById('sidebar-avatar');
  if (nameEl)   nameEl.textContent   = name;
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();
}

// ===== PARAMÈTRES =====
async function changePassword(e) {
  e.preventDefault();
  const oldPwd  = document.getElementById('param-old-pwd').value;
  const newPwd  = document.getElementById('param-new-pwd').value;
  const confPwd = document.getElementById('param-confirm-pwd').value;
  const msgEl   = document.getElementById('param-pwd-msg');

  const creds   = JSON.parse(localStorage.getItem(AUTH_KEY));
  const oldHash = await hashPwd(oldPwd);

  if (oldHash !== creds.hash) {
    msgEl.style.color = '#ef4444';
    msgEl.textContent = '❌ Mot de passe actuel incorrect.';
    return;
  }
  if (newPwd.length < 6) {
    msgEl.style.color = '#ef4444';
    msgEl.textContent = '❌ Le nouveau mot de passe doit contenir au moins 6 caractères.';
    return;
  }
  if (newPwd !== confPwd) {
    msgEl.style.color = '#ef4444';
    msgEl.textContent = '❌ Les mots de passe ne correspondent pas.';
    return;
  }

  creds.hash = await hashPwd(newPwd);
  localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
  addLog('parametres', 'Mot de passe modifié', `Utilisateur : ${currentUser()}`);
  msgEl.style.color = '#10b981';
  msgEl.textContent = '✓ Mot de passe mis à jour avec succès !';
  document.getElementById('param-old-pwd').value = '';
  document.getElementById('param-new-pwd').value = '';
  document.getElementById('param-confirm-pwd').value = '';
  setTimeout(() => { msgEl.textContent = ''; }, 4000);
}

function changeUsername(e) {
  e.preventDefault();
  const newName = document.getElementById('param-new-user').value.trim();
  if (!newName) return;
  const creds = JSON.parse(localStorage.getItem(AUTH_KEY));
  creds.username = newName;
  localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
  // Mettre à jour la session
  const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  session.user = newName;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  document.getElementById('param-new-user').value = '';
  refreshSidebarUser();
  loadParamPage();
  addLog('parametres', 'Nom d\'utilisateur modifié', `Nouveau nom : ${newName}`);
  showToast('Nom d\'utilisateur mis à jour !');
}

function saveCompanyInfo() {
  const info = {
    name:    document.getElementById('param-company').value.trim() || 'TabacPro',
    phone:   document.getElementById('param-phone').value.trim(),
    address: document.getElementById('param-address').value.trim(),
    email:   document.getElementById('param-email').value.trim(),
  };
  localStorage.setItem(COMPANY_KEY, JSON.stringify(info));
  addLog('parametres', 'Informations entreprise mises à jour', info.name);
  showToast('Informations entreprise sauvegardées !');
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image trop volumineuse (max 2 Mo)'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    localStorage.setItem(COMPANY_LOGO_KEY, e.target.result);
    displayLogoPreview(e.target.result);
    showToast('Logo enregistré !');
    addLog('parametres', 'Logo entreprise mis à jour', file.name);
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  if (!confirm('Supprimer le logo de l\'entreprise ?')) return;
  localStorage.removeItem(COMPANY_LOGO_KEY);
  displayLogoPreview(null);
  showToast('Logo supprimé.');
  addLog('parametres', 'Logo entreprise supprimé', '');
}

function displayLogoPreview(base64) {
  const img         = document.getElementById('logo-preview-img');
  const placeholder = document.getElementById('logo-placeholder');
  const removeBtn   = document.getElementById('logo-remove-btn');
  if (!img) return;
  if (base64) {
    img.src = base64;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (removeBtn)   removeBtn.style.display = '';
  } else {
    img.src = '';
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (removeBtn)   removeBtn.style.display = 'none';
    const fileInput = document.getElementById('logo-file-input');
    if (fileInput) fileInput.value = '';
  }
}

function refreshCompanyInfo() {
  const info = JSON.parse(localStorage.getItem(COMPANY_KEY) || '{}');
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val||''; };
  set('param-company', info.name);
  set('param-phone',   info.phone);
  set('param-address', info.address);
  set('param-email',   info.email);
  displayLogoPreview(localStorage.getItem(COMPANY_LOGO_KEY) || null);
}

function loadParamPage() {
  const creds   = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
  const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  const el = (id) => document.getElementById(id);
  if (el('param-current-user'))  el('param-current-user').value  = creds.username || '';
  if (el('param-logged-user'))   el('param-logged-user').textContent  = session.user || '—';
  if (el('param-last-login'))    el('param-last-login').textContent   = localStorage.getItem('tabac_last_login') || '—';
  refreshCompanyInfo();
}

function confirmResetData() {
  if (!confirm('⚠️ ATTENTION : Cela supprimera TOUTES les données (ventes, achats, factures, produits, stock).\n\nCette action est IRRÉVERSIBLE.\n\nContinuer ?')) return;
  const keys = ['tabac_sales','tabac_purchases','tabac_products','tabac_invoices','tabac_thresholds','tabac_company'];
  keys.forEach(k => localStorage.removeItem(k));
  showToast('Toutes les données ont été supprimées.');
  setTimeout(() => location.reload(), 1500);
}

// ===== JOURNAL D'ACTIVITÉ =====
const LOG_KEY = 'tabac_activity';
let activityLog = JSON.parse(localStorage.getItem(LOG_KEY)) || [];

function saveLog() {
  // Garder max 500 entrées
  if (activityLog.length > 500) activityLog = activityLog.slice(0, 500);
  localStorage.setItem(LOG_KEY, JSON.stringify(activityLog));
}

function currentUser() {
  const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  return s.user || 'système';
}

function addLog(type, action, details = '') {
  activityLog.unshift({
    id:      Date.now(),
    type,
    action,
    details,
    user:    currentUser(),
    ts:      new Date().toISOString(),
  });
  saveLog();
  // Si la page journal est active, rafraîchir
  if (document.getElementById('page-journal')?.classList.contains('active')) {
    renderJournal();
  }
}

// Config visuelle par type
const LOG_TYPES = {
  connexion:   { icon: '🔐', color: '#6b7280', label: 'Connexion'   },
  vente:       { icon: '💰', color: '#10b981', label: 'Vente'       },
  achat:       { icon: '🛒', color: '#f97316', label: 'Achat'       },
  facture:     { icon: '🧾', color: '#3b82f6', label: 'Facture'     },
  produit:     { icon: '📦', color: '#8b5cf6', label: 'Produit'     },
  suppression: { icon: '🗑️', color: '#ef4444', label: 'Suppression' },
  parametres:  { icon: '⚙️', color: '#f59e0b', label: 'Paramètres' },
};

function renderJournal() {
  const typeFilter   = document.getElementById('jrn-filter-type')?.value   || '';
  const dateFilter   = document.getElementById('jrn-filter-date')?.value   || '';
  const searchFilter = document.getElementById('jrn-filter-search')?.value.toLowerCase() || '';

  let filtered = activityLog.filter(e => {
    if (typeFilter   && e.type !== typeFilter) return false;
    if (dateFilter   && !e.ts.startsWith(dateFilter)) return false;
    if (searchFilter && !e.action.toLowerCase().includes(searchFilter)
                     && !e.details.toLowerCase().includes(searchFilter)
                     && !e.user.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  // Stats
  renderJournalStats();

  // Timeline
  const tl = document.getElementById('journal-timeline');
  if (!tl) return;

  if (filtered.length === 0) {
    tl.innerHTML = '<div class="jrn-empty">Aucune activité trouvée</div>';
    return;
  }

  let html = '';
  let lastDay = '';

  filtered.forEach((e, i) => {
    const day = e.ts.split('T')[0];
    if (day !== lastDay) {
      lastDay = day;
      html += `<div class="jrn-day-separator"><span class="jrn-day-label">${formatJrnDay(day)}</span></div>`;
    }

    const cfg  = LOG_TYPES[e.type] || { icon: '📌', color: '#888' };
    const time = new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    html += `
      <div class="jrn-entry" style="animation-delay:${Math.min(i,20)*0.03}s">
        <div class="jrn-dot jrn-dot-${e.type}">${cfg.icon}</div>
        <div class="jrn-body">
          <div class="jrn-action">${e.action}</div>
          ${e.details ? `<div class="jrn-details">${e.details}</div>` : ''}
        </div>
        <div class="jrn-meta">
          <div class="jrn-time">${time}</div>
          <div class="jrn-user">👤 ${e.user}</div>
        </div>
      </div>`;
  });

  tl.innerHTML = html;
}

function renderJournalStats() {
  const el = document.getElementById('journal-stats');
  if (!el) return;

  const today    = new Date().toISOString().split('T')[0];
  const todayLog = activityLog.filter(e => e.ts.startsWith(today));

  const counts = {};
  activityLog.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1; });

  const colors = { connexion:'#6b7280', vente:'#10b981', achat:'#f97316', facture:'#3b82f6', produit:'#8b5cf6', suppression:'#ef4444', parametres:'#f59e0b' };

  const stats = [
    { label: "Total événements", value: activityLog.length, color: '#1a1a2e' },
    { label: "Aujourd'hui",      value: todayLog.length,    color: '#3b82f6' },
    ...Object.entries(counts).map(([t, c]) => ({
      label: LOG_TYPES[t]?.label || t,
      value: c,
      color: colors[t] || '#888'
    }))
  ];

  el.innerHTML = stats.map(s => `
    <div class="jrn-stat" style="border-color:${s.color}">
      <div class="jrn-stat-label">${s.label}</div>
      <div class="jrn-stat-value" style="color:${s.color}">${s.value}</div>
    </div>`).join('');
}

function formatJrnDay(dateStr) {
  const today     = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today)     return "Aujourd'hui";
  if (dateStr === yesterday) return 'Hier';
  return formatDateFr(dateStr);
}

function clearJournal() {
  if (!confirm('Vider tout le journal d\'activité ? Cette action est irréversible.')) return;
  activityLog = [];
  saveLog();
  renderJournal();
  showToast('Journal vidé.');
}

function exportJournalPDF() {
  const doc  = pdfDoc();
  let y = pdfHeader(doc, 'Journal d\'activité', `${activityLog.length} entrée(s)`);

  const rows = activityLog.slice(0, 200).map(e => {
    const cfg  = LOG_TYPES[e.type] || {};
    const time = new Date(e.ts).toLocaleString('fr-FR');
    return [cfg.label || e.type, e.action, e.details || '-', e.user, time];
  });

  pdfTable(doc, ['Type','Action','Détails','Utilisateur','Date & heure'],
    rows, y, [24, 50, 48, 24, 36]);

  pdfFooter(doc);
  doc.save(`TabacPro_Journal_${new Date().toISOString().split('T')[0]}.pdf`);
  showToast('Journal exporté en PDF !');
}

// ===== DONNÉES =====
let sales     = JSON.parse(localStorage.getItem('tabac_sales'))     || [];
let products  = JSON.parse(localStorage.getItem('tabac_products'))  || [];
let purchases = JSON.parse(localStorage.getItem('tabac_purchases')) || [];
let thresholds= JSON.parse(localStorage.getItem('tabac_thresholds'))|| {}; // { productId: minQty }
let invoices  = JSON.parse(localStorage.getItem('tabac_invoices'))  || [];

// Produits par défaut
if (products.length === 0) {
  products = [
    { id: 1, name: 'Marlboro Rouge',    category: 'Cigarettes',      price: 1500, desc: 'Paquet 20 cigarettes' },
    { id: 2, name: 'Camel Filter',      category: 'Cigarettes',      price: 1400, desc: 'Paquet 20 cigarettes' },
    { id: 3, name: 'Winston Blue',      category: 'Cigarettes',      price: 1300, desc: 'Paquet 20 cigarettes' },
    { id: 4, name: 'Davidoff Cigare',   category: 'Cigares',         price: 3500, desc: 'Boîte 10 cigares'    },
    { id: 5, name: 'Tabac Drum',        category: 'Tabac à rouler',  price: 2000, desc: '50g'                 },
    { id: 6, name: 'Chicha Al Fakher',  category: 'Chicha',          price: 2500, desc: '250g'                },
  ];
  saveProducts();
}

let deleteTarget = null; // { type: 'sale'|'product'|'purchase', id }

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initAuth().then(() => {
    if (sessionStorage.getItem(SESSION_KEY)) initApp();
  });
});

// ===== POINT DE VENTE (POS) — MULTI-TERMINAL =====
const CAT_ICONS = {
  'Cigarettes':     '🚬',
  'Cigares':        '🍫',
  'Tabac à rouler': '🌿',
  'Chicha':         '💨',
  'Accessoires':    '🔧',
  'Autre':          '📦',
};
const POS_COLORS        = ['#3b82f6','#10b981','#f97316','#8b5cf6','#ef4444','#e8b04b','#14b8a6','#ec4899'];
const POS_TERMINALS_KEY = 'tabac_pos_terminals';

let posTerminals      = JSON.parse(localStorage.getItem(POS_TERMINALS_KEY)) || [];
let posActiveTerminal = null;
let posCart           = [];
let posActiveCat      = '';
let posPaymentMethod  = 'cash';
let posSearchTerm     = '';

// Caisse par défaut si aucune n'existe
if (posTerminals.length === 0) {
  posTerminals = [{
    id: 1, name: 'Caisse 1', location: 'Principal', cashier: 'Admin',
    taxRate: 0, footerMsg: 'Merci de votre visite !', color: '#3b82f6',
  }];
  localStorage.setItem(POS_TERMINALS_KEY, JSON.stringify(posTerminals));
}

function savePosTerminals() {
  localStorage.setItem(POS_TERMINALS_KEY, JSON.stringify(posTerminals));
}

// ---- Hub de sélection ----
function renderPosHub() {
  const grid = document.getElementById('pos-terminals-grid');
  if (!grid) return;
  grid.innerHTML = posTerminals.map(t => `
    <div class="pos-terminal-card" style="border-left-color:${t.color}">
      <div class="pos-terminal-card-top">
        <div class="pos-terminal-card-dot" style="background:${t.color}"></div>
        <div class="pos-terminal-card-name">${t.name}</div>
      </div>
      <div class="pos-terminal-card-meta">
        ${t.location ? `<span>📍 ${t.location}</span>` : ''}
        ${t.cashier  ? `<span>👤 ${t.cashier}</span>`  : ''}
      </div>
      <div>
        <span class="pos-terminal-card-tax">TVA : ${t.taxRate || 0} %</span>
      </div>
      <div class="pos-terminal-card-actions">
        <button class="pos-terminal-open-btn" style="background:${t.color}" onclick="enterPosTerminal(${t.id})">
          🖥️ Ouvrir la caisse
        </button>
        <button class="pos-terminal-edit-btn" onclick="openPosTerminalEditor(${t.id})" title="Paramètres">⚙️</button>
      </div>
    </div>`).join('');
}

function enterPosTerminal(id) {
  posActiveTerminal = posTerminals.find(t => t.id === id);
  if (!posActiveTerminal) return;
  posCart = [];

  // Mettre à jour le bandeau
  const bar = document.getElementById('pos-terminal-bar');
  if (bar) bar.style.background = posActiveTerminal.color;
  const setTxt = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
  setTxt('pos-terminal-bar-name',    posActiveTerminal.name);
  setTxt('pos-terminal-bar-loc',     posActiveTerminal.location || '');
  setTxt('pos-terminal-bar-cashier', posActiveTerminal.cashier  ? '👤 ' + posActiveTerminal.cashier : '');
  const sep2 = document.getElementById('pos-terminal-bar-sep2');
  if (sep2) sep2.style.display = posActiveTerminal.location && posActiveTerminal.cashier ? '' : 'none';

  // Couleur en-tête panier
  const cartHeader = document.getElementById('pos-cart-header');
  if (cartHeader) cartHeader.style.background = posActiveTerminal.color;

  // Bascule des vues
  document.getElementById('pos-hub').style.display = 'none';
  document.getElementById('pos-terminal-view').style.display = 'flex';

  // Titre page
  document.getElementById('page-title').textContent = `Point de vente — ${posActiveTerminal.name}`;

  renderPos();
}

function exitPosTerminal() {
  if (posCart.length > 0 && !confirm('Le panier contient des articles. Quitter quand même ?')) return;
  posActiveTerminal = null;
  posCart = [];
  document.getElementById('pos-terminal-view').style.display = 'none';
  document.getElementById('pos-hub').style.display = 'block';
  document.getElementById('page-title').textContent = 'Point de vente';
  renderPosHub();
}

// ---- Éditeur terminal ----
let posEditorColor = POS_COLORS[0];

function openPosTerminalEditor(id) {
  const isNew = !id;
  const t     = isNew ? null : posTerminals.find(x => x.id === id);

  document.getElementById('pos-editor-title').textContent = isNew ? '➕ Nouvelle caisse' : `⚙️ ${t.name}`;
  document.getElementById('pos-edit-id').value       = isNew ? '' : id;
  document.getElementById('pos-edit-name').value     = t?.name        || '';
  document.getElementById('pos-edit-location').value = t?.location    || '';
  document.getElementById('pos-edit-cashier').value  = t?.cashier     || '';
  document.getElementById('pos-edit-tax').value      = t?.taxRate     ?? 0;
  document.getElementById('pos-edit-footer').value   = t?.footerMsg   || 'Merci de votre visite !';

  posEditorColor = t?.color || POS_COLORS[0];
  renderColorSwatches();

  const delBtn = document.getElementById('pos-editor-delete-btn');
  if (delBtn) delBtn.style.display = isNew ? 'none' : 'inline-flex';

  document.getElementById('pos-editor-overlay').classList.add('open');
  document.getElementById('pos-editor-wrap').style.display = 'block';
  setTimeout(() => document.getElementById('pos-edit-name')?.focus(), 60);
}

function renderColorSwatches() {
  const wrap = document.getElementById('pos-color-swatches');
  if (!wrap) return;
  wrap.innerHTML = POS_COLORS.map(c => `
    <div class="pos-color-swatch${c === posEditorColor ? ' selected' : ''}"
         style="background:${c}" onclick="selectPosColor('${c}')" title="${c}"></div>`).join('');
}

function selectPosColor(color) {
  posEditorColor = color;
  renderColorSwatches();
}

function closePosEditor() {
  document.getElementById('pos-editor-overlay').classList.remove('open');
  document.getElementById('pos-editor-wrap').style.display = 'none';
}

function savePosTerminal(e) {
  e.preventDefault();
  const id       = document.getElementById('pos-edit-id').value;
  const name     = document.getElementById('pos-edit-name').value.trim();
  const location = document.getElementById('pos-edit-location').value.trim();
  const cashier  = document.getElementById('pos-edit-cashier').value.trim();
  const taxRate  = parseFloat(document.getElementById('pos-edit-tax').value) || 0;
  const footerMsg= document.getElementById('pos-edit-footer').value.trim() || 'Merci de votre visite !';

  if (!name) return;

  if (id) {
    const t = posTerminals.find(x => x.id == id);
    if (t) { Object.assign(t, { name, location, cashier, taxRate, footerMsg, color: posEditorColor }); }
  } else {
    posTerminals.push({ id: Date.now(), name, location, cashier, taxRate, footerMsg, color: posEditorColor });
  }

  savePosTerminals();
  closePosEditor();
  renderPosHub();
  addLog('parametres', id ? 'Caisse modifiée' : 'Nouvelle caisse créée', name);
  showToast(id ? `Caisse "${name}" mise à jour !` : `Caisse "${name}" créée !`);
}

function deletePosTerminal() {
  const id = document.getElementById('pos-edit-id').value;
  if (!id) return;
  const t = posTerminals.find(x => x.id == id);
  if (!t) return;
  if (posTerminals.length <= 1) { showToast('Impossible de supprimer la dernière caisse.'); return; }
  if (!confirm(`Supprimer la caisse "${t.name}" ?`)) return;
  posTerminals = posTerminals.filter(x => x.id != id);
  savePosTerminals();
  closePosEditor();
  renderPosHub();
  addLog('suppression', 'Caisse supprimée', t.name);
  showToast(`Caisse "${t.name}" supprimée.`);
}

function renderPos() {
  if (!posActiveTerminal) { renderPosHub(); return; }
  renderPosGrid();
  renderPosCart();
}

function renderPosGrid() {
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;

  let list = products;
  if (posActiveCat)  list = list.filter(p => p.category === posActiveCat);
  if (posSearchTerm) list = list.filter(p => p.name.toLowerCase().includes(posSearchTerm));

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#9ca3af;padding:40px 0;font-size:14px">Aucun produit trouvé</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const stock   = getStock(p.id);
    const icon    = CAT_ICONS[p.category] || '📦';
    const outOfStock = stock <= 0;
    const thresh  = thresholds[p.id] || 0;
    let stockCls, stockLbl;
    if (stock <= 0)              { stockCls = 'pos-stock-out'; stockLbl = 'Rupture'; }
    else if (thresh && stock <= thresh) { stockCls = 'pos-stock-low'; stockLbl = `${stock} restant`; }
    else                         { stockCls = 'pos-stock-ok';  stockLbl = `${stock} en stock`; }

    return `
      <div class="pos-product-card${outOfStock ? ' out-of-stock' : ''}"
           onclick="${outOfStock ? '' : `posAddToCart(${p.id})`}"
           title="${p.name}${outOfStock ? ' — Rupture de stock' : ''}">
        <div class="pos-card-icon">${icon}</div>
        <div class="pos-card-name">${p.name}</div>
        <div class="pos-card-price">${formatNumber(p.price)} DJF</div>
        <div class="pos-card-stock ${stockCls}">${stockLbl}</div>
      </div>`;
  }).join('');
}

function posFilterCategory(cat) {
  posActiveCat = cat;
  document.querySelectorAll('.pos-pill').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().replace(/^[^\s]+\s/, '') === cat || (cat === '' && btn.textContent.trim() === 'Tous'));
  });
  renderPosGrid();
}

function posSearchProducts() {
  posSearchTerm = (document.getElementById('pos-search')?.value || '').toLowerCase().trim();
  renderPosGrid();
}

function posAddToCart(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) return;

  const stock = getStock(productId);
  const existing = posCart.find(i => i.productId == productId);

  if (existing) {
    if (existing.qty >= stock) {
      showToast(`Stock maximum atteint (${stock} unité(s))`);
      return;
    }
    existing.qty++;
  } else {
    if (stock <= 0) return;
    posCart.push({ productId: product.id, productName: product.name, price: product.price, qty: 1 });
  }
  renderPosCart();
}

function posUpdateQty(productId, delta) {
  const item = posCart.find(i => i.productId == productId);
  if (!item) return;

  if (delta > 0) {
    const stock = getStock(productId);
    if (item.qty >= stock) { showToast(`Stock maximum atteint (${stock} unité(s))`); return; }
  }

  item.qty += delta;
  if (item.qty <= 0) posCart = posCart.filter(i => i.productId != productId);
  renderPosCart();
}

function posRemoveFromCart(productId) {
  posCart = posCart.filter(i => i.productId != productId);
  renderPosCart();
}

function renderPosCart() {
  const itemsEl  = document.getElementById('pos-cart-items');
  const totalsEl = document.getElementById('pos-totals');
  const clientEl = document.getElementById('pos-client-wrap');
  const badgeEl  = document.getElementById('pos-cart-badge');
  const checkBtn = document.getElementById('pos-checkout-btn');
  if (!itemsEl) return;

  const taxRate  = posActiveTerminal?.taxRate || 0;
  const totalQty = posCart.reduce((s, i) => s + i.qty, 0);
  const subtotal = posCart.reduce((s, i) => s + i.qty * i.price, 0);
  const tvaAmt   = subtotal * taxRate / 100;
  const total    = subtotal + tvaAmt;

  if (badgeEl) badgeEl.textContent = totalQty === 0 ? '0 article' : `${totalQty} article${totalQty > 1 ? 's' : ''}`;

  if (posCart.length === 0) {
    itemsEl.innerHTML = `<div class="pos-cart-empty">Le panier est vide.<br/>Cliquez sur un produit pour l'ajouter.</div>`;
    if (totalsEl) totalsEl.style.display = 'none';
    if (clientEl) clientEl.style.display = 'none';
    if (checkBtn) checkBtn.disabled = true;
    return;
  }

  itemsEl.innerHTML = posCart.map(i => `
    <div class="pos-cart-item">
      <div class="pos-item-info">
        <div class="pos-item-name">${i.productName}</div>
        <div class="pos-item-unit">${formatNumber(i.price)} DJF / unité</div>
      </div>
      <div class="pos-qty-controls">
        <button class="pos-qty-btn" onclick="posUpdateQty(${i.productId}, -1)">−</button>
        <span class="pos-qty-num">${i.qty}</span>
        <button class="pos-qty-btn" onclick="posUpdateQty(${i.productId}, 1)">+</button>
      </div>
      <div class="pos-item-total">${formatNumber(i.qty * i.price)} DJF</div>
      <button class="pos-item-remove" onclick="posRemoveFromCart(${i.productId})" title="Retirer">✕</button>
    </div>`).join('');

  if (totalsEl) {
    totalsEl.style.display = 'block';
    document.getElementById('pos-subtotal').textContent = formatNumber(subtotal) + ' DJF';
    // Ligne TVA
    const tvaRow = document.getElementById('pos-tva-row');
    if (tvaRow) {
      tvaRow.style.display = taxRate > 0 ? 'flex' : 'none';
      if (taxRate > 0) {
        document.getElementById('pos-tva-label').textContent  = `TVA (${taxRate}%)`;
        document.getElementById('pos-tva-amount').textContent = formatNumber(tvaAmt) + ' DJF';
      }
    }
    document.getElementById('pos-total').textContent = formatNumber(total) + ' DJF';
  }
  if (clientEl) clientEl.style.display = 'block';
  if (checkBtn) checkBtn.disabled = false;
}

function posClearCart() {
  if (posCart.length === 0) return;
  if (!confirm('Vider le panier ?')) return;
  posCart = [];
  renderPosCart();
}

function posSelectPayment(method) {
  posPaymentMethod = method;
  ['cash','cacpay','waafi'].forEach(m => {
    const btn = document.getElementById(`pm-${m}`);
    if (btn) btn.classList.toggle('active', m === method);
  });
  const cashSection = document.getElementById('pos-cash-section');
  const mobileWrap  = document.getElementById('pos-mobile-pay-wrap');
  const validateBtn = document.getElementById('pos-validate-btn');
  const mobileInfo  = document.getElementById('pos-mobile-info');
  if (method === 'cash') {
    if (cashSection) cashSection.style.display = '';
    if (mobileWrap)  mobileWrap.style.display  = 'none';
    if (validateBtn) validateBtn.disabled = true;
    document.getElementById('pos-received').value = '';
    document.getElementById('pos-change-display').style.display = 'none';
  } else {
    if (cashSection) cashSection.style.display = 'none';
    if (mobileWrap)  mobileWrap.style.display  = '';
    if (validateBtn) validateBtn.disabled = false;
    if (mobileInfo)  mobileInfo.textContent = method === 'cacpay' ? '📱 Cac Pay — montant exact débité' : '📲 Waafi — montant exact débité';
    const refInput = document.getElementById('pos-mobile-ref');
    if (refInput) refInput.value = '';
  }
}

function posCheckout() {
  if (posCart.length === 0) return;
  const taxRate = posActiveTerminal?.taxRate || 0;
  const subtotal = posCart.reduce((s, i) => s + i.qty * i.price, 0);
  const total    = subtotal + subtotal * taxRate / 100;
  document.getElementById('pos-pay-total').textContent = formatNumber(total) + ' DJF';
  document.getElementById('pos-received').value = '';
  const changeEl = document.getElementById('pos-change-display');
  if (changeEl) changeEl.style.display = 'none';
  const validateBtn = document.getElementById('pos-validate-btn');
  if (validateBtn) validateBtn.disabled = true;
  posPaymentMethod = 'cash';
  posSelectPayment('cash');
  document.getElementById('pos-payment-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('pos-received')?.focus(), 80);
}

function posUpdateChange() {
  const taxRate  = posActiveTerminal?.taxRate || 0;
  const subtotal = posCart.reduce((s, i) => s + i.qty * i.price, 0);
  const total    = subtotal + subtotal * taxRate / 100;
  const received = parseFloat(document.getElementById('pos-received').value) || 0;
  const change   = received - total;
  const changeEl = document.getElementById('pos-change-display');
  const changeVal= document.getElementById('pos-change-value');
  const validateBtn = document.getElementById('pos-validate-btn');

  if (received > 0) {
    changeEl.style.display = 'flex';
    changeEl.className = `pos-change-display ${change >= 0 ? 'pos-change-positive' : 'pos-change-negative'}`;
    changeVal.textContent = formatNumber(Math.abs(change)) + ' DJF' + (change < 0 ? ' manquant' : '');
    if (validateBtn) validateBtn.disabled = change < 0;
  } else {
    changeEl.style.display = 'none';
    if (validateBtn) validateBtn.disabled = true;
  }
}

function posQuickAmount(amount) {
  const total    = posCart.reduce((s, i) => s + i.qty * i.price, 0);
  const input    = document.getElementById('pos-received');
  input.value    = amount === 0 ? total : (parseFloat(input.value) || 0) + amount;
  posUpdateChange();
}

function posCompleteSale() {
  const taxRate  = posActiveTerminal?.taxRate || 0;
  const subtotal = posCart.reduce((s, i) => s + i.qty * i.price, 0);
  const tvaAmt   = subtotal * taxRate / 100;
  const total    = subtotal + tvaAmt;

  let received, change, paymentRef = '';
  if (posPaymentMethod === 'cash') {
    received = parseFloat(document.getElementById('pos-received').value) || 0;
    if (received < total) return;
    change = received - total;
  } else {
    received = total;
    change   = 0;
    paymentRef = document.getElementById('pos-mobile-ref')?.value.trim() || '';
  }

  const paymentLabel = posPaymentMethod === 'cash' ? 'Cash' : posPaymentMethod === 'cacpay' ? 'Cac Pay' : 'Waafi';
  const now    = new Date();
  const today  = now.toISOString().split('T')[0];
  const client = document.getElementById('pos-client')?.value.trim() || '';

  // Numéro de reçu par terminal
  const counterKey = `tabac_receipt_counter_${posActiveTerminal?.id || 0}`;
  const rcpCount   = (parseInt(localStorage.getItem(counterKey) || '0')) + 1;
  localStorage.setItem(counterKey, rcpCount);
  const prefix    = (posActiveTerminal?.name || 'POS').substring(0, 3).toUpperCase().replace(/\s/g,'');
  const rcpNumber = `${prefix}-${now.getFullYear()}-${String(rcpCount).padStart(4, '0')}`;

  const cartSnapshot = posCart.map(i => ({ ...i }));

  cartSnapshot.forEach(item => {
    const sale = {
      id:            Date.now() + Math.random(),
      productId:     item.productId,
      productName:   item.productName,
      qty:           item.qty,
      price:         item.price,
      total:         item.qty * item.price,
      client,
      date:          today,
      note:          `Vente POS — ${rcpNumber} — ${paymentLabel}`,
      terminalId:    posActiveTerminal?.id   || 0,
      terminalName:  posActiveTerminal?.name || 'POS',
      cashier:       posActiveTerminal?.cashier || '',
      paymentMethod: posPaymentMethod,
      paymentRef,
    };
    sales.unshift(sale);
    addLog('vente', `Vente POS [${posActiveTerminal?.name}]`,
      `${item.productName} × ${item.qty} = ${formatNumber(sale.total)} DJF${client ? ' · ' + client : ''} — ${paymentLabel}`);
  });

  saveSales();
  posCart = [];
  if (document.getElementById('pos-client')) document.getElementById('pos-client').value = '';
  closePosModal();
  renderPosCart();
  renderPosGrid();
  refreshAll();
  checkStockAlerts();

  showPosReceipt({ items: cartSnapshot, subtotal, tvaAmt, taxRate, total, received, change, client, rcpNumber, date: now, terminal: posActiveTerminal, paymentMethod: posPaymentMethod, paymentRef });
}

function closePosModal() {
  document.getElementById('pos-payment-modal').style.display = 'none';
}

// ===== REÇU POS =====
function showPosReceipt({ items, subtotal, tvaAmt, taxRate, total, received, change, client, rcpNumber, date, terminal, paymentMethod = 'cash', paymentRef = '' }) {
  const company = JSON.parse(localStorage.getItem(COMPANY_KEY) || '{}');
  const cName   = company.name    || 'TabacPro';
  const phone   = company.phone   || '';
  const address = company.address || '';
  const email   = company.email   || '';

  const dateStr  = date.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr  = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const footer   = terminal?.footerMsg || 'Merci de votre visite !';
  const cashier  = terminal?.cashier   || '';
  const tName    = terminal?.name      || '';
  const tLoc     = terminal?.location  || '';

  const itemsHtml = items.map(i => `
    <div class="rcp-item">
      <div class="rcp-item-name">${i.productName}</div>
      <div class="rcp-item-total">${formatNumber(i.qty * i.price)} DJF</div>
    </div>
    <div class="rcp-item-detail">${i.qty} × ${formatNumber(i.price)} DJF</div>
  `).join('');

  const companyLogo = localStorage.getItem(COMPANY_LOGO_KEY);
  const logoHtml = companyLogo
    ? `<img src="${companyLogo}" alt="Logo" class="rcp-logo-img"/>`
    : `<div class="rcp-logo">🚬</div>`;

  const html = `
    <div class="rcp-header">
      ${logoHtml}
      <div class="rcp-company-name">${cName.toUpperCase()}</div>
      ${tName    ? `<div class="rcp-company-sub">${tName}${tLoc ? ' — ' + tLoc : ''}</div>` : '<div class="rcp-company-sub">Point de Vente</div>'}
      ${address  ? `<div class="rcp-company-info">${address}</div>` : ''}
      ${phone    ? `<div class="rcp-company-info">Tél : ${phone}</div>` : ''}
      ${email    ? `<div class="rcp-company-info">${email}</div>` : ''}
    </div>

    <hr class="rcp-divider-solid"/>

    <div class="rcp-num">Reçu N° ${rcpNumber}</div>
    <div class="rcp-meta">Date : ${dateStr} — ${timeStr}</div>
    ${cashier  ? `<div class="rcp-meta">Caissier : ${cashier}</div>` : ''}
    ${client   ? `<div class="rcp-meta">Client : ${client}</div>` : ''}

    <hr class="rcp-divider"/>

    <div class="rcp-items">${itemsHtml}</div>

    <hr class="rcp-divider"/>

    <div class="rcp-totals">
      <div class="rcp-total-row">
        <span>Sous-total</span>
        <span>${formatNumber(subtotal)} DJF</span>
      </div>
      ${taxRate > 0 ? `
      <div class="rcp-total-row">
        <span>TVA (${taxRate}%)</span>
        <span>${formatNumber(tvaAmt)} DJF</span>
      </div>` : ''}
      <div class="rcp-total-row grand">
        <span>TOTAL</span>
        <span>${formatNumber(total)} DJF</span>
      </div>
    </div>

    <hr class="rcp-divider-solid"/>

    <div class="rcp-payment">
      <div class="rcp-total-row">
        <span>Mode de paiement</span>
        <span>${paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'cacpay' ? '📱 Cac Pay' : '📲 Waafi'}</span>
      </div>
      ${paymentMethod === 'cash' ? `
      <div class="rcp-total-row">
        <span>Reçu</span>
        <span>${formatNumber(received)} DJF</span>
      </div>
      <div class="rcp-total-row rcp-change">
        <span>Monnaie rendue</span>
        <span>${formatNumber(change)} DJF</span>
      </div>` : ''}
      ${paymentRef ? `<div class="rcp-total-row"><span>Réf.</span><span>${paymentRef}</span></div>` : ''}
    </div>

    <hr class="rcp-divider"/>

    <div class="rcp-thanks">${footer}</div>
    <div class="rcp-footer">
      <strong>${cName}</strong><br/>
      ${address ? address + '<br/>' : ''}
      ${phone ? 'Tél : ' + phone : ''}
    </div>
  `;

  document.getElementById('pos-receipt-content').innerHTML = html;
  document.getElementById('pos-receipt-wrap').style.display = 'flex';
  document.getElementById('pos-receipt-overlay').classList.add('open');
}

function printPosReceipt() {
  document.body.classList.add('printing-receipt');
  window.print();
  document.body.classList.remove('printing-receipt');
}

function closePosReceipt() {
  document.getElementById('pos-receipt-wrap').style.display = 'none';
  document.getElementById('pos-receipt-overlay').classList.remove('open');
  showToast('Vente encaissée avec succès !');
}

// ===== NOTIFICATIONS STOCK EN TEMPS RÉEL =====
const NOTIF_READ_KEY    = 'tabac_notif_read';
const NOTIF_PREV_KEY    = 'tabac_prev_alert_ids';

let notifPanelOpen = false;
let notifReadSet   = new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]'));

function getStockAlerts() {
  return products.map(p => {
    const stock  = getStock(p.id);
    const thresh = thresholds[p.id] || 0;
    if (stock <= 0)                    return { p, stock, thresh, level: 'out' };
    if (thresh > 0 && stock <= thresh) return { p, stock, thresh, level: 'low' };
    return null;
  }).filter(Boolean);
}

function updateNotifBadge() {
  const alerts = getStockAlerts();
  const unread  = alerts.filter(a => !notifReadSet.has(String(a.p.id)));
  const badge   = document.getElementById('notif-badge');
  const btn     = document.getElementById('notif-bell-btn');
  if (!badge || !btn) return;
  if (unread.length > 0) {
    badge.textContent = unread.length > 99 ? '99+' : unread.length;
    badge.style.display = 'flex';
    btn.classList.add('has-alerts');
  } else {
    badge.style.display = 'none';
    btn.classList.remove('has-alerts');
  }
}

function renderNotifPanel() {
  const body = document.getElementById('notif-panel-body');
  if (!body) return;
  const alerts = getStockAlerts();
  if (alerts.length === 0) {
    body.innerHTML = `<div class="notif-empty"><div style="font-size:36px;margin-bottom:8px">✅</div>Tous les stocks sont suffisants</div>`;
    return;
  }
  body.innerHTML = alerts.map(a => {
    const unread = !notifReadSet.has(String(a.p.id));
    const icon   = a.level === 'out' ? '🔴' : '🟠';
    const label  = a.level === 'out'
      ? `Rupture totale — 0 unité restante`
      : `Stock bas : ${a.stock} restant${a.thresh ? ` (seuil : ${a.thresh})` : ''}`;
    return `
      <div class="notif-item notif-level-${a.level}${unread ? ' notif-unread' : ''}">
        <div class="notif-icon">${icon}</div>
        <div class="notif-content">
          <div class="notif-title">${a.p.name}</div>
          <div class="notif-desc">${label}</div>
        </div>
      </div>`;
  }).join('');
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;
  notifPanelOpen = !notifPanelOpen;
  panel.classList.toggle('open', notifPanelOpen);
  if (notifPanelOpen) renderNotifPanel();
}

function markAlertsRead() {
  getStockAlerts().forEach(a => notifReadSet.add(String(a.p.id)));
  localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...notifReadSet]));
  updateNotifBadge();
  renderNotifPanel();
}

function checkStockAlerts() {
  const alerts     = getStockAlerts();
  const currentIds = new Set(alerts.map(a => String(a.p.id)));
  const prevIds    = new Set(JSON.parse(localStorage.getItem(NOTIF_PREV_KEY) || '[]'));

  // Detect new alerts (products that just entered alert state)
  alerts.forEach((a, i) => {
    const id = String(a.p.id);
    if (!prevIds.has(id)) {
      // Mark as unread in badge
      notifReadSet.delete(id);
      // Show toast with stagger
      setTimeout(() => showStockToast(a), i * 600);
    }
  });

  localStorage.setItem(NOTIF_PREV_KEY, JSON.stringify([...currentIds]));
  localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...notifReadSet]));
  updateNotifBadge();
  if (notifPanelOpen) renderNotifPanel();
}

function showStockToast(alert) {
  const color  = alert.level === 'out' ? '#ef4444' : '#f97316';
  const icon   = alert.level === 'out' ? '🔴' : '🟠';
  const title  = alert.level === 'out' ? 'Rupture de stock !' : 'Stock bas !';
  const detail = alert.level === 'out'
    ? `${alert.p.name} — plus aucune unité disponible`
    : `${alert.p.name} — seulement ${alert.stock} restant(s)`;

  // Stack existing toasts
  const existing = document.querySelectorAll('.stock-notif-toast');
  const topOffset = 24 + existing.length * 86;

  const toast = document.createElement('div');
  toast.className = 'stock-notif-toast';
  toast.style.cssText = `
    position:fixed; top:${topOffset}px; right:24px; z-index:99999;
    background:white; color:#1a1a2e;
    padding:14px 16px 14px 14px; border-radius:12px;
    box-shadow:0 8px 36px rgba(0,0,0,0.18);
    border-left:4px solid ${color};
    font-size:13px; font-weight:600;
    display:flex; align-items:flex-start; gap:10px;
    max-width:320px; min-width:260px;
    animation:notifSlideIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
    cursor:pointer;
  `;
  toast.innerHTML = `
    <span style="font-size:22px;margin-top:1px">${icon}</span>
    <div style="flex:1">
      <div style="font-size:10px;color:${color};font-weight:700;letter-spacing:.5px;margin-bottom:3px">ALERTE STOCK</div>
      <div style="font-weight:700;margin-bottom:2px">${title}</div>
      <div style="font-size:11px;color:#6b7280;font-weight:500">${detail}</div>
    </div>
    <button onclick="event.stopPropagation();this.parentElement.remove()" style="background:none;border:none;font-size:15px;color:#9ca3af;cursor:pointer;padding:0 2px;margin-top:-2px">✕</button>
  `;
  toast.addEventListener('click', () => {
    toast.remove();
    showPage('stock');
  });

  document.body.appendChild(toast);

  // Auto-dismiss after 7 seconds
  setTimeout(() => {
    if (!document.body.contains(toast)) return;
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(24px)';
    setTimeout(() => toast.remove(), 400);
  }, 7000);
}

function startStockMonitor() {
  // Close panel on outside click
  document.addEventListener('click', e => {
    if (notifPanelOpen && !e.target.closest('#notif-bell-wrap')) {
      notifPanelOpen = false;
      document.getElementById('notif-panel')?.classList.remove('open');
    }
  });
  // Initial check after data is loaded, then every 30s
  setTimeout(checkStockAlerts, 500);
  setInterval(checkStockAlerts, 30000);
}

function initApp() {
  setTodayDate();
  refreshAll();
  setTimeout(renderDashboard, 80);
  startStockMonitor();
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sale-date').value    = today;
  document.getElementById('ach-date').value     = today;
  document.getElementById('inv-date').value     = today;
  document.getElementById('page-date').textContent = formatDateFr(today);
}

// ===== NAVIGATION =====
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');

  const titles = {
    dashboard:  'Tableau de bord',
    ventes:     'Gestion des ventes',
    produits:   'Produits',
    achats:     'Gestion des achats',
    stock:      'Gestion du stock',
    factures:   'Facturation',
    journal:    'Journal d\'activité',
    pos:        'Point de vente',
    rapports:   'Rapports',
    parametres: 'Paramètres'
  };
  document.getElementById('page-title').textContent = titles[name];

  const links = document.querySelectorAll('.nav-link');
  links.forEach(l => {
    if (l.getAttribute('onclick').includes(name)) l.classList.add('active');
  });

  refreshAll();
  if (name === 'dashboard')  setTimeout(renderDashboard, 60);
  if (name === 'rapports')   setTimeout(renderReport,    60);
  if (name === 'parametres') loadParamPage();
  if (name === 'journal')    renderJournal();
  if (name === 'pos') {
    if (posActiveTerminal) renderPos();
    else { renderPosHub(); }
  }
}

// ===== SAVE =====
function saveSales()      { localStorage.setItem('tabac_sales',      JSON.stringify(sales));      }
function saveProducts()   { localStorage.setItem('tabac_products',   JSON.stringify(products));   }
function savePurchases()  { localStorage.setItem('tabac_purchases',  JSON.stringify(purchases));  }
function saveThresholds() { localStorage.setItem('tabac_thresholds', JSON.stringify(thresholds)); }
function saveInvoices()   { localStorage.setItem('tabac_invoices',   JSON.stringify(invoices));   }

// ===== REFRESH ALL =====
function refreshAll() {
  renderProductSelect();
  renderProductsTable();
  renderSalesTable();
  renderRecentSales();
  renderPurchasesTable();
  renderStockTable();
  renderInvoicesTable();
  updateStats();
}

// ===== PRODUITS =====
function addProduct(e) {
  e.preventDefault();
  const name       = document.getElementById('prod-name').value.trim();
  const category   = document.getElementById('prod-category').value;
  const price      = parseFloat(document.getElementById('prod-price').value) || 0;
  const desc       = document.getElementById('prod-desc').value.trim();
  const initialQty = parseInt(document.getElementById('prod-initial-qty').value) || 0;
  const buyPrice   = parseFloat(document.getElementById('prod-initial-price').value) || price;

  if (!name) return;

  const id = Date.now();
  products.push({ id, name, category, price, desc });
  saveProducts();
  addLog('produit', 'Produit ajouté', `${name} (${category}) — ${formatNumber(price)} DJF`);

  // Créer un achat initial si une quantité est renseignée
  if (initialQty > 0) {
    const today = new Date().toISOString().split('T')[0];
    const purchase = {
      id:          Date.now() + 1,
      productId:   id,
      productName: name,
      supplier:    'Stock initial',
      qty:         initialQty,
      price:       buyPrice,
      total:       initialQty * buyPrice,
      date:        today,
      note:        'Stock initial à la création du produit',
    };
    purchases.unshift(purchase);
    savePurchases();
    addLog('achat', 'Stock initial enregistré', `${name} × ${initialQty} unités`);
  }

  document.getElementById('product-form').reset();
  renderProductSelect();
  renderProductsTable();
  renderStockTable();
  updateStats();
  checkStockAlerts();
  showToast(initialQty > 0
    ? `Produit ajouté avec ${initialQty} unité(s) en stock !`
    : 'Produit ajouté avec succès !');
}

function deleteProduct(id) {
  deleteTarget = { type: 'product', id };
  document.getElementById('modal').style.display = 'flex';
}

function renderProductSelect() {
  ['sale-product', 'ach-product'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- Choisir un produit --</option>';
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.category})`;
      sel.appendChild(opt);
    });
    sel.value = cur;
  });
}

function renderProductsTable() {
  const tbody = document.getElementById('products-table');
  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Aucun produit enregistré</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const stock = getStock(p.id);
    return `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge ${badgeClass(p.category)}">${p.category}</span></td>
      <td>${formatNumber(p.price)} DJF</td>
      <td>${p.desc || '-'}</td>
      <td><strong>${stock}</strong> unités</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">Supprimer</button>
      </td>
    </tr>`;
  }).join('');
}

function badgeClass(cat) {
  const map = {
    'Cigarettes': 'badge-cig',
    'Cigares':    'badge-cig2',
    'Tabac à rouler': 'badge-tab',
    'Chicha':     'badge-acc',
  };
  return map[cat] || 'badge-def';
}

// ===== ACHATS =====
document.addEventListener('DOMContentLoaded', () => {
  const achQty   = document.getElementById('ach-qty');
  const achPrice = document.getElementById('ach-price');
  const achProd  = document.getElementById('ach-product');

  function updateAchPreview() {
    const qty   = parseFloat(achQty.value)   || 0;
    const price = parseFloat(achPrice.value) || 0;
    document.getElementById('ach-total-preview').textContent = formatNumber(qty * price) + ' DJF';
  }

  achQty.addEventListener('input', updateAchPreview);
  achPrice.addEventListener('input', updateAchPreview);
  achProd.addEventListener('change', updateAchPreview);
});

function addPurchase(e) {
  e.preventDefault();
  const productId = document.getElementById('ach-product').value;
  const product   = products.find(p => p.id == productId);
  const supplier  = document.getElementById('ach-supplier').value.trim();
  const qty       = parseFloat(document.getElementById('ach-qty').value);
  const price     = parseFloat(document.getElementById('ach-price').value);
  const date      = document.getElementById('ach-date').value;
  const note      = document.getElementById('ach-note').value.trim();

  if (!productId || !qty || !price || !date) return;

  const purchase = {
    id: Date.now(),
    productId,
    productName: product ? product.name : 'Produit inconnu',
    supplier,
    qty,
    price,
    total: qty * price,
    date,
    note,
  };

  purchases.unshift(purchase);
  savePurchases();
  addLog('achat', 'Achat enregistré', `${purchase.productName} × ${qty} = ${formatNumber(purchase.total)} DJF${supplier ? ' · Fournisseur : ' + supplier : ''}`);

  document.getElementById('purchase-form').reset();
  document.getElementById('ach-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('ach-total-preview').textContent = '0 DJF';

  renderPurchasesTable();
  renderStockTable();
  updateStats();
  checkStockAlerts();
  showToast('Achat enregistré avec succès !');
}

function deletePurchase(id) {
  deleteTarget = { type: 'purchase', id };
  document.getElementById('modal').style.display = 'flex';
}

function renderPurchasesTable(filtered) {
  const data  = filtered !== undefined ? filtered : purchases;
  const tbody = document.getElementById('purchases-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Aucun achat enregistré</td></tr>';
    document.getElementById('ach-filtered-total').textContent = '0 DJF';
    return;
  }

  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${formatDateFr(p.date)}</td>
      <td><strong>${p.productName}</strong></td>
      <td>${p.supplier || '-'}</td>
      <td>${p.qty}</td>
      <td>${formatNumber(p.price)} DJF</td>
      <td><strong>${formatNumber(p.total)} DJF</strong></td>
      <td>${p.note || '-'}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deletePurchase(${p.id})">✕</button>
      </td>
    </tr>
  `).join('');

  const total = data.reduce((sum, p) => sum + p.total, 0);
  document.getElementById('ach-filtered-total').textContent = formatNumber(total) + ' DJF';
}

function filterPurchases() {
  const month  = document.getElementById('ach-filter-month').value;
  const search = document.getElementById('ach-filter-search').value.toLowerCase();

  let filtered = purchases;
  if (month)  filtered = filtered.filter(p => p.date.startsWith(month));
  if (search) filtered = filtered.filter(p =>
    p.productName.toLowerCase().includes(search) ||
    (p.supplier && p.supplier.toLowerCase().includes(search))
  );
  renderPurchasesTable(filtered);
}

// ===== STOCK =====
function getStock(productId) {
  const bought = purchases
    .filter(p => p.productId == productId)
    .reduce((sum, p) => sum + p.qty, 0);
  const sold = sales
    .filter(s => s.productId == productId)
    .reduce((sum, s) => sum + s.qty, 0);
  return bought - sold;
}

function renderStockTable(filteredProducts) {
  const data  = filteredProducts !== undefined ? filteredProducts : products;
  const tbody = document.getElementById('stock-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty">Aucun produit enregistré</td></tr>';
    renderStockSummary();
    return;
  }

  tbody.innerHTML = data.map(p => {
    const bought    = purchases.filter(a => a.productId == p.id).reduce((s, a) => s + a.qty, 0);
    const sold      = sales.filter(s => s.productId == p.id).reduce((s, a) => s + a.qty, 0);
    const stock     = bought - sold;
    const threshold = thresholds[p.id] || 0;
    const valeur    = stock > 0 ? stock * p.price : 0;

    let statusClass, statusLabel;
    if (stock <= 0)               { statusClass = 'badge-out'; statusLabel = 'Rupture';   }
    else if (stock <= threshold)  { statusClass = 'badge-low'; statusLabel = 'Stock bas'; }
    else                          { statusClass = 'badge-ok';  statusLabel = 'En stock';  }

    return `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge ${badgeClass(p.category)}">${p.category}</span></td>
      <td>${bought}</td>
      <td>${sold}</td>
      <td><strong>${stock}</strong></td>
      <td>${threshold}</td>
      <td>${formatNumber(valeur)} DJF</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td>
        <input class="seuil-input" type="number" min="0" value="${threshold}"
          onchange="setThreshold(${p.id}, this.value)" title="Seuil d'alerte" />
      </td>
    </tr>`;
  }).join('');

  renderStockSummary();
}

function filterStock() {
  const search = document.getElementById('stock-search').value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(search));
  renderStockTable(filtered);
}

function setThreshold(productId, value) {
  thresholds[productId] = parseInt(value) || 0;
  saveThresholds();
  updateStats();
  checkStockAlerts();
}

function renderStockSummary() {
  const totalValeur = products.reduce((sum, p) => {
    const stock = getStock(p.id);
    return sum + (stock > 0 ? stock * p.price : 0);
  }, 0);
  const totalAchats = purchases.reduce((sum, p) => sum + p.total, 0);
  const totalVentes = sales.reduce((sum, s) => sum + s.total, 0);
  const marge = totalVentes - totalAchats;

  const el = document.getElementById('stock-summary-cards');
  if (!el) return;
  el.innerHTML = `
    <div class="card card-teal">
      <div class="card-icon">🏭</div>
      <div>
        <div class="card-label">Valeur totale du stock</div>
        <div class="card-value">${formatNumber(totalValeur)} DJF</div>
      </div>
    </div>
    <div class="card card-purple">
      <div class="card-icon">🛒</div>
      <div>
        <div class="card-label">Total achats (all)</div>
        <div class="card-value">${formatNumber(totalAchats)} DJF</div>
      </div>
    </div>
    <div class="card card-green">
      <div class="card-icon">💰</div>
      <div>
        <div class="card-label">Total ventes (all)</div>
        <div class="card-value">${formatNumber(totalVentes)} DJF</div>
      </div>
    </div>
    <div class="card ${marge >= 0 ? 'card-blue' : 'card-red'}">
      <div class="card-icon">${marge >= 0 ? '📈' : '📉'}</div>
      <div>
        <div class="card-label">Marge brute</div>
        <div class="card-value">${formatNumber(marge)} DJF</div>
      </div>
    </div>
  `;
}

// ===== VENTES =====
document.addEventListener('DOMContentLoaded', () => {
  const qtyEl   = document.getElementById('sale-qty');
  const priceEl = document.getElementById('sale-price');
  const prodEl  = document.getElementById('sale-product');

  function updatePreview() {
    const qty   = parseFloat(qtyEl.value)   || 0;
    const price = parseFloat(priceEl.value) || 0;
    document.getElementById('total-preview').textContent = formatNumber(qty * price) + ' DJF';
  }

  qtyEl.addEventListener('input', updatePreview);
  priceEl.addEventListener('input', updatePreview);

  prodEl.addEventListener('change', () => {
    const p = products.find(x => x.id == prodEl.value);
    if (p && p.price) {
      priceEl.value = p.price;
      updatePreview();
    }
  });
});

function addSale(e) {
  e.preventDefault();
  const productId = document.getElementById('sale-product').value;
  const product   = products.find(p => p.id == productId);
  const qty       = parseFloat(document.getElementById('sale-qty').value);
  const price     = parseFloat(document.getElementById('sale-price').value);
  const client    = document.getElementById('sale-client').value.trim();
  const date      = document.getElementById('sale-date').value;
  const note      = document.getElementById('sale-note').value.trim();

  if (!productId || !qty || !price || !date) return;

  const sale = {
    id: Date.now(),
    productId,
    productName: product ? product.name : 'Produit inconnu',
    qty,
    price,
    total: qty * price,
    client,
    date,
    note,
  };

  sales.unshift(sale);
  saveSales();
  addLog('vente', 'Vente enregistrée', `${sale.productName} × ${qty} = ${formatNumber(sale.total)} DJF${client ? ' · Client : ' + client : ''}`);

  document.getElementById('sale-form').reset();
  document.getElementById('sale-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('total-preview').textContent = '0 DJF';

  renderSalesTable();
  renderRecentSales();
  renderStockTable();
  updateStats();
  checkStockAlerts();
  showToast('Vente enregistrée avec succès !');
}

function deleteSale(id) {
  deleteTarget = { type: 'sale', id };
  document.getElementById('modal').style.display = 'flex';
}

function renderSalesTable(filtered) {
  const data  = filtered !== undefined ? filtered : sales;
  const tbody = document.getElementById('sales-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty">Aucune vente enregistrée</td></tr>';
    document.getElementById('filtered-total').textContent = '0 DJF';
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td>${formatDateFr(s.date)}</td>
      <td><strong>${s.productName}</strong></td>
      <td>${s.qty}</td>
      <td>${formatNumber(s.price)} DJF</td>
      <td><strong>${formatNumber(s.total)} DJF</strong></td>
      <td>${s.client || '-'}</td>
      <td>${s.note || '-'}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteSale(${s.id})">✕</button>
      </td>
    </tr>
  `).join('');

  const total = data.reduce((sum, s) => sum + s.total, 0);
  document.getElementById('filtered-total').textContent = formatNumber(total) + ' DJF';
}

function renderRecentSales() {
  // Géré désormais par renderDashboard() via l'activité récente
}

function filterSales() {
  const month  = document.getElementById('filter-month').value;
  const search = document.getElementById('filter-search').value.toLowerCase();

  let filtered = sales;

  if (month) {
    filtered = filtered.filter(s => s.date.startsWith(month));
  }
  if (search) {
    filtered = filtered.filter(s =>
      s.productName.toLowerCase().includes(search) ||
      (s.client && s.client.toLowerCase().includes(search))
    );
  }

  renderSalesTable(filtered);
}

// ===== DASHBOARD ANIMÉ =====
function renderDashboard() {
  const today = new Date();
  const todayStr  = today.toISOString().split('T')[0];
  const monthStr  = todayStr.substring(0,7);
  const prevMonth = (() => {
    const d = new Date(today.getFullYear(), today.getMonth()-1, 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  // Date complète
  const el = document.getElementById('dash-date-full');
  if (el) el.textContent = today.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Calculs
  const todaySales  = sales.filter(s => s.date === todayStr);
  const monthSales  = sales.filter(s => s.date.startsWith(monthStr));
  const prevSales   = sales.filter(s => s.date.startsWith(prevMonth));
  const monthBuys   = purchases.filter(p => p.date.startsWith(monthStr));
  const prevBuys    = purchases.filter(p => p.date.startsWith(prevMonth));

  const todayTotal  = todaySales.reduce((s,x)=>s+x.total,0);
  const monthTotal  = monthSales.reduce((s,x)=>s+x.total,0);
  const prevTotal   = prevSales.reduce((s,x)=>s+x.total,0);
  const buysTotal   = monthBuys.reduce((s,x)=>s+x.total,0);
  const prevBuys_   = prevBuys.reduce((s,x)=>s+x.total,0);
  const marge       = monthTotal - buysTotal;

  // Marge bannière
  const mv = document.getElementById('dash-marge-value');
  if (mv) { mv.textContent = formatNumber(marge)+' DJF'; mv.style.color = marge>=0?'#e8b04b':'#ef4444'; }

  // --- KPI avec compteurs animés ---
  animCounter('dk-today',  todayTotal, ' DJF');
  animCounter('dk-month',  monthTotal, ' DJF');
  animCounter('dk-achats', buysTotal,  ' DJF');
  animCounter('dk-count',  sales.length, '');

  // Deltas
  setDelta('dk-today-delta',  todayTotal, 0);
  setDelta('dk-month-delta',  monthTotal, prevTotal);
  setDelta('dk-achats-delta', buysTotal,  prevBuys_);
  const el2 = document.getElementById('dk-count-delta');
  if (el2) { el2.textContent = `${purchases.length} achat(s) enregistré(s)`; el2.style.color='#888'; }

  // --- Sparklines ---
  const last7 = Array.from({length:7},(_,i)=>{
    const d = new Date(today); d.setDate(d.getDate()-6+i);
    return d.toISOString().split('T')[0];
  });
  const last4w = Array.from({length:4},(_,i)=>{
    const from = new Date(today); from.setDate(from.getDate()-27+i*7);
    const to   = new Date(from);  to.setDate(to.getDate()+6);
    return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
  });

  drawSparkline('spark-today',  last7.map(d=>sales.filter(s=>s.date===d).reduce((a,x)=>a+x.total,0)),   '#3b82f6');
  drawSparkline('spark-month',  last4w.map(w=>sales.filter(s=>s.date>=w.from&&s.date<=w.to).reduce((a,x)=>a+x.total,0)), '#10b981');
  drawSparkline('spark-achats', last4w.map(w=>purchases.filter(p=>p.date>=w.from&&p.date<=w.to).reduce((a,x)=>a+x.total,0)), '#8b5cf6');
  drawSparkline('spark-count',  last7.map(d=>sales.filter(s=>s.date===d).length), '#f97316');

  // --- Graphique ligne 30 jours ---
  const days30 = Array.from({length:30},(_,i)=>{
    const d = new Date(today); d.setDate(d.getDate()-29+i);
    return d.toISOString().split('T')[0];
  });
  const ventesPer30  = days30.map(d=>sales.filter(s=>s.date===d).reduce((a,x)=>a+x.total,0));
  const achatsPer30  = days30.map(d=>purchases.filter(p=>p.date===d).reduce((a,x)=>a+x.total,0));
  const labls30      = days30.map(d=>{ const [,m,j]=d.split('-'); return `${parseInt(j)}/${parseInt(m)}`; });
  drawDashLine('dash-line-chart', labls30, ventesPer30, achatsPer30);

  // --- Donut top produits ---
  const byProd = {};
  sales.forEach(s=>{ byProd[s.productName]=(byProd[s.productName]||0)+s.total; });
  const topProds = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,6);
  drawDashDonut('dash-donut-chart', topProds.map(x=>x[0]), topProds.map(x=>x[1]), CHART_COLORS);

  // Légende donut
  const dleg = document.getElementById('dash-donut-legend');
  if (dleg) dleg.innerHTML = topProds.map((x,i)=>`
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></div>
      <span>${x[0]}</span>
    </div>`).join('');

  // --- Barres produits ---
  const maxProd = topProds[0]?.[1] || 1;
  const pb = document.getElementById('dash-prod-bars');
  if (pb) {
    pb.innerHTML = topProds.length ? topProds.map((x,i)=>`
      <div class="dash-prod-bar-item">
        <div class="dash-prod-bar-label">
          <span>${x[0]}</span>
          <strong>${formatNumber(x[1])} DJF</strong>
        </div>
        <div class="dash-prod-track">
          <div class="dash-prod-fill" data-w="${Math.round(x[1]/maxProd*100)}"
            style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></div>
        </div>
      </div>`).join('')
    : '<p style="color:#bbb;font-size:13px;text-align:center;padding:20px">Aucune vente enregistrée</p>';
    // Déclencher animation barres
    setTimeout(()=>{
      pb.querySelectorAll('.dash-prod-fill').forEach(el=>{
        el.style.width = el.dataset.w + '%';
      });
    }, 100);
  }

  // --- Activité récente ---
  const act = document.getElementById('dash-activity');
  if (act) {
    const recent = sales.slice(0,6);
    act.innerHTML = recent.length ? recent.map((s,i)=>`
      <div class="dash-activity-item" style="animation-delay:${i*0.06}s">
        <div class="dash-act-dot">💰</div>
        <div class="dash-act-body">
          <div class="dash-act-name">${s.productName}</div>
          <div class="dash-act-sub">${formatDateFr(s.date)}${s.client?' · '+s.client:''}</div>
        </div>
        <div class="dash-act-amt">+${formatNumber(s.total)} DJF</div>
      </div>`).join('')
    : '<p style="color:#bbb;font-size:13px;text-align:center;padding:16px">Aucune activité</p>';
  }

  // --- Alertes stock ---
  const sa = document.getElementById('dash-stock-alerts');
  if (sa) {
    const alerts = products.map(p=>({p, stock:getStock(p.id), thresh:thresholds[p.id]||0}))
      .filter(x=>x.stock<=x.thresh).slice(0,5);
    sa.innerHTML = alerts.length ? alerts.map((x,i)=>{
      const cls = x.stock<=0?'dash-alert-out':'dash-alert-low';
      const lbl = x.stock<=0?'Rupture':'Stock bas';
      return `<div class="dash-alert-item ${cls}" style="animation-delay:${i*0.08}s">
        <span>${x.p.name}</span>
        <strong>${lbl} (${x.stock} restant)</strong>
      </div>`;
    }).join('')
    : '<div class="dash-alert-item dash-alert-ok">Tous les stocks sont suffisants ✓</div>';
  }
}

// Compteur animé
function animCounter(id, target, suffix='', duration=900) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const from  = parseFloat(el.dataset.prev||0);
  el.dataset.prev = target;
  function step(now) {
    const p = Math.min((now-start)/duration, 1);
    const ease = 1 - Math.pow(1-p, 3);
    const val = from + (target-from)*ease;
    el.textContent = formatNumber(val) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Delta vs mois précédent
function setDelta(id, current, prev) {
  const el = document.getElementById(id);
  if (!el) return;
  if (prev === 0 && current === 0) { el.textContent = 'Pas de données'; el.style.color='#bbb'; return; }
  if (prev === 0) { el.textContent = '↑ Nouveau'; el.style.color='#10b981'; return; }
  const pct = Math.round((current-prev)/prev*100);
  el.textContent = `${pct>=0?'↑':'↓'} ${Math.abs(pct)}% vs mois précédent`;
  el.style.color = pct>=0 ? '#10b981' : '#ef4444';
}

// Sparkline mini
function drawSparkline(id, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  canvas.width = canvas.offsetWidth || 200;
  const W=canvas.width, H=canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);

  const max = Math.max(...data, 1);
  const pts = data.map((v,i)=>({
    x: (i/(data.length-1||1))*W,
    y: H - (v/max)*(H-4) - 2
  }));

  // Fill area
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0, color+'55'); grad.addColorStop(1, color+'00');
  ctx.beginPath(); ctx.moveTo(pts[0].x, H);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x, H);
  ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();

  // Last dot
  const last = pts[pts.length-1];
  ctx.beginPath(); ctx.arc(last.x,last.y,3,0,Math.PI*2);
  ctx.fillStyle=color; ctx.fill();
}

// Line chart 30 jours animé
function drawDashLine(id, labels, data1, data2) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  canvas.width = canvas.offsetWidth || 600;
  const W=canvas.width, H=canvas.height;
  const ctx = canvas.getContext('2d');

  const pad={top:16,right:16,bottom:36,left:58};
  const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom;
  const max=Math.max(...data1,...data2,1);

  let prog=0;
  function draw(p) {
    ctx.clearRect(0,0,W,H);

    // Grid
    ctx.strokeStyle='#f0f2f5'; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=pad.top+cH-(cH/4)*i;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
      ctx.fillStyle='#bbb'; ctx.font='10px Segoe UI'; ctx.textAlign='right';
      ctx.fillText(formatK(max/4*i),pad.left-6,y+4);
    }

    const count = Math.max(1, Math.round(labels.length*p));

    [data1,data2].forEach((data,di)=>{
      const color = di===0?'#3b82f6':'#e8b04b';
      const pts=data.slice(0,count).map((v,i)=>({
        x:pad.left+((i)/(labels.length-1||1))*cW,
        y:pad.top+cH-(v/max)*cH
      }));
      if(pts.length<2) return;

      const grad=ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
      grad.addColorStop(0,color+(di===0?'33':'22')); grad.addColorStop(1,color+'00');
      ctx.beginPath(); ctx.moveTo(pts[0].x,pad.top+cH);
      pts.forEach(pt=>ctx.lineTo(pt.x,pt.y));
      ctx.lineTo(pts[pts.length-1].x,pad.top+cH);
      ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

      ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++){
        const mx=(pts[i-1].x+pts[i].x)/2;
        ctx.bezierCurveTo(mx,pts[i-1].y,mx,pts[i].y,pts[i].x,pts[i].y);
      }
      ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();
    });

    // Labels X (every 5)
    labels.forEach((lbl,i)=>{
      if(i%5!==0&&i!==labels.length-1) return;
      const x=pad.left+(i/(labels.length-1||1))*cW;
      ctx.fillStyle='#bbb'; ctx.font='9px Segoe UI'; ctx.textAlign='center';
      ctx.fillText(lbl,x,H-pad.bottom+13);
    });
  }

  const start=performance.now();
  function animate(now) {
    prog=Math.min((now-start)/900,1);
    draw(1-Math.pow(1-prog,3));
    if(prog<1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// Donut animé
function drawDashDonut(id, labels, data, colors) {
  const canvas=document.getElementById(id);
  if(!canvas) return;
  canvas.width=canvas.offsetWidth||280;
  const W=canvas.width, H=canvas.height;
  const ctx=canvas.getContext('2d');
  const total=data.reduce((s,v)=>s+v,0);
  if(total===0){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='#eee'; ctx.beginPath(); ctx.arc(W/2,H/2,H/2-10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#aaa'; ctx.font='12px Segoe UI'; ctx.textAlign='center';
    ctx.fillText('Aucune donnée',W/2,H/2+4); return;
  }
  const cx=W/2, cy=H/2, R=Math.min(W,H)/2-10, r=R*.52;

  let prog=0;
  const start=performance.now();
  function animate(now){
    prog=Math.min((now-start)/800,1);
    const ease=1-Math.pow(1-prog,3);
    ctx.clearRect(0,0,W,H);
    let angle=-Math.PI/2;
    data.forEach((val,i)=>{
      const slice=(val/total)*Math.PI*2*ease;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,angle,angle+slice);
      ctx.closePath();
      ctx.fillStyle=colors[i%colors.length]; ctx.fill();
      ctx.strokeStyle='white'; ctx.lineWidth=2; ctx.stroke();
      angle+=slice;
    });
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle='white'; ctx.fill();
    ctx.fillStyle='#1a1a2e'; ctx.font=`bold ${W>240?16:13}px Segoe UI`; ctx.textAlign='center';
    ctx.fillText(formatK(total*ease),cx,cy+2);
    ctx.fillStyle='#aaa'; ctx.font='10px Segoe UI';
    ctx.fillText('DJF',cx,cy+15);
    if(prog<1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ===== STATS (legacy, toujours appelé par refreshAll) =====
function updateStats() {
  // Le dashboard animé gère maintenant ses propres KPIs
  // Cette fonction est gardée au cas où d'autres pages la consultent
}

// ===== FACTURATION =====
let invoiceRows = []; // lignes temporaires de la facture en cours

document.addEventListener('DOMContentLoaded', () => {
  // Recalcul totaux quand TVA change
  document.getElementById('inv-tva').addEventListener('input', recalcInvoice);
  // Première ligne par défaut
  addInvoiceRow();
});

function addInvoiceRow() {
  const idx = invoiceRows.length;
  invoiceRows.push({ productId: '', desc: '', qty: 1, price: 0 });

  const tbody = document.getElementById('invoice-rows');
  const tr = document.createElement('tr');
  tr.id = `inv-row-${idx}`;
  tr.innerHTML = `
    <td>
      <select onchange="onInvProductChange(${idx}, this)">
        <option value="">-- Saisie libre --</option>
        ${products.map(p => `<option value="${p.id}" data-price="${p.price}">${p.name}</option>`).join('')}
      </select>
      <input type="text" placeholder="Description libre..." style="margin-top:4px"
        id="inv-desc-${idx}" oninput="invoiceRows[${idx}].desc=this.value" />
    </td>
    <td><input type="number" min="1" value="1" id="inv-qty-${idx}"
      oninput="invoiceRows[${idx}].qty=+this.value; recalcInvoice()" /></td>
    <td><input type="number" min="0" value="0" id="inv-price-${idx}"
      oninput="invoiceRows[${idx}].price=+this.value; recalcInvoice()" /></td>
    <td id="inv-rowtotal-${idx}" style="font-weight:700">0 DJF</td>
    <td><button type="button" class="btn btn-danger btn-sm" onclick="removeInvoiceRow(${idx})">✕</button></td>
  `;
  tbody.appendChild(tr);
  recalcInvoice();
}

function removeInvoiceRow(idx) {
  if (invoiceRows.length <= 1) return;
  invoiceRows[idx] = null;
  const row = document.getElementById(`inv-row-${idx}`);
  if (row) row.remove();
  recalcInvoice();
}

function onInvProductChange(idx, sel) {
  const opt = sel.options[sel.selectedIndex];
  const price = parseFloat(opt.dataset.price) || 0;
  invoiceRows[idx].productId = sel.value;
  document.getElementById(`inv-price-${idx}`).value = price;
  invoiceRows[idx].price = price;
  if (!document.getElementById(`inv-desc-${idx}`).value) {
    document.getElementById(`inv-desc-${idx}`).value = opt.text !== '-- Saisie libre --' ? opt.text : '';
    invoiceRows[idx].desc = document.getElementById(`inv-desc-${idx}`).value;
  }
  recalcInvoice();
}

function recalcInvoice() {
  let subtotal = 0;
  invoiceRows.forEach((row, idx) => {
    if (!row) return;
    const qty   = parseFloat(document.getElementById(`inv-qty-${idx}`)?.value)   || 0;
    const price = parseFloat(document.getElementById(`inv-price-${idx}`)?.value) || 0;
    const total = qty * price;
    row.qty   = qty;
    row.price = price;
    const el = document.getElementById(`inv-rowtotal-${idx}`);
    if (el) el.textContent = formatNumber(total) + ' DJF';
    subtotal += total;
  });

  const tvaPct   = parseFloat(document.getElementById('inv-tva').value) || 0;
  const tvaAmt   = subtotal * tvaPct / 100;
  const total    = subtotal + tvaAmt;

  document.getElementById('inv-subtotal').textContent   = formatNumber(subtotal) + ' DJF';
  document.getElementById('inv-tva-pct').textContent    = tvaPct;
  document.getElementById('inv-tva-amount').textContent = formatNumber(tvaAmt) + ' DJF';
  document.getElementById('inv-total-final').textContent= formatNumber(total) + ' DJF';
}

function createInvoice(e) {
  e.preventDefault();
  const clientName = document.getElementById('inv-client-name').value.trim();
  const clientPhone= document.getElementById('inv-client-phone').value.trim();
  const clientAddr = document.getElementById('inv-client-addr').value.trim();
  const date       = document.getElementById('inv-date').value;
  const dueDate    = document.getElementById('inv-due-date').value;
  const tvaPct     = parseFloat(document.getElementById('inv-tva').value) || 0;
  const notes      = document.getElementById('inv-notes').value.trim();

  const items = invoiceRows
    .filter(r => r !== null && (r.qty > 0) && (r.price > 0 || r.desc))
    .map(r => ({
      productId:   r.productId,
      desc:        r.desc || (products.find(p => p.id == r.productId)?.name || 'Article'),
      qty:         r.qty,
      price:       r.price,
      total:       r.qty * r.price,
    }));

  if (items.length === 0) {
    showToast('Ajoutez au moins un article avec un montant.');
    return;
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tvaAmt   = subtotal * tvaPct / 100;
  const total    = subtotal + tvaAmt;

  const year   = new Date().getFullYear();
  const num    = String(invoices.length + 1).padStart(4, '0');
  const number = `FAC-${year}-${num}`;

  const invoice = {
    id: Date.now(),
    number,
    client: { name: clientName, phone: clientPhone, addr: clientAddr },
    date,
    dueDate,
    items,
    subtotal,
    tvaPct,
    tvaAmt,
    total,
    status: 'brouillon',
    notes,
  };

  invoices.unshift(invoice);
  saveInvoices();
  addLog('facture', `Facture ${number} créée`, `Client : ${clientName} — Total : ${formatNumber(total)} DJF`);

  // Reset formulaire
  document.getElementById('invoice-form').reset();
  document.getElementById('inv-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('invoice-rows').innerHTML = '';
  invoiceRows = [];
  addInvoiceRow();
  recalcInvoice();

  renderInvoicesTable();
  updateStats();
  showToast(`Facture ${number} créée !`);
  previewInvoice(invoice.id);
}

function renderInvoicesTable(filtered) {
  const data  = filtered !== undefined ? filtered : invoices;
  const tbody = document.getElementById('invoices-table');

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Aucune facture créée</td></tr>';
    document.getElementById('inv-filtered-total').textContent = '0 DJF';
    return;
  }

  tbody.innerHTML = data.map(inv => `
    <tr>
      <td><strong>${inv.number}</strong></td>
      <td>${formatDateFr(inv.date)}</td>
      <td>${inv.client.name}</td>
      <td><strong>${formatNumber(inv.total)} DJF</strong></td>
      <td>
        <select class="status-select" onchange="updateInvoiceStatus(${inv.id}, this.value)">
          <option value="brouillon" ${inv.status==='brouillon'?'selected':''}>Brouillon</option>
          <option value="envoyee"   ${inv.status==='envoyee'  ?'selected':''}>Envoyée</option>
          <option value="payee"     ${inv.status==='payee'    ?'selected':''}>Payée</option>
          <option value="annulee"   ${inv.status==='annulee'  ?'selected':''}>Annulée</option>
        </select>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="previewInvoice(${inv.id})">👁️ Voir</button>
        <button class="btn btn-pdf-sm btn-sm" onclick="exportInvoicePDF(${inv.id})" style="margin-left:4px">📄 PDF</button>
        <button class="btn btn-danger btn-sm" onclick="deleteInvoice(${inv.id})" style="margin-left:4px">✕</button>
      </td>
    </tr>
  `).join('');

  const total = data.reduce((s, inv) => s + inv.total, 0);
  document.getElementById('inv-filtered-total').textContent = formatNumber(total) + ' DJF';
}

function filterInvoices() {
  const status = document.getElementById('inv-filter-status').value;
  const search = document.getElementById('inv-filter-search').value.toLowerCase();
  let filtered = invoices;
  if (status) filtered = filtered.filter(i => i.status === status);
  if (search) filtered = filtered.filter(i => i.client.name.toLowerCase().includes(search));
  renderInvoicesTable(filtered);
}

function updateInvoiceStatus(id, status) {
  const inv = invoices.find(i => i.id === id);
  if (inv) {
    const labels = { brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée', annulee: 'Annulée' };
    addLog('facture', `Statut facture mis à jour`, `${inv.number} → ${labels[status] || status}`);
    inv.status = status;
    saveInvoices();
    updateStats();
  }
}

function deleteInvoice(id) {
  deleteTarget = { type: 'invoice', id };
  document.getElementById('modal').style.display = 'flex';
}

function previewInvoice(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  const itemsRows = inv.items.map(item => `
    <tr>
      <td>${item.desc}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">${formatNumber(item.price)}</td>
      <td style="text-align:right"><strong>${formatNumber(item.total)}</strong></td>
    </tr>
  `).join('');

  const statusLabels = { brouillon:'Brouillon', envoyee:'Envoyée', payee:'Payée', annulee:'Annulée' };
  const statusColors = { brouillon:'#888', envoyee:'#1e40af', payee:'#065f46', annulee:'#991b1b' };

  document.getElementById('invoice-print-area').innerHTML = `
    <div class="inv-header">
      <div class="inv-company">
        <h2>🚬 TabacPro</h2>
        <p>Entreprise de Tabac<br>Djibouti<br>Tel: +253 00 00 00 00</p>
      </div>
      <div class="inv-badge">
        <div class="inv-label">FACTURE</div>
        <div class="inv-number">${inv.number}</div>
        <div style="margin-top:6px;font-size:12px;opacity:0.8;font-weight:700;color:${statusColors[inv.status]||'#aaa'}">${statusLabels[inv.status]||''}</div>
      </div>
    </div>

    <div class="inv-meta">
      <div class="inv-client-box">
        <h4>Facturé à</h4>
        <p>
          <strong>${inv.client.name}</strong><br>
          ${inv.client.addr ? inv.client.addr + '<br>' : ''}
          ${inv.client.phone ? inv.client.phone : ''}
        </p>
      </div>
      <div class="inv-dates-box">
        <h4>Détails</h4>
        <div class="date-row"><span>Date émission :</span><span>${formatDateFr(inv.date)}</span></div>
        ${inv.dueDate ? `<div class="date-row"><span>Échéance :</span><span>${formatDateFr(inv.dueDate)}</span></div>` : ''}
        <div class="date-row"><span>N° facture :</span><span><strong>${inv.number}</strong></span></div>
      </div>
    </div>

    <table class="inv-items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align:center">Qté</th>
          <th style="text-align:right">Prix unit. (DJF)</th>
          <th style="text-align:right">Total (DJF)</th>
        </tr>
      </thead>
      <tbody>${itemsRows}</tbody>
    </table>

    <div class="inv-totals">
      <div class="inv-total-row"><span>Sous-total :</span><span>${formatNumber(inv.subtotal)} DJF</span></div>
      <div class="inv-total-row"><span>TVA (${inv.tvaPct}%) :</span><span>${formatNumber(inv.tvaAmt)} DJF</span></div>
      <div class="inv-total-row final"><span>TOTAL À PAYER :</span><span>${formatNumber(inv.total)} DJF</span></div>
    </div>

    ${inv.notes ? `<div class="inv-notes"><strong>Note :</strong> ${inv.notes}</div>` : ''}

    <div class="inv-footer">
      Merci pour votre confiance — TabacPro · Djibouti
    </div>
  `;

  document.getElementById('invoice-preview-modal').style.display = 'block';
}

function closeInvoiceModal() {
  document.getElementById('invoice-preview-modal').style.display = 'none';
}

// ===== EXPORT PDF =====

// Toggle du menu déroulant
function togglePdfMenu() {
  const dd = document.getElementById('pdf-dropdown');
  dd.classList.toggle('open');
}
// Fermer en cliquant ailleurs
document.addEventListener('click', e => {
  const dd = document.getElementById('pdf-dropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});

// ── Helpers jsPDF ──────────────────────────────────────────────
function pdfDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

const PDF_NAVY  = [26, 26, 46];
const PDF_GOLD  = [232, 176, 75];
const PDF_GRAY  = [120, 120, 130];
const PDF_LIGHT = [245, 246, 248];
const PDF_WHITE = [255, 255, 255];

function pdfHeader(doc, title, subtitle = '') {
  const company     = JSON.parse(localStorage.getItem(COMPANY_KEY) || '{}');
  const companyName = company.name    || 'TabacPro';
  const companyAddr = company.address || 'Entreprise de Tabac — Djibouti';
  const logo        = localStorage.getItem(COMPANY_LOGO_KEY);

  // Bande de fond
  doc.setFillColor(...PDF_NAVY);
  doc.rect(0, 0, 210, 28, 'F');

  let textX = 14;
  // Logo image
  if (logo) {
    try {
      doc.addImage(logo, 14, 2, 24, 24);
      textX = 42;
    } catch(e) { /* ignore — dessin texte seulement */ }
  }

  // Nom entreprise
  doc.setTextColor(...PDF_GOLD);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName, textX, 12);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text(companyAddr, textX, 18);

  // Titre du rapport
  doc.setTextColor(...PDF_WHITE);
  doc.setFontSize(13);
  doc.text(title, textX, 24);
  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 200);
    doc.text(subtitle, 210 - 14, 24, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  return 36; // Y de départ
}

function pdfFooter(doc) {
  const company     = JSON.parse(localStorage.getItem(COMPANY_KEY) || '{}');
  const companyName = company.name || 'TabacPro';
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...PDF_GRAY);
    doc.text(`${companyName} — Généré le ${new Date().toLocaleDateString('fr-FR')}`, 14, 290);
    doc.text(`Page ${i} / ${pages}`, 196, 290, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.line(14, 286, 196, 286);
  }
}

function pdfSectionTitle(doc, text, y) {
  doc.setFillColor(...PDF_LIGHT);
  doc.rect(14, y - 4, 182, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  doc.text(text, 16, y + 1);
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

function pdfTable(doc, headers, rows, y, colW) {
  const rowH = 7;
  const x0 = 14;
  // En-tête
  doc.setFillColor(...PDF_NAVY);
  doc.rect(x0, y, 182, rowH + 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_WHITE);
  let cx = x0 + 2;
  headers.forEach((h, i) => { doc.text(h, cx, y + 5); cx += colW[i]; });

  // Lignes
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 60);
  y += rowH + 1;
  rows.forEach((row, ri) => {
    if (y > 272) { doc.addPage(); y = 20; }
    if (ri % 2 === 0) { doc.setFillColor(...PDF_LIGHT); doc.rect(x0, y, 182, rowH, 'F'); }
    cx = x0 + 2;
    row.forEach((cell, i) => {
      doc.setFont('helvetica', i === row.length - 1 ? 'bold' : 'normal');
      const txt = String(cell ?? '-');
      doc.text(txt, cx, y + 5, { maxWidth: colW[i] - 3 });
      cx += colW[i];
    });
    y += rowH;
  });

  doc.setDrawColor(220, 220, 220);
  doc.line(x0, y, x0 + 182, y);
  return y + 6;
}

function pdfKpiBox(doc, x, y, w, label, value, color) {
  doc.setFillColor(...color);
  doc.roundedRect(x, y, w, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 120);
  doc.text(label, x + 4, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_NAVY);
  doc.text(value, x + 4, y + 17);
}

// ── 1. Dashboard PDF ───────────────────────────────────────────
function exportDashboardPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const doc = pdfDoc();
  const today = new Date().toISOString().split('T')[0];
  const month = today.substring(0, 7);
  const prevM = (() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();

  const mSales  = sales.filter(s => s.date.startsWith(month));
  const mBuys   = purchases.filter(p => p.date.startsWith(month));
  const tSales  = mSales.reduce((s,x) => s+x.total, 0);
  const tBuys   = mBuys.reduce((s,x) => s+x.total, 0);
  const marge   = tSales - tBuys;
  const allTime = sales.reduce((s,x) => s+x.total, 0);

  let y = pdfHeader(doc, 'Tableau de bord', `Mois : ${month}`);

  // KPI boxes
  const bw = 42, gap = 4, bx = 14;
  pdfKpiBox(doc, bx,           y, bw, 'Ventes du mois',    formatNumber(tSales)+' DJF',  PDF_LIGHT);
  pdfKpiBox(doc, bx+bw+gap,   y, bw, 'Achats du mois',    formatNumber(tBuys)+' DJF',   PDF_LIGHT);
  pdfKpiBox(doc, bx+(bw+gap)*2,y, bw, 'Marge brute',       formatNumber(marge)+' DJF',   marge>=0?[235,252,243]:[255,235,235]);
  pdfKpiBox(doc, bx+(bw+gap)*3,y, bw, 'CA total (all)',    formatNumber(allTime)+' DJF', PDF_LIGHT);
  y += 30;

  // Stock alertes
  const alerts = products.map(p=>({p, stock:getStock(p.id), thresh:thresholds[p.id]||0}))
    .filter(x=>x.stock<=x.thresh);
  if (alerts.length) {
    y = pdfSectionTitle(doc, `⚠ Alertes stock (${alerts.length} produit(s))`, y);
    y = pdfTable(doc,
      ['Produit', 'Catégorie', 'Stock actuel', 'Seuil', 'Statut'],
      alerts.map(x=>[x.p.name, x.p.category, x.stock, x.thresh, x.stock<=0?'RUPTURE':'Stock bas']),
      y, [60, 40, 30, 25, 27]);
  }

  // Top produits
  const byProd = {};
  sales.forEach(s=>{ byProd[s.productName]=(byProd[s.productName]||0)+s.total; });
  const top = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,8);
  y = pdfSectionTitle(doc, 'Top produits (tous temps)', y);
  y = pdfTable(doc,
    ['#', 'Produit', 'CA total (DJF)'],
    top.map((x,i)=>[i+1, x[0], formatNumber(x[1])]),
    y, [12, 130, 40]);

  // Dernières ventes
  y = pdfSectionTitle(doc, 'Dernières ventes', y);
  pdfTable(doc,
    ['Date', 'Produit', 'Client', 'Qté', 'Total (DJF)'],
    sales.slice(0,12).map(s=>[formatDateFr(s.date), s.productName, s.client||'-', s.qty, formatNumber(s.total)]),
    y, [30, 55, 45, 15, 37]);

  pdfFooter(doc);
  doc.save(`TabacPro_Dashboard_${today}.pdf`);
  showToast('Dashboard exporté en PDF !');
}

// ── 2. Ventes PDF ──────────────────────────────────────────────
function exportVentesPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const doc = pdfDoc();
  const today = new Date().toISOString().split('T')[0];
  let y = pdfHeader(doc, 'Liste des ventes', `${sales.length} transaction(s)`);

  const total = sales.reduce((s,x) => s+x.total, 0);
  y = pdfSectionTitle(doc, `Total : ${formatNumber(total)} DJF`, y);

  const rows = sales.map(s=>[formatDateFr(s.date), s.productName, s.client||'-', s.qty, formatNumber(s.price), formatNumber(s.total)]);
  y = pdfTable(doc, ['Date','Produit','Client','Qté','Prix unit.','Total DJF'], rows, y, [28,50,38,12,28,26]);

  pdfFooter(doc);
  doc.save(`TabacPro_Ventes_${today}.pdf`);
  showToast('Liste des ventes exportée en PDF !');
}

// ── 3. Achats PDF ──────────────────────────────────────────────
function exportAchatsPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const doc = pdfDoc();
  const today = new Date().toISOString().split('T')[0];
  let y = pdfHeader(doc, 'Liste des achats', `${purchases.length} achat(s)`);

  const total = purchases.reduce((s,x) => s+x.total, 0);
  y = pdfSectionTitle(doc, `Total achats : ${formatNumber(total)} DJF`, y);

  const rows = purchases.map(p=>[formatDateFr(p.date), p.productName, p.supplier||'-', p.qty, formatNumber(p.price), formatNumber(p.total)]);
  pdfTable(doc, ['Date','Produit','Fournisseur','Qté','Prix unit.','Total DJF'], rows, y, [28,48,38,12,28,28]);

  pdfFooter(doc);
  doc.save(`TabacPro_Achats_${today}.pdf`);
  showToast('Liste des achats exportée en PDF !');
}

// ── 4. Stock PDF ───────────────────────────────────────────────
function exportStockPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const doc = pdfDoc();
  const today = new Date().toISOString().split('T')[0];
  let y = pdfHeader(doc, 'État du stock', today);

  const rows = products.map(p => {
    const bought = purchases.filter(a=>a.productId==p.id).reduce((s,a)=>s+a.qty,0);
    const sold   = sales.filter(s=>s.productId==p.id).reduce((s,x)=>s+x.qty,0);
    const stock  = bought - sold;
    const val    = stock>0 ? stock*p.price : 0;
    const thresh = thresholds[p.id]||0;
    const status = stock<=0?'RUPTURE':stock<=thresh?'Stock bas':'OK';
    return [p.name, p.category, bought, sold, stock, formatNumber(val), status];
  });

  y = pdfSectionTitle(doc, `${products.length} produit(s) en catalogue`, y);
  pdfTable(doc, ['Produit','Catégorie','Acheté','Vendu','Stock','Valeur DJF','Statut'],
    rows, y, [50,35,20,20,18,32,27]);

  pdfFooter(doc);
  doc.save(`TabacPro_Stock_${today}.pdf`);
  showToast('État du stock exporté en PDF !');
}

// ── 5. Rapport analytique PDF ──────────────────────────────────
function exportRapportPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const from = rptFrom || new Date().toISOString().split('T')[0].substring(0,7)+'-01';
  const to   = rptTo   || new Date().toISOString().split('T')[0];
  const doc  = pdfDoc();
  const fSales = sales.filter(s=>s.date>=from&&s.date<=to);
  const fBuys  = purchases.filter(p=>p.date>=from&&p.date<=to);

  const tV = fSales.reduce((s,x)=>s+x.total,0);
  const tA = fBuys.reduce((s,x)=>s+x.total,0);
  const mg = tV - tA;

  let y = pdfHeader(doc, 'Rapport analytique', `Du ${formatDateFr(from)} au ${formatDateFr(to)}`);

  // KPIs
  const bw=42, gap=4;
  pdfKpiBox(doc,14,            y, bw, 'CA ventes',       formatNumber(tV)+' DJF',                  PDF_LIGHT);
  pdfKpiBox(doc,14+bw+gap,     y, bw, 'Total achats',    formatNumber(tA)+' DJF',                  PDF_LIGHT);
  pdfKpiBox(doc,14+(bw+gap)*2, y, bw, 'Marge brute',     formatNumber(mg)+' DJF',                  mg>=0?[235,252,243]:[255,235,235]);
  pdfKpiBox(doc,14+(bw+gap)*3, y, bw, 'Transactions',    `${fSales.length} vente(s)`,              PDF_LIGHT);
  y += 30;

  // Top produits
  const byProd={};
  fSales.forEach(s=>{
    if(!byProd[s.productName]) byProd[s.productName]={qty:0,total:0};
    byProd[s.productName].qty+=s.qty;
    byProd[s.productName].total+=s.total;
  });
  const top=Object.entries(byProd).sort((a,b)=>b[1].total-a[1].total);
  y = pdfSectionTitle(doc, 'Ventes par produit', y);
  y = pdfTable(doc, ['#','Produit','Qté vendue','CA (DJF)','Part %'],
    top.map(([name,d],i)=>[i+1,name,d.qty,formatNumber(d.total),tV?Math.round(d.total/tV*100)+'%':'0%']),
    y, [10,80,28,38,26]);

  // Top clients
  const byCli={};
  fSales.forEach(s=>{
    const k=s.client||'(Anonyme)';
    if(!byCli[k]) byCli[k]={count:0,total:0};
    byCli[k].count++; byCli[k].total+=s.total;
  });
  const topCli=Object.entries(byCli).sort((a,b)=>b[1].total-a[1].total).slice(0,8);
  y = pdfSectionTitle(doc, 'Top clients', y);
  y = pdfTable(doc, ['#','Client','Achats','Total (DJF)'],
    topCli.map(([n,d],i)=>[i+1,n,d.count,formatNumber(d.total)]),
    y, [10,100,28,44]);

  // Détail
  if (y > 220) doc.addPage(), y = 20;
  y = pdfSectionTitle(doc, 'Détail des ventes', y);
  pdfTable(doc, ['Date','Produit','Client','Qté','Prix unit.','Total DJF'],
    fSales.map(s=>[formatDateFr(s.date),s.productName,s.client||'-',s.qty,formatNumber(s.price),formatNumber(s.total)]),
    y, [28,50,38,12,28,26]);

  pdfFooter(doc);
  const today=new Date().toISOString().split('T')[0];
  doc.save(`TabacPro_Rapport_${from}_${to}.pdf`);
  showToast('Rapport exporté en PDF !');
}

// ── 6. Facture PDF ─────────────────────────────────────────────
function exportInvoicePDF(id) {
  document.getElementById('pdf-dropdown').classList.remove('open');
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const doc = pdfDoc();

  // En-tête entreprise
  doc.setFillColor(...PDF_NAVY);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...PDF_GOLD);
  doc.text('TabacPro', 14, 16);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text('Entreprise de Tabac', 14, 22);
  doc.text('Djibouti  |  +253 00 00 00 00', 14, 27);

  // Badge FACTURE
  doc.setFillColor(...PDF_GOLD);
  doc.roundedRect(140, 8, 56, 26, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_NAVY);
  doc.text('FACTURE', 168, 18, { align:'center' });
  doc.setFontSize(14);
  doc.text(inv.number, 168, 27, { align:'center' });

  let y = 50;

  // Infos client + dates
  doc.setFillColor(...PDF_LIGHT);
  doc.roundedRect(14, y, 88, 34, 2, 2, 'F');
  doc.roundedRect(108, y, 88, 34, 2, 2, 'F');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...PDF_GRAY);
  doc.text('FACTURÉ À', 18, y+6);
  doc.text('INFORMATIONS', 112, y+6);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...PDF_NAVY);
  doc.text(inv.client.name, 18, y+13);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60,60,70);
  if (inv.client.addr)   doc.text(inv.client.addr,  18, y+19);
  if (inv.client.phone)  doc.text(inv.client.phone, 18, y+25);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60,60,70);
  doc.text(`Date émission : ${formatDateFr(inv.date)}`, 112, y+13);
  if (inv.dueDate) doc.text(`Échéance : ${formatDateFr(inv.dueDate)}`, 112, y+19);
  const sLbl = {brouillon:'Brouillon',envoyee:'Envoyée',payee:'Payée',annulee:'Annulée'};
  doc.text(`Statut : ${sLbl[inv.status]||inv.status}`, 112, y+25);

  y += 42;

  // Tableau articles
  const rows = inv.items.map(it=>[it.desc, it.qty, formatNumber(it.price), formatNumber(it.total)]);
  y = pdfTable(doc, ['Description','Qté','Prix unitaire (DJF)','Total (DJF)'], rows, y, [95,18,45,24]);

  // Totaux
  const totals = [
    ['Sous-total :', formatNumber(inv.subtotal)+' DJF'],
    [`TVA (${inv.tvaPct}%) :`, formatNumber(inv.tvaAmt)+' DJF'],
  ];
  totals.forEach(([lbl, val]) => {
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80,80,90);
    doc.text(lbl, 140, y); doc.text(val, 196, y, {align:'right'});
    y += 7;
  });
  // Total final
  doc.setFillColor(...PDF_NAVY);
  doc.rect(110, y, 86, 10, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(...PDF_WHITE);
  doc.text('TOTAL À PAYER :', 114, y+7);
  doc.text(formatNumber(inv.total)+' DJF', 194, y+7, {align:'right'});
  y += 16;

  // Notes
  if (inv.notes) {
    doc.setFillColor(255, 248, 225);
    doc.rect(14, y, 182, 12, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...PDF_NAVY);
    doc.text('Note :', 18, y+5);
    doc.setFont('helvetica','normal'); doc.setTextColor(80,80,90);
    doc.text(inv.notes, 35, y+5, {maxWidth:158});
    y += 16;
  }

  // Pied de page
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...PDF_GRAY);
  doc.line(14, 282, 196, 282);
  doc.text('Merci pour votre confiance — TabacPro · Djibouti', 105, 287, {align:'center'});
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 196, 287, {align:'right'});

  doc.save(`${inv.number}.pdf`);
  showToast(`Facture ${inv.number} exportée en PDF !`);
}

// ── 6b. Rapport Ventes POS PDF ─────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function exportPosSalesPDF() {
  document.getElementById('pdf-dropdown')?.classList.remove('open');

  const from = rptFrom || new Date().toISOString().split('T')[0].substring(0,7)+'-01';
  const to   = rptTo   || new Date().toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Ventes POS sur la période
  const posSales = sales.filter(s =>
    s.date >= from && s.date <= to &&
    (s.terminalId || (s.note && s.note.includes('Vente POS')))
  );

  const doc = pdfDoc();
  let y = pdfHeader(doc,
    'Rapport Ventes POS par Caisse',
    `Période : ${formatDateFr(from)} → ${formatDateFr(to)}`
  );

  // ── KPI globaux ──
  const totalCA   = posSales.reduce((s,x) => s+x.total, 0);
  const totalQty  = posSales.reduce((s,x) => s+x.qty, 0);
  const nbTx      = posSales.length;
  const avgBasket = nbTx > 0 ? totalCA / nbTx : 0;

  const bw = 41, gap = 4, bx = 14;
  pdfKpiBox(doc, bx,           y, bw, 'CA total POS',       formatNumber(totalCA)+' DJF',   PDF_LIGHT);
  pdfKpiBox(doc, bx+bw+gap,   y, bw, 'Transactions',        String(nbTx),                   PDF_LIGHT);
  pdfKpiBox(doc, bx+(bw+gap)*2,y, bw, 'Articles vendus',   String(totalQty),                PDF_LIGHT);
  pdfKpiBox(doc, bx+(bw+gap)*3,y, bw, 'Panier moyen',      formatNumber(avgBasket)+' DJF',  PDF_LIGHT);
  y += 30;

  if (posSales.length === 0) {
    doc.setFont('helvetica','italic');
    doc.setFontSize(11);
    doc.setTextColor(150,150,160);
    doc.text('Aucune vente POS sur la période sélectionnée.', 14, y+10);
    pdfFooter(doc);
    doc.save(`TabacPro_POS_${today}.pdf`);
    showToast('Rapport POS exporté en PDF !');
    return;
  }

  // ── Construire map par terminal ──
  const termMap = {};
  posTerminals.forEach(t => {
    termMap[t.id] = { id:t.id, name:t.name, color:t.color, cashier:t.cashier||'', sales:[], total:0, qty:0 };
  });
  posSales.forEach(s => {
    const tid = s.terminalId || 'unknown';
    if (!termMap[tid]) termMap[tid] = { id:tid, name:s.terminalName||'Caisse', color:'#9ca3af', cashier:s.cashier||'', sales:[], total:0, qty:0 };
    termMap[tid].sales.push(s);
    termMap[tid].total += s.total;
    termMap[tid].qty   += s.qty;
  });
  const termList = Object.values(termMap).filter(t => t.sales.length > 0);

  // ── Synthèse par caisse ──
  y = pdfSectionTitle(doc, `Synthèse par caisse (${termList.length} caisse(s) active(s))`, y);
  y = pdfTable(doc,
    ['Caisse', 'Caissier', 'CA (DJF)', 'Transactions', 'Articles', 'Panier moyen'],
    termList.map(t => [
      t.name,
      t.cashier || '—',
      formatNumber(t.total),
      String(t.sales.length),
      String(t.qty),
      formatNumber(t.sales.length ? t.total / t.sales.length : 0),
    ]),
    y, [38, 32, 36, 26, 20, 30]
  );

  // Ligne total synthèse
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_NAVY);
  doc.text(`TOTAL POS : ${formatNumber(totalCA)} DJF — ${nbTx} transaction(s) — ${totalQty} article(s)`, 16, y);
  y += 12;

  // ── Détail par caisse (une section par terminal) ──
  termList.forEach(t => {
    if (y > 240) { doc.addPage(); y = 20; }

    // Bande colorée avec nom de la caisse
    const rgb = hexToRgb(t.color);
    doc.setFillColor(...rgb);
    doc.rect(14, y-2, 182, 9, 'F');
    doc.setTextColor(255,255,255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(9);
    doc.text(`${t.name}${t.cashier ? '  ·  Caissier : '+t.cashier : ''}  ·  ${formatNumber(t.total)} DJF  (${t.sales.length} vente(s))`, 17, y+5);
    doc.setTextColor(0,0,0);
    y += 13;

    const rows = t.sales
      .sort((a,b) => b.date.localeCompare(a.date))
      .map(s => [
        formatDateFr(s.date),
        s.productName.length > 28 ? s.productName.substring(0,26)+'…' : s.productName,
        s.client || '—',
        String(s.qty),
        formatNumber(s.price),
        formatNumber(s.total),
      ]);

    y = pdfTable(doc,
      ['Date', 'Produit', 'Client', 'Qté', 'Prix unit.', 'Total DJF'],
      rows, y, [28, 56, 38, 12, 26, 22]
    );
    y += 4;
  });

  // ── Top produits POS ──
  if (y > 230) { doc.addPage(); y = 20; }
  const byProd = {};
  posSales.forEach(s => { byProd[s.productName] = (byProd[s.productName]||0) + s.total; });
  const topProd = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,10);
  y = pdfSectionTitle(doc, 'Top produits vendus en POS', y);
  y = pdfTable(doc,
    ['#', 'Produit', 'CA (DJF)', 'Part (%)'],
    topProd.map(([name, ca], i) => [
      String(i+1),
      name,
      formatNumber(ca),
      totalCA ? String(Math.round(ca/totalCA*100))+'%' : '0%',
    ]),
    y, [10, 110, 36, 26]
  );

  pdfFooter(doc);
  doc.save(`TabacPro_Rapport_POS_${today}.pdf`);
  showToast('Rapport POS exporté en PDF !');
}

// ── 7. Export complet ──────────────────────────────────────────
async function exportAllPDF() {
  document.getElementById('pdf-dropdown').classList.remove('open');
  showToast('Génération de l\'export complet...');
  setTimeout(() => {
    exportDashboardPDF();
    setTimeout(() => exportVentesPDF(), 400);
    setTimeout(() => exportStockPDF(),  800);
  }, 100);
}

// ===== RAPPORTS MODERNES =====
let rptFrom = '', rptTo = '';

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('rpt-from').value = today.substring(0,7) + '-01';
  document.getElementById('rpt-to').value   = today;
  rptFrom = document.getElementById('rpt-from').value;
  rptTo   = today;
});

function rptSetPeriod(type, btn) {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const d = String(today.getDate()).padStart(2,'0');
  const todayStr = `${y}-${m}-${d}`;

  if (type === 'month') {
    rptFrom = `${y}-${m}-01`;
    rptTo   = todayStr;
  } else if (type === 'quarter') {
    const qStart = new Date(y, Math.floor(today.getMonth()/3)*3, 1);
    rptFrom = qStart.toISOString().split('T')[0];
    rptTo   = todayStr;
  } else if (type === 'year') {
    rptFrom = `${y}-01-01`;
    rptTo   = todayStr;
  } else if (type === 'all') {
    rptFrom = '2000-01-01';
    rptTo   = todayStr;
  } else {
    rptFrom = document.getElementById('rpt-from').value;
    rptTo   = document.getElementById('rpt-to').value;
  }

  document.getElementById('rpt-from').value = rptFrom;
  document.getElementById('rpt-to').value   = rptTo;

  // Active button
  if (btn) {
    document.querySelectorAll('.rpt-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  renderReport();
}

function renderReport() {
  if (!rptFrom || !rptTo) return;

  const filteredSales = sales.filter(s => s.date >= rptFrom && s.date <= rptTo);
  const filteredPurch = purchases.filter(p => p.date >= rptFrom && p.date <= rptTo);

  const totalVentes   = filteredSales.reduce((s,x) => s + x.total, 0);
  const totalAchats   = filteredPurch.reduce((s,x) => s + x.total, 0);
  const marge         = totalVentes - totalAchats;
  const facPayees     = invoices.filter(i => i.status === 'payee' && i.date >= rptFrom && i.date <= rptTo)
                          .reduce((s,i) => s + i.total, 0);

  // --- KPI ---
  document.getElementById('rpt-kpi-cards').innerHTML = `
    <div class="card card-blue">
      <div class="card-icon">💰</div>
      <div>
        <div class="card-label">Chiffre d'affaires</div>
        <div class="card-value">${formatNumber(totalVentes)} DJF</div>
        <div class="kpi-delta kpi-flat">${filteredSales.length} transaction(s)</div>
      </div>
    </div>
    <div class="card card-purple">
      <div class="card-icon">🛒</div>
      <div>
        <div class="card-label">Total achats</div>
        <div class="card-value">${formatNumber(totalAchats)} DJF</div>
        <div class="kpi-delta kpi-flat">${filteredPurch.length} achat(s)</div>
      </div>
    </div>
    <div class="card ${marge>=0?'card-green':'card-red'}">
      <div class="card-icon">${marge>=0?'📈':'📉'}</div>
      <div>
        <div class="card-label">Marge brute</div>
        <div class="card-value">${formatNumber(marge)} DJF</div>
        <div class="kpi-delta ${marge>=0?'kpi-up':'kpi-down'}">${totalVentes ? Math.round(marge/totalVentes*100) : 0}% du CA</div>
      </div>
    </div>
    <div class="card card-teal">
      <div class="card-icon">🧾</div>
      <div>
        <div class="card-label">Factures payées</div>
        <div class="card-value">${formatNumber(facPayees)} DJF</div>
        <div class="kpi-delta kpi-flat">${invoices.filter(i=>i.status==='payee'&&i.date>=rptFrom&&i.date<=rptTo).length} facture(s)</div>
      </div>
    </div>
  `;

  // --- GRAPHIQUES ---
  const months12 = getLast12Months();
  drawBarMonthly(months12);
  drawDonutProducts(filteredSales);
  drawBarCompare(months12);
  drawLineCumul(filteredSales);

  // --- TABLES ---
  renderTopProducts(filteredSales, totalVentes);
  renderTopClients(filteredSales);
  renderRptDetail(filteredSales);

  // Label période
  document.getElementById('rpt-period-label').textContent =
    `Du ${formatDateFr(rptFrom)} au ${formatDateFr(rptTo)}`;
  document.getElementById('rpt-period-total').textContent =
    formatNumber(totalVentes) + ' DJF';

  // Rapport POS
  renderPosSalesReport();
}

function renderPosSalesReport() {
  if (!rptFrom || !rptTo) return;

  // Ventes POS = ventes avec terminalId ou note contenant "Vente POS"
  const posSales = sales.filter(s =>
    s.date >= rptFrom && s.date <= rptTo &&
    (s.terminalId || (s.note && s.note.includes('Vente POS')))
  );

  // Mettre à jour le label période
  const periodEl = document.getElementById('rpt-pos-period');
  if (periodEl) periodEl.textContent = `Du ${formatDateFr(rptFrom)} au ${formatDateFr(rptTo)}`;

  // Construire la liste des terminaux à partir des ventes + des terminaux configurés
  const terminalMap = {};
  posTerminals.forEach(t => {
    terminalMap[t.id] = { id: t.id, name: t.name, color: t.color, cashier: t.cashier, sales: [], total: 0, qty: 0 };
  });
  // Terminaux depuis les ventes (terminaux supprimés ou renommés)
  posSales.forEach(s => {
    const tid = s.terminalId || 'unknown';
    if (!terminalMap[tid]) {
      terminalMap[tid] = { id: tid, name: s.terminalName || 'Caisse inconnue', color: '#9ca3af', cashier: s.cashier || '', sales: [], total: 0, qty: 0 };
    }
    terminalMap[tid].sales.push(s);
    terminalMap[tid].total += s.total;
    terminalMap[tid].qty   += s.qty;
  });

  const termList   = Object.values(terminalMap).filter(t => t.sales.length > 0 || posTerminals.find(x => x.id === t.id));
  const totalPosCA = termList.reduce((s, t) => s + t.total, 0);

  // --- Remplir le select filtre ---
  const sel = document.getElementById('rpt-pos-filter-terminal');
  if (sel) {
    const curVal = sel.value;
    sel.innerHTML = '<option value="">Toutes les caisses</option>' +
      posTerminals.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    sel.value = curVal;
  }

  // --- KPI cards par terminal ---
  const termGrid = document.getElementById('rpt-pos-terminals');
  if (termGrid) {
    if (posSales.length === 0) {
      termGrid.innerHTML = `<div class="rpt-pos-empty">🖥️ Aucune vente POS sur la période sélectionnée</div>`;
      const chartsRow = document.getElementById('rpt-pos-charts-row');
      if (chartsRow) chartsRow.style.display = 'none';
    } else {
      termGrid.innerHTML = termList.map(t => {
        const txCount   = t.sales.length;
        const avgBasket = txCount > 0 ? t.total / txCount : 0;
        const share     = totalPosCA > 0 ? Math.round(t.total / totalPosCA * 100) : 0;
        return `
          <div class="rpt-pos-terminal-card" style="border-left-color:${t.color}">
            <div class="rpt-pos-terminal-name">
              <div class="rpt-pos-terminal-dot" style="background:${t.color}"></div>
              ${t.name}
            </div>
            <div class="rpt-pos-ca" style="color:${t.color}">${formatNumber(t.total)} DJF</div>
            <div class="rpt-pos-share">${share}% du CA POS · ${txCount} transaction(s)</div>
            <div class="rpt-pos-kpi-grid">
              <div class="rpt-pos-kpi">
                <div class="rpt-pos-kpi-label">Articles vendus</div>
                <div class="rpt-pos-kpi-value">${t.qty}</div>
              </div>
              <div class="rpt-pos-kpi">
                <div class="rpt-pos-kpi-label">Panier moyen</div>
                <div class="rpt-pos-kpi-value">${formatNumber(avgBasket)} DJF</div>
              </div>
            </div>
            ${t.cashier ? `<div style="font-size:11px;color:#9ca3af;margin-top:2px">👤 ${t.cashier}</div>` : ''}
          </div>`;
      }).join('');

      // --- Graphiques ---
      const chartsRow = document.getElementById('rpt-pos-charts-row');
      if (chartsRow) chartsRow.style.display = '';
      const labels = termList.map(t => t.name);
      const data   = termList.map(t => t.total);
      const colors = termList.map(t => t.color);
      setTimeout(() => {
        drawBarChart('chart-pos-bar',   labels, data, colors[0]);
        drawDonutChart('chart-pos-donut', labels, data, colors);
        // Légende donut
        const leg = document.getElementById('rpt-pos-donut-legend');
        if (leg) leg.innerHTML = termList.map((t,i) => `
          <div class="donut-legend-item">
            <div class="donut-legend-dot" style="background:${t.color}"></div>
            <span>${t.name}</span>
          </div>`).join('');
      }, 60);
    }
  }

  // --- Tableau détaillé ---
  const filterTid = sel?.value || '';
  let detailSales = posSales;
  if (filterTid) detailSales = detailSales.filter(s => String(s.terminalId) === String(filterTid));
  detailSales = detailSales.sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('rpt-pos-detail-table');
  if (tbody) {
    if (detailSales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Aucune vente POS sur la période</td></tr>';
    } else {
      tbody.innerHTML = detailSales.map(s => {
        const t = terminalMap[s.terminalId] || { name: s.terminalName || '—', color: '#9ca3af' };
        return `<tr>
          <td>${formatDateFr(s.date)}</td>
          <td><span style="display:inline-flex;align-items:center;gap:5px">
            <span style="width:8px;height:8px;border-radius:50%;background:${t.color};display:inline-block"></span>
            ${t.name}
          </span></td>
          <td>${s.cashier || '—'}</td>
          <td><strong>${s.productName}</strong></td>
          <td>${s.client || '—'}</td>
          <td>${s.qty}</td>
          <td><strong>${formatNumber(s.total)} DJF</strong></td>
        </tr>`;
      }).join('');
    }
  }

  const detailTotal = detailSales.reduce((s, x) => s + x.total, 0);
  const totalEl = document.getElementById('rpt-pos-total');
  const countEl = document.getElementById('rpt-pos-count');
  if (totalEl) totalEl.textContent = formatNumber(detailTotal) + ' DJF';
  if (countEl) countEl.textContent = `${detailSales.length} transaction(s)`;
}

// ---- Helpers graphiques ----
function getLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('fr-FR', { month:'short', year:'2-digit' });
    months.push({ key, label });
  }
  return months;
}

const CHART_COLORS = ['#e8b04b','#3b82f6','#10b981','#ef4444','#8b5cf6','#14b8a6','#f97316','#ec4899'];

// BAR - Ventes mensuelles
function drawBarMonthly(months12) {
  const data = months12.map(m => {
    return sales.filter(s => s.date.startsWith(m.key)).reduce((s,x) => s + x.total, 0);
  });
  drawBarChart('chart-bar-monthly', months12.map(m=>m.label), data, '#e8b04b');
}

// DONUT - Répartition produits
function drawDonutProducts(filteredSales) {
  const byProd = {};
  filteredSales.forEach(s => {
    byProd[s.productName] = (byProd[s.productName]||0) + s.total;
  });
  const sorted = Object.entries(byProd).sort((a,b)=>b[1]-a[1]).slice(0,6);
  drawDonutChart('chart-donut-products', sorted.map(x=>x[0]), sorted.map(x=>x[1]), CHART_COLORS);

  const legend = document.getElementById('donut-legend');
  legend.innerHTML = sorted.map((x,i) => `
    <div class="donut-legend-item">
      <div class="donut-legend-dot" style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></div>
      <span>${x[0]}</span>
    </div>
  `).join('');
}

// BAR DOUBLE - Ventes vs Achats
function drawBarCompare(months12) {
  const vData = months12.map(m =>
    sales.filter(s => s.date.startsWith(m.key)).reduce((s,x) => s+x.total, 0));
  const aData = months12.map(m =>
    purchases.filter(p => p.date.startsWith(m.key)).reduce((s,x) => s+x.total, 0));
  drawDoubleBarChart('chart-bar-compare', months12.map(m=>m.label), vData, aData, '#10b981', '#e8b04b');
}

// LINE - Cumul des ventes sur la période
function drawLineCumul(filteredSales) {
  const byDay = {};
  filteredSales.forEach(s => { byDay[s.date] = (byDay[s.date]||0) + s.total; });
  const sorted = Object.entries(byDay).sort((a,b)=>a[0].localeCompare(b[0]));
  let cumul = 0;
  const labels = [], data = [];
  sorted.forEach(([date, val]) => {
    cumul += val;
    labels.push(formatDateFr(date));
    data.push(cumul);
  });
  if (labels.length === 0) { labels.push('Aucune donnée'); data.push(0); }
  drawLineChart('chart-line-cumul', labels, data, '#3b82f6');
}

// ---- Moteur Canvas ----
function drawBarChart(id, labels, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 500;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const pad = { top:20, right:16, bottom:44, left:62 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const max = Math.max(...data, 1);
  const bW  = Math.max(6, cW / labels.length - 8);

  // Grid lines
  ctx.strokeStyle = '#f0f2f5';
  ctx.lineWidth = 1;
  for (let i=0; i<=4; i++) {
    const y = pad.top + cH - (cH/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W-pad.right, y); ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'right';
    ctx.fillText(formatK(max/4*i), pad.left-6, y+4);
  }

  // Bars
  data.forEach((val, i) => {
    const x = pad.left + i*(cW/labels.length) + (cW/labels.length - bW)/2;
    const bH = (val/max) * cH;
    const y  = pad.top + cH - bH;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(x+2, y+2, bW, bH);

    // Bar gradient
    const grad = ctx.createLinearGradient(0, y, 0, y+bH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '99');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, bW, bH, 4);

    // Value
    if (val > 0) {
      ctx.fillStyle = '#555'; ctx.font = 'bold 9px Segoe UI'; ctx.textAlign = 'center';
      ctx.fillText(formatK(val), x+bW/2, y-5);
    }

    // Label
    ctx.fillStyle = '#888'; ctx.font = '10px Segoe UI'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], x+bW/2, H-pad.bottom+14);
  });
}

function drawDoubleBarChart(id, labels, data1, data2, color1, color2) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 500;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const pad = { top:30, right:16, bottom:44, left:62 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const max = Math.max(...data1, ...data2, 1);
  const slotW = cW / labels.length;
  const bW = Math.max(4, slotW/2 - 6);

  // Legend
  ctx.fillStyle = color1; ctx.fillRect(pad.left, 8, 12, 10);
  ctx.fillStyle = '#444'; ctx.font = '11px Segoe UI'; ctx.textAlign = 'left';
  ctx.fillText('Ventes', pad.left+16, 18);
  ctx.fillStyle = color2; ctx.fillRect(pad.left+80, 8, 12, 10);
  ctx.fillText('Achats', pad.left+96, 18);

  // Grid
  ctx.strokeStyle = '#f0f2f5'; ctx.lineWidth = 1;
  for (let i=0;i<=4;i++) {
    const y = pad.top + cH - (cH/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
    ctx.fillStyle='#aaa'; ctx.font='10px Segoe UI'; ctx.textAlign='right';
    ctx.fillText(formatK(max/4*i), pad.left-6, y+4);
  }

  labels.forEach((lbl,i) => {
    const x1 = pad.left + i*slotW + slotW/2 - bW - 2;
    const x2 = x1 + bW + 4;

    const h1 = (data1[i]/max)*cH; const y1 = pad.top+cH-h1;
    const h2 = (data2[i]/max)*cH; const y2 = pad.top+cH-h2;

    const g1 = ctx.createLinearGradient(0,y1,0,y1+h1);
    g1.addColorStop(0,color1); g1.addColorStop(1,color1+'88');
    ctx.fillStyle = g1; roundRect(ctx,x1,y1,bW,h1,3);

    const g2 = ctx.createLinearGradient(0,y2,0,y2+h2);
    g2.addColorStop(0,color2); g2.addColorStop(1,color2+'88');
    ctx.fillStyle = g2; roundRect(ctx,x2,y2,bW,h2,3);

    ctx.fillStyle='#888'; ctx.font='10px Segoe UI'; ctx.textAlign='center';
    ctx.fillText(lbl, pad.left+i*slotW+slotW/2, H-pad.bottom+14);
  });
}

function drawDonutChart(id, labels, data, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 300;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const total = data.reduce((s,v)=>s+v,0);
  if (total === 0) {
    ctx.fillStyle = '#ddd';
    ctx.beginPath(); ctx.arc(W/2,H/2,H/2-20,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#aaa'; ctx.font='13px Segoe UI'; ctx.textAlign='center';
    ctx.fillText('Aucune donnée', W/2, H/2+5);
    return;
  }

  const cx=W/2, cy=H/2, R=Math.min(W,H)/2-16, r=R*0.52;
  let angle = -Math.PI/2;

  data.forEach((val,i) => {
    const slice = (val/total)*Math.PI*2;
    const color = colors[i%colors.length];
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,angle,angle+slice);
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
    angle += slice;
  });

  // Centre hole + texte
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle='white'; ctx.fill();
  ctx.fillStyle='#1a1a2e'; ctx.font='bold 15px Segoe UI'; ctx.textAlign='center';
  ctx.fillText(formatK(total), cx, cy-2);
  ctx.fillStyle='#888'; ctx.font='10px Segoe UI';
  ctx.fillText('DJF total', cx, cy+14);
}

function drawLineChart(id, labels, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth || 500;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  const pad = { top:20, right:16, bottom:40, left:62 };
  const cW = W-pad.left-pad.right;
  const cH = H-pad.top-pad.bottom;

  const max = Math.max(...data, 1);

  // Grid
  ctx.strokeStyle='#f0f2f5'; ctx.lineWidth=1;
  for (let i=0;i<=4;i++) {
    const y = pad.top + cH - (cH/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
    ctx.fillStyle='#aaa'; ctx.font='10px Segoe UI'; ctx.textAlign='right';
    ctx.fillText(formatK(max/4*i), pad.left-6, y+4);
  }

  const pts = data.map((v,i)=>({
    x: pad.left + (i/(data.length-1||1))*cW,
    y: pad.top + cH - (v/max)*cH
  }));

  // Area fill
  const grad = ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
  grad.addColorStop(0, color+'44');
  grad.addColorStop(1, color+'00');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pad.top+cH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, pad.top+cH);
  ctx.closePath(); ctx.fillStyle=grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle=color; ctx.lineWidth=2.5; ctx.lineJoin='round';
  ctx.stroke();

  // Dots + labels (max 12)
  const step = Math.max(1, Math.floor(labels.length/12));
  pts.forEach((p,i) => {
    if (i % step === 0 || i === pts.length-1) {
      ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2);
      ctx.fillStyle='white'; ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=2; ctx.stroke();

      ctx.fillStyle='#888'; ctx.font='9px Segoe UI'; ctx.textAlign='center';
      const lbl = labels[i].length > 8 ? labels[i].substring(0,7) : labels[i];
      ctx.fillText(lbl, p.x, H-pad.bottom+12);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, h/2, w/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w,y, x+w,y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w,y+h, x+w-r,y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x,y+h, x,y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x,y, x+r,y, r);
  ctx.closePath(); ctx.fill();
}

function formatK(n) {
  n = Math.round(n);
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000)    return (n/1000).toFixed(0)+'k';
  return String(n);
}

// ---- Tables rapports ----
function renderTopProducts(filteredSales, totalVentes) {
  const byProd = {};
  filteredSales.forEach(s => {
    if (!byProd[s.productName]) byProd[s.productName] = { qty:0, total:0 };
    byProd[s.productName].qty   += s.qty;
    byProd[s.productName].total += s.total;
  });
  const sorted = Object.entries(byProd).sort((a,b)=>b[1].total-a[1].total).slice(0,5);
  const max = sorted[0]?.[1].total || 1;

  document.getElementById('rpt-top-products').innerHTML = sorted.length ? sorted.map(([name,d],i) => {
    const pct = totalVentes ? Math.round(d.total/totalVentes*100) : 0;
    return `<tr>
      <td><strong>#${i+1}</strong></td>
      <td>${name}</td>
      <td>${d.qty}</td>
      <td><strong>${formatNumber(d.total)} DJF</strong></td>
      <td>
        <div class="rpt-bar-wrap">
          <div class="rpt-bar-track"><div class="rpt-bar-fill" style="width:${Math.round(d.total/max*100)}%"></div></div>
          <span class="rpt-bar-pct">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">Aucune donnée</td></tr>';
}

function renderTopClients(filteredSales) {
  const byClient = {};
  filteredSales.forEach(s => {
    const k = s.client || '(Anonyme)';
    if (!byClient[k]) byClient[k] = { count:0, total:0 };
    byClient[k].count++;
    byClient[k].total += s.total;
  });
  const sorted = Object.entries(byClient).sort((a,b)=>b[1].total-a[1].total).slice(0,5);

  document.getElementById('rpt-top-clients').innerHTML = sorted.length ? sorted.map(([name,d],i) => `
    <tr>
      <td><strong>#${i+1}</strong></td>
      <td>${name}</td>
      <td>${d.count}</td>
      <td><strong>${formatNumber(d.total)} DJF</strong></td>
    </tr>
  `).join('') : '<tr><td colspan="4" class="empty">Aucune donnée</td></tr>';
}

function renderRptDetail(filteredSales) {
  const sorted = [...filteredSales].sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('rpt-detail-table').innerHTML = sorted.length ? sorted.map(s => `
    <tr>
      <td>${formatDateFr(s.date)}</td>
      <td>${s.productName}</td>
      <td>${s.client||'-'}</td>
      <td>${s.qty}</td>
      <td>${formatNumber(s.price)} DJF</td>
      <td><strong>${formatNumber(s.total)} DJF</strong></td>
    </tr>
  `).join('') : '<tr><td colspan="6" class="empty">Aucune vente dans cette période</td></tr>';
}

// ===== MODAL =====
function confirmDelete() {
  if (!deleteTarget) return;

  if (deleteTarget.type === 'sale') {
    const s = sales.find(x => x.id === deleteTarget.id);
    sales = sales.filter(s => s.id !== deleteTarget.id);
    saveSales();
    if (s) addLog('suppression', 'Vente supprimée', `${s.productName} — ${formatNumber(s.total)} DJF (${formatDateFr(s.date)})`);
    renderSalesTable();
    renderRecentSales();
    renderStockTable();
    updateStats();
    checkStockAlerts();
    showToast('Vente supprimée.');
  } else if (deleteTarget.type === 'product') {
    const p = products.find(x => x.id === deleteTarget.id);
    products = products.filter(p => p.id !== deleteTarget.id);
    saveProducts();
    if (p) addLog('suppression', 'Produit supprimé', `${p.name} (${p.category})`);
    renderProductSelect();
    renderProductsTable();
    renderStockTable();
    showToast('Produit supprimé.');
  } else if (deleteTarget.type === 'purchase') {
    const p = purchases.find(x => x.id === deleteTarget.id);
    purchases = purchases.filter(p => p.id !== deleteTarget.id);
    savePurchases();
    if (p) addLog('suppression', 'Achat supprimé', `${p.productName} × ${p.qty} — ${formatNumber(p.total)} DJF`);
    renderPurchasesTable();
    renderStockTable();
    updateStats();
    checkStockAlerts();
    showToast('Achat supprimé.');
  } else if (deleteTarget.type === 'invoice') {
    const inv = invoices.find(x => x.id === deleteTarget.id);
    invoices = invoices.filter(i => i.id !== deleteTarget.id);
    saveInvoices();
    if (inv) addLog('suppression', 'Facture supprimée', `${inv.number} — Client : ${inv.client.name}`);
    renderInvoicesTable();
    updateStats();
    showToast('Facture supprimée.');
  }

  deleteTarget = null;
  closeModal();
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

// ===== UTILS =====
function formatNumber(n) {
  return Math.round(n).toLocaleString('fr-FR');
}

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const months = ['jan','fév','mar','avr','mai','juin','juil','août','sep','oct','nov','déc'];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; background:#1a1a2e; color:white;
    padding:14px 22px; border-radius:10px; font-size:14px; font-weight:600;
    box-shadow:0 4px 20px rgba(0,0,0,0.2); z-index:999; animation:fadeIn 0.3s ease;
  `;
  toast.textContent = '✓ ' + msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
