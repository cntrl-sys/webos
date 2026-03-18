/* =====================================================
   WebOS — system-extensions.js
   Advanced System Modules
   Loads after script.js and game-manager.js
   ===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   MODULE: SOUND SYSTEM
   Web Audio API — no external files needed
═══════════════════════════════════════════════════ */
const SoundSystem = (() => {
  let ctx = null;
  let enabled = true;

  function _getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function _play(freq, type, duration, gain = 0.15, attack = 0.004, decay = 0.12) {
    if (!enabled) return;
    const c = _getCtx(); if (!c) return;
    try {
      const osc  = c.createOscillator();
      const amp  = c.createGain();
      osc.connect(amp); amp.connect(c.destination);
      osc.type      = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      amp.gain.setValueAtTime(0, c.currentTime);
      amp.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
      amp.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration + 0.01);
    } catch(e) {}
  }

  function _chord(freqs, type, duration, gain) {
    freqs.forEach(f => _play(f, type, duration, gain / freqs.length));
  }

  const sounds = {
    click()     { _play(880, 'sine', 0.08, 0.06); },
    open()      { _chord([523.25, 659.25, 783.99], 'sine', 0.22, 0.1); },
    close()     { _chord([783.99, 523.25], 'sine', 0.18, 0.08); },
    minimize()  { _play(440, 'sine', 0.15, 0.07); _play(330, 'sine', 0.15, 0.05); },
    error()     { _play(220, 'sawtooth', 0.25, 0.08); _play(180, 'sawtooth', 0.25, 0.06); },
    notification() { _chord([880, 1108.73], 'sine', 0.3, 0.07); },
    startup()   {
      setTimeout(() => _play(523.25,'sine',.18,.06), 0);
      setTimeout(() => _play(659.25,'sine',.18,.06), 120);
      setTimeout(() => _play(783.99,'sine',.28,.07), 240);
      setTimeout(() => _play(1046.5,'sine',.4, .08), 360);
    },
    install()   { _chord([659.25,880,1108.73], 'sine', 0.4, 0.09); },
    trash()     { _play(180, 'sawtooth', 0.2, 0.05); },
  };

  function play(name) {
    if (sounds[name]) sounds[name]();
  }

  function setEnabled(val) {
    enabled = val;
    State.set('soundEnabled', val);
  }

  function init() {
    enabled = State.get().soundEnabled !== false;
    // Hook into WindowManager events
    Events.on('window:open',  () => play('open'));
    Events.on('window:close', () => play('close'));
  }

  return { init, play, setEnabled, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: QUICK LOOK
   Space bar on selected file → overlay preview
═══════════════════════════════════════════════════ */
const QuickLook = (() => {
  let overlay = null;
  let currentNode = null;

  function show(fileId, node) {
    if (!node) node = FileSystem.getNode(fileId);
    if (!node || node.type === 'folder') return;
    currentNode = node;
    _close(true);

    overlay = document.createElement('div');
    overlay.id = 'quicklook-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    const card = document.createElement('div');
    card.className = 'ql-card';

    const icon = node.icon || FileSystem.iconForExt(node.ext);
    const ext  = (node.ext || '').toLowerCase();

    // Header
    card.innerHTML = `
      <div class="ql-header">
        <span class="ql-icon">${icon}</span>
        <span class="ql-title">${node.name}</span>
        <button class="ql-close" title="Schließen (ESC)">✕</button>
      </div>
      <div class="ql-body" id="ql-body"></div>
      <div class="ql-footer">
        <span>${ext.toUpperCase() || 'Datei'}</span>
        <span class="ql-hint">ESC zum Schließen</span>
      </div>`;

    card.querySelector('.ql-close').addEventListener('click', close);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fill body
    const body = card.querySelector('#ql-body');
    _renderBody(body, node, ext);

    SoundSystem.play('click');
  }

  function _renderBody(body, node, ext) {
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
      const img = document.createElement('img');
      img.className = 'ql-image';
      img.src = node.content;
      img.alt = node.name;
      body.appendChild(img);
    } else if (ext === 'json') {
      const pre = document.createElement('div');
      pre.className = 'ql-json';
      try {
        const parsed = JSON.parse(node.content || '{}');
        pre.innerHTML = _colorJson(JSON.stringify(parsed, null, 2));
      } catch {
        pre.textContent = node.content || '(leer)';
      }
      body.appendChild(pre);
    } else {
      const pre = document.createElement('div');
      pre.className = 'ql-text';
      pre.textContent = node.content || '(leere Datei)';
      body.appendChild(pre);
    }
  }

  function _colorJson(str) {
    return str
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="jk">$1</span>$2')
      .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="js">$1</span>')
      .replace(/:\s*(\d+\.?\d*)/g, ': <span class="jn">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="jn">$1</span>');
  }

  function close() {
    if (!overlay) return;
    overlay.classList.add('closing');
    overlay.addEventListener('animationend', () => { overlay?.remove(); overlay = null; }, { once: true });
  }

  function _close(silent) {
    if (overlay) { overlay.remove(); overlay = null; }
  }

  function init() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay) { e.stopPropagation(); close(); }
    });
    // Space-bar on finder file items
    Events.on('finder:file:keydown', (key, fileId, node) => {
      if (key === ' ') show(fileId, node);
    });
  }

  return { init, show, close };
})();

