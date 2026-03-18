/* =====================================================
   WebOS — game-manager.js
   Game System Extension
   Injects after script.js loads
   ===================================================== */

/* ═══════════════════════════════════════════════════
   GAME REGISTRY
   Defines all known games. To add a new game, just
   push an entry into GAME_REGISTRY or call
   GameManager.registerGame(def).
═══════════════════════════════════════════════════ */
const GAME_REGISTRY = [
  {
    id:       'snake',
    title:    'Snake',
    file:     'games/snake.html',
    icon:     '🐍',
    color:    '#0d2818',
    accent:   '#30d158',
    category: 'Arcade',
    desc:     'Klassisches Schlangenspiel – wachse ohne dich selbst zu treffen!',
  },
  {
    id:       'breakout',
    title:    'Breakout',
    file:     'games/breakout.html',
    icon:     '🧱',
    color:    '#0a0a24',
    accent:   '#0a84ff',
    category: 'Arcade',
    desc:     'Zerstöre alle Blöcke mit dem Ball. Verliere den Ball nicht!',
  },
  {
    id:       'flappy',
    title:    'Flappy Bird',
    file:     'games/flappy.html',
    icon:     '🐦',
    color:    '#1a2a4a',
    accent:   '#f7c536',
    category: 'Arcade',
    desc:     'Fliege durch die Röhren. Nur eine Chance!',
  },
  {
    id:       '2048',
    title:    '2048',
    file:     'games/2048.html',
    icon:     '🔢',
    color:    '#1a1108',
    accent:   '#f59563',
    category: 'Puzzle',
    desc:     'Kombiniere gleiche Zahlen bis zur 2048!',
  },
];

