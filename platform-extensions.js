/* =====================================================
   WebOS — platform-extensions.js
   Browser2 · NotifCenter · AppSwitcher · AI ·
   Achievements · Cloud · Chat · Boot · Themes
   Loads after system-extensions.js
===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   MODULE: NOTIFICATION CENTER
═══════════════════════════════════════════════════ */
const NotifCenter = (() => {
  const items  = [];
  let panel    = null;
  let badge    = null;
  let unread   = 0;
  let panelOpen = false;

  function init() {
    // Inject bell icon into menubar
    const mbRight = document.querySelector('.menubar-right');
    if (!mbRight) return;

    const bell = document.createElement('span');
    bell.id = 'notif-center-btn'; bell.className = 'menubar-icon';
    bell.title = 'Benachrichtigungen'; bell.textContent = '🔔';
    bell.style.position = 'relative'; bell.style.cursor = 'pointer';

    badge = document.createElement('div'); badge.id = 'notif-badge';
    bell.appendChild(badge);
    bell.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    mbRight.insertBefore(bell, mbRight.firstChild);

    // Build panel
    panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.innerHTML = `
      <div class="np-header">
        <span class="np-title">🔔 Benachrichtigungen</span>
        <button class="np-clear-btn">Alle löschen</button>
      </div>
      <div class="np-list" id="np-list"><div class="np-empty">Keine Benachrichtigungen</div></div>`;
    panel.querySelector('.np-clear-btn').addEventListener('click', () => { items.length = 0; unread = 0; _render(); _updateBadge(); });
    document.body.appendChild(panel);
    document.addEventListener('click', e => { if (panelOpen && !panel.contains(e.target) && e.target.id !== 'notif-center-btn') toggle(false); });

    // Intercept Toast to also log to center
    const origToast  = Toast.show.bind(Toast);
    const origToastI = Toast.showInteractive.bind(Toast);
    Toast.show = function(msg, icon, duration) {
      push({ title: msg, icon: icon || 'ℹ️', msg: '' });
      return origToast(msg, icon, duration);
    };
    Toast.showInteractive = function(opts) {
      push({ title: opts.title, icon: opts.icon || 'ℹ️', msg: opts.msg || '', cb: opts.actions?.[0]?.cb });
      return origToastI(opts);
    };
  }

  function push(notif) {
    items.unshift({ ...notif, time: new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }), unread: true });
    if (items.length > 50) items.pop();
    unread++;
    _updateBadge();
    if (panelOpen) _render();
    Events.emit('notif:push', notif);
  }

  function toggle(force) {
    panelOpen = force !== undefined ? force : !panelOpen;
    panel.classList.toggle('open', panelOpen);
    if (panelOpen) { _render(); unread = 0; items.forEach(i => i.unread = false); _updateBadge(); }
  }

  function _updateBadge() {
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.classList.toggle('visible', unread > 0);
  }

  function _render() {
    const list = document.getElementById('np-list');
    if (!list) return;
    list.innerHTML = '';
    if (!items.length) { list.innerHTML = '<div class="np-empty">Keine Benachrichtigungen</div>'; return; }
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = `np-item${item.unread ? ' unread' : ''}`;
      el.innerHTML = `<div class="np-item-icon">${item.icon}</div>
        <div class="np-item-body">
          <div class="np-item-title">${item.title}</div>
          ${item.msg ? `<div class="np-item-msg">${item.msg}</div>` : ''}
          <div class="np-item-time">${item.time}</div>
        </div>`;
      if (item.cb) el.addEventListener('click', () => { item.cb(); toggle(false); });
      list.appendChild(el);
    });
  }

  return { init, push };
})();