/* ═══════════════════════════════════════════════════
   MODULE: DEVELOPER MODE
═══════════════════════════════════════════════════ */
const DevMode = (() => {
  let enabled = false;
  const MAX_LOGS = 200;
  const logs = [];
  let badge = null;
  let panelWid = null;

  function log(msg, type = 'info') {
    logs.push({ msg, type, time: new Date().toLocaleTimeString('de-DE') });
    if (logs.length > MAX_LOGS) logs.shift();
    Events.emit('devmode:log', msg, type);
  }

  function init() {
    enabled = State.get().devMode || false;

    // Create badge
    badge = document.createElement('div');
    badge.id = 'devmode-badge';
    badge.textContent = '⚙ DEV';
    badge.title = 'Developer Mode aktiv — Klicken für Panel';
    badge.addEventListener('click', openPanel);
    document.body.appendChild(badge);
    if (enabled) badge.classList.add('visible');

    // Intercept Events globally for logging
    const origEmit = Events.emit.bind(Events);
    Events.emit = function(ev, ...args) {
      if (enabled && !ev.startsWith('devmode')) {
        log(`[EVENT] ${ev}`, 'event');
      }
      return origEmit(ev, ...args);
    };

    // Keyboard shortcut: Ctrl+Shift+D
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        toggle();
      }
    });
  }

  function toggle() {
    enabled = !enabled;
    State.set('devMode', enabled);
    badge.classList.toggle('visible', enabled);
    SoundSystem.play(enabled ? 'notification' : 'click');
    Toast.show(enabled ? '⚙️ Developer Mode aktiviert (Ctrl+Shift+D)' : 'Developer Mode deaktiviert', enabled ? '✅' : 'ℹ️');
    log(`Developer Mode ${enabled ? 'aktiviert' : 'deaktiviert'}`, 'system');
  }

  function openPanel() {
    if (!enabled) return;
    const wid = 'devpanel';
    if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }
    panelWid = wid;

    const wrap = document.createElement('div');
    wrap.className = 'devpanel-layout';

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'devpanel-tabs';
    const TABS = ['Events', 'Fenster', 'Zustand', 'Konsole'];
    const sections = [];
    const tabEls = [];

    TABS.forEach((t, i) => {
      const tab = document.createElement('button');
      tab.className = 'devpanel-tab' + (i === 0 ? ' active' : '');
      tab.textContent = t;
      tab.addEventListener('click', () => {
        tabEls.forEach((el, j) => el.classList.toggle('active', j === i));
        sections.forEach((s, j) => s.classList.toggle('active', j === i));
        if (i === 1) refreshWindows();
        if (i === 2) refreshState();
      });
      tabBar.appendChild(tab);
      tabEls.push(tab);
    });

    wrap.appendChild(tabBar);

    // Section 0: Event log
    const s0 = document.createElement('div');
    s0.className = 'devpanel-section active';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'dev-clear-btn'; clearBtn.textContent = 'Leeren';
    clearBtn.addEventListener('click', () => { logs.length = 0; logOut.innerHTML = ''; });
    const logOut = document.createElement('div');
    logOut.className = 'dev-log-output';
    s0.appendChild(clearBtn); s0.appendChild(logOut);
    sections.push(s0);

    function appendLog(msg, type) {
      const line = document.createElement('span');
      line.className = `dev-log-line ${type || 'info'}`;
      const now = new Date().toLocaleTimeString('de-DE');
      line.textContent = `[${now}] ${msg}`;
      logOut.appendChild(line);
      logOut.scrollTop = logOut.scrollHeight;
    }
    logs.forEach(l => appendLog(l.msg, l.type));
    Events.on('devmode:log', (msg, type) => { if (panelWid) appendLog(msg, type); });

    // Section 1: Windows
    const s1 = document.createElement('div'); s1.className = 'devpanel-section';
    const wTable = document.createElement('table'); wTable.className = 'dev-windows-table';
    wTable.innerHTML = '<thead><tr><th>ID</th><th>App</th><th>Status</th><th>Z</th><th>Größe</th></tr></thead>';
    const wBody = document.createElement('tbody'); wTable.appendChild(wBody);
    s1.appendChild(wTable); sections.push(s1);

    function refreshWindows() {
      wBody.innerHTML = '';
      WindowManager.getAllWins().forEach((w, id) => {
        const tr = document.createElement('tr');
        const status = w.minimized ? 'minimiert' : w.maximized ? 'maximiert' : 'aktiv';
        const z = parseInt(w.el.style.zIndex) || '—';
        const sz = `${w.el.offsetWidth}×${w.el.offsetHeight}`;
        tr.innerHTML = `<td>${id.slice(0,16)}…</td><td>${w.app}</td><td>${status}</td><td>${z}</td><td>${sz}</td>`;
        wBody.appendChild(tr);
      });
    }

    // Section 2: State
    const s2 = document.createElement('div'); s2.className = 'devpanel-section';
    const statePre = document.createElement('div'); statePre.className = 'dev-state-pre';
    s2.appendChild(statePre); sections.push(s2);

    function refreshState() {
      try {
        const s = JSON.parse(JSON.stringify(State.get()));
        // Trim large fields
        if (s.filesystem) Object.keys(s.filesystem).forEach(k => {
          if (s.filesystem[k]?.content?.length > 60)
            s.filesystem[k].content = s.filesystem[k].content.slice(0,60) + '…';
        });
        statePre.textContent = JSON.stringify(s, null, 2);
      } catch(e) { statePre.textContent = 'Fehler: ' + e.message; }
    }

    // Section 3: Console (mini REPL)
    const s3 = document.createElement('div'); s3.className = 'devpanel-section';
    s3.style.cssText = 'display:flex;flex-direction:column;';
    const consoleOut = document.createElement('div');
    consoleOut.style.cssText = 'flex:1;overflow:auto;padding:10px 14px;font-family:monospace;font-size:12px;color:#30d158;';
    const consoleIn = document.createElement('input');
    consoleIn.style.cssText = 'background:rgba(0,0,0,.4);border:none;border-top:1px solid rgba(48,209,88,.2);color:#30d158;font-family:monospace;font-size:12.5px;padding:8px 14px;outline:none;';
    consoleIn.placeholder = '> JavaScript auswerten…';
    consoleIn.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const code = consoleIn.value; consoleIn.value = '';
      const inLine = document.createElement('div');
      inLine.style.color = 'rgba(255,255,255,.6)';
      inLine.textContent = '> ' + code;
      consoleOut.appendChild(inLine);
      try {
        // Safe eval with OS globals exposed
        const fn = new Function('AppManager','State','FileSystem','WindowManager','Events','Toast','GameManager',
          `"use strict"; return (${code})`);
        const result = fn(AppManager, State, FileSystem, WindowManager, Events, Toast,
          typeof GameManager !== 'undefined' ? GameManager : undefined);
        const out = document.createElement('div');
        out.textContent = JSON.stringify(result, null, 2) ?? String(result);
        consoleOut.appendChild(out);
      } catch(err) {
        const out = document.createElement('div');
        out.style.color = '#ff453a';
        out.textContent = '✕ ' + err.message;
        consoleOut.appendChild(out);
      }
      consoleOut.scrollTop = consoleOut.scrollHeight;
    });
    s3.appendChild(consoleOut); s3.appendChild(consoleIn);
    sections.push(s3);

    sections.forEach(s => wrap.appendChild(s));

    WindowManager.create({ id: wid, title: '⚙️ Developer Panel', app: 'devpanel', width: 680, height: 460, content: wrap });
    panelWid = wid;
    log('Dev Panel geöffnet', 'system');
  }

  return { init, toggle, log, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   APP: TASK MANAGER
═══════════════════════════════════════════════════ */
AppManager.register('taskmanager', { open: opts => _openTaskManager(opts) });

function _openTaskManager(opts = {}) {
  const wid = 'taskmanager';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div');
  wrap.className = 'taskman-layout';

  // ── System stats bar ───────────────────────────
  const statsBar = document.createElement('div');
  statsBar.className = 'taskman-stats';

  function makeStat(label, fillClass) {
    const s = document.createElement('div'); s.className = 'ts-stat';
    const lbl  = document.createElement('div'); lbl.className = 'ts-label'; lbl.textContent = label;
    const val  = document.createElement('div'); val.className = 'ts-value'; val.textContent = '0%';
    const bar  = document.createElement('div'); bar.className = 'ts-bar';
    const fill = document.createElement('div'); fill.className = `ts-fill ${fillClass}`;
    fill.style.width = '0%';
    bar.appendChild(fill); s.append(lbl, val, bar);
    return { el: s, val, fill };
  }
  const cpuStat  = makeStat('CPU',       'cpu');
  const memStat  = makeStat('RAM',       'mem');
  const diskStat = makeStat('Fenster',   'disk');
  statsBar.append(cpuStat.el, memStat.el, diskStat.el);

  // ── Header ─────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'taskman-header';
  const htitle = document.createElement('span'); htitle.className = 'taskman-title'; htitle.textContent = 'Laufende Prozesse';
  const sortBtn = document.createElement('button'); sortBtn.className = 'taskman-sort'; sortBtn.textContent = '↕ CPU';
  header.append(htitle, sortBtn);

  // ── Table ──────────────────────────────────────
  const tableWrap = document.createElement('div'); tableWrap.className = 'taskman-table-wrap';
  const table = document.createElement('table');   table.className = 'taskman-table';
  table.innerHTML = `<thead><tr>
    <th data-col="name">Prozess</th>
    <th data-col="status">Status</th>
    <th data-col="cpu">CPU</th>
    <th data-col="mem">MEM</th>
    <th>Aktivität</th>
    <th></th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  table.appendChild(tbody); tableWrap.appendChild(table);

  wrap.append(header, statsBar, tableWrap);

  // ── Per-process CPU history (for sparklines) ──
  const cpuHistory = new Map(); // wid -> [numbers]

  // ── Sort state ─────────────────────────────────
  let sortCol = 'cpu', sortAsc = false;
  table.querySelectorAll('thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = false; }
      table.querySelectorAll('thead th').forEach(x => x.classList.remove('sorted'));
      th.classList.add('sorted');
      render();
    });
  });
  sortBtn.addEventListener('click', () => {
    sortCol = sortCol === 'cpu' ? 'mem' : 'cpu';
    sortBtn.textContent = `↕ ${sortCol.toUpperCase()}`;
    render();
  });

  // ── CPU simulation ─────────────────────────────
  function simCPU(wid, isActive, isGame) {
    const base = isGame ? 18 : isActive ? 8 : 1;
    const noise = Math.random() * (isActive ? 22 : isGame ? 30 : 5);
    return Math.min(99, Math.round(base + noise));
  }
  function simMEM(app) {
    const map = { game: 128, browser: 96, finder: 32, editor: 18, terminal: 12, calculator: 8, musicplayer: 24, taskmanager: 16, settings: 12 };
    const base = map[app] || 20;
    return base + Math.round(Math.random() * 12);
  }

  // ── Render ─────────────────────────────────────
  function render() {
    tbody.innerHTML = '';
    const allWins = WindowManager.getAllWins();
    const entries = [];

    allWins.forEach((w, wid) => {
      if (!cpuHistory.has(wid)) cpuHistory.set(wid, []);
      const isActive  = !w.minimized && parseInt(w.el.style.zIndex) === maxZ();
      const isGame    = w.app === 'game';
      const cpu       = simCPU(wid, isActive, isGame);
      const mem       = simMEM(w.app);
      const hist      = cpuHistory.get(wid);
      hist.push(cpu); if (hist.length > 10) hist.shift();
      entries.push({ wid, w, cpu, mem, hist });
    });

    // Sort
    entries.sort((a, b) => {
      let va, vb;
      if (sortCol === 'cpu') { va = a.cpu; vb = b.cpu; }
      else if (sortCol === 'mem') { va = a.mem; vb = b.mem; }
      else { va = a.w.title; vb = b.w.title; }
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    if (entries.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6"><div class="taskman-empty">🖥️ Keine laufenden Prozesse</div></td>`;
      tbody.appendChild(tr); return;
    }

    entries.forEach(({ wid, w, cpu, mem, hist }) => {
      const status = w.minimized ? 'minimized' : w.maximized ? 'running' : 'running';
      const statusLabel = w.minimized ? 'Minimiert' : 'Aktiv';
      const cpuClass = cpu > 50 ? 'high' : cpu > 20 ? 'mid' : 'low';

      const tr = document.createElement('tr'); tr.className = 'taskman-row';
      const td0 = document.createElement('td');
      td0.innerHTML = `<div class="proc-name"><span class="proc-icon">${_appIcon(w.app)}</span><div><div class="proc-label">${w.title.replace(/^[^\s]+\s/,'')}</div><div class="proc-pid">${wid.slice(-8)}</div></div></div>`;
      const td1 = document.createElement('td');
      td1.innerHTML = `<span class="proc-status ${status}">${statusLabel}</span>`;
      const td2 = document.createElement('td');
      td2.innerHTML = `<span class="proc-cpu ${cpuClass}">${cpu}%</span>`;
      const td3 = document.createElement('td');
      td3.innerHTML = `<span class="proc-mem">${mem} MB</span>`;

      // Sparkline
      const td4 = document.createElement('td');
      td4.appendChild(_sparkline(hist));

      const td5 = document.createElement('td');
      td5.innerHTML = `<div class="proc-actions">
        <button class="proc-btn focus" data-wid="${wid}">Fokus</button>
        <button class="proc-btn kill"  data-wid="${wid}">✕</button>
      </div>`;
      td5.querySelector('.focus').addEventListener('click', () => { WindowManager.focus(wid); SoundSystem.play('click'); });
      td5.querySelector('.kill' ).addEventListener('click', () => {
        SoundSystem.play('close');
        WindowManager.close(wid);
        setTimeout(render, 100);
      });

      tr.append(td0, td1, td2, td3, td4, td5);
      tbody.appendChild(tr);
    });

    // Update stats bar
    const totalCPU = Math.min(99, entries.reduce((s, e) => s + e.cpu, 0));
    const avgCPU   = entries.length ? Math.round(totalCPU / entries.length) : 0;
    const totalMEM = entries.reduce((s, e) => s + e.mem, 0);
    cpuStat.val.textContent  = avgCPU + '%';
    cpuStat.fill.style.width = avgCPU + '%';
    memStat.val.textContent  = totalMEM + ' MB';
    memStat.fill.style.width = Math.min(99, totalMEM / 4) + '%';
    diskStat.val.textContent = entries.length + '';
    diskStat.fill.style.width = Math.min(99, entries.length * 12) + '%';
  }

  function maxZ() {
    let m = 0;
    WindowManager.getAllWins().forEach(w => { const z = parseInt(w.el.style.zIndex)||0; if(z>m)m=z; });
    return m;
  }

  function _appIcon(app) {
    const m = { finder:'📁', editor:'✏️', browser:'🌐', imageviewer:'🖼️', terminal:'💻',
                calculator:'🔢', musicplayer:'🎵', game:'🎮', settings:'⚙️', trash:'🗑️',
                games:'🕹️', taskmanager:'📊', devpanel:'⚙️', appstore:'🏪' };
    return m[app] || '📦';
  }

  function _sparkline(data) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 60 22'); svg.setAttribute('width', '60'); svg.setAttribute('height', '22');
    if (data.length < 2) return svg;
    const max = Math.max(...data, 1);
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * 58 + 1;
      const y = 21 - (v / max) * 19;
      return `${x},${y}`;
    }).join(' ');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('stroke', '#0a84ff'); poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('fill', 'none'); poly.setAttribute('stroke-linecap', 'round');
    svg.appendChild(poly);
    return svg;
  }

  // Auto-refresh
  let rafId = null;
  let last = 0;
  function tick(ts) {
    if (ts - last > 1200) { last = ts; render(); }
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // Stop on close
  Events.on('window:close', id => { if (id === wid) { cancelAnimationFrame(rafId); rafId = null; } });

  render();
  WindowManager.create({ id: wid, title: '📊 Task Manager', app: 'taskmanager', width: 720, height: 480, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: APP STORE
═══════════════════════════════════════════════════ */
AppManager.register('appstore', { open: opts => _openAppStore(opts) });

// App catalog — extend freely
const APP_CATALOG = [
  {
    id:'calc-pro', title:'Rechner Pro', dev:'WebOS Labs', category:'Tools',
    icon:'🔬', color:'#1a1a2e', accent:'#bf5af2', desc:'Wissenschaftlicher Taschenrechner mit Verlauf.',
    size:'2.1 MB', rating:4.5, ratingCount:128, appId:'calculator',
  },
  {
    id:'clock-widget', title:'Uhr Widget', dev:'WebOS Labs', category:'Widgets',
    icon:'🕐', color:'#0a1a2a', accent:'#0a84ff', desc:'Elegante Desktop-Uhr als Widget.',
    size:'0.8 MB', rating:4.8, ratingCount:312, widgetType:'clock',
  },
  {
    id:'weather-widget', title:'Wetter Widget', dev:'WebOS Labs', category:'Widgets',
    icon:'🌤️', color:'#0a2a40', accent:'#5ac8fa', desc:'Wetteranzeige für deinen Desktop.',
    size:'1.2 MB', rating:4.3, ratingCount:89, widgetType:'weather',
  },
  {
    id:'notes-widget', title:'Notiz Widget', dev:'WebOS Labs', category:'Widgets',
    icon:'📝', color:'#2a2000', accent:'#ffd60a', desc:'Schnelle Notizen direkt auf dem Desktop.',
    size:'0.5 MB', rating:4.6, ratingCount:204, widgetType:'notes',
  },
  {
    id:'snake-game', title:'Snake Classic', dev:'WebOS Games', category:'Spiele',
    icon:'🐍', color:'#0d2818', accent:'#30d158', desc:'Das Klassiker-Schlangen-Spiel.',
    size:'85 KB', rating:4.7, ratingCount:502, gameId:'snake',
  },
  {
    id:'breakout-game', title:'Breakout', dev:'WebOS Games', category:'Spiele',
    icon:'🧱', color:'#0a0a24', accent:'#0a84ff', desc:'Zerstöre alle Blöcke mit dem Ball!',
    size:'92 KB', rating:4.4, ratingCount:287, gameId:'breakout',
  },
  {
    id:'text-expander', title:'Text Expander', dev:'Community', category:'Produktivität',
    icon:'📋', color:'#1a2a1a', accent:'#30d158', desc:'Erstelle Textkürzel für häufige Phrasen.',
    size:'1.4 MB', rating:4.1, ratingCount:44, appId:'editor',
  },
  {
    id:'taskman', title:'Task Manager', dev:'WebOS System', category:'System',
    icon:'📊', color:'#0a0a14', accent:'#ff9f0a', desc:'Überwache und verwalte laufende Prozesse.',
    size:'1.8 MB', rating:4.9, ratingCount:156, appId:'taskmanager',
  },
];

function _openAppStore(opts = {}) {
  const wid = 'appstore';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  // Track installed apps in state
  if (!State.get().installedApps) State.set('installedApps', {});
  const installed = () => State.get().installedApps || {};

  const wrap = document.createElement('div');
  wrap.className = 'appstore-layout';

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'appstore-sidebar';
  sidebar.innerHTML = `<div class="appstore-sidebar-logo"><div class="as-logo-title">🏪 App Store</div><div class="as-logo-sub">WebOS Plattform</div></div>`;

  const NAV = [
    { id:'featured', icon:'⭐', label:'Empfohlen' },
    { id:'all',      icon:'🔍', label:'Alle Apps' },
    { id:'tools',    icon:'🔧', label:'Tools' },
    { id:'games',    icon:'🎮', label:'Spiele' },
    { id:'widgets',  icon:'📊', label:'Widgets' },
    { id:'system',   icon:'⚙️', label:'System' },
    { id:'installed',icon:'✅', label:'Installiert' },
  ];
  let currentSection = 'featured';
  const navItems = [];

  NAV.forEach(n => {
    const el = document.createElement('div');
    el.className = 'as-nav-item' + (n.id === 'featured' ? ' active' : '');
    el.innerHTML = `<span class="as-nav-icon">${n.icon}</span>${n.label}`;
    el.addEventListener('click', () => {
      navItems.forEach(x => x.classList.remove('active')); el.classList.add('active');
      currentSection = n.id; renderContent();
    });
    sidebar.appendChild(el); navItems.push(el);
  });

  const instCount = document.createElement('div');
  instCount.className = 'as-installed-count';
  sidebar.appendChild(document.createElement('div')).className = 'as-sidebar-spacer';
  sidebar.appendChild(instCount);

  // Main
  const main = document.createElement('div');
  main.className = 'appstore-main';
  const searchRow = document.createElement('div');
  searchRow.className = 'appstore-search-row';
  const searchInput = document.createElement('input');
  searchInput.className = 'as-search'; searchInput.placeholder = '🔍 Apps suchen…';
  searchInput.addEventListener('input', renderContent);
  searchRow.appendChild(searchInput);
  main.appendChild(searchRow);

  const content = document.createElement('div');
  content.className = 'appstore-content';
  main.appendChild(content);

  wrap.append(sidebar, main);

  function _stars(rating) {
    let html = '<div class="as-stars">';
    for (let i = 1; i <= 5; i++) {
      html += `<span class="as-star${i > rating ? ' empty' : ''}">★</span>`;
    }
    html += `<span class="as-rating-count">(${html.match(/ratingCount/)?.[0]||''})</span></div>`;
    return html;
  }

  function _makeCard(app) {
    const isInstalled = !!installed()[app.id];
    const card = document.createElement('div');
    card.className = 'as-card';
    let starsHtml = '<div class="as-stars">';
    const full = Math.floor(app.rating), half = app.rating % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
      starsHtml += `<span class="as-star${i > app.rating ? ' empty' : ''}">★</span>`;
    }
    starsHtml += `<span class="as-rating-count">(${app.ratingCount})</span></div>`;

    card.innerHTML = `
      <div class="as-card-header" style="background:${app.color}">
        <span class="as-card-icon">${app.icon}</span>
        <span class="as-card-cat" style="color:${app.accent}">${app.category}</span>
      </div>
      <div class="as-card-body">
        <div class="as-card-title">${app.title}</div>
        <div class="as-card-dev">${app.dev}</div>
        <div class="as-card-desc">${app.desc}</div>
        ${starsHtml}
      </div>
      <div class="as-card-footer">
        <button class="as-install-btn ${isInstalled ? 'installed' : 'install'}" data-id="${app.id}">
          ${isInstalled ? '✓ Installiert' : 'Installieren'}
        </button>
        <span class="as-size">${app.size}</span>
      </div>`;

    const btn = card.querySelector('.as-install-btn');
    btn.addEventListener('click', e => { e.stopPropagation(); _handleInstall(app, btn); });
    if (isInstalled) {
      card.addEventListener('dblclick', () => _launchApp(app));
    }
    return card;
  }

  function _handleInstall(app, btn) {
    const inst = installed();
    if (inst[app.id]) {
      // Already installed — offer launch or remove
      if (confirm(`"${app.title}" ist installiert.\nDeinstallieren?`)) {
        delete inst[app.id]; State.set('installedApps', inst);
        btn.className = 'as-install-btn install'; btn.textContent = 'Installieren';
        Toast.show(`"${app.title}" deinstalliert`, '🗑️');
        _updateCount();
      }
      return;
    }
    btn.className = 'as-install-btn installing'; btn.textContent = '⏳ Installieren…';
    SoundSystem.play('click');
    const dur = 800 + Math.random() * 1200;
    setTimeout(() => {
      inst[app.id] = { installedAt: new Date().toLocaleDateString('de-DE') };
      State.set('installedApps', inst);
      btn.className = 'as-install-btn installed'; btn.textContent = '✓ Installiert';
      SoundSystem.play('install');
      Toast.showInteractive({
        title: `"${app.title}" installiert!`, icon: '✅',
        actions: [{ label: 'Öffnen', primary: true, cb: () => _launchApp(app) }]
      });
      _updateCount();
    }, dur);
  }

  function _launchApp(app) {
    if (app.appId)     AppManager.open(app.appId);
    else if (app.gameId && typeof GameManager !== 'undefined') GameManager.launchGame(app.gameId);
    else if (app.widgetType) WidgetSystem.addWidget(app.widgetType);
    else Toast.show('App kann nicht geöffnet werden', '⚠️');
  }

  function _updateCount() {
    const n = Object.keys(installed()).length;
    instCount.textContent = `${n} App${n !== 1 ? 's' : ''} installiert`;
  }

  function renderContent() {
    content.innerHTML = '';
    const term = searchInput.value.toLowerCase();
    let apps = APP_CATALOG.filter(a => !term || a.title.toLowerCase().includes(term) || a.desc.toLowerCase().includes(term));

    if (currentSection === 'featured') {
      if (!term) {
        // Featured banner
        const featured = apps[0];
        const banner = document.createElement('div');
        banner.className = 'as-featured';
        banner.style.background = `linear-gradient(135deg, ${featured.color}, ${featured.accent}22)`;
        banner.innerHTML = `
          <span class="as-featured-icon">${featured.icon}</span>
          <div class="as-featured-info">
            <div class="as-featured-badge">⭐ App der Woche</div>
            <div class="as-featured-title">${featured.title}</div>
            <div class="as-featured-desc">${featured.desc}</div>
          </div>
          <button class="as-featured-btn">Jetzt laden</button>`;
        banner.querySelector('.as-featured-btn').addEventListener('click', () => _handleInstall(featured, banner.querySelector('.as-featured-btn')));
        content.appendChild(banner);
      }
      const t = document.createElement('div'); t.className = 'as-section-title'; t.textContent = 'Alle Apps';
      content.appendChild(t);
    } else if (currentSection === 'installed') {
      apps = apps.filter(a => installed()[a.id]);
      if (!apps.length) {
        content.innerHTML = '<div style="text-align:center;padding:60px;color:rgba(255,255,255,.3);font-size:13px">Noch keine Apps installiert.<br><br>Entdecke Apps im Store!</div>';
        _updateCount(); return;
      }
      const t = document.createElement('div'); t.className = 'as-section-title'; t.textContent = 'Installierte Apps';
      content.appendChild(t);
    } else {
      const catMap = { tools:'Tools', games:'Spiele', widgets:'Widgets', system:'System', all:null };
      const cat = catMap[currentSection];
      if (cat) apps = apps.filter(a => a.category === cat);
    }

    const grid = document.createElement('div'); grid.className = 'as-grid';
    apps.forEach(app => grid.appendChild(_makeCard(app)));
    content.appendChild(grid);
    _updateCount();
  }

  renderContent();
  WindowManager.create({ id: wid, title: '🏪 App Store', app: 'appstore', width: 800, height: 560, content: wrap });
}

/* ═══════════════════════════════════════════════════
   MODULE: WIDGET SYSTEM
═══════════════════════════════════════════════════ */
const WidgetSystem = (() => {
  const widgets = new Map(); // id -> { el, type, def }
  let widgetCounter = 0;

  function addWidget(type, opts = {}) {
    const id   = 'widget_' + type + '_' + (++widgetCounter);
    const def  = _createWidget(type, id, opts);
    if (!def) return;

    const el = def.el;
    el.classList.add('desktop-widget');
    el.style.left = (opts.x || 120 + widgetCounter * 20) + 'px';
    el.style.top  = (opts.y || 60  + widgetCounter * 10) + 'px';

    // Close button
    const handle = document.createElement('div');
    handle.className = 'widget-handle';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'widget-close-btn'; closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => removeWidget(id));
    handle.appendChild(closeBtn);
    el.appendChild(handle);

    // Draggable
    _makeDraggable(el);

    // Add to active desktop
    const slide = DesktopManager.getActiveSlide();
    if (slide) slide.querySelector('.desktop-icons-layer').appendChild(el);

    widgets.set(id, { el, type, def });
    SoundSystem.play('open');
    Toast.show(`Widget "${type}" hinzugefügt`, '🧩');
    return id;
  }

  function removeWidget(id) {
    const w = widgets.get(id);
    if (!w) return;
    w.def.destroy?.();
    w.el.style.animation = 'win-close .2s ease both';
    w.el.addEventListener('animationend', () => w.el.remove(), { once: true });
    widgets.delete(id);
  }

  function _createWidget(type, id, opts) {
    if (type === 'clock')   return _clockWidget(id);
    if (type === 'weather') return _weatherWidget(id);
    if (type === 'notes')   return _notesWidget(id, opts);
    Toast.show(`Widget-Typ "${type}" unbekannt`, '⚠️');
    return null;
  }

  function _clockWidget(id) {
    const el = document.createElement('div');
    el.className = 'widget-clock';
    el.innerHTML = `<div class="wc-time" id="wct-${id}">00:00</div><div class="wc-date" id="wcd-${id}"></div><div class="wc-tz">MESZ</div>`;
    const DAYS=['So','Mo','Di','Mi','Do','Fr','Sa'];
    const MONTHS=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    function update() {
      const now = new Date();
      const h=String(now.getHours()).padStart(2,'0'), m=String(now.getMinutes()).padStart(2,'0');
      const timeEl = document.getElementById(`wct-${id}`);
      const dateEl = document.getElementById(`wcd-${id}`);
      if (timeEl) timeEl.textContent = `${h}:${m}`;
      if (dateEl) dateEl.textContent = `${DAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}`;
    }
    update();
    const timer = setInterval(update, 10000);
    return { el, destroy: () => clearInterval(timer) };
  }

  function _weatherWidget(id) {
    const CITIES = [
      { name:'Berlin',  icon:'🌤️', temp:18, feel:15, hum:62, wind:14, desc:'Leicht bewölkt' },
      { name:'München', icon:'⛅', temp:14, feel:11, hum:70, wind:10, desc:'Wechselhaft' },
      { name:'Hamburg', icon:'🌧️', temp:11, feel:9,  hum:84, wind:22, desc:'Regnerisch' },
    ];
    const city = CITIES[Math.floor(Math.random() * CITIES.length)];
    const el = document.createElement('div');
    el.className = 'widget-weather';
    el.innerHTML = `
      <div class="ww-top"><span class="ww-icon">${city.icon}</span><div class="ww-temp">${city.temp}°</div></div>
      <div class="ww-city">${city.name}</div>
      <div class="ww-desc">${city.desc}</div>
      <div class="ww-row">
        <div class="ww-stat"><div class="ww-slabel">Gefühlt</div><div class="ww-sval">${city.feel}°</div></div>
        <div class="ww-stat"><div class="ww-slabel">Feuchte</div><div class="ww-sval">${city.hum}%</div></div>
        <div class="ww-stat"><div class="ww-slabel">Wind</div><div class="ww-sval">${city.wind} km/h</div></div>
      </div>`;
    return { el };
  }

  function _notesWidget(id, opts) {
    const el = document.createElement('div');
    el.className = 'widget-notes';
    const STORAGE_KEY = 'widget_notes_' + id;
    el.innerHTML = `
      <div class="wn-header"><span class="wn-icon">📝</span><span class="wn-title">Schnellnotiz</span></div>
      <textarea class="wn-text" placeholder="Tippe hier…"></textarea>`;
    const ta = el.querySelector('.wn-text');
    ta.value = localStorage.getItem(STORAGE_KEY) || '';
    ta.addEventListener('input', () => localStorage.setItem(STORAGE_KEY, ta.value));
    // Stop drag when typing
    ta.addEventListener('mousedown', e => e.stopPropagation());
    return { el, destroy: () => localStorage.removeItem(STORAGE_KEY) };
  }

  function _makeDraggable(el) {
    let sx, sy, sl, st, dragging = false;
    el.addEventListener('mousedown', e => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      sl = parseInt(el.style.left) || 0; st = parseInt(el.style.top) || 0;
      e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      requestAnimationFrame(() => {
        el.style.left = Math.max(0, sl + (e.clientX - sx)) + 'px';
        el.style.top  = Math.max(28, st + (e.clientY - sy)) + 'px';
      });
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  function getAll() { return widgets; }

  return { addWidget, removeWidget, getAll };
})();

/* ═══════════════════════════════════════════════════
   TERMINAL PLUGIN EXTENSIONS
   Adds: kill, theme, widget, store, devmode
═══════════════════════════════════════════════════ */
function _registerTerminalExtensions() {
  window.__terminalPlugins = window.__terminalPlugins || {};

  window.__terminalPlugins['kill'] = (args, print) => {
    if (!args[0]) { print('kill: App-Name fehlt', 't-err'); return true; }
    let killed = 0;
    WindowManager.getAllWins().forEach((w, id) => {
      if (w.app === args[0] || w.title.toLowerCase().includes(args[0].toLowerCase())) {
        WindowManager.close(id); killed++;
      }
    });
    print(killed ? `${killed} Prozess(e) beendet: ${args[0]}` : `Kein Prozess gefunden: ${args[0]}`, killed ? 't-info' : 't-err');
    return true;
  };

  window.__terminalPlugins['theme'] = (args, print) => {
    const val = args[0];
    if (val === 'dark')  { Theme.applyLightMode(false); print('Dunkelmodus aktiviert', 't-info'); }
    else if (val === 'light') { Theme.applyLightMode(true); print('Hellmodus aktiviert', 't-info'); }
    else { print('theme dark | theme light', 't-warn'); }
    return true;
  };

  window.__terminalPlugins['widget'] = (args, print) => {
    const sub = args[0];
    if (sub === 'add' && args[1]) {
      WidgetSystem.addWidget(args[1]); print(`Widget "${args[1]}" hinzugefügt`, 't-info');
    } else if (sub === 'list') {
      print('Verfügbar: clock, weather, notes', 't-info');
    } else if (sub === 'remove' && args[1]) {
      const w = [...WidgetSystem.getAll()].find(([id]) => id.includes(args[1]));
      if (w) { WidgetSystem.removeWidget(w[0]); print('Widget entfernt', 't-info'); }
      else print('Widget nicht gefunden', 't-err');
    } else {
      print('widget add <typ> | widget list | widget remove <typ>', 't-warn');
    }
    return true;
  };

  window.__terminalPlugins['store'] = (args, print) => {
    AppManager.open('appstore'); print('App Store geöffnet', 't-info'); return true;
  };

  window.__terminalPlugins['taskman'] = (args, print) => {
    AppManager.open('taskmanager'); print('Task Manager geöffnet', 't-info'); return true;
  };

  window.__terminalPlugins['devmode'] = (args, print) => {
    DevMode.toggle(); print('Developer Mode umgeschaltet', 't-info'); return true;
  };

  window.__terminalPlugins['sound'] = (args, print) => {
    const val = args[0] === 'off' ? false : true;
    SoundSystem.setEnabled(val);
    print(`Sound ${val ? 'aktiviert' : 'deaktiviert'}`, 't-info'); return true;
  };

  window.__terminalPlugins['quicklook'] = (args, print) => {
    print('Quicklook: Datei im Finder auswählen, dann Leertaste drücken', 't-info'); return true;
  };
}

/* ═══════════════════════════════════════════════════
   SETTINGS EXTENSION: Add tabs for Widgets, Sound, Users
═══════════════════════════════════════════════════ */
function _patchSettings() {
  // We extend the existing settings by adding items after OS starts
  // by patching AppManager's settings registration
  const origOpen = AppManager.open.bind(AppManager);
  // Store original settings app
  const origSettingsReg = AppManager['_registry']?.settings;

  // Add dock item for task manager via context menu extension
  Events.on('os:started', () => {
    // Extend desktop right-click menu
    const origDesktopCtx = window.__desktopCtxItems;
  });
}

/* ═══════════════════════════════════════════════════
   USER PROFILE SYSTEM
   Multi-user login with separate state per profile
═══════════════════════════════════════════════════ */
const UserSystem = (() => {
  const PROFILES_KEY = 'webos_profiles_v1';
  const DEFAULT_PROFILES = [
    { id:'user1', name:'Benutzer',   avatar:'👤', role:'Standard',   password:'webos',  color:'#0a84ff' },
    { id:'user2', name:'Gast',       avatar:'👻', role:'Gast',       password:'',       color:'#30d158' },
    { id:'admin', name:'Admin',      avatar:'👑', role:'Administrator', password:'admin', color:'#ffd60a' },
  ];

  let activeUser = null;

  function getProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY)) || DEFAULT_PROFILES; }
    catch { return DEFAULT_PROFILES; }
  }

  function getActive() { return activeUser; }

  function buildLoginUI() {
    const screen = document.getElementById('login-screen');
    if (!screen) return;

    // Hide existing single-user card, build multi-user grid
    const existingCard = screen.querySelector('.login-card');
    if (existingCard) existingCard.style.display = 'none';

    const profiles = getProfiles();

    const grid = document.createElement('div');
    grid.className = 'user-grid';

    const cardsRow = document.createElement('div');
    cardsRow.className = 'user-cards-row';

    let selectedProfile = null;
    let cards = [];

    profiles.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'user-card';
      card.innerHTML = `<div class="user-avatar">${profile.avatar}</div><div class="user-name">${profile.name}</div><div class="user-role">${profile.role}</div>`;
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedProfile = profile;
        showPasswordRow(profile);
      });
      cardsRow.appendChild(card);
      cards.push(card);
    });

    // Auto-select first
    cards[0]?.click();

    const pwRow = document.createElement('div');
    pwRow.className = 'user-pw-row';

    const pwLabel  = document.createElement('div'); pwLabel.className = 'user-pw-label';
    const pwWrap   = document.createElement('div'); pwWrap.className = 'user-pw-input-wrap';
    const pwInput  = document.createElement('input');
    pwInput.className = 'login-pw'; pwInput.type = 'password'; pwInput.placeholder = 'Passwort…'; pwInput.autocomplete = 'off';
    const pwBtn    = document.createElement('button');
    pwBtn.className = 'login-btn'; pwBtn.textContent = '→';
    pwWrap.append(pwInput, pwBtn);

    const errorEl  = document.createElement('div'); errorEl.className = 'login-error hidden'; errorEl.textContent = 'Falsches Passwort';
    const guestBtn = document.createElement('button'); guestBtn.className = 'guest-btn'; guestBtn.textContent = 'Als Gast fortfahren';

    pwRow.append(pwLabel, pwWrap, errorEl, guestBtn);

    function showPasswordRow(profile) {
      pwLabel.textContent = `Hallo, ${profile.name}!`;
      pwInput.value = ''; errorEl.classList.add('hidden');
      if (profile.role === 'Gast' || profile.password === '') {
        pwRow.style.opacity = '0.6';
      } else {
        pwRow.style.opacity = '1';
      }
    }

    function tryLogin() {
      if (!selectedProfile) return;
      const val = pwInput.value.trim();
      const ok  = selectedProfile.password === '' || val === selectedProfile.password;
      if (ok) {
        activeUser = selectedProfile;
        // Store active user ID so OS can use it
        sessionStorage.setItem('webos_active_user', selectedProfile.id);
        screen.classList.add('fade-out');
        screen.addEventListener('transitionend', () => screen.remove(), { once: true });
        startOS();
      } else {
        errorEl.classList.remove('hidden');
        pwInput.value = ''; pwInput.focus();
        SoundSystem.play('error');
      }
    }

    guestBtn.addEventListener('click', () => {
      const guest = profiles.find(p => p.role === 'Gast') || profiles[1];
      activeUser = guest;
      screen.classList.add('fade-out');
      screen.addEventListener('transitionend', () => screen.remove(), { once: true });
      startOS();
    });
    pwBtn.addEventListener('click', tryLogin);
    pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });

    grid.append(cardsRow, pwRow);
    screen.appendChild(grid);

    // Show user name in menubar after login
    Events.on('os:started', () => {
      if (activeUser) {
        const mbName = document.getElementById('mb-app-name');
        if (mbName) mbName.title = `Angemeldet als: ${activeUser.name}`;
        SoundSystem.play('startup');
      }
    });
  }

  return { getProfiles, getActive, buildLoginUI };
})();

