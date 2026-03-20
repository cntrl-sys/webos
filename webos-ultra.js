/* =====================================================
   WebOS Ultra — webos-ultra.js
   Command Palette · Smart Search · App Builder
   3D Mode · Parallax · Physics · Collaboration
   Personality · Screen Record · Performance
   ===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   MODULE: COMMAND PALETTE  (Ctrl+K)
═══════════════════════════════════════════════════ */
const CommandPalette = (() => {
  let overlay, input, results;
  let open = false, selIdx = 0;
  let items = [];

  // All commands — extend freely
  const STATIC_COMMANDS = [
    { icon:'📁', title:'Finder öffnen',           desc:'Dateisystem durchsuchen',        group:'Apps',        action:()=>AppManager.open('finder') },
    { icon:'✏️', title:'Texteditor öffnen',        desc:'Neue Notiz erstellen',           group:'Apps',        action:()=>AppManager.open('editor') },
    { icon:'🌐', title:'Browser öffnen',           desc:'Im Web surfen',                  group:'Apps',        action:()=>AppManager.open('browser2') },
    { icon:'💻', title:'Terminal öffnen',          desc:'Befehle eingeben',               group:'Apps',        action:()=>AppManager.open('terminal') },
    { icon:'🎮', title:'Spielecenter öffnen',      desc:'Alle Spiele',                    group:'Apps',        action:()=>AppManager.open('games') },
    { icon:'🤖', title:'AI Assistent öffnen',      desc:'Fragen stellen',                 group:'Apps',        action:()=>AppManager.open('ai') },
    { icon:'📊', title:'Task Manager öffnen',      desc:'Prozesse verwalten',             group:'Apps',        action:()=>AppManager.open('taskmanager') },
    { icon:'🏪', title:'App Store öffnen',         desc:'Neue Apps finden',               group:'Apps',        action:()=>AppManager.open('appstore') },
    { icon:'🧩', title:'Plugins öffnen',           desc:'Erweiterungen verwalten',        group:'Apps',        action:()=>AppManager.open('plugins') },
    { icon:'⚡', title:'SDK öffnen',               desc:'Apps entwickeln',                group:'Apps',        action:()=>AppManager.open('sdk') },
    { icon:'🏗️', title:'App Builder öffnen',       desc:'Apps visuell erstellen',         group:'Apps',        action:()=>AppManager.open('appbuilder') },
    { icon:'☁️', title:'Cloud öffnen',             desc:'Dateien synchronisieren',        group:'Apps',        action:()=>AppManager.open('cloud') },
    { icon:'👤', title:'Profil öffnen',            desc:'Account bearbeiten',             group:'Apps',        action:()=>AppManager.open('profile') },
    { icon:'⚙️', title:'Einstellungen öffnen',     desc:'System konfigurieren',           group:'Apps',        action:()=>AppManager.open('settings') },
    { icon:'🏆', title:'Erfolge öffnen',           desc:'Freigeschaltete Erfolge',        group:'Apps',        action:()=>AppManager.open('achievements') },
    // Themes
    { icon:'🌙', title:'Theme: Dark',              desc:'Dunkles Design',                 group:'Design',      action:()=>{ if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('dark'); } },
    { icon:'☀️', title:'Theme: Hell',              desc:'Helles Design',                  group:'Design',      action:()=>{ if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('light'); } },
    { icon:'💚', title:'Theme: Neon',              desc:'Grünes Neon-Design',             group:'Design',      action:()=>{ if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('neon'); } },
    { icon:'🪟', title:'Theme: Glass',             desc:'Transparentes Design',           group:'Design',      action:()=>{ if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('glass'); } },
    { icon:'🎨', title:'Gradient-Editor öffnen',   desc:'Eigenen Hintergrund erstellen',  group:'Design',      action:()=>AppManager.open('settings') },
    // System
    { icon:'📸', title:'Screenshot (simuliert)',   desc:'Desktop aufnehmen',              group:'System',      action:()=>Toast.show('Screenshot gespeichert','📸') },
    { icon:'🔒', title:'Bildschirm sperren',        desc:'Sitzung sperren',               group:'System',      action:()=>{ if(typeof LiveActivity!=='undefined')LiveActivity.showActivity('🔒','Bildschirm gesperrt'); } },
    { icon:'⏱️', title:'Time Warp',                desc:'Zeit manipulieren',              group:'System',      action:()=>{ if(typeof TimeWarp!=='undefined')TimeWarp.activate('slow'); } },
    { icon:'💥', title:'Fenster fallen lassen',    desc:'Physik-Modus aktivieren',        group:'Fun',         action:()=>{ if(typeof PhysicsMode!=='undefined')PhysicsMode.activate(); } },
    { icon:'🎉', title:'Party Mode',               desc:'Farben-Party!',                  group:'Fun',         action:()=>{ window.__terminalPlugins?.party?.([],(m)=>{}); } },
  ];

  function init() {
    overlay = document.createElement('div');
    overlay.id = 'cmd-palette-overlay';
    overlay.innerHTML = `
      <div class="cmd-palette-card">
        <div class="cmd-input-row">
          <span class="cmd-icon">⌘</span>
          <input class="cmd-input" id="cmd-input" placeholder="Suchen, öffnen, ausführen…" autocomplete="off" spellcheck="false"/>
          <span class="cmd-hint">ESC zum Schließen</span>
        </div>
        <div class="cmd-results" id="cmd-results"></div>
        <div class="cmd-footer">
          <span class="cmd-footer-hint"><span class="cmd-footer-key">↑↓</span> Navigieren</span>
          <span class="cmd-footer-hint"><span class="cmd-footer-key">↵</span> Ausführen</span>
          <span class="cmd-footer-hint"><span class="cmd-footer-key">ESC</span> Schließen</span>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    input   = overlay.querySelector('#cmd-input');
    results = overlay.querySelector('#cmd-results');

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    input.addEventListener('input', render);
    input.addEventListener('keydown', _handleKey);

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); open ? close() : show(); }
    });
  }

  function show() {
    open = true; overlay.classList.add('open');
    input.value = ''; selIdx = 0;
    requestAnimationFrame(() => input.focus());
    render();
  }

  function close() {
    open = false; overlay.classList.remove('open');
  }

  function _buildItems(query) {
    const q = query.toLowerCase().trim();
    let cmds = [...STATIC_COMMANDS];

    // Add open windows to list
    WindowManager.getAllWins().forEach((w, id) => {
      cmds.push({ icon:'🪟', title:`Fokussieren: ${w.title.replace(/^[^\s]+\s/,'')}`, desc:'Laufendes Fenster', group:'Fenster', action:()=>WindowManager.focus(id) });
    });

    // Add filesystem entries
    if (q.length >= 2) {
      const fs = FileSystem.get();
      Object.entries(fs).slice(0, 30).forEach(([id, node]) => {
        if (node?.name?.toLowerCase().includes(q)) {
          cmds.push({ icon: node.icon || FileSystem.iconForExt(node.ext), title: node.name, desc: FileSystem.getPathString(id), group:'Dateien',
            action:()=>{ const ext=(node.ext||'').toLowerCase(); if(['txt','md','js'].includes(ext))AppManager.open('editor',{fileId:id,node}); else if(['jpg','png'].includes(ext))AppManager.open('imageviewer',{fileId:id,node}); } });
        }
      });
    }

    if (!q) return cmds.slice(0, 12);
    return cmds.filter(c => c.title.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }

  function render() {
    items = _buildItems(input.value);
    selIdx = 0;
    results.innerHTML = '';
    if (!items.length) { results.innerHTML = '<div class="cmd-empty">Keine Ergebnisse gefunden</div>'; return; }

    const groups = {};
    items.forEach(item => { (groups[item.group] = groups[item.group] || []).push(item); });
    let globalIdx = 0;
    Object.entries(groups).forEach(([grp, grpItems]) => {
      const gt = document.createElement('div'); gt.className = 'cmd-section-title'; gt.textContent = grp;
      results.appendChild(gt);
      grpItems.forEach(item => {
        const idx = globalIdx++;
        const el  = document.createElement('div'); el.className = `cmd-item${idx===0?' selected':''}`;
        el.dataset.idx = idx;
        el.innerHTML = `<span class="cmd-item-icon">${item.icon}</span><div class="cmd-item-body"><div class="cmd-item-title">${item.title}</div><div class="cmd-item-desc">${item.desc}</div></div>`;
        el.addEventListener('click', () => { item.action(); close(); });
        el.addEventListener('mouseenter', () => _select(idx));
        results.appendChild(el);
      });
    });
  }

  function _select(idx) {
    selIdx = idx;
    results.querySelectorAll('.cmd-item').forEach((el, i) => el.classList.toggle('selected', i===idx));
    results.querySelector('.cmd-item.selected')?.scrollIntoView({ block:'nearest' });
  }

  function _handleKey(e) {
    const count = results.querySelectorAll('.cmd-item').length;
    if (e.key === 'ArrowDown') { e.preventDefault(); _select((selIdx+1)%count); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _select((selIdx-1+count)%count); }
    if (e.key === 'Enter')     { e.preventDefault(); items[selIdx]?.action(); close(); }
    if (e.key === 'Escape')    close();
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════
   APP: SMART SEARCH
═══════════════════════════════════════════════════ */
AppManager.register('search', { open: opts => _openSmartSearch(opts) });

function _openSmartSearch(opts = {}) {
  const wid = 'smartsearch';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'smart-search-layout';
  const row  = document.createElement('div'); row.className = 'ss-search-row';
  const inp  = document.createElement('input'); inp.className = 'ss-input';
  inp.placeholder = '🔍 Alles durchsuchen: Apps, Dateien, Spiele, Befehle…';
  inp.value = opts.q || '';
  row.appendChild(inp);
  const res = document.createElement('div'); res.className = 'ss-results';
  wrap.append(row, res);

  function search(q) {
    res.innerHTML = '';
    if (!q.trim()) { res.innerHTML = '<div class="ss-empty"><div style="font-size:48px;opacity:.2">🔍</div><p>Tippe etwas ein um zu suchen</p></div>'; return; }
    const ql = q.toLowerCase();
    const sections = [];

    // Apps
    const APP_CATALOG = [
      {id:'finder',icon:'📁',name:'Finder',desc:'Dateisystem'},
      {id:'browser2',icon:'🌐',name:'Browser',desc:'Web-Browser'},
      {id:'terminal',icon:'💻',name:'Terminal',desc:'Befehlszeile'},
      {id:'calculator',icon:'🔢',name:'Rechner',desc:'Taschenrechner'},
      {id:'editor',icon:'✏️',name:'Texteditor',desc:'Notizen'},
      {id:'musicplayer',icon:'🎵',name:'Musik',desc:'Musik-Player'},
      {id:'ai',icon:'🤖',name:'AI Assistent',desc:'KI-Assistent'},
      {id:'appbuilder',icon:'🏗️',name:'App Builder',desc:'Apps erstellen'},
      {id:'plugins',icon:'🧩',name:'Plugins',desc:'Erweiterungen'},
      {id:'sdk',icon:'⚡',name:'SDK',desc:'Developer Tool'},
      {id:'settings',icon:'⚙️',name:'Einstellungen',desc:'System'},
      {id:'cloud',icon:'☁️',name:'Cloud',desc:'Dateispeicher'},
      {id:'taskmanager',icon:'📊',name:'Task Manager',desc:'Prozesse'},
      {id:'chat',icon:'💬',name:'Chat',desc:'Kommunikation'},
      {id:'achievements',icon:'🏆',name:'Erfolge',desc:'Fortschritt'},
    ].filter(a => a.name.toLowerCase().includes(ql) || a.desc.toLowerCase().includes(ql));
    if (APP_CATALOG.length) {
      sections.push({ title:'Apps', items: APP_CATALOG.map(a => ({ icon:a.icon, title:a.name, desc:a.desc, action:()=>AppManager.open(a.id) })) });
    }

    // Files
    const fs = FileSystem.get();
    const fileMatches = Object.entries(fs).filter(([id,n]) => n?.name?.toLowerCase().includes(ql)).slice(0,5)
      .map(([id,n]) => ({ icon:n.icon||FileSystem.iconForExt(n.ext), title:n.name, desc:FileSystem.getPathString(id),
        action:()=>{ const ext=(n.ext||'').toLowerCase(); if(['txt','md','js','json'].includes(ext))AppManager.open('editor',{fileId:id,node:n}); else if(['jpg','png'].includes(ext))AppManager.open('imageviewer',{fileId:id,node:n}); }}));
    if (fileMatches.length) sections.push({ title:'Dateien', items: fileMatches });

    // Games (if GameManager available)
    if (typeof GameManager !== 'undefined') {
      const games = GameManager.getAllGames().filter(g => g.title.toLowerCase().includes(ql) || g.category.toLowerCase().includes(ql)).slice(0,3)
        .map(g => ({ icon:g.icon, title:g.title, desc:g.category, action:()=>GameManager.launchGame(g.id) }));
      if (games.length) sections.push({ title:'Spiele', items: games });
    }

    // Settings shortcuts
    const SETTINGS = [
      {title:'Dark Mode',desc:'Design: Dunkel',action:()=>{if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('dark');}},
      {title:'Neon Theme',desc:'Design: Neon',action:()=>{if(typeof ThemeSystem!=='undefined')ThemeSystem.apply('neon');}},
      {title:'FPS anzeigen',desc:'Performance',action:()=>{if(typeof FPSCounter!=='undefined')FPSCounter.toggle();}},
    ].filter(s => s.title.toLowerCase().includes(ql));
    if (SETTINGS.length) sections.push({ title:'Einstellungen', items: SETTINGS.map(s=>({icon:'⚙️',...s})) });

    if (!sections.length) { res.innerHTML = '<div class="ss-empty"><div style="font-size:48px;opacity:.2">🔍</div><p>Keine Ergebnisse für "'+q+'"</p></div>'; return; }

    sections.forEach(sec => {
      const t = document.createElement('div'); t.className = 'ss-result-group-title'; t.textContent = sec.title;
      res.appendChild(t);
      sec.items.forEach(item => {
        const el = document.createElement('div'); el.className = 'ss-result-item';
        el.innerHTML = `<span class="ss-item-icon">${item.icon}</span><div class="ss-item-body"><div class="ss-item-title">${item.title}</div><div class="ss-item-desc">${item.desc}</div></div><button class="ss-item-action">Öffnen</button>`;
        el.querySelector('.ss-item-action').addEventListener('click', ()=>{ item.action(); SoundSystem?.play('click'); });
        el.addEventListener('dblclick', ()=>item.action());
        res.appendChild(el);
      });
    });
  }

  inp.addEventListener('input', e => search(e.target.value));
  inp.addEventListener('keydown', e => { if (e.key==='Enter') search(inp.value); });
  search(opts.q || '');

  const winEl = WindowManager.create({ id:wid, title:'🔍 Smart Search', app:'search', width:620, height:520, content:wrap });
  setTimeout(() => inp.focus(), 100);
}

/* ═══════════════════════════════════════════════════
   APP: APP BUILDER — Visual No-Code Editor
═══════════════════════════════════════════════════ */
AppManager.register('appbuilder', { open: opts => _openAppBuilder(opts) });

function _openAppBuilder(opts = {}) {
  const wid = 'appbuilder_' + Date.now();
  const wrap = document.createElement('div'); wrap.className = 'appbuilder-layout';

  // ── Left sidebar: component palette ─────────────
  const sideLeft = document.createElement('div'); sideLeft.className = 'ab-sidebar-left';
  sideLeft.innerHTML = '<div class="ab-sidebar-title">🧩 Komponenten</div>';

  const COMPONENTS = [
    { type:'button',  icon:'🔘', label:'Button',    defaults:{ text:'Klick mich', bg:'#0a84ff', color:'#fff', w:120, h:42, radius:10 } },
    { type:'text',    icon:'📝', label:'Text',       defaults:{ text:'Hallo Welt', color:'#fff', size:16, w:200, h:36 } },
    { type:'input',   icon:'✏️', label:'Eingabe',    defaults:{ placeholder:'Eingabe…', bg:'rgba(255,255,255,.1)', color:'#fff', w:200, h:38, radius:8 } },
    { type:'card',    icon:'🗂️', label:'Karte',      defaults:{ bg:'rgba(255,255,255,.08)', radius:12, w:240, h:120 } },
    { type:'image',   icon:'🖼️', label:'Bild',       defaults:{ src:'https://picsum.photos/seed/app/240/120', w:240, h:120, radius:8 } },
    { type:'divider', icon:'─',  label:'Trennlinie', defaults:{ color:'rgba(255,255,255,.15)', w:200, h:2 } },
    { type:'list',    icon:'📋', label:'Liste',      defaults:{ items:'Element 1\nElement 2\nElement 3', bg:'rgba(255,255,255,.06)', w:220, h:140, radius:10 } },
    { type:'badge',   icon:'🏷️', label:'Badge',      defaults:{ text:'NEU', bg:'#30d158', color:'#fff', w:60, h:28, radius:14 } },
  ];

  COMPONENTS.forEach(comp => {
    const el = document.createElement('div'); el.className = 'ab-component';
    el.draggable = true;
    el.innerHTML = `<span class="ab-comp-icon">${comp.icon}</span>${comp.label}`;
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('comp-type', comp.type); e.dataTransfer.effectAllowed='copy'; });
    el.addEventListener('click', () => _addElement(comp, { x: 40 + Math.random()*100, y: 40 + Math.random()*80 }));
    sideLeft.appendChild(el);
  });

  // ── Center canvas ───────────────────────────────
  const canvasWrap = document.createElement('div'); canvasWrap.className = 'ab-canvas-wrap';
  const cToolbar   = document.createElement('div'); cToolbar.className = 'ab-canvas-toolbar';
  const appName    = document.createElement('input'); appName.className = 'ab-app-name'; appName.value = 'Meine App'; appName.placeholder = 'App-Name…';
  const clearBtn   = document.createElement('button'); clearBtn.className = 'ab-toolbar-btn'; clearBtn.textContent = '🗑️ Leeren';
  const previewBtn = document.createElement('button'); previewBtn.className = 'ab-toolbar-btn'; previewBtn.textContent = '▶ Vorschau';
  const exportBtn  = document.createElement('button'); exportBtn.className = 'ab-toolbar-btn primary'; exportBtn.textContent = '📦 Als App speichern';
  cToolbar.append(appName, clearBtn, previewBtn, exportBtn);

  const canvas = document.createElement('div'); canvas.className = 'ab-canvas';
  canvas.innerHTML = '<div class="ab-drop-hint"><div class="ab-drop-hint-icon">🧩</div><p>Ziehe Komponenten hier rein<br>oder klicke sie an</p></div>';
  canvasWrap.append(cToolbar, canvas);

  // ── Right sidebar: properties ───────────────────
  const sideRight = document.createElement('div'); sideRight.className = 'ab-sidebar-right';
  sideRight.innerHTML = '<div class="ab-sidebar-title">🎛️ Eigenschaften</div><div class="ab-props-empty">Wähle eine Komponente aus</div>';

  wrap.append(sideLeft, canvasWrap, sideRight);

  // ── State ───────────────────────────────────────
  const elements = []; // {id, type, el, props}
  let selectedEl = null;

  // ── Drop onto canvas ────────────────────────────
  canvas.addEventListener('dragover',  e => { e.preventDefault(); canvas.classList.add('dragover'); });
  canvas.addEventListener('dragleave', ()=> canvas.classList.remove('dragover'));
  canvas.addEventListener('drop', e => {
    e.preventDefault(); canvas.classList.remove('dragover');
    const type = e.dataTransfer.getData('comp-type'); if (!type) return;
    const comp = COMPONENTS.find(c => c.type === type); if (!comp) return;
    const rect = canvas.getBoundingClientRect();
    _addElement(comp, { x: e.clientX - rect.left - 60, y: e.clientY - rect.top - 20 });
  });
  canvas.addEventListener('click', e => { if (e.target === canvas) { _deselect(); } });

  function _addElement(comp, pos) {
    canvas.querySelector('.ab-drop-hint')?.remove();
    const id    = 'el_' + Date.now();
    const props = { ...comp.defaults, x: Math.max(0, pos.x || 40), y: Math.max(0, pos.y || 40), action:'none', actionArg:'' };
    const el    = document.createElement('div');
    el.className = 'ab-element'; el.dataset.elId = id;
    _applyProps(el, comp.type, props);
    el.style.left = props.x + 'px'; el.style.top = props.y + 'px';
    el.style.width = props.w + 'px'; el.style.height = props.h + 'px';

    const handle = document.createElement('div'); handle.className = 'ab-element-handle';
    const resize = document.createElement('div'); resize.className = 'ab-resize-handle';
    el.append(handle, resize);

    _makeDraggableEl(el, props);
    _makeResizableEl(el, resize, props);
    el.addEventListener('click', e => { e.stopPropagation(); _select(id, comp, props); });

    canvas.appendChild(el);
    elements.push({ id, type: comp.type, el, props });
    _select(id, comp, props);
    SoundSystem?.play('click');
  }

  function _applyProps(el, type, props) {
    el.style.width   = (props.w||100) + 'px';
    el.style.height  = (props.h||40) + 'px';
    el.style.borderRadius = (props.radius||0) + 'px';

    if (type==='button') {
      el.innerHTML = `<button style="width:100%;height:100%;border:none;background:${props.bg||'#0a84ff'};color:${props.color||'#fff'};border-radius:${props.radius||10}px;font-size:${props.size||14}px;cursor:pointer;font-family:var(--font,sans-serif);font-weight:600;">${props.text||'Button'}</button>`;
      el.querySelector('button').onclick = e => { e.stopPropagation(); };
    } else if (type==='text') {
      el.style.cssText += `;color:${props.color||'#fff'};font-size:${props.size||16}px;display:flex;align-items:center;padding:4px 0;`;
      el.childNodes.forEach(n => { if(n.nodeType===3||n.tagName==='SPAN')n.remove?.(); });
      const span = document.createElement('span'); span.textContent=props.text||'Text'; el.appendChild(span);
    } else if (type==='input') {
      el.innerHTML = `<input placeholder="${props.placeholder||'…'}" style="width:100%;height:100%;background:${props.bg||'rgba(255,255,255,.1)'};border:1px solid rgba(255,255,255,.2);border-radius:${props.radius||8}px;color:${props.color||'#fff'};padding:0 12px;outline:none;font-size:14px;box-sizing:border-box;font-family:var(--font,sans-serif);" onclick="event.stopPropagation()"/>`;
    } else if (type==='card') {
      el.style.cssText += `;background:${props.bg||'rgba(255,255,255,.08)'};border-radius:${props.radius||12}px;border:1px solid rgba(255,255,255,.1);`;
    } else if (type==='image') {
      el.innerHTML = `<img src="${props.src}" style="width:100%;height:100%;object-fit:cover;border-radius:${props.radius||8}px;" draggable="false"/>`;
    } else if (type==='divider') {
      el.style.cssText += `;background:${props.color||'rgba(255,255,255,.15)'};height:${props.h||2}px;`;
    } else if (type==='list') {
      const items = (props.items||'').split('\n').filter(Boolean);
      el.style.cssText += `;background:${props.bg||'rgba(255,255,255,.06)'};border-radius:${props.radius||10}px;overflow:hidden;display:flex;flex-direction:column;`;
      el.innerHTML = items.map(i=>`<div style="padding:8px 14px;color:rgba(255,255,255,.8);font-size:13px;border-bottom:1px solid rgba(255,255,255,.05);cursor:default">${i}</div>`).join('');
    } else if (type==='badge') {
      el.style.cssText += `;background:${props.bg||'#30d158'};color:${props.color||'#fff'};border-radius:${props.radius||14}px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;`;
      el.textContent = props.text||'Badge';
    }
  }

  function _makeDraggableEl(el, props) {
    let sx,sy,sl,st,drag=false;
    el.addEventListener('mousedown', e => {
      if (e.target.tagName==='INPUT'||e.target.tagName==='BUTTON') return;
      drag=true; sx=e.clientX; sy=e.clientY; sl=parseInt(el.style.left)||0; st=parseInt(el.style.top)||0; e.stopPropagation();
    });
    document.addEventListener('mousemove', e => {
      if (!drag) return;
      const nx=Math.max(0,sl+(e.clientX-sx)), ny=Math.max(0,st+(e.clientY-sy));
      el.style.left=nx+'px'; el.style.top=ny+'px'; props.x=nx; props.y=ny;
    });
    document.addEventListener('mouseup', () => { drag=false; });
  }

  function _makeResizableEl(el, handle, props) {
    let sx,sy,sw,sh,resizing=false;
    handle.addEventListener('mousedown', e => { resizing=true;sx=e.clientX;sy=e.clientY;sw=el.offsetWidth;sh=el.offsetHeight;e.stopPropagation();e.preventDefault(); });
    document.addEventListener('mousemove', e => {
      if (!resizing) return;
      const nw=Math.max(40,sw+(e.clientX-sx)), nh=Math.max(24,sh+(e.clientY-sy));
      el.style.width=nw+'px';el.style.height=nh+'px';props.w=nw;props.h=nh;
    });
    document.addEventListener('mouseup', () => { resizing=false; });
  }

  function _select(id, comp, props) {
    _deselect();
    const entry = elements.find(e => e.id===id); if (!entry) return;
    selectedEl = entry;
    entry.el.classList.add('selected');
    _renderProps(comp, props, entry);
  }

  function _deselect() {
    elements.forEach(e => e.el.classList.remove('selected'));
    selectedEl = null;
    sideRight.innerHTML = '<div class="ab-sidebar-title">🎛️ Eigenschaften</div><div class="ab-props-empty">Wähle eine Komponente aus</div>';
  }

  function _renderProps(comp, props, entry) {
    sideRight.innerHTML = '<div class="ab-sidebar-title">🎛️ Eigenschaften</div>';
    const ALL_PROPS = [
      { key:'text', label:'Text', type:'text', show:['button','text','badge','list'] },
      { key:'bg', label:'Hintergrund', type:'color', show:['button','card','input','list','badge'] },
      { key:'color', label:'Textfarbe', type:'color', show:['button','text','input','badge'] },
      { key:'size', label:'Schriftgröße', type:'number', show:['text'] },
      { key:'radius', label:'Ecken', type:'number', show:['button','card','input','image','list','badge'] },
      { key:'src', label:'Bild-URL', type:'text', show:['image'] },
      { key:'placeholder', label:'Platzhalter', type:'text', show:['input'] },
      { key:'w', label:'Breite', type:'number', show:['button','text','card','input','image','divider','list','badge'] },
      { key:'h', label:'Höhe', type:'number', show:['button','text','card','input','image','list','badge'] },
    ];

    const geomSec = document.createElement('div'); geomSec.className = 'ab-prop-section';
    geomSec.innerHTML = '<div class="ab-prop-section-title">Layout</div>';
    ['x','y','w','h','radius'].forEach(k => {
      const row = document.createElement('div'); row.className='ab-prop-row';
      row.innerHTML=`<span class="ab-prop-label">${{x:'Links',y:'Oben',w:'Breite',h:'Höhe',radius:'Ecken'}[k]}</span>`;
      const inp=document.createElement('input'); inp.className='ab-prop-input';inp.type='number';inp.value=props[k]||0;
      inp.addEventListener('input',()=>{ props[k]=+inp.value; _applyProps(entry.el,entry.type,props); });
      row.appendChild(inp);geomSec.appendChild(row);
    });
    sideRight.appendChild(geomSec);

    const contentSec = document.createElement('div'); contentSec.className='ab-prop-section';
    contentSec.innerHTML='<div class="ab-prop-section-title">Inhalt</div>';
    ALL_PROPS.filter(p=>p.show.includes(entry.type)).forEach(pd=>{
      const row=document.createElement('div');row.className='ab-prop-row';
      row.innerHTML=`<span class="ab-prop-label">${pd.label}</span>`;
      if (pd.type==='color') {
        const inp=document.createElement('input');inp.type='color';inp.className='ab-prop-color';
        try{inp.value=props[pd.key]||'#ffffff';}catch{}
        inp.addEventListener('input',()=>{props[pd.key]=inp.value;_applyProps(entry.el,entry.type,props);});
        row.appendChild(inp);
      } else {
        const inp=document.createElement('input');inp.className='ab-prop-input';inp.type=pd.type;inp.value=props[pd.key]||'';
        inp.addEventListener('input',()=>{props[pd.key]=pd.type==='number'?+inp.value:inp.value;_applyProps(entry.el,entry.type,props);});
        row.appendChild(inp);
      }
      contentSec.appendChild(row);
    });
    sideRight.appendChild(contentSec);

    // Action
    const actSec=document.createElement('div');actSec.className='ab-prop-section';
    actSec.innerHTML='<div class="ab-prop-section-title">Aktion (bei Klick)</div>';
    const actRow=document.createElement('div');actRow.className='ab-prop-row';
    const actSel=document.createElement('select');actSel.className='ab-prop-select';
    actSel.innerHTML='<option value="none">Nichts</option><option value="alert">Meldung zeigen</option><option value="open_app">App öffnen</option><option value="toast">Toast zeigen</option>';
    actSel.value=props.action||'none';
    actSel.addEventListener('change',()=>props.action=actSel.value);
    actRow.appendChild(actSel);actSec.appendChild(actRow);
    const argRow=document.createElement('div');argRow.className='ab-prop-row';
    argRow.innerHTML='<span class="ab-prop-label">Argument</span>';
    const argInp=document.createElement('input');argInp.className='ab-prop-input';argInp.placeholder='App-ID / Nachricht';argInp.value=props.actionArg||'';
    argInp.addEventListener('input',()=>props.actionArg=argInp.value);
    argRow.appendChild(argInp);actSec.appendChild(argRow);

    // Delete button
    const delBtn=document.createElement('button');delBtn.className='ab-toolbar-btn';delBtn.style.cssText='margin:10px 14px;color:#ff453a;border-color:rgba(255,69,58,.3);';delBtn.textContent='🗑️ Löschen';
    delBtn.addEventListener('click',()=>{entry.el.remove();elements.splice(elements.indexOf(entry),1);_deselect();});
    actSec.appendChild(delBtn);
    sideRight.append(contentSec,actSec);
  }

  // ── Wire toolbar buttons ────────────────────────
  clearBtn.addEventListener('click', ()=>{ canvas.innerHTML='<div class="ab-drop-hint"><div class="ab-drop-hint-icon">🧩</div><p>Ziehe Komponenten hier rein</p></div>'; elements.length=0; _deselect(); });

  previewBtn.addEventListener('click', ()=>{
    const previewWid='ab_preview_'+Date.now();
    const pw=document.createElement('div');pw.style.cssText='position:relative;width:100%;height:100%;background:rgba(10,10,20,.95);overflow:hidden;';
    elements.forEach(entry=>{
      const clone=entry.el.cloneNode(true);
      clone.querySelectorAll('.ab-element-handle,.ab-resize-handle').forEach(h=>h.remove());
      clone.classList.remove('selected');
      const p=entry.props;
      if (p.action==='alert')    clone.addEventListener('click',()=>alert(p.actionArg||'Aktion!'));
      if (p.action==='open_app') clone.addEventListener('click',()=>AppManager.open(p.actionArg||'finder'));
      if (p.action==='toast')    clone.addEventListener('click',()=>Toast.show(p.actionArg||'Nachricht','ℹ️'));
      pw.appendChild(clone);
    });
    WindowManager.create({id:previewWid,title:'▶ Vorschau: '+appName.value,app:'preview',width:500,height:420,content:pw});
  });

  exportBtn.addEventListener('click', ()=>{
    const name=appName.value.trim()||'Meine App';
    const appId='custom_'+name.replace(/\s+/g,'_').toLowerCase()+'_'+Date.now();
    // Generate plugin code
    const elCode = elements.map(entry=>{
      const p=entry.props;
      let html='';
      if(entry.type==='button') html='<button style="padding:0 16px;height:'+p.h+'px;border:none;background:'+p.bg+';color:'+p.color+';border-radius:'+p.radius+'px;cursor:pointer;font-size:14px;">'+p.text+'</button>';
      else if(entry.type==='text') html='<div style="color:'+p.color+';font-size:'+p.size+'px">'+p.text+'</div>';
      else html='<div style="background:'+(p.bg||'transparent')+';border-radius:'+(p.radius||0)+'px;width:'+p.w+'px;height:'+p.h+'px">'+(p.text||'')+'</div>';
      const inner=html.replace(new RegExp(String.fromCharCode(96),'g'),"'").replace(/\\/g,'');
      return '  const el'+entry.id+'=document.createElement(\'div\'); el'+entry.id+'.style.cssText=\'position:absolute;left:'+p.x+'px;top:'+p.y+'px;width:'+p.w+'px;height:'+p.h+'px;\'; el'+entry.id+'.innerHTML=\''+inner+'\'; wrap.appendChild(el'+entry.id+');';
    }).join('\n');
    const code=`AppManager.register('${appId}',{open:opts=>{const wid='${appId}_'+Date.now();const wrap=document.createElement('div');wrap.style.cssText='position:relative;width:100%;height:100%;background:rgba(10,10,20,.95);overflow:hidden;';\n${elCode}\nWindowManager.create({id:wid,title:'${name}',app:'${appId}',width:520,height:420,content:wrap});}});`;
    if (typeof PluginSystem!=='undefined') {
      PluginSystem.loadFromCode(code,{name,icon:'🏗️',desc:`Erstellt mit App Builder`}).then(()=>{
        Toast.showInteractive({title:`"${name}" installiert!`,icon:'🏗️',actions:[{label:'Öffnen',primary:true,cb:()=>AppManager.open(appId)}]});
      });
    }
  });

  WindowManager.create({ id:wid, title:'🏗️ App Builder', app:'appbuilder', width:1050, height:600, content:wrap });
}

/* ═══════════════════════════════════════════════════
   MODULE: 3D DESKTOP MODE
═══════════════════════════════════════════════════ */
const Desktop3D = (() => {
  let enabled = false;
  let rafId   = null;

  function enable() {
    enabled = true;
    document.body.classList.add('mode-3d');
    document.addEventListener('mousemove', _onMouseMove);
    Toast.show('3D Desktop-Modus aktiviert', '🌐');
  }
  function disable() {
    enabled = false;
    document.body.classList.remove('mode-3d');
    document.removeEventListener('mousemove', _onMouseMove);
    WindowManager.getAllWins().forEach(w => { w.el.style.setProperty('--tilt-x','0deg'); w.el.style.setProperty('--tilt-y','0deg'); });
  }
  function toggle() { enabled ? disable() : enable(); return enabled; }

  function _onMouseMove(e) {
    if (!enabled) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx, dy = (e.clientY - cy) / cy;
      const rx = (-dy * 3).toFixed(2), ry = (dx * 3).toFixed(2);
      const container = document.getElementById('desktops-container');
      if (container) container.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  }

  return { enable, disable, toggle, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: DYNAMIC WALLPAPER / PARALLAX ENGINE
═══════════════════════════════════════════════════ */
const WallpaperEngine = (() => {
  let canvas, ctx, animId;
  let particles = [];
  let parallaxEl;
  let parallaxEnabled = false;
  let particlesEnabled = false;

  const PARTICLE_COUNT = 55;

  function initParticles() {
    canvas = document.createElement('canvas');
    canvas.id = 'particle-canvas';
    const slide = document.querySelector('.desktop-slide.active');
    if (slide) slide.querySelector('.desktop-wallpaper').appendChild(canvas);
    ctx = canvas.getContext('2d');
    _resize();
    window.addEventListener('resize', _resize);
    _spawnParticles();
    particlesEnabled = true;
    _animLoop();
  }

  function _resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function _spawnParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x:    Math.random() * window.innerWidth,
      y:    Math.random() * window.innerHeight,
      r:    Math.random() * 2.5 + 0.5,
      vx:   (Math.random() - 0.5) * 0.4,
      vy:   (Math.random() - 0.5) * 0.4,
      alpha:Math.random() * 0.5 + 0.1,
      hue:  Math.random() * 60 + 200, // blue-purple range
    }));
  }

  function _animLoop() {
    if (!particlesEnabled || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx + dy*dy);
        if (d < 130) {
          ctx.beginPath();
          ctx.strokeStyle = `hsla(${particles[i].hue},80%,70%,${0.12 * (1-d/130)})`;
          ctx.lineWidth   = 0.6;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    // Draw & move particles
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.alpha})`;
      ctx.fill();
    });

    animId = requestAnimationFrame(_animLoop);
  }

  function stopParticles() {
    particlesEnabled = false;
    cancelAnimationFrame(animId);
    canvas?.remove();
  }

  function enableParallax() {
    parallaxEnabled = true;
    let lastX = 0, lastY = 0, rafP = null;
    document.addEventListener('mousemove', e => {
      if (rafP) cancelAnimationFrame(rafP);
      rafP = requestAnimationFrame(() => {
        const cx = window.innerWidth/2, cy = window.innerHeight/2;
        const dx = (e.clientX - cx) / cx * 12;
        const dy = (e.clientY - cy) / cy * 8;
        const slide = document.querySelector('.desktop-slide.active .desktop-wallpaper');
        if (slide) slide.style.transform = `translate(${dx}px,${dy}px) scale(1.05)`;
      });
    });
    Toast.show('Parallax-Hintergrund aktiviert', '🌊');
  }

  return { initParticles, stopParticles, enableParallax };
})();

