// src/preload/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenTracker', {
  app: {
    version: () => ipcRenderer.invoke('app:getVersion'),
  },
  pty: {
    start: (opts) => ipcRenderer.invoke('pty:start', opts),
    write: (input) => ipcRenderer.send('pty:write', input),
    resize: (cols, rows) => ipcRenderer.send('pty:resize', { cols, rows }),
    onData: (callback) => ipcRenderer.on('pty:data', (_event, data) => callback(data)),
  },
  dashboard: {
    getState: () => ipcRenderer.invoke('dashboard:getState'),
    setPeriod: (period) => ipcRenderer.invoke('dashboard:setPeriod', period),
    onUpdate: (callback) => ipcRenderer.on('dashboard:update', (_event, state) => callback(state)),
  },
  budget: {
    get: () => ipcRenderer.invoke('budget:get'),
    set: (budgets) => ipcRenderer.invoke('budget:set', budgets),
    deriveFromMonthly: (n) => ipcRenderer.invoke('budget:deriveFromMonthly', n),
  },
  theme: {
    get: () => ipcRenderer.invoke('theme:get'),
    set: (payload) => ipcRenderer.invoke('theme:set', payload),
  },
  panels: {
    get: () => ipcRenderer.invoke('panels:get'),
    set: (payload) => ipcRenderer.invoke('panels:set', payload),
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text),
    read: () => ipcRenderer.invoke('clipboard:read'),
  },
  ui: {
    get: () => ipcRenderer.invoke('ui:get'),
    set: (partial) => ipcRenderer.invoke('ui:set', partial),
  },
  alerts: {
    get: () => ipcRenderer.invoke('alerts:get'),
    set: (partial) => ipcRenderer.invoke('alerts:set', partial),
    ranges: () => ipcRenderer.invoke('alerts:ranges'),
  },
  optimize: {
    targets: () => ipcRenderer.invoke('optimize:targets'),
    apply: (payload) => ipcRenderer.invoke('optimize:apply', payload),
  },
  fleet: {
    pickFolder: () => ipcRenderer.invoke('fleet:pickFolder'),
    connect: (folderPath) => ipcRenderer.invoke('fleet:connect', folderPath),
    getState: () => ipcRenderer.invoke('fleet:getState'),
  },
  shortcuts: {
    map: () => ipcRenderer.invoke('shortcuts:map'),
  },
  window: {
    setMini: (on) => ipcRenderer.invoke('window:setMini', on),
  },
  plan: {
    sync: () => ipcRenderer.invoke('plan:sync'),
  },
  export: {
    run: (payload) => ipcRenderer.invoke('export:run', payload),
  },
});