/* ═══════════════════════════════════════════════════
   DOCK EXTENSION: Add Task Manager + App Store icons
═══════════════════════════════════════════════════ */
function _injectDockIcons() {
  const dockApps = document.getElementById('dock-apps');
  if (!dockApps) return;

  const sep = dockApps.querySelector('.dock-separator');

  function makeDockItem(app, icon, label, svgContent) {
    if (dockApps.querySelector(`.dock-item[data-app="${app}"]`)) return;
    const item = document.createElement('div');
    item.className = 'dock-item'; item.dataset.app = app; item.title = label;
    item.innerHTML = `<div class="dock-icon"><svg viewBox="0 0 48 48" width="48" height="48">${svgContent}</svg></div><span class="dock-label">${label}</span>`;
    item.addEventListener('click', () => { SoundSystem.play('click'); AppManager.open(app); });
    if (sep) dockApps.insertBefore(item, sep);
    else dockApps.appendChild(item);
  }

  makeDockItem('taskmanager', '📊', 'Task Manager',
    '<rect width="48" height="48" rx="12" fill="#1a1a0a"/><rect x="8" y="14" width="32" height="5" rx="2" fill="#ff9f0a" opacity=".8"/><rect x="8" y="22" width="22" height="5" rx="2" fill="#0a84ff" opacity=".8"/><rect x="8" y="30" width="28" height="5" rx="2" fill="#30d158" opacity=".8"/>');

  makeDockItem('appstore', '🏪', 'App Store',
    '<rect width="48" height="48" rx="12" fill="#0a1a3a"/><circle cx="24" cy="22" r="10" stroke="#0a84ff" stroke-width="2.5" fill="none"/><path d="M18 28 L24 14 L30 28" stroke="#0a84ff" stroke-width="2.5" fill="none" stroke-linejoin="round"/><line x1="19" y1="24" x2="29" y2="24" stroke="#0a84ff" stroke-width="2" stroke-linecap="round"/>');
}