/* ═══════════════════════════════════════════════════
   MODULE: PHYSICS MODE (viral feature)
   All windows fall with gravity on activate
═══════════════════════════════════════════════════ */
const PhysicsMode = (() => {
  let btn;

  function init() {
    btn = document.createElement('div');
    btn.id = 'physics-btn'; btn.title = '🌍 Schwerkraft-Modus (virales Feature)'; btn.textContent = '🌍';
    btn.addEventListener('click', activate);
    document.body.appendChild(btn);
  }

  function activate() {
    const wins = [...WindowManager.getAllWins()];
    if (!wins.length) { Toast.show('Keine Fenster zum Fallen!', '⚠️'); return; }

    btn.classList.add('active');
    document.body.classList.add('physics-active');
    SoundSystem?.play('error');

    wins.forEach(([id, w], i) => {
      const delay = i * 120;
      const rotDir = Math.random() > 0.5 ? 1 : -1;
      const rot    = (Math.random() * 15 + 5) * rotDir;
      const dur    = 0.9 + Math.random() * 0.6;
      setTimeout(() => {
        w.el.style.setProperty('--fall-rot', rot + 'deg');
        w.el.style.setProperty('--fall-duration', dur + 's');
        w.el.classList.add('falling');
        w.el.addEventListener('animationend', () => {
          WindowManager.close(id);
        }, { once: true });
      }, delay);
    });

    // After all windows fall, restore
    setTimeout(() => {
      document.body.classList.remove('physics-active');
      btn.classList.remove('active');
      Toast.showInteractive({
        title: '💥 Alle Fenster gefallen!',
        icon: '🌍',
        msg: 'Das war episch! Desktop jetzt leer.',
        actions: [{ label: 'Finder öffnen', primary: true, cb: () => AppManager.open('finder') }]
      });
    }, wins.length * 120 + 1500);
  }

  return { init, activate };
})();

