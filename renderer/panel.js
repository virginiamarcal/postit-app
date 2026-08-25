const listEl = document.getElementById('list');
const dateLabel = document.getElementById('dateLabel');
const taskText = document.getElementById('taskText');
const taskDate = document.getElementById('taskDate');
const hasTime = document.getElementById('hasTime');
const taskTime = document.getElementById('taskTime');

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const postitEl = document.querySelector('.postit');
const skinBtn = document.getElementById('skinBtn');
const skinPicker = document.getElementById('skinPicker');
const skinGrid = document.getElementById('skinGrid');

let currentSkin = null;

function paintSkin(skin) {
  if (skin) currentSkin = skin;
  applySkin(postitEl, currentSkin, { width: postitEl.clientWidth });
}

// A janela muda de tamanho conforme o papel; as medidas precisam acompanhar.
window.addEventListener('resize', () => paintSkin(null));

async function buildSkinPicker() {
  const { skins, currentId } = await window.api.listSkins();
  skinGrid.innerHTML = '';
  // Com um papel só não há o que escolher — some com o botão.
  skinBtn.style.display = skins.length > 1 ? 'flex' : 'none';
  for (const s of skins) {
    const btn = document.createElement('button');
    btn.className = 'skinOpt' + (s.id === currentId ? ' sel' : '');
    btn.title = s.name;
    btn.innerHTML = `<img src="../assets/skins/${s.id}/thumb.png" alt="${s.name}">`;
    btn.addEventListener('click', async () => {
      paintSkin(await window.api.setSkin(s.id));
      skinPicker.classList.remove('open');
      buildSkinPicker();
    });
    skinGrid.appendChild(btn);
  }
}

// ---- lembrete de água ----
const aguaBtn = document.getElementById('aguaBtn');
const aguaPanel = document.getElementById('aguaPanel');
const aguaAtivo = document.getElementById('aguaAtivo');
const aguaIntervalo = document.getElementById('aguaIntervalo');
const aguaSom = document.getElementById('aguaSom');

function paintAgua(cfg) {
  aguaAtivo.checked = !!cfg.ativo;
  aguaIntervalo.value = String(cfg.intervaloMin);
  aguaSom.checked = cfg.som !== false;
  aguaBtn.classList.toggle('on', !!cfg.ativo);
  aguaBtn.title = cfg.ativo
    ? `Lembrete de água a cada ${cfg.intervaloMin} min`
    : 'Lembrete de água (desligado)';
}

aguaBtn.addEventListener('click', () => {
  aguaPanel.classList.toggle('open');
  skinPicker.classList.remove('open');
});
aguaAtivo.addEventListener('change', async () => {
  paintAgua(await window.api.setAgua({ ativo: aguaAtivo.checked }));
});
aguaIntervalo.addEventListener('change', async () => {
  paintAgua(await window.api.setAgua({
    ativo: true,
    intervaloMin: Number(aguaIntervalo.value),
  }));
});
aguaSom.addEventListener('change', async () => {
  paintAgua(await window.api.setAgua({ som: aguaSom.checked }));
});
document.getElementById('aguaTestar').addEventListener('click', () => window.api.testarAgua());
window.api.onAguaChanged(paintAgua);

skinBtn.addEventListener('click', () => {
  skinPicker.classList.toggle('open');
  aguaPanel.classList.remove('open');
});
document.addEventListener('click', (e) => {
  if (!skinPicker.contains(e.target) && e.target !== skinBtn) {
    skinPicker.classList.remove('open');
  }
  if (!aguaPanel.contains(e.target) && e.target !== aguaBtn) {
    aguaPanel.classList.remove('open');
  }
});
window.api.onSkinChanged((skin) => { paintSkin(skin); buildSkinPicker(); });

async function init() {
  const today = await window.api.getTodayStr();
  taskDate.value = today;
  const d = new Date();
  dateLabel.textContent = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  paintSkin(await window.api.getSkin());
  await buildSkinPicker();
  paintAgua(await window.api.getAgua());
  paintPin(await window.api.getPinned());
  await render();
}

async function render() {
  const tasks = await window.api.getToday();
  listEl.innerHTML = '';
  if (!tasks.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'Nada pendente hoje 🎉';
    listEl.appendChild(e);
    return;
  }
  for (const t of tasks) {
    const row = document.createElement('div');
    row.className = 'task' + (t.done ? ' done' : '');
    row.innerHTML = `
      <div class="check">${t.done ? '✓' : ''}</div>
      <div class="body">
        <div class="text"></div>
        <div class="time">${t.time ? t.time : 'qualquer horário'}</div>
      </div>
      <button class="del">✕</button>
    `;
    row.querySelector('.text').textContent = t.text;
    row.querySelector('.check').addEventListener('click', async () => {
      await window.api.toggleDone(t.id);
    });
    row.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteTask(t.id);
    });
    listEl.appendChild(row);
  }
}

hasTime.addEventListener('change', () => {
  taskTime.style.display = hasTime.checked ? 'block' : 'none';
});

document.getElementById('addBtn').addEventListener('click', async () => {
  const text = taskText.value.trim();
  if (!text) return;
  const date = taskDate.value;
  const time = hasTime.checked ? taskTime.value : null;
  await window.api.addTask({ text, date, time });
  taskText.value = '';
  hasTime.checked = false;
  taskTime.style.display = 'none';
  taskTime.value = '';
});

taskText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addBtn').click();
});

const pinBtn = document.getElementById('pinBtn');

function paintPin(pinned) {
  pinBtn.classList.toggle('on', pinned);
  pinBtn.title = pinned
    ? 'Fixado na tela — clique para desafixar'
    : 'Fixar na tela (não some ao clicar fora)';
}

pinBtn.addEventListener('click', async () => {
  paintPin(await window.api.togglePinned());
});
window.api.onPinChanged(paintPin);

document.getElementById('pawMark').addEventListener('click', () => window.api.abrirInstagram());
document.getElementById('closeBtn').addEventListener('click', () => window.api.hidePanel());
document.getElementById('boardBtn').addEventListener('click', () => window.api.openBoard());

window.api.onTasksChanged(() => render());
init();
