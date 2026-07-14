// ============ КОНСТАНТЫ ============
const CONFIG = {
  MAX_HISTORY: 60,
  ALERT_COOLDOWN_MS: 5 * 60 * 1000,
  FETCH_LOG_TIMEOUT_MS: 15000,
  AI_MAX_TOKENS: 500,
  DEFAULT_PING_INTERVAL_S: 30,
  DEFAULT_TIMEOUT_S: 5,
  DEFAULT_DANGER_MS: 1000,
  STORAGE_BATCH_DELAY_MS: 500,
  MIN_ALARM_INTERVAL_MIN: 0.5,
};

// ============ СОСТОЯНИЕ ============
const pingState = new Map();
let storageWriteTimer = null;
let pendingStatusUpdates = {};

// ============ ИНИЦИАЛИЗАЦИЯ ============
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(null);
  if (!data.servers) {
    await chrome.storage.sync.set({
      servers: [], triggers: [], theme: {}, filters: [],
      blacklist: [], lang: 'en', showManual: true,
      ai: { enabled: false, provider: 'openai', apiKey: '', model: 'gpt-4o-mini' },
      favorites: {},
    });
  }
  await schedulePings();
});

chrome.runtime.onStartup.addListener(async () => {
  await schedulePings();
});

// ============ SIDE PANEL ============
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ============ УТИЛИТЫ ============
function isValidUrl(str) {
  try {
    const u = new URL(str.startsWith('http') ? str : `http://${str}`);
    return ['http:', 'https:'].includes(u.protocol);
  } catch { return false; }
}

function batchStatusUpdate(serverId, statusObj) {
  pendingStatusUpdates[serverId] = statusObj;
  if (storageWriteTimer) return;
  storageWriteTimer = setTimeout(async () => {
    storageWriteTimer = null;
    const batch = { ...pendingStatusUpdates };
    pendingStatusUpdates = {};
    try {
      const data = await chrome.storage.local.get(['serverStatus']);
      const statuses = data.serverStatus || {};
      Object.assign(statuses, batch);
      await chrome.storage.local.set({ serverStatus: statuses });
      chrome.runtime.sendMessage({
        action: 'pingUpdate',
        serverId,
        status: statusObj,
        fromBackground: true,
      }).catch(() => {});
    } catch (e) { console.error('[ping] storage write failed:', e); }
  }, CONFIG.STORAGE_BATCH_DELAY_MS);
}

// ============ ПИНГ через chrome.alarms ============
async function schedulePings() {
  const allAlarms = await chrome.alarms.getAll();
  for (const alarm of allAlarms) {
    if (alarm.name.startsWith('ping_')) {
      await chrome.alarms.clear(alarm.name);
    }
  }
  pingState.clear();

  const data = await chrome.storage.sync.get(['servers']);
  const servers = data.servers || [];

  for (const server of servers) {
    if (!server.ping?.enabled || !server.ping.url) continue;
    if (!isValidUrl(server.ping.url)) continue;

    const intervalSec = Math.max(5, server.ping.interval || CONFIG.DEFAULT_PING_INTERVAL_S);
    const intervalMin = Math.max(CONFIG.MIN_ALARM_INTERVAL_MIN, intervalSec / 60);
    
    const alarmName = `ping_${server.id}`;
    
    await chrome.alarms.create(alarmName, {
      delayInMinutes: 0.01,
      periodInMinutes: intervalMin,
    });
    
    pingState.set(server.id, {
      failCount: 0,
      lastAlert: 0,
      intervalSec,
    });
    
    // Первый пинг сразу
    await pingServer(server);
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('ping_')) return;
  
  const serverId = alarm.name.replace('ping_', '');
  const data = await chrome.storage.sync.get(['servers']);
  const server = (data.servers || []).find(s => s.id === serverId);
  
  if (!server) return;
  await pingServer(server);
});