/* ═══════════════════════════════════════════════════
   MODULE: COLLABORATION CURSORS (simulated)
═══════════════════════════════════════════════════ */
const CollabSystem = (() => {
  const COLLAB_USERS = [
    { name:'Alex',  color:'#ff2d55', cursor:null, active:true },
    { name:'Sarah', color:'#30d158', cursor:null, active:false },
  ];
  let enabled = false;
  let cursors = [];

  function enable() {
    enabled = true;
    COLLAB_USERS.filter(u => u.active).forEach(user => {
      const el = document.createElement('div');
      el.className = 'collab-cursor';
      const arrow = document.createElement('div');
      arrow.className = 'collab-cursor-arrow';
      arrow.style.background = user.color;
      const label = document.createElement('div');
      label.className = 'collab-cursor-label';
      label.style.background = user.color;
      label.textContent = user.name;
      el.append(arrow, label);
      document.body.appendChild(el);
      user.cursor = el;
      _animateCursor(user);
    });
    Toast.show('Kollaboration: Alex ist jetzt live 👥', '🤝');
  }

  function disable() {
    enabled = false;
    COLLAB_USERS.forEach(u => { u.cursor?.remove(); u.cursor = null; });
  }

  function _animateCursor(user) {
    if (!enabled || !user.cursor) return;
    const targetX = Math.random() * (window.innerWidth - 100) + 50;
    const targetY = Math.random() * (window.innerHeight - 100) + 50;
    user.cursor.style.left = targetX + 'px';
    user.cursor.style.top  = targetY + 'px';
    setTimeout(() => { if (enabled && user.cursor) _animateCursor(user); }, 1200 + Math.random() * 2000);
  }

  return { enable, disable, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SYSTEM PERSONALITY
   WebOS reacts to user actions with character
═══════════════════════════════════════════════════ */
const Personality = (() => {
  let bubble = null;
  let showTimer = null;
  let actionCount = {};
  let lastMsg = '';

  const QUIPS = {
    'game':    ['Schon wieder zocken? 😄', 'Highscore knacken!', 'Viel Spaß beim Spielen!', 'Snake oder Breakout?'],
    'editor':  ['Was wird es dieses Mal?', 'Kreative Energie erkenne ich!', 'Schreib was Tolles ✍️'],
    'terminal':['Echte Profis nutzen das Terminal 😎', 'bash oder zsh?', 'ls -la sagt mir alles 👀'],
    'browser2':['Was surfst du heute?', 'Internet-Explorer? Nein danke 😂', 'Inkognito geht\u2019s auch 🕵️'],
    'settings':['Optimieren wir das System?', 'Neon-Theme ist das Beste, ehrlich.'],
    'ai':      ['Gute Wahl! Die KI hilft dir.', 'Ich bin selbst eine KI... warte mal 🤔'],
    'appbuilder':['Ein Creator! Ich mag das 🏗️', 'Keine Codezeile nötig!'],
    'many_wins':['Du multitaskst auf Profi-Niveau!', 'Brauchst du so viele Fenster? 😅', 'Alles unter Kontrolle hier?'],
    'idle':    ['Hey, bist du noch da? 👋', 'Ich warte... 🥱', '*trommelt mit den Fingern*'],
    'boot':    ['Willkommen zurück! Schön, dich zu sehen 🙂', 'Los geht\'s — was machen wir heute?'],
  };

  function init() {
    bubble = document.createElement('div'); bubble.id = 'personality-bubble';
    bubble.innerHTML = '<div class="pb-avatar">⬡</div><div class="pb-text"></div><div class="pb-tail"></div>';
    document.body.appendChild(bubble);

    // Greet on boot
    setTimeout(() => say('boot'), 1500);

    // React to window opens
    Events.on('window:open', (id, app) => {
      actionCount[app] = (actionCount[app]||0) + 1;
      // Only comment every 2nd time to avoid spam
      if (actionCount[app] % 2 === 0) say(app);
      if (WindowManager.getAllWins().size >= 5) say('many_wins');
    });

    // Idle detection
    let idleTimer;
    const resetIdle = () => { clearTimeout(idleTimer); idleTimer = setTimeout(()=>say('idle'),90000); };
    ['mousemove','keydown','click'].forEach(e => document.addEventListener(e, resetIdle, {passive:true}));
    resetIdle();
  }

  function say(key) {
    const pool = QUIPS[key];
    if (!pool) return;
    let msg;
    do { msg = pool[Math.floor(Math.random()*pool.length)]; } while (msg === lastMsg && pool.length > 1);
    lastMsg = msg;
    _show(msg);
  }

  function _show(text) {
    if (!bubble) return;
    clearTimeout(showTimer);
    bubble.querySelector('.pb-text').textContent = text;
    bubble.classList.add('visible');
    showTimer = setTimeout(() => bubble.classList.remove('visible'), 4500);
  }

  return { init, say };
})();

/* ═══════════════════════════════════════════════════
   MODULE: AMBIENT SOUND ENGINE
   Synthesized ambient tones using Web Audio
═══════════════════════════════════════════════════ */
const AmbientSounds = (() => {
  let ctx = null, gainNode = null, enabled = false;
  let indicator;
  const oscillators = [];

  function init() {
    indicator = document.getElementById('ambient-indicator');
    if (!indicator) {
      indicator = document.createElement('div'); indicator.id='ambient-indicator';
      indicator.innerHTML='<div class="amb-bars"><div class="amb-bar" style="height:8px"></div><div class="amb-bar" style="height:12px"></div><div class="amb-bar" style="height:6px"></div><div class="amb-bar" style="height:10px"></div></div><span>Ambient</span>';
      document.body.appendChild(indicator);
    }
  }

  function start() {
    if (enabled) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      gainNode = ctx.createGain(); gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
      gainNode.connect(ctx.destination);
      // Layered drone frequencies — very quiet, atmospheric
      [55, 82.4, 110, 164.8].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = i % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        g.gain.setValueAtTime(0.015, ctx.currentTime);
        osc.connect(g); g.connect(gainNode);
        osc.start(); oscillators.push(osc);
      });
      enabled = true;
      indicator.classList.add('visible');
      Toast.show('Ambient-Sound aktiviert 🎵', '🔊');
    } catch(e) { Toast.show('Web Audio nicht verfügbar', '⚠️'); }
  }

  function stop() {
    oscillators.forEach(o => { try { o.stop(); } catch {} });
    oscillators.length = 0;
    try { ctx?.close(); } catch {}
    ctx = null; enabled = false;
    indicator?.classList.remove('visible');
    Toast.show('Ambient-Sound deaktiviert', '🔇');
  }

  function toggle() { enabled ? stop() : start(); return enabled; }

  return { init, start, stop, toggle, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SCREEN RECORDER (action log)
═══════════════════════════════════════════════════ */
const ScreenRecorder = (() => {
  let recording = false;
  let events    = [];
  let indicator;
  let startTime;

  function init() {
    indicator = document.getElementById('recording-indicator');
    if (!indicator) {
      indicator = document.createElement('div'); indicator.id='recording-indicator';
      indicator.innerHTML='<div class="rec-dot"></div><span>REC</span><span id="rec-timer">0:00</span>';
      document.body.appendChild(indicator);
    }
  }

  function start() {
    if (recording) return;
    recording = true; events = []; startTime = Date.now();
    indicator.classList.add('active');
    // Record all events
    const capture = e => events.push({ type:e.type, x:e.clientX||0, y:e.clientY||0, t:Date.now()-startTime, target:e.target?.tagName });
    ['click','mousemove','keydown'].forEach(ev => document.addEventListener(ev, capture));
    // Timer
    const timer = setInterval(() => {
      if (!recording) { clearInterval(timer); return; }
      const s = Math.floor((Date.now()-startTime)/1000);
      const el = document.getElementById('rec-timer');
      if (el) el.textContent = Math.floor(s/60)+':'+(s%60).toString().padStart(2,'0');
    }, 1000);
    Toast.show('Aufnahme gestartet 🔴', '📹');
  }

  function stop() {
    recording = false;
    indicator.classList.remove('active');
    Toast.showInteractive({
      title:`Aufnahme beendet — ${events.length} Events`,
      icon:'📹',
      msg:'Session als JSON speichern?',
      actions:[{label:'💾 Exportieren',primary:true,cb:()=>{
        const blob=new Blob([JSON.stringify({events,duration:Date.now()-startTime},null,2)],{type:'application/json'});
        const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='webos-session.json';a.click();
      }}]
    });
  }

  function toggle() { recording ? stop() : start(); }

  return { init, start, stop, toggle, get recording() { return recording; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: PERFORMANCE MODE
═══════════════════════════════════════════════════ */
const PerfMode = (() => {
  let enabled = false;
  let indicator;

  function init() {
    indicator = document.getElementById('perf-indicator');
    if (!indicator) { indicator=document.createElement('div');indicator.id='perf-indicator';indicator.textContent='⚡ PERF';document.body.appendChild(indicator); }
  }

  function enable() {
    enabled = true;
    document.body.classList.add('perf-mode');
    document.documentElement.style.setProperty('--anim-speed','0.25');
    indicator.classList.add('visible');
    Toast.show('Performance Mode: An ⚡','⚡');
  }
  function disable() {
    enabled = false;
    document.body.classList.remove('perf-mode');
    document.documentElement.style.setProperty('--anim-speed', State.get().animSpeed||'1');
    indicator.classList.remove('visible');
    Toast.show('Quality Mode: An ✨','✨');
  }
  function toggle() { enabled ? disable() : enable(); return enabled; }

  return { init, enable, disable, toggle, get enabled(){return enabled;} };
})();

/* ═══════════════════════════════════════════════════
   SETTINGS EXTENSION: New tabs for v4 features
═══════════════════════════════════════════════════ */
Events.on('window:open', (id, app) => {
  if (app !== 'settings') return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const win = WindowManager.getWin(id); if (!win) return;
    const sidebar = win.el.querySelector('.settings-sidebar');
    const content = win.el.querySelector('.settings-content');
    if (!sidebar||!content||sidebar.dataset.ultraExt) return;
    sidebar.dataset.ultraExt='1';

    const ULTRA_TABS = [
      { icon:'🌐', label:'3D Modus',   fn:c=>_renderSetting3D(c) },
      { icon:'🌊', label:'Wallpaper',  fn:c=>_renderSettingWP(c) },
      { icon:'⚡', label:'Performance',fn:c=>_renderSettingPerf(c) },
      { icon:'🎙️', label:'Aufnahme',   fn:c=>_renderSettingRecord(c) },
    ];
    ULTRA_TABS.forEach(t=>{
      const el=document.createElement('div'); el.className='settings-sidebar-item';
      el.innerHTML=`<span class="ss-icon">${t.icon}</span>${t.label}`;
      el.addEventListener('click',()=>{ sidebar.querySelectorAll('.settings-sidebar-item').forEach(x=>x.classList.remove('active')); el.classList.add('active'); t.fn(content); });
      sidebar.appendChild(el);
    });
  }));
});

function _toggle3DRow(content) {
  const on = Desktop3D.enabled;
  content.innerHTML='';
  const t=document.createElement('div');t.className='settings-section-title';t.textContent='3D Desktop';
  const toggle=_settingToggle(!on, val=>{ val?Desktop3D.enable():Desktop3D.disable(); });
  const row=document.createElement('div');row.className='settings-row';
  row.innerHTML='<div class="settings-row-label">3D-Modus<div class="settings-row-desc">Fenster schweben im 3D-Raum, Maus steuert Perspektive</div></div>';
  row.appendChild(toggle); content.append(t,row);
}
function _renderSetting3D(c) { _toggle3DRow(c); }
function _renderSettingWP(c) {
  c.innerHTML='';
  const t=document.createElement('div');t.className='settings-section-title';t.textContent='Wallpaper Engine';
  c.appendChild(t);
  const BTNS=[
    ['🌊 Partikel aktivieren','Animierte Partikel im Hintergrund',()=>WallpaperEngine.initParticles()],
    ['🌀 Partikel stoppen','Partikel entfernen',()=>WallpaperEngine.stopParticles()],
    ['🖱️ Parallax-Effekt','Hintergrund folgt der Maus',()=>WallpaperEngine.enableParallax()],
  ];
  BTNS.forEach(([label,desc,fn])=>{
    const row=document.createElement('div');row.className='settings-row';
    row.innerHTML=`<div class="settings-row-label">${label.split(' ').slice(1).join(' ')}<div class="settings-row-desc">${desc}</div></div>`;
    const btn=document.createElement('button');btn.className='editor-btn';btn.textContent=label.split(' ')[0]+' '+label.split(' ')[1];
    btn.addEventListener('click',fn);row.appendChild(btn);c.appendChild(row);
  });
}
function _renderSettingPerf(c) {
  c.innerHTML='';
  const t=document.createElement('div');t.className='settings-section-title';t.textContent='Leistung';
  const toggle=_settingToggle(PerfMode.enabled,val=>val?PerfMode.enable():PerfMode.disable());
  const row=document.createElement('div');row.className='settings-row';
  row.innerHTML='<div class="settings-row-label">Performance Mode<div class="settings-row-desc">Reduziert Animationen für bessere Performance</div></div>';
  row.appendChild(toggle); c.append(t,row);
  const t2=document.createElement('div');t2.className='settings-section-title';t2.textContent='Sound';
  const ambToggle=_settingToggle(AmbientSounds.enabled,val=>AmbientSounds.toggle());
  const row2=document.createElement('div');row2.className='settings-row';
  row2.innerHTML='<div class="settings-row-label">Ambient Sound<div class="settings-row-desc">Atmosphärische Hintergrundklänge</div></div>';
  row2.appendChild(ambToggle); c.append(t2,row2);
  const t3=document.createElement('div');t3.className='settings-section-title';t3.textContent='Kollaboration';
  const collabToggle=_settingToggle(CollabSystem.enabled,val=>val?CollabSystem.enable():CollabSystem.disable());
  const row3=document.createElement('div');row3.className='settings-row';
  row3.innerHTML='<div class="settings-row-label">Live-Cursor<div class="settings-row-desc">Zeigt simulierte Co-User-Cursor</div></div>';
  row3.appendChild(collabToggle); c.append(t3,row3);
}
function _renderSettingRecord(c) {
  c.innerHTML='';
  const t=document.createElement('div');t.className='settings-section-title';t.textContent='Bildschirmaufnahme';
  const row=document.createElement('div');row.className='settings-row';
  row.innerHTML='<div class="settings-row-label">Aufnahme starten/stoppen<div class="settings-row-desc">Zeichnet Klicks und Fensterbewegungen auf</div></div>';
  const btn=document.createElement('button');btn.className='editor-btn';btn.textContent=ScreenRecorder.recording?'⏹ Stoppen':'🔴 Aufnehmen';
  btn.style.color=ScreenRecorder.recording?'#ff453a':'';
  btn.addEventListener('click',()=>{ScreenRecorder.toggle();btn.textContent=ScreenRecorder.recording?'⏹ Stoppen':'🔴 Aufnehmen';});
  row.appendChild(btn); c.append(t,row);
}

function _settingToggle(initial, onChange) {
  const lbl=document.createElement('label');lbl.className='toggle';
  const inp=document.createElement('input');inp.type='checkbox';inp.checked=initial;
  const track=document.createElement('div');track.className='toggle-track';
  const thumb=document.createElement('div');thumb.className='toggle-thumb';
  lbl.append(inp,track,thumb);
  inp.addEventListener('change',()=>onChange(inp.checked));
  return lbl;
}

/* ═══════════════════════════════════════════════════
   TERMINAL: ultra commands
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  window.__terminalPlugins = window.__terminalPlugins || {};
  window.__terminalPlugins['3d']       = (a,p)=>{ const on=Desktop3D.toggle(); p(`3D Modus: ${on?'an':'aus'}`,'t-info'); return true; };
  window.__terminalPlugins['particles']= (a,p)=>{ WallpaperEngine.initParticles(); p('Partikel aktiviert','t-info'); return true; };
  window.__terminalPlugins['search']   = (a,p)=>{ AppManager.open('search',{q:a.join(' ')}); return true; };
  window.__terminalPlugins['appbuilder']=(a,p)=>{ AppManager.open('appbuilder'); p('App Builder geöffnet','t-info'); return true; };
  window.__terminalPlugins['record']   = (a,p)=>{ ScreenRecorder.toggle(); p(ScreenRecorder.recording?'REC gestartet':'REC gestoppt','t-warn'); return true; };
  window.__terminalPlugins['gravity']  = (a,p)=>{ PhysicsMode.activate(); p('Schwerkraft aktiviert! 🌍','t-warn'); return true; };
  window.__terminalPlugins['ambient']  = (a,p)=>{ AmbientSounds.toggle(); return true; };
  window.__terminalPlugins['perf']     = (a,p)=>{ PerfMode.toggle(); return true; };
  window.__terminalPlugins['collab']   = (a,p)=>{ CollabSystem.enable(); p('Kollaboration aktiviert','t-info'); return true; };
  window.__terminalPlugins['build']    = (a,p)=>{ AppManager.open('appbuilder'); return true; };
  window.__terminalPlugins['cmd']      = (a,p)=>{ CommandPalette.init && CommandPalette['show']?.(); return true; };
});

/* ═══════════════════════════════════════════════════
   DOCK ICONS
═══════════════════════════════════════════════════ */
function _injectUltraDockIcons() {
  const dockApps = document.getElementById('dock-apps');
  if (!dockApps) return;
  const sep = dockApps.querySelector('.dock-separator');

  function addDockItem(app, label, svg) {
    if (dockApps.querySelector(`.dock-item[data-app="${app}"]`)) return;
    const item = document.createElement('div'); item.className='dock-item';item.dataset.app=app;item.title=label;
    item.innerHTML=`<div class="dock-icon"><svg viewBox="0 0 48 48" width="48" height="48">${svg}</svg></div><span class="dock-label">${label}</span>`;
    item.addEventListener('click',()=>AppManager.open(app));
    if(sep)dockApps.insertBefore(item,sep);else dockApps.appendChild(item);
  }

  addDockItem('appbuilder','App Builder',
    '<rect width="48" height="48" rx="12" fill="#1a2a3a"/><rect x="8" y="14" width="18" height="14" rx="4" fill="#0a84ff" opacity=".7" stroke="#0a84ff" stroke-width="1.5"/><rect x="28" y="8" width="12" height="10" rx="3" fill="#30d158" opacity=".8"/><rect x="28" y="21" width="12" height="10" rx="3" fill="#ffd60a" opacity=".8"/><rect x="28" y="34" width="12" height="6" rx="2" fill="#bf5af2" opacity=".8"/>');

  addDockItem('search','Suche',
    '<rect width="48" height="48" rx="12" fill="#1a1a2a"/><circle cx="21" cy="21" r="10" stroke="white" stroke-width="2.5" fill="none" opacity=".7"/><line x1="28.5" y1="28.5" x2="38" y2="38" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".8"/>');
}

/* ═══════════════════════════════════════════════════
   MAIN ULTRA INIT
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  CommandPalette.init();
  Personality.init();
  PhysicsMode.init();
  AmbientSounds.init();
  ScreenRecorder.init();
  PerfMode.init();
  WallpaperEngine.enableParallax();
  _injectUltraDockIcons();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey||e.metaKey) && e.shiftKey) {
      if (e.key==='S') { e.preventDefault(); AppManager.open('search'); }
      if (e.key==='B') { e.preventDefault(); AppManager.open('appbuilder'); }
      if (e.key==='P') { e.preventDefault(); PerfMode.toggle(); }
      if (e.key==='G') { e.preventDefault(); PhysicsMode.activate(); }
    }
  });

  // Extend terminal help
  const orig = window.__terminalPlugins?.help;
  window.__terminalPlugins['help'] = (a, p) => {
    p('── Ultra Commands ──', 't-info');
    const cmds=[['3d','3D Desktop an/aus'],['particles','Partikel-Hintergrund'],['search [term]','Globale Suche'],['gravity','Fenster fallen lassen 🌍'],['record','Aufnahme start/stop'],['ambient','Ambient Sound'],['perf','Performance Mode'],['build','App Builder'],['appbuilder','App Builder öffnen'],['collab','Kollaboration'],['cmd','Command Palette']];
    cmds.forEach(([c,d])=>p(`  ${c.padEnd(14)} ${d}`,'t-out'));
    return true;
  };

  if (typeof DevMode!=='undefined') DevMode.log('WebOS Ultra geladen','system');
  Toast.show('WebOS Ultra bereit — Ctrl+K für Command Palette ⌘','⚡',4500);
});
