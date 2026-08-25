const { app, BrowserWindow, Tray, Menu, ipcMain, screen, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');

app.setName('Post-it');
if (process.platform === 'win32') app.setAppUserModelId('com.virginia.postit');

const ASSETS = path.join(__dirname, 'assets');
let tray = null;
let panelWin = null;
let boardWin = null;
let store = null;
let blinkTimer = null;
let blinkState = false;

// ---- peles (papéis do post-it) ----
const SKINS_DIR = path.join(ASSETS, 'skins');
let skins = [];

function loadSkins() {
  try {
    const raw = fs.readFileSync(path.join(SKINS_DIR, 'skins.json'), 'utf-8');
    skins = JSON.parse(raw).skins || [];
  } catch (err) {
    console.error('Não consegui ler assets/skins/skins.json:', err.message);
    skins = [];
  }
}

function currentSkin() {
  if (!skins.length) return null;
  const id = store.getSetting('skinId', null);
  return skins.find((s) => s.id === id) || skins[0];
}

const skinIcon = (file) => {
  const skin = currentSkin();
  if (!skin) return nativeImage.createEmpty();
  return nativeImage.createFromPath(path.join(SKINS_DIR, skin.id, file));
};

const iconNormal = () => skinIcon('tray.png');
const iconAlert = () => skinIcon('tray-alert.png');

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function updateAlertState() {
  const pending = store.hasPendingToday(todayStr());

  if (!pending) {
    if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
    if (tray) {
      tray.setImage(iconNormal());
      tray.setToolTip('Post-it — nada pendente hoje');
    }
    if (panelWin && !panelWin.isDestroyed()) {
      panelWin.flashFrame(false);
      panelWin.setOverlayIcon(null, '');
    }
    return;
  }

  if (tray) tray.setToolTip('Post-it — você tem pendências hoje');
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.setOverlayIcon(iconAlert(), 'Você tem pendências hoje');
  }

  if (!blinkTimer) {
    blinkTimer = setInterval(() => {
      blinkState = !blinkState;
      if (tray) tray.setImage(blinkState ? iconAlert() : iconNormal());
      // pisca o botão do app na barra de tarefas, junto dos programas abertos
      if (panelWin && !panelWin.isDestroyed() && !panelWin.isFocused()) {
        panelWin.flashFrame(true);
      }
    }, 700);
  }
}

const PANEL_W = 420;
const PANEL_H = 600;
const BLUR_GRACE_MS = 600;
let shownAt = 0;

const isPinned = () => store.getSetting('pinned', false);

// Fixado: a janela fica presa na tela, arrastável e sem minimizar ao perder o foco.
function applyPinState() {
  if (!panelWin || panelWin.isDestroyed()) return;
  const pinned = isPinned();
  panelWin.setAlwaysOnTop(true);
  panelWin.setVisibleOnAllWorkspaces(pinned);
  panelWin.webContents.send('pin-changed', pinned);
  if (tray) tray.setContextMenu(buildContextMenu());
}

function setPinned(value) {
  store.setSetting('pinned', value);
  if (value && panelWin && !panelWin.isDestroyed()) showPanel();
  applyPinState();
}

function setSkin(id) {
  if (!skins.some((s) => s.id === id)) return;
  store.setSetting('skinId', id);
  if (tray) {
    tray.setImage(store.hasPendingToday(todayStr()) ? iconAlert() : iconNormal());
    tray.setContextMenu(buildContextMenu());
  }
  for (const w of [panelWin, boardWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('skin-changed', currentSkin());
  }
  updateAlertState();
}

function broadcastChange() {
  updateAlertState();
  for (const w of [panelWin, boardWin]) {
    if (w && !w.isDestroyed()) w.webContents.send('tasks-changed');
  }
}

function createPanel() {
  panelWin = new BrowserWindow({
    width: PANEL_W,
    height: PANEL_H,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    // fica na barra de tarefas junto dos programas abertos, para poder piscar lá
    skipTaskbar: false,
    alwaysOnTop: true,
    title: 'Post-it',
    icon: path.join(SKINS_DIR, currentSkin() ? currentSkin().id : '', 'app.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  panelWin.loadFile(path.join(__dirname, 'renderer', 'panel.html'));

  // Sai da frente sozinho, mas minimiza (não esconde) para manter o botão na barra.
  // O blur é ignorado logo após abrir: durante a restauração o Windows dispara
  // blur antes de entregar o foco, o que minimizava a janela de volta na hora.
  panelWin.on('blur', () => {
    if (!panelWin || panelWin.isDestroyed()) return;
    if (isPinned()) return; // fixado: fica preso na tela
    if (panelWin.webContents.isDevToolsOpened()) return;
    if (Date.now() - shownAt < BLUR_GRACE_MS) return;
    if (panelWin.isMinimized() || !panelWin.isVisible()) return;
    panelWin.minimize();
  });

  panelWin.on('focus', () => panelWin.flashFrame(false));

  // Guarda onde a nota foi largada, para ela voltar no mesmo lugar quando fixada.
  panelWin.on('moved', () => {
    if (!panelWin || panelWin.isDestroyed()) return;
    const [x, y] = panelWin.getPosition();
    store.setSetting('panelPos', { x, y });
  });

  // Ao restaurar pela barra de tarefas, reposiciona e reafirma o "sempre no topo"
  // (janela transparente perde essa flag ao voltar do minimizado no Windows).
  panelWin.on('restore', () => {
    shownAt = Date.now();
    positionPanel();
    panelWin.setAlwaysOnTop(true);
    panelWin.flashFrame(false);
  });

  panelWin.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      panelWin.minimize();
    }
  });
}

function positionPanel() {
  // Fixado, respeita o canto onde a usuária largou a nota.
  const saved = store.getSetting('panelPos', null);
  if (isPinned() && saved) {
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return saved.x < a.x + a.width && saved.x + PANEL_W > a.x &&
             saved.y < a.y + a.height && saved.y + PANEL_H > a.y;
    });
    if (visible) {
      panelWin.setBounds({ x: saved.x, y: saved.y, width: PANEL_W, height: PANEL_H });
      return;
    }
  }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const work = display.workArea;
  const x = work.x + work.width - PANEL_W - 12;
  const y = work.y + work.height - PANEL_H - 12;
  panelWin.setBounds({ x, y, width: PANEL_W, height: PANEL_H });
}

