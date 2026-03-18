/* =====================================================
   WebOS 2.0 — script.js
   Modular Virtual Desktop Environment
   ===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   MODULE: CONFIG
   Global configuration & constants
═══════════════════════════════════════════════════ */
const Config = {
  LOGIN_PASSWORD: 'webos',
  STORAGE_KEY:   'webos_state_v4',
  MAX_DESKTOPS:  5,
  WALLPAPER_COUNT: 7,
  WALLPAPER_CLASSES: ['wp-0','wp-1','wp-2','wp-3','wp-4','wp-5','wp-6'],
  WALLPAPER_NAMES:   ['Nebula','Aurora','Sunset','Golden','Violet','Midnight','Dark Gold'],
  ACCENT_COLORS: [
    { name:'Blau',    val:'#0a84ff' },
    { name:'Grün',    val:'#30d158' },
    { name:'Orange',  val:'#ff9f0a' },
    { name:'Pink',    val:'#ff2d55' },
    { name:'Lila',    val:'#bf5af2' },
    { name:'Cyan',    val:'#5ac8fa' },
    { name:'Rot',     val:'#ff453a' },
  ],
};

/* ═══════════════════════════════════════════════════
   MODULE: STATE
═══════════════════════════════════════════════════ */
const State = (() => {
  const KEY = Config.STORAGE_KEY;

  const defaults = () => ({
    wallpaper: 0,
    accentColor: '#0a84ff',
    lightMode: false,
    animSpeed: 1,
    activeDesktop: 0,
    desktops: [
      {
        id: 'desk-0', wallpaper: 0,
        icons: [
          { id:'di-finder',  app:'finder',      label:'Finder',       x:20, y:20,  icon:'📁' },
          { id:'di-docs',    app:'finder',      label:'Dokumente',    x:20, y:130, icon:'📂', path:'/Dokumente' },
          { id:'di-note1',   app:'editor',      label:'Notizen.txt',  x:20, y:240, icon:'📝', fileId:'note1' },
          { id:'di-photo',   app:'imageviewer', label:'Landschaft.jpg',x:20,y:350, icon:'🖼️', fileId:'photo1' },
          { id:'di-browser', app:'browser',     label:'Browser',      x:20, y:460, icon:'🌐' },
        ]
      }
    ],
    filesystem: {
      '/': { type:'folder', name:'/', children:['/Dokumente','/Bilder','/Downloads','/Desktop','/Musik'] },
      '/Dokumente': { type:'folder', name:'Dokumente', children:['note1','readme','code1'] },
      '/Bilder':    { type:'folder', name:'Bilder',    children:['photo1','photo2'] },
      '/Downloads': { type:'folder', name:'Downloads', children:[] },
      '/Desktop':   { type:'folder', name:'Desktop',   children:[] },
      '/Musik':     { type:'folder', name:'Musik',     children:[] },
      'note1': {
        type:'file', name:'Notizen.txt', ext:'txt',
        content:'Willkommen bei WebOS 2.0!\n\nNeue Features:\n• Multi-Desktop (Ctrl+→ / Ctrl+←)\n• Terminal (cmd: help)\n• Rechner & Musik-Player\n• Fenster-Snap (an Rand ziehen)\n• Tastaturkürzel:\n  Cmd+W → Fenster schließen\n  Cmd+Tab → App wechseln\n  Ctrl+Space → Desktop-Übersicht\n\n– WebOS Team',
        parent:'/Dokumente', icon:'📝'
      },
      'readme': {
        type:'file', name:'LiesMich.txt', ext:'txt',
        content:'WebOS 2.0 — Hilfe\n\nTastaturkürzel:\n  Cmd+W       Fenster schließen\n  Cmd+Tab     Nächste App\n  Ctrl+Space  Desktop-Übersicht\n  Ctrl+→/←    Desktop wechseln\n  F11         Vollbild (im Browser)\n\nTerminal-Befehle:\n  help, ls, cd, pwd, mkdir, touch, rm, cat, echo, clear, date, whoami',
        parent:'/Dokumente', icon:'📄'
      },
      'code1': {
        type:'file', name:'hello.js', ext:'js',
        content:'// WebOS Script\nconsole.log("Hello from WebOS!");\n\nconst greet = (name) => {\n  return `Hallo, ${name}!`;\n};\n\ngreet("Welt");',
        parent:'/Dokumente', icon:'💻'
      },
      'photo1': { type:'file', name:'Landschaft.jpg', ext:'jpg', content:'https://picsum.photos/seed/landscape/800/600', parent:'/Bilder', icon:'🖼️' },
      'photo2': { type:'file', name:'Stadtansicht.png', ext:'png', content:'https://picsum.photos/seed/city/800/600',    parent:'/Bilder', icon:'🖼️' },
    },
    trash: [],
    notes: {},
  });

  let data = defaults();

  function load() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) {
        const p = JSON.parse(saved);
        data = Object.assign(defaults(), p);
        // Deep-merge filesystem
        data.filesystem = Object.assign(defaults().filesystem, p.filesystem || {});
        data.trash  = p.trash  || [];
        data.notes  = p.notes  || {};
        data.desktops = p.desktops || defaults().desktops;
      }
    } catch(e) { console.warn('State load error', e); }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch(e) { console.warn('State save error', e); }
  }

  function get()               { return data; }
  function set(key, val)       { data[key] = val; save(); }
  function getDesktop(idx)     { return data.desktops[idx]; }
  function getActiveDesktop()  { return data.desktops[data.activeDesktop]; }

  return { load, save, get, set, getDesktop, getActiveDesktop };
})();

/* ═══════════════════════════════════════════════════
   MODULE: EVENTS (pub/sub mini bus)
═══════════════════════════════════════════════════ */
const Events = (() => {
  const map = {};
  function on(ev, fn)  { (map[ev] = map[ev]||[]).push(fn); }
  function off(ev, fn) { map[ev] = (map[ev]||[]).filter(f => f !== fn); }
  function emit(ev, ...args) { (map[ev]||[]).forEach(fn => fn(...args)); }
  return { on, off, emit };
})();

/* ═══════════════════════════════════════════════════
   MODULE: THEME
═══════════════════════════════════════════════════ */
const Theme = (() => {
  function applyAccent(color) {
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-soft', color + '40');
    State.set('accentColor', color);
  }
  function applyLightMode(on) {
    document.body.classList.toggle('light-mode', on);
    State.set('lightMode', on);
  }
  function applyAnimSpeed(val) {
    document.documentElement.style.setProperty('--anim-speed', val);
    State.set('animSpeed', val);
  }
  function init() {
    const s = State.get();
    applyAccent(s.accentColor || '#0a84ff');
    applyLightMode(s.lightMode || false);
    applyAnimSpeed(s.animSpeed ?? 1);
  }
  return { init, applyAccent, applyLightMode, applyAnimSpeed };
})();

/* ═══════════════════════════════════════════════════
   MODULE: FILESYSTEM
═══════════════════════════════════════════════════ */
const FileSystem = (() => {
  function get()               { return State.get().filesystem; }
  function getNode(id)         { return get()[id]; }

  function getFolderChildren(folderId) {
    const node = getNode(folderId);
    if (!node || node.type !== 'folder') return [];
    return (node.children || []).map(cid => {
      const child = getNode(cid);
      return child ? { id: cid, ...child } : null;
    }).filter(Boolean);
  }

  function resolvePath(path) {
    // Try direct key first, then as a folder key
    const fs = get();
    if (fs[path]) return fs[path];
    return null;
  }

  function createFile(parentId, name, ext, content = '') {
    const fs = get();
    const id  = 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    const icon = iconForExt(ext);
    fs[id] = { type:'file', name, ext:(ext||'').toLowerCase(), content, parent:parentId, icon };
    if (fs[parentId]?.children && !fs[parentId].children.includes(id))
      fs[parentId].children.push(id);
    State.save();
    Events.emit('fs:change', parentId);
    return id;
  }

  function createFolder(parentId, name) {
    const fs = get();
    const id  = 'folder_' + Date.now();
    fs[id] = { type:'folder', name, children:[], parent:parentId, icon:'📁' };
    if (fs[parentId]?.children && !fs[parentId].children.includes(id))
      fs[parentId].children.push(id);
    State.save();
    Events.emit('fs:change', parentId);
    return id;
  }

  function deleteNode(id) {
    const fs = get();
    const node = fs[id];
    if (!node) return;
    const trash = State.get().trash;
    trash.push({ id, node: JSON.parse(JSON.stringify(node)), deletedAt: new Date().toLocaleString('de-DE') });
    State.set('trash', trash);
    const parent = node.parent ? fs[node.parent] : null;
    if (parent?.children) parent.children = parent.children.filter(c => c !== id);
    delete fs[id];
    State.save();
    Events.emit('fs:change', node.parent);
  }

  function rename(id, newName) {
    const fs = get();
    if (fs[id]) { fs[id].name = newName; State.save(); Events.emit('fs:change', fs[id].parent); }
  }

  function moveNode(id, newParentId) {
    const fs = get();
    const node = fs[id];
    if (!node || !fs[newParentId] || fs[newParentId].type !== 'folder') return false;
    const oldParent = node.parent ? fs[node.parent] : null;
    if (oldParent?.children) oldParent.children = oldParent.children.filter(c => c !== id);
    node.parent = newParentId;
    if (!fs[newParentId].children) fs[newParentId].children = [];
    if (!fs[newParentId].children.includes(id)) fs[newParentId].children.push(id);
    State.save();
    Events.emit('fs:change', newParentId);
    return true;
  }

  function updateContent(id, content) {
    const fs = get();
    if (fs[id]) { fs[id].content = content; State.save(); }
  }

  function restoreFromTrash(id) {
    const trash = State.get().trash;
    const idx   = trash.findIndex(t => t.id === id);
    if (idx < 0) return;
    const { node } = trash[idx];
    const fs = get();
    fs[id] = node;
    const parent = node.parent ? fs[node.parent] : null;
    if (parent?.children && !parent.children.includes(id)) parent.children.push(id);
    trash.splice(idx, 1);
    State.set('trash', trash);
    Events.emit('fs:change', node.parent);
  }

  function emptyTrash() { State.set('trash', []); }

  function iconForExt(ext) {
    const map = {
      txt:'📝', md:'📄', js:'💻', ts:'💻', html:'🌐', css:'🎨',
      json:'⚙️', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️',
      webp:'🖼️', mp3:'🎵', wav:'🎵', ogg:'🎵', pdf:'📕',
      zip:'🗜️', py:'🐍',
    };
    return map[(ext||'').toLowerCase()] || '📄';
  }

  // Build full path string for a file id
  function getPathString(id) {
    const fs = get();
    const node = fs[id];
    if (!node) return id;
    const parts = [node.name];
    let cur = node.parent;
    while (cur && fs[cur]) {
      parts.unshift(fs[cur].name === '/' ? '' : fs[cur].name);
      cur = fs[cur].parent;
    }
    return '/' + parts.filter(Boolean).join('/');
  }

  return { get, getNode, getFolderChildren, createFile, createFolder, deleteNode,
           rename, moveNode, updateContent, restoreFromTrash, emptyTrash, iconForExt, getPathString };
})();

/* ═══════════════════════════════════════════════════
   MODULE: TOAST / NOTIFICATION SYSTEM
═══════════════════════════════════════════════════ */
const Toast = (() => {
  let container;

  function init() {
    container = document.getElementById('toast-container');
  }

  function show(msg, icon = '✅', duration = 2600) {
    _render({ title: msg, icon, duration });
  }

  function showInteractive(opts) {
    // opts: { title, msg, icon, actions:[{label,primary,cb}], duration }
    _render(opts);
  }

  function _render(opts) {
    const { title, msg, icon='ℹ️', actions=[], duration=2600 } = opts;
    const t = document.createElement('div');
    t.className = 'toast';
    let html = `<div class="toast-header"><span class="toast-icon">${icon}</span><span class="toast-title">${title}</span></div>`;
    if (msg) html += `<div class="toast-msg">${msg}</div>`;
    if (actions.length) {
      html += `<div class="toast-actions">`;
      actions.forEach((a,i) => {
        html += `<button class="toast-action-btn${a.primary?' primary':''}" data-idx="${i}">${a.label}</button>`;
      });
      html += `</div>`;
    }
    t.innerHTML = html;
    container.appendChild(t);

    // Wire action buttons
    t.querySelectorAll('.toast-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.idx;
        actions[idx]?.cb?.();
        dismiss(t);
      });
    });

    let timer = setTimeout(() => dismiss(t), duration);
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', () => { timer = setTimeout(() => dismiss(t), 1200); });
  }

  function dismiss(t) {
    t.classList.add('hiding');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }

  return { init, show, showInteractive };
})();

