// ============ УТИЛИТЫ (должны быть в самом начале!) ============
function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// ============ КОНСТАНТЫ ============
const CONFIG = {
  MAX_AVATAR_SIZE: 100 * 1024,
  MAX_SOUND_SIZE: 500 * 1024,
  SAVE_DEBOUNCE_MS: 400,
  TOAST_DURATION_MS: 2500,
  FOCUS_RESTORE_DELAY_MS: 50,
  STORAGE_RETRY_MS: 1000,
  SEARCH_DEBOUNCE_MS: 120,
};

// ============ ПРЕСЕТЫ ТЕМ ============
const PRESETS = [
  { id: 'classic', name: 'Classic Dark', icon: '🌌', desc: 'Default purple-violet', theme: { bg: 'rgba(20, 22, 30, 0.98)', text: 'rgba(255, 255, 255, 0.88)', accent1: '#667eea', accent2: '#764ba2' }, opacity: 0.96 },
  { id: 'matrix', name: 'Matrix', icon: '💚', desc: 'Hacker green on black', theme: { bg: 'rgba(0, 8, 0, 0.98)', text: '#00ff41', accent1: '#00ff41', accent2: '#008f11' }, opacity: 0.95 },
  { id: 'blood-moon', name: 'Blood Moon', icon: '🩸', desc: 'Red for PvP servers', theme: { bg: 'rgba(25, 10, 10, 0.98)', text: 'rgba(255, 230, 230, 0.9)', accent1: '#ef4444', accent2: '#991b1b' }, opacity: 0.96 },
  { id: 'ice-blue', name: 'Ice Blue', icon: '❄️', desc: 'Cold blue tones', theme: { bg: 'rgba(10, 20, 35, 0.98)', text: 'rgba(220, 240, 255, 0.9)', accent1: '#38bdf8', accent2: '#0369a1' }, opacity: 0.96 },
  { id: 'sunset', name: 'Sunset', icon: '🌅', desc: 'Warm orange-pink', theme: { bg: 'rgba(30, 15, 20, 0.98)', text: 'rgba(255, 240, 230, 0.9)', accent1: '#fb923c', accent2: '#db2777' }, opacity: 0.96 },
  { id: 'forest', name: 'Forest', icon: '🌲', desc: 'Natural green', theme: { bg: 'rgba(15, 25, 15, 0.98)', text: 'rgba(230, 250, 230, 0.9)', accent1: '#4ade80', accent2: '#166534' }, opacity: 0.96 },
  { id: 'midnight', name: 'Midnight', icon: '🌙', desc: 'Deep blue night', theme: { bg: 'rgba(5, 10, 25, 0.98)', text: 'rgba(200, 220, 255, 0.9)', accent1: '#818cf8', accent2: '#3730a3' }, opacity: 0.97 },
  { id: 'cyberpunk', name: 'Cyberpunk', icon: '⚡', desc: 'Neon pink & cyan', theme: { bg: 'rgba(15, 5, 25, 0.98)', text: 'rgba(255, 230, 255, 0.95)', accent1: '#f472b6', accent2: '#22d3ee' }, opacity: 0.95 },
  { id: 'amber', name: 'Amber CRT', icon: '🔶', desc: 'Retro amber terminal', theme: { bg: 'rgba(20, 12, 0, 0.98)', text: '#fbbf24', accent1: '#fbbf24', accent2: '#92400e' }, opacity: 0.96 },
  { id: 'minimal', name: 'Minimal', icon: '⚪', desc: 'Clean & subtle', theme: { bg: 'rgba(25, 25, 28, 0.98)', text: 'rgba(230, 230, 235, 0.85)', accent1: '#a1a1aa', accent2: '#52525b' }, opacity: 0.97 },
  { id: 'high-contrast', name: 'High Contrast', icon: '🔳', desc: 'Maximum readability', theme: { bg: 'rgba(0, 0, 0, 1)', text: '#ffffff', accent1: '#ffff00', accent2: '#00ffff' }, opacity: 1 },
  { id: 'royal', name: 'Royal Gold', icon: '👑', desc: 'Luxury gold & purple', theme: { bg: 'rgba(20, 10, 30, 0.98)', text: 'rgba(255, 240, 220, 0.92)', accent1: '#fbbf24', accent2: '#7c3aed' }, opacity: 0.96 },
];

let customPresets = [];
let activePresetId = null;

async function loadCustomPresets() {
  try {
    const data = await chrome.storage.local.get(['customPresets', 'activePresetId']);
    customPresets = data.customPresets || [];
    activePresetId = data.activePresetId || null;
  } catch (e) {
    customPresets = [];
  }
}

function renderPresets() {
  const grid = document.getElementById('presets-grid');
  if (grid) {
    grid.innerHTML = '';
    PRESETS.forEach(preset => grid.appendChild(createPresetCard(preset, false)));
  }
  
  const customSection = document.getElementById('custom-presets-section');
  const customGrid = document.getElementById('custom-presets-grid');
  
  if (customPresets.length > 0 && customSection && customGrid) {
    customSection.style.display = 'block';
    customGrid.innerHTML = '';
    customPresets.forEach(preset => customGrid.appendChild(createPresetCard(preset, true)));
  } else if (customSection) {
    customSection.style.display = 'none';
  }
}

function createPresetCard(preset, isCustom) {
  const card = document.createElement('div');
  card.className = 'preset-card' + (activePresetId === preset.id ? ' active' : '');
  card.dataset.presetId = preset.id;
  
  const { bg, text, accent1, accent2 } = preset.theme;
  
  card.innerHTML = `
    ${isCustom ? `<button type="button" class="preset-delete" title="Delete">✕</button>` : ''}
    <div class="preset-preview" style="background: ${bg};">
      <div class="preset-preview-bar">
        <div class="preset-preview-dot" style="background: ${accent1};"></div>
        <div class="preset-preview-dot" style="background: ${accent2};"></div>
        <div class="preset-preview-dot" style="background: ${text}; opacity:0.3;"></div>
      </div>
      <div class="preset-preview-line" style="background: ${text}; width: 70%;"></div>
      <div class="preset-preview-line" style="background: ${accent1}; width: 50%;"></div>
      <div class="preset-preview-line" style="background: ${text}; width: 85%; opacity:0.5;"></div>
    </div>
    <div class="preset-name">${preset.icon} ${escapeHtml(preset.name)}</div>
    <div class="preset-desc">${escapeHtml(preset.desc || '')}</div>
  `;
  
  card.addEventListener('click', (e) => {
    if (e.target.classList.contains('preset-delete')) return;
    applyPreset(preset);
  });
  
  if (isCustom) {
    card.querySelector('.preset-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustomPreset(preset.id);
    });
  }
  
  return card;
}

function applyPreset(preset) {
  theme = {
    bg: preset.theme.bg,
    text: preset.theme.text,
    textSecondary: 'rgba(255,255,255,0.7)',
    accent1: preset.theme.accent1,
    accent2: preset.theme.accent2,
  };
  
  const match = preset.theme.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    document.getElementById('bg-color').value = rgbToHex(+match[1], +match[2], +match[3]);
    document.getElementById('bg-alpha').value = match[4] ?? 0.96;
  }
  
  const textColor = preset.theme.text;
  if (textColor && textColor.startsWith('#')) {
    document.getElementById('text-color').value = textColor;
  } else {
    document.getElementById('text-color').value = '#e4e4e7';
  }
  
  if (preset.opacity !== undefined) {
    document.getElementById('opacity').value = preset.opacity;
    document.getElementById('opacity-val').textContent = Math.round(preset.opacity * 100) + '%';
  }
  
  activePresetId = preset.id;
  save();
  chrome.storage.local.set({ activePresetId: preset.id });
  
  document.querySelectorAll('.preset-card').forEach(c => {
    c.classList.toggle('active', c.dataset.presetId === preset.id);
  });
  
  toast(`Applied: ${preset.icon} ${preset.name}`, 'success');
}

async function saveCurrentAsPreset() {
  const name = prompt('Preset name:', `My preset ${customPresets.length + 1}`);
  if (!name) return;
  
  const bgHex = document.getElementById('bg-color')?.value || '#14161e';
  const bgAlpha = document.getElementById('bg-alpha')?.value || 0.96;
  const textColor = document.getElementById('text-color')?.value || '#e4e4e7';
  
  customPresets.push({
    id: 'custom_' + uid(),
    name,
    icon: '⭐',
    desc: 'Your custom preset',
    theme: {
      bg: hexToRgba(bgHex, bgAlpha),
      text: textColor,
      accent1: '#667eea',
      accent2: '#764ba2',
    },
    opacity: parseFloat(document.getElementById('opacity')?.value || 0.96),
  });
  
  await chrome.storage.local.set({ customPresets });
  renderPresets();
  toast('Preset saved', 'success');
}