/* ═══════════════════════════════════════════════════
   GAME MANAGER MODULE
═══════════════════════════════════════════════════ */
const GameManager = (() => {
  const games    = new Map(); // id -> gameDef
  const sessions = new Map(); // windowId -> gameDef  (active game windows)

  // Stats stored in localStorage per game
  function getStats(gameId) {
    try { return JSON.parse(localStorage.getItem('game_stats_' + gameId) || '{}'); }
    catch { return {}; }
  }
  function setStats(gameId, data) {
    localStorage.setItem('game_stats_' + gameId, JSON.stringify(data));
  }
  function recordPlay(gameId) {
    const s = getStats(gameId);
    s.plays = (s.plays || 0) + 1;
    s.lastPlayed = new Date().toLocaleDateString('de-DE');
    setStats(gameId, s);
  }

  /* ── Public API ─────────────────────────────── */
  function registerGame(def) {
    games.set(def.id, def);
    // Also add to virtual filesystem under /Games
    _addToFilesystem(def);
  }

  function launchGame(gameId, opts = {}) {
    const def = games.get(gameId);
    if (!def) { Toast.show(`Spiel "${gameId}" nicht gefunden`, '⚠️'); return; }

    const wid = 'game_' + gameId + '_' + Date.now();
    recordPlay(gameId);
    _openGameWindow(wid, def, opts);
  }

  function getAllGames()    { return [...games.values()]; }
  function getGame(id)     { return games.get(id); }
  function getByCategory() {
    const cats = {};
    games.forEach(g => {
      if (!cats[g.category]) cats[g.category] = [];
      cats[g.category].push(g);
    });
    return cats;
  }
  function getRecentlyPlayed(n = 4) {
    return [...games.values()]
      .filter(g => getStats(g.id).lastPlayed)
      .sort((a, b) => {
        const sa = getStats(a.id), sb = getStats(b.id);
        return new Date(sb.lastPlayed) - new Date(sa.lastPlayed);
      })
      .slice(0, n);
  }

  /* ── Internal: open game window ─────────────── */
  function _openGameWindow(wid, def, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'game-window-wrap';

    // Loading overlay
    const loadOverlay = document.createElement('div');
    loadOverlay.className = 'game-load-overlay';
    loadOverlay.innerHTML = `
      <div class="game-load-icon">${def.icon}</div>
      <div class="game-load-title">${def.title}</div>
      <div class="game-load-spinner"><div class="game-spinner-ring"></div></div>
    `;
    wrap.appendChild(loadOverlay);

    // Game toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'game-toolbar';
    toolbar.innerHTML = `
      <span class="game-tb-icon">${def.icon}</span>
      <span class="game-tb-title">${def.title}</span>
      <span class="game-tb-cat">${def.category}</span>
      <div class="game-tb-spacer"></div>
      <button class="game-tb-btn" id="gtb-fullscreen-${wid}" title="Vollbild">⛶</button>
      <button class="game-tb-btn" id="gtb-restart-${wid}"    title="Neu starten">↺</button>
    `;
    wrap.appendChild(toolbar);

    // iframe container
    const iframeWrap = document.createElement('div');
    iframeWrap.className = 'game-iframe-wrap';

    const iframe = document.createElement('iframe');
    iframe.className  = 'game-iframe';
    iframe.src        = def.file;
    iframe.allow      = 'autoplay';
    iframe.sandbox    = 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals';
    iframe.title      = def.title;

    // Fade in when loaded
    iframe.addEventListener('load', () => {
      setTimeout(() => {
        loadOverlay.style.opacity = '0';
        setTimeout(() => loadOverlay.remove(), 350);
      }, 400);
    });

    iframeWrap.appendChild(iframe);
    wrap.appendChild(iframeWrap);

    // Wire toolbar buttons
    toolbar.querySelector(`#gtb-fullscreen-${wid}`).addEventListener('click', () => {
      const el = iframeWrap;
      if (document.fullscreenElement) document.exitFullscreen();
      else el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
    });
    toolbar.querySelector(`#gtb-restart-${wid}`).addEventListener('click', () => {
      iframe.src = iframe.src; // reload
      Toast.show(`${def.title} wird neu gestartet`, def.icon);
    });

    // Focus/blur iframe to pause/resume (performance)
    const winEl = WindowManager.create({
      id:     wid,
      title:  `${def.icon} ${def.title}`,
      app:    'game',
      width:  opts.width  || 720,
      height: opts.height || 560,
      content: wrap,
      meta:   { gameId: def.id }
    });

    sessions.set(wid, def);
    DockManager.setRunning('games', true);
    return winEl;
  }

  /* ── Internal: filesystem integration ────────── */
  function _addToFilesystem(def) {
    const fs = State.get().filesystem;
    // Ensure /Games folder exists
    if (!fs['/Games']) {
      fs['/Games'] = { type: 'folder', name: 'Games', children: [], parent: '/', icon: '🎮' };
      if (fs['/'] && fs['/'].children && !fs['/'].children.includes('/Games')) {
        fs['/'].children.push('/Games');
      }
    }
    // Add game file entry if not present
    const fileId = 'game_file_' + def.id;
    if (!fs[fileId]) {
      fs[fileId] = {
        type:    'file',
        name:    def.title + '.game',
        ext:     'game',
        content: def.id,
        parent:  '/Games',
        icon:    def.icon,
        gameDef: def,
      };
      if (!fs['/Games'].children.includes(fileId)) {
        fs['/Games'].children.push(fileId);
      }
    }
    State.save();
  }

  /* ── Drag & Drop: HTML file onto desktop ──────── */
  function initDropZone() {
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', async e => {
      e.preventDefault();
      const files = [...e.dataTransfer.files];
      const htmlFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
      if (!htmlFiles.length) return;

      for (const file of htmlFiles) {
        const text = await file.text();
        const gameId  = 'dropped_' + file.name.replace(/[^a-z0-9]/gi, '_');
        const title   = file.name.replace(/\.(html?)/i, '');
        const def = {
          id:       gameId,
          title,
          file:     null,   // use blob URL
          _blob:    URL.createObjectURL(new Blob([text], { type: 'text/html' })),
          icon:     '🎮',
          color:    '#1a1a2e',
          accent:   '#0a84ff',
          category: 'Eigene Spiele',
          desc:     `Importiert: ${file.name}`,
        };
        def.file = def._blob;
        registerGame(def);
        Toast.showInteractive({
          title: `"${title}" importiert!`,
          icon:  '🎮',
          msg:   'Spiel im Game Center verfügbar.',
          actions: [{ label: 'Jetzt spielen', primary: true, cb: () => launchGame(gameId) }]
        });
      }
    });
  }

  /* ── Init ───────────────────────────────────── */
  function init() {
    GAME_REGISTRY.forEach(def => registerGame(def));
    _injectFinderSupport();
    initDropZone();
    // Add dock icon
    _addDockIcon();
  }

  /* ── Extend Finder to open .game files ────────── */
  function _injectFinderSupport() {
    // Patch FileSystem's iconForExt to recognize .game
    const origIcon = FileSystem.iconForExt;
    // Override openFileSystemNode in AppManager to handle .game extension
    const origFinderOpen = AppManager.open.bind(AppManager);
    // We patch the global openNode function inside finder by patching FileSystem
    const fs = State.get().filesystem;
    // Monkey-patch: intercept .game files when opened via finder
    Events.on('fs:open', (id, node) => {
      if (node?.ext === 'game' || node?.gameDef) {
        launchGame(node.content || node.gameDef?.id);
      }
    });
  }

  /* ── Add Games dock icon ──────────────────────── */
  function _addDockIcon() {
    // Check if already present
    if (document.querySelector('.dock-item[data-app="games"]')) return;

    const dockApps = document.getElementById('dock-apps');
    const sep1     = dockApps.querySelector('.dock-separator');

    const item = document.createElement('div');
    item.className   = 'dock-item';
    item.dataset.app = 'games';
    item.title       = 'Spiele';
    item.innerHTML = `
      <div class="dock-icon">
        <svg viewBox="0 0 48 48" width="48" height="48">
          <rect width="48" height="48" rx="12" fill="#2c1654"/>
          <rect x="7" y="16" width="34" height="22" rx="5" fill="#4a2a80"/>
          <circle cx="17" cy="27" r="4" fill="#bf5af2" opacity=".9"/>
          <rect x="28" y="23" width="8" height="2.5" rx="1.25" fill="white" opacity=".85"/>
          <rect x="31.25" y="20" width="2.5" height="8" rx="1.25" fill="white" opacity=".85"/>
          <rect x="7" y="20" width="12" height="3" rx="1.5" fill="#5e4090" opacity=".7"/>
        </svg>
      </div>
      <span class="dock-label">Spiele</span>`;

    item.addEventListener('click', () => AppManager.open('games'));

    // Insert before first separator
    if (sep1) dockApps.insertBefore(item, sep1);
    else dockApps.appendChild(item);
  }

  return { init, registerGame, launchGame, getAllGames, getGame, getByCategory, getRecentlyPlayed, getStats };
})();