/* ═══════════════════════════════════════════════════
   MODULE: CONTEXT MENU
═══════════════════════════════════════════════════ */
const ContextMenu = (() => {
  let el, list;
  function init() {
    el   = document.getElementById('context-menu');
    list = document.getElementById('context-menu-list');
    document.addEventListener('click', hide);
    document.addEventListener('contextmenu', () => {});
    document.addEventListener('keydown', e => { if (e.key==='Escape') hide(); });
  }
  function show(e, items) {
    hide();
    list.innerHTML = '';
    items.forEach(item => {
      const li = document.createElement('li');
      if (item.separator) { li.className='separator'; }
      else {
        if (item.disabled) li.classList.add('disabled');
        li.innerHTML = `<span class="ctx-icon">${item.icon||''}</span>${item.label}`;
        if (!item.disabled) li.addEventListener('click', ev => { ev.stopPropagation(); hide(); item.action?.(); });
      }
      list.appendChild(li);
    });
    el.classList.remove('hidden');
    // Position
    const vw = window.innerWidth, vh = window.innerHeight;
    let px = e.clientX, py = e.clientY;
    const mw = 200, mh = Math.min(items.length * 33 + 20, 400);
    el.style.left = Math.min(px, vw - mw - 10) + 'px';
    el.style.top  = Math.min(py, vh - mh - 10) + 'px';
  }
  function hide() { el?.classList.add('hidden'); }
  return { init, show, hide };
})();

/* ═══════════════════════════════════════════════════
   MODULE: PERMISSION SYSTEM
═══════════════════════════════════════════════════ */
const Permissions = (() => {
  let dialog, titleEl, msgEl, allowBtn, denyBtn;
  function init() {
    dialog  = document.getElementById('permission-dialog');
    titleEl = document.getElementById('perm-title');
    msgEl   = document.getElementById('perm-msg');
    allowBtn = document.getElementById('perm-allow');
    denyBtn  = document.getElementById('perm-deny');
  }
  function request(appName, resource) {
    return new Promise(resolve => {
      titleEl.textContent = `${appName} möchte Zugriff`;
      msgEl.textContent   = `Diese App möchte auf "${resource}" zugreifen. Erlauben?`;
      dialog.classList.remove('hidden');
      const cleanup = () => dialog.classList.add('hidden');
      allowBtn.onclick = () => { cleanup(); resolve(true);  };
      denyBtn.onclick  = () => { cleanup(); resolve(false); };
    });
  }
  return { init, request };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SNAP INDICATOR
═══════════════════════════════════════════════════ */
const SnapManager = (() => {
  let indicator;
  function init() {
    indicator = document.createElement('div');
    indicator.id = 'snap-indicator';
    document.body.appendChild(indicator);
  }
  function showLeft() {
    const top    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--menubar-h')) || 28;
    const bottom = 110;
    indicator.style.cssText = `display:block;left:0;top:${top}px;width:50%;bottom:${bottom}px;right:auto;`;
  }
  function showRight() {
    const top    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--menubar-h')) || 28;
    const bottom = 110;
    indicator.style.cssText = `display:block;right:0;top:${top}px;width:50%;bottom:${bottom}px;left:auto;`;
  }
  function hide() { indicator.style.display = 'none'; }
  return { init, showLeft, showRight, hide };
})();

/* ═══════════════════════════════════════════════════
   MODULE: WINDOW MANAGER
═══════════════════════════════════════════════════ */
const WindowManager = (() => {
  let zCounter  = 200;
  const wins    = new Map(); // wid -> { el, app, title, meta, minimized, maximized, prevBounds, desktopIdx }
  const SNAP_THRESHOLD = 24; // px from edge to trigger snap

  function nextZ() { return ++zCounter; }

  function create({ id, title, app, width=700, height=500, x, y, content, meta={} }) {
    // Bring to front if already exists
    if (wins.has(id)) { focus(id); return wins.get(id).el; }

    // Show skeleton then real content after short delay
    const el = document.createElement('div');
    el.className = 'window';
    el.dataset.windowId = id;

    // Position
    const mh = 28, dock = 110;
    const maxX = window.innerWidth - width, maxY = window.innerHeight - height - dock;
    const cx = Math.max(0, Math.min(maxX, (window.innerWidth-width)/2 + (Math.random()*80-40)));
    const cy = Math.max(mh, Math.min(maxY, (window.innerHeight-height)/2 + (Math.random()*60-30)));
    el.style.cssText = `width:${width}px;height:${height}px;left:${x??cx}px;top:${y??cy}px;z-index:${nextZ()}`;

    // Titlebar
    const tb = document.createElement('div');
    tb.className = 'window-titlebar';
    tb.innerHTML = `
      <div class="window-controls">
        <div class="wc wc-close" title="Schließen (Cmd+W)"></div>
        <div class="wc wc-min"   title="Minimieren"></div>
        <div class="wc wc-max"   title="Maximieren"></div>
      </div>
      <div class="window-title">${title}</div>`;
    el.appendChild(tb);

    // Skeleton loader first
    const skel = document.createElement('div');
    skel.className = 'skeleton-loader';
    for (let i=0; i<5; i++) {
      const line = document.createElement('div');
      line.className = 'skel-line';
      line.style.width = (40 + Math.random()*55) + '%';
      skel.appendChild(line);
    }
    el.appendChild(skel);

    // Resize handle
    const rh = document.createElement('div');
    rh.className = 'window-resize';
    el.appendChild(rh);

    // Wire controls
    tb.querySelector('.wc-close').addEventListener('click', e => { e.stopPropagation(); close(id); });
    tb.querySelector('.wc-min'  ).addEventListener('click', e => { e.stopPropagation(); minimize(id); });
    tb.querySelector('.wc-max'  ).addEventListener('click', e => { e.stopPropagation(); toggleMaximize(id); });
    tb.addEventListener('dblclick', () => toggleMaximize(id));

    // Drag
    _makeDraggable(el, tb, id);
    // Resize
    _makeResizable(el, rh);
    // Focus on click
    el.addEventListener('mousedown', () => focus(id), true);

    // Attach to active desktop's window layer
    const activeSlide = document.querySelector('.desktop-slide.active .desktop-windows-layer');
    if (activeSlide) activeSlide.appendChild(el);
    else document.getElementById('desktops-container').appendChild(el);

    const desktopIdx = State.get().activeDesktop;
    wins.set(id, { el, app, title, meta, minimized:false, maximized:false, snapped:null, prevBounds:null, desktopIdx });

    // Replace skeleton with real content after 1 frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skel.remove();
        const contentEl = document.createElement('div');
        contentEl.className = 'window-content';
        if (typeof content === 'string')         contentEl.innerHTML = content;
        else if (content instanceof HTMLElement)  contentEl.appendChild(content);
        el.insertBefore(contentEl, rh);
      });
    });

    DockManager.setRunning(app, true);
    _updateInactive(id);
    Events.emit('window:open', id, app);
    return el;
  }

  function focus(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    if (w.minimized) restore(id);
    w.el.style.zIndex = nextZ();
    _updateInactive(id);
    document.getElementById('mb-app-name').textContent = w.title.replace(/^[^\s]+\s/, '');
    Events.emit('window:focus', id, w.app);
  }

  function _updateInactive(activeId) {
    wins.forEach((w, wid) => {
      w.el.classList.toggle('inactive', wid !== activeId);
    });
  }

  function close(id) {
    if (!wins.has(id)) return;
    const { el, app, meta } = wins.get(id);
    if (app === 'editor' && meta.saveOnClose) meta.saveOnClose();
    el.style.animation = `win-close calc(0.22s * var(--anim-speed, 1)) cubic-bezier(0.4,0,1,1) both`;
    el.addEventListener('animationend', () => {
      el.remove();
      wins.delete(id);
      let stillOpen = false;
      wins.forEach(w => { if (w.app === app) stillOpen = true; });
      DockManager.setRunning(app, stillOpen);
      _updateInactive(null);
      Events.emit('window:close', id, app);
    }, { once: true });
  }

  function minimize(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    if (w.minimized) return restore(id);
    w.minimized = true;
    w.el.style.animation = `win-minimize calc(0.25s * var(--anim-speed, 1)) cubic-bezier(0.4,0,1,1) both`;
    w.el.addEventListener('animationend', () => {
      w.el.style.display = 'none';
      w.el.style.animation = '';
    }, { once: true });
  }

  function restore(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    w.minimized = false;
    w.el.style.display = 'flex';
    w.el.style.animation = `win-open calc(0.28s * var(--anim-speed, 1)) cubic-bezier(0.175,0.885,0.32,1.275) both`;
    w.el.addEventListener('animationend', () => { w.el.style.animation = ''; }, { once: true });
    focus(id);
  }

  function toggleMaximize(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    const el = w.el;
    const mh = 28, dock = 110;
    el.classList.add('maximizing');
    if (!w.maximized) {
      w.prevBounds = { left:el.style.left, top:el.style.top, width:el.style.width, height:el.style.height };
      el.style.cssText += `;left:0;top:${mh}px;width:${window.innerWidth}px;height:${window.innerHeight-mh-dock}px`;
      w.maximized = true;
    } else {
      const b = w.prevBounds;
      el.style.left=b.left; el.style.top=b.top;
      el.style.width=b.width; el.style.height=b.height;
      w.maximized = false; w.snapped = null;
    }
    setTimeout(() => el.classList.remove('maximizing'), 240);
  }

  function snapLeft(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    const el = w.el;
    const mh = 28, dock = 110;
    const h = window.innerHeight - mh - dock;
    if (!w.prevBounds) w.prevBounds = { left:el.style.left, top:el.style.top, width:el.style.width, height:el.style.height };
    el.classList.add('snapped-left');
    el.style.left='0'; el.style.top=mh+'px'; el.style.width='50%'; el.style.height=h+'px';
    w.snapped = 'left';
    setTimeout(() => el.classList.remove('snapped-left'), 250);
  }
  function snapRight(id) {
    if (!wins.has(id)) return;
    const w = wins.get(id);
    const el = w.el;
    const mh = 28, dock = 110;
    const h = window.innerHeight - mh - dock;
    if (!w.prevBounds) w.prevBounds = { left:el.style.left, top:el.style.top, width:el.style.width, height:el.style.height };
    el.classList.add('snapped-right');
    el.style.left='50%'; el.style.top=mh+'px'; el.style.width='50%'; el.style.height=h+'px';
    w.snapped = 'right';
    setTimeout(() => el.classList.remove('snapped-right'), 250);
  }

  function getContentEl(id) {
    return wins.get(id)?.el.querySelector('.window-content') || null;
  }
  function getWin(id) { return wins.get(id); }
  function getAllWins() { return wins; }

  // ─── DRAGGABLE ───────────────────────────────
  function _makeDraggable(el, handle, id) {
    let sx, sy, sl, st, dragging = false;
    let animFrame = null;

    handle.addEventListener('mousedown', e => {
      if (e.target.classList.contains('wc')) return;
      dragging = true;
      sx=e.clientX; sy=e.clientY;
      sl=parseInt(el.style.left)||0; st=parseInt(el.style.top)||0;
      e.preventDefault();
    });

    const onMove = e => {
      if (!dragging) return;
      if (animFrame) cancelAnimationFrame(animFrame);
      animFrame = requestAnimationFrame(() => {
        const dx = e.clientX-sx, dy = e.clientY-sy;
        const newL = Math.max(0, sl+dx);
        const newT = Math.max(28, st+dy);
        el.style.left = newL+'px';
        el.style.top  = newT+'px';

        // Snap detection
        const w = wins.get(id);
        if (w && !w.maximized) {
          const threshold = SNAP_THRESHOLD;
          if (e.clientX <= threshold)                     { SnapManager.showLeft();  }
          else if (e.clientX >= window.innerWidth-threshold) { SnapManager.showRight(); }
          else                                               { SnapManager.hide(); }
        }
      });
    };

    const onUp = e => {
      if (!dragging) return;
      dragging = false;
      SnapManager.hide();
      const threshold = SNAP_THRESHOLD;
      if (e.clientX <= threshold)                        snapLeft(id);
      else if (e.clientX >= window.innerWidth-threshold) snapRight(id);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }

  // ─── RESIZABLE ───────────────────────────────
  function _makeResizable(el, handle) {
    let sx, sy, sw, sh, resizing = false;
    handle.addEventListener('mousedown', e => {
      resizing=true; sx=e.clientX; sy=e.clientY;
      sw=el.offsetWidth; sh=el.offsetHeight;
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!resizing) return;
      requestAnimationFrame(() => {
        el.style.width  = Math.max(320, sw+(e.clientX-sx)) + 'px';
        el.style.height = Math.max(200, sh+(e.clientY-sy)) + 'px';
      });
    });
    document.addEventListener('mouseup', () => { resizing=false; });
  }

  // ─── CYCLE FOCUS (Cmd+Tab) ────────────────────
  function cycleFocus() {
    const openWins = [...wins.keys()];
    if (openWins.length < 2) return;
    // Find currently focused (highest z)
    let maxZ = -1, topId = null;
    wins.forEach((w, id) => {
      const z = parseInt(w.el.style.zIndex)||0;
      if (z > maxZ) { maxZ=z; topId=id; }
    });
    const idx = openWins.indexOf(topId);
    const nextId = openWins[(idx+1) % openWins.length];
    focus(nextId);
  }

  // Close focused window
  function closeFocused() {
    let maxZ = -1, topId = null;
    wins.forEach((w, id) => {
      const z = parseInt(w.el.style.zIndex)||0;
      if (!w.minimized && z > maxZ) { maxZ=z; topId=id; }
    });
    if (topId) close(topId);
  }

  return { create, close, focus, minimize, restore, toggleMaximize, snapLeft, snapRight,
           getContentEl, getWin, getAllWins, nextZ, cycleFocus, closeFocused };
})();

