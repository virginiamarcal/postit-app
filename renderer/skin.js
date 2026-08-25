// Traduz as medidas de uma "pele" (papel do post-it) para variáveis de CSS.
//
// O manifesto guarda tudo em pixels da arte original. Aqui isso vira proporção
// para a nota funcionar em qualquer tamanho e com qualquer arte, sem ninguém
// precisar medir nada na mão.
//
// Ancoragem: o topo do papel é medido a partir do topo da janela; a base, a
// partir da base. A faixa do meio estica para preencher o que sobrar.

function applySkin(el, skin, opts = {}) {
  if (!skin) return;
  const width = opts.width || el.clientWidth || 420;
  const scale = width / skin.width;
  const pad = opts.pad != null ? opts.pad : 10;
  const dir = `../assets/skins/${skin.id}`;

  const s = el.style;
  s.setProperty('--head-h', `${Math.round(skin.headH * scale)}px`);
  s.setProperty('--foot-h', `${Math.round(skin.footH * scale)}px`);
  s.setProperty('--head-img', `url('${dir}/head.png')`);
  s.setProperty('--mid-img', `url('${dir}/mid.png')`);
  s.setProperty('--foot-img', `url('${dir}/foot.png')`);

  // área útil: dentro do papel, com uma folga para o texto não colar na borda
  s.setProperty('--paper-left', `${Math.round(skin.paper.left * scale) + pad}px`);
  s.setProperty('--paper-right', `${Math.round((skin.width - skin.paper.right) * scale) + pad}px`);
  s.setProperty('--paper-top', `${Math.round(skin.paper.top * scale) + pad}px`);

  // O conteúdo para onde começa a fatia do rodapé. A dobrinha do canto mora
  // dentro dessa faixa, então reservá-la inteira mantém texto e botões longe
  // dela em qualquer arte, sem precisar medir a dobra.
  s.setProperty('--paper-bottom', `${Math.round(skin.footH * scale) + pad}px`);
}

// Altura mínima para a arte não ficar espremida (topo + base + um respiro).
function minSkinHeight(skin, width, extra = 60) {
  const scale = width / skin.width;
  return Math.round((skin.headH + skin.footH) * scale) + extra;
}

// Tamanho de janela que faz o papel sair com a mesma largura útil em qualquer
// arte. Sem isso, uma arte de papel estreito renderiza uma nota pequena com
// vão transparente sobrando dos lados.
function panelSizeFor(skin, targetPaperW = 330, midRoom = 300) {
  if (!skin) return { width: 420, height: 600 };
  const paperRatio = (skin.paper.right - skin.paper.left) / skin.width;
  const width = Math.round(targetPaperW / paperRatio);
  const scale = width / skin.width;
  const height = Math.round((skin.headH + skin.footH) * scale) + midRoom;
  return { width, height };
}

if (typeof module !== 'undefined') {
  module.exports = { applySkin, minSkinHeight, panelSizeFor };
}
