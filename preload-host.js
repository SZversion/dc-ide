const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ide', {
  setTitle: (t) => ipcRenderer.send('win:title', t),
  flash: () => ipcRenderer.send('win:flash'),
  nativeNotify: (title, body) => ipcRenderer.send('win:native-notify', { title, body }),
  onOpenTab: (cb) => ipcRenderer.on('open-tab', (_e, url) => cb(url)),
  onBossToggle: (cb) => ipcRenderer.on('boss-toggle', () => cb()),
  searchGalleries: (keyword) => ipcRenderer.invoke('gall:search', keyword),
});