/* ═══════════════════════════════════════════════════
   MODULE: APP SWITCHER (Alt+Tab)
═══════════════════════════════════════════════════ */
const AppSwitcher = (() => {
  let overlay = null;
  let open = false;
  let selectedIdx = 0;
  const APP_ICONS = { finder:'📁',editor:'✏️',browser:'🌐',browser2:'🌐',imageviewer:'🖼️',terminal:'💻',calculator:'🔢',musicplayer:'🎵',game:'🎮',settings:'⚙️',trash:'🗑️',games:'🕹️',taskmanager:'📊',devpanel:'⚙️',appstore:'🏪',ai:'🤖',chat:'💬',cloud:'☁️',achievements:'🏆' };

  function init() {
    overlay = document.createElement('div');
    overlay.id = 'app-switcher';
    overlay.innerHTML = '<div class="app-switcher-wrap" id="as-wrap"></div><div class="as-hint" style="position:absolute;bottom:20px">Tab = Weiter · Enter = Öffnen · Esc = Schließen</div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) hide(); });
    document.body.appendChild(overlay);

    document.addEventListener('keydown', e => {
      if (e.altKey && e.key === 'Tab') { e.preventDefault(); open ? _cycle() : show(); return; }
      if (open) {
        if (e.key === 'Escape') hide();
        if (e.key === 'Enter') { _activate(); hide(); }
      }
    });
    document.addEventListener('keyup', e => { if (open && e.key === 'Alt') { _activate(); hide(); } });
  }

  function show() {
    const wins = [...WindowManager.getAllWins()];
    if (wins.length < 1) return;
    open = true; selectedIdx = 0;
    overlay.classList.add('open');
    _render();
  }

  function hide() { open = false; overlay.classList.remove('open'); }

  function _cycle() {
    const wins = [...WindowManager.getAllWins()];
    selectedIdx = (selectedIdx + 1) % wins.length;
    _render();
  }

  function _activate() {
    const wins = [...WindowManager.getAllWins()];
    if (!wins.length) return;
    const [id] = wins[selectedIdx] || wins[0];
    WindowManager.focus(id);
  }

  function _render() {
    const wrap = document.getElementById('as-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';
    const wins = [...WindowManager.getAllWins()];
    wins.forEach(([id, w], i) => {
      const card = document.createElement('div');
      card.className = `as-win-card${i === selectedIdx ? ' active' : ''}`;
      const appTitle = w.title.replace(/^[^\s]+\s/, '').slice(0, 18);
      const status   = w.minimized ? 'minimiert' : 'offen';
      card.innerHTML = `<div class="as-win-icon">${APP_ICONS[w.app] || '📦'}</div><div class="as-win-title">${appTitle}</div><div class="as-win-status">${status}</div>`;
      card.addEventListener('click', () => { WindowManager.focus(id); hide(); });
      wrap.appendChild(card);
    });
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════
   MODULE: ACHIEVEMENTS SYSTEM
═══════════════════════════════════════════════════ */
const Achievements = (() => {
  const DEFS = [
    { id:'first_open',  name:'Erster Start',      icon:'🌟', desc:'WebOS zum ersten Mal gestartet.', pts:10, secret:false },
    { id:'open_5_wins', name:'Multitasker',        icon:'🪟', desc:'5 Fenster gleichzeitig geöffnet.', pts:25, secret:false },
    { id:'play_game',   name:'Spieler',            icon:'🎮', desc:'Ein Spiel gestartet.',             pts:15, secret:false },
    { id:'install_app', name:'Power-User',         icon:'📦', desc:'Eine App installiert.',            pts:20, secret:false },
    { id:'use_terminal',name:'Terminal-Meister',   icon:'💻', desc:'Terminal zum ersten Mal benutzt.', pts:20, secret:false },
    { id:'add_widget',  name:'Widget-Fan',         icon:'🧩', desc:'Ein Widget hinzugefügt.',          pts:15, secret:false },
    { id:'use_ai',      name:'KI-Nutzer',          icon:'🤖', desc:'Den AI-Assistenten befragt.',      pts:20, secret:false },
    { id:'open_store',  name:'Shopper',            icon:'🏪', desc:'Den App Store geöffnet.',          pts:10, secret:false },
    { id:'multi_desk',  name:'Desktop-Switcher',   icon:'🖥️', desc:'Zu einem zweiten Desktop gewechselt.', pts:20, secret:false },
    { id:'cloud_sync',  name:'In der Cloud',       icon:'☁️', desc:'Cloud-Sync durchgeführt.',        pts:25, secret:false },
    { id:'dev_mode',    name:'Hacker',             icon:'🕵️', desc:'Developer Mode aktiviert.',        pts:30, secret:true  },
    { id:'chat_msg',    name:'Kommunikator',       icon:'💬', desc:'Eine Chat-Nachricht gesendet.',    pts:15, secret:false },
  ];

  const KEY = 'webos_achievements';

  function getUnlocked() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
  }

  function unlock(id) {
    const unlocked = getUnlocked();
    if (unlocked[id]) return;
    const def = DEFS.find(d => d.id === id);
    if (!def) return;
    unlocked[id] = { at: new Date().toLocaleDateString('de-DE') };
    localStorage.setItem(KEY, JSON.stringify(unlocked));
    _showAchievementToast(def);
    Events.emit('achievement:unlocked', def);
  }

  function _showAchievementToast(def) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast achievement-toast';
    t.innerHTML = `<div class="ach-icon">${def.icon}</div><div class="ach-info"><div class="ach-title">🏆 Erfolg freigeschaltet!</div><div class="ach-desc">${def.name} · +${def.pts} Punkte</div></div>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); t.addEventListener('animationend', () => t.remove(), { once:true }); }, 3500);
    if (typeof SoundSystem !== 'undefined') SoundSystem.play('install');
  }

  function getTotalPoints() {
    const unlocked = getUnlocked();
    return DEFS.reduce((s, d) => s + (unlocked[d.id] ? d.pts : 0), 0);
  }
  function getMaxPoints() { return DEFS.reduce((s, d) => s + d.pts, 0); }
  function getDefs()      { return DEFS; }
  function getUnlockedCount() { return Object.keys(getUnlocked()).length; }

  function init() {
    // Hook events to auto-unlock
    Events.on('os:started',        () => unlock('first_open'));
    Events.on('window:open',       () => { if (WindowManager.getAllWins().size >= 5) unlock('open_5_wins'); });
    Events.on('window:open',       (id, app) => { if (app === 'terminal') unlock('use_terminal'); if (app === 'appstore') unlock('open_store'); if (app === 'ai') unlock('use_ai'); if (app === 'chat') {}  });
    Events.on('game:registered',   () => {});
    Events.on('achievement:game',  () => unlock('play_game'));
    Events.on('achievement:install',()=> unlock('install_app'));
    Events.on('achievement:widget',()=> unlock('add_widget'));
    Events.on('achievement:desk',  ()=> unlock('multi_desk'));
    Events.on('achievement:cloud', ()=> unlock('cloud_sync'));
    Events.on('achievement:devmode',()=> unlock('dev_mode'));
    Events.on('achievement:chat',  ()=> unlock('chat_msg'));
  }

  return { init, unlock, getUnlocked, getDefs, getTotalPoints, getMaxPoints, getUnlockedCount };
})();

/* ═══════════════════════════════════════════════════
   APP: ACHIEVEMENTS VIEWER
═══════════════════════════════════════════════════ */
AppManager.register('achievements', { open: opts => _openAchievements(opts) });

function _openAchievements(opts = {}) {
  const wid = 'achievements';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'achievements-layout';
  const unlocked = Achievements.getUnlocked();
  const pts = Achievements.getTotalPoints(), maxPts = Achievements.getMaxPoints();
  const count = Achievements.getUnlockedCount(), total = Achievements.getDefs().length;

  const header = document.createElement('div'); header.className = 'ach-header';
  header.innerHTML = `<div style="color:white;font-size:15px;font-weight:700">🏆 Erfolge</div>
    <div class="ach-stats">
      <div class="ach-stat"><div class="ach-stat-val">${count}/${total}</div><div class="ach-stat-lbl">Freigeschaltet</div></div>
      <div class="ach-stat"><div class="ach-stat-val">${pts}</div><div class="ach-stat-lbl">Punkte</div></div>
      <div class="ach-stat"><div class="ach-stat-val">${Math.round(pts/maxPts*100)}%</div><div class="ach-stat-lbl">Abgeschlossen</div></div>
    </div>
    <div class="ach-progress-bar"><div class="ach-progress-fill" style="width:${pts/maxPts*100}%"></div></div>`;

  const grid = document.createElement('div'); grid.className = 'ach-grid';
  Achievements.getDefs().forEach(def => {
    const isUnlocked = !!unlocked[def.id];
    const card = document.createElement('div');
    card.className = `ach-card${isUnlocked ? ' unlocked' : ' locked'}`;
    card.innerHTML = `<div class="ach-card-icon">${def.icon}</div>
      <div class="ach-card-name">${isUnlocked || !def.secret ? def.name : '???'}</div>
      <div class="ach-card-desc">${isUnlocked || !def.secret ? def.desc : 'Geheimnis'}</div>
      <div class="ach-card-pts">${isUnlocked ? `✓ +${def.pts} Pkt.` : `+${def.pts} Pkt.`}</div>`;
    grid.appendChild(card);
  });

  wrap.append(header, grid);
  WindowManager.create({ id: wid, title: '🏆 Erfolge', app: 'achievements', width: 620, height: 500, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: BROWSER 2.0 — Full Tab System
   Replaces / extends the existing browser
═══════════════════════════════════════════════════ */
AppManager.register('browser2', { open: opts => _openBrowser2(opts) });

// Keep 'browser' pointing to browser2 for consistency
const _origBrowserReg = AppManager.open.bind(AppManager);

const SEARCH_DB = [
  { title:'Wikipedia – Freie Enzyklopädie', url:'https://de.wikipedia.org', snippet:'Die freie Enzyklopädie mit Millionen von Artikeln in 300 Sprachen.' },
  { title:'MDN Web Docs', url:'https://developer.mozilla.org', snippet:'Ressourcen für Web-Entwickler. HTML, CSS, JavaScript und mehr.' },
  { title:'OpenStreetMap', url:'https://www.openstreetmap.org', snippet:'Die freie Weltkarte – erstellt von einer Community weltweiter Mapper.' },
  { title:'GitHub', url:'https://github.com', snippet:'Die größte Plattform für Open-Source-Entwicklung und Code-Hosting.' },
  { title:'StackOverflow', url:'https://stackoverflow.com', snippet:'Fragen und Antworten für Programmierer.' },
  { title:'YouTube', url:'https://www.youtube.com', snippet:'Videos ansehen, teilen und entdecken.' },
  { title:'DuckDuckGo', url:'https://duckduckgo.com', snippet:'Datenschutzorientierte Suchmaschine.' },
  { title:'CSS Tricks', url:'https://css-tricks.com', snippet:'Tipps, Tricks und Techniken für CSS.' },
  { title:'Can I Use', url:'https://caniuse.com', snippet:'Browser-Kompatibilitätsdaten für Web-Technologien.' },
  { title:'Codepen', url:'https://codepen.io', snippet:'Online-Editor für HTML, CSS und JavaScript.' },
];

function _openBrowser2(opts = {}) {
  const wid = 'browser2_' + Date.now();
  const bookmarkKey = 'webos_bookmarks';
  const getBookmarks = () => { try { return JSON.parse(localStorage.getItem(bookmarkKey) || '[]'); } catch { return []; } };
  const saveBookmarks = bm => localStorage.setItem(bookmarkKey, JSON.stringify(bm));

  const wrap = document.createElement('div'); wrap.className = 'browser2-layout';

  // ── Tab bar ─────────────────────────────────────
  const tabbar = document.createElement('div'); tabbar.className = 'browser2-tabbar';
  const newTabBtn = document.createElement('button'); newTabBtn.className = 'b2-newtab'; newTabBtn.textContent = '+'; newTabBtn.title = 'Neuer Tab';
  tabbar.appendChild(newTabBtn);

  // ── Toolbar ─────────────────────────────────────
  const toolbar = document.createElement('div'); toolbar.className = 'browser2-toolbar';
  const backBtn   = _navBtn('‹', 'Zurück');
  const fwdBtn    = _navBtn('›', 'Vorwärts');
  const reloadBtn = _navBtn('↻', 'Neu laden');
  const homeBtn   = _navBtn('⌂', 'Startseite');
  const urlBar    = document.createElement('input');
  urlBar.className = 'b2-url-bar'; urlBar.placeholder = 'URL oder Suchbegriff eingeben…';
  const bmBtn     = document.createElement('button'); bmBtn.className = 'b2-bookmark-btn'; bmBtn.title = 'Lesezeichen'; bmBtn.textContent = '☆';
  toolbar.append(backBtn, fwdBtn, reloadBtn, homeBtn, urlBar, bmBtn);

  const loadingBar = document.createElement('div'); loadingBar.className = 'browser2-loading';
  const pagesWrap  = document.createElement('div'); pagesWrap.className = 'browser2-pages';

  wrap.append(tabbar, toolbar, loadingBar, pagesWrap);

  function _navBtn(text, title) {
    const b = document.createElement('button'); b.className = 'b2-nav-btn'; b.textContent = text; b.title = title;
    return b;
  }

  // ── Tab management ───────────────────────────────
  const tabs = [];
  let activeTab = null;

  function createTab(url = '') {
    const tabId   = 'tab_' + Date.now();
    const tabEl   = document.createElement('div'); tabEl.className = 'b2-tab';
    const favicon  = document.createElement('span'); favicon.className = 'b2-tab-favicon'; favicon.textContent = url ? '🌐' : '⊞';
    const titleEl  = document.createElement('span'); titleEl.className = 'b2-tab-title'; titleEl.textContent = url ? 'Wird geladen…' : 'Neuer Tab';
    const closeBtn = document.createElement('button'); closeBtn.className = 'b2-tab-close'; closeBtn.textContent = '✕';
    tabEl.append(favicon, titleEl, closeBtn);
    tabbar.insertBefore(tabEl, newTabBtn);

    const page = document.createElement('div'); page.className = 'b2-page';
    pagesWrap.appendChild(page);

    const history = [], histIdx = { v: -1 };
    let iframe = null;

    const tab = { id: tabId, el: tabEl, page, favicon, titleEl, history, histIdx, iframe, url, bookmarked: false };
    tabs.push(tab);

    tabEl.addEventListener('click', e => { if (e.target !== closeBtn) setActive(tab); });
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closeTab(tab); });

    setActive(tab);
    if (url) navigateTo(tab, url);
    else _showHomePage(tab);

    return tab;
  }

  function setActive(tab) {
    tabs.forEach(t => { t.el.classList.remove('active'); t.page.classList.remove('active'); });
    tab.el.classList.add('active'); tab.page.classList.add('active');
    activeTab = tab;
    urlBar.value = tab.url || '';
    bmBtn.classList.toggle('bookmarked', tab.bookmarked);
    _updateNavBtns();
  }

  function closeTab(tab) {
    const idx = tabs.indexOf(tab);
    if (tabs.length === 1) { _showHomePage(tab); return; }
    tab.el.remove(); tab.page.remove();
    tabs.splice(idx, 1);
    if (activeTab === tab) setActive(tabs[Math.max(0, idx - 1)]);
  }

  function navigateTo(tab, rawUrl) {
    let u = rawUrl.trim();
    if (!u) return;

    // Local game/page
    if (u.startsWith('games/') || u.startsWith('./games/')) {
      _loadInIframe(tab, u); return;
    }
    // Search
    if (!u.includes('.') || u.startsWith('?') || u.includes(' ')) {
      const results = SEARCH_DB.filter(r => r.title.toLowerCase().includes(u.toLowerCase()) || r.snippet.toLowerCase().includes(u.toLowerCase()) || r.url.includes(u));
      _showSearchResults(tab, u, results); return;
    }
    if (!u.startsWith('http://') && !u.startsWith('https://')) u = 'https://' + u;
    _loadInIframe(tab, u);
  }

  function _loadInIframe(tab, url) {
    tab.page.innerHTML = '';
    tab.url = url;
    urlBar.value = url;
    loadingBar.classList.add('active');

    const fr = document.createElement('iframe');
    fr.style.cssText = 'width:100%;height:100%;border:none;flex:1;';
    fr.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
    fr.src = url;
    fr.onload  = () => { loadingBar.classList.remove('active'); tab.titleEl.textContent = url.replace(/https?:\/\//,'').slice(0,24); };
    fr.onerror = () => { loadingBar.classList.remove('active'); };
    tab.iframe = fr;
    tab.history.splice(tab.histIdx.v + 1); tab.history.push(url); tab.histIdx.v++;
    tab.page.appendChild(fr);
    _updateNavBtns();
  }

  function _showHomePage(tab) {
    tab.page.innerHTML = '';
    tab.url = ''; tab.titleEl.textContent = 'Neuer Tab'; tab.favicon.textContent = '⊞';
    urlBar.value = ''; bmBtn.classList.remove('bookmarked');

    const home = document.createElement('div'); home.className = 'b2-newtab-page';

    const now = new Date(); const h = now.getHours();
    const greeting = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';
    const userName = (typeof UserSystem !== 'undefined' && UserSystem.getActive()?.name) || 'Benutzer';

    const searchRow = document.createElement('div');
    searchRow.innerHTML = `
      <div class="b2-home-greeting" style="margin-bottom:16px">${greeting}, <strong>${userName}</strong>!</div>
      <div class="b2-home-search">
        <input class="b2-home-search-input" placeholder="🔍 Im Web suchen…" id="b2hs-${tab.id}"/>
        <button class="b2-home-search-btn">Suchen</button>
      </div>`;
    const si = searchRow.querySelector(`#b2hs-${tab.id}`);
    const sb = searchRow.querySelector('.b2-home-search-btn');
    const doSearch = () => { if (si.value.trim()) navigateTo(tab, si.value); };
    sb.addEventListener('click', doSearch);
    si.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    home.appendChild(searchRow);

    // Quick links
    const qlSection = document.createElement('div');
    qlSection.innerHTML = '<div class="b2-section-title">Schnellzugriff</div>';
    const qlRow = document.createElement('div'); qlRow.className = 'b2-quick-links';
    const QUICK = [
      {icon:'📖',label:'Wikipedia',url:'https://de.wikipedia.org'},
      {icon:'🗺️',label:'OpenStreetMap',url:'https://www.openstreetmap.org'},
      {icon:'💻',label:'MDN Docs',url:'https://developer.mozilla.org'},
      {icon:'🐙',label:'GitHub',url:'https://github.com'},
      {icon:'🎮',label:'Spiele',url:null,app:'games'},
      {icon:'📁',label:'Finder',url:null,app:'finder'},
    ];
    QUICK.forEach(q => {
      const btn = document.createElement('div'); btn.className = 'b2-quick-link';
      btn.innerHTML = `<div class="b2-quick-link-icon">${q.icon}</div><div class="b2-quick-link-label">${q.label}</div>`;
      btn.addEventListener('click', () => { if (q.url) navigateTo(tab, q.url); else if (q.app) AppManager.open(q.app); });
      qlRow.appendChild(btn);
    });
    qlSection.appendChild(qlRow); home.appendChild(qlSection);

    // Bookmarks
    const bms = getBookmarks();
    if (bms.length) {
      const bmSection = document.createElement('div');
      bmSection.innerHTML = '<div class="b2-section-title">Lesezeichen</div>';
      const bmGrid = document.createElement('div'); bmGrid.className = 'b2-bookmarks-grid';
      bms.forEach((bm, i) => {
        const card = document.createElement('div'); card.className = 'b2-bookmark-card';
        card.innerHTML = `<div class="b2-bookmark-card-icon">🔖</div><div class="b2-bookmark-card-title" style="flex:1">${bm.title}</div><button class="b2-bookmark-remove" data-i="${i}">✕</button>`;
        card.querySelector('.b2-bookmark-card-title').addEventListener('click', () => navigateTo(tab, bm.url));
        card.querySelector('.b2-bookmark-remove').addEventListener('click', e => { e.stopPropagation(); bms.splice(i, 1); saveBookmarks(bms); _showHomePage(tab); });
        bmGrid.appendChild(card);
      });
      bmSection.appendChild(bmGrid); home.appendChild(bmSection);
    }

    tab.page.appendChild(home);
  }

  function _showSearchResults(tab, query, results) {
    tab.page.innerHTML = '';
    tab.url = '?q=' + encodeURIComponent(query);
    tab.titleEl.textContent = 'Suche: ' + query.slice(0,16);
    tab.favicon.textContent = '🔍';
    urlBar.value = query;

    const container = document.createElement('div');
    container.style.cssText = 'padding:24px;max-width:700px;margin:0 auto;overflow-y:auto;height:100%;';
    container.innerHTML = `<div style="color:rgba(255,255,255,.5);font-size:13px;margin-bottom:16px">Suchergebnisse für <strong style="color:white">"${query}"</strong> (${results.length} Treffer)</div>`;

    if (!results.length) {
      container.innerHTML += '<div style="color:rgba(255,255,255,.35);padding:20px 0">Keine Ergebnisse gefunden. Versuche eine externe URL einzugeben.</div>';
    } else {
      const list = document.createElement('div'); list.className = 'b2-search-results';
      results.forEach(r => {
        const res = document.createElement('div'); res.className = 'b2-search-result';
        res.innerHTML = `<div class="b2-result-title">${r.title}</div><div class="b2-result-url">${r.url}</div><div class="b2-result-snippet">${r.snippet}</div>`;
        res.addEventListener('click', () => navigateTo(tab, r.url));
        list.appendChild(res);
      });
      container.appendChild(list);
    }
    tab.page.appendChild(container);
  }

  function _updateNavBtns() {
    if (!activeTab) return;
    backBtn.disabled   = activeTab.histIdx.v <= 0;
    fwdBtn.disabled    = activeTab.histIdx.v >= activeTab.history.length - 1;
  }

  // ── Wire toolbar events ──────────────────────────
  backBtn.addEventListener('click', () => {
    if (!activeTab || activeTab.histIdx.v <= 0) return;
    activeTab.histIdx.v--; navigateTo(activeTab, activeTab.history[activeTab.histIdx.v]);
  });
  fwdBtn.addEventListener('click', () => {
    if (!activeTab || activeTab.histIdx.v >= activeTab.history.length - 1) return;
    activeTab.histIdx.v++; _loadInIframe(activeTab, activeTab.history[activeTab.histIdx.v]);
  });
  reloadBtn.addEventListener('click', () => { if (activeTab?.iframe) { loadingBar.classList.add('active'); activeTab.iframe.src = activeTab.iframe.src; } });
  homeBtn.addEventListener('click',   () => { if (activeTab) _showHomePage(activeTab); });
  urlBar.addEventListener('keydown',  e => { if (e.key === 'Enter' && activeTab) navigateTo(activeTab, urlBar.value); });

  bmBtn.addEventListener('click', () => {
    if (!activeTab?.url) return;
    const bms = getBookmarks();
    const existing = bms.findIndex(b => b.url === activeTab.url);
    if (existing > -1) { bms.splice(existing, 1); activeTab.bookmarked = false; bmBtn.classList.remove('bookmarked'); Toast.show('Lesezeichen entfernt', '🗑️'); }
    else { bms.unshift({ title: activeTab.titleEl.textContent, url: activeTab.url }); if (bms.length > 20) bms.pop(); activeTab.bookmarked = true; bmBtn.classList.add('bookmarked'); Toast.show('Lesezeichen gespeichert', '🔖'); }
    saveBookmarks(bms);
  });

  newTabBtn.addEventListener('click', () => createTab());

  // Create first tab
  createTab(opts.url || '');

  WindowManager.create({ id: wid, title: '🌐 Browser', app: 'browser2', width: 900, height: 620, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: AI ASSISTANT
═══════════════════════════════════════════════════ */
AppManager.register('ai', { open: opts => _openAI(opts) });

const AI_RESPONSES = {
  default: [
    "Das ist eine interessante Frage! Lass mich darüber nachdenken…",
    "Ich helfe dir gerne dabei. Hier sind meine Gedanken:",
    "Das kann ich dir erklären! In WebOS gilt:",
    "Sehr gute Frage! Die Antwort ist vielschichtig:",
  ],
  open: [
    "Ich öffne das für dich! Ein Moment…",
    "Sofort! Ich starte die App für dich.",
  ],
  file: [
    "Ich schaue nach deinen Dateien…",
  ],
  system: [
    "Hier sind die aktuellen Systeminfos:",
  ],
  help: [
    "Ich bin dein WebOS AI-Assistent! Ich kann dir helfen bei:\n\n• **Apps öffnen** – Sage mir z. B. 'Öffne Finder'\n• **Systeminfos** – Frage nach Fenstern, Desktops etc.\n• **Dateien** – Ich kann Dateien auflisten\n• **Allgemeine Fragen** – Ich versuche mein Bestes!\n\nProbiere: 'Zeige mir alle Fenster' oder 'Öffne Terminal'",
  ]
};

function _openAI(opts = {}) {
  const wid = 'ai';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'ai-layout';
  const messages = document.createElement('div'); messages.className = 'ai-messages';
  const suggestions = document.createElement('div'); suggestions.className = 'ai-suggestions';
  const toolbar = document.createElement('div'); toolbar.className = 'ai-toolbar';
  const input   = document.createElement('textarea'); input.className = 'ai-input'; input.placeholder = 'Stell mir eine Frage…'; input.rows = 1;
  const sendBtn = document.createElement('button'); sendBtn.className = 'ai-send'; sendBtn.textContent = '↑';
  toolbar.append(input, sendBtn);
  wrap.append(suggestions, messages, toolbar);

  const SUGGESTS = ['Hilfe', 'Öffne Finder', 'Zeige Fenster', 'Systeminfos', 'Öffne Terminal'];
  SUGGESTS.forEach(s => {
    const btn = document.createElement('button'); btn.className = 'ai-suggest-btn'; btn.textContent = s;
    btn.addEventListener('click', () => { input.value = s; send(); });
    suggestions.appendChild(btn);
  });

  function addMsg(text, role) {
    const msg = document.createElement('div'); msg.className = `ai-msg ${role}`;
    const avatarEl = document.createElement('div'); avatarEl.className = 'ai-msg-avatar'; avatarEl.textContent = role === 'user' ? '👤' : '🤖';
    const bubble   = document.createElement('div'); bubble.className = 'ai-msg-bubble';
    bubble.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    msg.append(avatarEl, bubble);
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  function showTyping() {
    const msg = document.createElement('div'); msg.className = 'ai-msg system typing';
    msg.innerHTML = '<div class="ai-msg-avatar">🤖</div><div class="ai-msg-bubble"><div class="ai-typing-dots"><span></span><span></span><span></span></div></div>';
    messages.appendChild(msg); messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  async function send() {
    const text = input.value.trim(); if (!text) return;
    input.value = ''; input.style.height = 'auto';
    addMsg(text, 'user');
    const typing = showTyping();

    await new Promise(r => setTimeout(r, 400 + Math.random() * 800));
    typing.remove();

    const response = _generateResponse(text.toLowerCase());
    addMsg(response.text, 'system');
    if (response.action) response.action();
    Achievements.unlock('use_ai');
  }

  function _generateResponse(q) {
    // Check for app-open commands
    const openMatch = q.match(/öffne?\s+(.+)/);
    if (openMatch) {
      const target = openMatch[1].trim();
      const appMap = { finder:'finder', terminal:'terminal', rechner:'calculator', musik:'musicplayer', spiele:'games', browser:'browser2', einstellungen:'settings', 'task manager':'taskmanager', 'app store':'appstore', bilder:'imageviewer' };
      for (const [kw, appId] of Object.entries(appMap)) {
        if (target.includes(kw)) {
          return { text: `${_pick(AI_RESPONSES.open)} Ich öffne "${appId}" für dich.`, action: () => setTimeout(() => AppManager.open(appId), 300) };
        }
      }
      return { text: `Ich konnte "${openMatch[1]}" nicht finden. Versuche: finder, terminal, rechner, spiele…` };
    }
    // System info
    if (q.includes('fenster') || q.includes('prozess') || q.includes('offen')) {
      const wins = WindowManager.getAllWins();
      const list = [...wins.values()].map(w => `• ${w.title.replace(/^[^\s]+\s/,'')}`).join('\n');
      return { text: `Aktuell laufen **${wins.size} Fenster**:\n${list || '(keine)'}` };
    }
    if (q.includes('desktop') || q.includes('bildschirm')) {
      return { text: `Du bist auf **Desktop ${DesktopManager.getCurrent() + 1}** von ${DesktopManager.getSlides().length}. Wechsle mit **Ctrl+←/→**` };
    }
    if (q.includes('datei') || q.includes('ordner')) {
      const fs = FileSystem.get();
      const count = Object.keys(fs).filter(k => fs[k].type === 'file').length;
      return { text: `Du hast **${count} Dateien** im virtuellen Dateisystem. Öffne den **Finder** um sie zu durchsuchen.` };
    }
    if (q.includes('hilfe') || q.includes('help') || q.includes('was kannst')) {
      return { text: _pick(AI_RESPONSES.help) };
    }
    if (q.includes('wetter')) {
      return { text: 'Das aktuelle Wetter ist **18°C, leicht bewölkt** in Berlin. Du kannst auch das **Wetter-Widget** auf deinem Desktop hinzufügen!' };
    }
    if (q.includes('uhrzeit') || q.includes('datum') || q.includes('zeit')) {
      return { text: `Es ist **${new Date().toLocaleTimeString('de-DE')}** am **${new Date().toLocaleDateString('de-DE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}**` };
    }
    // Generic
    const picks = AI_RESPONSES.default;
    return { text: `${_pick(picks)}\n\nIch bin ein simulierter AI-Assistent in WebOS. Für echte KI-Antworten, nutze den **Browser** um eine KI-Seite zu besuchen, oder frage mich nach System-Aktionen!` };
  }

  function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  sendBtn.addEventListener('click', send);

  // Welcome message
  setTimeout(() => addMsg("Hallo! Ich bin dein **WebOS AI-Assistent**. 👋\nFrag mich etwas oder sag z. B. *\"Öffne Finder\"*.", 'system'), 100);

  WindowManager.create({ id: wid, title: '🤖 AI Assistent', app: 'ai', width: 540, height: 520, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: CLOUD STORAGE
═══════════════════════════════════════════════════ */
AppManager.register('cloud', { open: opts => _openCloud(opts) });

function _openCloud(opts = {}) {
  const wid = 'cloud';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'cloud-layout';

  const header = document.createElement('div'); header.className = 'cloud-header';
  const title  = document.createElement('div'); title.className = 'cloud-title'; title.textContent = '☁️ WebOS Cloud';
  const syncBtn = document.createElement('button'); syncBtn.className = 'cloud-sync-btn'; syncBtn.textContent = '⟳ Sync';
  header.append(title, syncBtn);

  const stats = document.createElement('div'); stats.className = 'cloud-stats';
  const fileCount = Object.keys(FileSystem.get()).filter(k => FileSystem.get()[k]?.type === 'file').length;
  const stateSize = Math.round(JSON.stringify(State.get()).length / 1024);
  stats.innerHTML = `
    <div class="cloud-stat"><div class="cs-val">${fileCount}</div><div class="cs-lbl">Dateien</div></div>
    <div class="cloud-stat"><div class="cs-val">${stateSize} KB</div><div class="cs-lbl">Größe</div></div>
    <div class="cloud-stat"><div class="cs-val">✓ Sync</div><div class="cs-lbl">Status</div></div>`;

  const files = document.createElement('div'); files.className = 'cloud-files';

  function render() {
    files.innerHTML = '';
    const fs = FileSystem.get();
    const fileEntries = Object.entries(fs).filter(([k,v]) => v?.type === 'file');
    if (!fileEntries.length) { files.innerHTML = '<div style="padding:30px;text-align:center;color:rgba(255,255,255,.3);font-size:13px">Keine Dateien vorhanden</div>'; return; }
    fileEntries.forEach(([id, node]) => {
      const item = document.createElement('div'); item.className = 'cloud-file-item';
      const size = Math.max(1, Math.round((node.content||'').length / 100)) / 10;
      item.innerHTML = `<div class="cf-icon">${node.icon || FileSystem.iconForExt(node.ext)}</div>
        <div class="cf-info"><div class="cf-name">${node.name}</div><div class="cf-meta">${FileSystem.getPathString(id)} · ${size} KB</div></div>
        <div class="cf-actions">
          <button class="cf-btn" data-action="open" data-id="${id}">Öffnen</button>
          <button class="cf-btn" data-action="export" data-id="${id}">Export</button>
        </div>`;
      item.querySelectorAll('.cf-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.action === 'open') {
            const ext = (node.ext||'').toLowerCase();
            if (['txt','md','js','json'].includes(ext)) AppManager.open('editor', { fileId:id, node });
            else if (['jpg','png','gif'].includes(ext)) AppManager.open('imageviewer', { fileId:id, node });
          } else {
            const blob = new Blob([node.content || ''], { type:'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = node.name; a.click();
            Toast.show(`"${node.name}" exportiert`, '💾');
          }
        });
      });
      files.appendChild(item);
    });
  }

  syncBtn.addEventListener('click', () => {
    syncBtn.className = 'cloud-sync-btn syncing'; syncBtn.textContent = '⟳ Synchronisiere…';
    setTimeout(() => {
      State.save();
      syncBtn.className = 'cloud-sync-btn'; syncBtn.textContent = '✓ Synchronisiert';
      setTimeout(() => { syncBtn.textContent = '⟳ Sync'; }, 2000);
      Toast.show('Cloud-Sync abgeschlossen', '☁️');
      Achievements.unlock('cloud_sync');
    }, 1500);
  });

  render();
  wrap.append(header, stats, files);

  // Export all button
  const exportRow = document.createElement('div'); exportRow.style.cssText = 'padding:10px 14px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:8px;';
  const exportAll = document.createElement('button'); exportAll.className = 'cloud-sync-btn'; exportAll.textContent = '📤 Alles exportieren';
  const importBtn = document.createElement('button'); importBtn.className = 'cloud-sync-btn'; importBtn.style.background = 'rgba(255,255,255,0.1)'; importBtn.textContent = '📥 Importieren';
  exportAll.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(State.get(), null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'webos-cloud-export.json'; a.click();
    Toast.show('WebOS-Daten exportiert', '📤');
  });
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return;
      const text = await file.text();
      try { const data = JSON.parse(text); State.set('filesystem', data.filesystem || {}); render(); Toast.show('Import erfolgreich', '📥'); }
      catch { Toast.show('Import fehlgeschlagen — ungültiges Format', '⚠️'); }
    });
    input.click();
  });
  exportRow.append(exportAll, importBtn);
  wrap.appendChild(exportRow);

  WindowManager.create({ id: wid, title: '☁️ Cloud Speicher', app: 'cloud', width: 580, height: 500, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: CHAT (Simulated Multi-User)
═══════════════════════════════════════════════════ */
AppManager.register('chat', { open: opts => _openChat(opts) });

const FAKE_USERS = [
  { name:'Alex',    avatar:'😎', status:'online',  msgs:['Hey! Alles gut?','Cool, ich teste gerade WebOS 3.0!','Die neuen Features sind hammer 🔥'] },
  { name:'Sarah',   avatar:'🧑‍💻', status:'online',  msgs:['Hab gerade den Task Manager ausprobiert 📊','Super System!','Welche Spiele hast du schon gespielt?'] },
  { name:'Max',     avatar:'🎮', status:'away',    msgs:['Bin gleich zurück','Snake highscore: 42 🐍','...'] },
  { name:'WebOS Bot',avatar:'🤖', status:'online', msgs:['Willkommen im WebOS Chat!','Tippe einfach drauf los.','Benötigst du Hilfe? Frag den AI-Assistenten!'] },
];

function _openChat(opts = {}) {
  const wid = 'chat';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'chat-layout';
  const sidebar = document.createElement('div'); sidebar.className = 'chat-sidebar';
  sidebar.innerHTML = `<div class="chat-sidebar-title">Online</div>`;
  const userList = document.createElement('div'); userList.className = 'chat-user-list'; sidebar.appendChild(userList);

  const main = document.createElement('div'); main.className = 'chat-main';
  const chatHeader = document.createElement('div'); chatHeader.className = 'chat-header';
  chatHeader.innerHTML = '<span class="chat-header-name">Wähle einen Chat</span>';
  const messagesEl = document.createElement('div'); messagesEl.className = 'chat-messages';
  const inputRow   = document.createElement('div'); inputRow.className = 'chat-input-row';
  const chatInput  = document.createElement('input'); chatInput.className = 'chat-input'; chatInput.placeholder = 'Nachricht eingeben…';
  const sendChatBtn = document.createElement('button'); sendChatBtn.className = 'chat-send-btn'; sendChatBtn.textContent = '↑';
  inputRow.append(chatInput, sendChatBtn);
  main.append(chatHeader, messagesEl, inputRow);
  wrap.append(sidebar, main);

  let activeUser = null;
  const msgHistory = {};

  FAKE_USERS.forEach(u => {
    const item = document.createElement('div'); item.className = 'chat-user-item';
    item.innerHTML = `<div class="chat-user-avatar">${u.avatar}<div class="chat-status-dot ${u.status}"></div></div><div class="chat-user-info"><div class="chat-user-name">${u.name}</div><div class="chat-user-status">${u.status}</div></div>`;
    item.addEventListener('click', () => { userList.querySelectorAll('.chat-user-item').forEach(x => x.classList.remove('active')); item.classList.add('active'); openConvo(u); });
    userList.appendChild(item);
  });

  function openConvo(user) {
    activeUser = user;
    chatHeader.innerHTML = `<span class="chat-user-avatar" style="font-size:18px">${user.avatar}</span><span class="chat-header-name">${user.name}</span><span style="color:rgba(255,255,255,.35);font-size:11px;margin-left:6px">${user.status}</span>`;
    messagesEl.innerHTML = '';
    if (!msgHistory[user.name]) {
      msgHistory[user.name] = [];
      // Auto-add opening message
      setTimeout(() => addIncoming(user, user.msgs[0]), 300);
    } else { msgHistory[user.name].forEach(m => _renderMsg(m)); }
  }

  function addIncoming(user, text) {
    if (!text) return;
    const msg = { role:'other', text, avatar: user.avatar, time: _now() };
    if (!msgHistory[user.name]) msgHistory[user.name] = [];
    msgHistory[user.name].push(msg);
    if (activeUser?.name === user.name) _renderMsg(msg);
  }

  function _renderMsg(msg) {
    const el = document.createElement('div'); el.className = `chat-msg ${msg.role}`;
    const time = document.createElement('div'); time.className = 'chat-msg-time'; time.textContent = msg.time;
    el.innerHTML = `<div class="chat-msg-avatar">${msg.avatar || '👤'}</div><div class="chat-msg-bubble">${msg.text}</div>`;
    if (msg.role === 'mine') el.append(time);
    else el.insertBefore(time, el.lastChild);
    messagesEl.appendChild(el); messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMsg() {
    const text = chatInput.value.trim(); if (!text || !activeUser) return;
    chatInput.value = '';
    const msg = { role:'mine', text, avatar:'👤', time: _now() };
    if (!msgHistory[activeUser.name]) msgHistory[activeUser.name] = [];
    msgHistory[activeUser.name].push(msg);
    _renderMsg(msg);
    Achievements.unlock('chat_msg');
    // Fake reply after delay
    const replies = activeUser.msgs;
    const reply = replies[Math.floor(Math.random() * replies.length)];
    setTimeout(() => addIncoming(activeUser, reply), 800 + Math.random() * 1200);
  }

  function _now() { return new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }); }

  sendChatBtn.addEventListener('click', sendMsg);
  chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

  // Auto-open first user
  setTimeout(() => userList.querySelector('.chat-user-item')?.click(), 100);

  WindowManager.create({ id: wid, title: '💬 Chat', app: 'chat', width: 680, height: 500, content: wrap });
}

/* ═══════════════════════════════════════════════════
   ENHANCED BOOT SEQUENCE
   Patches the existing boot() in script.js via
   overriding the DOM before DOMContentLoaded fires
═══════════════════════════════════════════════════ */
(function patchBootScreen() {
  const BOOT_MSGS = [
    '[  0.001] WebOS Kernel 3.0 wird geladen…',
    '[  0.024] Speicher-Controller initialisiert',
    '[  0.045] Dateisystem wird gemountet…',
    '[  0.089] Grafik-Subsystem bereit',
    '[  0.134] Netzwerk-Stack geladen',
    '[  0.198] Event-System initialisiert',
    '[  0.231] AppManager registriert 12 Apps',
    '[  0.287] GameManager lädt Spielkatalog…',
    '[  0.342] Fenster-Manager bereit',
    '[  0.401] Benutzeroberfläche wird aufgebaut…',
    '[  0.456] Benachrichtigungs-Center aktiv',
    '[  0.512] AI-Assistent bereit',
    '[  0.567] Cloud-Sync verbunden',
    '[  0.598] System-Erweiterungen geladen',
    '[  0.612] WebOS bereit.',
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const bootEl = document.getElementById('boot-screen');
    if (!bootEl) return;

    // Inject log + progress bar
    const logEl = document.createElement('div'); logEl.id = 'boot-log';
    const progressWrap = document.createElement('div'); progressWrap.id = 'boot-progress-wrap';
    progressWrap.innerHTML = '<div id="boot-progress-bar"><div id="boot-progress-fill"></div></div><div id="boot-progress-pct">0%</div>';
    bootEl.appendChild(logEl); bootEl.appendChild(progressWrap);

    const fill = document.getElementById('boot-progress-fill');
    const pct  = document.getElementById('boot-progress-pct');
    let i = 0;

    function addLine() {
      if (i >= BOOT_MSGS.length) return;
      const line = document.createElement('span'); line.className = 'bl'; line.textContent = BOOT_MSGS[i];
      logEl.appendChild(line);
      // Keep only last 6 lines visible
      while (logEl.children.length > 6) logEl.removeChild(logEl.firstChild);
      const p = Math.round(((i + 1) / BOOT_MSGS.length) * 100);
      fill.style.width = p + '%'; pct.textContent = p + '%';
      i++;
    }

    const interval = setInterval(() => { addLine(); if (i >= BOOT_MSGS.length) clearInterval(interval); }, 90);
  }, { once: true });
})();

/* ═══════════════════════════════════════════════════
   THEME SYSTEM EXTENSION
   Adds Neon + Glass themes and dock positioning
═══════════════════════════════════════════════════ */
const ThemeSystem = (() => {
  const THEMES = [
    { id:'dark',  name:'Dark',       cls:'',           icon:'🌙' },
    { id:'light', name:'Hell',       cls:'light-mode', icon:'☀️' },
    { id:'neon',  name:'Neon',       cls:'theme-neon', icon:'💚' },
    { id:'glass', name:'Glass',      cls:'theme-glass',icon:'🪟' },
  ];

  function apply(id) {
    const theme = THEMES.find(t => t.id === id);
    if (!theme) return;
    // Remove all theme classes
    THEMES.forEach(t => { if (t.cls) document.body.classList.remove(t.cls); });
    if (theme.cls) document.body.classList.add(theme.cls);
    State.set('theme', id);
    Events.emit('theme:changed', id);
  }

  function setDockPosition(pos) {
    document.body.classList.remove('dock-left');
    if (pos === 'left') document.body.classList.add('dock-left');
    State.set('dockPosition', pos);
  }

  function init() {
    const saved = State.get().theme;
    if (saved) apply(saved);
    const pos = State.get().dockPosition;
    if (pos === 'left') setDockPosition('left');
  }

  function getThemes() { return THEMES; }
  return { apply, setDockPosition, init, getThemes };
})();

/* ═══════════════════════════════════════════════════
   SETTINGS EXTENSION: Theme & Gradient Editor
═══════════════════════════════════════════════════ */
Events.on('window:open', (id, app) => {
  if (app !== 'settings') return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const win = WindowManager.getWin(id);
    if (!win) return;
    const sidebar = win.el.querySelector('.settings-sidebar');
    if (!sidebar || sidebar.dataset.platformExt) return;
    sidebar.dataset.platformExt = '1';

    const EXTRA = [
      { icon:'🎨', label:'Themes',     fn: el => _renderThemeSettings(win.el.querySelector('.settings-content'), el) },
      { icon:'⬡',  label:'Hintergrund',fn: el => _renderGradientSettings(win.el.querySelector('.settings-content')) },
      { icon:'🞃',  label:'Dock',       fn: el => _renderDockSettings(win.el.querySelector('.settings-content')) },
    ];
    EXTRA.forEach(item => {
      const el = document.createElement('div'); el.className = 'settings-sidebar-item';
      el.innerHTML = `<span class="ss-icon">${item.icon}</span>${item.label}`;
      el.addEventListener('click', () => { sidebar.querySelectorAll('.settings-sidebar-item').forEach(x => x.classList.remove('active')); el.classList.add('active'); item.fn(el); });
      sidebar.appendChild(el);
    });
  }));
});

function _renderThemeSettings(content, activeEl) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Systemthemen';
  content.appendChild(t);
  const saved = State.get().theme || 'dark';
  ThemeSystem.getThemes().forEach(th => {
    const row = document.createElement('div'); row.className = 'settings-row';
    row.innerHTML = `<div class="settings-row-label">${th.icon} ${th.name}<div class="settings-row-desc">${th.id === saved ? 'Aktiv' : ''}</div></div>`;
    const btn = document.createElement('button'); btn.className = 'editor-btn'; btn.textContent = th.id === saved ? '✓ Aktiv' : 'Anwenden';
    btn.addEventListener('click', () => { ThemeSystem.apply(th.id); content.querySelectorAll('.editor-btn').forEach(b => b.textContent = 'Anwenden'); btn.textContent = '✓ Aktiv'; Toast.show(`Theme: ${th.name}`, th.icon); });
    row.appendChild(btn); content.appendChild(row);
  });
}

function _renderGradientSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Hintergrund-Generator';
  content.appendChild(t);
  const wrap = document.createElement('div'); wrap.className = 'grad-editor';

  const preview = document.createElement('div'); preview.className = 'grad-preview';
  const controls = document.createElement('div'); controls.className = 'grad-controls';

  const colors = ['#1a0050', '#002080', '#001828', '#200010'];
  const swatches = colors.map((c, i) => {
    const div = document.createElement('div'); div.className = 'grad-control';
    const label = document.createElement('div'); label.className = 'grad-label'; label.textContent = `Farbe ${i+1}`;
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = c; inp.className = 'grad-swatch';
    inp.addEventListener('input', updatePreview); div.append(label, inp); controls.appendChild(div);
    return inp;
  });

  function updatePreview() {
    const [c1,c2,c3,c4] = swatches.map(s => s.value);
    preview.style.background = `radial-gradient(ellipse at 20% 40%,${c1} 0%,transparent 60%),radial-gradient(ellipse at 80% 60%,${c2} 0%,transparent 55%),linear-gradient(135deg,${c3} 0%,${c4} 100%)`;
  }
  updatePreview();

  const applyBtn = document.createElement('button'); applyBtn.className = 'grad-apply'; applyBtn.textContent = 'Als Hintergrund setzen';
  applyBtn.addEventListener('click', () => {
    const [c1,c2,c3,c4] = swatches.map(s => s.value);
    const grad = `radial-gradient(ellipse at 20% 40%,${c1} 0%,transparent 60%),radial-gradient(ellipse at 80% 60%,${c2} 0%,transparent 55%),linear-gradient(135deg,${c3} 0%,${c4} 100%)`;
    const slide = DesktopManager.getActiveSlide();
    if (slide) slide.querySelector('.desktop-wallpaper').style.background = grad;
    Toast.show('Hintergrund gesetzt', '🎨');
  });

  wrap.append(preview, controls, applyBtn);
  content.appendChild(wrap);
}

