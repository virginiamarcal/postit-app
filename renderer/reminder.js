const gatoEl = document.getElementById('gato');

// Clicar dispensa o lembrete antes da hora.
gatoEl.addEventListener('click', () => window.api.fecharLembrete());

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

window.api.onLembrete(({ arte, texto, som }) => {
  gatoEl.src = arte;
  gatoEl.alt = texto;
  gatoEl.title = texto;
  if (som) miar(som);

  // dois quadros antes de animar, para o estado inicial valer
  gatoEl.classList.remove('saindo');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    gatoEl.classList.add('entrou');
  }));
});

window.api.onLembreteSaindo(() => {
  gatoEl.classList.remove('entrou');
  gatoEl.classList.add('saindo');
});