/* ═══════════════════════════════════════════════════
   SETTINGS TAB EXTENSION — Widget & Sound settings
   Patches the existing settings sidebar
═══════════════════════════════════════════════════ */
Events.on('window:open', (id, app) => {
  if (app !== 'settings') return;
  // Give settings a tick to render, then inject new sidebar items
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const win = WindowManager.getWin(id);
      if (!win) return;
      const sidebar = win.el.querySelector('.settings-sidebar');
      const content = win.el.querySelector('.settings-content');
      if (!sidebar || !content) return;
      if (sidebar.querySelector('[data-ext-added]')) return;
      sidebar.setAttribute('data-ext-added', '1');

      const newItems = [
        { icon:'🧩', label:'Widgets',   fn: () => _renderWidgetSettings(content) },
        { icon:'🔊', label:'Sound',     fn: () => _renderSoundSettings(content) },
        { icon:'👤', label:'Benutzer',  fn: () => _renderUserSettings(content) },
        { icon:'⚙️', label:'Entwickler',fn: () => _renderDevSettings(content) },
      ];
      newItems.forEach(ni => {
        const el = document.createElement('div');
        el.className = 'settings-sidebar-item';
        el.innerHTML = `<span class="ss-icon">${ni.icon}</span>${ni.label}`;
        el.addEventListener('click', () => {
          sidebar.querySelectorAll('.settings-sidebar-item').forEach(x => x.classList.remove('active'));
          el.classList.add('active'); ni.fn();
        });
        sidebar.appendChild(el);
      });
    });
  });
});