async function deleteCustomPreset(id) {
  if (!await confirmAsync('Delete preset', 'Delete this custom preset?')) return;
  
  customPresets = customPresets.filter(p => p.id !== id);
  await chrome.storage.local.set({ customPresets });
  
  if (activePresetId === id) {
    activePresetId = null;
    await chrome.storage.local.set({ activePresetId: null });
  }
  
  renderPresets();
  toast('Preset deleted', 'info');
}

// ============ LIVE PREVIEW ТЕМЫ ============
function updateThemePreview() {
  const preview = document.getElementById('theme-preview');
  if (!preview) return;
  
  const fontFamily = document.getElementById('font-family')?.value || "'SF Mono', monospace";
  const fontSize = document.getElementById('font-size')?.value || 11.5;
  const lineHeight = document.getElementById('line-height')?.value || 1.4;
  const letterSpacing = document.getElementById('letter-spacing')?.value || 0;
  const fontBold = document.getElementById('font-bold')?.checked || false;
  
  preview.style.fontFamily = fontFamily;
  preview.style.fontSize = fontSize + 'px';
  preview.style.lineHeight = lineHeight;
  preview.style.letterSpacing = letterSpacing + 'px';
  preview.style.fontWeight = fontBold ? '600' : 'normal';
  
  const textColor = document.getElementById('text-color')?.value || '#e4e4e7';
  preview.querySelectorAll('.preview-text').forEach(el => el.style.color = textColor);
  
  const borderWidth = document.getElementById('border-width')?.value || 3;
  const borderRadius = document.getElementById('border-radius')?.value || 3;
  const borderStyle = document.getElementById('border-style')?.value || 'solid';
  
  preview.querySelectorAll('.preview-line').forEach(line => {
    line.style.borderLeftWidth = borderWidth + 'px';
    line.style.borderLeftStyle = borderStyle;
    line.style.borderRadius = borderRadius + 'px';
  });
  
  const errorBg = document.getElementById('error-bg-color')?.value || '#ef4444';
  const errorAlpha = document.getElementById('error-bg-alpha')?.value || 0.08;
  const warnBg = document.getElementById('warn-bg-color')?.value || '#facc15';
  const warnAlpha = document.getElementById('warn-bg-alpha')?.value || 0.08;
  const hoverBg = document.getElementById('hover-bg-color')?.value || '#ffffff';
  const hoverAlpha = document.getElementById('hover-bg-alpha')?.value || 0.05;
  
  const errorLine = preview.querySelector('.preview-error');
  const warnLine = preview.querySelector('.preview-warn');
  const hoverLine = preview.querySelector('.preview-hover');
  
  if (errorLine) errorLine.style.background = hexToRgba(errorBg, errorAlpha);
  if (warnLine) warnLine.style.background = hexToRgba(warnBg, warnAlpha);
  if (hoverLine) hoverLine.style.background = hexToRgba(hoverBg, hoverAlpha);
}

// ============ СОХРАНЕНИЕ РАСШИРЕННЫХ НАСТРОЕК ============
function getExtendedTheme() {
  return {
    fontFamily: document.getElementById('font-family')?.value || "'SF Mono', monospace",
    fontSize: parseFloat(document.getElementById('font-size')?.value || 11.5),
    lineHeight: parseFloat(document.getElementById('line-height')?.value || 1.4),
    letterSpacing: parseFloat(document.getElementById('letter-spacing')?.value || 0),
    fontBold: document.getElementById('font-bold')?.checked || false,
    borderWidth: parseInt(document.getElementById('border-width')?.value || 3),
    borderRadius: parseInt(document.getElementById('border-radius')?.value || 3),
    borderStyle: document.getElementById('border-style')?.value || 'solid',
    errorBg: document.getElementById('error-bg-color')?.value || '#ef4444',
    errorBgAlpha: parseFloat(document.getElementById('error-bg-alpha')?.value || 0.08),
    warnBg: document.getElementById('warn-bg-color')?.value || '#facc15',
    warnBgAlpha: parseFloat(document.getElementById('warn-bg-alpha')?.value || 0.08),
    hoverBg: document.getElementById('hover-bg-color')?.value || '#ffffff',
    hoverBgAlpha: parseFloat(document.getElementById('hover-bg-alpha')?.value || 0.05),
  };
}

function applyExtendedTheme(ext) {
  if (!ext) return;
  
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  const setChecked = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = val;
  };
  
  setVal('font-family', ext.fontFamily);
  setVal('font-size', ext.fontSize);
  setVal('line-height', ext.lineHeight);
  setVal('letter-spacing', ext.letterSpacing);
  setChecked('font-bold', ext.fontBold);
  setVal('border-width', ext.borderWidth);
  setVal('border-radius', ext.borderRadius);
  setVal('border-style', ext.borderStyle);
  setVal('error-bg-color', ext.errorBg);
  setVal('error-bg-alpha', ext.errorBgAlpha);
  setVal('warn-bg-color', ext.warnBg);
  setVal('warn-bg-alpha', ext.warnBgAlpha);
  setVal('hover-bg-color', ext.hoverBg);
  setVal('hover-bg-alpha', ext.hoverBgAlpha);
  
  document.getElementById('font-size-val').textContent = ext.fontSize + 'px';
  document.getElementById('line-height-val').textContent = ext.lineHeight;
  document.getElementById('letter-spacing-val').textContent = ext.letterSpacing + 'px';
  document.getElementById('border-width-val').textContent = ext.borderWidth + 'px';
  document.getElementById('border-radius-val').textContent = ext.borderRadius + 'px';
  
  updateThemePreview();
}

// ============ СОСТОЯНИЕ ============
let servers = [], triggers = [], filters = [], blacklist = [], theme = {}, ai = {};
let currentLang = 'en';
let pendingImport = null;
let soundsCache = [];
let saveTimer = null;
let focusState = null;

// ============ УТИЛИТЫ ============
const escapeAttr = s => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeHtml = s => (s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

function isValidUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str.startsWith('http') ? str : `http://${str}`);
    return ['http:', 'https:'].includes(u.protocol);
  } catch { return false; }
}

function isValidTcpAddr(str) {
  if (!str) return false;
  const m = str.match(/^(\d{1,3}\.){3}\d{1,3}:\d{1,5}$/);
  return !!m;
}

// ============ TOAST СИСТЕМА ============
function toast(message, type = 'info', duration = CONFIG.TOAST_DURATION_MS) {
  const container = document.getElementById('toast-container');
  if (!container) {
    const s = document.getElementById('status');
    if (s) { s.classList.add('show'); setTimeout(() => s.classList.remove('show'), duration); }
    return;
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'alert');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ============ CONFIRM МОДАЛКА ============
function confirmAsync(title, message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) { resolve(confirm(message)); return; }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    modal.classList.add('show');
    
    const cleanup = (result) => {
      modal.classList.remove('show');
      document.getElementById('modal-confirm').onclick = null;
      document.getElementById('modal-cancel').onclick = null;
      resolve(result);
    };
    document.getElementById('modal-confirm').onclick = () => cleanup(true);
    document.getElementById('modal-cancel').onclick = () => cleanup(false);
  });
}

// ============ ФОКУС ============
function captureFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const card = el.closest('.server-card, .log-item, .alert-item, .sound-item, .row');
  if (!card) return null;
  return {
    element: el,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
    card,
    tagName: el.tagName,
    type: el.type,
  };
}

function restoreFocus(state) {
  if (!state || !state.element) return;
  setTimeout(() => {
    try {
      state.element.focus();
      if (state.element.setSelectionRange && state.selectionStart != null) {
        state.element.setSelectionRange(state.selectionStart, state.selectionEnd);
      }
    } catch (e) { /* ignore */ }
  }, CONFIG.FOCUS_RESTORE_DELAY_MS);
}

// ============ DEBOUNCE SAVE ============
function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, CONFIG.SAVE_DEBOUNCE_MS);
}