/* ═══════════════════════════════════════════════════
   APP: GAME CENTER (Launcher)
═══════════════════════════════════════════════════ */
AppManager.register('games', { open: opts => _openGameCenter(opts) });

function _openGameCenter(opts = {}) {
  const wid = 'game_center';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div');
  wrap.className = 'game-center-wrap';

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'game-center-sidebar';
  sidebar.innerHTML = `
    <div class="gc-sidebar-logo">
      <span class="gc-sidebar-logo-icon">🎮</span>
      <span>Game Center</span>
    </div>`;

  const SECTIONS = [
    { id: 'all',    icon: '🕹️', label: 'Alle Spiele' },
    { id: 'recent', icon: '🕐', label: 'Zuletzt gespielt' },
    { id: 'arcade', icon: '👾', label: 'Arcade' },
    { id: 'puzzle', icon: '🧩', label: 'Puzzle' },
    { id: 'own',    icon: '📂', label: 'Eigene Spiele' },
  ];
  let currentSection = 'all';
  const sidebarItems = [];

  SECTIONS.forEach(s => {
    const item = document.createElement('div');
    item.className = 'gc-sidebar-item' + (s.id === 'all' ? ' active' : '');
    item.innerHTML = `<span class="gc-sidebar-item-icon">${s.icon}</span>${s.label}`;
    item.addEventListener('click', () => {
      sidebarItems.forEach(x => x.classList.remove('active'));
      item.classList.add('active');
      currentSection = s.id;
      renderGames();
    });
    sidebar.appendChild(item);
    sidebarItems.push(item);
  });

  // Drop zone hint
  const dropHint = document.createElement('div');
  dropHint.className = 'gc-drop-hint';
  dropHint.innerHTML = `<span>📥</span> HTML-Datei hierher ziehen um Spiel zu importieren`;
  sidebar.appendChild(dropHint);

  // Main area
  const main = document.createElement('div');
  main.className = 'game-center-main';

  // Search
  const searchRow = document.createElement('div');
  searchRow.className = 'gc-search-row';
  const searchInput = document.createElement('input');
  searchInput.className = 'gc-search'; searchInput.placeholder = '🔍 Spiel suchen…';
  searchInput.addEventListener('input', () => renderGames());
  searchRow.appendChild(searchInput);
  main.appendChild(searchRow);

  // Games grid
  const grid = document.createElement('div');
  grid.className = 'gc-grid';
  main.appendChild(grid);

  function renderGames() {
    grid.innerHTML = '';
    let gameList = GameManager.getAllGames();
    const term = searchInput.value.toLowerCase();

    if (currentSection === 'recent') {
      gameList = GameManager.getRecentlyPlayed(8);
    } else if (currentSection === 'arcade') {
      gameList = gameList.filter(g => g.category === 'Arcade');
    } else if (currentSection === 'puzzle') {
      gameList = gameList.filter(g => g.category === 'Puzzle');
    } else if (currentSection === 'own') {
      gameList = gameList.filter(g => g.category === 'Eigene Spiele');
    }

    if (term) gameList = gameList.filter(g => g.title.toLowerCase().includes(term) || (g.desc||'').toLowerCase().includes(term));

    if (gameList.length === 0) {
      grid.innerHTML = `<div class="gc-empty">
        <div style="font-size:48px;margin-bottom:12px">${currentSection==='own'?'📂':'🎮'}</div>
        <p>${currentSection==='recent'?'Noch keine Spiele gespielt':currentSection==='own'?'Ziehe HTML-Dateien hierher':'Keine Spiele gefunden'}</p>
      </div>`;
      return;
    }

    gameList.forEach(def => {
      const card = document.createElement('div');
      card.className = 'gc-card';
      const stats = GameManager.getStats(def.id);

      card.innerHTML = `
        <div class="gc-card-cover" style="background:${def.color||'#1a1a2e'}">
          <span class="gc-card-icon">${def.icon}</span>
          <div class="gc-card-cat" style="color:${def.accent||'#0a84ff'}">${def.category}</div>
        </div>
        <div class="gc-card-info">
          <div class="gc-card-title">${def.title}</div>
          <div class="gc-card-desc">${def.desc || ''}</div>
          ${stats.plays ? `<div class="gc-card-plays">${stats.plays}× gespielt${stats.lastPlayed?' · '+stats.lastPlayed:''}</div>` : ''}
        </div>
        <button class="gc-card-play" style="background:${def.accent||'#0a84ff'}">▶ Spielen</button>`;

      card.querySelector('.gc-card-play').addEventListener('click', e => {
        e.stopPropagation();
        GameManager.launchGame(def.id);
      });
      card.addEventListener('dblclick', () => GameManager.launchGame(def.id));

      grid.appendChild(card);
    });
  }

  wrap.appendChild(sidebar);
  wrap.appendChild(main);
  renderGames();

  // Listen for newly registered games
  Events.on('game:registered', () => renderGames());

  WindowManager.create({
    id:     wid,
    title:  '🎮 Game Center',
    app:    'games',
    width:  820,
    height: 560,
    content: wrap,
  });
}