/* ═══════════════════════════════════════════════════
   MODULE: DESKTOP MANAGER (Multi-Desktop)
═══════════════════════════════════════════════════ */
const DesktopManager = (() => {
  let currentIdx = 0;
  const slides   = [];

  const WALLPAPER_GRADIENTS = [
    'radial-gradient(ellipse at 20% 50%, rgba(100,60,180,0.6) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(30,120,255,0.5) 0%, transparent 55%), linear-gradient(135deg, #0d0d1a 0%, #1a1a3e 40%, #0d1a2e 100%)',
    'radial-gradient(ellipse at 30% 40%, rgba(0,180,120,0.5) 0%, transparent 55%), radial-gradient(ellipse at 70% 70%, rgba(0,120,220,0.4) 0%, transparent 50%), linear-gradient(160deg, #001a12 0%, #002a28 50%, #001220 100%)',
    'radial-gradient(ellipse at 50% 30%, rgba(255,100,50,0.5) 0%, transparent 55%), radial-gradient(ellipse at 20% 80%, rgba(180,40,120,0.4) 0%, transparent 50%), linear-gradient(140deg, #1a0508 0%, #2a1020 50%, #18060e 100%)',
    'radial-gradient(ellipse at 60% 40%, rgba(240,180,20,0.4) 0%, transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(255,120,20,0.3) 0%, transparent 50%), linear-gradient(150deg, #14100a 0%, #221808 50%, #1a1208 100%)',
    'radial-gradient(ellipse at 40% 50%, rgba(130,90,255,0.5) 0%, transparent 55%), radial-gradient(ellipse at 75% 30%, rgba(220,80,240,0.4) 0%, transparent 50%), linear-gradient(130deg, #0e0814 0%, #1e1030 50%, #160c24 100%)',
    'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #533483 100%)',
    'radial-gradient(ellipse at 50% 20%, rgba(255,200,0,0.3) 0%, transparent 50%), linear-gradient(160deg, #0a0a0a 0%, #1a1a1a 100%)',
  ];

  function getGradient(idx) { return WALLPAPER_GRADIENTS[idx] || WALLPAPER_GRADIENTS[0]; }

  function init() {
    const container = document.getElementById('desktops-container');
    const state = State.get();
    currentIdx = state.activeDesktop || 0;

    // Ensure at least 1 desktop
    if (!state.desktops || state.desktops.length === 0) {
      state.desktops = [{ id:'desk-0', wallpaper:0, icons:[...defaultIcons()] }];
      State.save();
    }

    state.desktops.forEach((d, i) => {
      const slide = _createSlide(d, i);
      container.appendChild(slide);
      slides.push(slide);
    });

    _applyPositions(false);
    _renderDots();
    _initSwitcher();
    DesktopIcons.initAll();
  }

  function defaultIcons() {
    return [
      { id:'di-finder_'+Date.now(), app:'finder', label:'Finder', x:20, y:20, icon:'📁' },
    ];
  }

  function _createSlide(desktopDef, idx) {
    const slide = document.createElement('div');
    slide.className = 'desktop-slide';
    slide.dataset.desktopIdx = idx;

    const wp = document.createElement('div');
    wp.className = 'desktop-wallpaper';
    wp.style.background = getGradient(desktopDef.wallpaper || 0);

    const iconLayer = document.createElement('div');
    iconLayer.className = 'desktop-icons-layer';

    const winLayer = document.createElement('div');
    winLayer.className = 'desktop-windows-layer';

    slide.appendChild(wp);
    slide.appendChild(iconLayer);
    slide.appendChild(winLayer);

    // Desktop context menu
    slide.addEventListener('contextmenu', e => {
      if (!e.target.classList.contains('desktop-slide') && !e.target.classList.contains('desktop-wallpaper') && !e.target.classList.contains('desktop-icons-layer')) return;
      e.preventDefault();
      ContextMenu.show(e, [
        { icon:'📄', label:'Neue Textdatei', action:() => {
          const name = prompt('Dateiname:', 'Notiz.txt');
          if (!name) return;
          const fid = FileSystem.createFile('/Dokumente', name, name.split('.').pop()||'txt', '');
          DesktopIcons.addToDesktop(currentIdx, { app:'editor', label:name, x:e.clientX-40, y:e.clientY-40, icon:'📝', fileId:fid });
          Toast.show(`"${name}" erstellt`, '📄');
        }},
        { icon:'📁', label:'Neuer Ordner', action:() => {
          const name = prompt('Ordnername:', 'Neuer Ordner');
          if (!name) return;
          FileSystem.createFolder('/', name);
          Toast.show(`"${name}" erstellt`, '📁');
        }},
        { separator:true },
        { icon:'🌐', label:'Browser öffnen',  action:() => AppManager.open('browser') },
        { icon:'💻', label:'Terminal öffnen', action:() => AppManager.open('terminal') },
        { icon:'⚙️', label:'Einstellungen',   action:() => AppManager.open('settings') },
        { separator:true },
        { icon:'➕', label:'Neuer Desktop', action:() => addDesktop() },
      ]);
    });

    // Click to deselect icons
    slide.addEventListener('click', e => {
      if (e.target === slide || e.target === wp || e.target === iconLayer) {
        slide.querySelectorAll('.desktop-icon.selected').forEach(x => x.classList.remove('selected'));
      }
    });

    return slide;
  }

  function _applyPositions(animate) {
    slides.forEach((slide, i) => {
      if (i < currentIdx)      slide.className = 'desktop-slide off-left';
      else if (i === currentIdx) slide.className = 'desktop-slide active';
      else                     slide.className = 'desktop-slide off-right';
    });
  }

  function switchTo(idx, animate=true) {
    if (idx < 0 || idx >= slides.length) return;
    currentIdx = idx;
    State.set('activeDesktop', idx);
    _applyPositions(animate);
    _renderDots();
    Events.emit('desktop:switch', idx);
  }

  function addDesktop() {
    if (slides.length >= Config.MAX_DESKTOPS) {
      Toast.show('Maximale Desktop-Anzahl erreicht', '⚠️');
      return;
    }
    const state = State.get();
    const newDef = { id:'desk-'+Date.now(), wallpaper:0, icons:[] };
    state.desktops.push(newDef);
    State.save();

    const slide = _createSlide(newDef, slides.length);
    document.getElementById('desktops-container').appendChild(slide);
    slides.push(slide);
    DesktopIcons.initSlide(slides.length-1);
    _renderDots();
    switchTo(slides.length-1);
    _renderSwitcherPreviews();
    Toast.show('Neuer Desktop erstellt', '🖥️');
  }

  function removeDesktop(idx) {
    if (slides.length <= 1) { Toast.show('Letzter Desktop kann nicht gelöscht werden','⚠️'); return; }
    const slide = slides[idx];
    slide.remove();
    slides.splice(idx, 1);
    State.get().desktops.splice(idx, 1);
    State.save();
    // Re-number
    slides.forEach((s, i) => s.dataset.desktopIdx = i);
    const newIdx = Math.min(currentIdx, slides.length-1);
    currentIdx = -1; // force re-apply
    switchTo(newIdx, false);
    _renderDots();
    _renderSwitcherPreviews();
  }

  function getActiveSlide() { return slides[currentIdx]; }
  function getCurrent()     { return currentIdx; }
  function getSlide(i)      { return slides[i]; }
  function getSlides()      { return slides; }
  function getWallpaperGradient(idx) { return getGradient(idx); }

  function setWallpaper(desktopIdx, wpIdx) {
    const state = State.get();
    if (state.desktops[desktopIdx]) state.desktops[desktopIdx].wallpaper = wpIdx;
    State.save();
    const slide = slides[desktopIdx];
    if (slide) slide.querySelector('.desktop-wallpaper').style.background = getGradient(wpIdx);
    // Also update global wallpaper for compatibility
    State.set('wallpaper', wpIdx);
  }

  // ── Switcher ──────────────────────────────────
  let switcherOpen = false;
  function _initSwitcher() {
    const switcher = document.getElementById('desktop-switcher');
    document.getElementById('switcher-add').addEventListener('click', () => { addDesktop(); toggleSwitcher(false); });
    _renderSwitcherPreviews();
  }

  function _renderSwitcherPreviews() {
    const container = document.getElementById('switcher-previews');
    container.innerHTML = '';
    slides.forEach((slide, i) => {
      const preview = document.createElement('div');
      preview.className = 'switcher-preview' + (i === currentIdx ? ' current' : '');
      const wpGrad = getGradient(State.get().desktops[i]?.wallpaper || 0);
      preview.innerHTML = `
        <div class="switcher-preview-header">
          Desktop ${i+1}
          <span class="switcher-preview-close" data-idx="${i}">✕</span>
        </div>
        <div class="switcher-preview-thumb">
          <div class="thumb-wp" style="background:${wpGrad}"></div>
        </div>`;
      preview.addEventListener('click', e => {
        if (e.target.classList.contains('switcher-preview-close')) return;
        switchTo(i); toggleSwitcher(false);
      });
      preview.querySelector('.switcher-preview-close').addEventListener('click', () => {
        removeDesktop(i);
      });
      container.appendChild(preview);
    });
  }

  function toggleSwitcher(force) {
    const el = document.getElementById('desktop-switcher');
    switcherOpen = force !== undefined ? force : !switcherOpen;
    el.classList.toggle('hidden', !switcherOpen);
    if (switcherOpen) _renderSwitcherPreviews();
  }

  function _renderDots() {
    const dots = document.getElementById('dock-desktop-dots');
    dots.innerHTML = '';
    slides.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'desktop-dot' + (i === currentIdx ? ' active' : '');
      dot.addEventListener('click', () => switchTo(i));
      dots.appendChild(dot);
    });
  }

  return { init, switchTo, addDesktop, removeDesktop, getActiveSlide, getCurrent,
           getSlide, getSlides, toggleSwitcher, setWallpaper, getWallpaperGradient };
})();

