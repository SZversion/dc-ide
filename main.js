const { app, BrowserWindow, ipcMain, globalShortcut, Notification, session } = require('electron');
const path = require('path');
const fs = require('fs');

// Look like a plain Chrome to the site (drop the Electron / app tokens from the UA).
app.userAgentFallback = app.userAgentFallback
  .replace(/\sElectron\/\S+/, '')
  .replace(/\sworkspace-ide\/\S+/, '')
  .replace(/\sIntelliJ IDEA\/\S+/, '');
app.setAppUserModelId('com.jetbrains.intellij.workspace');
// Keep login cookies/settings in our own folder (not "%APPDATA%\IntelliJ IDEA").
app.setPath('userData', process.env.IDE_SNAPSHOT
  ? path.join(app.getPath('temp'), 'workspace-ide-snapshot')   // dev screenshots never touch the real profile
  : path.join(app.getPath('appData'), 'workspace-ide'));

const SKIN_CSS = fs.readFileSync(path.join(__dirname, 'skin', 'dc-skin.css'), 'utf8');
const BOSS_KEY = 'CommandOrControl+Shift+F12';

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 560,
    title: 'workspace – Main.java',
    backgroundColor: '#1e1f22',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#2b2d30', symbolColor: '#dfe1e5', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload-host.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // The page <title> would otherwise leak into the taskbar.
  win.on('page-title-updated', (e) => e.preventDefault());
}

// Lock down every <webview> and give it our preload.
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (_ev, webPreferences, params) => {
    delete webPreferences.preloadURL;
    webPreferences.preload = path.join(__dirname, 'webview-preload.js');
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    if (!/^https:\/\/([a-z0-9-]+\.)*dcinside\.com\//i.test(params.src || '')) {
      params.src = 'https://gall.dcinside.com/';
    }
  });

  if (contents.getType() !== 'webview') return;

  // window.open / target=_blank → new editor tab instead of a stray Electron window.
  contents.setWindowOpenHandler(({ url }) => {
    // Social sign-in (reddit → Google / Apple) must stay a real popup: it hands the result back to its opener.
    if (/^https:\/\/(accounts\.google\.com|appleid\.apple\.com)\//i.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 520, height: 680, autoHideMenuBar: true, backgroundColor: '#1e1f22' } };
    }
    if (/^https?:/i.test(url) && win) win.webContents.send('open-tab', url);
    return { action: 'deny' };
  });

  // Same-origin iframes (e.g. editor frames) get the skin too.
  contents.on('did-frame-finish-load', () => {
    for (const f of contents.mainFrame.framesInSubtree) {
      if (f === contents.mainFrame) continue;
      try {
        if (/dcinside\.com/.test(f.url)) {
          f.executeJavaScript(
            `(()=>{if(document.getElementById('__ide_skin'))return;const s=document.createElement('style');s.id='__ide_skin';s.textContent=${JSON.stringify(SKIN_CSS)};(document.head||document.documentElement).appendChild(s);})()`
          ).catch(() => {});
        }
      } catch (_) { /* cross-origin frame, ignore */ }
    }
  });
});

ipcMain.on('get-skin-css', (e) => { e.returnValue = SKIN_CSS; });

// Gallery search (same autocomplete API the site's header search box uses).
// Done here in the main process so the renderer needs no cross-origin access.
const dcEncode = (s) => encodeURIComponent(s)
  .replace(/\./g, '%2E').replace(/~/g, '%7E').replace(/!/g, '%21').replace(/\*/g, '%2A')
  .replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/'/g, '%27').replace(/%/g, '.');