async function doSave() {
  const validServers = servers.map(s => ({
    ...s,
    logs: (s.logs || []).filter(l => l.name && l.url),
    alerts: {
      ...s.alerts,
      triggerAlerts: (s.alerts?.triggerAlerts || []).filter(t => t.word)
    }
  })).filter(s => s.name);
  
  const bgHex = document.getElementById('bg-color')?.value || '#14161e';
  const bgAlpha = document.getElementById('bg-alpha')?.value || 0.96;
  theme = {
    bg: hexToRgba(bgHex, bgAlpha),
    text: document.getElementById('text-color')?.value || '#e4e4e7',
    textSecondary: '#a1a1aa',
    extended: getExtendedTheme(),
  };
  
  try {
    await chrome.storage.sync.set({
      servers: validServers,
      triggers: triggers.filter(t => t.word),
      filters,
      blacklist: blacklist.filter(b => b.word),
      theme,
      ai,
      lang: currentLang
    });
    
    const opacity = parseFloat(document.getElementById('opacity')?.value || 0.96);
    await chrome.storage.local.set({ opacity, lang: currentLang });
    
    showStatus();
  } catch (e) {
    console.error('[save] failed:', e);
    toast('Save failed: ' + e.message, 'error');
  }
}

function showStatus() {
  const s = document.getElementById('status');
  if (!s) return;
  s.classList.add('show');
  setTimeout(() => s.classList.remove('show'), 1500);
}

// ============ ЗВУКИ ============
async function loadSounds() {
  try {
    const data = await chrome.storage.local.get(['customSounds']);
    soundsCache = data.customSounds || [];
  } catch (e) {
    console.error('[sounds] load failed:', e);
    soundsCache = [];
  }
  return soundsCache;
}

async function addSound(file) {
  if (file.size > CONFIG.MAX_SOUND_SIZE) {
    toast(`Max ${Math.round(CONFIG.MAX_SOUND_SIZE/1024)}KB`, 'error');
    return null;
  }
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const sound = { id: 'cs_' + uid(), name: file.name, data: ev.target.result };
      soundsCache.push(sound);
      try {
        await chrome.storage.local.set({ customSounds: soundsCache });
        resolve(sound);
      } catch (e) {
        toast('Failed to save sound', 'error');
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function removeSound(id) {
  soundsCache = soundsCache.filter(s => s.id !== id);
  await chrome.storage.local.set({ customSounds: soundsCache });
}

function renderSoundOptions(selectEl, selectedId) {
  selectEl.innerHTML = `<option value="none">${t('alerts.noSound', currentLang)}</option>` +
    soundsCache.map(s => `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

function switchSection(name) {
  document.querySelectorAll('.tab-nav').forEach(t => {
    const isActive = t.dataset.tab === name;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.section').forEach(s => s.classList.toggle('active', s.dataset.section === name));
}

// ============ РЕНДЕР СЕРВЕРОВ ============
function renderServers() {
  const focus = captureFocus();
  const list = document.getElementById('servers-list');
  list.innerHTML = '';
  
  if (!servers.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🛰️</div>${t('srv.noServers', currentLang)}</div>`;
    restoreFocus(focus);
    return;
  }
  
  servers.forEach((server, si) => list.appendChild(buildServerCard(server, si)));
  restoreFocus(focus);
}

function buildServerCard(server, si) {
  const card = document.createElement('div');
  card.className = 'server-card';
  card.dataset.serverId = server.id;
  card.draggable = true;
  
  const avatarRow = document.createElement('div');
  avatarRow.className = 'row';
  avatarRow.style.alignItems = 'center';
  
  const avatarPreview = document.createElement('div');
  avatarPreview.className = 'server-avatar-preview';
  updateAvatarPreview(avatarPreview, server);
  
  const avatarInput = document.createElement('input');
  avatarInput.type = 'file';
  avatarInput.accept = 'image/*';
  avatarInput.style.cssText = 'font-size:11px;flex:1;';
  avatarInput.setAttribute('aria-label', 'Upload avatar');
  
  const removeAvatarBtn = document.createElement('button');
  removeAvatarBtn.type = 'button';
  removeAvatarBtn.className = 'btn-ghost mini-btn';
  removeAvatarBtn.textContent = '✕';
  removeAvatarBtn.title = 'Remove avatar';
  removeAvatarBtn.style.display = server.avatar ? '' : 'none';
  
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > CONFIG.MAX_AVATAR_SIZE) {
      toast(`Max ${Math.round(CONFIG.MAX_AVATAR_SIZE/1024)}KB`, 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      server.avatar = reader.result;
      updateAvatarPreview(avatarPreview, server);
      removeAvatarBtn.style.display = '';
      save();
    };
    reader.readAsDataURL(file);
  });
  
  removeAvatarBtn.addEventListener('click', () => {
    server.avatar = null;
    updateAvatarPreview(avatarPreview, server);
    removeAvatarBtn.style.display = 'none';
    avatarInput.value = '';
    save();
  });
  
  avatarRow.append(avatarPreview, avatarInput, removeAvatarBtn);
  card.appendChild(avatarRow);
  
  const header = document.createElement('div');
  header.className = 'server-card-header';
  
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = server.name || '';
  nameInput.placeholder = t('srv.name', currentLang);
  nameInput.style.flex = '1';
  nameInput.setAttribute('aria-label', 'Server name');
  nameInput.addEventListener('input', e => {
    server.name = e.target.value;
    if (!server.avatar) updateAvatarPreview(avatarPreview, server);
    save();
  });
  
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn-danger mini-btn';
  delBtn.textContent = '🗑️ ' + t('srv.delete', currentLang);
  delBtn.addEventListener('click', async () => {
    if (await confirmAsync('Delete server', t('srv.confirmDelete', currentLang))) {
      servers.splice(si, 1);
      renderServers();
      save();
    }
  });
  
  header.append(nameInput, delBtn);
  card.appendChild(header);
  
  card.appendChild(buildPingSection(server));
  card.appendChild(buildLogsSection(server));
  card.appendChild(buildAlertsSection(server, si));
  
  setupDragHandlers(card, si);
  
  return card;
}

function updateAvatarPreview(el, server) {
  if (server.avatar) {
    el.innerHTML = `<img src="${server.avatar}" style="width:100%;height:100%;object-fit:cover;" alt="">`;
  } else {
    el.textContent = (server.name || '?').charAt(0).toUpperCase();
  }
}

function buildPingSection(server) {
  const section = document.createElement('div');
  section.className = 'sub-section';
  section.innerHTML = `<div class="sub-title">📡 ${t('srv.ping', currentLang)}</div>`;

  if (!server.ping) server.ping = { enabled: false, url: '', interval: 30, timeout: 5, type: 'http', dangerMs: 1000 };

  const row = document.createElement('div');
  row.className = 'row';

  const enableCb = document.createElement('input');
  enableCb.type = 'checkbox';
  enableCb.checked = server.ping.enabled;
  const enableLabel = document.createElement('span');
  enableLabel.style.fontSize = '11px';
  enableLabel.textContent = t('ping.enabled', currentLang);
  const enableWrap = document.createElement('div');
  enableWrap.className = 'checkbox-row';
  enableWrap.append(enableCb, enableLabel);

  const typeSelect = document.createElement('select');
  typeSelect.style.minWidth = '100px';
  typeSelect.innerHTML = `
    <option value="http" ${server.ping.type === 'http' ? 'selected' : ''}>HTTP</option>
    <option value="tcp" ${server.ping.type === 'tcp' ? 'selected' : ''}>TCP (IP:PORT)</option>
  `;

  const urlInput = document.createElement('input');
  urlInput.type = 'text';
  urlInput.placeholder = server.ping.type === 'tcp' ? '89.248.193.233:4455' : 'http://server/status';
  urlInput.value = server.ping.url;
  urlInput.style.flex = '2';

  const intervalInput = document.createElement('input');
  intervalInput.type = 'number';
  intervalInput.placeholder = t('ping.interval', currentLang);
  intervalInput.value = server.ping.interval;
  intervalInput.min = '5'; intervalInput.max = '3600';
  intervalInput.style.width = '80px';

  const timeoutInput = document.createElement('input');
  timeoutInput.type = 'number';
  timeoutInput.placeholder = t('ping.timeout', currentLang);
  timeoutInput.value = server.ping.timeout;
  timeoutInput.min = '1'; timeoutInput.max = '30';
  timeoutInput.style.width = '80px';

  const dangerInput = document.createElement('input');
  dangerInput.type = 'number';
  dangerInput.placeholder = 'Danger (ms)';
  dangerInput.value = server.ping.dangerMs || 1000;
  dangerInput.min = '50'; dangerInput.max = '30000';
  dangerInput.style.width = '100px';
  dangerInput.title = 'Ping above this value will be shown as warning (yellow)';

  enableCb.addEventListener('change', e => {
    server.ping.enabled = e.target.checked;
    save();
    chrome.runtime.sendMessage({ action: 'reschedulePings' }).catch(() => {});
  });

  typeSelect.addEventListener('change', e => {
    server.ping.type = e.target.value;
    urlInput.placeholder = server.ping.type === 'tcp' ? '89.248.193.233:4455' : 'http://server/status';
    save();
  });

  urlInput.addEventListener('input', e => { server.ping.url = e.target.value; save(); });
  
  intervalInput.addEventListener('input', e => {
    server.ping.interval = Math.max(5, Math.min(3600, parseInt(e.target.value) || 30));
    save();
    chrome.runtime.sendMessage({ action: 'reschedulePings' }).catch(() => {});
  });
  
  timeoutInput.addEventListener('input', e => {
    server.ping.timeout = Math.max(1, Math.min(30, parseInt(e.target.value) || 5));
    save();
  });
  
  dangerInput.addEventListener('input', e => {
    server.ping.dangerMs = Math.max(50, Math.min(30000, parseInt(e.target.value) || 1000));
    save();
  });

  row.append(enableWrap, typeSelect, urlInput, intervalInput, timeoutInput, dangerInput);
  section.appendChild(row);

  const hint = document.createElement('div');
  hint.className = 'danger-threshold-hint';
  hint.innerHTML = `🟢 Online &nbsp;|&nbsp; 🟡 Danger (>${server.ping.dangerMs || 1000}ms) &nbsp;|&nbsp; 🔴 Offline/Timeout`;
  section.appendChild(hint);

  return section;
}

