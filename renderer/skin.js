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

  // A base sobe o suficiente para não passar por cima da dobrinha do canto.
  const bottomEdge = Math.round((skin.height - skin.paper.bottom) * scale) + pad;
  const curlClear = Math.round((skin.curl || 0) * scale);
  s.setProperty('--paper-bottom', `${Math.max(bottomEdge, curlClear)}px`);
}

// Altura mínima para a arte não ficar espremida (topo + base + um respiro).
function minSkinHeight(skin, width, extra = 60) {
  const scale = width / skin.width;
  return Math.round((skin.headH + skin.footH) * scale) + extra;
}
