const { app, BrowserWindow, Tray, Menu, ipcMain, screen, Notification, nativeImage, shell, dialog, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { Store } = require('./store');

app.setName('Post-it');
if (process.platform === 'win32') app.setAppUserModelId('com.virginia.postit');

// Assinatura: a patinha no rodapé da nota e o "Sobre" na bandeja levam aqui.
const AUTOR = {
  nome: 'Virginia Lara Marçal',
  instagram: 'https://instagram.com/virginiamarcal',
  github: 'https://github.com/virginiamarcal/postit-app',
};

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

const { panelSizeFor } = require('./renderer/skin.js');

// ---- lembrete de água ----
// O gatinho aparece na lateral da tela segurando um copo d'água. O desenho já
// diz o que precisa ser dito, então não há texto na tela: estas frases servem
// de legenda para leitores de tela e para o aviso do Windows, que é o plano B
// quando a skin não tem a arte.
const RECADOS_AGUA = [
  'Hora de se hidratar! 💧',
  'Bebe mais um copo de água… faz bem.',
  'Água! Seu corpo agradece.',
  'Pausa pra um gole de água?',
  'Já bebeu água agora há pouco? Vai lá.',
  'Um copinho de água e já volto a te deixar em paz 😺',
  'Lembrete peludo: água.',
];
const LEMBRETE_SEG = 12;       // quanto tempo fica na tela
// Só pula quem de fato saiu da frente do computador. Cinco minutos era pouco:
// quem assiste uma reunião ou lê uma tela fica meia hora sem tocar no mouse, e
// é justamente essa pessoa que esquece de beber água.
const OCIOSO_SEG = 20 * 60;
// E se pulou porque ela não estava lá, tenta de novo daqui a pouco, em vez de
// perder a vez e sumir até o próximo ciclo.
const RETENTAR_SEG = 3 * 60;
let reminderWin = null;
let lembreteTimer = null;
let aguaTimeout = null;
let retentarTimer = null;
let saidaTimer = null;

const aguaConfig = () => ({
  ativo: false,
  intervaloMin: 60,
  som: true,
  inicioQuieto: 22,  // não incomoda entre 22h
  fimQuieto: 8,      // e 8h da manhã
  ...(store ? store.getSetting('agua', {}) : {}),
});

function dentroDoSilencio(cfg) {
  const h = new Date().getHours();
  // janela que atravessa a meia-noite (ex.: 22h às 8h)
  return cfg.inicioQuieto > cfg.fimQuieto
    ? h >= cfg.inicioQuieto || h < cfg.fimQuieto
    : h >= cfg.inicioQuieto && h < cfg.fimQuieto;
}

const BLUR_GRACE_MS = 600;
let shownAt = 0;

// Cada arte tem o papel numa largura diferente dentro do PNG. A janela se ajusta
// para o papel sair sempre com a mesma largura útil, em vez de sobrar vão
// transparente nas artes de papel estreito.
function panelSize() {
  return panelSizeFor(currentSkin());
}

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
  // O novo papel pode ter outra proporção: a janela acompanha.
  if (panelWin && !panelWin.isDestroyed()) positionPanel();
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
  const size = panelSize();
  panelWin = new BrowserWindow({
    width: size.width,
    height: size.height,
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
  const { width, height } = panelSize();

  // Fixado, respeita o canto onde a usuária largou a nota.
  const saved = store.getSetting('panelPos', null);
  if (isPinned() && saved) {
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return saved.x < a.x + a.width && saved.x + width > a.x &&
             saved.y < a.y + a.height && saved.y + height > a.y;
    });
    if (visible) {
      panelWin.setBounds({ x: saved.x, y: saved.y, width, height });
      return;
    }
  }
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const work = display.workArea;
  const x = work.x + work.width - width - 12;
  const y = work.y + work.height - height - 12;
  panelWin.setBounds({ x, y, width, height });
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

// A arte do lembrete é a do gato escolhido. Se essa skin ainda não tiver uma,
// vale a de qualquer outra: melhor um gatinho diferente do que nenhum aviso.
function arteDeAgua() {
  const atual = currentSkin();
  const ids = [...(atual ? [atual.id] : []), ...skins.map((s) => s.id)];
  for (const id of ids) {
    const arquivo = path.join(SKINS_DIR, id, 'agua.png');
    if (!fs.existsSync(arquivo)) continue;
    const { width, height } = nativeImage.createFromPath(arquivo).getSize();
    if (!width || !height) continue;
    return { url: `file:///${arquivo.replace(/\\/g, '/')}`, width, height };
  }
  return null;
}

function criarReminderWin(arte) {
  reminderWin = new BrowserWindow({
    width: arte.width,
    height: arte.height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // não rouba o foco: não pode interromper quem está digitando, nem
    // minimizar o painel por tirar o foco dele
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  reminderWin.setAlwaysOnTop(true, 'screen-saver');
  reminderWin.loadFile(path.join(__dirname, 'renderer', 'reminder.html'));
  reminderWin.on('closed', () => { reminderWin = null; });
  return reminderWin;
}

// Encostado na borda direita, na altura dos olhos. Sem folga nenhuma: a arte
// tem o lado direito reto de propósito, e é o encaixe na beirada que dá a
// impressão de que o gato está espiando de trás da tela.
function posicionarLembrete(arte) {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const work = display.workArea;
  const height = Math.min(arte.height, work.height);
  const width = Math.round(arte.width * (height / arte.height));
  reminderWin.setBounds({
    x: work.x + work.width - width,
    y: work.y + Math.round((work.height - height) / 2),
    width,
    height,
  });
}

function esconderLembrete() {
  clearTimeout(saidaTimer);
  if (!reminderWin || reminderWin.isDestroyed()) return;
  reminderWin.webContents.send('lembrete-saindo');
  // espera a animação de saída antes de sumir de verdade
  saidaTimer = setTimeout(() => {
    if (reminderWin && !reminderWin.isDestroyed()) reminderWin.hide();
  }, 550);
}

function mostrarLembrete(texto) {
  const arte = arteDeAgua();
  if (!arte) {
    // Nenhuma skin tem a arte: avisa pelo Windows mesmo, sem gatinho.
    if (Notification.isSupported()) {
      new Notification({ title: 'Post-it', body: texto }).show();
    }
    return;
  }

  if (!reminderWin || reminderWin.isDestroyed()) criarReminderWin(arte);

  const enviar = () => {
    posicionarLembrete(arte);
    reminderWin.showInactive();
    reminderWin.setAlwaysOnTop(true, 'screen-saver');
    reminderWin.webContents.send('lembrete', {
      arte: arte.url,
      texto,
      som: aguaConfig().som !== false ? caminhoDoMiau() : null,
    });
    clearTimeout(saidaTimer);
    saidaTimer = setTimeout(esconderLembrete, LEMBRETE_SEG * 1000);
  };

  if (reminderWin.webContents.isLoading()) {
    reminderWin.webContents.once('did-finish-load', enviar);
  } else {
    enviar();
  }
}

// O som não vem junto com o programa (seria redistribuir áudio de terceiros).
// Cada pessoa coloca o seu: primeiro na pasta de dados do app, depois na pasta
// do projeto para quem roda pelo código.
function caminhoDoMiau() {
  const candidatos = [
    path.join(app.getPath('userData'), 'miau.mp3'),
    path.join(__dirname, 'assets', 'sounds', 'miau.mp3'),
  ];
  const achado = candidatos.find((p) => fs.existsSync(p));
  return achado ? `file:///${achado.replace(/\\/g, '/')}` : null;
}

function tocarLembreteAgua() {
  const cfg = aguaConfig();
  if (!cfg.ativo) return;
  if (dentroDoSilencio(cfg)) return;

  // ninguém na frente: guarda a vez e volta daqui a pouco
  if (powerMonitor.getSystemIdleTime() > OCIOSO_SEG) {
    clearTimeout(retentarTimer);
    retentarTimer = setTimeout(tocarLembreteAgua, RETENTAR_SEG * 1000);
    return;
  }

  // só conta como lembrete dado o que a pessoa teve chance de ver
  store.setSetting('aguaUltimo', Date.now());
  const texto = RECADOS_AGUA[Math.floor(Math.random() * RECADOS_AGUA.length)];
  mostrarLembrete(texto);
}

// A contagem tem que sobreviver a desligar o computador. Antes ela vivia só no
// setInterval, que recomeça do zero a cada abertura do programa: quem reinicia
// antes do intervalo terminar nunca chega a ver o lembrete uma vez sequer.
// Agora a hora do último lembrete fica gravada, e ao abrir o programa a espera
// é só o que falta dela.
function reagendarAgua() {
  clearInterval(lembreteTimer);
  clearTimeout(aguaTimeout);
  clearTimeout(retentarTimer);
  lembreteTimer = null;
  aguaTimeout = null;
  retentarTimer = null;

  const cfg = aguaConfig();
  if (!cfg.ativo) {
    esconderLembrete();
    return;
  }

  const periodo = cfg.intervaloMin * 60 * 1000;
  const decorrido = Date.now() - (store.getSetting('aguaUltimo', 0) || 0);
  // nunca na mesma hora em que o programa abre: dá tempo de a área de trabalho
  // terminar de carregar antes de um gato pular na tela
  const espera = Math.max(20 * 1000, periodo - decorrido);

  aguaTimeout = setTimeout(() => {
    tocarLembreteAgua();
    lembreteTimer = setInterval(tocarLembreteAgua, periodo);
  }, espera);
}

function definirAgua(patch) {
  store.setSetting('agua', { ...aguaConfig(), ...patch });
  reagendarAgua();
  if (tray) tray.setContextMenu(buildContextMenu());
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.webContents.send('agua-changed', aguaConfig());
  }
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
  const opts = { openAtLogin: enabled };
  // Instalado, o próprio executável sobe sozinho. Em desenvolvimento é preciso
  // dizer ao Electron qual projeto abrir, senão ele subiria vazio.
  if (!app.isPackaged) {
    opts.path = process.execPath;
    opts.args = [path.resolve(__dirname)];
  }
  app.setLoginItemSettings(opts);
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
      label: 'Lembrete de água',
      submenu: [
        {
          label: 'Desligado',
          type: 'radio',
          checked: !aguaConfig().ativo,
          click: () => definirAgua({ ativo: false }),
        },
        { type: 'separator' },
        ...[30, 45, 60, 90, 120].map((m) => ({
          label: m < 60 ? `A cada ${m} minutos` : `A cada ${m / 60} hora${m > 60 ? 's' : ''}`,
          type: 'radio',
          checked: aguaConfig().ativo && aguaConfig().intervaloMin === m,
          click: () => definirAgua({ ativo: true, intervaloMin: m }),
        })),
      ],
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
    { label: 'Sobre', click: () => showAbout() },
    { label: 'Sair', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
}

function showAbout() {
  dialog.showMessageBox({
    type: 'none',
    icon: nativeImage.createFromPath(
      path.join(SKINS_DIR, currentSkin() ? currentSkin().id : '', 'app.png')
    ),
    title: 'Sobre o Post-it',
    message: 'Post-it',
    detail: `Lembretes que piscam na barra de tarefas.\n\nFeito por ${AUTOR.nome}.`,
    buttons: ['Instagram', 'Código no GitHub', 'Fechar'],
    defaultId: 2,
    cancelId: 2,
  }).then(({ response }) => {
    if (response === 0) shell.openExternal(AUTOR.instagram);
    if (response === 1) shell.openExternal(AUTOR.github);
  });
}

// Um post-it só. Sem isso, abrir o atalho de novo criaria uma segunda cópia
// disputando o mesmo arquivo de tarefas.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (panelWin && !panelWin.isDestroyed()) showPanel();
  });
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
  reagendarAgua();

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
ipcMain.handle('agua:get', () => aguaConfig());
ipcMain.handle('agua:set', (_e, patch) => {
  definirAgua(patch);
  return aguaConfig();
});
ipcMain.handle('agua:testar', () => mostrarLembrete(RECADOS_AGUA[0]));
ipcMain.handle('lembrete:fechar', () => esconderLembrete());
ipcMain.handle('autor:instagram', () => shell.openExternal(AUTOR.instagram));
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