function buildLogsSection(server) {
  const section = document.createElement('div');
  section.className = 'sub-section';
  if (!server.logs) server.logs = [];
  section.innerHTML = `<div class="sub-title">📜 ${t('srv.logs', currentLang)} (${server.logs.length})</div>`;
  
  const list = document.createElement('div');
  server.logs.forEach((log, li) => {
    if (!log.interval) log.interval = 10;
    
    const item = document.createElement('div');
    item.className = 'log-item';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = t('opt.word', currentLang);
    nameInput.value = log.name;
    nameInput.style.maxWidth = '120px';
    
    const urlInput = document.createElement('input');
    urlInput.type = 'url';
    urlInput.placeholder = 'http://.../log.log';
    urlInput.value = log.url;
    urlInput.style.flex = '2';
    
    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.placeholder = 'Interval (s)';
    intervalInput.value = log.interval;
    intervalInput.min = '1';
    intervalInput.max = '300';
    intervalInput.style.width = '80px';
    intervalInput.title = 'Log refresh interval in seconds';
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger mini-btn';
    delBtn.textContent = '✕';
    
    nameInput.addEventListener('input', e => { log.name = e.target.value; save(); });
    urlInput.addEventListener('input', e => {
      log.url = e.target.value;
      urlInput.style.borderColor = !e.target.value || isValidUrl(e.target.value) ? '' : 'var(--danger, #ef4444)';
      save();
    });
    
    intervalInput.addEventListener('input', e => {
      log.interval = Math.max(1, Math.min(300, parseInt(e.target.value) || 10));
      save();
      // Сохранение через chrome.storage автоматически триггерит sidepanel.onChanged → startAutoRefresh()
    });
    
    delBtn.addEventListener('click', () => {
      server.logs.splice(li, 1);
      renderServers();
      save();
    });
    
    item.append(nameInput, urlInput, intervalInput, delBtn);
    list.appendChild(item);
  });
  section.appendChild(list);
  
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'btn-ghost mini-btn';
  addBtn.textContent = t('srv.addLog', currentLang);
  addBtn.addEventListener('click', () => {
    server.logs.push({ id: 'l_' + uid(), name: '', url: '', interval: 10 });
    renderServers();
  });
  section.appendChild(addBtn);
  
  const hint = document.createElement('div');
  hint.className = 'danger-threshold-hint';
  hint.innerHTML = `⏱️ Each log has its own refresh interval (1-300 seconds)`;
  section.appendChild(hint);
  
  return section;
}

function buildAlertsSection(server, si) {
  const section = document.createElement('div');
  section.className = 'sub-section';
  if (!server.alerts) {
    server.alerts = { offline: { enabled: false, sound: 'none', notification: true, flash: true }, triggerAlerts: [] };
  }
  section.innerHTML = `<div class="sub-title">🚨 ${t('alerts.title', currentLang)}</div>`;
  
  const offlineRow = document.createElement('div');
  offlineRow.className = 'row';
  
  const enableCb = document.createElement('input');
  enableCb.type = 'checkbox';
  enableCb.checked = server.alerts.offline.enabled;
  const enableLabel = document.createElement('span');
  enableLabel.style.fontSize = '11px';
  enableLabel.textContent = 'Enable';
  const enableWrap = document.createElement('div');
  enableWrap.className = 'checkbox-row';
  enableWrap.append(enableCb, enableLabel);
  
  const soundSelect = document.createElement('select');
  soundSelect.className = 'sound-select';
  soundSelect.style.minWidth = '120px';
  renderSoundOptions(soundSelect, server.alerts.offline.sound);
  
  const notifCb = document.createElement('input');
  notifCb.type = 'checkbox';
  notifCb.checked = server.alerts.offline.notification;
  const notifLabel = document.createElement('span');
  notifLabel.style.fontSize = '11px';
  notifLabel.textContent = t('alerts.notification', currentLang);
  const notifWrap = document.createElement('div');
  notifWrap.className = 'checkbox-row';
  notifWrap.append(notifCb, notifLabel);
  
  const flashCb = document.createElement('input');
  flashCb.type = 'checkbox';
  flashCb.checked = server.alerts.offline.flash;
  const flashLabel = document.createElement('span');
  flashLabel.style.fontSize = '11px';
  flashLabel.textContent = t('alerts.flash', currentLang);
  const flashWrap = document.createElement('div');
  flashWrap.className = 'checkbox-row';
  flashWrap.append(flashCb, flashLabel);
  
  enableCb.addEventListener('change', e => { server.alerts.offline.enabled = e.target.checked; save(); });
  soundSelect.addEventListener('change', e => { server.alerts.offline.sound = e.target.value; save(); });
  notifCb.addEventListener('change', e => { server.alerts.offline.notification = e.target.checked; save(); });
  flashCb.addEventListener('change', e => { server.alerts.offline.flash = e.target.checked; save(); });
  
  const offlineLabel = document.createElement('span');
  offlineLabel.style.cssText = 'font-size:11px;width:100px;';
  offlineLabel.textContent = t('alerts.offline', currentLang) + ':';
  
  offlineRow.append(offlineLabel, enableWrap, soundSelect, notifWrap, flashWrap);
  section.appendChild(offlineRow);
  
  const taDiv = document.createElement('div');
  taDiv.style.marginTop = '8px';
  taDiv.innerHTML = `<div style="font-size:11px;color:rgba(255,255,255,0.6);margin-bottom:6px;">${t('alerts.triggerAlerts', currentLang)}:</div>`;
  
  server.alerts.triggerAlerts.forEach((ta, ti) => {
    taDiv.appendChild(buildTriggerAlertItem(server, ta, ti));
  });
  
  const addTaBtn = document.createElement('button');
  addTaBtn.type = 'button';
  addTaBtn.className = 'btn-ghost mini-btn';
  addTaBtn.textContent = t('alerts.addTrigger', currentLang);
  addTaBtn.addEventListener('click', () => {
    server.alerts.triggerAlerts.push({ id: 'ta_' + uid(), word: '', sound: 'none', notification: true, flash: true });
    renderServers();
  });
  taDiv.appendChild(addTaBtn);
  section.appendChild(taDiv);
  
  const soundsDetails = document.createElement('details');
  soundsDetails.innerHTML = `<summary>🔊 ${t('alerts.customSounds', currentLang)}</summary>`;
  const soundsInner = document.createElement('div');
  soundsInner.style.padding = '10px 0';
  soundsInner.id = `sounds-list-${si}`;
  renderSoundsListInto(soundsInner);
  
  const upload = document.createElement('input');
  upload.type = 'file';
  upload.accept = 'audio/*';
  upload.style.cssText = 'margin-top:8px;font-size:11px;';
  upload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const sound = await addSound(file);
    if (sound) {
      renderSoundsListInto(soundsInner);
      renderServers();
    }
  });
  
  soundsInner.appendChild(upload);
  soundsDetails.appendChild(soundsInner);
  section.appendChild(soundsDetails);
  
  return section;
}

