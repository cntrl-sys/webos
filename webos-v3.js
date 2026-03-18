/* =====================================================
   WebOS v3 — webos-v3.js
   Plugin System · SDK · Live Activity · Profile 2.0
   TimeWarp · Session · Social · Easter Eggs · FPS
   Loads after platform-extensions.js
===================================================== */
'use strict';

/* ═══════════════════════════════════════════════════
   MODULE: PLUGIN SYSTEM
═══════════════════════════════════════════════════ */
const PluginSystem = (() => {
  const PLUGIN_STORE_KEY = 'webos_plugins_v1';
  const installed = new Map(); // id → { def, enabled, script? }

  const BUILTIN_PLUGINS = [
    {
      id: 'clock-plus',
      name: 'Clock Plus',
      version: '1.2.0',
      icon: '🕐',
      author: 'WebOS Labs',
      desc: 'Erweiterte Uhr mit Weltzeiten und Timer.',
      tags: ['widget','tools'],
      size: '12 KB',
      code: `
        AppManager.register('clock-plus', { open: opts => {
          const wid = 'clockplus_' + Date.now();
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:rgba(8,8,18,.9);padding:24px;gap:16px;';
          const cities = [
            {name:'Berlin',tz:'Europe/Berlin'},{name:'London',tz:'Europe/London'},
            {name:'New York',tz:'America/New_York'},{name:'Tokyo',tz:'Asia/Tokyo'},
            {name:'Sydney',tz:'Australia/Sydney'},
          ];
          function update() {
            wrap.querySelectorAll('[data-tz]').forEach(el => {
              const t = new Date().toLocaleTimeString('de-DE',{timeZone:el.dataset.tz,hour:'2-digit',minute:'2-digit',second:'2-digit'});
              el.querySelector('.tz-time').textContent = t;
            });
          }
          cities.forEach(c => {
            const row = document.createElement('div');
            row.dataset.tz = c.tz;
            row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,.05);border-radius:10px;';
            row.innerHTML = '<div style="color:rgba(255,255,255,.6);font-size:13px;">'+c.name+'</div><div class="tz-time" style="color:white;font-size:22px;font-weight:200;font-family:monospace;"></div>';
            wrap.appendChild(row);
          });
          update();
          const timer = setInterval(update, 1000);
          Events.on('window:close', id => { if(id===wid) clearInterval(timer); });
          WindowManager.create({id:wid,title:'🕐 Clock Plus',app:'clock-plus',width:340,height:380,content:wrap});
        }});
        window.__terminalPlugins = window.__terminalPlugins || {};
        window.__terminalPlugins['worldclock'] = (a,p) => { AppManager.open('clock-plus'); p('Clock Plus geöffnet','t-info'); return true; };
      `
    },
    {
      id: 'color-picker',
      name: 'Color Picker',
      version: '0.9.1',
      icon: '🎨',
      author: 'Community',
      desc: 'Farben wählen und HEX/RGB-Werte kopieren.',
      tags: ['tools','design'],
      size: '8 KB',
      code: `
        AppManager.register('color-picker', { open: opts => {
          const wid = 'colorpicker_' + Date.now();
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:rgba(8,8,18,.9);padding:20px;gap:16px;align-items:center;';
          wrap.innerHTML = '<div style="color:white;font-size:15px;font-weight:700">🎨 Color Picker</div>';
          const picker = document.createElement('input'); picker.type='color'; picker.value='#0a84ff';
          picker.style.cssText='width:160px;height:120px;border:none;border-radius:12px;cursor:pointer;';
          const hexDisplay = document.createElement('div');
          hexDisplay.style.cssText='font-family:monospace;font-size:22px;color:white;letter-spacing:.05em;cursor:pointer;padding:8px 16px;background:rgba(255,255,255,.08);border-radius:10px;';
          hexDisplay.textContent=picker.value;
          hexDisplay.title='Klicken zum Kopieren';
          const rgbDisplay = document.createElement('div');
          rgbDisplay.style.cssText='font-family:monospace;font-size:14px;color:rgba(255,255,255,.55);';
          function toRGB(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return \`rgb(\${r}, \${g}, \${b})\`;}
          function update(){hexDisplay.textContent=picker.value;hexDisplay.style.color=picker.value;rgbDisplay.textContent=toRGB(picker.value);wrap.style.background=\`radial-gradient(ellipse at 50% 30%, \${picker.value}22 0%, rgba(8,8,18,.9) 70%)\`;}
          picker.addEventListener('input',update);
          hexDisplay.addEventListener('click',()=>{navigator.clipboard?.writeText(picker.value);Toast.show('Farbe kopiert: '+picker.value,'🎨');});
          wrap.append(picker,hexDisplay,rgbDisplay);
          WindowManager.create({id:wid,title:'🎨 Color Picker',app:'color-picker',width:280,height:340,content:wrap});
        }});
      `
    },
    {
      id: 'markdown-viewer',
      name: 'Markdown Viewer',
      version: '1.0.0',
      icon: '📝',
      author: 'WebOS Labs',
      desc: 'Rendert .md Dateien als formatierten Text.',
      tags: ['productivity','tools'],
      size: '15 KB',
      code: `
        AppManager.register('markdown-viewer', { open: opts => {
          const wid = 'md_' + Date.now();
          const { node } = opts || {};
          const wrap = document.createElement('div');
          wrap.style.cssText = 'height:100%;overflow-y:auto;padding:24px;background:rgba(8,8,18,.9);';
          const md = node?.content || '# Kein Dokument\\n\\nÖffne eine .md Datei im Finder.';
          const html = md
            .replace(/^### (.+)/gm,'<h3 style="color:rgba(255,255,255,.7);margin:12px 0 6px">$1</h3>')
            .replace(/^## (.+)/gm, '<h2 style="color:rgba(255,255,255,.85);font-size:17px;margin:16px 0 8px">$1</h2>')
            .replace(/^# (.+)/gm,  '<h1 style="color:white;font-size:22px;margin:0 0 12px;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:8px">$1</h1>')
            .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g,'<pre style="background:rgba(0,0,0,.4);border-radius:8px;padding:12px;font-family:monospace;font-size:12px;color:#30d158;overflow-x:auto">$1</pre>')
            .replace(/\`(.+?)\`/g,'<code style="background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-family:monospace;color:#0a84ff">$1</code>')
            .replace(/\*\*(.+?)\*\*/g,'<strong style="color:white">$1</strong>')
            .replace(/\*(.+?)\*/g,'<em style="color:rgba(255,255,255,.8)">$1</em>')
            .replace(/^- (.+)/gm,'<li style="color:rgba(255,255,255,.75);margin:4px 0;list-style-position:inside">$1</li>')
            .replace(/\\n/g,'<br>');
          wrap.innerHTML = html;
          WindowManager.create({id:wid,title:'📝 '+(node?.name||'Markdown Viewer'),app:'markdown-viewer',width:600,height:500,content:wrap});
        }});
      `
    }
  ];

  function install(def) {
    if (installed.has(def.id)) return;
    installed.set(def.id, { def, enabled: false });
    _persist();
    Events.emit('plugin:installed', def.id);
  }

  function enable(id) {
    const p = installed.get(id);
    if (!p || p.enabled) return;
    try {
      const fn = new Function('AppManager','Events','WindowManager','FileSystem','State','Toast','WidgetSystem',
        p.def.code || '');
      fn(AppManager, Events, WindowManager, FileSystem, State, Toast,
         typeof WidgetSystem !== 'undefined' ? WidgetSystem : {});
      p.enabled = true;
      _persist();
      Events.emit('plugin:enabled', id);
      Toast.show(`Plugin "${p.def.name}" aktiviert`, p.def.icon || '🧩');
    } catch(e) {
      Toast.show(`Plugin-Fehler: ${e.message}`, '⚠️');
    }
  }

  function disable(id) {
    const p = installed.get(id);
    if (!p) return;
    p.enabled = false;
    _persist();
    Events.emit('plugin:disabled', id);
    Toast.show(`Plugin "${p.def.name}" deaktiviert`, '⭕');
  }

  function uninstall(id) {
    if (installed.has(id)) { installed.delete(id); _persist(); }
  }

  function loadFromURL(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.onload  = () => resolve(url);
      script.onerror = () => reject(new Error('Laden fehlgeschlagen: ' + url));
      document.head.appendChild(script);
    });
  }

  async function loadFromCode(code, meta = {}) {
    const def = { id: meta.id || 'custom_' + Date.now(), name: meta.name || 'Custom Plugin', version: '1.0.0', icon: meta.icon || '🧩', author: meta.author || 'User', desc: meta.desc || '', tags: ['custom'], size: Math.round(code.length / 1024 * 10) / 10 + ' KB', code };
    install(def);
    enable(def.id);
    return def.id;
  }

  function getAll() { return [...installed.values()]; }

  function _persist() {
    const serializable = [...installed.entries()].map(([id, p]) => ({
      id, def: p.def, enabled: p.enabled
    }));
    localStorage.setItem(PLUGIN_STORE_KEY, JSON.stringify(serializable));
  }

  function init() {
    BUILTIN_PLUGINS.forEach(def => install(def));
    // Restore previously enabled plugins
    try {
      const saved = JSON.parse(localStorage.getItem(PLUGIN_STORE_KEY) || '[]');
      saved.forEach(s => {
        if (s.enabled && installed.has(s.id)) enable(s.id);
      });
    } catch {}
  }

  return { install, enable, disable, uninstall, loadFromCode, loadFromURL, getAll, init };
})();