function _renderDockSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Dock-Position';
  content.appendChild(t);
  const pos = State.get().dockPosition || 'bottom';
  [['bottom','Unten','⬇️'],['left','Links (experimentell)','⬅️']].forEach(([p, label, icon]) => {
    const row = document.createElement('div'); row.className = 'settings-row';
    row.innerHTML = `<div class="settings-row-label">${icon} ${label}</div>`;
    const btn = document.createElement('button'); btn.className = 'editor-btn'; btn.textContent = p === pos ? '✓ Aktiv' : 'Wählen';
    btn.addEventListener('click', () => { ThemeSystem.setDockPosition(p); content.querySelectorAll('.editor-btn').forEach(b => b.textContent = 'Wählen'); btn.textContent = '✓ Aktiv'; Toast.show(`Dock: ${label}`, icon); });
    row.appendChild(btn); content.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════════
   DOCK PLATFORM ICONS INJECTION
═══════════════════════════════════════════════════ */
function _injectPlatformDockIcons() {
  const dockApps = document.getElementById('dock-apps');
  if (!dockApps) return;
  const sep = dockApps.querySelectorAll('.dock-separator')[0];

  function makeDock(app, label, svgContent) {
    if (dockApps.querySelector(`.dock-item[data-app="${app}"]`)) return;
    const item = document.createElement('div'); item.className = 'dock-item'; item.dataset.app = app; item.title = label;
    item.innerHTML = `<div class="dock-icon"><svg viewBox="0 0 48 48" width="48" height="48">${svgContent}</svg></div><span class="dock-label">${label}</span>`;
    item.addEventListener('click', () => AppManager.open(app));
    if (sep) dockApps.insertBefore(item, sep); else dockApps.appendChild(item);
  }

  makeDock('browser2', 'Browser+',
    '<rect width="48" height="48" rx="12" fill="#0d3a1a"/><circle cx="24" cy="22" r="12" stroke="#30d158" stroke-width="2" fill="none"/><line x1="24" y1="10" x2="24" y2="34" stroke="#30d158" stroke-width="1.5"/><line x1="12" y1="22" x2="36" y2="22" stroke="#30d158" stroke-width="1.5"/><ellipse cx="24" cy="22" rx="6" ry="12" stroke="#30d158" stroke-width="1.5" fill="none"/>');

  makeDock('ai', 'AI Assistent',
    '<rect width="48" height="48" rx="12" fill="#2a0a3a"/><circle cx="24" cy="20" r="10" fill="#bf5af2" opacity=".15" stroke="#bf5af2" stroke-width="2"/><text x="24" y="25" text-anchor="middle" font-size="14" fill="#bf5af2">AI</text><rect x="16" y="32" width="16" height="3" rx="1.5" fill="#bf5af2" opacity=".6"/><rect x="20" y="37" width="8" height="3" rx="1.5" fill="#bf5af2" opacity=".4"/>');

  makeDock('chat', 'Chat',
    '<rect width="48" height="48" rx="12" fill="#0a2a1a"/><rect x="9" y="12" width="30" height="22" rx="6" fill="#30d158" opacity=".15" stroke="#30d158" stroke-width="1.8"/><circle cx="17" cy="23" r="2.5" fill="#30d158"/><circle cx="24" cy="23" r="2.5" fill="#30d158"/><circle cx="31" cy="23" r="2.5" fill="#30d158"/><path d="M14 34 L20 30" stroke="#30d158" stroke-width="1.8" stroke-linecap="round"/>');

  makeDock('achievements', 'Erfolge',
    '<rect width="48" height="48" rx="12" fill="#2a1a00"/><circle cx="24" cy="20" r="10" fill="none" stroke="#ffd60a" stroke-width="2.5"/><text x="24" y="25" text-anchor="middle" font-size="14" fill="#ffd60a">★</text><rect x="18" y="32" width="12" height="3" rx="1.5" fill="#ffd60a" opacity=".7"/>');

  makeDock('cloud', 'Cloud',
    '<rect width="48" height="48" rx="12" fill="#0a1a3a"/><path d="M14 30 C10 30 9 24 14 23 C14 17 22 14 27 19 C32 17 38 22 36 28 C38 28 38 34 33 34 L16 34 C12 34 11 30 14 30Z" fill="#5ac8fa" opacity=".7" stroke="#5ac8fa" stroke-width="1"/>');
}

/* ═══════════════════════════════════════════════════
   TERMINAL: Platform commands
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  window.__terminalPlugins = window.__terminalPlugins || {};

  window.__terminalPlugins['chat']     = (a, p) => { AppManager.open('chat'); p('Chat geöffnet', 't-info'); return true; };
  window.__terminalPlugins['ai']       = (a, p) => { AppManager.open('ai'); p('AI-Assistent geöffnet', 't-info'); return true; };
  window.__terminalPlugins['cloud']    = (a, p) => { AppManager.open('cloud'); p('Cloud geöffnet', 't-info'); return true; };
  window.__terminalPlugins['browser']  = (a, p) => { AppManager.open('browser2', { url: a[0] }); p('Browser geöffnet', 't-info'); return true; };
  window.__terminalPlugins['achievements'] = (a, p) => { AppManager.open('achievements'); p('Erfolge geöffnet', 't-info'); return true; };
  window.__terminalPlugins['theme']    = (args, p) => {
    if (!args[0]) { p('theme dark|light|neon|glass', 't-warn'); return true; }
    ThemeSystem.apply(args[0]); p(`Theme: ${args[0]}`, 't-info'); return true;
  };
});

/* ═══════════════════════════════════════════════════
   MAIN PLATFORM INIT
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  NotifCenter.init();
  AppSwitcher.init();
  Achievements.init();
  ThemeSystem.init();
  _injectPlatformDockIcons();

  // Override browser to use browser2
  AppManager.register('browser', { open: opts => AppManager.open('browser2', opts) });

  // Hook game launch for achievement
  Events.on('window:open', (id, app) => {
    if (app === 'game') Achievements.unlock('play_game');
    if (app === 'appstore') { setTimeout(() => Achievements.unlock('open_store'), 500); }
  });
  Events.on('achievement:install', () => Achievements.unlock('install_app'));
  Events.on('desktop:switch',      () => Achievements.unlock('multi_desk'));

  DevMode.log('Platform Extensions initialisiert', 'system');
  DevMode.log('Browser2 · AI · Chat · Cloud · Achievements · Themes', 'system');
});