function buildTriggerAlertItem(server, ta, ti) {
  const item = document.createElement('div');
  item.className = 'alert-item';
  
  const wordInput = document.createElement('input');
  wordInput.type = 'text';
  wordInput.placeholder = t('opt.word', currentLang);
  wordInput.value = ta.word;
  wordInput.style.flex = '1';
  
  const soundSelect = document.createElement('select');
  soundSelect.className = 'ta-sound';
  soundSelect.style.minWidth = '100px';
  renderSoundOptions(soundSelect, ta.sound);
  
  const notifCb = document.createElement('input');
  notifCb.type = 'checkbox';
  notifCb.checked = ta.notification;
  const notifLabel = document.createElement('span');
  notifLabel.style.fontSize = '10px';
  notifLabel.textContent = 'Notify';
  const notifWrap = document.createElement('div');
  notifWrap.className = 'checkbox-row';
  notifWrap.append(notifCb, notifLabel);
  
  const flashCb = document.createElement('input');
  flashCb.type = 'checkbox';
  flashCb.checked = ta.flash;
  const flashLabel = document.createElement('span');
  flashLabel.style.fontSize = '10px';
  flashLabel.textContent = 'Flash';
  const flashWrap = document.createElement('div');
  flashWrap.className = 'checkbox-row';
  flashWrap.append(flashCb, flashLabel);
  
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'btn-danger mini-btn';
  delBtn.textContent = '✕';
  
  wordInput.addEventListener('input', e => { ta.word = e.target.value; save(); });
  soundSelect.addEventListener('change', e => { ta.sound = e.target.value; save(); });
  notifCb.addEventListener('change', e => { ta.notification = e.target.checked; save(); });
  flashCb.addEventListener('change', e => { ta.flash = e.target.checked; save(); });
  delBtn.addEventListener('click', () => {
    server.alerts.triggerAlerts.splice(ti, 1);
    renderServers();
    save();
  });
  
  item.append(wordInput, soundSelect, notifWrap, flashWrap, delBtn);
  return item;
}

function renderSoundsListInto(container) {
  const upload = container.querySelector('input[type="file"]');
  container.innerHTML = '';
  
  if (!soundsCache.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);';
    empty.textContent = t('alerts.noSound', currentLang);
    container.appendChild(empty);
  } else {
    soundsCache.forEach(s => {
      const item = document.createElement('div');
      item.className = 'sound-item';
      
      const name = document.createElement('span');
      name.style.cssText = 'flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      name.textContent = s.name;
      name.title = s.name;
      
      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = 'btn-ghost mini-btn';
      playBtn.textContent = '▶ ' + t('alerts.testSound', currentLang);
      playBtn.addEventListener('click', () => {
        try {
          const audio = new Audio(s.data);
          audio.volume = 0.7;
          audio.play().catch(() => toast('Playback failed', 'error'));
        } catch (e) { toast('Playback failed', 'error'); }
      });
      
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-danger mini-btn';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', async () => {
        await removeSound(s.id);
        renderSoundsListInto(container);
        renderServers();
      });
      
      item.append(name, playBtn, delBtn);
      container.appendChild(item);
    });
  }
  if (upload) container.appendChild(upload);
}

// ============ DRAG & DROP ============
let dragSrcIndex = null;
function setupDragHandlers(card, index) {
  card.addEventListener('dragstart', e => {
    dragSrcIndex = index;
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    document.querySelectorAll('.server-card').forEach(c => c.classList.remove('drag-over'));
  });
  card.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    card.classList.add('drag-over');
  });
  card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
  card.addEventListener('drop', e => {
    e.preventDefault();
    card.classList.remove('drag-over');
    if (dragSrcIndex === null || dragSrcIndex === index) return;
    const moved = servers.splice(dragSrcIndex, 1)[0];
    servers.splice(index, 0, moved);
    dragSrcIndex = null;
    renderServers();
    save();
  });
}

// ============ ТРИГГЕРЫ ============
function renderTriggers() {
  const focus = captureFocus();
  const list = document.getElementById('triggers-list');
  list.innerHTML = '';
  if (!triggers.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">✨</div>${t('opt.noTriggers', currentLang)}</div>`;
    restoreFocus(focus);
    return;
  }
  triggers.forEach((tr, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    
    const wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.placeholder = t('opt.word', currentLang);
    wordInput.value = tr.word;
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = tr.color || '#facc15';
    
    const bgColorInput = document.createElement('input');
    bgColorInput.type = 'color';
    bgColorInput.value = tr.bgColor || '#facc15';
    
    const boldCb = document.createElement('input');
    boldCb.type = 'checkbox';
    boldCb.checked = tr.bold !== false;
    const boldLabel = document.createElement('span');
    boldLabel.style.fontSize = '11px';
    boldLabel.textContent = t('opt.bold', currentLang);
    const boldWrap = document.createElement('div');
    boldWrap.className = 'checkbox-row';
    boldWrap.append(boldCb, boldLabel);
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger mini-btn';
    delBtn.textContent = '✕';
    
    wordInput.addEventListener('input', e => { triggers[i].word = e.target.value; save(); });
    colorInput.addEventListener('input', e => { triggers[i].color = e.target.value; save(); });
    bgColorInput.addEventListener('input', e => {
      triggers[i].bgColor = e.target.value;
      triggers[i].bg = hexToRgba(e.target.value, 0.15);
      save();
    });
    boldCb.addEventListener('change', e => { triggers[i].bold = e.target.checked; save(); });
    delBtn.addEventListener('click', () => { triggers.splice(i, 1); renderTriggers(); save(); });
    
    row.append(wordInput, colorInput, bgColorInput, boldWrap, delBtn);
    list.appendChild(row);
  });
  restoreFocus(focus);
}

// ============ ФИЛЬТРЫ ============
function describeFilter(f) {
  switch (f.type) {
    case 'hide_date': return t('filter.hideDate', currentLang);
    case 'hide_tag_message': return t('filter.hideMessageTag', currentLang);
    case 'hide_exact': return `${t('filter.hideExact', currentLang)} "${escapeHtml(f.value)}"`;
    case 'hide_regex': return `Regex: "${escapeHtml(f.value)}"`;
    case 'trim_start': return `${t('filter.trimStart', currentLang)}: ${escapeHtml(f.value)}`;
    case 'trim_end': return `${t('filter.trimEnd', currentLang)}: ${escapeHtml(f.value)}`;
    case 'trim_before_text': return `◀ "${escapeHtml(f.value)}"`;
    case 'trim_after_text': return `▶ "${escapeHtml(f.value)}"`;
    case 'trim_exact_text': return `✂ "${escapeHtml(f.value)}"`;
    default: return escapeHtml(f.type);
  }
}

function renderFilters() {
  const focus = captureFocus();
  const list = document.getElementById('filters-list');
  list.innerHTML = '';
  if (!filters.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">✂️</div>${t('opt.noFilters', currentLang)}</div>`;
    restoreFocus(focus);
    return;
  }
  filters.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'log-item';
    
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = f.name || '';
    nameInput.style.maxWidth = '140px';
    
    const scopeSelect = document.createElement('select');
    scopeSelect.innerHTML = `
      <option value="all" ${f.scope === 'all' ? 'selected' : ''}>${t('opt.everywhere', currentLang)}</option>
      <option value="chat" ${f.scope === 'chat' ? 'selected' : ''}>${t('opt.chatOnly', currentLang)}</option>
      <option value="console" ${f.scope === 'console' ? 'selected' : ''}>${t('opt.consoleOnly', currentLang)}</option>
    `;
    
    const desc = document.createElement('span');
    desc.style.cssText = 'flex:1;font-family:monospace;font-size:10px;color:rgba(255,255,255,0.6);overflow:hidden;text-overflow:ellipsis;';
    desc.innerHTML = describeFilter(f);
    desc.title = describeFilter(f);
    
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-ghost mini-btn';
    upBtn.textContent = '▲';
    upBtn.disabled = i === 0;
    
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-ghost mini-btn';
    downBtn.textContent = '▼';
    downBtn.disabled = i === filters.length - 1;
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger mini-btn';
    delBtn.textContent = '✕';
    
    nameInput.addEventListener('input', e => { f.name = e.target.value; save(); });
    scopeSelect.addEventListener('change', e => { f.scope = e.target.value; save(); });
    upBtn.addEventListener('click', () => {
      if (i > 0) { [filters[i-1], filters[i]] = [filters[i], filters[i-1]]; renderFilters(); save(); }
    });
    downBtn.addEventListener('click', () => {
      if (i < filters.length - 1) { [filters[i+1], filters[i]] = [filters[i], filters[i+1]]; renderFilters(); save(); }
    });
    delBtn.addEventListener('click', () => { filters.splice(i, 1); renderFilters(); save(); });
    
    item.append(nameInput, scopeSelect, desc, upBtn, downBtn, delBtn);
    list.appendChild(item);
  });
  restoreFocus(focus);
}