function _renderWidgetSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Desktop-Widgets';
  content.appendChild(t);

  const WIDGET_TYPES = [
    { type:'clock',   icon:'🕐', label:'Uhr', desc:'Analoguhr auf dem Desktop' },
    { type:'weather', icon:'🌤️', label:'Wetter', desc:'Aktuelle Wetteranzeige' },
    { type:'notes',   icon:'📝', label:'Notizen', desc:'Schnellnotiz-Widget' },
  ];
  WIDGET_TYPES.forEach(wt => {
    const row = document.createElement('div'); row.className = 'settings-row';
    row.innerHTML = `<div class="settings-row-label">${wt.icon} ${wt.label}<div class="settings-row-desc">${wt.desc}</div></div>`;
    const btn = document.createElement('button'); btn.className = 'editor-btn'; btn.textContent = '+ Hinzufügen';
    btn.addEventListener('click', () => { WidgetSystem.addWidget(wt.type); SoundSystem.play('open'); });
    row.appendChild(btn); content.appendChild(row);
  });
}

function _renderSoundSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Sound';
  content.appendChild(t);

  // Toggle
  const toggle = _makeToggleEl(SoundSystem.enabled, val => { SoundSystem.setEnabled(val); if (val) SoundSystem.play('notification'); });
  const row = document.createElement('div'); row.className = 'settings-row';
  row.innerHTML = '<div class="settings-row-label">System-Sounds<div class="settings-row-desc">Klick-, Fenster- und Benachrichtigungs-Töne</div></div>';
  row.appendChild(toggle); content.appendChild(row);

  const t2 = document.createElement('div'); t2.className = 'settings-section-title'; t2.textContent = 'Test';
  content.appendChild(t2);
  const TESTS = ['click','open','close','notification','error','install'];
  const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;padding:8px 0';
  TESTS.forEach(s => {
    const btn = document.createElement('button'); btn.className = 'editor-btn'; btn.textContent = s;
    btn.addEventListener('click', () => SoundSystem.play(s)); btnRow.appendChild(btn);
  });
  content.appendChild(btnRow);
}