// ✅ ОРИГИНАЛЬНАЯ ЛОГИКА ПИНГА (как раньше)
async function pingServer(server) {
  const timeoutMs = (server.ping.timeout || CONFIG.DEFAULT_TIMEOUT_S) * 1000;
  const dangerMs = server.ping.dangerMs || CONFIG.DEFAULT_DANGER_MS;
  const start = performance.now();
  let status = 'offline';
  let responseTime = 0;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let url = server.ping.url;
    
    // ✅ Если это IP:PORT (TCP) — добавляем http://
    const isTCP = server.ping.type === 'tcp' && !url.startsWith('http');
    if (isTCP) url = 'http://' + url;

    await fetch(url, {
      method: isTCP ? 'GET' : 'HEAD',
      mode: 'no-cors',  // ✅ no-cors позволяет пинговать что угодно
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    responseTime = performance.now() - start;
    
    // ✅ Если время больше timeout — это timeout
    if (responseTime >= timeoutMs - 100) {
      status = 'timeout';
      responseTime = timeoutMs;
    } else if (responseTime > dangerMs) {
      status = 'danger';
    } else {
      status = 'online';
    }
    
    const state = pingState.get(server.id);
    if (state) state.failCount = 0;
  } catch (e) {
    responseTime = performance.now() - start;
    
    if (e.name === 'AbortError') {
      status = 'timeout';
      responseTime = timeoutMs;
    } else {
      status = 'offline';
    }
    const state = pingState.get(server.id);
    if (state) state.failCount = Math.min((state.failCount || 0) + 1, 10);
  }

  if (responseTime > timeoutMs) responseTime = timeoutMs;

  const prev = pendingStatusUpdates[server.id];
  let history = prev?.history || [];
  if (history.length === 0 && !prev) {
    try {
      const data = await chrome.storage.local.get(['serverStatus']);
      history = data.serverStatus?.[server.id]?.history || [];
    } catch {}
  }
  history = history.slice(-(CONFIG.MAX_HISTORY - 1));
  history.push({ t: Date.now(), status, time: Math.round(responseTime) });

  const statusObj = {
    status,
    responseTime: Math.round(responseTime),
    lastCheck: Date.now(),
    history,
    failStreak: pingState.get(server.id)?.failCount || 0,
    dangerMs,
  };

  batchStatusUpdate(server.id, statusObj);

  // Алерт при переходе online → offline/timeout
  const prevStatus = prev?.status;
  const now = Date.now();
  const state = pingState.get(server.id) || { lastAlert: 0 };
  const shouldAlert =
    (status === 'offline' || status === 'timeout') &&
    prevStatus === 'online' &&
    server.alerts?.offline?.enabled &&
    now - state.lastAlert > CONFIG.ALERT_COOLDOWN_MS;

  if (shouldAlert) {
    state.lastAlert = now;
    pingState.set(server.id, state);
    triggerOfflineAlert(server).catch(() => {});
  }
}

async function triggerOfflineAlert(server) {
  if (server.alerts.offline.sound && server.alerts.offline.sound !== 'none') {
    try {
      const sounds = await chrome.storage.local.get(['customSounds']);
      const customSounds = sounds.customSounds || [];
      const sound = customSounds.find(s => s.id === server.alerts.offline.sound);
      if (sound) {
        chrome.runtime.sendMessage({
          action: 'playSound',
          soundData: sound.data,
          fromBackground: true,
        }).catch(() => {});
      }
    } catch {}
  }

  if (server.alerts.offline.notification) {
    try {
      await chrome.notifications.create('offline_' + server.id, {
        type: 'basic',
        iconUrl: 'icon128.png',
        title: '🚨 Server Offline',
        message: `${server.name} is not responding`,
        priority: 2,
      });
    } catch {}
  }

  chrome.runtime.sendMessage({
    action: 'alertTriggered',
    serverId: server.id,
    fromBackground: true,
  }).catch(() => {});
}

// ============ LISTENERS ============
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.servers) {
    schedulePings().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.fromBackground) return;

  switch (request.action) {
    case 'fetchLog':
      handleFetchLog(request.url).then(sendResponse);
      return true;
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      break;
    case 'aiExplain':
      handleAI(request.error, request.context).then(sendResponse);
      return true;
    case 'reschedulePings':
      schedulePings().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    case 'getStatus':
      chrome.storage.local.get(['serverStatus']).then(d => {
        sendResponse(d.serverStatus?.[request.serverId] || null);
      });
      return true;
  }
});

async function handleFetchLog(url) {
  if (!isValidUrl(url)) return { success: false, error: 'Invalid URL' };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.FETCH_LOG_TIMEOUT_MS);
  try {
    const r = await fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    return { success: true, text: text.slice(0, 1_000_000) };
  } catch (e) {
    clearTimeout(timeoutId);
    return { success: false, error: e.name === 'AbortError' ? 'Timeout (15s)' : e.message };
  }
}

// ============ AI ============
const AI_PROVIDERS = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    buildHeaders: (apiKey) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }),
    buildBody: (model, prompt) => ({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: CONFIG.AI_MAX_TOKENS }),
    extract: (json) => json.choices?.[0]?.message?.content,
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    buildHeaders: (apiKey) => ({ 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }),
    buildBody: (model, prompt) => ({ model: model || 'claude-3-5-sonnet-20241022', max_tokens: CONFIG.AI_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }),
    extract: (json) => json.content?.[0]?.text,
  },
};

async function handleAI(error, context) {
  const data = await chrome.storage.sync.get(['ai']);
  const ai = data.ai || {};
  if (!ai.enabled || !ai.apiKey) return { success: false, error: 'AI not configured' };

  const provider = AI_PROVIDERS[ai.provider];
  if (!provider) return { success: false, error: `Unknown provider: ${ai.provider}` };

  const safeError = String(error || '').slice(0, 2000);
  const safeContext = String(context || '').slice(0, 4000);

  const prompt = `You are a senior DevOps engineer. Analyze this error and provide:
1. Root cause (1-2 sentences)
2. Likely location (file:line if possible)
3. Fix suggestion
4. Related patterns to search for

Error: ${safeError}
Context:
${safeContext}

Respond in concise markdown format.`;

  try {
    const res = await fetch(provider.endpoint, {
      method: 'POST',
      headers: provider.buildHeaders(ai.apiKey),
      body: JSON.stringify(provider.buildBody(ai.model, prompt)),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `API ${res.status}: ${errText.slice(0, 200)}` };
    }
    const json = await res.json();
    const text = provider.extract(json);
    if (!text) return { success: false, error: 'Empty AI response' };
    return { success: true, text: text.slice(0, 3000) };
  } catch (e) {
    return { success: false, error: e.message };
  }
}