const postitEl = document.getElementById('postit');
const recadoEl = document.getElementById('recado');

// Clicar dispensa o lembrete antes da hora.
postitEl.addEventListener('click', () => window.api.fecharLembrete());

// Miau baixinho. O caminho vem pronto do processo principal, que já procurou o
// arquivo; se não houver som, o lembrete aparece calado — nunca quebra.
function miar(url) {
  try {
    const som = new Audio(url);
    som.volume = 0.35;
    som.play().catch(() => {});
  } catch {
    /* sem som, tudo bem */
  }
}

window.api.onLembrete(({ skin, texto, som }) => {
  applySkin(postitEl, skin, { width: postitEl.clientWidth, pad: 8 });
  recadoEl.textContent = texto;
  if (som) miar(som);

  // dois quadros antes de animar, para o estado inicial valer
  postitEl.classList.remove('saindo');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    postitEl.classList.add('entrou');
  }));
});

window.api.onLembreteSaindo(() => {
  postitEl.classList.remove('entrou');
  postitEl.classList.add('saindo');
});