function _renderUserSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Benutzerprofile';
  content.appendChild(t);
  const profiles = UserSystem.getProfiles();
  const active   = UserSystem.getActive();
  profiles.forEach(p => {
    const row = document.createElement('div'); row.className = 'settings-row';
    row.innerHTML = `<div class="settings-row-label">${p.avatar} ${p.name}<div class="settings-row-desc">${p.role}${active?.id===p.id?' · Aktuell':''}${p.password===''?' · Kein Passwort':''}</div></div>`;
    content.appendChild(row);
  });
  const t2 = document.createElement('div'); t2.className = 'settings-section-title'; t2.textContent = 'Abmelden';
  content.appendChild(t2);
  const logoutBtn = document.createElement('button'); logoutBtn.className = 'editor-btn'; logoutBtn.textContent = '🚪 Abmelden & Neustart';
  logoutBtn.addEventListener('click', () => { if (confirm('Wirklich abmelden?')) location.reload(); });
  content.appendChild(logoutBtn);
}

function _renderDevSettings(content) {
  content.innerHTML = '';
  const t = document.createElement('div'); t.className = 'settings-section-title'; t.textContent = 'Entwickler';
  content.appendChild(t);
  const devToggle = _makeToggleEl(DevMode.enabled, val => DevMode.toggle());
  const row = document.createElement('div'); row.className = 'settings-row';
  row.innerHTML = '<div class="settings-row-label">Developer Mode<div class="settings-row-desc">Ctrl+Shift+D · Zeigt Event-Logs, Fenster-IDs, JS-Konsole</div></div>';
  row.appendChild(devToggle); content.appendChild(row);

  const openBtn = document.createElement('button'); openBtn.className = 'editor-btn'; openBtn.textContent = '⚙️ Dev Panel öffnen';
  openBtn.addEventListener('click', () => { DevMode.toggle(); if (!DevMode.enabled) DevMode.toggle(); DevMode['openPanel']?.(); });
  content.style.paddingTop = '8px';
  const row2 = document.createElement('div'); row2.style.marginTop = '10px';
  row2.appendChild(openBtn); content.appendChild(row2);
}