// ============ BLACKLIST ============
function renderBlacklist() {
  const focus = captureFocus();
  const list = document.getElementById('blacklist-list');
  list.innerHTML = '';
  if (!blacklist.length) {
    list.innerHTML = `<div class="empty"><div class="empty-icon">🚫</div>${t('opt.noBlacklist', currentLang)}</div>`;
    restoreFocus(focus);
    return;
  }
  blacklist.forEach((bl, i) => {
    const item = document.createElement('div');
    item.className = 'log-item';
    
    const wordInput = document.createElement('input');
    wordInput.type = 'text';
    wordInput.value = bl.word;
    wordInput.style.flex = '1';
    
    const modeSelect = document.createElement('select');
    modeSelect.innerHTML = `
      <option value="hide_line" ${bl.mode === 'hide_line' ? 'selected' : ''}>${t('opt.hideLine', currentLang)}</option>
      <option value="mask_word" ${bl.mode === 'mask_word' ? 'selected' : ''}>${t('opt.maskWord', currentLang)}</option>
    `;
    
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-danger mini-btn';
    delBtn.textContent = '✕';
    
    wordInput.addEventListener('input', e => { bl.word = e.target.value; save(); });
    modeSelect.addEventListener('change', e => { bl.mode = e.target.value; save(); });
    delBtn.addEventListener('click', () => { blacklist.splice(i, 1); renderBlacklist(); save(); });
    
    item.append(wordInput, modeSelect, delBtn);
    list.appendChild(item);
  });
  restoreFocus(focus);
}

// ============ ЯЗЫКИ ============
function renderLanguages() {
  const grid = document.getElementById('lang-grid');
  grid.innerHTML = '';
  const mainLangs = ['en', 'ru', 'uk', 'de', 'es'];
  mainLangs.forEach(code => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lang-btn' + (code === currentLang ? ' active' : '');
    btn.textContent = t(`lang.${code}`, currentLang) + ` [${code}]`;
    btn.addEventListener('click', async () => {
      currentLang = code;
      try {
        await chrome.storage.sync.set({ lang: code });
        await chrome.storage.local.set({ lang: code });
      } catch (e) { console.error(e); }
      
      applyI18n(currentLang);
      renderLanguages();
      renderServers();
      renderTriggers();
      renderFilters();
      renderBlacklist();
      renderManual();
      updateStaticTexts();
      toast('Language changed', 'success');
    });
    grid.appendChild(btn);
  });
}

// ============ СТАТИЧЕСКИЕ ТЕКСТЫ ============
function updateStaticTexts() {
  document.querySelectorAll('.section-title').forEach(el => {
    const section = el.closest('.section');
    if (section) {
      const translated = t(`section.${section.dataset.section}.title`, currentLang);
      if (translated && !translated.startsWith('section.')) el.textContent = translated;
    }
  });
  document.querySelectorAll('.section-hint').forEach(el => {
    const section = el.closest('.section');
    if (section) {
      const translated = t(`section.${section.dataset.section}.hint`, currentLang);
      if (translated && !translated.startsWith('section.')) el.textContent = translated;
    }
  });
  
  const map = {
    'add-server-btn': () => '+ ' + t('srv.add', currentLang),
    'add-trigger-btn': () => '+ ' + t('opt.addTrigger', currentLang),
    'clear-filters-btn': () => t('opt.clearFilters', currentLang),
    'add-bl-btn': () => '+ ' + t('opt.add', currentLang),
    'reset-theme-btn': () => t('opt.resetTheme', currentLang),
  };
  for (const [id, fn] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.textContent = fn();
  }
  
  const blWord = document.getElementById('bl-word');
  if (blWord) blWord.placeholder = t('opt.wordOrPhrase', currentLang);
  const blMode = document.getElementById('bl-mode');
  if (blMode) {
    blMode.options[0].textContent = t('opt.hideLine', currentLang);
    blMode.options[1].textContent = t('opt.maskWord', currentLang);
  }
}

// ============ MANUAL ============
function renderManual() {
  const content = document.getElementById('manual-content');
  if (!content) return;
  const L = currentLang;
  const sections = Array.from({ length: 12 }, (_, i) => i + 1);
  let html = `
    <div style="background:linear-gradient(135deg,rgba(102,126,234,0.15),rgba(118,75,162,0.15));border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:24px;margin-bottom:20px;text-align:center;">
      <h2 style="font-size:22px;margin:0 0 10px 0;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${escapeHtml(t('manual.title', L))}</h2>
      <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;">${escapeHtml(t('manual.intro', L))}</p>
    </div>
  `;
  sections.forEach(n => {
    const title = t(`manual.section${n}.title`, L);
    const text = t(`manual.section${n}.text`, L);
    if (title && text && !title.startsWith('manual.')) {
      html += `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;margin-bottom:12px;"><h3 style="font-size:15px;font-weight:600;margin:0 0 8px 0;color:#fff;">${escapeHtml(title)}</h3><div style="color:rgba(255,255,255,0.75);font-size:13px;line-height:1.6;">${text}</div></div>`;
    }
  });
  html += `<div style="text-align:center;padding:16px;color:rgba(255,255,255,0.4);font-size:12px;font-style:italic;">${escapeHtml(t('manual.footer', L))}</div>`;
  content.innerHTML = html;
}

// ============ ЗАГРУЗКА ============
async function load() {
  try {
    await loadCustomPresets();
    renderPresets();
    
    const data = await chrome.storage.sync.get(['servers', 'triggers', 'theme', 'filters', 'blacklist', 'lang', 'ai']);
    const local = await chrome.storage.local.get(['opacity', 'lang']);
    
    servers = data.servers || [];
    triggers = data.triggers || [];
    filters = data.filters || [];
    blacklist = data.blacklist || [];
    theme = data.theme || {};
    ai = data.ai || { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini' };
    currentLang = data.lang || local.lang || getBrowserLang();
    
    await loadSounds();
    
    const opacityEl = document.getElementById('opacity');
    if (opacityEl) {
      opacityEl.value = local.opacity ?? 0.96;
      document.getElementById('opacity-val').textContent = Math.round((local.opacity ?? 0.96) * 100) + '%';
    }
    
    if (theme.bg) {
      const match = theme.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        document.getElementById('bg-color').value = rgbToHex(+match[1], +match[2], +match[3]);
        document.getElementById('bg-alpha').value = match[4] ?? 0.96;
      }
    }
    if (theme.text) document.getElementById('text-color').value = theme.text;
    
    if (theme.extended) {
      applyExtendedTheme(theme.extended);
    }
    updateThemePreview();
    
    document.getElementById('ai-enabled').checked = ai.enabled;
    document.getElementById('ai-provider').value = ai.provider || 'openai';
    document.getElementById('ai-apikey').value = ai.apiKey || '';
    document.getElementById('ai-model').value = ai.model || '';
    
    applyI18n(currentLang);
    renderServers();
    renderTriggers();
    renderFilters();
    renderBlacklist();
    renderLanguages();
    renderManual();
    updateStaticTexts();
  } catch (e) {
    console.error('[load] failed:', e);
    toast('Failed to load settings: ' + e.message, 'error');
  }
}

// ============ УМНЫЙ ПОИСК ============
function performSearch(query) {
  const q = query.trim().toLowerCase();
  clearSearchHighlights();
  
  document.querySelectorAll('.section').forEach(s => {
    s.classList.remove('search-hidden');
    s.querySelectorAll('.search-dimmed').forEach(el => el.classList.remove('search-dimmed'));
    s.querySelectorAll('.search-focus').forEach(el => el.classList.remove('search-focus'));
  });
  document.querySelectorAll('.tab-nav').forEach(t => t.style.display = '');

  if (!q) return;

  let globalMatch = false;

  document.querySelectorAll('.section').forEach(section => {
    let sectionMatch = false;
    
    const textNodes = [];
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) textNodes.push(node);
    
    textNodes.forEach(node => {
      const parent = node.parentElement;
      if (!parent || parent.closest('.search-highlight, .search-hidden, script, style')) return;
      
      const text = node.textContent.toLowerCase();
      if (text.includes(q)) {
        sectionMatch = true;
        highlightTextNode(node, q);
      } else {
        parent.classList.add('search-dimmed');
      }
    });

    section.querySelectorAll('input, select, textarea, button, [data-i18n], [data-i18n-placeholder]').forEach(el => {
      const text = (el.textContent || el.placeholder || el.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes(q)) {
        sectionMatch = true;
        if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.classList.add('search-focus');
        el.classList.remove('search-dimmed');
      } else {
        if (el.tagName !== 'INPUT' && el.tagName !== 'SELECT') el.classList.add('search-dimmed');
      }
    });

    if (sectionMatch) globalMatch = true;
    else section.classList.add('search-hidden');
  });

  if (globalMatch) {
    const firstVisible = document.querySelector('.section:not(.search-hidden)');
    if (firstVisible) {
      const tabName = firstVisible.dataset.section;
      document.querySelectorAll('.tab-nav').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
      });
    }
  }
}