/* ═══════════════════════════════════════════════════
   PATCH: FileSystem openNode to support .game
   (Extends the _openFinder function's openNode logic)
═══════════════════════════════════════════════════ */
(function patchFinderForGames() {
  // We need to patch the openFileSystemNode that Finder uses.
  // Since Finder's openNode is a closure, we intercept via Events.
  // The Finder dispatches openNode calls internally.
  // Instead we override AppManager to handle 'game' app:
  AppManager.register('game', {
    open: opts => {
      if (opts.gameId) GameManager.launchGame(opts.gameId);
      else if (opts.node?.content) GameManager.launchGame(opts.node.content);
    }
  });
})();

/* ═══════════════════════════════════════════════════
   PATCH: Terminal — add game commands
═══════════════════════════════════════════════════ */
(function patchTerminalForGames() {
  // We hook into the terminal's command execution via a global override.
  // The terminal runs commands from the COMMANDS object closure.
  // We extend it by patching the global runCommand mechanism.
  // Since COMMANDS is a closure, we register a global fallback handler.
  window.__gameCommands = {
    games: (args) => {
      if (!args[0]) {
        const list = GameManager.getAllGames();
        return ['Verfügbare Spiele:', ...list.map(g => `  ${g.icon} ${g.id.padEnd(12)} ${g.title}`), '', 'Starte mit: games play <id>'];
      }
      if (args[0] === 'play' && args[1]) {
        const g = GameManager.getGame(args[1]);
        if (g) { GameManager.launchGame(args[1]); return [`${g.icon} Starte ${g.title}…`]; }
        return ['Spiel nicht gefunden: ' + args[1]];
      }
      return ['Verwendung: games  oder  games play <id>'];
    }
  };
})();