/* ═══════════════════════════════════════════════════
   APP: PLUGIN MANAGER
═══════════════════════════════════════════════════ */
AppManager.register('plugins', { open: opts => _openPluginManager(opts) });

function _openPluginManager(opts = {}) {
  const wid = 'plugins';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'plugin-layout';
  const sidebar = document.createElement('div'); sidebar.className = 'plugin-sidebar';
  sidebar.innerHTML = `<div class="plugin-sidebar-title"><span>🧩</span>Plugins</div>`;

  const SECTIONS = [
    { id:'installed', icon:'⚡', label:'Installiert' },
    { id:'store',     icon:'🏪', label:'Plugin Store' },
    { id:'load',      icon:'📥', label:'Laden' },
  ];
  let currentSection = 'installed';
  const navItems = [];

  SECTIONS.forEach(s => {
    const el = document.createElement('div');
    el.className = `plugin-nav-item${s.id === 'installed' ? ' active' : ''}`;
    el.innerHTML = `<span>${s.icon}</span>${s.label}`;
    el.addEventListener('click', () => { navItems.forEach(x => x.classList.remove('active')); el.classList.add('active'); currentSection = s.id; render(); });
    sidebar.appendChild(el); navItems.push(el);
  });

  const main = document.createElement('div'); main.className = 'plugin-main';
  const toolbar = document.createElement('div'); toolbar.className = 'plugin-toolbar';
  const search = document.createElement('input'); search.className = 'plugin-search'; search.placeholder = '🔍 Plugin suchen…';
  search.addEventListener('input', render);
  const loadBtn = document.createElement('button'); loadBtn.className = 'plugin-load-btn'; loadBtn.textContent = '+ Plugin laden';
  toolbar.append(search, loadBtn);
  const list = document.createElement('div'); list.className = 'plugin-list';
  main.append(toolbar, list);
  wrap.append(sidebar, main);

  // Store catalog
  const STORE_CATALOG = [
    { id:'clock-plus', name:'Clock Plus', icon:'🕐', desc:'Weltzeiten', author:'WebOS Labs', version:'1.2.0', tags:['widget'], size:'12 KB' },
    { id:'color-picker', name:'Color Picker', icon:'🎨', desc:'Farben wählen', author:'Community', version:'0.9.1', tags:['tools'], size:'8 KB' },
    { id:'markdown-viewer', name:'Markdown Viewer', icon:'📝', desc:'MD-Dateien rendern', author:'WebOS Labs', version:'1.0.0', tags:['productivity'], size:'15 KB' },
  ];

  loadBtn.addEventListener('click', () => {
    const code = prompt('JavaScript-Plugin-Code einfügen (AppManager.register, Events.on etc.):');
    if (!code) return;
    const name = prompt('Plugin-Name:') || 'Custom Plugin';
    PluginSystem.loadFromCode(code, { name }).then(() => { render(); Toast.show(`"${name}" installiert`, '🧩'); });
  });

  function render() {
    list.innerHTML = '';
    const term = search.value.toLowerCase();

    if (currentSection === 'installed') {
      const plugins = PluginSystem.getAll().filter(p => !term || p.def.name.toLowerCase().includes(term));
      if (!plugins.length) { list.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,.28);font-size:13px">Keine Plugins installiert.<br>Besuche den Plugin Store!</div>'; return; }
      plugins.forEach(p => {
        const card = document.createElement('div');
        card.className = `plugin-card${p.enabled ? ' enabled' : ''}`;
        card.innerHTML = `
          <div class="plugin-icon">${p.def.icon}</div>
          <div class="plugin-info">
            <div class="plugin-name">${p.def.name} <span class="plugin-version">v${p.def.version}</span></div>
            <div class="plugin-desc">${p.def.desc}</div>
            <div class="plugin-tags">${p.def.tags.map(t => `<span class="plugin-tag">${t}</span>`).join('')}</div>
          </div>
          <div class="plugin-actions">
            <button class="plugin-toggle-btn${p.enabled ? ' enabled' : ''}">${p.enabled ? '✓ Aktiv' : 'Aktivieren'}</button>
            <button class="plugin-toggle-btn" style="font-size:11px;color:rgba(255,69,58,.7)" data-remove>Entfernen</button>
          </div>`;
        card.querySelector('.plugin-toggle-btn:not([data-remove])').addEventListener('click', () => {
          if (p.enabled) PluginSystem.disable(p.def.id); else PluginSystem.enable(p.def.id);
          render();
        });
        card.querySelector('[data-remove]').addEventListener('click', () => { PluginSystem.uninstall(p.def.id); render(); });
        list.appendChild(card);
      });
    }

    if (currentSection === 'store') {
      STORE_CATALOG.filter(a => !term || a.name.toLowerCase().includes(term)).forEach(app => {
        const isInst = PluginSystem.getAll().some(p => p.def.id === app.id);
        const card = document.createElement('div'); card.className = 'plugin-card';
        card.innerHTML = `
          <div class="plugin-icon">${app.icon}</div>
          <div class="plugin-info">
            <div class="plugin-name">${app.name} <span class="plugin-version">v${app.version}</span></div>
            <div class="plugin-desc">${app.desc}</div>
            <div class="plugin-tags">${app.tags.map(t=>`<span class="plugin-tag">${t}</span>`).join('')}</div>
          </div>
          <div class="plugin-actions">
            <button class="plugin-toggle-btn${isInst?' enabled':''}">
              ${isInst ? '✓ Installiert' : '+ Installieren'}
            </button>
          </div>`;
        card.querySelector('.plugin-toggle-btn').addEventListener('click', () => {
          const def = PluginSystem.getAll().find(p => p.def.id === app.id);
          if (def) { PluginSystem.enable(app.id); render(); }
          else Toast.show(`"${app.name}" ist bereits installiert`, 'ℹ️');
        });
        list.appendChild(card);
      });
    }

    if (currentSection === 'load') {
      list.innerHTML = `
        <div style="padding:20px 4px">
          <div style="color:rgba(255,255,255,.4);font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin-bottom:12px">Plugin per URL laden</div>
          <div style="display:flex;gap:8px">
            <input id="plugin-url-input" style="flex:1;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:9px;color:white;font-size:13px;padding:7px 12px;outline:none;font-family:var(--font)" placeholder="https://example.com/myplugin.js"/>
            <button id="plugin-url-btn" style="background:var(--accent,#0a84ff);border:none;color:white;padding:7px 16px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600;font-family:var(--font)">Laden</button>
          </div>
          <div style="color:rgba(255,255,255,.25);font-size:11.5px;margin-top:8px">Das Skript wird direkt ausgeführt. Nur vertrauenswürdige Quellen laden.</div>
          <div style="color:rgba(255,255,255,.4);font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;font-weight:700;margin:20px 0 12px">Plugin manuell eingeben</div>
          <textarea id="plugin-code-input" style="width:100%;height:140px;background:rgba(0,0,0,.4);border:1px solid rgba(48,209,88,.2);border-radius:8px;color:#30d158;font-family:'Courier New',monospace;font-size:12px;padding:10px;outline:none;resize:none;" placeholder="// AppManager.register('my-app', { open: opts => { ... } });"></textarea>
          <button id="plugin-code-run-btn" style="margin-top:8px;background:rgba(48,209,88,.15);border:1px solid rgba(48,209,88,.3);color:#30d158;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;font-family:var(--font)">▶ Code ausführen</button>
        </div>`;
      list.querySelector('#plugin-url-btn').addEventListener('click', async () => {
        const url = list.querySelector('#plugin-url-input').value.trim();
        if (!url) return;
        try { await PluginSystem.loadFromURL(url); Toast.show('Plugin geladen: ' + url, '🧩'); currentSection='installed'; render(); }
        catch(e) { Toast.show('Fehler: ' + e.message, '⚠️'); }
      });
      list.querySelector('#plugin-code-run-btn').addEventListener('click', () => {
        const code = list.querySelector('#plugin-code-input').value.trim();
        if (!code) return;
        const name = prompt('Plugin-Name:') || 'Custom Plugin';
        PluginSystem.loadFromCode(code, { name }).then(() => { currentSection='installed'; render(); });
      });
    }
  }

  render();
  WindowManager.create({ id: wid, title: '🧩 Plugins', app: 'plugins', width: 720, height: 520, content: wrap });
}