/* ═══════════════════════════════════════════════════
   MODULE: DESKTOP ICONS
═══════════════════════════════════════════════════ */
const DesktopIcons = (() => {

  function initAll() {
    const state = State.get();
    state.desktops.forEach((_, i) => initSlide(i));
  }

  function initSlide(desktopIdx) {
    const slide = DesktopManager.getSlide(desktopIdx);
    if (!slide) return;
    const layer = slide.querySelector('.desktop-icons-layer');
    if (!layer) return;
    layer.innerHTML = '';
    const icons = State.get().desktops[desktopIdx]?.icons || [];
    icons.forEach(def => _renderIcon(layer, def, desktopIdx));
    _initSelectionBox(slide, layer, desktopIdx);
  }

  function addToDesktop(desktopIdx, iconDef) {
    iconDef.id = iconDef.id || 'di_' + Date.now();
    const state = State.get();
    if (!state.desktops[desktopIdx]) return;
    state.desktops[desktopIdx].icons.push(iconDef);
    State.save();
    initSlide(desktopIdx);
  }

  function removeFromDesktop(desktopIdx, iconId) {
    const state = State.get();
    if (!state.desktops[desktopIdx]) return;
    state.desktops[desktopIdx].icons = state.desktops[desktopIdx].icons.filter(x => x.id !== iconId);
    State.save();
    initSlide(desktopIdx);
  }

  function _renderIcon(layer, def, desktopIdx) {
    const el = document.createElement('div');
    el.className = 'desktop-icon';
    el.dataset.iconId = def.id;
    el.style.left = (def.x||20) + 'px';
    el.style.top  = (def.y||20) + 'px';
    el.innerHTML = `
      <div class="icon-img"><span>${def.icon||'📄'}</span></div>
      <div class="icon-label">${def.label}</div>`;

    // Click / double-click
    let clicks = 0, clickTimer = null;
    el.addEventListener('click', e => {
      e.stopPropagation();
      clicks++;
      if (clicks === 1) {
        clickTimer = setTimeout(() => {
          clicks = 0;
          layer.querySelectorAll('.desktop-icon').forEach(x => x.classList.remove('selected'));
          el.classList.add('selected');
        }, 290);
      } else {
        clearTimeout(clickTimer); clicks = 0;
        _openIcon(def);
      }
    });

    // Drag to move
    _makeDraggableIcon(el, def, desktopIdx);

    // Context menu
    el.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      ContextMenu.show(e, [
        { icon:'📂', label:'Öffnen', action:() => _openIcon(def) },
        { separator:true },
        { icon:'🗑️', label:'Entfernen', action:() => {
          removeFromDesktop(desktopIdx, def.id);
        }},
      ]);
    });

    layer.appendChild(el);
  }

  function _openIcon(def) {
    const node = def.fileId ? FileSystem.getNode(def.fileId) : null;
    AppManager.open(def.app, { path:def.path, fileId:def.fileId, node });
  }

  function _makeDraggableIcon(el, def, desktopIdx) {
    let dragging=false, sx,sy,sl,st;
    el.addEventListener('mousedown', e => {
      if (e.button!==0) return;
      dragging=true; sx=e.clientX; sy=e.clientY;
      sl=parseInt(el.style.left)||0; st=parseInt(el.style.top)||0;
      e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if (Math.abs(dx)<3 && Math.abs(dy)<3) return;
      const newL = Math.max(0, sl+dx);
      const newT = Math.max(28, st+dy);
      el.style.left = newL+'px'; el.style.top = newT+'px';
      def.x=newL; def.y=newT;
    });
    document.addEventListener('mouseup', () => {
      if (dragging) { dragging=false; State.save(); }
    });
  }

  function _initSelectionBox(slide, layer, desktopIdx) {
    const box = document.getElementById('selection-box');
    let sel=false, sx,sy;

    slide.addEventListener('mousedown', e => {
      if (e.button!==0) return;
      if (e.target !== slide && !e.target.classList.contains('desktop-wallpaper') && !e.target.classList.contains('desktop-icons-layer')) return;
      sel=true; sx=e.clientX; sy=e.clientY;
      box.style.cssText=`display:block;left:${sx}px;top:${sy}px;width:0;height:0`;
      layer.querySelectorAll('.desktop-icon').forEach(x => x.classList.remove('selected'));
    });

    document.addEventListener('mousemove', e => {
      if (!sel) return;
      requestAnimationFrame(() => {
        const x=Math.min(e.clientX,sx), y=Math.min(e.clientY,sy);
        const w=Math.abs(e.clientX-sx), h=Math.abs(e.clientY-sy);
        box.style.cssText=`display:block;left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
        // Check intersections
        const br = box.getBoundingClientRect();
        layer.querySelectorAll('.desktop-icon').forEach(icon => {
          const ir = icon.getBoundingClientRect();
          const hit = br.left<ir.right && br.right>ir.left && br.top<ir.bottom && br.bottom>ir.top;
          icon.classList.toggle('selected', hit);
        });
      });
    });

    document.addEventListener('mouseup', () => {
      if (!sel) return;
      sel=false; box.style.display='none';
    });
  }

  return { initAll, initSlide, addToDesktop, removeFromDesktop };
})();

/* ═══════════════════════════════════════════════════
   MODULE: DOCK MANAGER
═══════════════════════════════════════════════════ */
const DockManager = (() => {
  function init() {
    document.querySelectorAll('.dock-item[data-app]').forEach(item => {
      item.addEventListener('click', () => AppManager.open(item.dataset.app));
    });
  }
  function setRunning(app, running) {
    document.querySelectorAll(`.dock-item[data-app="${app}"]`).forEach(el => {
      el.classList.toggle('running', running);
    });
  }
  return { init, setRunning };
})();

/* ═══════════════════════════════════════════════════
   MODULE: APP MANAGER (plugin-friendly registry)
═══════════════════════════════════════════════════ */
const AppManager = (() => {
  const registry = {}; // appId -> { open: fn }

  function register(appId, def) { registry[appId] = def; }

  function open(appId, opts={}) {
    if (registry[appId]) {
      registry[appId].open(opts);
    } else {
      Toast.show(`App "${appId}" nicht gefunden`, '⚠️');
    }
  }

  return { register, open };
})();

/* ═══════════════════════════════════════════════════
   APP: FINDER
═══════════════════════════════════════════════════ */
AppManager.register('finder', { open: opts => _openFinder(opts) });

function _openFinder(opts={}) {
  const startPath = opts.path || '/';
  const wid = 'finder_' + Date.now();
  const wrap = document.createElement('div');
  wrap.className = 'finder-layout';

  // ── Navigation history ────────────────────────
  let history   = [startPath];
  let histIdx   = 0;
  let currentPath = startPath;
  let selectedId  = null;
  let searchTerm  = '';

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'finder-sidebar';
  const SIDEBAR_ITEMS = [
    { icon:'🏠', label:'Startseite', path:'/' },
    { icon:'🖥️', label:'Schreibtisch', path:'/Desktop' },
    { icon:'📂', label:'Dokumente',   path:'/Dokumente' },
    { icon:'🖼️', label:'Bilder',      path:'/Bilder' },
    { icon:'⬇️', label:'Downloads',   path:'/Downloads' },
    { icon:'🎵', label:'Musik',       path:'/Musik' },
  ];
  const favSec = document.createElement('div');
  favSec.className = 'finder-sidebar-section';
  favSec.innerHTML = '<div class="finder-sidebar-title">Favoriten</div>';
  SIDEBAR_ITEMS.forEach(si => {
    const item = document.createElement('div');
    item.className = 'finder-sidebar-item';
    item.innerHTML = `<span class="si-icon">${si.icon}</span>${si.label}`;
    item.addEventListener('click', () => navigate(si.path));
    favSec.appendChild(item);
  });
  sidebar.appendChild(favSec);

  // Main
  const main = document.createElement('div');
  main.className = 'finder-main';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'finder-toolbar';

  const backBtn = document.createElement('button');
  backBtn.className = 'finder-nav-btn'; backBtn.textContent = '‹';
  backBtn.title = 'Zurück'; backBtn.disabled = true;
  const fwdBtn  = document.createElement('button');
  fwdBtn.className = 'finder-nav-btn'; fwdBtn.textContent = '›';
  fwdBtn.title = 'Vorwärts'; fwdBtn.disabled = true;

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'finder-breadcrumb';

  const searchInput = document.createElement('input');
  searchInput.className = 'finder-search'; searchInput.placeholder = '🔍 Suchen';
  searchInput.addEventListener('input', () => { searchTerm = searchInput.value.toLowerCase(); renderFiles(); });

  backBtn.addEventListener('click', () => { if (histIdx>0) { histIdx--; currentPath=history[histIdx]; _applyNav(); } });
  fwdBtn.addEventListener('click',  () => { if (histIdx<history.length-1) { histIdx++; currentPath=history[histIdx]; _applyNav(); } });

  toolbar.append(backBtn, fwdBtn, breadcrumb, searchInput);

  // Files area
  const filesEl = document.createElement('div');
  filesEl.className = 'finder-files';

  // Statusbar
  const statusbar = document.createElement('div');
  statusbar.className = 'finder-statusbar';
  const pathDisplay = document.createElement('div');
  pathDisplay.className = 'finder-path-display';
  statusbar.appendChild(pathDisplay);
  const countSpan = document.createElement('span');
  statusbar.appendChild(countSpan);

  main.append(toolbar, filesEl, statusbar);
  wrap.append(sidebar, main);

  // ── Render ───────────────────────────────────
  function updateBreadcrumb() {
    breadcrumb.innerHTML = '';
    const path = currentPath === '/' ? '/' : currentPath;
    const parts = path === '/' ? [''] : path.split('/');
    parts.forEach((p, i) => {
      const crumb = document.createElement('span');
      crumb.className = 'breadcrumb-item';
      crumb.textContent = i===0 ? '🏠' : p;
      const to = i===0 ? '/' : '/'+parts.slice(1,i+1).join('/');
      crumb.addEventListener('click', () => navigate(to));
      breadcrumb.appendChild(crumb);
      if (i < parts.length-1) {
        const sep = document.createElement('span');
        sep.className='breadcrumb-sep'; sep.textContent='›';
        breadcrumb.appendChild(sep);
      }
    });
    pathDisplay.textContent = currentPath;
    // Sidebar active
    sidebar.querySelectorAll('.finder-sidebar-item').forEach(el => {
      el.classList.remove('active');
      if (el.textContent.trim() === SIDEBAR_ITEMS.find(s=>s.path===currentPath)?.label) el.classList.add('active');
    });
  }

  function renderFiles() {
    filesEl.innerHTML = '';
    selectedId = null;
    const children = FileSystem.getFolderChildren(currentPath);
    const filtered = searchTerm ? children.filter(c => c.name.toLowerCase().includes(searchTerm)) : children;

    if (filtered.length === 0) {
      filesEl.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:13px;padding:20px;grid-column:1/-1">Leer</div>';
      countSpan.textContent = '0 Objekte';
      return;
    }

    filtered.forEach(child => {
      const item = document.createElement('div');
      item.className = 'finder-file-item';
      item.dataset.fileId = child.id;
      item.draggable = true;
      const icon = child.type==='folder' ? (child.icon||'📁') : (child.icon||FileSystem.iconForExt(child.ext));
      item.innerHTML = `<div class="ffi-icon">${icon}</div><div class="ffi-name">${child.name}</div>`;

      // Select
      item.addEventListener('click', e => {
        e.stopPropagation();
        filesEl.querySelectorAll('.finder-file-item').forEach(x => x.classList.remove('selected'));
        item.classList.add('selected');
        selectedId = child.id;
      });

      // Double-click open
      let last=0;
      item.addEventListener('click', () => {
        const now=Date.now();
        if (now-last < 380) openNode(child.id, child);
        last=now;
      });

      // Drag
      item.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', child.id); e.dataTransfer.effectAllowed='move'; });

      // Drop (only folders)
      if (child.type==='folder') {
        item.addEventListener('dragover',  e => { e.preventDefault(); item.classList.add('drag-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', e => {
          e.preventDefault(); item.classList.remove('drag-over');
          const dragId = e.dataTransfer.getData('text/plain');
          if (dragId && dragId !== child.id && FileSystem.moveNode(dragId, child.id)) {
            renderFiles(); Toast.show(`Verschoben nach "${child.name}"`, '📁');
          }
        });
      }

      // Context menu
      item.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation();
        ContextMenu.show(e, [
          { icon:'📂', label:'Öffnen', action:() => openNode(child.id, child) },
          { separator:true },
          { icon:'✏️', label:'Umbenennen', action:() => inlineRename(item, child) },
          { icon:'📋', label:'Info', action:() => Toast.show(FileSystem.getPathString(child.id), 'ℹ️', 3500) },
          { separator:true },
          { icon:'🗑️', label:'In den Papierkorb', action:() => {
            FileSystem.deleteNode(child.id); renderFiles();
            Toast.showInteractive({
              title: `"${child.name}" gelöscht`,
              icon:'🗑️',
              actions:[{ label:'Rückgängig', primary:true, cb:() => { FileSystem.restoreFromTrash(child.id); renderFiles(); }}]
            });
          }},
        ]);
      });

      filesEl.appendChild(item);
    });

    countSpan.textContent = `${filtered.length} Objekte`;
  }

  function inlineRename(item, child) {
    const nameEl = item.querySelector('.ffi-name');
    const input = document.createElement('input');
    input.className = 'ffi-rename-input';
    input.value = child.name;
    nameEl.replaceWith(input);
    input.focus(); input.select();
    const commit = () => {
      const val = input.value.trim();
      if (val && val !== child.name) { FileSystem.rename(child.id, val); renderFiles(); }
      else renderFiles();
    };
    input.addEventListener('blur',  commit);
    input.addEventListener('keydown', e => {
      if (e.key==='Enter')  commit();
      if (e.key==='Escape') renderFiles();
    });
  }

  function navigate(path) {
    currentPath = path;
    searchTerm  = ''; searchInput.value='';
    if (history[histIdx] !== path) {
      history = history.slice(0, histIdx+1);
      history.push(path); histIdx++;
    }
    _applyNav();
  }

  function _applyNav() {
    backBtn.disabled = histIdx===0;
    fwdBtn.disabled  = histIdx===history.length-1;
    updateBreadcrumb();
    renderFiles();
  }

  function openNode(id, node) {
    if (!node) node = FileSystem.getNode(id);
    if (!node) return;
    if (node.type==='folder') {
      navigate(id.startsWith('/') ? id : (node.parent||'/') );
      return;
    }
    const ext = (node.ext||'').toLowerCase();
    if (['txt','md','js','ts','py','css','json'].includes(ext)) AppManager.open('editor', { fileId:id, node });
    else if (['jpg','jpeg','png','gif','webp'].includes(ext))  AppManager.open('imageviewer', { fileId:id, node });
    else if (ext==='html') AppManager.open('browser', { url:node.content });
    else Toast.show(`Dateityp ".${ext}" wird nicht unterstützt`, '⚠️');
  }

  // Context menu on empty area
  filesEl.addEventListener('contextmenu', e => {
    if (e.target !== filesEl) return;
    e.preventDefault();
    ContextMenu.show(e, [
      { icon:'📄', label:'Neue Textdatei', action:() => {
        const n=prompt('Dateiname:','Neu.txt');
        if(n){FileSystem.createFile(currentPath,n,n.split('.').pop());renderFiles();}
      }},
      { icon:'📁', label:'Neuer Ordner', action:() => {
        const n=prompt('Ordnername:','Neuer Ordner');
        if(n){FileSystem.createFolder(currentPath,n);renderFiles();}
      }},
      { separator:true },
      { icon:'🔄', label:'Aktualisieren', action:()=>renderFiles() },
    ]);
  });

  // Listen for FS changes
  const fsListener = () => renderFiles();
  Events.on('fs:change', fsListener);

  navigate(startPath);
  WindowManager.create({ id:wid, title:'📁 Finder', app:'finder', width:760, height:520, content:wrap });
}

/* ═══════════════════════════════════════════════════
   APP: TEXT EDITOR
═══════════════════════════════════════════════════ */
AppManager.register('editor', { open: opts => _openEditor(opts) });

function _openEditor(opts={}) {
  const { fileId, node } = opts;
  const wid = 'editor_' + (fileId||Date.now());
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const name    = node?.name || 'Unbenannt.txt';
  const content = node?.content || '';

  const wrap = document.createElement('div');
  wrap.className = 'editor-layout';

  const toolbar = document.createElement('div');
  toolbar.className = 'editor-toolbar';

  const saveBtn   = document.createElement('button');
  saveBtn.className='editor-btn'; saveBtn.textContent='💾 Speichern';
  const newBtn    = document.createElement('button');
  newBtn.className='editor-btn'; newBtn.textContent='📄 Neu';
  const wordWrap  = document.createElement('button');
  wordWrap.className='editor-btn'; wordWrap.textContent='↩ Wrap';

  const filenameInput = document.createElement('input');
  filenameInput.className='editor-filename'; filenameInput.value=name;

  toolbar.append(saveBtn, newBtn, wordWrap, filenameInput);

  const textarea = document.createElement('textarea');
  textarea.className='editor-textarea';
  textarea.value=content; textarea.placeholder='Beginne zu schreiben…';
  textarea.spellcheck=false;

  const statusbar = document.createElement('div');
  statusbar.className='editor-statusbar';

  let wordWrapOn=false;
  wordWrap.addEventListener('click', () => {
    wordWrapOn=!wordWrapOn;
    textarea.style.whiteSpace = wordWrapOn ? 'pre-wrap' : 'pre';
    wordWrap.style.background = wordWrapOn ? 'rgba(10,132,255,0.3)' : '';
  });

  function updateStatus() {
    const lines = textarea.value.split('\n').length;
    const words = textarea.value.trim().split(/\s+/).filter(Boolean).length;
    const chars = textarea.value.length;
    statusbar.textContent = `Zeilen: ${lines}  Wörter: ${words}  Zeichen: ${chars}`;
  }
  textarea.addEventListener('input', updateStatus);
  updateStatus();

  // Tab support
  textarea.addEventListener('keydown', e => {
    if (e.key==='Tab') {
      e.preventDefault();
      const s=textarea.selectionStart, end=textarea.selectionEnd;
      textarea.value=textarea.value.substring(0,s)+'  '+textarea.value.substring(end);
      textarea.selectionStart=textarea.selectionEnd=s+2;
    }
  });

  function doSave() {
    const text=textarea.value, fname=filenameInput.value.trim();
    if (fileId) {
      FileSystem.updateContent(fileId, text);
      FileSystem.rename(fileId, fname);
    } else {
      FileSystem.createFile('/Dokumente', fname, fname.split('.').pop()||'txt', text);
    }
    Toast.showInteractive({
      title:`"${fname}" gespeichert`, icon:'💾',
      actions:[{ label:'Im Finder anzeigen', cb:() => AppManager.open('finder', { path:'/Dokumente' }) }]
    });
  }

  saveBtn.addEventListener('click', doSave);
  newBtn.addEventListener('click',  () => { textarea.value=''; filenameInput.value='Unbenannt.txt'; updateStatus(); });

  wrap.append(toolbar, textarea, statusbar);
  WindowManager.create({ id:wid, title:`✏️ ${name}`, app:'editor', width:620, height:500,
    content:wrap, meta:{ saveOnClose:doSave } });
}

/* ═══════════════════════════════════════════════════
   APP: BROWSER
═══════════════════════════════════════════════════ */
AppManager.register('browser', { open: opts => _openBrowser(opts) });

function _openBrowser(opts={}) {
  const wid = 'browser_' + Date.now();
  const wrap = document.createElement('div');
  wrap.className = 'browser-layout';

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';

  const backBtn   = document.createElement('button'); backBtn.className='browser-nav-btn'; backBtn.textContent='‹';
  const fwdBtn    = document.createElement('button'); fwdBtn.className='browser-nav-btn'; fwdBtn.textContent='›';
  const reloadBtn = document.createElement('button'); reloadBtn.className='browser-nav-btn'; reloadBtn.textContent='↻';

  const urlBar = document.createElement('input');
  urlBar.className='browser-url-bar'; urlBar.placeholder='URL eingeben und Enter drücken…';
  urlBar.value = opts.url || '';

  const goBtn = document.createElement('button');
  goBtn.className='browser-go-btn'; goBtn.textContent='Los';

  toolbar.append(backBtn, fwdBtn, reloadBtn, urlBar, goBtn);

  const loadingBar = document.createElement('div');
  loadingBar.className='browser-loading';

  const placeholder = document.createElement('div');
  placeholder.className='browser-placeholder';
  placeholder.innerHTML=`
    <div class="bp-icon">🌐</div>
    <p style="font-size:14px;margin-bottom:4px">Virtuelle Browserumgebung</p>
    <p style="font-size:12px;opacity:.5;margin-bottom:14px">Hinweis: Viele Seiten erlauben keine Einbettung</p>
    <div class="bp-links"></div>`;
  const quickLinks = [
    {label:'Wikipedia',url:'https://de.wikipedia.org'},
    {label:'OpenStreetMap',url:'https://www.openstreetmap.org'},
    {label:'MDN Docs',url:'https://developer.mozilla.org'},
  ];
  const linksEl = placeholder.querySelector('.bp-links');
  quickLinks.forEach(ql => {
    const btn = document.createElement('button');
    btn.className='browser-quick-link'; btn.textContent=ql.label;
    btn.addEventListener('click', () => navigate(ql.url));
    linksEl.appendChild(btn);
  });

  let iframe = null;

  function navigate(rawUrl) {
    if (!rawUrl.trim()) return;
    let u = rawUrl.trim();
    if (!u.startsWith('http://') && !u.startsWith('https://')) u='https://'+u;
    urlBar.value=u;
    loadingBar.classList.add('active');
    placeholder.remove();
    if (!iframe) {
      iframe=document.createElement('iframe');
      iframe.className='browser-iframe';
      iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation';
      wrap.appendChild(iframe);
    }
    iframe.src=u;
    iframe.onload=()=>loadingBar.classList.remove('active');
    iframe.onerror=()=>{loadingBar.classList.remove('active'); Toast.show('Seite konnte nicht geladen werden','⚠️');};
  }

  goBtn.addEventListener('click', () => navigate(urlBar.value));
  urlBar.addEventListener('keydown', e => { if(e.key==='Enter') navigate(urlBar.value); });
  backBtn.addEventListener('click',   () => iframe?.contentWindow?.history?.back());
  fwdBtn.addEventListener('click',    () => iframe?.contentWindow?.history?.forward());
  reloadBtn.addEventListener('click', () => { if(iframe){loadingBar.classList.add('active'); iframe.src=iframe.src;} });

  wrap.append(toolbar, loadingBar, placeholder);
  if (opts.url) navigate(opts.url);

  WindowManager.create({ id:wid, title:'🌐 Browser', app:'browser', width:840, height:580, content:wrap });
}

/* ═══════════════════════════════════════════════════
   APP: IMAGE VIEWER
═══════════════════════════════════════════════════ */
AppManager.register('imageviewer', { open: opts => _openImageViewer(opts) });

function _openImageViewer(opts={}) {
  const { fileId, node } = opts;
  const wid  = 'imgview_' + (fileId||Date.now());
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }
  const name = node?.name || 'Bild';
  const src  = node?.content || null;

  const wrap = document.createElement('div');
  wrap.className = 'imageviewer-layout';

  const toolbar = document.createElement('div');
  toolbar.className = 'imageviewer-toolbar';
  let zoom=1;
  const zoomLabel = document.createElement('span'); zoomLabel.className='iv-zoom-label'; zoomLabel.textContent='100%';
  const zoomIn    = document.createElement('button'); zoomIn.className='iv-btn'; zoomIn.textContent='+';
  const zoomOut   = document.createElement('button'); zoomOut.className='iv-btn'; zoomOut.textContent='−';
  const zoomReset = document.createElement('button'); zoomReset.className='iv-btn'; zoomReset.textContent='⊡'; zoomReset.title='Zurücksetzen';
  const fitBtn    = document.createElement('button'); fitBtn.className='iv-btn'; fitBtn.textContent='↔'; fitBtn.title='Einpassen';
  toolbar.append(zoomOut, zoomLabel, zoomIn, zoomReset, fitBtn);

  const canvas = document.createElement('div');
  canvas.className='imageviewer-canvas';

  const statusbar = document.createElement('div');
  statusbar.className='imageviewer-statusbar';

  if (src) {
    const img=document.createElement('img'); img.src=src; img.alt=name;
    img.onload=()=>{ statusbar.textContent=`${img.naturalWidth}×${img.naturalHeight}px  •  ${name}`; };
    const applyZoom=()=>{ zoom=Math.max(0.05,Math.min(8,zoom)); img.style.transform=`scale(${zoom})`; zoomLabel.textContent=Math.round(zoom*100)+'%'; };
    zoomIn.addEventListener('click',()=>{zoom+=0.2;applyZoom();});
    zoomOut.addEventListener('click',()=>{zoom-=0.2;applyZoom();});
    zoomReset.addEventListener('click',()=>{zoom=1;applyZoom();});
    fitBtn.addEventListener('click',()=>{zoom=Math.min(canvas.offsetWidth/img.naturalWidth,canvas.offsetHeight/img.naturalHeight)*0.92;applyZoom();});
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoom+=e.deltaY<0?0.1:-0.1;applyZoom();},{passive:false});
    canvas.appendChild(img);
  } else {
    canvas.innerHTML='<div class="imageviewer-empty"><div class="ie-icon">🖼️</div><p>Kein Bild geladen</p></div>';
  }

  wrap.append(toolbar, canvas, statusbar);
  WindowManager.create({ id:wid, title:`🖼️ ${name}`, app:'imageviewer', width:680, height:520, content:wrap });
}

/* ═══════════════════════════════════════════════════
   APP: TERMINAL
═══════════════════════════════════════════════════ */
AppManager.register('terminal', { open: opts => _openTerminal(opts) });

function _openTerminal(opts={}) {
  const wid = 'terminal_' + Date.now();
  const wrap = document.createElement('div');
  wrap.className = 'terminal-layout';

  const output = document.createElement('div');
  output.className = 'terminal-output';

  const inputRow = document.createElement('div');
  inputRow.className = 'terminal-input-row';
  const ps1El = document.createElement('span');
  ps1El.className='terminal-ps1';
  const inputEl = document.createElement('input');
  inputEl.className='terminal-input'; inputEl.autocomplete='off'; inputEl.spellcheck=false;
  inputRow.append(ps1El, inputEl);

  wrap.append(output, inputRow);

  // ── Terminal state ─────────────────────────
  let cwd = '/';
  const cmdHistory = [];
  let histPos = -1;

  function updatePS1() { ps1El.textContent = `webos@desktop:${cwd} $ `; }
  updatePS1();

  function print(text, cls='t-out') {
    const line = document.createElement('span');
    line.className = `t-line ${cls}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }
  function println(text, cls='t-out') { print(text+'\n', cls); }

  // Welcome
  println('WebOS Terminal v2.0', 't-info');
  println('Tippe "help" für Befehle.', 't-info');
  println('', 't-out');

  const COMMANDS = {
    help: () => {
      println('Verfügbare Befehle:', 't-info');
      const cmds = [
        ['help',    'Diese Hilfe anzeigen'],
        ['ls',      'Verzeichnis auflisten'],
        ['cd',      'Verzeichnis wechseln'],
        ['pwd',     'Aktueller Pfad'],
        ['mkdir',   'Ordner erstellen'],
        ['touch',   'Datei erstellen'],
        ['rm',      'Datei/Ordner löschen'],
        ['cat',     'Dateiinhalt anzeigen'],
        ['echo',    'Text ausgeben'],
        ['clear',   'Terminal leeren'],
        ['date',    'Datum & Uhrzeit'],
        ['whoami',  'Benutzername'],
        ['open',    'Datei öffnen'],
        ['neofetch','Systeminfo'],
        ['exit',    'Terminal schließen'],
      ];
      cmds.forEach(([cmd, desc]) => println(`  ${cmd.padEnd(12)} ${desc}`, 't-out'));
    },

    ls: (args) => {
      const path = args[0] || cwd;
      const node = FileSystem.getNode(path);
      if (!node || node.type!=='folder') { println(`ls: ${path}: Ordner nicht gefunden`, 't-err'); return; }
      const children = FileSystem.getFolderChildren(path);
      if (children.length===0) { println('(leer)', 't-out'); return; }
      children.forEach(c => println((c.type==='folder'?'📁 ':'📄 ')+c.name));
    },

    cd: (args) => {
      if (!args[0]) { cwd='/'; updatePS1(); return; }
      let target = args[0];
      if (target==='..') {
        const parts = cwd.split('/').filter(Boolean);
        parts.pop(); cwd='/'+parts.join('/') || '/'; updatePS1(); return;
      }
      // Try absolute or relative
      const abs = target.startsWith('/') ? target : (cwd==='/'?'/'+target:cwd+'/'+target);
      const node = FileSystem.getNode(abs);
      if (node && node.type==='folder') { cwd=abs; updatePS1(); }
      else println(`cd: ${args[0]}: Kein solcher Ordner`, 't-err');
    },

    pwd:   ()       => println(cwd),
    clear: ()       => { output.innerHTML=''; },
    date:  ()       => println(new Date().toLocaleString('de-DE'), 't-info'),
    whoami:()       => println('benutzer@webos', 't-info'),

    echo: (args) => println(args.join(' ')),

    mkdir: (args) => {
      if (!args[0]) { println('mkdir: Ordnername fehlt', 't-err'); return; }
      FileSystem.createFolder(cwd, args[0]);
      println(`Ordner "${args[0]}" erstellt`);
    },

    touch: (args) => {
      if (!args[0]) { println('touch: Dateiname fehlt', 't-err'); return; }
      const ext = args[0].split('.').pop() || 'txt';
      FileSystem.createFile(cwd, args[0], ext, '');
      println(`Datei "${args[0]}" erstellt`);
    },

    rm: (args) => {
      if (!args[0]) { println('rm: Datei fehlt', 't-err'); return; }
      const fs = FileSystem.get();
      // Find by name in cwd
      const parentNode = fs[cwd];
      if (!parentNode?.children) { println('rm: Ordner nicht gefunden', 't-err'); return; }
      const childId = parentNode.children.find(id => fs[id]?.name===args[0]);
      if (childId) { FileSystem.deleteNode(childId); println(`"${args[0]}" gelöscht`); }
      else println(`rm: ${args[0]}: Nicht gefunden`, 't-err');
    },

    cat: (args) => {
      if (!args[0]) { println('cat: Dateiname fehlt', 't-err'); return; }
      const fs = FileSystem.get();
      const parentNode = fs[cwd];
      const childId = parentNode?.children?.find(id => fs[id]?.name===args[0]);
      if (childId) {
        const node = fs[childId];
        if (node.type==='folder') println('cat: Ist ein Verzeichnis', 't-err');
        else (node.content||'(leer)').split('\n').forEach(l => println(l));
      } else println(`cat: ${args[0]}: Nicht gefunden`, 't-err');
    },

    open: (args) => {
      if (!args[0]) { println('open: Dateiname fehlt', 't-err'); return; }
      const fs = FileSystem.get();
      const parentNode = fs[cwd];
      const childId = parentNode?.children?.find(id => fs[id]?.name===args[0]);
      if (childId) {
        const node = fs[childId];
        const ext=(node.ext||'').toLowerCase();
        if (['txt','md','js','ts','css','json'].includes(ext)) AppManager.open('editor',{fileId:childId,node});
        else if (['jpg','jpeg','png','gif','webp'].includes(ext)) AppManager.open('imageviewer',{fileId:childId,node});
        else println(`open: Kein Programm für .${ext}`, 't-err');
        println(`Öffne "${args[0]}"…`, 't-info');
      } else println(`open: ${args[0]}: Nicht gefunden`, 't-err');
    },

    neofetch: () => {
      const lines=[
        '    ██╗    ██╗███████╗██████╗  ██████╗ ███████╗',
        '    ██║    ██║██╔════╝██╔══██╗██╔═══██╗██╔════╝',
        '    ██║ █╗ ██║█████╗  ██████╔╝██║   ██║███████╗',
        '    ██║███╗██║██╔══╝  ██╔══██╗██║   ██║╚════██║',
        '    ╚███╔███╔╝███████╗██████╔╝╚██████╔╝███████║',
        '     ╚══╝╚══╝ ╚══════╝╚═════╝  ╚═════╝ ╚══════╝',
      ];
      lines.forEach(l => println(l,'t-info'));
      println('');
      println('  OS:        WebOS 2.0','t-out');
      println('  Browser:   '+navigator.userAgent.split(' ').pop(),'t-out');
      println('  Shell:     WebTerminal v2.0','t-out');
      println('  Sprache:   Deutsch','t-out');
      println('  Auflösung: '+window.innerWidth+'×'+window.innerHeight,'t-out');
      println('  Desktop:   '+(DesktopManager.getCurrent()+1)+' von '+DesktopManager.getSlides().length,'t-out');
      println('  Fenster:   '+WindowManager.getAllWins().size,'t-out');
    },

    exit: () => { WindowManager.close && WindowManager.getAllWins().forEach((_,id)=>{ if(WindowManager.getWin(id)?.app==='terminal') WindowManager.close(id); }); },
  };

  function runCommand(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    cmdHistory.unshift(trimmed); histPos=-1;
    // Echo
    const pLine = document.createElement('span');
    pLine.className='t-line';
    pLine.innerHTML=`<span class="t-prompt">${ps1El.textContent}</span><span class="t-cmd">${trimmed}</span>`;
    output.appendChild(pLine);

    const [cmd, ...args] = trimmed.split(/\s+/);
    if (COMMANDS[cmd]) COMMANDS[cmd](args);
    else println(`Befehl nicht gefunden: ${cmd}  (tippe "help")`, 't-err');
    output.scrollTop = output.scrollHeight;
  }

  inputEl.addEventListener('keydown', e => {
    if (e.key==='Enter')    { runCommand(inputEl.value); inputEl.value=''; }
    if (e.key==='ArrowUp')  { histPos=Math.min(histPos+1,cmdHistory.length-1); inputEl.value=cmdHistory[histPos]||''; }
    if (e.key==='ArrowDown'){ histPos=Math.max(histPos-1,-1); inputEl.value=histPos<0?'':cmdHistory[histPos]; }
  });

  WindowManager.create({ id:wid, title:'💻 Terminal', app:'terminal', width:640, height:440, content:wrap });
  setTimeout(()=>inputEl.focus(), 100);
}

/* ═══════════════════════════════════════════════════
   APP: CALCULATOR
═══════════════════════════════════════════════════ */
AppManager.register('calculator', { open: opts => _openCalculator(opts) });

function _openCalculator(opts={}) {
  const wid='calc_'+Date.now();
  const wrap=document.createElement('div'); wrap.className='calc-layout';

  const display=document.createElement('div'); display.className='calc-display';
  const exprEl=document.createElement('div'); exprEl.className='calc-expr';
  const resultEl=document.createElement('div'); resultEl.className='calc-result'; resultEl.textContent='0';
  display.append(exprEl,resultEl);

  const grid=document.createElement('div'); grid.className='calc-grid';

  let expr='', result='0', waitingForOperand=false;

  const BUTTONS = [
    {l:'AC',cls:'fn',action:'clear'},{l:'±',cls:'fn',action:'negate'},{l:'%',cls:'fn',action:'percent'},{l:'÷',cls:'op',action:'op',val:'/'},
    {l:'7',action:'digit'},{l:'8',action:'digit'},{l:'9',action:'digit'},{l:'×',cls:'op',action:'op',val:'*'},
    {l:'4',action:'digit'},{l:'5',action:'digit'},{l:'6',action:'digit'},{l:'−',cls:'op',action:'op',val:'-'},
    {l:'1',action:'digit'},{l:'2',action:'digit'},{l:'3',action:'digit'},{l:'+',cls:'op',action:'op',val:'+'},
    {l:'0',cls:'span2',action:'digit'},{l:'.',action:'decimal'},{l:'=',cls:'eq',action:'equals'},
  ];

  BUTTONS.forEach(b=>{
    const btn=document.createElement('button');
    btn.className='calc-btn '+(b.cls||'');
    btn.textContent=b.l;
    btn.addEventListener('click',()=>handleCalc(b));
    grid.appendChild(btn);
  });

  function handleCalc(b){
    switch(b.action){
      case 'clear':
        expr=''; result='0'; exprEl.textContent=''; resultEl.textContent='0'; break;
      case 'digit':
        if(result==='0'||waitingForOperand){result=b.l;waitingForOperand=false;}
        else result+=b.l;
        resultEl.textContent=result; break;
      case 'decimal':
        if(!result.includes('.')){result+='.';resultEl.textContent=result;} break;
      case 'op':
        expr=result+' '+(b.val||b.l)+' '; exprEl.textContent=expr;
        waitingForOperand=true; break;
      case 'negate':
        result=String(-parseFloat(result)||0); resultEl.textContent=result; break;
      case 'percent':
        result=String(parseFloat(result)/100); resultEl.textContent=result; break;
      case 'equals':
        try{
          const fullExpr=expr+result;
          const val=Function('"use strict";return ('+fullExpr+')')();
          exprEl.textContent=fullExpr+' =';
          result=String(Math.round(val*1e10)/1e10);
          resultEl.textContent=result; expr=''; waitingForOperand=true;
        }catch(e){resultEl.textContent='Fehler';expr='';result='0';}
        break;
    }
  }

  // Keyboard support
  wrap.addEventListener('keydown', e=>{
    const map={'0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
               '+':'+','-':'-','*':'*','/':'/','Enter':'=','Escape':'clear','.':'.',',':'.'};
    const b=map[e.key];
    if(!b)return;
    if(b==='clear') handleCalc({action:'clear'});
    else if(b==='=') handleCalc({action:'equals'});
    else if('0123456789'.includes(b)) handleCalc({action:'digit',l:b});
    else if('.'.includes(b)) handleCalc({action:'decimal'});
    else handleCalc({action:'op',l:b,val:b});
  });

  wrap.append(display,grid);
  wrap.tabIndex=0;
  WindowManager.create({id:wid,title:'🔢 Rechner',app:'calculator',width:310,height:480,content:wrap});
  setTimeout(()=>wrap.focus(),100);
}

/* ═══════════════════════════════════════════════════
   APP: MUSIC PLAYER
═══════════════════════════════════════════════════ */
AppManager.register('musicplayer', { open: opts => _openMusicPlayer(opts) });

function _openMusicPlayer(opts={}) {
  const wid='music_'+Date.now();

  const TRACKS = [
    { title:'Ambient Dream',   artist:'WebOS Sounds', duration:214, emoji:'🌌', color:'#1a1a4e' },
    { title:'Digital Rain',    artist:'WebOS Sounds', duration:183, emoji:'💧', color:'#0a2a2a' },
    { title:'Sunset Drive',    artist:'WebOS Sounds', duration:247, emoji:'🌅', color:'#3a1a0a' },
    { title:'Night Pulse',     artist:'WebOS Sounds', duration:198, emoji:'🌃', color:'#1a0a3a' },
    { title:'Mountain Echo',   artist:'WebOS Sounds', duration:231, emoji:'🏔️', color:'#0a1a2a' },
  ];

  let curIdx=0, playing=false, progress=0, timer=null;

  const wrap=document.createElement('div'); wrap.className='music-layout';

  const coverArea=document.createElement('div'); coverArea.className='music-cover';
  const coverArt=document.createElement('div'); coverArt.className='music-cover-art';

  const controls=document.createElement('div'); controls.className='music-controls';
  const trackInfo=document.createElement('div'); trackInfo.className='music-track-info';
  const titleEl=document.createElement('div'); titleEl.className='music-track-title';
  const artistEl=document.createElement('div'); artistEl.className='music-track-artist';
  trackInfo.append(titleEl,artistEl);

  const progressWrap=document.createElement('div'); progressWrap.className='music-progress-wrap';
  const progressFill=document.createElement('div'); progressFill.className='music-progress-fill';
  progressWrap.appendChild(progressFill);

  const timesEl=document.createElement('div'); timesEl.className='music-times';
  const curTimeEl=document.createElement('span'); curTimeEl.textContent='0:00';
  const durEl=document.createElement('span');
  timesEl.append(curTimeEl,durEl);

  const btns=document.createElement('div'); btns.className='music-btns';
  const prevBtn=document.createElement('button'); prevBtn.className='music-btn'; prevBtn.textContent='⏮';
  const playBtn=document.createElement('button'); playBtn.className='music-btn play-btn'; playBtn.textContent='▶';
  const nextBtn=document.createElement('button'); nextBtn.className='music-btn'; nextBtn.textContent='⏭';
  const shuffleBtn=document.createElement('button'); shuffleBtn.className='music-btn'; shuffleBtn.textContent='🔀'; shuffleBtn.style.fontSize='18px';
  btns.append(shuffleBtn,prevBtn,playBtn,nextBtn);

  const playlist=document.createElement('div'); playlist.className='music-playlist';

  controls.append(trackInfo,progressWrap,timesEl,btns);
  wrap.append(coverArea,controls,playlist);
  coverArea.appendChild(coverArt);

  function fmt(s){const m=Math.floor(s/60),sec=Math.floor(s%60);return `${m}:${sec.toString().padStart(2,'0')}`;}

  function loadTrack(idx){
    const t=TRACKS[idx];
    titleEl.textContent=t.title; artistEl.textContent=t.artist;
    coverArt.textContent=t.emoji; coverArt.style.background=t.color;
    durEl.textContent=fmt(t.duration);
    progress=0; progressFill.style.width='0%'; curTimeEl.textContent='0:00';
    playlist.querySelectorAll('.music-pl-item').forEach((el,i)=>el.classList.toggle('active',i===idx));
  }

  function startPlay(){
    playing=true; playBtn.textContent='⏸'; coverArt.classList.add('playing'); coverArt.classList.remove('paused');
    timer=setInterval(()=>{
      progress=Math.min(progress+1, TRACKS[curIdx].duration);
      const pct=(progress/TRACKS[curIdx].duration)*100;
      progressFill.style.width=pct+'%'; curTimeEl.textContent=fmt(progress);
      if(progress>=TRACKS[curIdx].duration) nextTrack();
    },1000);
  }
  function stopPlay(){
    playing=false; playBtn.textContent='▶'; coverArt.classList.remove('playing'); coverArt.classList.add('paused');
    clearInterval(timer);
  }
  function nextTrack(){stopPlay();curIdx=(curIdx+1)%TRACKS.length;loadTrack(curIdx);startPlay();}
  function prevTrack(){stopPlay();curIdx=(curIdx-1+TRACKS.length)%TRACKS.length;loadTrack(curIdx);startPlay();}

  playBtn.addEventListener('click',  ()=>{ playing?stopPlay():startPlay(); });
  nextBtn.addEventListener('click',  nextTrack);
  prevBtn.addEventListener('click',  prevTrack);
  shuffleBtn.addEventListener('click',()=>{curIdx=Math.floor(Math.random()*TRACKS.length);loadTrack(curIdx);if(playing)startPlay();});

  progressWrap.addEventListener('click', e=>{
    const r=progressWrap.getBoundingClientRect();
    const pct=(e.clientX-r.left)/r.width;
    progress=Math.floor(pct*TRACKS[curIdx].duration);
    progressFill.style.width=(pct*100)+'%'; curTimeEl.textContent=fmt(progress);
  });

  // Playlist
  TRACKS.forEach((t,i)=>{
    const item=document.createElement('div'); item.className='music-pl-item'+(i===0?' active':'');
    item.innerHTML=`<span class="music-pl-icon">${t.emoji}</span>
      <div class="music-pl-info"><div class="music-pl-title">${t.title}</div></div>
      <span class="music-pl-dur-badge">${fmt(t.duration)}</span>`;
    item.addEventListener('click',()=>{stopPlay();curIdx=i;loadTrack(i);startPlay();});
    playlist.appendChild(item);
  });

  loadTrack(0);
  WindowManager.create({id:wid,title:'🎵 Musik',app:'musicplayer',width:360,height:580,content:wrap});
}

/* ═══════════════════════════════════════════════════
   APP: SETTINGS
═══════════════════════════════════════════════════ */
AppManager.register('settings', { open: opts => _openSettings(opts) });

function _openSettings(opts={}) {
  const wid='settings';
  if (WindowManager.getWin(wid)){WindowManager.focus(wid);return;}
  const wrap=document.createElement('div'); wrap.className='settings-layout';

  const sidebar=document.createElement('div'); sidebar.className='settings-sidebar';
  const content=document.createElement('div'); content.className='settings-content';

  const SECTIONS=[
    {icon:'🖼️',label:'Hintergrund'},
    {icon:'🎨',label:'Darstellung'},
    {icon:'⚡',label:'Animationen'},
    {icon:'⌨️',label:'Tastatur'},
    {icon:'ℹ️',label:'Über WebOS'},
  ];

  SECTIONS.forEach((s,i)=>{
    const item=document.createElement('div');
    item.className='settings-sidebar-item'+(i===0?' active':'');
    item.innerHTML=`<span class="ss-icon">${s.icon}</span>${s.label}`;
    item.addEventListener('click',()=>{
      sidebar.querySelectorAll('.settings-sidebar-item').forEach(x=>x.classList.remove('active'));
      item.classList.add('active'); showSection(i);
    });
    sidebar.appendChild(item);
  });

  function showSection(idx){
    content.innerHTML='';
    if(idx===0) showWallpaperSection();
    else if(idx===1) showAppearanceSection();
    else if(idx===2) showAnimSection();
    else if(idx===3) showKeyboardSection();
    else if(idx===4) showAboutSection();
  }

  function row(label,desc,control){
    const r=document.createElement('div'); r.className='settings-row';
    const lWrap=document.createElement('div'); lWrap.className='settings-row-label';
    lWrap.innerHTML=`${label}${desc?`<div class="settings-row-desc">${desc}</div>`:''}`;
    r.append(lWrap,control); return r;
  }

  function showWallpaperSection(){
    const t=document.createElement('div'); t.className='settings-section-title'; t.textContent='Hintergrund für aktuellen Desktop';
    const grid=document.createElement('div'); grid.className='wallpaper-grid';
    const curWp=State.get().desktops[DesktopManager.getCurrent()]?.wallpaper||0;
    Config.WALLPAPER_NAMES.forEach((name,i)=>{
      const swatch=document.createElement('div');
      swatch.className='wp-swatch'+(i===curWp?' active':'');
      swatch.style.background=DesktopManager.getWallpaperGradient(i);
      swatch.innerHTML=`<span>${name}</span>`;
      swatch.addEventListener('click',()=>{
        grid.querySelectorAll('.wp-swatch').forEach(x=>x.classList.remove('active'));
        swatch.classList.add('active');
        DesktopManager.setWallpaper(DesktopManager.getCurrent(),i);
        Toast.show(`Hintergrund: "${name}"`, '🖼️');
      });
      grid.appendChild(swatch);
    });
    content.append(t,grid);
  }

  function showAppearanceSection(){
    const t1=document.createElement('div'); t1.className='settings-section-title'; t1.textContent='Design';
    content.appendChild(t1);

    // Light/Dark mode
    const toggle=_makeToggle(State.get().lightMode||false, val=>{ Theme.applyLightMode(val); Toast.show(val?'Hellmodus aktiviert':'Dunkelmodus aktiviert','🎨'); });
    content.appendChild(row('Helles Design','Wechsle zwischen Dark und Light Mode',toggle));

    // Accent color
    const t2=document.createElement('div'); t2.className='settings-section-title'; t2.textContent='Akzentfarbe';
    content.appendChild(t2);
    const accents=document.createElement('div'); accents.className='accent-colors';
    Config.ACCENT_COLORS.forEach(ac=>{
      const sw=document.createElement('div');
      sw.className='accent-swatch'; sw.style.background=ac.val; sw.title=ac.name;
      if(State.get().accentColor===ac.val) sw.classList.add('active');
      sw.addEventListener('click',()=>{
        accents.querySelectorAll('.accent-swatch').forEach(x=>x.classList.remove('active'));
        sw.classList.add('active'); Theme.applyAccent(ac.val);
        Toast.show(`Akzentfarbe: ${ac.name}`,'🎨');
      });
      accents.appendChild(sw);
    });
    content.appendChild(accents);
  }

  function showAnimSection(){
    const t=document.createElement('div'); t.className='settings-section-title'; t.textContent='Animationsgeschwindigkeit';
    content.appendChild(t);
    const range=document.createElement('input');
    range.type='range'; range.className='settings-range';
    range.min='0.2'; range.max='2'; range.step='0.1';
    range.value=State.get().animSpeed??1;
    const val=document.createElement('span');
    val.textContent=range.value+'×'; val.style.cssText='color:rgba(255,255,255,0.6);font-size:12px;margin-left:10px';
    const wrap2=document.createElement('div'); wrap2.style.display='flex'; wrap2.style.alignItems='center';
    wrap2.append(range,val);
    range.addEventListener('input',()=>{ val.textContent=range.value+'×'; Theme.applyAnimSpeed(parseFloat(range.value)); });
    content.appendChild(row('Animationsgeschwindigkeit','1.0× = Standard',wrap2));

    const t2=document.createElement('div'); t2.className='settings-section-title'; t2.textContent='Fenster-Effekte';
    content.appendChild(t2);
    const toggle=_makeToggle(true, ()=>{});
    content.appendChild(row('Glasmorphismus','Durchscheinende Fenster',toggle));
  }

  function showKeyboardSection(){
    const t=document.createElement('div'); t.className='settings-section-title'; t.textContent='Tastaturkürzel';
    content.appendChild(t);
    const shortcuts=[
      ['Cmd / Ctrl + W',  'Aktives Fenster schließen'],
      ['Cmd / Ctrl + Tab','Nächste App fokussieren'],
      ['Ctrl + Leertaste','Desktop-Übersicht'],
      ['Ctrl + →',        'Nächster Desktop'],
      ['Ctrl + ←',        'Vorheriger Desktop'],
      ['Ctrl + Shift + →','Desktop hinzufügen'],
    ];
    shortcuts.forEach(([key,desc])=>{
      const r=document.createElement('div'); r.className='settings-row';
      r.innerHTML=`
        <div class="settings-row-label" style="flex:1">${desc}</div>
        <code style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:5px;font-size:12px;color:rgba(255,255,255,0.7)">${key}</code>`;
      content.appendChild(r);
    });
  }

  function showAboutSection(){
    content.innerHTML=`
      <div class="settings-section-title">Über WebOS</div>
      <div style="color:rgba(255,255,255,0.7);font-size:14px;line-height:2">
        <p><strong style="color:white">WebOS 2.0</strong></p>
        <p>Virtuelle Desktop-Umgebung im Browser</p>
        <br>
        <p>HTML · CSS · JavaScript (vanilla)</p>
        <p>Kein Framework · Kein Backend · Nur Browser</p>
        <br>
        <p style="color:rgba(255,255,255,0.4);font-size:12px">Daten werden im localStorage gespeichert.</p>
      </div>
      <div class="settings-section-title" style="margin-top:24px">Datenverwaltung</div>`;
    const r=document.createElement('div'); r.style.display='flex'; r.style.gap='10px'; r.style.marginTop='10px';
    const resetBtn=document.createElement('button'); resetBtn.className='editor-btn'; resetBtn.textContent='🗑️ Zurücksetzen';
    const exportBtn=document.createElement('button'); exportBtn.className='editor-btn'; exportBtn.textContent='📤 Exportieren';
    resetBtn.addEventListener('click',()=>{ if(confirm('Alle Daten löschen?')){localStorage.clear();location.reload();}});
    exportBtn.addEventListener('click',()=>{
      const blob=new Blob([localStorage.getItem(Config.STORAGE_KEY)||'{}'],{type:'application/json'});
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='webos-export.json'; a.click();
    });
    r.append(resetBtn,exportBtn); content.appendChild(r);
  }

  function _makeToggle(initialVal, onChange){
    const toggle=document.createElement('label'); toggle.className='toggle';
    const inp=document.createElement('input'); inp.type='checkbox'; inp.checked=initialVal;
    const track=document.createElement('div'); track.className='toggle-track';
    const thumb=document.createElement('div'); thumb.className='toggle-thumb';
    toggle.append(inp,track,thumb);
    inp.addEventListener('change',()=>onChange(inp.checked));
    return toggle;
  }

  showSection(0);
  wrap.append(sidebar,content);
  WindowManager.create({id:wid,title:'⚙️ Einstellungen',app:'settings',width:660,height:500,content:wrap});
}

/* ═══════════════════════════════════════════════════
   APP: TRASH
═══════════════════════════════════════════════════ */
AppManager.register('trash', { open: opts => _openTrash(opts) });

function _openTrash(opts={}) {
  const wid='trash';
  if(WindowManager.getWin(wid)){WindowManager.focus(wid);return;}
  const wrap=document.createElement('div'); wrap.className='trash-layout';

  const toolbar=document.createElement('div'); toolbar.className='trash-toolbar';
  const emptyBtn=document.createElement('button'); emptyBtn.className='trash-btn danger'; emptyBtn.textContent='🗑️ Leeren';
  const info=document.createElement('span'); info.style.cssText='flex:1;color:rgba(255,255,255,0.4);font-size:12px';
  toolbar.append(emptyBtn,info);

  const list=document.createElement('div'); list.className='trash-list';
  const statusbar=document.createElement('div'); statusbar.className='trash-statusbar';
  wrap.append(toolbar,list,statusbar);

  function render(){
    list.innerHTML='';
    const trash=State.get().trash;
    info.textContent=`${trash.length} Objekte im Papierkorb`;
    statusbar.textContent=`${trash.length} Elemente`;
    if(!trash.length){
      list.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;color:rgba(255,255,255,0.25);gap:12px"><div style="font-size:56px;opacity:.25">🗑️</div><p style="font-size:13px">Der Papierkorb ist leer</p></div>';
      return;
    }
    trash.forEach(t=>{
      const item=document.createElement('div'); item.className='trash-item';
      const icon=t.node.type==='folder'?'📁':(t.node.icon||'📄');
      item.innerHTML=`<span class="ti-icon">${icon}</span>
        <div class="ti-info"><div class="ti-name">${t.node.name}</div><div class="ti-date">Gelöscht: ${t.deletedAt||'—'}</div></div>
        <button class="ti-restore">↩ Wiederherstellen</button>`;
      item.querySelector('.ti-restore').addEventListener('click',()=>{
        FileSystem.restoreFromTrash(t.id); render();
        Toast.show(`"${t.node.name}" wiederhergestellt`,'↩');
      });
      list.appendChild(item);
    });
  }

  emptyBtn.addEventListener('click',()=>{
    if(!confirm('Papierkorb wirklich leeren?')) return;
    FileSystem.emptyTrash(); render(); Toast.show('Papierkorb geleert','🗑️');
  });

  render();
  WindowManager.create({id:wid,title:'🗑️ Papierkorb',app:'trash',width:500,height:420,content:wrap});
}

/* ═══════════════════════════════════════════════════
   MODULE: KEYBOARD SHORTCUTS
═══════════════════════════════════════════════════ */
const Keyboard = (() => {
  function init() {
    document.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Cmd/Ctrl + W → close focused window
      if (ctrl && e.key === 'w') { e.preventDefault(); WindowManager.closeFocused(); return; }

      // Cmd/Ctrl + Tab → cycle focus
      if (ctrl && e.key === 'Tab') { e.preventDefault(); WindowManager.cycleFocus(); return; }

      // Ctrl + Space → desktop switcher
      if (e.ctrlKey && e.key === ' ') { e.preventDefault(); DesktopManager.toggleSwitcher(); return; }

      // Ctrl + → → next desktop
      if (e.ctrlKey && e.key === 'ArrowRight') { e.preventDefault(); DesktopManager.switchTo(DesktopManager.getCurrent()+1); return; }

      // Ctrl + ← → prev desktop
      if (e.ctrlKey && e.key === 'ArrowLeft')  { e.preventDefault(); DesktopManager.switchTo(DesktopManager.getCurrent()-1); return; }

      // Ctrl + Shift + → → add desktop
      if (e.ctrlKey && e.shiftKey && e.key === 'ArrowRight') { e.preventDefault(); DesktopManager.addDesktop(); return; }
    });
  }
  return { init };
})();

/* ═══════════════════════════════════════════════════
   MODULE: CLOCK
═══════════════════════════════════════════════════ */
function startClock() {
  const mbClock    = document.getElementById('menubar-clock');
  const loginTime  = document.getElementById('login-time');
  const loginDate  = document.getElementById('login-date');
  const DAYS   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  function update() {
    const now = new Date();
    const h   = String(now.getHours()).padStart(2,'0');
    const m   = String(now.getMinutes()).padStart(2,'0');
    if (mbClock)   mbClock.textContent = `${h}:${m}`;
    if (loginTime) loginTime.textContent = `${h}:${m}`;
    if (loginDate) loginDate.textContent = `${DAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}`;
  }
  update();
  setInterval(update, 15000);
}

/* ═══════════════════════════════════════════════════
   MODULE: LOGIN
═══════════════════════════════════════════════════ */
function initLogin() {
  const loginScreen = document.getElementById('login-screen');
  const pwInput     = document.getElementById('login-pw');
  const loginBtn    = document.getElementById('login-btn');
  const errorEl     = document.getElementById('login-error');

  function tryLogin() {
    const val = pwInput.value.trim();
    if (val === '' || val === Config.LOGIN_PASSWORD) {
      loginScreen.classList.add('fade-out');
      loginScreen.addEventListener('transitionend', () => loginScreen.remove(), { once:true });
      startOS();
    } else {
      errorEl.classList.remove('hidden');
      pwInput.value=''; pwInput.classList.add('shake');
      setTimeout(()=>pwInput.classList.remove('shake'),400);
    }
  }

  loginBtn.addEventListener('click', tryLogin);
  pwInput.addEventListener('keydown', e => { if(e.key==='Enter') tryLogin(); });
  pwInput.focus();
}

/* ═══════════════════════════════════════════════════
   BOOT SEQUENCE
═══════════════════════════════════════════════════ */
function startOS() {
  const shell = document.getElementById('os-shell');
  shell.classList.remove('hidden');
  requestAnimationFrame(() => { requestAnimationFrame(() => shell.classList.add('visible')); });

  Toast.init();
  Theme.init();
  ContextMenu.init();
  Permissions.init();
  SnapManager.init();
  DockManager.init();
  DesktopManager.init();
  Keyboard.init();
  startClock();

  setTimeout(() => {
    Toast.showInteractive({
      title: 'Willkommen bei WebOS 2.0!',
      icon: '👋',
      msg: 'Alles bereit. Viel Spaß!',
      duration: 4000,
      actions: [{ label:'Notizen öffnen', primary:true, cb:() => AppManager.open('editor',{fileId:'note1',node:FileSystem.getNode('note1')}) }]
    });
  }, 600);
}

function boot() {
  State.load();
  startClock();

  const bootScreen = document.getElementById('boot-screen');
  setTimeout(() => {
    bootScreen.classList.add('fade-out');
    bootScreen.addEventListener('transitionend', () => {
      bootScreen.remove();
      initLogin();
    }, { once:true });
  }, 1600);
}

document.addEventListener('DOMContentLoaded', boot);
