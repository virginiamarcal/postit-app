# Post-it 🐱

Um post-it de lembretes para Windows que fica na barra de tarefas e **pisca quando há tarefa pendente no dia** — para não precisar lembrar de conferir, nem deixar uma nota aberta por cima das outras janelas.

![post-it com gatinho](assets/skins-src/gatinho-laranja.png)

## O que faz

- **Alerta na barra de tarefas.** Havendo pendência para hoje, o botão do app pisca em laranja e ganha um selo vermelho sobre o ícone. O ícone da bandeja (perto do relógio) também pisca.
- **Painel do dia.** Um clique abre o post-it sobre as janelas, com as tarefas de hoje e um campo para adicionar novas.
- **Fixar na tela 📌.** Por padrão a nota sai da frente sozinha ao clicar fora. Fixada, ela fica presa por cima das janelas até você desafixar — e volta no mesmo canto onde foi largada.
- **Lembrete de água 💧.** De tempos em tempos o gatinho espia pela lateral da tela oferecendo um copo d'água, e some sozinho depois de alguns segundos. Não há texto: o desenho já diz. Cada papel tem o seu gato. Você liga e escolhe o intervalo no próprio post-it. Ele fica quieto das 22h às 8h, e se você não estiver na frente do computador ele guarda a vez e volta daqui a pouco, em vez de perder o horário. E mia baixinho ao aparecer — dá para trocar pelo miado do seu gato, veja [assets/sounds](assets/sounds/LEIA-ME.md).
- **Agenda.** Toda tarefa tem data; o horário é opcional — "qualquer horário" ou uma hora marcada.
- **Notificação do Windows.** Tarefa com horário definido dispara um toast na hora marcada.
- **Quadro "Ver todos".** Mostra os agendamentos futuros como post-its espalhados, que podem ser arrastados e ficam onde você soltar.
- **Inicia com o Windows** (pode ser desligado no menu do ícone da bandeja).

## Instalar