function highlightTextNode(node, query) {
  const text = node.textContent;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return;
  
  const frag = document.createDocumentFragment();
  frag.appendChild(document.createTextNode(text.substring(0, idx)));
  
  const span = document.createElement('span');
  span.className = 'search-highlight';
  span.textContent = text.substring(idx, idx + query.length);
  frag.appendChild(span);
  
  frag.appendChild(document.createTextNode(text.substring(idx + query.length)));
  node.parentNode.replaceChild(frag, node);
}

function clearSearchHighlights() {
  document.querySelectorAll('.search-highlight').forEach(span => {
    const parent = span.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-nav').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.tab));
  });
  
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'switchTab' && msg.tab) switchSection(msg.tab);
    if (msg.action === 'reloadData') load();
  });
  
  // ============ ПОИСК ============
  const searchInput = document.getElementById('settings-search');
  const searchClear = document.getElementById('search-clear');
  let searchTimer;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      if (searchClear) {
        searchClear.classList.toggle('visible', e.target.value.length > 0);
      }
      searchTimer = setTimeout(() => performSearch(e.target.value), CONFIG.SEARCH_DEBOUNCE_MS);
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.classList.remove('visible');
      performSearch('');
      searchInput.focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && searchInput && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape' && searchInput && document.activeElement === searchInput) {
      searchInput.value = '';
      if (searchClear) searchClear.classList.remove('visible');
      performSearch('');
      searchInput.blur();
    }
  });
  
  // ============ ADD SERVER ============
  document.getElementById('add-server-btn').addEventListener('click', () => {
    servers.push({
      id: 's_' + uid(), name: 'New Server',
      ping: { enabled: false, url: '', interval: 30, timeout: 5, type: 'http' },
      logs: [],
      alerts: { offline: { enabled: false, sound: 'none', notification: true, flash: true }, triggerAlerts: [] }
    });
    renderServers();
  });
  
  // ============ ADD TRIGGER ============
  document.getElementById('add-trigger-btn').addEventListener('click', () => {
    triggers.push({ word: '', color: '#facc15', bgColor: '#facc15', bg: 'rgba(250,204,21,0.15)', bold: true });
    renderTriggers();
  });
  
  // ============ CLEAR FILTERS ============
  document.getElementById('clear-filters-btn').addEventListener('click', async () => {
    if (await confirmAsync('Clear filters', t('opt.clearFilters', currentLang))) {
      filters = [];
      renderFilters();
      save();
    }
  });
  
  // ============ BLACKLIST FORM ============
  document.getElementById('blacklist-form').addEventListener('submit', e => {
    e.preventDefault();
    const word = document.getElementById('bl-word').value.trim();
    if (!word) return;
    blacklist.push({ id: 'bl_' + uid(), word, mode: document.getElementById('bl-mode').value });
    document.getElementById('bl-word').value = '';
    renderBlacklist();
    save();
  });
  
  // ============ IMPORT TRIGGERS FROM FILE ============
  const triggersFile = document.getElementById('triggers-file');
  const triggersPreview = document.getElementById('triggers-import-preview');
  
  if (triggersFile) {
    triggersFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        if (lines.length === 0) {
          triggersPreview.style.display = 'block';
          triggersPreview.innerHTML = `<div style="color:#ef4444;">❌ Empty file or all lines are comments</div>`;
          return;
        }
        
        triggersPreview.style.display = 'block';
        triggersPreview.innerHTML = `
          <div style="color:#4ade80;margin-bottom:6px;">✓ Found ${lines.length} trigger(s)</div>
          <div style="color:rgba(255,255,255,0.6);">${lines.slice(0, 20).map(l => escapeHtml(l)).join('<br>')}${lines.length > 20 ? `<br><span style="color:rgba(255,255,255,0.4);">... and ${lines.length - 20} more</span>` : ''}</div>
        `;
        triggersFile.dataset.ready = 'true';
      } catch (err) {
        triggersPreview.style.display = 'block';
        triggersPreview.innerHTML = `<div style="color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
      }
    });
  }
  
  const importTriggersBtn = document.getElementById('import-triggers-btn');
  if (importTriggersBtn) {
    importTriggersBtn.addEventListener('click', async () => {
      const file = triggersFile.files[0];
      if (!file || triggersFile.dataset.ready !== 'true') {
        toast('Select a file first', 'warning');
        return;
      }
      
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        const color = document.getElementById('triggers-file-color').value;
        const bgColor = document.getElementById('triggers-file-bgcolor').value;
        const bold = document.getElementById('triggers-file-bold').checked;
        
        let added = 0;
        const existingWords = new Set(triggers.map(t => t.word.toLowerCase()));
        
        lines.forEach(word => {
          if (existingWords.has(word.toLowerCase())) return;
          existingWords.add(word.toLowerCase());
          triggers.push({
            word,
            color,
            bgColor,
            bg: hexToRgba(bgColor, 0.15),
            bold
          });
          added++;
        });
        
        renderTriggers();
        save();
        
        triggersPreview.style.display = 'block';
        triggersPreview.innerHTML = `<div style="color:#4ade80;">✓ Imported ${added} trigger(s)${lines.length - added > 0 ? ` (${lines.length - added} duplicates skipped)` : ''}</div>`;
        triggersFile.value = '';
        triggersFile.dataset.ready = '';
        
        toast(`Imported ${added} triggers`, 'success');
      } catch (err) {
        toast('Import failed: ' + err.message, 'error');
      }
    });
  }
  
  // ============ IMPORT BLACKLIST FROM FILE ============
  const blacklistFile = document.getElementById('blacklist-file');
  const blacklistPreview = document.getElementById('blacklist-import-preview');
  
  if (blacklistFile) {
    blacklistFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        if (lines.length === 0) {
          blacklistPreview.style.display = 'block';
          blacklistPreview.innerHTML = `<div style="color:#ef4444;">❌ Empty file or all lines are comments</div>`;
          return;
        }
        
        blacklistPreview.style.display = 'block';
        blacklistPreview.innerHTML = `
          <div style="color:#4ade80;margin-bottom:6px;">✓ Found ${lines.length} word(s)</div>
          <div style="color:rgba(255,255,255,0.6);">${lines.slice(0, 20).map(l => escapeHtml(l)).join('<br>')}${lines.length > 20 ? `<br><span style="color:rgba(255,255,255,0.4);">... and ${lines.length - 20} more</span>` : ''}</div>
        `;
        blacklistFile.dataset.ready = 'true';
      } catch (err) {
        blacklistPreview.style.display = 'block';
        blacklistPreview.innerHTML = `<div style="color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
      }
    });
  }
  
  const importBlacklistBtn = document.getElementById('import-blacklist-btn');
  if (importBlacklistBtn) {
    importBlacklistBtn.addEventListener('click', async () => {
      const file = blacklistFile.files[0];
      if (!file || blacklistFile.dataset.ready !== 'true') {
        toast('Select a file first', 'warning');
        return;
      }
      
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        const mode = document.getElementById('blacklist-file-mode').value;
        
        let added = 0;
        const existingWords = new Set(blacklist.map(b => b.word.toLowerCase()));
        
        lines.forEach(word => {
          if (existingWords.has(word.toLowerCase())) return;
          existingWords.add(word.toLowerCase());
          blacklist.push({
            id: 'bl_' + uid(),
            word,
            mode
          });
          added++;
        });
        
        renderBlacklist();
        save();
        
        blacklistPreview.style.display = 'block';
        blacklistPreview.innerHTML = `<div style="color:#4ade80;">✓ Imported ${added} word(s)${lines.length - added > 0 ? ` (${lines.length - added} duplicates skipped)` : ''}</div>`;
        blacklistFile.value = '';
        blacklistFile.dataset.ready = '';
        
        toast(`Imported ${added} words`, 'success');
      } catch (err) {
        toast('Import failed: ' + err.message, 'error');
      }
    });
  }
  
  // ============ THEME ============
  document.getElementById('reset-theme-btn').addEventListener('click', async () => {
    if (!await confirmAsync('Reset theme', 'Reset theme to defaults?')) return;
    theme = {};
    document.getElementById('bg-color').value = '#14161e';
    document.getElementById('bg-alpha').value = 0.96;
    document.getElementById('text-color').value = '#e4e4e7';
    document.getElementById('opacity').value = 0.96;
    document.getElementById('opacity-val').textContent = '96%';
    applyExtendedTheme({
      fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace",
      fontSize: 11.5, lineHeight: 1.4, letterSpacing: 0, fontBold: false,
      borderWidth: 3, borderRadius: 3, borderStyle: 'solid',
      errorBg: '#ef4444', errorBgAlpha: 0.08,
      warnBg: '#facc15', warnBgAlpha: 0.08,
      hoverBg: '#ffffff', hoverBgAlpha: 0.05,
    });
    save();
  });
  
  // Opacity
  document.getElementById('opacity').addEventListener('input', e => {
    document.getElementById('opacity-val').textContent = Math.round(e.target.value * 100) + '%';
    save();
  });
  
  // Базовые цвета + превью
  ['bg-color', 'bg-alpha', 'text-color'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      save();
      updateThemePreview();
    });
  });
  
  // Расширенные настройки
  ['font-family', 'font-size', 'line-height', 'letter-spacing', 'font-bold',
   'border-width', 'border-radius', 'border-style',
   'error-bg-color', 'error-bg-alpha', 'warn-bg-color', 'warn-bg-alpha',
   'hover-bg-color', 'hover-bg-alpha'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const valEl = document.getElementById(id + '-val');
      if (valEl) {
        if (id === 'font-size') valEl.textContent = el.value + 'px';
        else if (id === 'letter-spacing') valEl.textContent = el.value + 'px';
        else if (id === 'border-width') valEl.textContent = el.value + 'px';
        else if (id === 'border-radius') valEl.textContent = el.value + 'px';
        else valEl.textContent = el.value;
      }
      updateThemePreview();
      save();
    });
  });
  
  // ============ AI FORM ============
  ['ai-enabled', 'ai-provider', 'ai-apikey', 'ai-model'].forEach(id => {
    const el = document.getElementById(id);
    const evt = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(evt, () => {
      ai = {
        enabled: document.getElementById('ai-enabled').checked,
        provider: document.getElementById('ai-provider').value,
        apiKey: document.getElementById('ai-apikey').value,
        model: document.getElementById('ai-model').value
      };
      save();
    });
  });
  
  const toggleApikey = document.getElementById('toggle-apikey');
  if (toggleApikey) {
    toggleApikey.addEventListener('click', () => {
      const apikeyInput = document.getElementById('ai-apikey');
      apikeyInput.type = apikeyInput.type === 'password' ? 'text' : 'password';
    });
  }
  
  // ============ EXPORT / IMPORT ============
  document.getElementById('export-btn').addEventListener('click', async () => {
    try {
      const includeCache = document.getElementById('export-include-cache').checked;
      const includeSounds = document.getElementById('export-include-sounds').checked;
      
      const syncData = await chrome.storage.sync.get([
        'servers', 'triggers', 'filters', 'blacklist', 
        'theme', 'ai', 'lang', 'favorites'
      ]);
      
      const localKeys = [
        'opacity', 'position', 'size', 'showManual', 'showStats', 
        'showFavorites', 'currentServerId', 'currentLogId',
        'customPresets', 'activePresetId'
      ];
      if (includeCache) localKeys.push('cache');
      if (includeSounds) localKeys.push('customSounds');
      
      const localData = await chrome.storage.local.get(localKeys);
      
      const backup = {
        _bsm_backup: true,
        version: '5.3',
        exportedAt: new Date().toISOString(),
        includeCache, includeSounds,
        sync: syncData, 
        local: localData
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      a.download = `BSM_backup_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded', 'success');
    } catch (e) {
      toast('Export failed: ' + e.message, 'error');
    }
  });
  
  const importFile = document.getElementById('import-file');
  const importBtn = document.getElementById('import-btn');
  const importPreview = document.getElementById('import-preview');
  
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data._bsm_backup) {
        importPreview.style.display = 'block';
        importPreview.innerHTML = `<div style="color:#ef4444;">❌ Invalid backup file format</div>`;
        importBtn.disabled = true;
        return;
      }
      
      if (data.sync && typeof data.sync !== 'object') throw new Error('Invalid sync data');
      if (data.local && typeof data.local !== 'object') throw new Error('Invalid local data');
      
      pendingImport = data;
      importBtn.disabled = false;
      
      const summary = [
        `📦 ${t('opt.backupVersion', currentLang)}: ${data.version || '?'}`,
        `📅 ${t('opt.backupDate', currentLang)}: ${new Date(data.exportedAt).toLocaleString()}`,
        `🛰️ ${t('srv.title', currentLang)}: ${(data.sync?.servers || []).length}`,
        `✨ ${t('opt.triggers', currentLang)}: ${(data.sync?.triggers || []).length}`,
        `✂️ ${t('opt.filters', currentLang)}: ${(data.sync?.filters || []).length}`,
        `🚫 ${t('opt.blacklist', currentLang)}: ${(data.sync?.blacklist || []).length}`,
        `🔊 Sounds: ${(data.local?.customSounds || []).length}`,
        `💾 Cache entries: ${Object.keys(data.local?.cache || {}).length}`,
        `🎨 Custom presets: ${(data.local?.customPresets || []).length}`,
        `🎯 Active preset: ${data.local?.activePresetId || 'none'}`
      ];
      
      importPreview.style.display = 'block';
      importPreview.innerHTML = summary.map(s => `<div>${escapeHtml(s)}</div>`).join('');
    } catch (err) {
      importPreview.style.display = 'block';
      importPreview.innerHTML = `<div style="color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
      importBtn.disabled = true;
    }
  });
  
  importBtn.addEventListener('click', async () => {
    if (!pendingImport) return;
    if (!await confirmAsync('Import backup', t('opt.importConfirm', currentLang))) return;
    
    try {
      await chrome.storage.sync.clear();
      if (pendingImport.sync) await chrome.storage.sync.set(pendingImport.sync);
      
      await chrome.storage.local.clear();
      if (pendingImport.local) await chrome.storage.local.set(pendingImport.local);
      
      servers = pendingImport.sync?.servers || [];
      triggers = pendingImport.sync?.triggers || [];
      filters = pendingImport.sync?.filters || [];
      blacklist = pendingImport.sync?.blacklist || [];
      theme = pendingImport.sync?.theme || {};
      ai = pendingImport.sync?.ai || { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini' };
      currentLang = pendingImport.sync?.lang || 'en';
      
      customPresets = pendingImport.local?.customPresets || [];
      activePresetId = pendingImport.local?.activePresetId || null;
      
      await loadSounds();
      
      applyI18n(currentLang);
      renderServers();
      renderTriggers();
      renderFilters();
      renderBlacklist();
      renderLanguages();
      renderManual();
      renderPresets();
      updateStaticTexts();
      
      if (theme.bg) {
        const match = theme.bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (match) {
          document.getElementById('bg-color').value = rgbToHex(+match[1], +match[2], +match[3]);
          document.getElementById('bg-alpha').value = match[4] ?? 0.96;
        }
      }
      if (theme.text) document.getElementById('text-color').value = theme.text;
      document.getElementById('opacity').value = pendingImport.local?.opacity ?? 0.96;
      document.getElementById('opacity-val').textContent = Math.round((pendingImport.local?.opacity ?? 0.96) * 100) + '%';
      
      if (theme.extended) {
        applyExtendedTheme(theme.extended);
      }
      updateThemePreview();
      
      document.getElementById('ai-enabled').checked = ai.enabled;
      document.getElementById('ai-provider').value = ai.provider || 'openai';
      document.getElementById('ai-apikey').value = ai.apiKey || '';
      document.getElementById('ai-model').value = ai.model || '';
      
      chrome.runtime.sendMessage({ action: 'reloadData' }).catch(() => {});
      
      importPreview.style.display = 'none';
      importFile.value = '';
      importBtn.disabled = true;
      pendingImport = null;
      
      toast('Backup imported', 'success');
    } catch (err) {
      importPreview.innerHTML = `<div style="color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
      toast('Import failed', 'error');
    }
  });
  
  // ============ ПРЕСЕТЫ ============
  document.getElementById('reset-to-default-btn')?.addEventListener('click', async () => {
    if (!await confirmAsync('Reset', 'Reset to Classic Dark preset?')) return;
    applyPreset(PRESETS.find(p => p.id === 'classic'));
  });
  
  document.getElementById('save-current-preset-btn')?.addEventListener('click', saveCurrentAsPreset);
  
  // ============ ЗАГРУЗКА ДАННЫХ ============
  load();
});