ipcMain.handle('gall:search', async (_e, keyword) => {
  const kw = String(keyword || '').trim().slice(0, 50);
  if (!kw) return [];
  const url = `https://search.dcinside.com/autocomplete?callback=cb&t=${Date.now()}&k=${dcEncode(kw)}`;
  const res = await session.fromPartition('persist:dc').fetch(url, {
    headers: { Referer: 'https://gall.dcinside.com/' },
  });
  const text = await res.text();
  const m = text.match(/^[^(]*\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) return [];
  const json = JSON.parse(m[1]);
  const out = [];
  for (const section of ['gallery', 'prgallery']) {
    const g = json[section];
    if (!g) continue;
    for (const [k, v] of Object.entries(g)) {
      if (!/^\d+$/.test(k) || !v || typeof v !== 'object') continue;
      if (!/^https:\/\/gall\.dcinside\.com\//.test(v.link || '')) continue;
      out.push({
        id: v.name, name: v.ko_name, type: v.gall_type || (section === 'prgallery' ? 'PR' : ''),
        link: v.link, rank: Number(v.rank) || 0, newPost: Number(v.new_post) || 0,
      });
    }
  }
  return out;
});
ipcMain.on('win:title', (_e, t) => { if (win) win.setTitle(String(t).slice(0, 120)); });
ipcMain.on('win:flash', () => { if (win && !win.isFocused()) win.flashFrame(true); });
ipcMain.on('win:native-notify', (_e, { title, body }) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, silent: true });
  n.on('click', () => { if (win) { win.show(); win.focus(); } });
  n.show();
});

app.whenReady().then(() => {
  // Deny camera/mic/geolocation etc. requested by the site; allow notifications/clipboard only.
  session.fromPartition('persist:dc').setPermissionRequestHandler((_wc, perm, cb) => {
    cb(['clipboard-sanitized-write', 'fullscreen'].includes(perm));
  });

  createWindow();

  globalShortcut.register(BOSS_KEY, () => {
    if (!win) return;
    win.webContents.send('boss-toggle');
  });

  // Dev-only: IDE_SNAPSHOT=out.png [IDE_SNAPSHOT_URL=...] npm start → saves a screenshot and quits.
  if (process.env.IDE_SNAPSHOT) {
    win.webContents.once('did-finish-load', () => {
      if (process.env.IDE_SNAPSHOT_URL) win.webContents.send('open-tab', process.env.IDE_SNAPSHOT_URL);
      setTimeout(async () => {
        if (process.env.IDE_SNAPSHOT_BOSS) win.webContents.send('boss-toggle');
        if (process.env.IDE_SNAPSHOT_FAKE_ALARM) {
          const { webContents } = require('electron');
          for (const wc of webContents.getAllWebContents()) {
            if (wc.getType() !== 'webview') continue;
            wc.executeJavaScript(`(()=>{const b=document.querySelector('.alarmPopup'); if(!b) return;
              b.insertAdjacentHTML('beforeend','<div class="pop_content one_noticewrap"><a class="one_notice_txt" href="https://gall.dcinside.com/board/view/?id=programming&no=1476608">[프로그래밍] 테스트 글에 댓글이 달렸습니다.</a></div>');})()`).catch(() => {});
            break;
          }
        }
        if (process.env.IDE_SNAPSHOT_EVAL) {
          const { webContents } = require('electron');
          const guests = webContents.getAllWebContents().filter((w) => w.getType() === 'webview');
          const want = process.env.IDE_SNAPSHOT_URL || '';
          const g = guests.find((w) => want && w.getURL() === want) || guests[guests.length - 1];
          try { console.log('EVAL:', JSON.stringify(await g.executeJavaScript(process.env.IDE_SNAPSHOT_EVAL))); } catch (e) { console.log('EVAL ERR', e.message); }
        }
        if (process.env.IDE_SNAPSHOT_HOST_EVAL) {
          try { console.log('HOST EVAL:', JSON.stringify(await win.webContents.executeJavaScript(process.env.IDE_SNAPSHOT_HOST_EVAL))); } catch (e) { console.log('HOST EVAL ERR', e.message); }
          await new Promise((r) => setTimeout(r, Number(process.env.IDE_SNAPSHOT_HOST_WAIT || 0)));
        }
        win.show(); win.moveTop();
        await new Promise((r) => setTimeout(r, 800));
        const img = await win.webContents.capturePage(undefined, { stayHidden: true });
        fs.writeFileSync(process.env.IDE_SNAPSHOT, img.toPNG());
        app.quit();
      }, Number(process.env.IDE_SNAPSHOT_DELAY || 12000));
    });
  }
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
