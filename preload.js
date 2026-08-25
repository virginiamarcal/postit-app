const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getToday: () => ipcRenderer.invoke('tasks:getToday'),
  getUpcoming: () => ipcRenderer.invoke('tasks:getUpcoming'),
  addTask: (payload) => ipcRenderer.invoke('tasks:add', payload),
  toggleDone: (id) => ipcRenderer.invoke('tasks:toggleDone', id),
  deleteTask: (id) => ipcRenderer.invoke('tasks:delete', id),
  updatePos: (id, x, y) => ipcRenderer.invoke('tasks:updatePos', { id, x, y }),
  listSkins: () => ipcRenderer.invoke('skins:list'),
  getSkin: () => ipcRenderer.invoke('skins:current'),
  setSkin: (id) => ipcRenderer.invoke('skins:set', id),
  onSkinChanged: (cb) => ipcRenderer.on('skin-changed', (_e, skin) => cb(skin)),
  getPinned: () => ipcRenderer.invoke('pin:get'),
  togglePinned: () => ipcRenderer.invoke('pin:toggle'),
  onPinChanged: (cb) => ipcRenderer.on('pin-changed', (_e, pinned) => cb(pinned)),
  openBoard: () => ipcRenderer.invoke('board:open'),
  hidePanel: () => ipcRenderer.invoke('panel:hide'),
  closeBoard: () => ipcRenderer.invoke('board:close'),
  getTodayStr: () => ipcRenderer.invoke('today:get'),
  onTasksChanged: (cb) => ipcRenderer.on('tasks-changed', cb),
});
