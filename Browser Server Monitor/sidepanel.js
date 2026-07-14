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
const BSM_CONFIG = {
  MAX_DISPLAYED_LINES: 50,
  AUTOREFRESH_INTERVAL_MS: 10000,
  SAVE_DEBOUNCE_MS: 500,
  SCROLL_THRESHOLD_PX: 60,
  SIDEBAR_MIN_WIDTH: 100,
  SIDEBAR_MAX_WIDTH: 500,
  AI_CONTEXT_LINES: 3,
  ALERT_COOLDOWN_MS: 30000,
  TOAST_DURATION_MS: 3000,
};

class BSMPanel {
  constructor() {
    this.state = {
      currentServerId: null, currentLogId: null,
      serverAlerts: {},
      acknowledgedLineHashes: {},
      muted: false,
      showManual: false, showStats: false, showFavorites: false,
      sidebarCollapsed: false, lang: 'en',
      searchQuery: '', levelFilter: 'all',
      lastContentHash: null, displayedLines: [],
      newMessagesCount: 0, userScrolled: false, noWrap: false,
    };
    this.config = {
      servers: [], triggers: [], theme: {}, filters: [],
      blacklist: [], ai: {}, favorites: {},
    };
    this.cache = {};
    this.serverStatus = {};
    this.logTimers = {};  // { "serverId:logId": intervalId }
    this.contextMenu = null;
    this.aiModal = null;
    this.saveTimer = null;
    this.activeAbortController = null;
    this.alertCooldowns = {};
    this._listenersCleanup = [];
    this.init();
  }

  async init() {
    await this.loadAll();
    this.createUI();
    this.setupListeners();
    this.startAutoRefresh();
  }

