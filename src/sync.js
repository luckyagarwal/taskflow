// src/sync.js
const DATA_API = "/api/data";
const SAVE_API = "/api/save";
const POLL_INTERVAL_MS = 15000;

let isAuthorized = true;
let onAuthStatusChange = null;
let pollTimer = null;
let onDataReload = null;

const channel = typeof window !== 'undefined' ? new BroadcastChannel('taskflow-api-channel') : null;

if (channel) {
  channel.onmessage = async (event) => {
    if (event.data && event.data.type === 'api-changed' && onDataReload) {
      const data = await fetchAllData();
      if (data) onDataReload(data);
    }
  };
}

function broadcastChange() {
  if (channel) {
    channel.postMessage({ type: 'api-changed' });
  }
}

export function setOnAuthStatusChange(fn) {
  onAuthStatusChange = fn;
}

export function getIsAuthorized() {
  return isAuthorized;
}

function isLocalHostname() {
  if (typeof window === 'undefined') return false;
  const hn = window.location.hostname;
  return hn === 'localhost' || 
         hn === '127.0.0.1' || 
         hn === '0.0.0.0' ||
         hn === '[::1]' ||
         hn === '[::]' ||
         hn.startsWith('192.168.') || 
         hn.startsWith('10.') || 
         /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hn) ||
         hn.endsWith('.local') ||
         hn.endsWith('.test') ||
         hn.endsWith('.localhost') ||
         hn.includes('github.dev') ||
         hn.includes('gitpod.io') ||
         hn.includes('webcontainer.io') ||
         hn.includes('ngrok-free.app') ||
         hn.includes('ngrok.io') ||
         hn.includes('trycloudflare.com');
}

export function getSyncHeaders(contentType = 'application/json') {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  
  if (isLocalHostname()) {
    headers['Cf-Access-Authenticated-User-Email'] = 'dev@example.com';
  }
  return headers;
}

export async function fetchAllData() {
  try {
    const res = await fetch(DATA_API, {
      method: "GET",
      headers: getSyncHeaders(null),
      cache: 'no-store'
    });
    
    if (res.status === 401 || res.redirected) {
      if (isAuthorized) {
        isAuthorized = false;
        if (onAuthStatusChange) onAuthStatusChange(false);
      }
      return null;
    }
    
    if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
    
    if (!isAuthorized) {
      isAuthorized = true;
      if (onAuthStatusChange) onAuthStatusChange(true);
    }
    
    return await res.json();
  } catch (err) {
    console.error("fetch failed", err);
    return null;
  }
}

export async function saveChanges(upserts = {}, deletes = {}) {
  try {
    const res = await fetch(SAVE_API, {
      method: "POST",
      headers: getSyncHeaders('application/json'),
      body: JSON.stringify({ upserts, deletes }),
      cache: 'no-store'
    });
    
    if (res.status === 401 || res.redirected) {
      if (isAuthorized) {
        isAuthorized = false;
        if (onAuthStatusChange) onAuthStatusChange(false);
      }
      return false;
    }
    
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(`Save failed (HTTP ${res.status}): ${errBody.details || errBody.error || 'Unknown error'}`);
    }
    
    if (!isAuthorized) {
      isAuthorized = true;
      if (onAuthStatusChange) onAuthStatusChange(true);
    }
    
    broadcastChange();
    return true;
  } catch (err) {
    console.error("save failed", err);
    return false;
  }
}

let eventSource = null;

function setupEventSource() {
  if (typeof EventSource === 'undefined') return;
  if (eventSource) {
    try { eventSource.close(); } catch (e) {}
  }
  
  eventSource = new EventSource('/api/events');
  eventSource.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.type === 'api-changed' && onDataReload) {
        const newData = await fetchAllData();
        if (newData) onDataReload(newData);
      }
    } catch (err) {
      console.error("SSE parse error", err);
    }
  };
  eventSource.onerror = (err) => {
    console.error("SSE connection error", err);
  };
}

function runPollingLoop() {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      const data = await fetchAllData();
      if (data && onDataReload) onDataReload(data);
    }
    runPollingLoop();
  }, POLL_INTERVAL_MS);
}

function handleVisibilityOrFocus() {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    fetchAllData().then((data) => {
      if (data && onDataReload) onDataReload(data);
    });
    runPollingLoop();
    // Re-verify/re-establish SSE connection if it got closed
    if (eventSource && eventSource.readyState === EventSource.CLOSED) {
      setupEventSource();
    }
  }
}

export function startOnlineSync(onDataReloadCb) {
  onDataReload = onDataReloadCb;
  
  // Initial pull
  fetchAllData().then((data) => {
    if (data && onDataReload) onDataReload(data);
  });
  
  // Start background loop
  runPollingLoop();

  if (typeof window !== "undefined") {
    setupEventSource();
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
  }
}

