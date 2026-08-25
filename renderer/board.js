const boardEl = document.getElementById('board');

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

function fallbackPos(index) {
  const cols = Math.max(3, Math.floor((boardEl.clientWidth || 900) / 225));
  const col = index % cols;
  const row = Math.floor(index / cols);
  const jitterX = (Math.random() - 0.5) * 16;
  const jitterY = (Math.random() - 0.5) * 16;
  return { x: 30 + col * 220 + jitterX, y: 30 + row * 275 + jitterY };
}

async function render() {
  const tasks = await window.api.getUpcoming();
  boardEl.innerHTML = '';
  if (!tasks.length) {
    const e = document.createElement('div');
    e.className = 'empty-msg';
    e.textContent = 'Nenhum agendamento futuro.\nAdicione uma tarefa pelo painel do post-it.';
    boardEl.appendChild(e);
    return;
  }
  tasks.forEach((t, i) => {
    const pos = t.x != null && t.y != null ? { x: t.x, y: t.y } : fallbackPos(i);
    const note = document.createElement('div');
    note.className = 'note' + (t.done ? ' done' : '');
    note.style.left = pos.x + 'px';
    note.style.top = pos.y + 'px';
    note.style.transform = `rotate(${t.rotation || 0}deg)`;
    note.dataset.id = t.id;
    note.innerHTML = `
      <div class="slice slice-head"></div>
      <div class="slice slice-mid"></div>
      <div class="slice slice-foot"></div>
      <div class="meta">${formatDate(t.date)}${t.time ? ' · ' + t.time : ' · qualquer horário'}</div>
      <div class="text"></div>
      <div class="actions">
        <button class="doneBtn">${t.done ? 'reabrir' : 'concluir'}</button>
        <button class="delBtn">excluir</button>
      </div>
    `;
    note.querySelector('.text').textContent = t.text;
    note.querySelector('.doneBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.toggleDone(t.id);
      render();
    });
    note.querySelector('.delBtn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.api.deleteTask(t.id);
      render();
    });
    makeDraggable(note, t.id);
    boardEl.appendChild(note);
  });
}

function makeDraggable(el, id) {
  let dragging = false;
  let offX = 0, offY = 0;

  el.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    dragging = true;
    const rect = el.getBoundingClientRect();
    const boardRect = boardEl.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    el.style.zIndex = 10;
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const boardRect = boardEl.getBoundingClientRect();
    const x = e.clientX - boardRect.left - offX + boardEl.scrollLeft;
    const y = e.clientY - boardRect.top - offY + boardEl.scrollTop;
    el.style.left = Math.max(0, x) + 'px';
    el.style.top = Math.max(0, y) + 'px';
  });

  window.addEventListener('mouseup', async () => {
    if (!dragging) return;
    dragging = false;
    el.style.zIndex = '';
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    await window.api.updatePos(id, x, y);
  });
}

document.getElementById('closeBtn').addEventListener('click', () => window.api.closeBoard());
window.api.onTasksChanged(() => render());
render();