function showPanel() {
  shownAt = Date.now();
  if (panelWin.isMinimized()) panelWin.restore();
  positionPanel();
  panelWin.show();
  panelWin.setAlwaysOnTop(true);
  panelWin.focus();
  panelWin.flashFrame(false);
  shownAt = Date.now();
}

function togglePanel() {
  if (!panelWin) createPanel();
  if (panelWin.isVisible() && !panelWin.isMinimized()) {
    panelWin.minimize();
    return;
  }
  showPanel();
}

function createBoard() {
  if (boardWin && !boardWin.isDestroyed()) {
    boardWin.show();
    boardWin.focus();
    return;
  }
  boardWin = new BrowserWindow({
    width: 1000,
    height: 700,
    frame: false,
    show: false,
    title: 'Post-it — agendamentos',
    icon: path.join(SKINS_DIR, currentSkin() ? currentSkin().id : '', 'app.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  boardWin.loadFile(path.join(__dirname, 'renderer', 'board.html'));
  boardWin.once('ready-to-show', () => boardWin.show());
}

function checkToasts() {
  const due = store.getDueForToast(todayStr(), nowHM());
  for (const t of due) {
    store.updateTask(t.id, { notified: true });
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Lembrete',
        body: t.text,
      });
      n.show();
    }
  }
  if (due.length) broadcastChange();
}

function setAutoStart(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: [path.resolve(__dirname)],
  });
  store.setSetting('autoStart', enabled);
}

function buildContextMenu() {
  const autoStart = store.getSetting('autoStart', true);
  return Menu.buildFromTemplate([
    { label: 'Abrir painel', click: () => togglePanel() },
    { label: 'Ver todos os agendamentos', click: () => createBoard() },
    { type: 'separator' },
    {
      label: 'Fixar na tela',
      type: 'checkbox',
      checked: isPinned(),
      click: (item) => setPinned(item.checked),
    },
    {
      label: 'Trocar o papel',
      submenu: skins.map((s) => ({
        label: s.name,
        type: 'radio',
        checked: currentSkin() ? currentSkin().id === s.id : false,
        click: () => setSkin(s.id),
      })),
    },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      checked: autoStart,
      click: (item) => setAutoStart(item.checked),
    },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
}

app.whenReady().then(() => {
  store = new Store(app.getPath('userData'));
  loadSkins();

  if (store.getSetting('autoStart', null) === null) {
    setAutoStart(true);
  }

  tray = new Tray(iconNormal());
  tray.setToolTip('Post-it');
  tray.setContextMenu(buildContextMenu());
  tray.on('click', () => togglePanel());

  // Cria o painel já na largada para existir um botão fixo na barra de tarefas.
  createPanel();
  panelWin.once('ready-to-show', () => {
    positionPanel();
    if (isPinned() || store.hasPendingToday(todayStr())) {
      panelWin.show();
      shownAt = Date.now();
    } else {
      panelWin.showInactive();
      panelWin.minimize();
    }
    applyPinState();
    updateAlertState();
  });

  updateAlertState();
  setInterval(checkToasts, 30 * 1000);
  checkToasts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) togglePanel();
  });
});

app.on('window-all-closed', (e) => {
  e.preventDefault(); // fica vivo na bandeja
});

// ---- IPC ----
ipcMain.handle('tasks:getToday', () => store.getTodayTasks(todayStr()));
ipcMain.handle('tasks:getUpcoming', () => store.getUpcomingTasks(todayStr()));
ipcMain.handle('tasks:add', (_e, payload) => {
  const t = store.addTask(payload);
  broadcastChange();
  return t;
});
ipcMain.handle('tasks:toggleDone', (_e, id) => {
  const list = store.getTasks();
  const t = list.find((x) => x.id === id);
  if (t) store.updateTask(id, { done: !t.done });
  broadcastChange();
  return true;
});
ipcMain.handle('tasks:delete', (_e, id) => {
  store.deleteTask(id);
  broadcastChange();
  return true;
});
ipcMain.handle('tasks:updatePos', (_e, { id, x, y }) => {
  store.updateTask(id, { x, y });
  return true;
});
ipcMain.handle('skins:list', () => ({ skins, currentId: currentSkin()?.id || null }));
ipcMain.handle('skins:current', () => currentSkin());
ipcMain.handle('skins:set', (_e, id) => {
  setSkin(id);
  return currentSkin();
});
ipcMain.handle('pin:get', () => isPinned());
ipcMain.handle('pin:toggle', () => {
  setPinned(!isPinned());
  return isPinned();
});
ipcMain.handle('board:open', () => createBoard());
// Minimiza em vez de esconder: hide() apagaria o botão da barra de tarefas.
ipcMain.handle('panel:hide', () => panelWin && panelWin.minimize());
ipcMain.handle('board:close', () => boardWin && boardWin.close());
ipcMain.handle('today:get', () => todayStr());