  toast(message, type = 'info') {
    let container = document.getElementById('bsm-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bsm-toast-container';
      container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(container);
    }
    const colors = { info: '#667eea', success: '#10b981', error: '#ef4444', warning: '#facc15' };
    const el = document.createElement('div');
    el.style.cssText = `padding:10px 18px;border-radius:8px;color:#fff;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.3);background:${colors[type] || colors.info};opacity:0;transform:translateX(20px);transition:all 0.3s;max-width:320px;`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 300);
    }, BSM_CONFIG.TOAST_DURATION_MS);
  }

  async loadAll() {
    const [local, sync] = await Promise.all([
      chrome.storage.local.get(null),
      chrome.storage.sync.get(null),
    ]);
    this.localData = local;

    Object.assign(this.state, {
      currentServerId: local.currentServerId || null,
      currentLogId: local.currentLogId || null,
      showManual: local.showManual ?? false,
      showStats: local.showStats ?? false,
      showFavorites: local.showFavorites ?? false,
      sidebarCollapsed: local.sidebarCollapsed ?? false,
      lang: local.lang || sync.lang || this.getBrowserLang(),
      lastContentHash: local.lastContentHash || null,
      noWrap: local.noWrap ?? false,
      muted: local.muted ?? false,
    });

    const rawAlerts = local.serverAlerts || {};
    this.state.serverAlerts = {};
    for (const [serverId, val] of Object.entries(rawAlerts)) {
      if (Array.isArray(val)) {
        this.state.serverAlerts[serverId] = val;
      } else if (val && val.lastTrigger) {
        this.state.serverAlerts[serverId] = [{
          id: 'migrated_' + Date.now(),
          word: val.lastTrigger,
          line: val.lastLine || '',
          lineHash: this.hashLine(val.lastLine || ''),
          timestamp: val.timestamp || Date.now(),
          acknowledged: false,
          sound: 'none',
        }];
      }
    }

    const rawAck = local.acknowledgedLineHashes || {};
    this.state.acknowledgedLineHashes = {};
    for (const [serverId, hashes] of Object.entries(rawAck)) {
      this.state.acknowledgedLineHashes[serverId] = new Set(
        Array.isArray(hashes) ? hashes : Object.keys(hashes || {})
      );
    }

    this.cache = local.cache || {};
    this.serverStatus = local.serverStatus || {};

    this.config.servers = sync.servers || [];
    this.config.triggers = sync.triggers || [];
    this.config.theme = sync.theme || {};
    this.config.filters = sync.filters || [];
    this.config.blacklist = sync.blacklist || [];
    this.config.ai = sync.ai || {};
    this.config.favorites = sync.favorites || {};

    if (!this.state.currentServerId && this.config.servers.length > 0) {
      this.state.currentServerId = this.config.servers[0].id;
      if (this.config.servers[0].logs?.length > 0) {
        this.state.currentLogId = this.config.servers[0].logs[0].id;
      }
    }
  }

  saveState() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.doSave(), BSM_CONFIG.SAVE_DEBOUNCE_MS);
  }

  async doSave() {
    try {
      const ackHashes = {};
      for (const [sid, set] of Object.entries(this.state.acknowledgedLineHashes)) {
        ackHashes[sid] = Array.from(set);
      }
      await chrome.storage.local.set({
        currentServerId: this.state.currentServerId,
        currentLogId: this.state.currentLogId,
        showManual: this.state.showManual,
        showStats: this.state.showStats,
        showFavorites: this.state.showFavorites,
        sidebarCollapsed: this.state.sidebarCollapsed,
        lang: this.state.lang,
        cache: this.cache,
        serverAlerts: this.state.serverAlerts,
        acknowledgedLineHashes: ackHashes,
        lastContentHash: this.state.lastContentHash,
        muted: this.state.muted,
      });
    } catch (e) { console.error('[BSM] save failed:', e); }
  }

  createUI() {
    const root = document.getElementById('bsm-root');
    if (!root) return;
    root.innerHTML = '';
    this.applyTheme();

    const header = document.createElement('div');
    header.className = 'bsm-header';

    const title = document.createElement('div');
    title.className = 'bsm-title';
    title.textContent = '🛰️ BSM';

    const tabs = document.createElement('div');
    tabs.className = 'bsm-tabs';

    const actions = document.createElement('div');
    actions.className = 'bsm-actions';

    const refreshBtn = this.createIconBtn('⟳', t('widget.refresh', this.state.lang), () => this.refresh());
    const autoBtn = this.createIconBtn('⏸', t('widget.autoupdate', this.state.lang), () => this.toggleAutoUpdate(), 'auto-btn');
    const muteBtn = this.createIconBtn(
      this.state.muted ? '🔇' : '🔊',
      this.state.muted ? t('widget.unmute', this.state.lang) : t('widget.mute', this.state.lang),
      () => this.toggleMute(),
      'mute-btn' + (this.state.muted ? ' muted' : '')
    );
    const statsBtn = this.createIconBtn('📊', t('widget.stats', this.state.lang), () => this.toggleStats(), 'stats-btn');
    const favBtn = this.createIconBtn('★', t('widget.favorites', this.state.lang), () => this.toggleFavorites(), 'fav-btn');
    const manualBtn = this.createIconBtn('📖', t('widget.manual', this.state.lang), () => this.toggleManual(), 'manual-btn');
    const settingsBtn = this.createIconBtn('⚙', t('widget.settings', this.state.lang), () => this.openOptions());

    [refreshBtn, autoBtn, muteBtn, statsBtn, favBtn, manualBtn, settingsBtn].forEach(b => actions.appendChild(b));

    header.append(title, tabs, actions);

    const body = document.createElement('div');
    body.className = 'bsm-body';

    this.serverList = document.createElement('div');
    this.serverList.className = 'server-list' + (this.state.sidebarCollapsed ? ' collapsed' : '');

    const listHeader = document.createElement('div');
    listHeader.className = 'server-list-header';
    const listTitle = document.createElement('div');
    listTitle.className = 'server-list-title';
    listTitle.textContent = t('srv.title', this.state.lang);

    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.innerHTML = '◀';
    collapseBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleSidebar(); });

    listHeader.append(listTitle, collapseBtn);
    this.serverList.appendChild(listHeader);
    this.collapseBtn = collapseBtn;

    this.mainArea = document.createElement('div');
    this.mainArea.className = 'main-area';
    this.mainArea.style.position = 'relative';

    this.toolbar = this.createToolbar();
    this.statsPanel = document.createElement('div');
    this.statsPanel.className = 'stats-panel';
    this.statsPanel.style.display = 'none';

    this.content = document.createElement('div');
    this.content.className = 'content';
    this.content.addEventListener('scroll', () => this.handleScroll());

    this.manualView = document.createElement('div');
    this.manualView.className = 'widget-manual';
    this.manualView.style.display = 'none';

    this.favoritesView = document.createElement('div');
    this.favoritesView.className = 'content';
    this.favoritesView.style.display = 'none';

    this.mainArea.append(this.toolbar, this.statsPanel, this.content, this.favoritesView, this.manualView);

    this.newMsgIndicator = document.createElement('div');
    this.newMsgIndicator.className = 'new-messages-indicator';
    this.newMsgIndicator.onclick = () => this.scrollToBottom();
    this.mainArea.appendChild(this.newMsgIndicator);

    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'resize-handle-vertical';
    this.setupVerticalResize();

    body.append(this.serverList, this.resizeHandle, this.mainArea);

    if (this.localData?.sidebarWidth) {
      this.serverList.style.width = this.localData.sidebarWidth + 'px';
    }

    root.append(header, body);

    this.tabsContainer = tabs;
    this.autoBtn = autoBtn;
    this.statsBtn = statsBtn;
    this.favBtn = favBtn;
    this.manualBtn = manualBtn;
    this.muteBtn = muteBtn;

    if (this.state.noWrap) {
      this.content.classList.add('no-wrap');
    }

    this.renderServers();
    this.renderMainArea();
  }

  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const searchBox = document.createElement('div');
    searchBox.className = 'search-box';
    searchBox.innerHTML = `<span class="search-icon">🔍</span>`;
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'search-input';
    searchInput.placeholder = t('search.placeholder', this.state.lang);
    let searchTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.state.searchQuery = e.target.value;
        this.applySearch();
      }, 150);
    });
    searchBox.appendChild(searchInput);
    this.searchInput = searchInput;

    const levelFilter = document.createElement('div');
    levelFilter.className = 'level-filter';
    ['all', 'error', 'warn', 'info'].forEach(level => {
      const btn = document.createElement('button');
      btn.className = 'level-btn ' + level + (level === 'all' ? ' active' : '');
      btn.textContent = { all: t('search.all', this.state.lang), error: 'ERR', warn: 'WRN', info: 'INF' }[level];
      btn.addEventListener('click', () => {
        levelFilter.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.levelFilter = level;
        this.applySearch();
      });
      levelFilter.appendChild(btn);
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'tool-btn';
    downloadBtn.textContent = '💾';
    downloadBtn.title = t('widget.download', this.state.lang);
    downloadBtn.addEventListener('click', () => this.downloadLog());

    const wrapBtn = document.createElement('button');
    wrapBtn.className = 'tool-btn' + (this.state.noWrap ? '' : ' active');
    wrapBtn.innerHTML = '↵';
    wrapBtn.title = 'Word wrap';
    wrapBtn.addEventListener('click', () => this.toggleWrap(wrapBtn));
    this.wrapBtn = wrapBtn;

    toolbar.append(searchBox, levelFilter, wrapBtn, downloadBtn);
    return toolbar;
  }

  toggleWrap(btn) {
    this.state.noWrap = !this.state.noWrap;
    this.content.classList.toggle('no-wrap', this.state.noWrap);
    btn.classList.toggle('active', !this.state.noWrap);
    chrome.storage.local.set({ noWrap: this.state.noWrap });
  }

  createIconBtn(icon, title, onclick, className = '') {
    const btn = document.createElement('button');
    btn.className = 'icon-btn ' + className;
    btn.innerHTML = icon;
    btn.title = title;
    btn.onclick = onclick;
    return btn;
  }

  renderServers() {
    const header = this.serverList.querySelector('.server-list-header');
    this.serverList.innerHTML = '';
    if (header) this.serverList.appendChild(header);

    if (this.config.servers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div style="font-size:24px;margin-bottom:8px;">🛰️</div>
        <div>${t('srv.noServers', this.state.lang)}</div>
        <div style="margin-top:4px;font-size:10px;">⚙️ → ${t('srv.add', this.state.lang)}</div>
      `;
      this.serverList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    this.config.servers.forEach(server => fragment.appendChild(this.buildServerItem(server)));
    this.serverList.appendChild(fragment);
  }

  buildServerItem(server) {
    const alerts = this.state.serverAlerts[server.id] || [];
    const unacknowledged = alerts.filter(a => !a.acknowledged);
    const hasUnacknowledged = unacknowledged.length > 0;

    const item = document.createElement('div');
    item.className = 'server-item' +
      (server.id === this.state.currentServerId ? ' active' : '') +
      (hasUnacknowledged ? ' has-alert' : '');
    item.dataset.tooltip = server.name || 'Server';

    const status = this.serverStatus[server.id];
    const statusClass = status?.status || 'unknown';

    const name = document.createElement('div');
    name.className = 'server-name';

    if (server.avatar) {
      const avatar = document.createElement('img');
      avatar.className = 'server-avatar';
      avatar.src = server.avatar;
      avatar.alt = server.name;
      avatar.onerror = () => {
        avatar.style.display = 'none';
        name.insertBefore(this.buildInitials(server.name), name.firstChild);
      };
      name.appendChild(avatar);
    } else {
      name.appendChild(this.buildInitials(server.name));
    }

    const nameText = document.createElement('span');
    nameText.className = 'server-name-text';
    nameText.textContent = server.name;
    name.appendChild(nameText);

    if (hasUnacknowledged) {
      const alertBadge = document.createElement('div');
      alertBadge.className = 'alert-badge';
      alertBadge.textContent = unacknowledged.length;
      alertBadge.title = `${unacknowledged.length} unacknowledged alert(s)`;
      alertBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showAlertDetails(server.id);
      });
      name.appendChild(alertBadge);
    }

    const dot = document.createElement('span');
    dot.className = `status-dot ${statusClass}`;
    name.appendChild(dot);

    const meta = document.createElement('div');
    meta.className = 'server-meta';
    if (status) {
      const timeStr = status.status === 'danger'
        ? `⚠ ${status.responseTime}ms`
        : `${status.responseTime}ms`;
      meta.innerHTML = `<span>${timeStr}</span><span>${this.formatTime(status.lastCheck)}</span>`;
    } else {
      meta.innerHTML = `<span>${t('srv.never', this.state.lang)}</span>`;
    }

    if (status?.history?.length > 0) {
      const graph = document.createElement('div');
      graph.className = 'ping-graph';
      const times = status.history.map(h => h.time || 0);
      const maxTime = Math.max(...times, status.dangerMs || 1000, 100);
      const minTime = Math.min(...times.filter(t => t > 0), 0);
      const range = maxTime - minTime;
      const scale = range < 50 ? 2.5 : range < 100 ? 1.8 : 1.2;
      
      status.history.slice(-30).forEach(h => {
        const bar = document.createElement('div');
        let barClass = 'ping-bar';
        if (h.status === 'offline' || h.status === 'timeout') barClass += ' offline';
        else if (h.status === 'danger' || h.time > (status.dangerMs || 1000)) barClass += ' danger';
        bar.className = barClass;
        const normalizedTime = h.time - minTime;
        const height = Math.max(3, (normalizedTime / maxTime) * 16 * scale);
        bar.style.height = Math.min(height, 20) + 'px';
        graph.appendChild(bar);
      });
      item.appendChild(graph);
    }

    if (server.logs?.length > 0) {
      const logsDiv = document.createElement('div');
      logsDiv.className = 'server-logs-mini';
      server.logs.forEach(log => {
        const chip = document.createElement('span');
        chip.className = 'log-chip' + (log.id === this.state.currentLogId && server.id === this.state.currentServerId ? ' active' : '');
        chip.textContent = log.name;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectLog(server.id, log.id);
        });
        logsDiv.appendChild(chip);
      });
      item.appendChild(logsDiv);
    }

    item.addEventListener('click', () => this.selectServer(server.id));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showServerContextMenu(e, server.id);
    });

    item.append(name, meta);
    return item;
  }

  buildInitials(name) {
    const initials = document.createElement('div');
    initials.className = 'server-avatar-initial';
    const n = name || '?';
    initials.textContent = n.length <= 2 ? n : n.charAt(0).toUpperCase();
    return initials;
  }

  renderMainArea() {
    const server = this.getCurrentServer();
    const log = this.getCurrentLog();

    if (this.state.showManual) {
      this.content.style.display = 'none';
      this.favoritesView.style.display = 'none';
      this.manualView.style.display = 'block';
      this.toolbar.style.display = 'none';
      this.statsPanel.style.display = 'none';
      this.renderManual();
      return;
    }

    if (this.state.showFavorites) {
      this.content.style.display = 'none';
      this.manualView.style.display = 'none';
      this.favoritesView.style.display = 'block';
      this.toolbar.style.display = 'none';
      this.statsPanel.style.display = 'none';
      this.renderFavorites();
      return;
    }

    this.manualView.style.display = 'none';
    this.favoritesView.style.display = 'none';
    this.content.style.display = 'block';
    this.toolbar.style.display = 'flex';

    if (!server) {
      this.content.innerHTML = `<div class="empty-state"><div style="font-size:24px;">🛰️</div><div>${t('srv.noServers', this.state.lang)}</div></div>`;
      return;
    }
    if (!log) {
      this.content.innerHTML = `<div class="empty-state"><div style="font-size:24px;">📜</div><div>${t('srv.addLog', this.state.lang)}</div></div>`;
      return;
    }

    this.showCachedLog();
    this.loadCurrentLog(true);
  }

  getCurrentServer() { return this.config.servers.find(s => s.id === this.state.currentServerId); }
  getCurrentLog() {
    const server = this.getCurrentServer();
    if (!server) return null;
    return server.logs?.find(l => l.id === this.state.currentLogId);
  }

  selectServer(serverId) {
    if (this.activeAbortController) { this.activeAbortController.abort(); this.activeAbortController = null; }
    this.state.currentServerId = serverId;
    const server = this.getCurrentServer();
    if (server?.logs?.length > 0) this.state.currentLogId = server.logs[0].id;
    this.state.displayedLines = [];
    this.state.lastContentHash = null;
    this.content.innerHTML = '';
    this.renderServers();
    this.renderMainArea();
    this.saveState();
  }

  selectLog(serverId, logId) {
    if (this.activeAbortController) { this.activeAbortController.abort(); this.activeAbortController = null; }
    this.state.currentServerId = serverId;
    this.state.currentLogId = logId;
    this.state.displayedLines = [];
    this.state.lastContentHash = null;
    this.content.innerHTML = '';
    this.renderServers();
    this.renderMainArea();
    this.saveState();
  }

  showCachedLog() {
    const log = this.getCurrentLog();
    if (!log) return;
    const cached = this.cache[log.url];
    if (cached && cached.length > 0) {
      this.content.innerHTML = '';
      this.state.displayedLines = [];
      const fragment = document.createDocumentFragment();
      cached.forEach(line => {
        const el = this.renderLine(line);
        if (el) { fragment.appendChild(el); this.state.displayedLines.push(line); }
      });
      this.content.appendChild(fragment);
      this.applySearch();
      this.scrollToBottom();
      this.updateStats();
    } else if (this.content.innerHTML === '' || this.content.querySelector('.empty-state')) {
      this.content.innerHTML = `<div class="loading">${t('widget.loading', this.state.lang)}</div>`;
    }
  }

  async fetchLogText(log, signal) {
    try {
      const response = await fetch(log.url, { cache: 'no-store', credentials: 'omit', signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'fetchLog', url: log.url }, resolve);
      });
      if (response?.success) return response.text;
      throw new Error(response?.error || e.message);
    }
  }

  async loadCurrentLog(isFirst = false) {
    const log = this.getCurrentLog();
    if (!log) return;
    if (this.activeAbortController) this.activeAbortController.abort();
    const controller = new AbortController();
    this.activeAbortController = controller;

    try {
      const text = await this.fetchLogText(log, controller.signal);
      if (controller.signal.aborted) return;
      this.activeAbortController = null;
      this.processLog(text);
      const lines = text.split('\n').filter(l => l.trim()).slice(-BSM_CONFIG.MAX_DISPLAYED_LINES);
      this.cache[log.url] = lines;
      this.saveState();
      this.checkTriggerAlerts(lines, null);
    } catch (e) {
      if (e.name === 'AbortError') return;
      if (isFirst) {
        this.content.innerHTML = `<div class="no-config">${t('widget.error', this.state.lang)}: ${this.escapeHtml(e.message)}</div>`;
      }
    }
  }

  processLog(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const lastLines = lines.slice(-BSM_CONFIG.MAX_DISPLAYED_LINES);
    const contentHash = this.hashLine(lastLines.join('\n'));

    if (this.state.lastContentHash === contentHash) return;
    this.state.lastContentHash = contentHash;

    if (this.state.displayedLines.length === lastLines.length &&
        this.state.displayedLines.every((line, i) => line === lastLines[i])) {
      return;
    }

    const oldSet = new Set(this.state.displayedLines.map(l => this.hashLine(l)));
    const newLines = lastLines.filter(l => !oldSet.has(this.hashLine(l)));

    if (newLines.length === 0 && this.state.displayedLines.length !== lastLines.length) {
      this.content.innerHTML = '';
      this.state.displayedLines = [];
      const fragment = document.createDocumentFragment();
      lastLines.forEach(line => {
        const el = this.renderLine(line);
        if (el) { fragment.appendChild(el); this.state.displayedLines.push(line); }
      });
      this.content.appendChild(fragment);
      this.applySearch();
      this.updateStats();
      this.saveState();
      return;
    }

    const excess = (this.state.displayedLines.length + newLines.length) - BSM_CONFIG.MAX_DISPLAYED_LINES;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        const first = this.content.firstChild;
        if (first) { first.remove(); this.state.displayedLines.shift(); }
      }
    }

    const wasAtBottom = this.isAtBottom();
    const fragment = document.createDocumentFragment();
    newLines.forEach(line => {
      const el = this.renderLine(line);
      if (el) { fragment.appendChild(el); this.state.displayedLines.push(line); }
    });

    const placeholder = this.content.querySelector('.loading, .no-config, .empty-state');
    if (placeholder) placeholder.remove();

    this.content.appendChild(fragment);
    this.applySearch();
    this.updateStats();

    if (wasAtBottom || this.state.displayedLines.length <= BSM_CONFIG.MAX_DISPLAYED_LINES) {
      this.scrollToBottom();
      this.state.userScrolled = false;
      this.newMsgIndicator.classList.remove('visible');
    } else if (newLines.length > 0) {
      this.state.newMessagesCount += newLines.length;
      this.showNewMessagesIndicator();
    }
    this.saveState();
  }

  renderLine(line) {
    const blCheck = this.checkBlacklist(line);
    if (blCheck.match && blCheck.rule.mode === 'hide_line') return null;

    const filtered = this.applyFilters(line);
    if (!filtered.trim()) return null;

    const div = document.createElement('div');
    div.className = 'log-line';
    div.dataset.original = line;
    div.dataset.hash = this.hashLine(line);

    const level = this.detectLevel(line);
    if (level) div.classList.add(level);

    const log = this.getCurrentLog();
    const favKey = log ? `${this.state.currentServerId}:${log.id}` : '';
    const isFav = this.config.favorites[favKey]?.includes(div.dataset.hash);
    if (isFav) div.classList.add('favorite');

    const favBtn = document.createElement('button');
    favBtn.className = 'fav-btn';
    favBtn.innerHTML = isFav ? '★' : '☆';
    favBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleFavorite(line); });
    div.appendChild(favBtn);

    if (level === 'error' && this.config.ai?.enabled) {
      const aiBtn = document.createElement('button');
      aiBtn.className = 'ai-btn';
      aiBtn.innerHTML = '🤖';
      aiBtn.addEventListener('click', (e) => { e.stopPropagation(); this.showAIAnalysis(line); });
      div.appendChild(aiBtn);
    }

    div.addEventListener('contextmenu', (e) => this.showContextMenu(e, line));

    const chatMatch = filtered.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3} \[MESSAGE\] - ([^\s\[]+)\s*(<([^>]+)>)?\s*\[([^\]]+)\]>\s*(.*)$/);

    if (chatMatch) {
      const [, time, channel, , sender, receiver, msg] = chatMatch;
      div.classList.add('message');
      let processedMsg = this.escapeHtml(msg);
      processedMsg = this.applyMasking(processedMsg);
      processedMsg = this.applyTriggers(processedMsg);
      const content = document.createElement('span');
      content.innerHTML = `
        <span class="timestamp">${this.escapeHtml(time)}</span>
        <span class="channel">${this.escapeHtml(channel.trim())}</span>
        ${sender ? `<span class="player">&lt;${this.escapeHtml(sender)}&gt;</span>` : ''}
        <span class="player">[${this.escapeHtml(receiver)}]</span>
        <span class="message-text">${processedMsg}</span>
      `;
      div.insertBefore(content, div.firstChild);
      if (this.hasTrigger(msg)) div.classList.add('triggered');
    } else {
      const infoMatch = filtered.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d{3}\s+(INFO|WARN|ERROR)/);
      if (infoMatch) {
        div.classList.add('info');
        let processed = this.escapeHtml(filtered);
        processed = this.applyMasking(processed);
        processed = this.applyTriggers(processed);
        const content = document.createElement('span');
        content.innerHTML = `<span class="timestamp">${this.escapeHtml(infoMatch[1])}</span>${processed.substring(23)}`;
        div.insertBefore(content, div.firstChild);
      } else {
        let processed = this.escapeHtml(filtered);
        processed = this.applyMasking(processed);
        processed = this.applyTriggers(processed);
        div.innerHTML = processed + div.innerHTML;
      }
    }
    return div;
  }

  detectLevel(line) {
    if (/\bERROR\b|\bFATAL\b|\bException\b/i.test(line)) return 'error';
    if (/\bWARN\b|\bWARNING\b/i.test(line)) return 'warn';
    if (/\bINFO\b/i.test(line)) return 'info';
    return null;
  }

  applySearch() {
    const query = this.state.searchQuery.trim();
    const level = this.state.levelFilter;
    const lines = this.content.querySelectorAll('.log-line');
    this.clearHighlights();

    let regex = null;
    if (query) {
      try { regex = new RegExp(query, 'gi'); }
      catch (e) { regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); }
    }

    lines.forEach(line => {
      const text = line.dataset.original || '';
      const lineLevel = this.detectLevel(text);
      const levelMatch = level === 'all' || lineLevel === level;
      let searchMatch = true;
      if (regex) {
        searchMatch = regex.test(text);
        regex.lastIndex = 0;
      }
      if (levelMatch && searchMatch) {
        line.style.display = '';
        if (regex && query) this.highlightSearchMatches(line, regex);
      } else {
        line.style.display = 'none';
      }
    });
  }

  clearHighlights() {
    this.content.querySelectorAll('.search-match').forEach(span => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    });
  }

  highlightSearchMatches(line, regex) {
    const textNodes = [];
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT, null, false);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('.fav-btn, .ai-btn, .timestamp, .search-match')) continue;
      textNodes.push(node);
    }
    textNodes.forEach(node => {
      const text = node.textContent;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIdx = 0, match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) frag.appendChild(document.createTextNode(text.substring(lastIdx, match.index)));
        const span = document.createElement('span');
        span.className = 'search-match';
        span.textContent = match[0];
        frag.appendChild(span);
        lastIdx = regex.lastIndex;
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.substring(lastIdx)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  toggleStats() {
    this.state.showStats = !this.state.showStats;
    this.statsPanel.style.display = this.state.showStats ? 'grid' : 'none';
    this.statsBtn.classList.toggle('active', this.state.showStats);
    if (this.state.showStats) this.updateStats();
    this.saveState();
  }

  updateStats() {
    if (!this.state.showStats) return;
    const lines = this.state.displayedLines;
    let errors = 0, warnings = 0;
    const errorMap = {};
    lines.forEach(line => {
      if (/\bERROR\b|\bFATAL\b/.test(line)) {
        errors++;
        const match = line.match(/(\w+Exception|\w+Error)/);
        if (match) errorMap[match[1]] = (errorMap[match[1]] || 0) + 1;
      }
      if (/\bWARN\b|\bWARNING\b/.test(line)) warnings++;
    });
    const server = this.getCurrentServer();
    const status = server ? this.serverStatus[server.id] : null;
    const avgResponse = status?.history?.length > 0
      ? Math.round(status.history.reduce((s, h) => s + (h.time || 0), 0) / status.history.length)
      : 0;
    const onlineCount = status?.history?.filter(h => h.status === 'online').length || 0;
    const uptime = status?.history?.length > 0
      ? Math.round((onlineCount / status.history.length) * 100)
      : 0;

    this.statsPanel.innerHTML = `
      <div class="stat-card"><div class="stat-value error">${errors}</div><div class="stat-label">${t('stats.errorsToday', this.state.lang)}</div></div>
      <div class="stat-card"><div class="stat-value warn">${warnings}</div><div class="stat-label">${t('stats.warningsToday', this.state.lang)}</div></div>
      <div class="stat-card"><div class="stat-value">${avgResponse}ms</div><div class="stat-label">${t('stats.avgResponse', this.state.lang)}</div></div>
      <div class="stat-card"><div class="stat-value">${uptime}%</div><div class="stat-label">${t('stats.uptime', this.state.lang)}</div></div>
    `;
  }

  toggleFavorites() {
    this.state.showFavorites = !this.state.showFavorites;
    this.favBtn.classList.toggle('active', this.state.showFavorites);
    if (this.state.showFavorites) this.renderFavorites();
    else this.renderMainArea();
    this.saveState();
  }

  async toggleFavorite(line) {
    const log = this.getCurrentLog();
    if (!log) return;
    const favKey = `${this.state.currentServerId}:${log.id}`;
    const hash = this.hashLine(line);
    if (!this.config.favorites[favKey]) this.config.favorites[favKey] = [];
    const idx = this.config.favorites[favKey].indexOf(hash);
    if (idx >= 0) this.config.favorites[favKey].splice(idx, 1);
    else {
      this.config.favorites[favKey].push(hash);
      const dataKey = favKey + '_data';
      if (!this.config.favorites[dataKey]) this.config.favorites[dataKey] = {};
      this.config.favorites[dataKey][hash] = line;
    }
    try { await chrome.storage.sync.set({ favorites: this.config.favorites }); }
    catch (e) { this.toast('Failed to save favorite', 'error'); }
    const lineEl = this.content.querySelector(`.log-line[data-hash="${hash}"]`);
    if (lineEl) {
      lineEl.classList.toggle('favorite');
      const btn = lineEl.querySelector('.fav-btn');
      if (btn) btn.innerHTML = lineEl.classList.contains('favorite') ? '★' : '☆';
    }
  }

  renderFavorites() {
    this.favoritesView.innerHTML = '';
    const log = this.getCurrentLog();
    if (!log) { this.favoritesView.innerHTML = `<div class="empty-state">${t('fav.empty', this.state.lang)}</div>`; return; }
    const favKey = `${this.state.currentServerId}:${log.id}`;
    const hashes = this.config.favorites[favKey] || [];
    const data = this.config.favorites[favKey + '_data'] || {};
    if (hashes.length === 0) { this.favoritesView.innerHTML = `<div class="empty-state">${t('fav.empty', this.state.lang)}</div>`; return; }
    const fragment = document.createDocumentFragment();
    hashes.forEach(hash => {
      const line = data[hash];
      if (!line) return;
      const el = this.renderLine(line);
      if (el) { el.classList.add('favorite'); fragment.appendChild(el); }
    });
    this.favoritesView.appendChild(fragment);
  }

  async showAIAnalysis(line) {
    if (!this.config.ai?.enabled || !this.config.ai?.apiKey) {
      this.toast(t('ai.notConfigured', this.state.lang), 'warning');
      return;
    }
    const idx = this.state.displayedLines.indexOf(line);
    const context = this.state.displayedLines
      .slice(Math.max(0, idx - BSM_CONFIG.AI_CONTEXT_LINES), idx + BSM_CONFIG.AI_CONTEXT_LINES + 1)
      .join('\n');
    this.showAIModal(t('ai.thinking', this.state.lang), true);
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'aiExplain', error: line, context }, resolve);
      });
      if (response?.success) this.showAIModal(this.formatMarkdown(response.text), false);
      else this.showAIModal(`❌ ${this.escapeHtml(response?.error || 'Unknown error')}`, false);
    } catch (e) { this.showAIModal(`❌ ${this.escapeHtml(e.message)}`, false); }
  }

  showAIModal(content, loading) {
    this.closeAIModal();
    const modal = document.createElement('div');
    modal.className = 'ai-modal';
    if (loading) {
      modal.innerHTML = `
        <div class="ai-header"><div class="ai-title">🤖 ${t('ai.result', this.state.lang)}</div></div>
        <div class="ai-content"><div class="ai-thinking"><div class="ai-spinner"></div><span>${t('ai.thinking', this.state.lang)}</span></div></div>
      `;
    } else {
      modal.innerHTML = `
        <div class="ai-header">
          <div class="ai-title">🤖 ${t('ai.result', this.state.lang)}</div>
          <button class="icon-btn" id="ai-close">✕</button>
        </div>
        <div class="ai-content">${content}</div>
        <div class="ai-footer">
          <button class="tool-btn" id="ai-copy">📋 ${t('ai.copy', this.state.lang)}</button>
          <button class="tool-btn" id="ai-close-btn">${t('ai.close', this.state.lang)}</button>
        </div>
      `;
    }
    this.mainArea.appendChild(modal);
    this.aiModal = modal;
    if (!loading) {
      modal.querySelector('#ai-close').onclick = () => this.closeAIModal();
      modal.querySelector('#ai-close-btn').onclick = () => this.closeAIModal();
      modal.querySelector('#ai-copy').onclick = () => {
        navigator.clipboard.writeText(modal.querySelector('.ai-content').innerText)
          .then(() => this.toast('Copied', 'success'))
          .catch(() => this.toast('Copy failed', 'error'));
      };
    }
  }

  closeAIModal() { if (this.aiModal) { this.aiModal.remove(); this.aiModal = null; } }

  formatMarkdown(text) {
    const escaped = this.escapeHtml(text);
    return escaped
      .replace(/```([\s\S]*?)```/g, '<pre>$1</pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/\n/g, '<br>');
  }

  downloadLog() {
    const log = this.getCurrentLog();
    if (!log) return;
    const visibleLines = Array.from(this.content.querySelectorAll('.log-line'))
      .filter(el => el.style.display !== 'none')
      .map(el => el.dataset.original)
      .join('\n');
    const blob = new Blob([visibleLines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${log.name}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async checkTriggerAlerts(lines, serverId = null) {
    const server = serverId
      ? this.config.servers.find(s => s.id === serverId)
      : this.getCurrentServer();
    if (!server?.alerts?.triggerAlerts?.length) return;

    if (!this.state.acknowledgedLineHashes[server.id]) {
      this.state.acknowledgedLineHashes[server.id] = new Set();
    }
    const ackSet = this.state.acknowledgedLineHashes[server.id];

    for (const line of lines) {
      const lineHash = this.hashLine(line);
      if (ackSet.has(lineHash)) continue;

      for (const alert of server.alerts.triggerAlerts) {
        if (!alert.word) continue;
        const match = alert.caseSensitive
          ? line.includes(alert.word)
          : line.toLowerCase().includes(alert.word.toLowerCase());

        if (match) {
          const cooldownKey = `${server.id}:${alert.word}`;
          const now = Date.now();
          if (this.alertCooldowns[cooldownKey] && now - this.alertCooldowns[cooldownKey] < BSM_CONFIG.ALERT_COOLDOWN_MS) {
            continue;
          }
          this.alertCooldowns[cooldownKey] = now;
          await this.fireAlert(server, alert, line, lineHash);
          break;
        }
      }
    }
  }

  async fireAlert(server, alert, line, lineHash) {
    if (!this.state.serverAlerts[server.id]) {
      this.state.serverAlerts[server.id] = [];
    }

    const alertObj = {
      id: 'a_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      word: alert.word,
      line: line,
      lineHash: lineHash,
      timestamp: Date.now(),
      acknowledged: false,
      sound: alert.sound || 'none',
    };

    this.state.serverAlerts[server.id].push(alertObj);
    if (this.state.serverAlerts[server.id].length > 50) {
      this.state.serverAlerts[server.id] = this.state.serverAlerts[server.id].slice(-50);
    }

    this.saveState();
    this.renderServers();

    if (alertObj.sound && alertObj.sound !== 'none' && !this.state.muted) {
      try {
        const sounds = await chrome.storage.local.get(['customSounds']);
        const customSounds = sounds.customSounds || [];
        const sound = customSounds.find(s => s.id === alertObj.sound);
        if (sound) this.playSound(sound.data);
      } catch {}
    }

    if (alert.notification) {
      try {
        chrome.notifications.create('trigger_' + alertObj.id, {
          type: 'basic',
          iconUrl: 'icon128.png',
          title: `⚠️ ${server.name}: ${alert.word}`,
          message: line.substring(0, 100),
          priority: 2,
        });
      } catch {}
    }
  }

  playSound(dataUrl) {
    if (this.state.muted) return;
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch {}
  }

  acknowledgeAlert(serverId, alertId) {
    const alerts = this.state.serverAlerts[serverId];
    if (!alerts) return;
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    alert.acknowledged = true;
    alert.acknowledgedAt = Date.now();

    if (!this.state.acknowledgedLineHashes[serverId]) {
      this.state.acknowledgedLineHashes[serverId] = new Set();
    }
    this.state.acknowledgedLineHashes[serverId].add(alert.lineHash);

    this.saveState();
    this.renderServers();

    const modal = this.mainArea.querySelector('.alert-details-modal');
    if (modal) this.showAlertDetails(serverId);
  }

  acknowledgeAllAlerts(serverId) {
    const alerts = this.state.serverAlerts[serverId];
    if (!alerts) return;

    if (!this.state.acknowledgedLineHashes[serverId]) {
      this.state.acknowledgedLineHashes[serverId] = new Set();
    }

    alerts.forEach(a => {
      if (!a.acknowledged) {
        a.acknowledged = true;
        a.acknowledgedAt = Date.now();
        this.state.acknowledgedLineHashes[serverId].add(a.lineHash);
      }
    });

    this.saveState();
    this.renderServers();

    const modal = this.mainArea.querySelector('.alert-details-modal');
    if (modal) this.showAlertDetails(serverId);
  }

  clearAcknowledgedAlerts(serverId) {
    const alerts = this.state.serverAlerts[serverId];
    if (!alerts) return;
    this.state.serverAlerts[serverId] = alerts.filter(a => !a.acknowledged);
    this.saveState();
    this.renderServers();
    const modal = this.mainArea.querySelector('.alert-details-modal');
    if (modal) this.showAlertDetails(serverId);
  }

  showAlertDetails(serverId) {
    const server = this.config.servers.find(s => s.id === serverId);
    if (!server) return;

    const old = this.mainArea.querySelector('.alert-details-modal');
    if (old) old.remove();

    const alerts = this.state.serverAlerts[serverId] || [];
    const unacknowledged = alerts.filter(a => !a.acknowledged);
    const acknowledged = alerts.filter(a => a.acknowledged);

    const modal = document.createElement('div');
    modal.className = 'alert-details-modal';

    let html = `
      <div class="alert-details-header">
        <div class="alert-details-title">⚠️ ${this.escapeHtml(server.name)} — ${unacknowledged.length} active</div>
        <button class="icon-btn" id="alert-close">✕</button>
      </div>
      <div class="alert-details-content">
    `;

    if (alerts.length === 0) {
      html += `<div style="text-align:center;padding:20px;color:var(--text-faint);">No alerts</div>`;
    } else {
      unacknowledged.forEach(alert => {
        html += this.renderAlertItemHTML(alert, false);
      });
      if (acknowledged.length > 0) {
        html += `<div style="margin:12px 0 8px;font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:0.5px;">Acknowledged (${acknowledged.length})</div>`;
        acknowledged.slice(-10).forEach(alert => {
          html += this.renderAlertItemHTML(alert, true);
        });
      }
    }

    html += `</div><div class="alert-details-footer">`;
    if (unacknowledged.length > 0) {
      html += `<button class="tool-btn" id="acknowledge-all" style="background:rgba(74,222,128,0.1);color:#4ade80;border-color:rgba(74,222,128,0.3);">✓ Acknowledge all (${unacknowledged.length})</button>`;
    }
    if (acknowledged.length > 0) {
      html += `<button class="tool-btn" id="clear-ack" style="margin-left:auto;">🗑 Clear old</button>`;
    }
    html += `</div>`;

    modal.innerHTML = html;
    this.mainArea.appendChild(modal);

    modal.querySelector('#alert-close').onclick = () => modal.remove();

    modal.querySelectorAll('.acknowledge-btn').forEach(btn => {
      btn.onclick = () => {
        const alertId = btn.dataset.alertId;
        this.acknowledgeAlert(serverId, alertId);
      };
    });

    const ackAllBtn = modal.querySelector('#acknowledge-all');
    if (ackAllBtn) ackAllBtn.onclick = () => this.acknowledgeAllAlerts(serverId);

    const clearBtn = modal.querySelector('#clear-ack');
    if (clearBtn) clearBtn.onclick = () => this.clearAcknowledgedAlerts(serverId);
  }

  renderAlertItemHTML(alert, isAcknowledged) {
    const time = new Date(alert.timestamp).toLocaleTimeString(this.state.lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `
      <div class="alert-item ${isAcknowledged ? 'acknowledged' : ''}">
        <div class="alert-word">
          <span>${this.escapeHtml(alert.word)}</span>
          <span class="alert-time">${time}</span>
        </div>
        <div class="alert-line">${this.escapeHtml(alert.line?.substring(0, 200) || '')}</div>
        ${isAcknowledged
          ? `<button class="tool-btn acknowledge-btn acknowledged" disabled>✓ Acknowledged</button>`
          : `<button class="tool-btn acknowledge-btn" data-alert-id="${alert.id}">✓ Acknowledge</button>`
        }
      </div>
    `;
  }

  setupListeners() {
    const msgHandler = async (msg) => {
      if (msg.action === 'pingUpdate') {
        this.serverStatus[msg.serverId] = msg.status;
        this.renderServers();
        if (this.state.showStats) this.updateStats();
      }
      if (msg.action === 'playSound') this.playSound(msg.soundData);
      if (msg.action === 'alertTriggered') {
        if (!this.state.serverAlerts[msg.serverId]) this.state.serverAlerts[msg.serverId] = [];
        this.state.serverAlerts[msg.serverId].push({
          id: 'offline_' + Date.now(),
          word: 'OFFLINE',
          line: 'Server is not responding',
          lineHash: this.hashLine('offline_' + msg.serverId),
          timestamp: Date.now(),
          acknowledged: false,
          sound: 'none',
        });
        this.saveState();
        this.renderServers();
      }
      if (msg.action === 'toggleMute') this.toggleMute();
      if (msg.action === 'refresh') this.refresh();
      if (msg.action === 'restartLogUpdates') {
        this.startAutoRefresh();
      }
    };
    chrome.runtime.onMessage.addListener(msgHandler);
    this._listenersCleanup.push(() => chrome.runtime.onMessage.removeListener(msgHandler));

    const storageHandler = (changes, area) => {
      if (area === 'sync') {
        if (changes.servers) {
          this.config.servers = changes.servers.newValue || [];
          this.renderServers();
          this.renderMainArea();
          this.startAutoRefresh();
        }
        if (changes.triggers) { this.config.triggers = changes.triggers.newValue || []; this.refresh(); }
        if (changes.theme) { this.config.theme = changes.theme.newValue || {}; this.applyTheme(); }
        if (changes.filters) { this.config.filters = changes.filters.newValue || []; this.refresh(); }
        if (changes.blacklist) { this.config.blacklist = changes.blacklist.newValue || []; this.refresh(); }
        if (changes.ai) { this.config.ai = changes.ai.newValue || {}; }
        if (changes.lang) {
          this.state.lang = changes.lang.newValue;
          chrome.storage.local.set({ lang: this.state.lang });
          this.createUI();
        }
      }
      if (area === 'local') {
        if (changes.serverStatus) { this.serverStatus = changes.serverStatus.newValue || {}; this.renderServers(); }
        if (changes.cache) { this.cache = changes.cache.newValue || {}; }
      }
    };
    chrome.storage.onChanged.addListener(storageHandler);
    this._listenersCleanup.push(() => chrome.storage.onChanged.removeListener(storageHandler));

    const clickHandler = () => this.closeContextMenu();
    document.addEventListener('click', clickHandler);
    this._listenersCleanup.push(() => document.removeEventListener('click', clickHandler));
  }

  formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString(this.state.lang, { hour: '2-digit', minute: '2-digit' });
  }

  hashLine(line) {
    let h = 0;
    for (let i = 0; i < line.length; i++) { h = ((h << 5) - h) + line.charCodeAt(i); h |= 0; }
    return h.toString(36);
  }

  checkBlacklist(line) {
    for (const bl of this.config.blacklist) {
      if (!bl.word) continue;
      const match = bl.caseSensitive ? line.includes(bl.word) : line.toLowerCase().includes(bl.word.toLowerCase());
      if (match) return { match: true, rule: bl };
    }
    return { match: false };
  }

  applyMasking(text) {
    if (!this.config.blacklist.length) return text;
    let result = text;
    this.config.blacklist.forEach(bl => {
      if (bl.mode !== 'mask_word' || !bl.word) return;
      const flags = bl.caseSensitive ? 'g' : 'gi';
      try {
        const regex = new RegExp(`(${this.escapeRegex(bl.word)})`, flags);
        result = result.replace(regex, '<span class="masked-word">***</span>');
      } catch {}
    });
    return result;
  }

  applyFilters(originalLine) {
    let result = originalLine;
    for (const f of this.config.filters) result = this.applyOneFilter(result, f);
    return result;
  }

  applyOneFilter(text, f) {
    try {
      switch (f.type) {
        case 'trim_start': return text.substring(Math.min(f.value, text.length));
        case 'trim_end': return text.substring(0, Math.max(0, text.length - f.value));
        case 'hide_exact': return text.split(f.value).join('');
        case 'hide_regex': return text.replace(new RegExp(f.value, 'g'), '');
        case 'hide_date': return text.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}\s*/, '');
        case 'hide_tag_message': return text.replace(/\s*\[MESSAGE\] - /g, ' ');
        case 'trim_before_text': { const idx = text.indexOf(f.value); return idx === -1 ? text : text.substring(idx); }
        case 'trim_after_text': { const idx = text.indexOf(f.value); return idx === -1 ? text : text.substring(0, idx + f.value.length); }
        case 'trim_exact_text': return text.split(f.value).join('');
      }
    } catch {}
    return text;
  }

  applyTriggers(text) {
    if (!this.config.triggers.length) return text;
    this.config.triggers.forEach(trigger => {
      if (!trigger.word) return;
      const regex = new RegExp(`(${this.escapeRegex(trigger.word)})`, 'gi');
      const color = trigger.color || '#facc15';
      const bold = trigger.bold !== false;
      const bg = trigger.bg || 'rgba(250,204,21,0.15)';
      text = text.replace(regex, `<span class="trigger-highlight" style="color:${color};background:${bg};${bold ? 'font-weight:700;' : ''}">$1</span>`);
    });
    return text;
  }

  hasTrigger(text) {
    return this.config.triggers.some(tr => tr.word && text.toLowerCase().includes(tr.word.toLowerCase()));
  }

  escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  escapeHtml(text) {
    if (text == null) return '';
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  isAtBottom() { return this.content.scrollHeight - this.content.scrollTop - this.content.clientHeight < BSM_CONFIG.SCROLL_THRESHOLD_PX; }
  getBrowserLang() { return (navigator.language || 'en').split('-')[0]; }

  handleScroll() {
    this.state.userScrolled = !this.isAtBottom();
    if (this.isAtBottom()) {
      this.newMsgIndicator.classList.remove('visible');
      this.state.newMessagesCount = 0;
    }
  }

  scrollToBottom() {
    this.content.scrollTop = this.content.scrollHeight;
    this.state.userScrolled = false;
    this.state.newMessagesCount = 0;
    this.newMsgIndicator.classList.remove('visible');
  }

  showNewMessagesIndicator() {
    this.newMsgIndicator.textContent = `↓ ${this.state.newMessagesCount} ${t('widget.newMessages', this.state.lang)}`;
    this.newMsgIndicator.classList.add('visible');
  }

  refresh() {
    this.state.displayedLines = [];
    this.state.lastContentHash = null;
    this.content.innerHTML = '';
    this.loadCurrentLog(true);
  }

  applyTheme() {
    const th = this.config.theme;
    const root = document.body;
    
    if (th.bg) root.style.setProperty('--panel-bg', th.bg);
    if (th.text) root.style.setProperty('--text-primary', th.text);
    if (th.textSecondary) root.style.setProperty('--text-secondary', th.textSecondary);
    
    const ext = th.extended;
    if (ext) {
      try {
        if (ext.fontFamily) root.style.setProperty('--log-font-family', ext.fontFamily);
        if (ext.fontSize) root.style.setProperty('--log-font-size', ext.fontSize + 'px');
        if (ext.lineHeight) root.style.setProperty('--log-line-height', ext.lineHeight);
        if (ext.letterSpacing !== undefined) root.style.setProperty('--log-letter-spacing', ext.letterSpacing + 'px');
        if (ext.fontBold) root.style.setProperty('--log-font-weight', '600');
        else root.style.setProperty('--log-font-weight', 'normal');
        
        if (ext.borderWidth !== undefined) root.style.setProperty('--log-border-width', ext.borderWidth + 'px');
        if (ext.borderRadius !== undefined) root.style.setProperty('--log-border-radius', ext.borderRadius + 'px');
        if (ext.borderStyle) root.style.setProperty('--log-border-style', ext.borderStyle);
        
        const safeHexToRgba = (hex, alpha, fallback) => {
          if (!hex) return fallback;
          try { return hexToRgba(hex, alpha); } catch (e) { return fallback; }
        };
        
        if (ext.errorBg) root.style.setProperty('--error-bg', safeHexToRgba(ext.errorBg, ext.errorBgAlpha || 0.08, 'rgba(239, 68, 68, 0.04)'));
        if (ext.warnBg) root.style.setProperty('--warn-bg', safeHexToRgba(ext.warnBg, ext.warnBgAlpha || 0.08, 'rgba(250, 204, 21, 0.08)'));
        if (ext.hoverBg) root.style.setProperty('--hover-bg', safeHexToRgba(ext.hoverBg, ext.hoverBgAlpha || 0.05, 'rgba(255, 255, 255, 0.03)'));
      } catch (e) {
        console.error('[BSM] applyTheme extended failed:', e);
      }
    }
  }

  toggleAutoUpdate() {
    if (Object.keys(this.logTimers).length > 0) {
      this.stopAutoRefresh();
    } else {
      this.startAutoRefresh();
    }
  }

  startAutoRefresh() {
    this.stopAutoRefresh();
    
    this.config.servers.forEach(server => {
      if (!server.logs) return;
      server.logs.forEach(log => {
        if (!log.url || !log.interval) return;
        const intervalMs = log.interval * 1000;
        this.loadLogForServer(server.id, log.id);
        const timerId = setInterval(() => {
          this.loadLogForServer(server.id, log.id);
        }, intervalMs);
        this.logTimers[`${server.id}:${log.id}`] = timerId;
      });
    });
    
    if (this.autoBtn) { 
      this.autoBtn.innerHTML = '⏸'; 
      this.autoBtn.classList.add('active'); 
    }
  }

  stopAutoRefresh() {
    Object.values(this.logTimers).forEach(timerId => clearInterval(timerId));
    this.logTimers = {};
    if (this.autoBtn) { 
      this.autoBtn.innerHTML = '▶'; 
      this.autoBtn.classList.remove('active'); 
    }
  }

  async loadLogForServer(serverId, logId) {
    const server = this.config.servers.find(s => s.id === serverId);
    if (!server) return;
    const log = server.logs.find(l => l.id === logId);
    if (!log) return;
    
    try {
      const text = await this.fetchLogText(log);
      const lines = text.split('\n').filter(l => l.trim()).slice(-BSM_CONFIG.MAX_DISPLAYED_LINES);
      this.cache[log.url] = lines;
      
      const prevLines = this.cache[log.url + '_prev'] || [];
      const newLines = lines.filter(l => !prevLines.includes(l));
      this.cache[log.url + '_prev'] = lines;
      
      if (newLines.length > 0) {
        this.checkTriggerAlerts(newLines, serverId);
      }
      
      if (serverId === this.state.currentServerId && logId === this.state.currentLogId) {
        this.processLog(text);
      }
      
      this.saveState();
    } catch (e) {
      console.error(`[BSM] Failed to load log ${log.name}:`, e.message);
    }
  }

  toggleManual() {
    this.state.showManual = !this.state.showManual;
    this.state.showFavorites = false;
    this.manualBtn.classList.toggle('active', this.state.showManual);
    this.renderMainArea();
    this.saveState();
  }

  toggleSidebar() {
    this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    this.serverList.classList.toggle('collapsed', this.state.sidebarCollapsed);
    this.collapseBtn.innerHTML = this.state.sidebarCollapsed ? '▶' : '◀';
    this.saveState();
  }

  setupVerticalResize() {
    let startX, startWidth;
    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startWidth = this.serverList.offsetWidth;
      this.resizeHandle.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      const onMouseMove = (e) => {
        const dx = e.clientX - startX;
        const newWidth = Math.max(BSM_CONFIG.SIDEBAR_MIN_WIDTH, Math.min(BSM_CONFIG.SIDEBAR_MAX_WIDTH, startWidth + dx));
        this.serverList.style.width = newWidth + 'px';
        this.state.sidebarCollapsed = false;
      };
      const onMouseUp = () => {
        this.resizeHandle.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        chrome.storage.local.set({ sidebarWidth: this.serverList.offsetWidth });
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  renderManual() {
    const L = this.state.lang;
    const sections = Array.from({ length: 12 }, (_, i) => i + 1);
    let html = `<div class="manual-hero"><h2>${this.escapeHtml(t('manual.title', L))}</h2><p>${this.escapeHtml(t('manual.intro', L))}</p></div>`;
    sections.forEach(n => {
      const title = t(`manual.section${n}.title`, L);
      const text = t(`manual.section${n}.text`, L);
      if (title && text && !title.startsWith('manual.')) {
        html += `<div class="manual-section"><h3>${this.escapeHtml(title)}</h3><div>${text}</div></div>`;
      }
    });
    html += `<div style="text-align:center;padding:10px;color:rgba(255,255,255,0.4);font-size:11px;">${this.escapeHtml(t('manual.footer', L))}</div>`;
    this.manualView.innerHTML = html;
  }

  openOptions() { chrome.runtime.sendMessage({ action: 'openOptions' }); }

  showContextMenu(e, originalLine) {
    e.preventDefault();
    e.stopPropagation();
    this.closeContextMenu();
    const selection = window.getSelection().toString();
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    const quick = document.createElement('div');
    quick.className = 'menu-section';
    quick.innerHTML = `<div class="menu-label">${t('menu.actions', this.state.lang)}</div>`;

    const items = [
      { icon: '📋', text: t('menu.copyLine', this.state.lang), handler: () => navigator.clipboard.writeText(originalLine).catch(() => {}) },
      { icon: '★', text: t('fav.add', this.state.lang), handler: () => this.toggleFavorite(originalLine) },
    ];
    if (selection) {
      items.push({ icon: '📄', text: t('menu.copySelection', this.state.lang), handler: () => navigator.clipboard.writeText(selection).catch(() => {}) });
      items.push({ icon: '✂', text: t('menu.trimSelection', this.state.lang), handler: () => this.addFilter({ type: 'trim_exact_text', value: selection, scope: 'all', name: `✂ "${selection}"` }) });
      items.push({ icon: '◀', text: t('menu.trimBeforeSelection', this.state.lang), handler: () => this.addFilter({ type: 'trim_before_text', value: selection, scope: 'all', name: `◀ "${selection}"` }) });
      items.push({ icon: '▶', text: t('menu.trimAfterSelection', this.state.lang), handler: () => this.addFilter({ type: 'trim_after_text', value: selection, scope: 'all', name: `▶ "${selection}"` }) });
    }
    if (this.detectLevel(originalLine) === 'error' && this.config.ai?.enabled) {
      items.push({ icon: '🤖', text: t('ai.explain', this.state.lang), handler: () => this.showAIAnalysis(originalLine) });
    }
    items.forEach(a => {
      const item = document.createElement('div');
      item.className = 'menu-item';
      item.innerHTML = `<span class="icon">${a.icon}</span><span>${this.escapeHtml(a.text)}</span>`;
      item.onclick = (ev) => { ev.stopPropagation(); this.closeContextMenu(); a.handler(); };
      quick.appendChild(item);
    });
    menu.appendChild(quick);
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let left = e.clientX, top = e.clientY;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    this.contextMenu = menu;
  }

  closeContextMenu() { if (this.contextMenu) { this.contextMenu.remove(); this.contextMenu = null; } }

  async addFilter(filter) {
    filter.id = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    this.config.filters.push(filter);
    try { await chrome.storage.sync.set({ filters: this.config.filters }); }
    catch (e) { this.toast('Failed to save filter', 'error'); }
    this.refresh();
  }

  toggleMute() {
    this.state.muted = !this.state.muted;
    if (this.muteBtn) {
      this.muteBtn.innerHTML = this.state.muted ? '🔇' : '🔊';
      this.muteBtn.title = this.state.muted ? t('widget.unmute', this.state.lang) : t('widget.mute', this.state.lang);
      this.muteBtn.classList.toggle('muted', this.state.muted);
    }
    this.saveState();
  }

  showServerContextMenu(e, serverId) {
    this.closeContextMenu();
    const alerts = this.state.serverAlerts[serverId] || [];
    const unacknowledged = alerts.filter(a => !a.acknowledged);
    if (unacknowledged.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    const quick = document.createElement('div');
    quick.className = 'menu-section';
    const item = document.createElement('div');
    item.className = 'menu-item';
    item.innerHTML = `<span class="icon">✓</span><span>Acknowledge all (${unacknowledged.length})</span>`;
    item.onclick = (ev) => {
      ev.stopPropagation();
      this.closeContextMenu();
      this.acknowledgeAllAlerts(serverId);
    };
    quick.appendChild(item);
    menu.appendChild(quick);
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    let left = e.clientX, top = e.clientY;
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8;
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    this.contextMenu = menu;
  }

  destroy() {
    this.stopAutoRefresh();
    if (this.activeAbortController) this.activeAbortController.abort();
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this._listenersCleanup.forEach(fn => fn());
    this._listenersCleanup = [];
    this.closeAIModal();
    this.closeContextMenu();
  }
}

const bsmPanel = new BSMPanel();
window.addEventListener('unload', () => bsmPanel.destroy());