/* ═══════════════════════════════════════════════════
   APP: SDK PANEL
═══════════════════════════════════════════════════ */
AppManager.register('sdk', { open: opts => _openSDK(opts) });

function _openSDK(opts = {}) {
  const wid = 'sdk';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const wrap = document.createElement('div'); wrap.className = 'sdk-layout';
  const tabs = document.createElement('div'); tabs.className = 'sdk-tabs';
  const content = document.createElement('div'); content.className = 'sdk-content';
  wrap.append(tabs, content);

  const TAB_DEFS = ['Quick Start', 'API Referenz', 'Templates', 'Live Editor'];
  const sections = [];
  const tabEls   = [];

  TAB_DEFS.forEach((t, i) => {
    const tab = document.createElement('button'); tab.className = `sdk-tab${i===0?' active':''}`; tab.textContent = t;
    tab.addEventListener('click', () => { tabEls.forEach((x,j)=>x.classList.toggle('active',j===i)); sections.forEach((s,j)=>s.classList.toggle('active',j===i)); });
    tabs.appendChild(tab); tabEls.push(tab);
  });

  // Section 0: Quick Start
  const s0 = document.createElement('div'); s0.className = 'sdk-section active';
  s0.innerHTML = `
    <div class="sdk-h1">⚡ WebOS SDK</div>
    <div class="sdk-p">Erstelle eigene Apps in wenigen Zeilen. Das Plugin-System macht WebOS zu einer erweiterbaren Plattform.</div>
    <div class="sdk-h2">Minimale App</div>
    <div class="sdk-code"><span class="sdk-comment">// Neue App registrieren</span>
<span class="sdk-keyword">AppManager</span>.<span class="sdk-func">register</span>(<span class="sdk-string">'my-app'</span>, {
  open: <span class="sdk-keyword">opts</span> => {
    <span class="sdk-keyword">const</span> wid = <span class="sdk-string">'myapp_'</span> + Date.<span class="sdk-func">now</span>();
    <span class="sdk-keyword">const</span> wrap = document.<span class="sdk-func">createElement</span>(<span class="sdk-string">'div'</span>);
    wrap.textContent = <span class="sdk-string">'Hello, WebOS!'</span>;
    wrap.style.cssText = <span class="sdk-string">'padding:24px;color:white;'</span>;

    <span class="sdk-keyword">WindowManager</span>.<span class="sdk-func">create</span>({
      id: wid,
      title: <span class="sdk-string">'🚀 My App'</span>,
      app: <span class="sdk-string">'my-app'</span>,
      width: 400, height: 300,
      content: wrap
    });
  }
});</div>
    <div class="sdk-h2">Events nutzen</div>
    <div class="sdk-code"><span class="sdk-comment">// Auf OS-Events reagieren</span>
<span class="sdk-keyword">Events</span>.<span class="sdk-func">on</span>(<span class="sdk-string">'window:open'</span>, (id, app) => {
  <span class="sdk-func">console</span>.log(<span class="sdk-string">\`App geöffnet: \${app}\`</span>);
});

<span class="sdk-comment">// Eigene Events emittieren</span>
<span class="sdk-keyword">Events</span>.<span class="sdk-func">emit</span>(<span class="sdk-string">'my-app:action'</span>, { data: <span class="sdk-string">'hello'</span> });</div>`;
  sections.push(s0);

  // Section 1: API Reference
  const s1 = document.createElement('div'); s1.className = 'sdk-section';
  s1.innerHTML = `<div class="sdk-h1">📚 API Referenz</div>`;
  const API_ENTRIES = [
    ['AppManager.register(id, def)', 'void', 'App im System registrieren'],
    ['AppManager.open(id, opts?)', 'void', 'App öffnen'],
    ['WindowManager.create(opts)', 'Element', 'Neues Fenster erstellen'],
    ['WindowManager.close(id)', 'void', 'Fenster schließen'],
    ['WindowManager.focus(id)', 'void', 'Fenster fokussieren'],
    ['WindowManager.getAllWins()', 'Map', 'Alle offenen Fenster'],
    ['Events.on(event, fn)', 'void', 'Event-Listener hinzufügen'],
    ['Events.emit(event, ...args)', 'void', 'Event auslösen'],
    ['Events.off(event, fn)', 'void', 'Event-Listener entfernen'],
    ['Toast.show(msg, icon)', 'void', 'Toast-Benachrichtigung'],
    ['Toast.showInteractive(opts)', 'void', 'Toast mit Aktionen'],
    ['FileSystem.createFile(parent, name, ext, content)', 'string', 'Datei erstellen'],
    ['FileSystem.getNode(id)', 'Object', 'Datei/Ordner abrufen'],
    ['State.get()', 'Object', 'OS-Zustand lesen'],
    ['State.set(key, value)', 'void', 'OS-Zustand setzen'],
    ['DesktopManager.getActiveSlide()', 'Element', 'Aktiver Desktop-Slide'],
  ];
  const table = document.createElement('table'); table.className = 'sdk-api-table';
  table.innerHTML = '<thead><tr><th>Methode</th><th>Rückgabe</th><th>Beschreibung</th></tr></thead>';
  const tbody = document.createElement('tbody');
  API_ENTRIES.forEach(([m, r, d]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${m}</td><td>${r}</td><td style="color:rgba(255,255,255,.6)">${d}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); s1.appendChild(table); sections.push(s1);

  // Section 2: Template Generator
  const s2 = document.createElement('div'); s2.className = 'sdk-section';
  s2.innerHTML = `<div class="sdk-h1">🛠️ App Generator</div><div class="sdk-p">Klicke auf einen Template-Typ um eine App-Struktur zu generieren, die du als Plugin laden kannst.</div>`;
  const TEMPLATES = [
    { label:'📊 Tool App', icon:'🔧', desc:'Einfaches Tool-Fenster' },
    { label:'📋 Liste App', icon:'📋', desc:'Liste mit Aktionen' },
    { label:'🕹️ Spiel-Stub', icon:'🎮', desc:'Canvas-basiertes Spiel' },
    { label:'🤖 AI-Widget', icon:'🤖', desc:'App mit AI-Integration' },
  ];
  const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;';
  const codeOut = document.createElement('div'); codeOut.className = 'sdk-code'; codeOut.textContent = '// Wähle ein Template…';
  const copyBtn = document.createElement('button'); copyBtn.className = 'sdk-gen-btn'; copyBtn.innerHTML = '📋 Als Plugin laden'; copyBtn.style.marginTop = '10px';
  let lastCode = '';

  TEMPLATES.forEach((t, i) => {
    const btn = document.createElement('button'); btn.className = 'plugin-load-btn'; btn.textContent = t.label;
    btn.addEventListener('click', () => { lastCode = _generateTemplate(t, i); codeOut.textContent = lastCode; });
    btnRow.appendChild(btn);
  });
  copyBtn.addEventListener('click', () => {
    if (!lastCode) return;
    const name = prompt('App-Name:', 'My App') || 'My App';
    PluginSystem.loadFromCode(lastCode, { name }).then(() => { AppManager.open('plugins'); Toast.show(`"${name}" als Plugin geladen`, '🧩'); });
  });
  s2.append(btnRow, codeOut, copyBtn); sections.push(s2);

  // Section 3: Live Editor
  const s3 = document.createElement('div'); s3.className = 'sdk-section'; s3.style.cssText = 'display:none;height:100%;padding:16px;';
  s3.innerHTML = '<div class="sdk-h1">▶ Live Editor</div><div class="sdk-p">Code eingeben und direkt im OS ausführen.</div>';
  const editor = document.createElement('textarea');
  editor.style.cssText = 'width:100%;height:200px;background:rgba(0,0,0,.5);border:1px solid rgba(48,209,88,.2);border-radius:10px;color:#30d158;font-family:"Courier New",monospace;font-size:12.5px;padding:12px;outline:none;resize:vertical;';
  editor.value = '// Beispiel: Toast zeigen\nToast.show("Hallo von SDK!", "🚀");';
  const runBtn = document.createElement('button'); runBtn.className = 'sdk-gen-btn'; runBtn.innerHTML = '▶ Ausführen'; runBtn.style.marginTop = '10px';
  const output = document.createElement('div'); output.style.cssText = 'margin-top:12px;padding:10px;background:rgba(0,0,0,.4);border-radius:8px;color:rgba(255,255,255,.65);font-family:"Courier New",monospace;font-size:12px;min-height:40px;';
  output.textContent = '// Ausgabe erscheint hier…';
  runBtn.addEventListener('click', () => {
    try {
      const fn = new Function('AppManager','Events','WindowManager','FileSystem','State','Toast',
        'console', editor.value);
      const logs = [];
      fn(AppManager, Events, WindowManager, FileSystem, State, Toast, { log: (...a) => logs.push(a.join(' ')) });
      output.style.color = '#30d158';
      output.textContent = logs.length ? logs.join('\n') : '// Ausgeführt (keine Ausgabe)';
    } catch(e) { output.style.color = '#ff453a'; output.textContent = '✕ ' + e.message; }
  });
  s3.append(editor, runBtn, output); sections.push(s3);

  sections.forEach(s => content.appendChild(s));
  WindowManager.create({ id: wid, title: '⚡ WebOS SDK', app: 'sdk', width: 720, height: 540, content: wrap });
}

function _generateTemplate(t, i) {
  const templates = [
`// Tool App Template
AppManager.register('my-tool', { open: opts => {
  const wid = 'mytool_' + Date.now();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:rgba(8,8,18,.9);padding:20px;gap:12px;';
  wrap.innerHTML = '<div style="color:white;font-size:16px;font-weight:700">🔧 Mein Tool</div>';
  const btn = document.createElement('button');
  btn.textContent = 'Aktion ausführen';
  btn.style.cssText = 'background:var(--accent,#0a84ff);border:none;color:white;padding:10px 20px;border-radius:10px;cursor:pointer;font-size:13px;';
  btn.onclick = () => Toast.show('Aktion ausgeführt!', '✅');
  wrap.appendChild(btn);
  WindowManager.create({id:wid,title:'🔧 Mein Tool',app:'my-tool',width:400,height:300,content:wrap});
}});`,
`// Liste App Template
AppManager.register('my-list', { open: opts => {
  const wid = 'mylist_' + Date.now();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:rgba(8,8,18,.9);';
  const items = ['Element 1','Element 2','Element 3'];
  const list = document.createElement('ul');
  list.style.cssText = 'flex:1;overflow-y:auto;padding:16px;list-style:none;display:flex;flex-direction:column;gap:8px;';
  items.forEach(item => {
    const li = document.createElement('li');
    li.style.cssText = 'padding:10px 14px;background:rgba(255,255,255,.06);border-radius:8px;color:rgba(255,255,255,.85);cursor:pointer;';
    li.textContent = item;
    li.onclick = () => Toast.show('Ausgewählt: '+item, '✅');
    list.appendChild(li);
  });
  wrap.appendChild(list);
  WindowManager.create({id:wid,title:'📋 Meine Liste',app:'my-list',width:380,height:380,content:wrap});
}});`,
`// Canvas Game Stub
AppManager.register('my-game', { open: opts => {
  const wid = 'mygame_' + Date.now();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:#000;';
  const canvas = document.createElement('canvas');
  canvas.width=400;canvas.height=300;
  const ctx = canvas.getContext('2d');
  // Your game loop here
  function draw() {
    ctx.fillStyle='#0a0a14';ctx.fillRect(0,0,400,300);
    ctx.fillStyle='white';ctx.font='20px sans-serif';
    ctx.textAlign='center';ctx.fillText('Game Area',200,150);
    requestAnimationFrame(draw);
  }
  draw();
  wrap.appendChild(canvas);
  WindowManager.create({id:wid,title:'🎮 Mein Spiel',app:'my-game',width:440,height:360,content:wrap});
}});`,
`// AI Widget Template
AppManager.register('my-ai-widget', { open: opts => {
  const wid = 'aiwid_' + Date.now();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;background:rgba(8,8,18,.9);padding:16px;gap:12px;';
  const out = document.createElement('div');
  out.style.cssText = 'flex:1;background:rgba(255,255,255,.05);border-radius:10px;padding:14px;color:rgba(255,255,255,.75);font-size:13px;overflow-y:auto;';
  out.textContent = 'Stelle eine Frage…';
  const row = document.createElement('div');row.style.cssText='display:flex;gap:8px;';
  const input = document.createElement('input');
  input.style.cssText='flex:1;background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:white;padding:8px 12px;outline:none;font-size:13px;';
  const btn = document.createElement('button');
  btn.textContent='→';btn.style.cssText='background:var(--accent,#0a84ff);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;';
  btn.onclick=()=>{out.textContent='Deine Frage: "'+input.value+'"\\n\\n(Verbinde mit echter AI-API für echte Antworten)';input.value='';};
  row.append(input,btn);wrap.append(out,row);
  WindowManager.create({id:wid,title:'🤖 AI Widget',app:'my-ai-widget',width:380,height:360,content:wrap});
}});`
  ];
  return templates[i] || templates[0];
}

/* ═══════════════════════════════════════════════════
   MODULE: USER PROFILE 2.0
═══════════════════════════════════════════════════ */
AppManager.register('profile', { open: opts => _openProfile(opts) });

const PROFILE_STATS_KEY = 'webos_profile_stats';

function _getStats() {
  try { return JSON.parse(localStorage.getItem(PROFILE_STATS_KEY) || '{"apps":0,"games":0,"minutes":Math.round((Date.now()-1e12)/60000)%999}'); }
  catch { return { apps: 0, games: 0, minutes: 0 }; }
}
function _incStat(key) {
  const s = _getStats(); s[key] = (s[key]||0) + 1;
  localStorage.setItem(PROFILE_STATS_KEY, JSON.stringify(s));
}

function _openProfile(opts = {}) {
  const wid = 'profile';
  if (WindowManager.getWin(wid)) { WindowManager.focus(wid); return; }

  const STATE_KEY = 'webos_user_profile';
  const getProfile = () => { try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{"name":"Benutzer","avatar":"👤","status":"Online"}'); } catch { return { name:'Benutzer', avatar:'👤', status:'Online' }; } };
  const saveProfile = p => localStorage.setItem(STATE_KEY, JSON.stringify(p));
  let profile = getProfile();

  const stats = _getStats();
  const startTime = Date.now();

  const wrap = document.createElement('div'); wrap.className = 'profile-layout';

  // Hero
  const hero = document.createElement('div'); hero.className = 'profile-hero';
  const avatarWrap = document.createElement('div'); avatarWrap.className = 'profile-avatar-wrap';
  const avatarImg  = document.createElement('div'); avatarImg.className = 'profile-avatar-img'; avatarImg.textContent = profile.avatar;
  const avatarEdit = document.createElement('div'); avatarEdit.className = 'profile-avatar-edit'; avatarEdit.textContent = '✏';
  avatarWrap.append(avatarImg, avatarEdit);
  const heroInfo = document.createElement('div'); heroInfo.className = 'profile-hero-info';
  const nameEdit = document.createElement('input'); nameEdit.className = 'profile-name-edit'; nameEdit.value = profile.name;
  const roleEl   = document.createElement('div'); roleEl.className = 'profile-role'; roleEl.textContent = 'WebOS Benutzer · Mitglied seit heute';
  const statusRow = document.createElement('div'); statusRow.className = 'profile-status-row';
  statusRow.innerHTML = `<div class="profile-status-dot"></div><div class="profile-status-text">${profile.status || 'Online'}</div>`;
  const saveBtn = document.createElement('button'); saveBtn.className = 'profile-save-btn'; saveBtn.textContent = '💾 Speichern';
  heroInfo.append(nameEdit, roleEl, statusRow, saveBtn);
  hero.append(avatarWrap, heroInfo);

  saveBtn.addEventListener('click', () => {
    profile.name = nameEdit.value.trim() || 'Benutzer';
    saveProfile(profile);
    avatarImg.textContent = profile.avatar;
    Toast.show('Profil gespeichert', '👤');
  });

  // Stats grid
  const statsGrid = document.createElement('div'); statsGrid.className = 'profile-stats-grid';
  const statsData = [
    { val: WindowManager.getAllWins().size + stats.apps, lbl: 'Apps geöffnet', pct: Math.min(100, (stats.apps/50)*100) },
    { val: (stats.games||0), lbl: 'Spiele gespielt', pct: Math.min(100, ((stats.games||0)/20)*100) },
    { val: stats.minutes + 'min', lbl: 'Zeit im System', pct: Math.min(100, (stats.minutes/120)*100) },
  ];
  statsData.forEach(s => {
    const div = document.createElement('div'); div.className = 'profile-stat';
    div.innerHTML = `<div class="ps-val">${s.val}</div><div class="ps-lbl">${s.lbl}</div><div class="ps-bar"><div class="ps-fill" style="width:${s.pct}%"></div></div>`;
    statsGrid.appendChild(div);
  });

  // Content
  const contentEl = document.createElement('div'); contentEl.className = 'profile-content';

  // Avatar picker
  const t1 = document.createElement('div'); t1.className = 'profile-section-title'; t1.textContent = 'Avatar auswählen';
  const avatarGrid = document.createElement('div'); avatarGrid.className = 'profile-avatar-grid';
  const AVATARS = ['👤','😎','🧑‍💻','👑','🦊','🐧','🤖','🎮','🧙','🦸','🎨','🚀'];
  AVATARS.forEach(av => {
    const opt = document.createElement('div'); opt.className = `profile-avatar-option${av===profile.avatar?' selected':''}`; opt.textContent = av;
    opt.addEventListener('click', () => {
      avatarGrid.querySelectorAll('.profile-avatar-option').forEach(x => x.classList.remove('selected'));
      opt.classList.add('selected'); profile.avatar = av; avatarImg.textContent = av;
    });
    avatarGrid.appendChild(opt);
  });

  // Status picker
  const t2 = document.createElement('div'); t2.className = 'profile-section-title'; t2.textContent = 'Status';
  const statusPicker = document.createElement('div'); statusPicker.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
  ['Online','Beschäftigt','Abwesend','Unsichtbar'].forEach(s => {
    const btn = document.createElement('button'); btn.className = 'plugin-toggle-btn'; btn.textContent = s;
    btn.style.cssText += ';font-size:12px;';
    if (s === profile.status) btn.classList.add('enabled');
    btn.addEventListener('click', () => {
      statusPicker.querySelectorAll('button').forEach(b => b.classList.remove('enabled'));
      btn.classList.add('enabled'); profile.status = s;
      statusRow.querySelector('.profile-status-text').textContent = s;
    });
    statusPicker.appendChild(btn);
  });

  contentEl.append(t1, avatarGrid, t2, statusPicker);
  wrap.append(hero, statsGrid, contentEl);

  // Track time in system
  const interval = setInterval(() => {
    const mins = Math.round((Date.now() - startTime) / 60000);
    if (mins > 0) {
      const s = _getStats(); s.minutes = (s.minutes || 0) + mins;
      localStorage.setItem(PROFILE_STATS_KEY, JSON.stringify(s));
    }
  }, 60000);
  Events.on('window:close', id => { if (id === wid) clearInterval(interval); });

  WindowManager.create({ id: wid, title: '👤 Profil', app: 'profile', width: 560, height: 540, content: wrap });
}

/* ═══════════════════════════════════════════════════
   MODULE: LIVE ACTIVITY SYSTEM
   Idle Detection · Time-based events · Social pings
═══════════════════════════════════════════════════ */
const LiveActivity = (() => {
  let idleTimer = null;
  let isIdle   = false;
  const IDLE_TIMEOUT = 3 * 60 * 1000; // 3 min
  let bar = null;

  function init() {
    bar = document.getElementById('live-activity-bar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'live-activity-bar';
      document.body.appendChild(bar);
    }

    // Reset on activity
    ['mousemove','keydown','click','touchstart'].forEach(ev => {
      document.addEventListener(ev, _resetIdle, { passive: true });
    });
    _resetIdle();

    // Time-based events
    _scheduleRandomEvents();

    // Check night mode
    _checkTimeBasedTheme();
    setInterval(_checkTimeBasedTheme, 5 * 60 * 1000);
  }

  function _resetIdle() {
    clearTimeout(idleTimer);
    if (isIdle) {
      isIdle = false;
      const idleScreen = document.getElementById('idle-screen');
      if (idleScreen) idleScreen.classList.remove('active');
    }
    idleTimer = setTimeout(_goIdle, IDLE_TIMEOUT);
  }

  function _goIdle() {
    isIdle = true;
    const idleScreen = document.getElementById('idle-screen');
    if (idleScreen) {
      _updateIdleClock();
      idleScreen.classList.add('active');
    }
  }

  function _updateIdleClock() {
    const idleScreen = document.getElementById('idle-screen');
    if (!idleScreen) return;
    idleScreen.innerHTML = `
      <div class="idle-clock">${new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'})}</div>
      <div class="idle-date">${new Date().toLocaleDateString('de-DE',{weekday:'long',month:'long',day:'numeric'})}</div>
      <div class="idle-hint">Klicken zum Fortfahren</div>`;
    idleScreen.addEventListener('click', _resetIdle, { once: true });
    if (isIdle) setTimeout(_updateIdleClock, 10000);
  }

  function showActivity(icon, text, duration = 3500) {
    if (!bar) return;
    bar.innerHTML = `<span class="la-icon">${icon}</span><span class="la-text">${text}</span><button class="la-dismiss">✕</button>`;
    bar.classList.add('visible');
    bar.querySelector('.la-dismiss').addEventListener('click', () => bar.classList.remove('visible'));
    setTimeout(() => bar.classList.remove('visible'), duration);
  }

  function _checkTimeBasedTheme() {
    const h = new Date().getHours();
    if (h >= 20 || h < 7) {
      // Night mode — ensure dark
      if (document.body.classList.contains('light-mode')) {
        if (typeof Theme !== 'undefined') Theme.applyLightMode(false);
        showActivity('🌙', 'Nachtmodus aktiviert');
      }
    }
  }

  function _scheduleRandomEvents() {
    const EVENTS = [
      { prob: 0.3, delay:[60,180], fn:() => showActivity('🔄','WebOS Update verfügbar',4000) },
      { prob: 0.25, delay:[90,240], fn:() => {
        const friends = ['Alex','Sarah','Max','Luna'];
        const f = friends[Math.floor(Math.random()*friends.length)];
        _showFriendPopup(f);
      }},
      { prob: 0.2, delay:[120,300], fn:() => showActivity('☁️','Cloud-Backup abgeschlossen',3000) },
    ];

    EVENTS.forEach(ev => {
      const schedule = () => {
        const delay = (ev.delay[0] + Math.random()*(ev.delay[1]-ev.delay[0])) * 1000;
        setTimeout(() => { if (Math.random() < ev.prob) ev.fn(); schedule(); }, delay);
      };
      schedule();
    });
  }

  function _showFriendPopup(name) {
    const icons = { Alex:'😎', Sarah:'🧑‍💻', Max:'🎮', Luna:'🌙' };
    const popup = document.createElement('div'); popup.className = 'friend-popup';
    popup.innerHTML = `<div class="fp-avatar">${icons[name]||'👤'}</div><div class="fp-text"><div class="fp-name">${name}</div><div class="fp-status">ist jetzt online 🟢</div></div>`;
    document.body.appendChild(popup);
    setTimeout(() => { popup.style.animation='toast-out .25s ease both'; popup.addEventListener('animationend',()=>popup.remove(),{once:true}); }, 4000);
  }

  return { init, showActivity };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SYSTEM UPDATE SIMULATION
═══════════════════════════════════════════════════ */
const SystemUpdate = (() => {
  const VERSIONS = ['3.1.0', '3.2.0', '4.0.0-beta'];
  let dialog = null;
  let currentVer = localStorage.getItem('webos_version') || '3.0.0';

  function init() {
    dialog = document.getElementById('update-dialog');
    if (!dialog) { dialog = document.createElement('div'); dialog.id='update-dialog'; document.body.appendChild(dialog); }
    // Check for update 8 seconds after boot
    setTimeout(() => {
      if (!localStorage.getItem('webos_update_seen_' + VERSIONS[0])) offerUpdate(VERSIONS[0]);
    }, 8000);
  }

  function offerUpdate(version) {
    const notes = ['Neues Plugin-System', 'Verbesserte Performance', 'Bug-Fixes & Verbesserungen', 'Neue Themes'];
    dialog.innerHTML = `
      <div class="update-card">
        <div class="update-icon">⬆️</div>
        <div class="update-title">WebOS Update verfügbar</div>
        <div class="update-desc">Version ${currentVer} → <strong style="color:white">${version}</strong></div>
        <div class="update-notes">
          <div class="update-notes-title">Neues in Version ${version}</div>
          ${notes.map(n=>`<div class="update-note">${n}</div>`).join('')}
        </div>
        <div id="update-progress-wrap" style="display:none">
          <div class="update-progress"><div class="update-progress-fill" id="upd-fill"></div></div>
          <div class="update-pct" id="upd-pct">0%</div>
        </div>
        <div class="update-btn-row">
          <button class="update-btn secondary" id="upd-later">Später</button>
          <button class="update-btn primary" id="upd-install">Jetzt installieren</button>
        </div>
      </div>`;
    dialog.classList.add('open');

    dialog.querySelector('#upd-later').addEventListener('click', () => {
      dialog.classList.remove('open');
      localStorage.setItem('webos_update_seen_' + version, '1');
    });
    dialog.querySelector('#upd-install').addEventListener('click', () => installUpdate(version));
  }

  function installUpdate(version) {
    const fillEl = document.getElementById('upd-fill');
    const pctEl  = document.getElementById('upd-pct');
    const btnRow = dialog.querySelector('.update-btn-row');
    document.getElementById('update-progress-wrap').style.display = 'block';
    btnRow.style.display = 'none';
    dialog.querySelector('.update-desc').textContent = '⏳ Wird installiert…';

    let pct = 0;
    const interval = setInterval(() => {
      pct += Math.random() * 8 + 2;
      if (pct >= 100) { pct = 100; clearInterval(interval); _finishUpdate(version); }
      fillEl.style.width = pct + '%';
      pctEl.textContent = Math.round(pct) + '%';
    }, 150);
  }

  function _finishUpdate(version) {
    currentVer = version;
    localStorage.setItem('webos_version', version);
    localStorage.setItem('webos_update_seen_' + version, '1');
    dialog.classList.remove('open');
    Toast.showInteractive({
      title: `WebOS ${version} installiert! 🎉`,
      icon: '✅',
      msg: 'Alle neuen Features sind verfügbar.',
      duration: 5000,
      actions: [{ label:'Entdecken', primary: true, cb: () => AppManager.open('plugins') }]
    });
    SoundSystem && SoundSystem.play('install');
  }

  return { init, offerUpdate };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SESSION RESTORE
═══════════════════════════════════════════════════ */
const SessionRestore = (() => {
  const KEY = 'webos_last_session';

  function save() {
    const wins = [];
    WindowManager.getAllWins().forEach((w, id) => {
      wins.push({ app: w.app, title: w.title, meta: w.meta || {} });
    });
    if (wins.length) localStorage.setItem(KEY, JSON.stringify({ wins, time: new Date().toLocaleString('de-DE'), desk: DesktopManager.getCurrent() }));
  }

  function checkRestore() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!saved || !saved.wins?.length) return;
      const dialog = document.createElement('div'); dialog.id = 'session-restore-dialog'; dialog.className = 'visible';
      dialog.innerHTML = `
        <div class="srd-icon">🕐</div>
        <div class="srd-info">
          <div class="srd-title">Letzte Sitzung wiederherstellen?</div>
          <div class="srd-desc">${saved.wins.length} Fenster · ${saved.time}</div>
        </div>
        <button class="srd-btn srd-dismiss">Nein</button>
        <button class="srd-btn srd-restore">Wiederherstellen</button>`;
      document.body.appendChild(dialog);
      dialog.querySelector('.srd-dismiss').addEventListener('click', () => dialog.remove());
      dialog.querySelector('.srd-restore').addEventListener('click', () => {
        dialog.remove();
        saved.wins.slice(0, 6).forEach((w, i) => {
          setTimeout(() => AppManager.open(w.app), i * 200);
        });
        Toast.show(`${saved.wins.length} Fenster wiederhergestellt`, '🕐');
      });
      setTimeout(() => { if (dialog.parentNode) dialog.remove(); }, 12000);
    } catch {}
  }

  function init() {
    // Save session every 30s
    setInterval(save, 30000);
    // Save on page hide
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
    // Check restore 2s after boot
    setTimeout(checkRestore, 2000);
  }

  return { init, save };
})();

/* ═══════════════════════════════════════════════════
   MODULE: SOCIAL PANEL
═══════════════════════════════════════════════════ */
const SocialSystem = (() => {
  let panel = null;
  let btn   = null;
  let open  = false;

  const FRIENDS = [
    { name:'Alex',  avatar:'😎', status:'online',  activity:'Spielt Snake' },
    { name:'Sarah', avatar:'🧑‍💻', status:'online',  activity:'Schreibt Code' },
    { name:'Max',   avatar:'🎮', status:'away',    activity:'Abwesend' },
    { name:'Luna',  avatar:'🌙', status:'online',  activity:'Hört Musik' },
    { name:'Jonas', avatar:'☕', status:'offline', activity:'Offline' },
  ];

  function init() {
    // Add friends button to menubar
    const mbRight = document.querySelector('.menubar-right');
    if (!mbRight) return;
    btn = document.createElement('span');
    btn.className = 'menubar-icon'; btn.title = 'Freunde'; btn.textContent = '👥';
    btn.style.cursor = 'pointer'; btn.style.position = 'relative';
    btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    mbRight.insertBefore(btn, mbRight.firstChild);

    // Panel
    panel = document.createElement('div'); panel.id = 'social-panel';
    panel.innerHTML = `<div class="social-header"><span class="social-title">👥 Freunde</span><button class="social-close">✕</button></div><div class="social-friends"></div>`;
    panel.querySelector('.social-close').addEventListener('click', () => toggle(false));
    document.body.appendChild(panel);
    document.addEventListener('click', e => { if (open && !panel.contains(e.target) && e.target !== btn) toggle(false); });

    _render();
  }

  function toggle(force) {
    open = force !== undefined ? force : !open;
    panel.classList.toggle('open', open);
  }

  function _render() {
    const list = panel.querySelector('.social-friends');
    FRIENDS.forEach(f => {
      const item = document.createElement('div'); item.className = 'friend-item';
      item.innerHTML = `<div class="friend-avatar">${f.avatar}<div class="friend-dot ${f.status}"></div></div><div class="friend-name">${f.name}</div><div class="friend-status">${f.activity}</div><button class="friend-msg-btn" title="Nachricht senden">💬</button>`;
      item.querySelector('.friend-msg-btn').addEventListener('click', e => { e.stopPropagation(); AppManager.open('chat'); toggle(false); });
      list.appendChild(item);
    });
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════
   MODULE: FPS COUNTER
═══════════════════════════════════════════════════ */
const FPSCounter = (() => {
  let el = null; let frames = 0; let lastTime = performance.now(); let enabled = false;

  function init() {
    el = document.getElementById('fps-counter');
    if (!el) { el = document.createElement('div'); el.id = 'fps-counter'; document.body.appendChild(el); }
    _loop();
  }

  function _loop() {
    frames++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      if (enabled && el) { el.textContent = frames + ' FPS'; const color = frames>=55?'#30d158':frames>=30?'#ff9f0a':'#ff453a'; el.style.color=color; }
      frames = 0; lastTime = now;
    }
    requestAnimationFrame(_loop);
  }

  function toggle(on) {
    enabled = on !== undefined ? on : !enabled;
    if (el) el.classList.toggle('visible', enabled);
  }

  return { init, toggle, get enabled() { return enabled; } };
})();

/* ═══════════════════════════════════════════════════
   MODULE: WINDOW ERROR SIMULATOR
═══════════════════════════════════════════════════ */
const WindowErrors = (() => {
  function showError(windowId, appName) {
    // Shake the window first
    const w = WindowManager.getWin(windowId);
    if (w) { w.el.classList.add('shake'); w.el.addEventListener('animationend',()=>w.el.classList.remove('shake'),{once:true}); }

    const overlay = document.createElement('div'); overlay.className = 'error-dialog-overlay';
    const codes = ['0x8007000E','0xC0000005','KERN_INVALID_ADDRESS','EXC_BAD_ACCESS'];
    const code  = codes[Math.floor(Math.random()*codes.length)];
    overlay.innerHTML = `
      <div class="error-dialog-card">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="ed-icon">⚠️</div>
          <div>
            <div class="ed-title">"${appName}" reagiert nicht</div>
            <div class="ed-msg">Diese App antwortet nicht mehr. Du kannst warten oder die App beenden.</div>
          </div>
        </div>
        <div class="ed-code">Error: ${code}</div>
        <div class="ed-actions">
          <button class="ed-btn wait">Warten</button>
          <button class="ed-btn force">App beenden</button>
        </div>
      </div>`;
    overlay.querySelector('.ed-btn.wait').addEventListener('click', () => overlay.remove());
    overlay.querySelector('.ed-btn.force').addEventListener('click', () => {
      overlay.remove();
      if (windowId) WindowManager.close(windowId);
      Toast.show(`"${appName}" wurde beendet`, '🔴');
      SoundSystem && SoundSystem.play('error');
    });
    document.body.appendChild(overlay);
  }

  function simulateRandomError() {
    const wins = [...WindowManager.getAllWins()];
    if (!wins.length) return;
    const [id, w] = wins[Math.floor(Math.random() * wins.length)];
    const appName = w.title.replace(/^[^\s]+\s/, '');
    showError(id, appName);
  }

  return { showError, simulateRandomError };
})();

/* ═══════════════════════════════════════════════════
   SIGNATURE FEATURE: TIME WARP
   Pause, slow-motion, or fast-forward all animations
═══════════════════════════════════════════════════ */
const TimeWarp = (() => {
  let currentMode = 'normal';
  let warpBtn = null, warpPanel = null;
  let panelOpen = false;

  const MODES = [
    { id:'normal', icon:'▶️', label:'Normal', desc:'Normaler Zeitfluss (1×)', speed:1 },
    { id:'slow',   icon:'🐌', label:'Zeitlupe', desc:'Alles super langsam (0.2×)', speed:0.2 },
    { id:'fast',   icon:'⚡', label:'Zeitraffer', desc:'Superschnell (0.15×)', speed:0.15 },
    { id:'pause',  icon:'⏸️', label:'Zeit einfrieren', desc:'Alle Animationen pausiert', speed:0 },
  ];

  function init() {
    // Button
    warpBtn = document.createElement('div'); warpBtn.id = 'timewarp-btn'; warpBtn.title = '⏱ Time Warp (WebOS Signature Feature)'; warpBtn.textContent = '⏱';
    warpBtn.addEventListener('click', () => togglePanel());
    document.body.appendChild(warpBtn);

    // Panel
    warpPanel = document.createElement('div'); warpPanel.id = 'timewarp-panel';
    warpPanel.innerHTML = `<div class="tw-title"><span>⏱</span> Time Warp</div><div class="tw-desc">Steuere den Zeitfluss aller System-Animationen</div><div class="tw-modes" id="tw-modes-list"></div>`;
    document.body.appendChild(warpPanel);
    document.addEventListener('click', e => { if (panelOpen && !warpPanel.contains(e.target) && e.target !== warpBtn) togglePanel(false); });

    _renderModes();

    // Idle screen
    const idle = document.createElement('div'); idle.id = 'idle-screen';
    document.body.appendChild(idle);
  }

  function _renderModes() {
    const list = warpPanel.querySelector('#tw-modes-list');
    list.innerHTML = '';
    MODES.forEach(m => {
      const el = document.createElement('div'); el.className = `tw-mode${m.id===currentMode?' active':''}`;
      el.innerHTML = `<div class="tw-mode-icon">${m.icon}</div><div class="tw-mode-info"><div class="tw-mode-label">${m.label}</div><div class="tw-mode-desc">${m.desc}</div></div>`;
      el.addEventListener('click', () => activate(m.id));
      list.appendChild(el);
    });
  }

  function activate(modeId) {
    const mode = MODES.find(m => m.id === modeId); if (!mode) return;
    currentMode = modeId;

    // Remove previous classes
    document.body.classList.remove('timewarp-pause','timewarp-slow','timewarp-fast','timewarp-active');

    if (modeId === 'normal') {
      document.documentElement.style.setProperty('--anim-speed', '1');
      warpBtn.classList.remove('active'); warpBtn.textContent = '⏱';
    } else {
      document.body.classList.add('timewarp-active');
      if (modeId === 'pause') { document.body.classList.add('timewarp-pause'); warpBtn.textContent = '⏸'; }
      if (modeId === 'slow')  { document.documentElement.style.setProperty('--anim-speed','4'); warpBtn.textContent = '🐌'; }
      if (modeId === 'fast')  { document.documentElement.style.setProperty('--anim-speed','0.2'); warpBtn.textContent = '⚡'; }
      warpBtn.classList.add('active');
    }

    _renderModes();
    LiveActivity.showActivity(mode.icon, `Time Warp: ${mode.label}`);
    SoundSystem && SoundSystem.play('notification');
    togglePanel(false);
  }

  function togglePanel(force) {
    panelOpen = force !== undefined ? force : !panelOpen;
    warpPanel.classList.toggle('open', panelOpen);
  }

  return { init, activate };
})();

/* ═══════════════════════════════════════════════════
   EASTER EGGS
═══════════════════════════════════════════════════ */
const EasterEggs = (() => {
  const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let konamiIdx = 0;

  function init() {
    // Konami code
    document.addEventListener('keydown', e => {
      if (e.key === KONAMI[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === KONAMI.length) {
          konamiIdx = 0; _activateKonami();
        }
      } else { konamiIdx = 0; }
    });

    // Terminal easter eggs
    window.__terminalPlugins = window.__terminalPlugins || {};
    window.__terminalPlugins['matrix'] = (a, p) => { _matrixEffect(); p('Entering the Matrix…', 't-info'); return true; };
    window.__terminalPlugins['crash']  = (a, p) => { setTimeout(() => WindowErrors.simulateRandomError(), 500); p('Simulating crash…', 't-warn'); return true; };
    window.__terminalPlugins['party']  = (a, p) => { _partyMode(); p('🎉 PARTY MODE!', 't-info'); return true; };
    window.__terminalPlugins['fps']    = (a, p) => { FPSCounter.toggle(); p('FPS-Anzeige umgeschaltet', 't-info'); return true; };
    window.__terminalPlugins['timewarp']=(a, p) => {
      const mode = a[0] || 'slow';
      TimeWarp.activate(mode);
      p(`Time Warp: ${mode}`, 't-info'); return true;
    };
    window.__terminalPlugins['error']  = (a, p) => { WindowErrors.simulateRandomError(); return true; };
  }

  function _activateKonami() {
    document.body.classList.add('konami-flash');
    setTimeout(() => document.body.classList.remove('konami-flash'), 1200);
    Toast.showInteractive({ title:'🎮 Konami Code!', icon:'🕹️', msg:'+30 Leben geschenkt. Just kidding.',
      duration:4000, actions:[{label:'🎮 Spiele öffnen', primary:true, cb:()=>AppManager.open('games')}] });
    typeof Achievements !== 'undefined' && Achievements.unlock('konami');
    SoundSystem && SoundSystem.play('install');
  }

  function _matrixEffect() {
    const overlay = document.createElement('canvas');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;';
    overlay.width = window.innerWidth; overlay.height = window.innerHeight;
    document.body.appendChild(overlay);
    const ctx = overlay.getContext('2d');
    const cols = Math.floor(overlay.width / 14);
    const drops = Array(cols).fill(1);
    let frames = 0;
    const interval = setInterval(() => {
      ctx.fillStyle = 'rgba(0,0,0,0.05)'; ctx.fillRect(0,0,overlay.width,overlay.height);
      ctx.fillStyle = '#30d158'; ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        ctx.fillText(String.fromCharCode(0x30A0+Math.random()*96), i*14, y*14);
        if (y*14>overlay.height && Math.random()>0.975) drops[i]=0;
        drops[i]++;
      });
      if (++frames > 200) { clearInterval(interval); overlay.remove(); }
    }, 40);
  }

  function _partyMode() {
    const colors = ['#ff453a','#ffd60a','#30d158','#0a84ff','#bf5af2','#ff9f0a'];
    let i = 0;
    const interval = setInterval(() => {
      document.documentElement.style.setProperty('--accent', colors[i % colors.length]);
      if (++i > 18) { clearInterval(interval); document.documentElement.style.setProperty('--accent', State.get().accentColor || '#0a84ff'); }
    }, 300);
    Toast.show('🎉 Party Mode! 30 Sekunden Spaß!', '🎨');
  }

  return { init };
})();

/* ═══════════════════════════════════════════════════
   TERMINAL: v3 commands
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  window.__terminalPlugins = window.__terminalPlugins || {};
  window.__terminalPlugins['plugins'] = (a, p) => { AppManager.open('plugins'); p('Plugin Manager geöffnet','t-info'); return true; };
  window.__terminalPlugins['sdk']     = (a, p) => { AppManager.open('sdk');     p('SDK geöffnet','t-info'); return true; };
  window.__terminalPlugins['profile'] = (a, p) => { AppManager.open('profile'); p('Profil geöffnet','t-info'); return true; };
  window.__terminalPlugins['update']  = (a, p) => { SystemUpdate.offerUpdate('4.0.0'); return true; };
  window.__terminalPlugins['session'] = (a, p) => { SessionRestore.save(); p('Sitzung gespeichert','t-info'); return true; };
  window.__terminalPlugins['friends'] = (a, p) => { AppManager.open('chat'); return true; };
  window.__terminalPlugins['shake']   = (a, p) => {
    let maxZ=-1,topId=null;
    WindowManager.getAllWins().forEach((w,id)=>{const z=parseInt(w.el.style.zIndex)||0;if(z>maxZ){maxZ=z;topId=id;}});
    if(topId){const w=WindowManager.getWin(topId);w.el.classList.add('shake');w.el.addEventListener('animationend',()=>w.el.classList.remove('shake'),{once:true});}
    return true;
  };
});

/* ═══════════════════════════════════════════════════
   DOCK ICONS FOR NEW APPS
═══════════════════════════════════════════════════ */
function _injectV3DockIcons() {
  const dockApps = document.getElementById('dock-apps');
  if (!dockApps) return;
  const sep = dockApps.querySelector('.dock-separator');

  const icons = [
    ['plugins', '🧩 Plugins', '<rect width="48" height="48" rx="12" fill="#14003a"/><circle cx="24" cy="24" r="8" fill="#bf5af2" opacity=".3" stroke="#bf5af2" stroke-width="2"/><line x1="24" y1="10" x2="24" y2="16" stroke="#bf5af2" stroke-width="2.5" stroke-linecap="round"/><line x1="24" y1="32" x2="24" y2="38" stroke="#bf5af2" stroke-width="2.5" stroke-linecap="round"/><line x1="10" y1="24" x2="16" y2="24" stroke="#bf5af2" stroke-width="2.5" stroke-linecap="round"/><line x1="32" y1="24" x2="38" y2="24" stroke="#bf5af2" stroke-width="2.5" stroke-linecap="round"/>'],
    ['profile', '👤 Profil', '<rect width="48" height="48" rx="12" fill="#1a1a2e"/><circle cx="24" cy="18" r="8" fill="#0a84ff" opacity=".7"/><path d="M8 40 C8 32 40 32 40 40" fill="#0a84ff" opacity=".5"/>'],
  ];
  icons.forEach(([app, label, svg]) => {
    if (dockApps.querySelector(`.dock-item[data-app="${app}"]`)) return;
    const item = document.createElement('div'); item.className='dock-item'; item.dataset.app=app; item.title=label.split(' ')[1];
    item.innerHTML=`<div class="dock-icon"><svg viewBox="0 0 48 48" width="48" height="48">${svg}</svg></div><span class="dock-label">${label.split(' ')[1]}</span>`;
    item.addEventListener('click',()=>AppManager.open(app));
    if(sep)dockApps.insertBefore(item,sep);else dockApps.appendChild(item);
  });
}

/* ═══════════════════════════════════════════════════
   MAIN v3 INIT
═══════════════════════════════════════════════════ */
Events.on('os:started', () => {
  PluginSystem.init();
  LiveActivity.init();
  SystemUpdate.init();
  SessionRestore.init();
  SocialSystem.init();
  FPSCounter.init();
  TimeWarp.init();
  EasterEggs.init();
  _injectV3DockIcons();

  // Track app opens for profile stats
  Events.on('window:open', (id, app) => {
    _incStat('apps');
    if (app === 'game') _incStat('games');
  });

  // Extend context menu on desktop with new options
  const origCM = ContextMenu.show.bind(ContextMenu);
  ContextMenu.show = function(e, items) {
    // Inject share option for file context menus
    const hasOpenAction = items.some(i => i.label === 'Öffnen');
    if (hasOpenAction && items.length < 10) {
      const shareIdx = items.findIndex(i => i.separator) + 1 || items.length;
      items.splice(shareIdx, 0, {
        icon:'🔗', label:'Teilen…',
        action: () => {
          const link = `webos://share/${btoa(Date.now().toString()).slice(0,8)}`;
          navigator.clipboard?.writeText(link).catch(()=>{});
          Toast.show('Link kopiert: ' + link.slice(0,28) + '…', '🔗');
        }
      });
    }
    return origCM(e, items);
  };

  // Log to DevMode
  if (typeof DevMode !== 'undefined') {
    DevMode.log('WebOS v3 Platform geladen', 'system');
    DevMode.log('Plugins · SDK · TimeWarp · Social · Easter Eggs', 'system');
  }

  Toast.show('WebOS v3 bereit — probiere ↑↑↓↓←→←→BA 😉', '⚡', 5000);
});