Baixe o instalador na página de
[Releases](https://github.com/virginiamarcal/postit-app/releases), abra e
avance. Não precisa instalar mais nada.

> O Windows pode mostrar um aviso azul de "Windows protegeu o computador".
> Isso aparece em todo programa sem certificado digital pago — clique em
> **Mais informações** e depois em **Executar assim mesmo**.

Depois de instalar, o gatinho aparece na barra de tarefas e o programa passa a
abrir junto com o Windows (dá para desligar no menu do ícone da bandeja).

## Rodar a partir do código

Só para quem quiser mexer no projeto. Precisa de [Node.js](https://nodejs.org).

```bash
npm install
npm start
```

Para gerar o instalador:

```bash
npm run dist
```

## Trocar o papel do post-it 🐾

Ninguém tem um gato só. Dá para ter vários papéis e trocar quando quiser — pelo
botão 🐾 no post-it ou pelo menu **Trocar o papel** no ícone da bandeja. O ícone
na barra de tarefas muda junto.

### Adicionar um papel novo

1. Jogue o PNG em `assets/skins-src/`. O nome do arquivo vira o nome do papel
   (`gatinho-cinza.png` → "Gatinho cinza").
2. Rode:

   ```powershell
   powershell -File scripts/build-skins.ps1
   ```

3. Reinicie o app.

O script **encontra sozinho** onde fica o papel dentro da arte e recorta as três
fatias (topo com o bichinho, meio esticável, base com a dobrinha), mais as
miniaturas e os ícones. Não é preciso medir nada na mão.

O nome que aparece no menu sai de `assets/skins-src/names.json` (o nome do arquivo
vira identificador e não pode ter acento; o `names.json` é onde mora o nome
bonito). Sem entrada lá, o script usa o próprio nome do arquivo.

**A arte precisa ser:** um PNG **com fundo transparente**, com o bichinho em cima
e o papel embaixo ocupando quase toda a largura — é assim que o script separa um
do outro.

### Se a arte vier com o xadrez pintado

Geradores de imagem às vezes exportam o quadriculado cinza como pixel de verdade,
em vez de transparência — na tela parece igual, mas o recorte não funciona. O
sintoma é o `build-skins.ps1` reportar o papel ocupando a imagem inteira
(`papel x 0..<largura>`). Conserto:

```powershell
powershell -File scripts/fix-transparency.ps1 -Path assets/skins-src/arte.png
```

O fundo é apagado por preenchimento a partir das bordas, então só sai o que está
ligado ao contorno. O original é guardado ao lado como `arte.original.png`.

⚠️ **É um remendo, não substitui alfa de verdade.** Funciona bem em desenho com
contorno definido. Em **foto real** o pelo branco claro (patinha, queixo) se
dissolve no fundo sem fronteira nítida, e o preenchimento atravessa a beirada e
come o pelo por dentro. Se a arte for foto, peça ao gerador um PNG com fundo
transparente em vez de usar o script — e confira o resultado abrindo o PNG sobre
um fundo colorido antes de gerar as fatias.

Se numa arte a dobrinha do canto ficar por baixo dos botões, ajuste `curl` (em
pixels da arte original) no papel correspondente dentro de
`assets/skins/skins.json`. Valor maior afasta mais o conteúdo do canto.

### Dar um gatinho de água ao papel novo 💧

O lembrete de água usa uma segunda arte: o gato espiando por uma borda vertical,
segurando um copo. Coloque o PNG em `assets/agua-src/`, aponte para qual papel
ele pertence na tabela `$paraSkin` no alto de `scripts/build-agua.ps1`, e rode:

```powershell
powershell -File scripts/build-agua.ps1
```

O script acha o desenho dentro da imagem, corta o vazio em volta e grava
`agua.png` dentro da pasta do papel. Papel sem arte de água não fica sem
lembrete: ele empresta o gatinho de outro.

**A arte precisa ser:** o bichinho encostado numa **borda reta do lado direito**
— é essa borda que encaixa na lateral da tela e cria a impressão de que ele está
espiando por trás dela.

Se o gerador entregar a imagem com o contorno rosa (ou verde) do fundo grudado na
beirada, não precisa pedir de novo: o script desfaz essa mistura sozinho e ainda
apaga o que sobrar. O que ele **não** inventa é transparência — a arte tem que
vir com canal alfa de verdade.

## Uso

| Ação | Como |
|---|---|
| Abrir o post-it | Clicar no ícone do gatinho na barra de tarefas ou na bandeja |
| Fechar / sair da frente | Clicar fora, ou no ✕ — minimiza e continua na barra |
| Fixar / desafixar | Botão 📌 no post-it (fica laranja quando fixado) ou o menu da bandeja |
| Trocar o papel | Botão 🐾 no post-it, ou **Trocar o papel** no menu da bandeja |
| Lembrete de água | Botão 💧 no post-it: liga, escolhe o intervalo e testa como fica |
| Dispensar o gatinho da água | Clicar nele (ou esperar: some sozinho) |
| Nova tarefa | Digitar, escolher a data, marcar `hora?` se tiver horário, e Adicionar |
| Concluir | Clicar na bolinha ao lado da tarefa |
| Ver agendamentos futuros | Botão **Ver todos** |
| Iniciar com o Windows / Sair | Botão direito no ícone da bandeja |

## Onde ficam os dados

As tarefas ficam em `tasks.json`, dentro da pasta de dados do app no Windows
(`%APPDATA%/Post-it/`). Nada sai da máquina — não há servidor nem conta.

## Estrutura

```
main.js                  processo principal: bandeja, barra de tarefas, alertas, notificações
preload.js               ponte segura entre a interface e o processo principal
store.js                 persistência das tarefas em JSON
renderer/skin.js         traduz as medidas do papel escolhido em variáveis de CSS
renderer/panel.*         painel "Hoje" (janela transparente)
renderer/board.*         quadro com os post-its espalhados
renderer/reminder.*      o gatinho do lembrete de água, na lateral da tela
scripts/build-skins.ps1  detecta e recorta os papéis a partir de assets/skins-src
scripts/build-agua.ps1   limpa e recorta as artes de água de assets/agua-src
assets/skins-src/        as artes originais (PNG com fundo transparente)
assets/agua-src/         as artes originais do lembrete de água
assets/skins/            fatias, miniaturas, ícones e o manifesto skins.json
```

Cada arte é fatiada em três — topo (o bichinho), meio (esticável) e base (a
dobrinha) — para a nota crescer conforme a lista sem distorcer o desenho. O
manifesto guarda as medidas em pixels da arte original, e a interface converte
para proporção na hora de desenhar; é isso que faz qualquer arte funcionar sem
ajuste manual.

A janela também se dimensiona por papel, para o papel sair sempre com a mesma
largura útil — artes diferentes vêm com o papel mais largo ou mais estreito
dentro do PNG, e uma janela de tamanho fixo deixaria vão transparente sobrando
nas mais estreitas.

## Licença

MIT — veja [LICENSE](LICENSE). Use, modifique e distribua à vontade.

As artes dos gatos foram geradas por IA e acompanham o projeto sob a mesma
licença.

O miado (`assets/sounds/miau.mp3`) é do [Pixabay](https://pixabay.com/sound-effects/),
por *sound_garage*, sob a [Pixabay Content License](https://pixabay.com/service/license-summary/),
que permite redistribuir junto com o programa sem exigir crédito — este aqui é
por cortesia.

---

Feito por [@virginiamarcal](https://instagram.com/virginiamarcal) 🐾