/* ═══════════════════════════════════════════════════
   AUTO-INIT — hooks into os:started event from script.js
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  // 1. Register all bundled games & init filesystem / dock
  GameManager.init();

  // 2. Add 🎮 desktop icon to first desktop if not already there
  const state = State.get();
  const desk0 = state.desktops[0];
  if (desk0 && !desk0.icons.some(i => i.id === 'di-games')) {
    desk0.icons.push({
      id:    'di-games',
      app:   'games',
      label: 'Spiele',
      x:     20,
      y:     560,
      icon:  '🎮'
    });
    State.save();
    // Re-render first desktop icons so the icon appears
    DesktopIcons.initSlide(0);
  }

  // 3. Patch terminal: add 'games' command support
  // The terminal's COMMANDS object is a closure inside _openTerminal,
  // so we expose a global hook it checks as fallback.
  window.__terminalPlugins = window.__terminalPlugins || {};
  window.__terminalPlugins['games'] = (args, print) => {
    if (!args[0]) {
      print('Verfügbare Spiele:', 't-info');
      GameManager.getAllGames().forEach(g =>
        print(`  ${g.icon}  ${g.id.padEnd(14)} ${g.title}  [${g.category}]`)
      );
      print('');
      print('  games play <id>   →  Spiel starten', 't-out');
      return true;
    }
    if (args[0] === 'play') {
      const g = GameManager.getGame(args[1]);
      if (!g) { print('Spiel nicht gefunden: ' + (args[1]||''), 't-err'); return true; }
      GameManager.launchGame(g.id);
      print(`${g.icon} Starte "${g.title}"…`, 't-info');
      return true;
    }
    return false; // not handled
  };
});