function _makeToggleEl(initial, onChange) {
  const toggle = document.createElement('label'); toggle.className = 'toggle';
  const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = initial;
  const track = document.createElement('div'); track.className = 'toggle-track';
  const thumb = document.createElement('div'); thumb.className = 'toggle-thumb';
  toggle.append(inp, track, thumb);
  inp.addEventListener('change', () => onChange(inp.checked));
  return toggle;
}

/* ═══════════════════════════════════════════════════
   QUICK LOOK: Patch Finder to support Spacebar
═══════════════════════════════════════════════════ */
Events.on('window:open', (id, app) => {
  if (app !== 'finder') return;
  requestAnimationFrame(() => {
    const win = WindowManager.getWin(id);
    if (!win) return;
    const filesEl = win.el.querySelector('.finder-files');
    if (!filesEl) return;

    filesEl.addEventListener('keydown', e => {
      if (e.key !== ' ') return;
      e.preventDefault();
      const selected = filesEl.querySelector('.finder-file-item.selected');
      if (!selected) return;
      const fileId = selected.dataset.fileId;
      const node   = FileSystem.getNode(fileId);
      if (node) QuickLook.show(fileId, node);
    }, true);

    filesEl.setAttribute('tabindex', '0');
  });
});

/* ═══════════════════════════════════════════════════
   KEYBOARD: Additional shortcuts
═══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ctrl+Shift+T → Task Manager
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault(); AppManager.open('taskmanager');
  }
  // Ctrl+Shift+A → App Store
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault(); AppManager.open('appstore');
  }
});

/* ═══════════════════════════════════════════════════
   MAIN INIT — hooks into os:started
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  SoundSystem.init();
  QuickLook.init();
  DevMode.init();
  _registerTerminalExtensions();
  _injectDockIcons();

  // Log startup
  DevMode.log('WebOS System Extensions geladen', 'system');
  DevMode.log(`Sound: ${SoundSystem.enabled ? 'an' : 'aus'}`, 'system');

  // Show welcome toast with quick actions
  setTimeout(() => {
    Toast.showInteractive({
      title: '🆕 System-Erweiterungen aktiv',
      icon: '⚡',
      msg: 'Task Manager, App Store, Widgets & mehr.',
      duration: 5000,
      actions: [
        { label: '📊 Tasks',  primary: false, cb: () => AppManager.open('taskmanager') },
        { label: '🏪 Store',  primary: true,  cb: () => AppManager.open('appstore') },
      ]
    });
  }, 1800);
});

/* ═══════════════════════════════════════════════════
   PATCH LOGIN: Replace single-user with multi-user UI
   Called before startOS, so we hook into boot
═══════════════════════════════════════════════════ */
(function patchLogin() {
  const origInitLogin = window.initLogin;
  // We can't directly override initLogin since it's not on window,
  // but we can intercept it by watching for the login screen
  const observer = new MutationObserver(() => {
    const screen = document.getElementById('login-screen');
    if (screen && !screen.dataset.patched) {
      screen.dataset.patched = '1';
      observer.disconnect();
      // Build multi-user UI when the screen becomes visible
      // (boot screen removes itself, then initLogin is called)
      setTimeout(() => UserSystem.buildLoginUI(), 50);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
