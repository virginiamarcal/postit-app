const listEl = document.getElementById('list');
const dateLabel = document.getElementById('dateLabel');
const taskText = document.getElementById('taskText');
const taskDate = document.getElementById('taskDate');
const hasTime = document.getElementById('hasTime');
const taskTime = document.getElementById('taskTime');

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

async function init() {
  const today = await window.api.getTodayStr();
  taskDate.value = today;
  const d = new Date();
  dateLabel.textContent = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
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

document.getElementById('closeBtn').addEventListener('click', () => window.api.hidePanel());
document.getElementById('boardBtn').addEventListener('click', () => window.api.openBoard());

window.api.onTasksChanged(() => render());
init();
